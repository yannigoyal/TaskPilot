# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It contains project‑specific commands, architecture overview, and other essential context needed for productive development.

---

## 1. Core Commands

| Purpose | Command | Description |
|---------|---------|-------------|
| **Run the full stack locally** | `./scripts/start` | Spins up Docker Compose with FastAPI backend and Next.js frontend. UI available at http://localhost:8000. |
| **Stop the stack** | `./scripts/stop` | Gracefully stops all containers. |
| **Run backend unit tests** | `cd backend && uv run pytest` | Executes the Python test suite (skips live OpenRouter calls unless `OPENROUTER_API_KEY` is set). |
| **Run backend live‑test** | `cd backend && uv run pytest -m live -v -o addopts=` | Executes live integration tests that call OpenRouter; requires a valid API key in `.env`. |
| **Run frontend dev server** | `cd frontend && npm run dev` | Starts Next.js dev server with hot reload on http://localhost:3000 (proxies `/api` → backend:8000). |
| **Run frontend unit tests** | `cd frontend && npm run test:unit` | Executes Vitest unit tests. |
| **Run frontend E2E tests (dev)** | `cd frontend && npm run test:e2e` | Executes Playwright tests against the dev server. |
| **Run frontend E2E tests (Docker)** | `cd frontend && npm run test:e2e:docker` | Executes Playwright tests against the Docker‑served stack on the same origin as production. |
| **Build frontend for production** | `cd frontend && npm run build` | Generates static export in `frontend/out/`. |
| **Run a single backend test** | `uv run pytest -k <test_name>` | Run an individual test identified by its name. |
| **Check DB schema** | `cd backend && python - <<'PY'\nfrom app.database import Base, engine\nfrom sqlalchemy import inspect\nprint([f"{c['type']}: {c['name']}" for c in inspect(engine).get_table_names()])\nPY` | Prints available tables; useful for debugging migrations. |

> **Tip:** All commands above assume you are in the repository root unless noted otherwise.

---

## 2. Project Architecture Overview

### 2.1 High‑Level Stack
- **Frontend:** Next.js (App Router) statically exported to `out/`. Served by FastAPI at `/` (SPA fallback for client‑side routing).  
- **Backend:** FastAPI (Python 3.12+). Provides:
  - API routes under `/api/*` (Kanban CRUD, AI chat, health).
  - Static serving of the exported frontend.
  - SQLite DB (file‑based, persisted via Docker named volume `taskpilot_data`).  
- **AI Integration:** OpenRouter client using `openai/gpt-oss-120b` (access via `httpx`). No direct SDK; pure HTTP calls.  
- **Auth (MVP):** Fake login (`user` / `password`). Successful login stores `X-User: user` header for API calls.  
- **Persistence:** All Kanban state lives in SQLite; AI chat history lives only in React state (session‑only).  

### 2.2 Directory Layout

```
backend/
├─ app/
│  ├─ main.py          # FastAPI app, lifespan, static mounting
│  ├─ config.py        # Settings (DATABASE_PATH, etc.)
│  ├─ database.py      # SQLite schema & seed logic
│  ├─ openrouter.py    # HTTP client for OpenRouter
│  ├─ chat.py          # Parsing / validation of AI ops
│  └─ routes/
│     ├─ board.py      # Kanban CRUD
│     ├─ ai.py         # AI ping endpoint
│     └─ chat.py       # POST /api/chat
├─ tests/
├─ data/                # Local SQLite when not using Docker
├─ pyproject.toml
frontend/
├─ src/
│  ├─ app/layout.tsx   # Root layout, globals.css import
│  ├─ app/page.tsx     # LoginGate entry point
│  ├─ components/
│  │  ├─ ChatSidebar.tsx
│  │  └─ KanbanBoard.tsx
│  ├─ lib/
│  │  ├─ api.ts        # API client wrappers
│  │  ├─ auth.ts       # Login / logout helpers
│  │  └─ kanban.ts     # Types (BoardData, Column, Card, etc.)
│  └─ tests/
├─ .next/                # Build output (static export)
├─ package.json
├─ tsconfig.json
└─ ... (tailwind, eslint, etc.)
scripts/
├─ start                # Docker compose wrapper
└─ stop
docs/
├─ API.md               # REST contract, request/response shapes
├─ AI.md                # AI ops schema, prompt structure
├─ DATABASE.md          # SQLite schema, seed data description
└─ PLAN.md              # Incremental part roadmap
```

### 2.3 Data Flow
1. **Login:** Frontend validates credentials (`user`/`password`). On success, it stores the username in `sessionStorage` and attaches `X-User: user` to all subsequent fetch calls.
2. **Board Load:** After login, `KanbanBoard` fetches `/api/board`. The backend returns the full `BoardData` (columns + card map) derived from SQLite.
3. **Mutations (CRUD, moves, rename):** UI calls `/api/*` endpoints, receives updated `BoardData`, and resolves local state.
4. **AI Chat:** Sidebar sends `{message, history}` to `/api/chat`. The backend:
   - Loads current board.
   - Calls OpenRouter with a structured prompt.
   - Validates any `operations` field.
   - Applies operations transactionally to SQLite.
   - Returns `{message, board?}` where `board` is the updated board JSON.
5. **Static Serving:** FastAPI mounts `StaticFiles` for `frontend/out/`. Non‑API paths fall back to `index.html` to enable client‑side routing.

---

## 3. Key Design Decisions & Constraints

| Decision | Rationale |
|----------|-----------|
| **SQLite + named volume** for persistence | Ensures data survives container restarts while avoiding host‑file‑share issues on external drives. |
| **Fake simple auth** (`X-User`) | Keeps authentication logic lightweight for MVP; future multi‑user support can be added later. |
| **Stateless AI chat history** | Chat history lives only in React session state → no DB churn, easier rollback on errors. |
| **Granular operation validation** | All AI‑driven modifications are validated against current board and applied atomically; unknown IDs cause a full request failure. |
| **Static export (`output: 'export'`)** | Generates a fully static bundle that can be served from any server; avoids server‑side rendering complexities. |
| **Clear separation of concerns** | Backend handles data/persistence; frontend handles UI and session state only. |
| **Color & design token usage** | Colors defined in CSS variables (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, etc.) for consistent theming. |
| **`data-testid` conventions** | Used throughout UI for reliable Playwright selectors; documented in `frontend/AGENTS.md`. |
| **Docker workflow** | All dev and prod runs are orchestrated via `scripts/start` / `scripts/stop`; ensures reproducibility across platforms. |

---

## 4. Must‑Read Documentation

- `docs/API.md` – Complete REST API contract (endpoints, request/response shapes, error codes).  
- `docs/DATABASE.md` – SQLite schema, seed data description, volume strategy.  
- `docs/AI.md` – Prompt structure, operation types, validation rules.  
- `frontend/AGENTS.md` – Frontend architecture, component tree, drag‑and‑drop implementation details.  
- `backend/AGENTS.md` – Backend module layout, run commands, test strategy.  
- `docs/PLAN.md` – Roadmap and part‑by‑part checklist (useful for understanding current MVP status).  

All of the above files are version‑controlled and should be consulted before making changes to related components.

---

## 5. Conventions & Quality Standards

1. **Color Usage** – Stick to the defined CSS variable names; do not introduce new hex values unless intentionally documented.  
2. **No Emojis** – Neither in code comments nor UI copy.  
3. **Simplicity First** – Avoid over‑engineering; prefer the most straightforward implementation that satisfies the requirement.  
4. **Root‑Cause Debugging** – When encountering failures, locate the root cause before applying patches. Document the evidence (e.g., `curl` response, test output).  
5. **Headers & Auth** – Every API call that requires a signed‑in user must include the `X-User` header generated by `auth.ts`.  
6. **Testing Coverage** – New code should aim for ≥80 % unit test coverage; integration/E2E tests must stay green.  

---

## 6. Quick Reference Cheat‑Sheet

```bash
# Start everything
./scripts/start

# Stop everything
./scripts/stop

# Backend tests (unit)
cd backend && uv run pytest

# Backend live test (requires key)
cd backend && uv run pytest -m live -v -o addopts=

# Frontend dev server
cd frontend && npm run dev

# Frontend unit tests
cd frontend && npm run test:unit

# Frontend E2E (dev)
cd frontend && npm run test:e2e

# Frontend E2E (Docker)
cd frontend && npm run test:e2e:docker

# Build static export
cd frontend && npm run build
```

--- 

**End of CLAUDE.md**