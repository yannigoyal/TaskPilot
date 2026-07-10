# TaskPilot Backend

FastAPI backend for TaskPilot. Serves the static Next.js export at `/`, health at `/api/health`, Kanban CRUD at `/api/*`, and OpenRouter AI ping at `/api/ai/ping`.

## Layout

```
backend/
  app/
    main.py          FastAPI app, lifespan, static serving
    config.py        DATABASE_PATH, OpenRouter settings
    database.py      SQLite schema, seed, board persistence
    openrouter.py    OpenRouter chat completions client (httpx)
    schemas.py       Pydantic request/response models
    deps.py          X-User auth dependency
    routes/
      board.py       Kanban API routes
      ai.py          AI ping route
  tests/
    conftest.py      Temp SQLite DB per test
    test_health.py
    test_database.py
    test_board_api.py
    test_openrouter.py
    test_ai_ping.py
  data/              Local SQLite file (gitignored) when not using Docker
  pyproject.toml
```

## Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_PATH` | No | Default `backend/data/taskpilot.db` locally; `/app/data/taskpilot.db` in Docker |
| `OPENROUTER_API_KEY` | For AI | Set in repo-root `.env` (gitignored). See `.env.example`. Docker Compose loads `.env` via `env_file`. |

Never commit secrets. The API key must not be exposed to the frontend.

## Database

- Path: `DATABASE_PATH` env var, default `backend/data/taskpilot.db` locally, `/app/data/taskpilot.db` in Docker.
- Schema and seed: see `docs/DATABASE.md`.
- On startup: create tables if missing; seed only when `users` is empty.
- Seed matches `frontend/src/lib/kanban.ts` `initialData` (five columns, eight cards, demo user `user`).

## API

See `docs/API.md`. Board routes require `X-User: user` (demo MVP). AI ping does not.

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/health` | Health check |
| GET | `/api/board` | Load full board |
| PATCH | `/api/columns/{id}` | Rename column |
| POST | `/api/cards` | Create card |
| PATCH | `/api/cards/{id}` | Update card |
| DELETE | `/api/cards/{id}` | Delete card |
| POST | `/api/cards/{id}/move` | Move/reorder card |
| POST | `/api/ai/ping` | OpenRouter connectivity check (no auth); 503 if key missing |

All board mutations return the full `BoardData` JSON.

Model: `openai/gpt-oss-120b` via OpenRouter (`httpx`).

## Run locally (without Docker)

Dev with hot reload (frontend on :3000 proxies `/api` to backend):

```bash
# Terminal 1 — backend (export key from repo-root .env)
set -a && source ../.env && set +a   # from backend/, or export OPENROUTER_API_KEY=...
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
uv run pytest -v                 # default suite (skips @pytest.mark.live)
uv run pytest -m live -v         # real OpenRouter call (needs .env key)
```

Uses an isolated temp database per test via `DATABASE_PATH`.

## Docker

From repo root:

```bash
./scripts/start
./scripts/stop
```

SQLite persists in Docker named volume `taskpilot_data` (see `docker-compose.yml`). Reset data: `docker compose down -v`. Compose loads repo-root `.env` for `OPENROUTER_API_KEY`.

Optional bind mount for a host-visible DB file:

```yaml
volumes:
  - ./data:/app/data
```

Use bind mount only when Docker Desktop has file-sharing enabled for the project path.

Example API calls:

```bash
curl -H "X-User: user" http://localhost:8000/api/board
curl -X POST http://localhost:8000/api/ai/ping
```

## Not yet implemented

- `POST /api/chat` with board operations (Parts 9–10)
