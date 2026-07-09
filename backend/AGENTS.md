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
- Seed matches `frontend/src/lib/kanban.ts` `initialData` (five columns, eight cards, demo user `user`).

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

All mutations return the full `BoardData` JSON.

## Run locally (without Docker)

Dev with hot reload (frontend on :3000 proxies `/api` to backend):

```bash
# Terminal 1 — backend
cd backend && uv sync && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Full stack without Next dev server (requires built static files in `backend/static/`):

```bash
cd frontend && npm run build
# copy or symlink frontend/out to backend/static, then:
cd backend && uv run uvicorn app.main:app --port 8000
```

## Tests

```bash
cd backend
uv sync --group dev
uv run pytest -v
```

Uses an isolated temp database per test via `DATABASE_PATH`. Currently 23 tests.

## Docker

From repo root:

```bash
./scripts/start
./scripts/stop
```

SQLite persists in Docker named volume `taskpilot_data` (see `docker-compose.yml`). Reset data: `docker compose down -v`.

Optional bind mount for a host-visible DB file:

```yaml
volumes:
  - ./data:/app/data
```

Use bind mount only when Docker Desktop has file-sharing enabled for the project path.

Example API call:

```bash
curl -H "X-User: user" http://localhost:8000/api/board
```

## Not yet implemented

- OpenRouter client (Part 8)
- `POST /api/chat` with board operations (Parts 9–10)
