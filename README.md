# TaskPilot

TaskPilot is an educational project management application built around a single Kanban board. The goal is a full-stack app with sign-in, persistent boards, and an AI assistant — developed incrementally in phases.

## Current Status

- **Docker stack:** FastAPI serves the static Kanban UI at `/` and `GET /api/health` at `/api/health`.
- **Frontend dev:** Next.js Kanban demo also runs standalone with `npm run dev` on port 3000.

Board state is in-memory only (reload resets to seed data).

## Run the stack (Docker)

Prerequisites: Docker and Docker Compose. Run from the **repo root** (not `frontend/`):

```bash
./scripts/start
```

Open [http://localhost:8000](http://localhost:8000). Sign in with `user` / `password` to open the Kanban board.

```bash
./scripts/stop
```

Verify API:

```bash
curl http://localhost:8000/api/health
```

## Frontend-only development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Backend (from `backend/`):

```bash
uv sync --group dev
uv run pytest
```

Frontend (from `frontend/`):

```bash
npm run test:unit
npm run test:e2e              # vs dev server (:3000)
npm run test:e2e:docker       # vs Docker (:8000) — start stack from repo root first
```

## Project Structure

```
├── AGENTS.md
├── docs/PLAN.md
├── Dockerfile
├── docker-compose.yml
├── backend/           # FastAPI app
├── frontend/          # Next.js Kanban (static export)
└── scripts/           # start / stop (repo root)
```

Roadmap: [docs/PLAN.md](docs/PLAN.md)
