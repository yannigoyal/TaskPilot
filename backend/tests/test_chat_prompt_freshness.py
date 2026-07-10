"""Tests for chat prompt construction and fresh board context."""

import json

from app.ai_schemas import ChatMessage
from app.chat import build_openrouter_messages
from app.database import connect, init_db, load_board


def test_openrouter_messages_place_board_after_history(tmp_path):
    connection = connect(tmp_path / "prompt.db")
    init_db(connection)
    board = load_board(connection, "board-demo")
    connection.close()

    history = [
        ChatMessage(role="user", content="Summarize the board"),
        ChatMessage(
            role="assistant",
            content="Backlog has Define MVP scope and Set up CI pipeline.",
        ),
    ]
    messages = build_openrouter_messages(board, "Summarize again", history)

    assert messages[0]["role"] == "system"
    assert "Current board JSON" not in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert messages[2]["role"] == "assistant"
    assert messages[3]["role"] == "system"
    assert "Current board JSON" in messages[3]["content"]
    assert messages[4] == {"role": "user", "content": "Summarize again"}

    board_json = messages[3]["content"].split("Current board JSON", 1)[1]
    board_json = board_json.split(":\n", 1)[1]
    parsed = json.loads(board_json)
    assert len(parsed["columns"]) == 5


def test_chat_prompt_uses_board_after_move(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    database_path = tmp_path / "chat-fresh.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    captured: list[list[dict[str, str]]] = []

    def capture(messages, **_kwargs):
        captured.append(messages)
        return '{"message":"ok","operations":[]}'

    monkeypatch.setattr("app.chat.chat_completion_messages", capture)

    with TestClient(app) as client:
        headers = {"X-User": "user"}
        client.post(
            "/api/cards/card-1/move",
            headers=headers,
            json={"column_id": "col-done", "position": 0},
        )
        response = client.post(
            "/api/chat",
            headers=headers,
            json={
                "message": "Summarize",
                "history": [
                    {
                        "role": "assistant",
                        "content": "Define MVP scope is still in Backlog.",
                    }
                ],
            },
        )

    assert response.status_code == 200
    board_message = next(
        message
        for message in captured[0]
        if message["role"] == "system" and "Current board JSON" in message["content"]
    )
    board_json = board_message["content"].split(":\n", 1)[1]
    board = json.loads(board_json)
    done = next(column for column in board["columns"] if column["id"] == "col-done")
    backlog = next(
        column for column in board["columns"] if column["id"] == "col-backlog"
    )
    assert "card-1" in done["cardIds"]
    assert "card-1" not in backlog["cardIds"]
