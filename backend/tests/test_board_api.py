import pytest

AUTH_HEADERS = {"X-User": "user"}


def _get_board(client, headers=AUTH_HEADERS):
    response = client.get("/api/board", headers=headers)
    assert response.status_code == 200
    return response.json()


def test_get_board_requires_auth(client) -> None:
    response = client.get("/api/board")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing X-User header"


def test_get_board_rejects_unknown_user(client) -> None:
    response = client.get("/api/board", headers={"X-User": "nobody"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Unknown user"


def test_get_board_returns_seed_shape(client) -> None:
    board = _get_board(client)
    assert len(board["columns"]) == 5
    assert board["columns"][0]["id"] == "col-backlog"
    assert board["columns"][0]["cardIds"] == ["card-1", "card-2"]
    assert board["cards"]["card-1"]["title"] == "Define MVP scope"


def test_rename_column_persists(client) -> None:
    response = client.patch(
        "/api/columns/col-backlog",
        headers=AUTH_HEADERS,
        json={"title": "Ideas"},
    )
    assert response.status_code == 200
    board = response.json()
    assert board["columns"][0]["title"] == "Ideas"

    reloaded = _get_board(client)
    assert reloaded["columns"][0]["title"] == "Ideas"


def test_rename_column_not_found(client) -> None:
    response = client.patch(
        "/api/columns/missing-col",
        headers=AUTH_HEADERS,
        json={"title": "Nope"},
    )
    assert response.status_code == 404


def test_rename_column_rejects_empty_title(client) -> None:
    response = client.patch(
        "/api/columns/col-backlog",
        headers=AUTH_HEADERS,
        json={"title": "   "},
    )
    assert response.status_code == 422


def test_create_card_appends_by_default(client) -> None:
    response = client.post(
        "/api/cards",
        headers=AUTH_HEADERS,
        json={
            "column_id": "col-backlog",
            "title": "New card",
            "details": "Notes",
        },
    )
    assert response.status_code == 201
    board = response.json()
    backlog = board["columns"][0]
    assert backlog["cardIds"][-1].startswith("card-")
    new_id = backlog["cardIds"][-1]
    assert board["cards"][new_id]["title"] == "New card"
    assert board["cards"][new_id]["details"] == "Notes"


def test_create_card_at_position(client) -> None:
    response = client.post(
        "/api/cards",
        headers=AUTH_HEADERS,
        json={
            "column_id": "col-backlog",
            "title": "Inserted",
            "details": "",
            "position": 0,
        },
    )
    assert response.status_code == 201
    board = response.json()
    assert board["columns"][0]["cardIds"][0] == next(
        card_id
        for card_id in board["columns"][0]["cardIds"]
        if board["cards"][card_id]["title"] == "Inserted"
    )


def test_create_card_unknown_column(client) -> None:
    response = client.post(
        "/api/cards",
        headers=AUTH_HEADERS,
        json={"column_id": "col-missing", "title": "X"},
    )
    assert response.status_code == 404


def test_update_card_title_and_details(client) -> None:
    response = client.patch(
        "/api/cards/card-1",
        headers=AUTH_HEADERS,
        json={"title": "Updated title", "details": "Updated details"},
    )
    assert response.status_code == 200
    board = response.json()
    assert board["cards"]["card-1"]["title"] == "Updated title"
    assert board["cards"]["card-1"]["details"] == "Updated details"


def test_update_card_requires_a_field(client) -> None:
    response = client.patch(
        "/api/cards/card-1",
        headers=AUTH_HEADERS,
        json={},
    )
    assert response.status_code == 422


def test_update_card_not_found(client) -> None:
    response = client.patch(
        "/api/cards/card-missing",
        headers=AUTH_HEADERS,
        json={"title": "Nope"},
    )
    assert response.status_code == 404


def test_delete_card(client) -> None:
    response = client.delete("/api/cards/card-2", headers=AUTH_HEADERS)
    assert response.status_code == 200
    board = response.json()
    assert "card-2" not in board["cards"]
    assert "card-2" not in board["columns"][0]["cardIds"]


def test_delete_card_not_found(client) -> None:
    response = client.delete("/api/cards/card-missing", headers=AUTH_HEADERS)
    assert response.status_code == 404


def test_move_card_within_column(client) -> None:
    response = client.post(
        "/api/cards/card-2/move",
        headers=AUTH_HEADERS,
        json={"column_id": "col-backlog", "position": 0},
    )
    assert response.status_code == 200
    board = response.json()
    assert board["columns"][0]["cardIds"] == ["card-2", "card-1"]


def test_move_card_across_columns(client) -> None:
    response = client.post(
        "/api/cards/card-1/move",
        headers=AUTH_HEADERS,
        json={"column_id": "col-review", "position": 0},
    )
    assert response.status_code == 200
    board = response.json()
    review = next(column for column in board["columns"] if column["id"] == "col-review")
    backlog = next(column for column in board["columns"] if column["id"] == "col-backlog")
    assert review["cardIds"][0] == "card-1"
    assert "card-1" not in backlog["cardIds"]


def test_move_card_not_found(client) -> None:
    response = client.post(
        "/api/cards/card-missing/move",
        headers=AUTH_HEADERS,
        json={"column_id": "col-review", "position": 0},
    )
    assert response.status_code == 404


def test_move_card_unknown_target_column(client) -> None:
    response = client.post(
        "/api/cards/card-1/move",
        headers=AUTH_HEADERS,
        json={"column_id": "col-missing", "position": 0},
    )
    assert response.status_code == 404


def test_full_mutation_round_trip(client) -> None:
    client.patch(
        "/api/columns/col-done",
        headers=AUTH_HEADERS,
        json={"title": "Shipped"},
    )
    create_response = client.post(
        "/api/cards",
        headers=AUTH_HEADERS,
        json={"column_id": "col-review", "title": "Final check", "details": "QA"},
    )
    new_card_id = create_response.json()["columns"][3]["cardIds"][-1]
    client.patch(
        f"/api/cards/{new_card_id}",
        headers=AUTH_HEADERS,
        json={"details": "QA complete"},
    )
    client.post(
        f"/api/cards/{new_card_id}/move",
        headers=AUTH_HEADERS,
        json={"column_id": "col-done", "position": 0},
    )

    board = _get_board(client)
    done = next(column for column in board["columns"] if column["id"] == "col-done")
    assert done["title"] == "Shipped"
    assert done["cardIds"][0] == new_card_id
    assert board["cards"][new_card_id]["details"] == "QA complete"
