# TaskPilot Backend

FastAPI backend for TaskPilot. Serves the static Next.js export at `/` and API routes under `/api/*`.

## Layout

```
backend/
  app/
    main.py       FastAPI app — /api/health, SPA static serving
  static/         Populated at Docker build from frontend/out/ (not committed)
  tests/
    test_health.py
  pyproject.toml  uv-managed dependencies
```

`SPAStaticFiles` serves `static/` at `/` with fallback to `index.html` for unknown non-API paths. API routes are registered before the static mount.

## Run locally (without Docker)

Build the frontend export into `backend/static/` first:

```bash
cd frontend && npm run build
cp -r out ../backend/static
```

Then from `backend/`:

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000

## Tests

From `backend/`:

```bash
uv sync --group dev
uv run pytest
```

`test_index_returns_kanban_html` is skipped unless `backend/static/index.html` exists.

## Docker

From repo root:

```bash
./scripts/start
./scripts/stop
```

The Dockerfile builds the frontend in a Node stage and copies `out/` to `backend/static/`.

API: `GET /api/health` returns `{"status":"ok"}`.
