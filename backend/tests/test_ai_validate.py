"""Unit tests for AI operation validation against board state."""

import pytest

from app.ai_schemas import (
    CreateCardOp,
    DeleteCardOp,
    MoveCardOp,
    RenameColumnOp,
    UpdateCardOp,
)
from app.chat import AiValidationError, validate_operations
from app.database import connect, init_db, load_board


@pytest.fixture
def board(tmp_path):
    connection = connect(tmp_path / "board.db")
    init_db(connection)
    data = load_board(connection, "board-demo")
    connection.close()
    return data


def test_validate_create_card(board):
    validate_operations(
        board,
        [CreateCardOp(type="create_card", column_id="col-backlog", title="New")],
    )


def test_validate_update_card(board):
    validate_operations(
        board,
        [UpdateCardOp(type="update_card", card_id="card-1", title="Renamed")],
    )


def test_validate_delete_card(board):
    validate_operations(board, [DeleteCardOp(type="delete_card", card_id="card-1")])


def test_validate_move_card(board):
    validate_operations(
        board,
        [
            MoveCardOp(
                type="move_card",
                card_id="card-1",
                column_id="col-progress",
                position=0,
            )
        ],
    )


def test_validate_rename_column(board):
    validate_operations(
        board,
        [RenameColumnOp(type="rename_column", column_id="col-backlog", title="Ideas")],
    )


def test_reject_unknown_column_on_create(board):
    with pytest.raises(AiValidationError, match="unknown column_id"):
        validate_operations(
            board,
            [CreateCardOp(type="create_card", column_id="col-missing", title="X")],
        )


def test_reject_unknown_card_on_update(board):
    with pytest.raises(AiValidationError, match="unknown card_id"):
        validate_operations(
            board,
            [UpdateCardOp(type="update_card", card_id="card-missing", title="X")],
        )


def test_reject_move_after_delete_same_batch(board):
    with pytest.raises(AiValidationError, match="unknown card_id"):
        validate_operations(
            board,
            [
                DeleteCardOp(type="delete_card", card_id="card-1"),
                MoveCardOp(
                    type="move_card",
                    card_id="card-1",
                    column_id="col-done",
                    position=0,
                ),
            ],
        )


def test_sequential_create_then_rename_column_ok(board):
    validate_operations(
        board,
        [
            CreateCardOp(type="create_card", column_id="col-backlog", title="A"),
            RenameColumnOp(
                type="rename_column", column_id="col-backlog", title="Backlog+"
            ),
        ],
    )
