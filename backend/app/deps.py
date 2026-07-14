from collections.abc import Iterator
import sqlite3
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.config import get_database_path
from app.database import (
    BoardError,
    NotFoundError,
    connect,
    get_user_id,
)


def get_current_username(
    x_user: Annotated[str | None, Header(alias="X-User")] = None,
) -> str:
    if not x_user:
        raise HTTPException(status_code=401, detail="Missing X-User header")
    return x_user


def require_known_user(
    username: Annotated[str, Depends(get_current_username)],
) -> str:
    # NOTE: this only confirms the header was supplied. Actual user
    # existence/ownership is enforced per-resource in app.database.
    return username


def get_db_connection() -> Iterator[sqlite3.Connection]:
    """Open a dedicated SQLite connection for the lifetime of one request.

    A fresh connection per request (closed in ``finally``) replaces the
    former single global connection. Sharing one connection across
    concurrent requests corrupted transaction/parameter state and raised
    ``sqlite3.InterfaceError`` under load (see docs/code_review.md A1).
    """
    connection = connect(get_database_path())
    try:
        yield connection
    finally:
        connection.close()
