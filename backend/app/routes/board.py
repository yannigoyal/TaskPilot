import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.database import (
    BoardError,
    NotFoundError,
    create_card,
    delete_card,
    get_board_for_user,
    get_user_id,
    move_card,
    rename_column,
    update_card,
)
from app.deps import require_known_user
from app.schemas import BoardData, CardCreate, CardMove, CardUpdate, ColumnRename

router = APIRouter(prefix="/api", tags=["board"])


def get_db_connection() -> sqlite3.Connection:
    from app.main import db_connection

    return db_connection


def _handle_board_errors(username: str, connection: sqlite3.Connection) -> None:
    if get_user_id(connection, username) is None:
        raise HTTPException(status_code=401, detail="Unknown user")


def _run_board_action(action):
    def wrapper(*args, **kwargs):
        try:
            return action(*args, **kwargs)
        except NotFoundError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        except BoardError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return wrapper


@router.get("/board", response_model=BoardData)
def read_board(
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(get_board_for_user)(connection, username)


@router.patch("/columns/{column_id}", response_model=BoardData)
def patch_column(
    column_id: str,
    payload: ColumnRename,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(rename_column)(
        connection, username, column_id, payload.title
    )


@router.post("/cards", response_model=BoardData, status_code=201)
def post_card(
    payload: CardCreate,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(create_card)(
        connection,
        username,
        payload.column_id,
        payload.title,
        payload.details,
        payload.position,
    )


@router.patch("/cards/{card_id}", response_model=BoardData)
def patch_card(
    card_id: str,
    payload: CardUpdate,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(update_card)(
        connection, username, card_id, payload.title, payload.details
    )


@router.delete("/cards/{card_id}", response_model=BoardData)
def remove_card(
    card_id: str,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(delete_card)(connection, username, card_id)


@router.post("/cards/{card_id}/move", response_model=BoardData)
def post_move_card(
    card_id: str,
    payload: CardMove,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> BoardData:
    _handle_board_errors(username, connection)
    return _run_board_action(move_card)(
        connection, username, card_id, payload.column_id, payload.position
    )
