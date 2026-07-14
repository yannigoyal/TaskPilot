"""Integration tests for POST /api/chat with mocked LLM replies."""

import json

AUTH = {"X-User": "user"}


def _llm(message: str, operations: list | None = None) -> str:
    payload: dict = {"message": message}
    if operations is not None:
        payload["operations"] = operations
    return json.dumps(payload)


def _mock_llm(monkeypatch, reply: str):
    monkeypatch.setattr(
        "app.chat.chat_completion_messages",
        lambda *_args, **_kwargs: reply,
    )


def test_chat_requires_auth(client):
    response = client.post("/api/chat", json={"message": "Hi"})
    assert response.status_code == 401


def test_chat_reply_only_leaves_board_unchanged(client, monkeypatch):
    before = client.get("/api/board", headers=AUTH).json()
    _mock_llm(monkeypatch, _llm("You have five columns on the board."))

    response = client.post("/api/chat", headers=AUTH, json={"message": "Summarize"})
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "You have five columns on the board."
    assert body.get("board") is None

    after = client.get("/api/board", headers=AUTH).json()
    assert after == before


def test_chat_create_card_persists(client, monkeypatch):
    _mock_llm(
        monkeypatch,
        _llm(
            "Added a card.",
            [
                {
                    "type": "create_card",
                    "column_id": "col-backlog",
                    "title": "AI created task",
                    "details": "From chat",
                }
            ],
        ),
    )

    response = client.post(
        "/api/chat", headers=AUTH, json={"message": "Add a card to backlog"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Added a card."
    assert body["board"] is not None

    titles = [card["title"] for card in body["board"]["cards"].values()]
    assert "AI created task" in titles

    board = client.get("/api/board", headers=AUTH).json()
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    backlog_titles = [board["cards"][cid]["title"] for cid in backlog["cardIds"]]
    assert "AI created task" in backlog_titles


def test_chat_move_card_persists(client, monkeypatch):
    _mock_llm(
        monkeypatch,
        _llm(
            "Moved CI card.",
            [
                {
                    "type": "move_card",
                    "card_id": "card-2",
                    "column_id": "col-progress",
                    "position": 0,
                }
            ],
        ),
    )

    response = client.post(
        "/api/chat",
        headers=AUTH,
        json={"message": "Move Set up CI pipeline to In Progress"},
    )
    assert response.status_code == 200
    board = response.json()["board"]
    progress = next(c for c in board["columns"] if c["id"] == "col-progress")
    assert progress["cardIds"][0] == "card-2"
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    assert "card-2" not in backlog["cardIds"]

    reloaded = client.get("/api/board", headers=AUTH).json()
    progress = next(c for c in reloaded["columns"] if c["id"] == "col-progress")
    assert progress["cardIds"][0] == "card-2"


def test_chat_update_delete_rename(client, monkeypatch):
    _mock_llm(
        monkeypatch,
        _llm(
            "Updated board.",
            [
                {
                    "type": "update_card",
                    "card_id": "card-1",
                    "title": "Define MVP scope v2",
                    "details": "Updated details",
                },
                {"type": "delete_card", "card_id": "card-8"},
                {
                    "type": "rename_column",
                    "column_id": "col-done",
                    "title": "Shipped",
                },
            ],
        ),
    )

    response = client.post("/api/chat", headers=AUTH, json={"message": "Tidy up"})
    assert response.status_code == 200
    board = response.json()["board"]
    assert board["cards"]["card-1"]["title"] == "Define MVP scope v2"
    assert board["cards"]["card-1"]["details"] == "Updated details"
    assert "card-8" not in board["cards"]
    done = next(c for c in board["columns"] if c["id"] == "col-done")
    assert done["title"] == "Shipped"


def test_chat_invalid_operation_does_not_corrupt(client, monkeypatch):
    before = client.get("/api/board", headers=AUTH).json()
    _mock_llm(
        monkeypatch,
        _llm(
            "Trying bad ops.",
            [
                {
                    "type": "rename_column",
                    "column_id": "col-backlog",
                    "title": "Should not stick",
                },
                {
                    "type": "delete_card",
                    "card_id": "card-does-not-exist",
                },
            ],
        ),
    )

    response = client.post("/api/chat", headers=AUTH, json={"message": "Break it"})
    assert response.status_code == 400
    assert "unknown card_id" in response.json()["detail"]

    after = client.get("/api/board", headers=AUTH).json()
    assert after == before
    backlog = next(c for c in after["columns"] if c["id"] == "col-backlog")
    assert backlog["title"] == "Backlog"


def test_chat_malformed_llm_json_returns_502(client, monkeypatch):
    _mock_llm(monkeypatch, "sorry I cannot help")

    response = client.post("/api/chat", headers=AUTH, json={"message": "Hi"})
    assert response.status_code == 502


def test_chat_missing_api_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    def boom(*_args, **_kwargs):
        from app.openrouter import MissingApiKeyError

        raise MissingApiKeyError()

    monkeypatch.setattr("app.chat.chat_completion_messages", boom)

    response = client.post("/api/chat", headers=AUTH, json={"message": "Hi"})
    assert response.status_code == 503


def test_chat_history_not_written_to_db(client, monkeypatch):
    _mock_llm(monkeypatch, _llm("Noted."))

    response = client.post(
        "/api/chat",
        headers=AUTH,
        json={
            "message": "Remember this",
            "history": [
                {"role": "user", "content": "Earlier question"},
                {"role": "assistant", "content": "Earlier answer"},
            ],
        },
    )
    assert response.status_code == 200

    from app.config import get_database_path
    from app.database import connect

    conn = connect(get_database_path())
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    conn.close()
    assert "chat_messages" not in tables
    assert "messages" not in tables


def test_chat_applies_multiple_ops_transactionally(client, monkeypatch):
    """First op would succeed alone; second is invalid — nothing is committed."""
    before = client.get("/api/board", headers=AUTH).json()
    _mock_llm(
        monkeypatch,
        _llm(
            "Nope.",
            [
                {
                    "type": "create_card",
                    "column_id": "col-backlog",
                    "title": "Should not appear",
                },
                {
                    "type": "move_card",
                    "card_id": "card-missing",
                    "column_id": "col-done",
                    "position": 0,
                },
            ],
        ),
    )

    response = client.post("/api/chat", headers=AUTH, json={"message": "Do both"})
    assert response.status_code == 400

    after = client.get("/api/board", headers=AUTH).json()
    assert after == before
    titles = [c["title"] for c in after["cards"].values()]
    assert "Should not appear" not in titles
