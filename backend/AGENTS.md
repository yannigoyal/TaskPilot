# TaskPilot Backend

FastAPI backend for TaskPilot. Serves the static Next.js export at `/`, health at `/api/health`, Kanban CRUD at `/api/*`, OpenRouter ping at `/api/ai/ping`, and Kanban-aware chat at `/api/chat`.

## Layout

```
backend/
  app/
    main.py          FastAPI app, lifespan, static serving
    config.py        DATABASE_PATH, OpenRouter settings
    database.py      SQLite schema, seed, board persistence
    openrouter.py    OpenRouter chat completions client (httpx)
    chat.py          Parse / validate / apply AI board operations
    ai_schemas.py    Chat + operation Pydantic models
    schemas.py       Board Pydantic models
    deps.py          X-User auth dependency
    routes/
      board.py       Kanban API routes
      ai.py          AI ping route
      chat.py        POST /api/chat
  tests/
    conftest.py
    test_health.py
    test_database.py
    test_board_api.py
    test_openrouter.py
    test_ai_ping.py
    test_ai_parse.py
    test_ai_validate.py
    test_chat_api.py
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
- AI chat history is **not** stored in SQLite.

## API

See `docs/API.md` and `docs/AI.md`. Board routes and chat require `X-User: user`. AI ping does not.

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
| POST | `/api/chat` | Kanban-aware AI; optional granular ops; see `docs/AI.md` |

All board mutations return the full `BoardData` JSON. Chat returns `{ message, board? }`.

Model: `openai/gpt-oss-120b` via OpenRouter (`httpx`). AI board ops are validated then applied all-or-nothing.

## Run locally (without Docker)

Dev with hot reload (frontend on :3000 proxies `/api` to backend):

```bash
# Terminal 1 — backend (export key from repo-root .env)
set -a && source ../.env && set +a   # from backend/, or export OPENROUTER_API_KEY=...
cd backend && uv sync && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

## Tests

```bash
cd backend
uv sync --group dev
uv run pytest -v                 # default suite (skips @pytest.mark.live)
uv run pytest -m live -v -o addopts=   # real OpenRouter call (needs .env key)
```

## Docker

From repo root:

```bash
./scripts/start
./scripts/stop
```

SQLite persists in Docker named volume `taskpilot_data`. Compose loads repo-root `.env` for `OPENROUTER_API_KEY`.

Example:

```bash
curl -H "X-User: user" http://localhost:8000/api/board
curl -X POST http://localhost:8000/api/ai/ping
curl -X POST -H "X-User: user" -H "Content-Type: application/json" \
  -d '{"message":"What is on my board?","history":[]}' \
  http://localhost:8000/api/chat
```

## Not yet implemented

- AI chat sidebar UI (Part 10)
