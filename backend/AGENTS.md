# TaskPilot Backend

FastAPI backend for TaskPilot. Serves the static Next.js export at `/`, health at `/api/health`, and Kanban CRUD at `/api/*`.

## Layout

```
backend/
  app/
    main.py          FastAPI app, lifespan, static serving
    config.py        DATABASE_PATH resolution
    database.py      SQLite schema, seed, board persistence
    schemas.py       Pydantic request/response models
    deps.py          X-User auth dependency
    routes/
      board.py       Kanban API routes
  tests/
    conftest.py      Temp SQLite DB per test
    test_health.py
    test_database.py
    test_board_api.py
  data/              Local SQLite file (gitignored) when not using Docker
  pyproject.toml
```

## Database

- Path: `DATABASE_PATH` env var, default `backend/data/taskpilot.db` locally, `/app/data/taskpilot.db` in Docker.
- Schema and seed: see `docs/DATABASE.md`.
- On startup: create tables if missing; seed only when `users` is empty.

## API

See `docs/API.md`. All board routes require `X-User: user` (demo MVP).

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/health` | Health check |
| GET | `/api/board` | Load full board |
| PATCH | `/api/columns/{id}` | Rename column |
| POST | `/api/cards` | Create card |
| PATCH | `/api/cards/{id}` | Update card |
| DELETE | `/api/cards/{id}` | Delete card |
| POST | `/api/cards/{id}/move` | Move/reorder card |

## Run locally (without Docker)

Build frontend static export into `backend/static/` for the UI, then:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
cd backend
uv sync --group dev
uv run pytest -v
```

Uses an isolated temp database per test via `DATABASE_PATH`.

## Docker

From repo root:

```bash
./scripts/start
./scripts/stop
```

SQLite persists in `./data/taskpilot.db` via the Compose volume.

Example:

```bash
curl -H "X-User: user" http://localhost:8000/api/board
```
