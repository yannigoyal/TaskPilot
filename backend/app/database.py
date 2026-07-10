import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.schemas import BoardData, Card, Column

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id, position);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id, position);
"""

SEED_COLUMNS = [
    {"id": "col-backlog", "title": "Backlog", "position": 0},
    {"id": "col-discovery", "title": "Discovery", "position": 1},
    {"id": "col-progress", "title": "In Progress", "position": 2},
    {"id": "col-review", "title": "Review", "position": 3},
    {"id": "col-done", "title": "Done", "position": 4},
]

SEED_CARDS = [
    {
        "id": "card-1",
        "column_id": "col-backlog",
        "position": 0,
        "title": "Define MVP scope",
        "details": "List core features, out-of-scope items, and success criteria for v1.",
    },
    {
        "id": "card-2",
        "column_id": "col-backlog",
        "position": 1,
        "title": "Set up CI pipeline",
        "details": "Configure lint, unit tests, and build checks on every pull request.",
    },
    {
        "id": "card-3",
        "column_id": "col-discovery",
        "position": 0,
        "title": "Design API contracts",
        "details": "Draft REST endpoints for boards, columns, and cards with request/response shapes.",
    },
    {
        "id": "card-4",
        "column_id": "col-progress",
        "position": 0,
        "title": "Implement drag-and-drop",
        "details": "Wire up card movement between columns with optimistic UI updates.",
    },
    {
        "id": "card-5",
        "column_id": "col-progress",
        "position": 1,
        "title": "Add card edit form",
        "details": "Allow inline editing of card title and details from the board view.",
    },
    {
        "id": "card-6",
        "column_id": "col-review",
        "position": 0,
        "title": "Write E2E test suite",
        "details": "Cover add, move, rename, and delete flows with Playwright.",
    },
    {
        "id": "card-7",
        "column_id": "col-done",
        "position": 0,
        "title": "Ship landing page",
        "details": "Publish product overview, screenshots, and getting-started guide.",
    },
    {
        "id": "card-8",
        "column_id": "col-done",
        "position": 1,
        "title": "Document release process",
        "details": "Write changelog template and deployment checklist for the team.",
    },
]


class BoardError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(BoardError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message, status_code=404)


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA_SQL)
    user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if user_count == 0:
        seed_db(connection)
    connection.commit()


def seed_db(connection: sqlite3.Connection) -> None:
    now = utc_now()
    connection.execute(
        "INSERT INTO users (username, created_at) VALUES (?, ?)",
        ("user", now),
    )
    user_id = connection.execute("SELECT last_insert_rowid()").fetchone()[0]
    connection.execute(
        "INSERT INTO boards (id, user_id, title, created_at) VALUES (?, ?, ?, ?)",
        ("board-demo", user_id, "TaskPilot", now),
    )
    for column in SEED_COLUMNS:
        connection.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (column["id"], "board-demo", column["title"], column["position"]),
        )
    for card in SEED_CARDS:
        connection.execute(
            "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
            (
                card["id"],
                card["column_id"],
                card["title"],
                card["details"],
                card["position"],
            ),
        )


def get_user_id(connection: sqlite3.Connection, username: str) -> int | None:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return None if row is None else int(row["id"])


def get_board_id_for_user(connection: sqlite3.Connection, user_id: int) -> str | None:
    row = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return None if row is None else str(row["id"])


def load_board(connection: sqlite3.Connection, board_id: str) -> BoardData:
    column_rows = connection.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()
    column_ids = [str(row["id"]) for row in column_rows]
    cards_by_column: dict[str, list[str]] = {column_id: [] for column_id in column_ids}
    cards: dict[str, Card] = {}

    if column_ids:
        placeholders = ",".join("?" for _ in column_ids)
        card_rows = connection.execute(
            f"""
            SELECT id, column_id, title, details
            FROM cards
            WHERE column_id IN ({placeholders})
            ORDER BY column_id, position
            """,
            column_ids,
        ).fetchall()
        for row in card_rows:
            card_id = str(row["id"])
            column_id = str(row["column_id"])
            cards_by_column[column_id].append(card_id)
            cards[card_id] = Card(
                id=card_id,
                title=str(row["title"]),
                details=str(row["details"]),
            )

    columns = [
        Column(id=str(row["id"]), title=str(row["title"]), cardIds=cards_by_column[str(row["id"])])
        for row in column_rows
    ]
    return BoardData(columns=columns, cards=cards)


def get_board_for_user(connection: sqlite3.Connection, username: str) -> BoardData:
    user_id = get_user_id(connection, username)
    if user_id is None:
        raise NotFoundError("Unknown user")
    board_id = get_board_id_for_user(connection, user_id)
    if board_id is None:
        raise NotFoundError("Board not found")
    return load_board(connection, board_id)


def _require_board_id(connection: sqlite3.Connection, username: str) -> str:
    user_id = get_user_id(connection, username)
    if user_id is None:
        raise NotFoundError("Unknown user")
    board_id = get_board_id_for_user(connection, user_id)
    if board_id is None:
        raise NotFoundError("Board not found")
    return board_id


def _require_column_on_board(
    connection: sqlite3.Connection, column_id: str, board_id: str
) -> None:
    row = connection.execute(
        "SELECT id FROM columns WHERE id = ? AND board_id = ?",
        (column_id, board_id),
    ).fetchone()
    if row is None:
        raise NotFoundError()


def _require_card_on_board(
    connection: sqlite3.Connection, card_id: str, board_id: str
) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT cards.id, cards.column_id, cards.position
        FROM cards
        JOIN columns ON columns.id = cards.column_id
        WHERE cards.id = ? AND columns.board_id = ?
        """,
        (card_id, board_id),
    ).fetchone()
    if row is None:
        raise NotFoundError()
    return row


def _compact_column(connection: sqlite3.Connection, column_id: str) -> None:
    rows = connection.execute(
        "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
        (column_id,),
    ).fetchall()
    for index, row in enumerate(rows):
        connection.execute(
            "UPDATE cards SET position = ? WHERE id = ?",
            (index, row["id"]),
        )


def rename_column(
    connection: sqlite3.Connection,
    username: str,
    column_id: str,
    title: str,
    *,
    commit: bool = True,
) -> BoardData:
    board_id = _require_board_id(connection, username)
    _require_column_on_board(connection, column_id, board_id)
    connection.execute(
        "UPDATE columns SET title = ? WHERE id = ?",
        (title, column_id),
    )
    if commit:
        connection.commit()
    return load_board(connection, board_id)


def create_card(
    connection: sqlite3.Connection,
    username: str,
    column_id: str,
    title: str,
    details: str,
    position: int | None,
    *,
    commit: bool = True,
) -> BoardData:
    board_id = _require_board_id(connection, username)
    _require_column_on_board(connection, column_id, board_id)

    max_position = connection.execute(
        "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
        (column_id,),
    ).fetchone()[0]
    insert_position = max_position + 1 if position is None else position
    if insert_position < 0:
        raise BoardError("position must be non-negative")
    if insert_position > max_position + 1:
        insert_position = max_position + 1

    connection.execute(
        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?",
        (column_id, insert_position),
    )
    card_id = f"card-{uuid4().hex[:12]}"
    connection.execute(
        "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
        (card_id, column_id, title, details, insert_position),
    )
    if commit:
        connection.commit()
    return load_board(connection, board_id)


def update_card(
    connection: sqlite3.Connection,
    username: str,
    card_id: str,
    title: str | None,
    details: str | None,
    *,
    commit: bool = True,
) -> BoardData:
    board_id = _require_board_id(connection, username)
    _require_card_on_board(connection, card_id, board_id)

    if title is not None:
        connection.execute("UPDATE cards SET title = ? WHERE id = ?", (title, card_id))
    if details is not None:
        connection.execute(
            "UPDATE cards SET details = ? WHERE id = ?",
            (details, card_id),
        )
    if commit:
        connection.commit()
    return load_board(connection, board_id)


def delete_card(
    connection: sqlite3.Connection,
    username: str,
    card_id: str,
    *,
    commit: bool = True,
) -> BoardData:
    board_id = _require_board_id(connection, username)
    card = _require_card_on_board(connection, card_id, board_id)
    column_id = str(card["column_id"])
    connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    _compact_column(connection, column_id)
    if commit:
        connection.commit()
    return load_board(connection, board_id)


def move_card(
    connection: sqlite3.Connection,
    username: str,
    card_id: str,
    target_column_id: str,
    target_position: int,
    *,
    commit: bool = True,
) -> BoardData:
    board_id = _require_board_id(connection, username)
    card = _require_card_on_board(connection, card_id, board_id)
    _require_column_on_board(connection, target_column_id, board_id)

    source_column_id = str(card["column_id"])
    source_position = int(card["position"])

    if source_column_id == target_column_id:
        card_ids = [
            str(row["id"])
            for row in connection.execute(
                "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
                (source_column_id,),
            ).fetchall()
        ]
        card_ids.remove(card_id)
        target_position = min(max(target_position, 0), len(card_ids))
        card_ids.insert(target_position, card_id)
        for index, current_id in enumerate(card_ids):
            connection.execute(
                "UPDATE cards SET position = ? WHERE id = ?",
                (index, current_id),
            )
    else:
        connection.execute(
            """
            UPDATE cards
            SET position = position - 1
            WHERE column_id = ? AND position > ?
            """,
            (source_column_id, source_position),
        )
        connection.execute(
            """
            UPDATE cards
            SET position = position + 1
            WHERE column_id = ? AND position >= ?
            """,
            (target_column_id, target_position),
        )
        connection.execute(
            "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
            (target_column_id, target_position, card_id),
        )

    if commit:
        connection.commit()
    return load_board(connection, board_id)
