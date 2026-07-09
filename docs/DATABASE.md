# TaskPilot Database Design

Normalized SQLite schema for the Kanban board. Part 5 design only — implementation lands in Part 6.

## Goals

- Store users, one board per user (MVP), columns, and cards in separate tables.
- Support rename column, add/update/delete card, and move/reorder cards without schema changes.
- Allow future multi-user expansion without redesign.
- **Do not** store AI chat history (session-only in the browser).

## File location and lifecycle

| Setting | Value |
|---------|--------|
| Default path (container) | `/app/data/taskpilot.db` |
| Host path (via volume) | `./data/taskpilot.db` |
| Env override | `DATABASE_PATH` (optional) |

**Create-if-missing behavior (Part 6):**

1. Ensure the parent directory exists (e.g. `/app/data`).
2. Open SQLite at `DATABASE_PATH` (creates the file if absent).
3. Run `CREATE TABLE IF NOT EXISTS` for all tables.
4. If the database is **new** (no rows in `users`), run the seed script below.
5. If the database already exists, never re-seed automatically.

## Docker persistence

Mount a host directory so data survives container restarts. Planned `docker-compose.yml` addition in Part 6:

```yaml
services:
  app:
    volumes:
      - ./data:/app/data
    environment:
      DATABASE_PATH: /app/data/taskpilot.db
```

Add `data/` to `.gitignore` (not the database file committed to the repo).

## Entity relationship

```
users 1 ── * boards 1 ── * columns 1 ── * cards
```

- MVP: exactly **one board per user** (enforced by `UNIQUE(user_id)` on `boards`).
- MVP: columns are created at seed time only (five fixed columns); users can rename them, not add/remove columns.
- Cards belong to one column; `position` defines order within that column.

## Tables

### `users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `username` | TEXT | NOT NULL, UNIQUE |
| `created_at` | TEXT | NOT NULL, ISO-8601 UTC |

### `boards`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `user_id` | INTEGER | NOT NULL, REFERENCES `users(id)`, UNIQUE |
| `title` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, ISO-8601 UTC |

### `columns`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `board_id` | TEXT | NOT NULL, REFERENCES `boards(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `position` | INTEGER | NOT NULL |

Index: `idx_columns_board_id` on `(board_id, position)`.

### `cards`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PRIMARY KEY |
| `column_id` | TEXT | NOT NULL, REFERENCES `columns(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL |
| `details` | TEXT | NOT NULL, default `''` |
| `position` | INTEGER | NOT NULL |

Index: `idx_cards_column_id` on `(column_id, position)`.

## DDL (reference)

```sql
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
```

## ID strategy

| Entity | Seed IDs | New records (after seed) |
|--------|----------|---------------------------|
| Board | `board-demo` | Server-generated text id (e.g. UUID) |
| Column | `col-backlog`, `col-discovery`, … | Not created in MVP (fixed columns) |
| Card | `card-1` … `card-8` | Server-generated, e.g. `card-{uuid}` |

Seed IDs match `frontend/src/lib/kanban.ts` `initialData` so Playwright tests (`card-card-1`, `column-col-review`, etc.) keep working after Part 7.

Frontend client-side `createId()` ids are **not** sent to the API in Part 7; the server assigns card ids on create.

## Mapping to frontend `BoardData`

Frontend shape (`frontend/src/lib/kanban.ts`):

```ts
type BoardData = {
  columns: { id: string; title: string; cardIds: string[] }[];
  cards: Record<string, { id: string; title: string; details: string }>;
};
```

**Assembly (backend read path):**

1. Resolve user by `X-User` username.
2. Load their board (404 if missing — should not happen after seed).
3. `SELECT * FROM columns WHERE board_id = ? ORDER BY position`.
4. `SELECT * FROM cards WHERE column_id IN (...) ORDER BY column_id, position`.
5. Build `columns[]` with `cardIds` ordered by `position`.
6. Build `cards` map keyed by card id.

**Writes:**

| UI action | DB effect |
|-----------|-----------|
| Rename column | `UPDATE columns SET title = ? WHERE id = ?` |
| Add card | `INSERT INTO cards`, assign next `position` in column |
| Edit card | `UPDATE cards SET title/details WHERE id = ?` |
| Delete card | `DELETE FROM cards WHERE id = ?`, compact positions in column |
| Move card | Update `column_id` and `position`; reorder siblings in source and target columns |

Position is **0-based** within each column, contiguous after every mutation.

## Seed data

Runs only on a **new** database. Matches `initialData` exactly.

### User and board

| users.username | boards.id | boards.title |
|----------------|-------------|--------------|
| `user` | `board-demo` | `TaskPilot` |

### Columns (position order)

| id | title | position |
|----|-------|----------|
| `col-backlog` | Backlog | 0 |
| `col-discovery` | Discovery | 1 |
| `col-progress` | In Progress | 2 |
| `col-review` | Review | 3 |
| `col-done` | Done | 4 |

### Cards

| id | column_id | position | title | details |
|----|-----------|----------|-------|---------|
| `card-1` | `col-backlog` | 0 | Define MVP scope | List core features, out-of-scope items, and success criteria for v1. |
| `card-2` | `col-backlog` | 1 | Set up CI pipeline | Configure lint, unit tests, and build checks on every pull request. |
| `card-3` | `col-discovery` | 0 | Design API contracts | Draft REST endpoints for boards, columns, and cards with request/response shapes. |
| `card-4` | `col-progress` | 0 | Implement drag-and-drop | Wire up card movement between columns with optimistic UI updates. |
| `card-5` | `col-progress` | 1 | Add card edit form | Allow inline editing of card title and details from the board view. |
| `card-6` | `col-review` | 0 | Write E2E test suite | Cover add, move, rename, and delete flows with Playwright. |
| `card-7` | `col-done` | 0 | Ship landing page | Publish product overview, screenshots, and getting-started guide. |
| `card-8` | `col-done` | 1 | Document release process | Write changelog template and deployment checklist for the team. |

## Out of scope (by design)

- AI chat messages and conversation history (in-memory in the browser only).
- Multiple boards per user (MVP).
- Adding or removing columns (MVP).
- Real password hashing (MVP uses frontend fake login; `users` table is identity only).

## Operations supported without redesign

- Rename, move, add, delete, edit cards
- Rename columns
- Multiple users (data model ready; auth stays simple until post-MVP)
- Part 9 AI granular operations (create/move/edit/delete via same tables)
