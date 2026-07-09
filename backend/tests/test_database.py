import pytest

from app.database import connect, get_board_for_user, init_db, seed_db


def test_init_db_creates_schema_and_seeds(tmp_path) -> None:
    database_path = tmp_path / "new.db"
    connection = connect(database_path)
    init_db(connection)

    user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    column_count = connection.execute("SELECT COUNT(*) FROM columns").fetchone()[0]
    card_count = connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0]

    assert user_count == 1
    assert column_count == 5
    assert card_count == 8
    connection.close()


def test_init_db_does_not_reseed_existing_database(tmp_path) -> None:
    database_path = tmp_path / "existing.db"
    connection = connect(database_path)
    init_db(connection)
    connection.execute("DELETE FROM cards")
    connection.commit()
    connection.close()

    connection = connect(database_path)
    init_db(connection)
    card_count = connection.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
    assert card_count == 0
    connection.close()


def test_seed_db_is_deterministic(tmp_path) -> None:
    database_path = tmp_path / "seed.db"
    connection = connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE boards (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
          title TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE columns (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          position INTEGER NOT NULL
        );
        CREATE TABLE cards (
          id TEXT PRIMARY KEY,
          column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          details TEXT NOT NULL DEFAULT '',
          position INTEGER NOT NULL
        );
        """
    )
    seed_db(connection)
    connection.commit()

    board = get_board_for_user(connection, "user")
    assert len(board.columns) == 5
    assert board.columns[0].id == "col-backlog"
    assert board.columns[0].cardIds == ["card-1", "card-2"]
    assert board.cards["card-1"].title == "Define MVP scope"
    connection.close()
