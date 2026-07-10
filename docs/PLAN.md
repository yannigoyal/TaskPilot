# TaskPilot Implementation Plan

Incremental build plan for TaskPilot. Complete parts in order. After each part: run that part's tests, confirm success criteria, commit, and get user approval before starting the next part.

## Locked decisions


| Topic                  | Decision                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Card editing**       | Required for MVP; implement during Part 7 (frontend + backend integration).                                                                                                            |
| **Database**           | Normalized SQLite tables for `users`, `boards`, `columns`, and `cards` (not a single JSON blob).                                                                                       |
| **Auth (Part 4)**      | Frontend-only fake login (`user` / `password`). No backend session yet.                                                                                                                |
| **Auth (Parts 6–7)**   | After login, frontend sends a simple trusted-local identity header (e.g. `X-User: user`) on API calls; backend maps it to the seeded demo user. Not real security — local MVP only.    |
| **Frontend serving**   | Next.js static export (`output: 'export'`); FastAPI serves built files at `/`.                                                                                                         |
| **API prefix**         | All backend routes under `/api/...` so they do not clash with static paths.                                                                                                            |
| **AI chat history**    | In-memory for the current browser session only; not persisted in SQLite.                                                                                                               |
| **AI board updates**   | Granular operations (create / edit / move / delete cards, rename column) — not full-board snapshot replace.                                                                            |
| **Testing**            | ~80% unit coverage minimum where unit tests exist; robust integration tests; keep Playwright green.                                                                                    |
| **E2E strategy**       | Day-to-day: Playwright against `npm run dev` (port 3000). Part sign-off: also run Playwright (or integration checks) against the Docker-served stack on the same origin as production. |
| **Scripts**            | Docker Compose wrappers only in `scripts/` (`start` / `stop` calling `docker compose`). No separate Mac/PC/Linux native scripts.                                                       |
| **Secrets**            | Never commit secrets. Add `.env.example` with `OPENROUTER_API_KEY` when AI work begins (Part 8).                                                                                       |
| **Docker build**       | Multi-stage image: Node stage builds frontend static export; Python stage runs FastAPI + serves `out/`.                                                                                |
| **SQLite persistence** | DB file on a Docker **named volume** (`taskpilot_data`) so data survives container restarts; path in `docs/DATABASE.md`. Bind mount `./data:/app/data` is optional for host-visible DB files. |
| **Board API responses** | All Kanban mutations return the full `BoardData` JSON (see `docs/API.md`); frontend replaces local state from the response. |
| **Drag and drop** | Multi-column `@dnd-kit` setup: `pointerWithin` collision detection, `onDragOver` for cross-column moves, snapshot at drag start for API persistence. See `frontend/AGENTS.md`. |
| **AI HTTP client (Part 8)** | Use `httpx` for OpenRouter calls (no OpenAI SDK). |
| **AI ping auth (Part 8)** | `POST /api/ai/ping` requires no `X-User` — connectivity check only. |
| **Missing OpenRouter key** | Return **503** when `OPENROUTER_API_KEY` is missing/empty (service unavailable). |
| **Part 8 live verification** | Sign-off includes a real OpenRouter call (not mocked-only); confirm a model reply. |
| **Part 7 approval** | Part 7 approved; proceed to Part 8. |


## Architecture overview

```
Browser
  |
  v
FastAPI (single container)
  |-- GET  /              --> static Next.js export (Kanban UI)
  |-- GET  /api/health    --> health check
  |-- *    /api/board/*   --> Kanban CRUD (Parts 6–7)
  |-- POST /api/chat      --> AI chat (Parts 9–10)
  |
  v
SQLite (volume-mounted file)
```

Static serving notes (Parts 3+):

- Mount API routes before the static catch-all.
- Serve `index.html` (or equivalent) for unknown non-API paths so client-side routing works on refresh.
- Next export outputs to `frontend/out/`; copy into the backend image at build time.

## Current project state (after Part 8)

The MVP Kanban is fully wired end-to-end (Parts 1–7), and OpenRouter connectivity is proven (Part 8):

- **Auth:** Frontend fake login (`user` / `password`); `X-User` header on all API calls.
- **Persistence:** SQLite via normalized schema (`docs/DATABASE.md`); Docker named volume `taskpilot_data`.
- **API:** Full board CRUD under `/api/*` (`docs/API.md`); OpenRouter ping at `POST /api/ai/ping` (no auth; 503 if key missing).
- **AI:** `httpx` client → `openai/gpt-oss-120b` via OpenRouter; live call verified (`{"reply":"4"}`).
- **Frontend:** Loads board from API after login; rename, add, edit, delete, drag-and-drop all persist.
- **Tests:** Backend pytest includes mocked AI tests + `@pytest.mark.live` for real OpenRouter.

**Not yet implemented:** Kanban-aware chat + sidebar UI (Parts 9–10).

**Key docs for agents:**

| Document | Purpose |
| -------- | ------- |
| `docs/DATABASE.md` | SQLite schema, seed data, DB path |
| `docs/API.md` | REST contract, `BoardData` shape, errors |
| `frontend/AGENTS.md` | UI architecture, API client, DnD, tests |
| `backend/AGENTS.md` | Backend layout, run/test commands |

## Test standards (all parts)

- Prefer proving behavior with evidence (commands, HTTP responses, test output), not inspection alone.
- Unit coverage target: approximately **80%** for new backend/frontend logic under test.
- Integration tests for API and Docker-served flows where a part introduces them.
- Playwright E2E: keep existing Kanban flows passing; extend when sign-in, persistence, edit, or AI UI land.
- Do not guess at failures; identify root cause, then fix.
- Before marking a part done: run the part's **dev** test suite; for Parts 3+, also verify the **Docker-served** path where the plan lists it.

---

## Part 1: Plan

Enrich this document and document the existing frontend for agents. No application features.

### Checklist

- Review root `AGENTS.md`, this plan, and the current codebase
- Record locked product/architecture decisions in this document (including user choices: Compose scripts, dual E2E, `X-User` header, AI operations)
- Expand all 10 parts with detailed substeps, tests, and success criteria
- Create `frontend/AGENTS.md` describing the existing frontend architecture
- User reviews and approves this plan before Part 2

### Tests

- Manual review: each part has actionable checklist, tests, and success criteria
- Manual review: `frontend/AGENTS.md` matches the repo (App Router, components, in-memory board, test commands, `data-testid` conventions)
- Manual review: locked decisions are consistent with root `AGENTS.md` (note: root `AGENTS.md` still mentions platform-specific scripts — align in Part 2)

### Success criteria

- Each part has a detailed checklist, tests, and success criteria.
- Architecture decisions above are explicit and traceable to user approval.
- `frontend/AGENTS.md` exists, is accurate, and documents architecture—not only a file list.
- User has approved proceeding to Part 2.

---

## Part 2: Scaffolding

Docker + FastAPI hello world. Static HTML demo page + API call. No real Kanban yet.

### Checklist

**Docker and Python**

- Add multi-stage `Dockerfile`: final stage uses Python + `uv`; optional earlier stage can be minimal for Part 2 (full Node build stage lands in Part 3)
- Add `docker-compose.yml` with one service, exposed port (e.g. 8000), and env-file support for future `.env`
- Create `backend/pyproject.toml` managed by `uv` (FastAPI, uvicorn, pytest, httpx for tests)
- Create `backend/` package with FastAPI app entrypoint (e.g. `backend/main.py` or `backend/app/main.py`)
- Add `GET /api/health` (or `/api/hello`) returning JSON `{ "status": "ok" }` (or similar)

**Static demo page**

- Serve a minimal static HTML page at `/` from FastAPI (`StaticFiles` or embedded HTML for Part 2 only)
- Demo page fetches `/api/health` and displays the result on screen (proves same-origin API + static coexist)

**Scripts and docs**

- Add `scripts/start` and `scripts/stop` (or `.sh`) that wrap `docker compose up` / `down`
- Update `backend/AGENTS.md` with run commands, test commands, and module layout
- Update `scripts/AGENTS.md` with how to start/stop the stack
- Add minimal root `README.md` notes: prerequisites (Docker), start/stop commands, verify URL
- Update root `AGENTS.md` scripts bullet to match Compose-only wrappers (if not already)

**Quality**

- Add `.dockerignore` to keep image builds fast (exclude `node_modules`, `.git`, etc.)

### Tests

- `docker compose build` succeeds
- `scripts/start` brings stack up; `scripts/stop` brings it down cleanly
- `curl http://localhost:<port>/api/health` returns 200 and expected JSON
- `curl http://localhost:<port>/` returns HTML containing the demo page
- Browser: open `/`, confirm API result is shown (not a failed fetch)
- `uv run pytest` in `backend/` — at least one test for the health endpoint using `TestClient`
- No Kanban, auth, DB, or AI code introduced

### Success criteria

- Local `scripts/start` → open app in browser → see hello/demo page + successful API call → `scripts/stop`.
- Python dependencies managed exclusively with `uv` inside Docker (no parallel `pip install` workflow).
- `/api/`* prefix established for all backend routes.
- Foundation ready for Part 3 to add frontend build stage and replace demo HTML with Next export.

---

## Part 3: Add in Frontend

Statically export the Next.js app and serve it from FastAPI at `/`.

### Checklist

**Next.js static export**

- Set `output: 'export'` in `frontend/next.config.ts`
- Add any required export options (`images.unoptimized`, `trailingSlash`, etc.) if build fails
- Confirm `npm run build` produces `frontend/out/`
- Verify drag-and-drop and all client components work from static files (no server actions or dynamic SSR required)

**Docker build pipeline**

- Extend `Dockerfile` with Node stage: `npm ci`, `npm run build` in `frontend/`
- Copy `frontend/out/` into Python image path served by FastAPI
- Remove or bypass Part 2 demo HTML; `/` serves the exported Kanban app

**FastAPI static serving**

- Serve static export at `/` with API routes still under `/api/...`
- Add SPA fallback: non-API unknown paths return `index.html` so refresh on `/` works
- Keep `GET /api/health` working

**Documentation**

- Update `frontend/AGENTS.md` with static export build output path and any config changes
- Document dual E2E approach: dev server vs Docker (see Tests below)

### Tests

**Build and unit**

- `cd frontend && npm run build` succeeds
- `cd frontend && npm run test:unit` passes
- `cd frontend && npm run lint` passes (no new errors)

**E2E — dev (day-to-day)**

- `cd frontend && npm run test:e2e` passes against `npm run dev` on port 3000
- Existing flows: load board (5 columns), add card, move card between columns

**E2E / integration — Docker (sign-off)**

- With stack up: `GET /` returns HTML for TaskPilot Kanban (not Part 2 demo page)
- Browser or Playwright against Docker URL: board shows five columns and seed cards
- `GET /api/health` still returns 200 from the same origin
- Document Docker Playwright command or config (e.g. `PLAYWRIGHT_BASE_URL`, separate `playwright.docker.config.ts`, or npm script) for sign-off runs

### Success criteria

- Visiting `/` on the Docker-served stack shows the existing demo Kanban board with seed data.
- Board state is still in-memory only (reload resets to seed).
- Frontend static assets and `/api/`* coexist on one origin with no CORS issues.
- Dev E2E suite remains green; Docker-served smoke/E2E path is documented and verified once.

---

## Part 4: Fake user sign-in experience

Frontend-only gate with dummy credentials. Prepare identity header for later backend wiring.

### Checklist

**Login UI**

- On first visit to `/`, show a login screen before the Kanban
- Login form: username + password fields, submit button styled with TaskPilot colors (purple for primary action per root `AGENTS.md`)
- Accept only `user` / `password`; show clear error for invalid credentials
- Match TaskPilot color scheme and existing visual quality (fonts, surfaces, accent yellow)

**Session behavior**

- After successful login, show the Kanban board
- Persist signed-in state in `sessionStorage` (or equivalent) for the browser tab session
- Log out control visible when signed in; logout clears session and returns to login screen
- Closing tab/window requires login again (sessionStorage semantics)

**Prepare backend identity (no API yet)**

- Define a small auth helper module (e.g. `src/lib/auth.ts`) with `login`, `logout`, `isAuthenticated`, `getAuthHeaders`
- On login success, store username; `getAuthHeaders()` returns `{ 'X-User': 'user' }` for future API calls (unused until Part 7)
- Keep logic thin so Part 7 only wires headers into fetch calls

**Layout**

- Refactor `page.tsx` or add `LoginGate` component to conditionally render login vs `KanbanBoard`

### Tests

- Unit tests for `auth.ts`: valid credentials, invalid credentials, logout clears state, `getAuthHeaders` when authenticated
- Component tests: login success shows board; login failure shows error; logout hides board
- Playwright (dev): unauthenticated user cannot see Kanban columns
- Playwright (dev): login with `user`/`password` shows board with 5 columns
- Playwright (dev): logout returns to login screen
- ~80% coverage on new auth-related units
- Existing Kanban Playwright tests updated to log in first (or use shared `beforeEach` helper)

### Success criteria

- Unauthenticated users never see the board or seed data.
- Valid dummy login and logout work with no backend API.
- `X-User` header helper exists and is ready for Part 7; no API calls yet.
- All Playwright tests pass in dev; Docker sign-off still shows login gate when stack is up.

---

## Part 5: Database modeling

Propose and document normalized SQLite schema and REST API contract. Get user sign-off before coding routes.

### Checklist

**Schema design (`docs/DATABASE.md`)**

- [x] Tables: `users`, `boards`, `columns`, `cards` with FKs and sensible indexes
- [x] `users`: id, username (unique), created_at — supports future multi-user
- [x] `boards`: id, user_id (FK), title, created_at — one board per user for MVP
- [x] `columns`: id, board_id (FK), title, position (integer order) — fixed count at seed time, renamable
- [x] `cards`: id, column_id (FK), title, details, position (integer order within column)
- [x] Document create-if-missing behavior and default DB path (e.g. `data/taskpilot.db`)
- [x] Document Docker volume mount — **implemented as named volume** `taskpilot_data:/app/data` in `docker-compose.yml` (bind mount `./data:/app/data` documented as optional alternative; named volume avoids Docker Desktop file-sharing issues on external drives)
- [x] Seed plan: demo user `user`, one board, five columns matching frontend names, eight seed cards matching `frontend/src/lib/kanban.ts` `initialData`

**API contract (`docs/API.md`)**

- [x] Document all Part 6 endpoints, request/response shapes, and error cases
- [x] `GET /api/board` — returns `BoardData`-compatible JSON for authenticated user (via `X-User` header)
- [x] `PATCH /api/columns/{id}` — rename column (title)
- [x] `POST /api/cards` — create card (column_id, title, details, optional position)
- [x] `PATCH /api/cards/{id}` — update card (title, details)
- [x] `DELETE /api/cards/{id}` — delete card
- [x] `POST /api/cards/{id}/move` — move/reorder (target column_id, position)
- [x] Note: IDs are server-generated (UUID or similar); frontend client IDs from demo are seed-only
- [x] Document 401/404 behavior for missing user or unknown resources

**Alignment**

- [x] Map normalized DB rows ↔ frontend `BoardData` shape (assembly in backend)
- [x] Confirm schema supports rename, move, add, delete, edit without redesign
- [x] Explicitly state: AI chat history is NOT stored in DB

**Approval gate**

- [x] User reviews and approves `docs/DATABASE.md` and `docs/API.md` before Part 6 starts

### Tests

- [x] Review-only: schema supports all Kanban operations and future multi-user
- [x] Review-only: API contract covers every UI action the frontend will need in Part 7
- [x] Review-only: seed data parity with `initialData` documented

### Success criteria

- Clear, simple normalized SQLite design in `docs/DATABASE.md`.
- REST API contract in `docs/API.md` aligned with `BoardData` and `X-User` header auth.
- Docker volume strategy documented.
- User has explicitly approved both documents.
- No production API implementation required in this part (optional read-only spike only).

---

## Part 6: Backend Kanban API

Implement SQLite + CRUD APIs per `docs/API.md`. Create DB if missing.

### Checklist

**Database layer**

- [x] Implement schema migration or `CREATE TABLE IF NOT EXISTS` on startup
- [x] Auto-create DB file if absent at documented path
- [x] Seed demo user (`user`), board, five columns, eight cards if DB is new (match Part 5 seed spec)
- [x] Implement repository/DB helpers: load full board for user, mutate columns/cards

**API routes (under `/api`)**

- [x] Dependency or middleware reads `X-User` header, resolves to `users` row (401 if missing/unknown)
- [x] `GET /api/board` — full board as `BoardData` JSON
- [x] `PATCH /api/columns/{id}` — rename
- [x] `POST /api/cards` — create (server assigns id)
- [x] `PATCH /api/cards/{id}` — update title/details
- [x] `DELETE /api/cards/{id}`
- [x] `POST /api/cards/{id}/move` — change column and/or position
- [x] All mutations validate ownership via board → user chain

**Integration with static serving**

- [x] API routes registered before static mount; no route conflicts
- [x] Update `backend/AGENTS.md` with DB path, seed behavior, test commands, module map

### Tests

- [x] Pytest: DB auto-creation when file missing
- [x] Pytest: seed data present after first init (column count, card count, titles)
- [x] Pytest: `GET /api/board` with `X-User: user` returns expected shape
- [x] Pytest: `GET /api/board` without header returns 401
- [x] Pytest: rename column persists on second read
- [x] Pytest: create, update, delete card
- [x] Pytest: move card within column and across columns (order preserved)
- [x] ~80% coverage on new backend board/DB modules
- [x] Manual: `curl` exercises against running server (Docker unavailable in CI agent; verified via local uvicorn)

### Success criteria

- Backend alone can fully read and mutate the demo user's Kanban in SQLite.
- DB file is created and seeded automatically when missing.
- `X-User` header is required and mapped to the demo user.
- No frontend wiring yet; verifiable via pytest and curl.
- Static frontend from Part 3 still serves at `/` unchanged.

---

## Part 7: Frontend + Backend integration

Wire the UI to the API. Persistent board. Add card editing. Send `X-User` on all API calls.

### Checklist

**API client**

- [x] Add `src/lib/api.ts` (or similar): typed fetch wrappers for each `docs/API.md` endpoint
- [x] Attach `getAuthHeaders()` from `auth.ts` to every request
- [x] Map API errors to simple user-visible messages (minimal)

**Board data flow**

- [x] Replace `useState(initialData)` with load-from-API after login (loading + error states)
- [x] On column rename: debounce or blur-triggered `PATCH` (keep UI responsive)
- [x] On drag end: `POST .../move` with target column and position
- [x] On add card: `POST /api/cards`; use server-returned id in local state
- [x] On delete card: `DELETE /api/cards/{id}`
- [x] Refetch or merge server response after mutations (keep simple; prefer refetch on error)

**Card editing (new UI)**

- [x] Add edit affordance on `KanbanCard` (e.g. click title or Edit button)
- [x] Inline form or modal for title + details; save via `PATCH /api/cards/{id}`
- [x] Cancel discards local edits

**Auth integration**

- [x] Login still uses fake credentials; successful login enables API-backed board
- [x] Logout clears session; re-login shows persisted board from SQLite
- [x] Unauthenticated users cannot trigger API calls

**Drag and drop (Part 7 fix)**

- [x] `pointerWithin` collision detection (fallback: `closestCorners`) for reliable column targeting in a 5-column grid
- [x] `onDragOver` moves cards between columns during drag (multi-container `@dnd-kit` pattern)
- [x] Snapshot column state at drag start; compute API destination from that snapshot on drop
- [x] `lastOverId` fallback when `over` is null at drag end but was valid during drag
- [x] Flex drop spacer below cards in each column for reliable drops below existing cards

**Docs**

- [x] Update `frontend/AGENTS.md` with API client, data flow, edit UI, and DnD behavior

### Tests

- [x] Unit tests for API client (mock `fetch`) and response parsing
- [x] Unit tests for card edit form validation/submit logic
- [x] Component test: edit card updates displayed title/details
- [x] Integration (backend pytest or manual): full round-trip matches frontend actions
- [x] Playwright (dev): login → rename column → reload → name persisted
- [x] Playwright (dev): login → add card → reload → card persisted
- [x] Playwright (dev): login → move card → reload → position persisted
- [x] Playwright (dev): login → edit card → reload → edits persisted
- [x] Playwright (dev): login → delete card → reload → card gone
- [x] Playwright (dev): logout → login → board state from DB still correct
- [x] Playwright (Docker sign-off): at least one persistence smoke test against stack URL
- [x] ~80% coverage on new frontend integration units
- [x] All prior Kanban + auth E2E tests pass

### Success criteria

- The app is a persistent Kanban for the demo user; reload does not reset to hardcoded seed (unless DB was recreated).
- Card editing works end-to-end.
- Every board mutation goes through the API with `X-User` header.
- Logout/login does not lose board data.
- Dev and Docker sign-off E2E paths pass.

---

## Part 8: AI connectivity

Prove OpenRouter works from the backend with a trivial call.

### Checklist

- [x] Add `.env.example` at repo root with `OPENROUTER_API_KEY=` and brief comment
- [x] Wire `env_file: .env` in `docker-compose.yml` (gitignored `.env` for local key; already present with `required: false`)
- [x] Add OpenRouter client module in backend using **httpx** (no OpenAI SDK)
- [x] Use model `openai/gpt-oss-120b` per root `AGENTS.md`
- [x] Add `POST /api/ai/ping` (no `X-User` auth) sending a trivial prompt ("What is 2+2?")
- [x] Return model reply in JSON; **503** with clear message when key is missing
- [x] Do not expose API key to frontend
- [x] Update `backend/AGENTS.md` with env var requirements
- [x] Live verification: real OpenRouter call via ping endpoint confirms a model reply

### Tests

- [x] Unit test: OpenRouter client with mocked HTTP — parses response text
- [x] Unit test: missing `OPENROUTER_API_KEY` raises clear error (no silent success)
- [x] Integration test: with mocked OpenRouter, `POST /api/ai/ping` returns 200
- [x] Live test (marked `@pytest.mark.live`): real call returns a reply containing "4" when key present
- [x] Manual: with real key in `.env`, curl ping endpoint and confirm sensible answer
- [x] ~80% coverage on new AI client module

### Success criteria

- With valid key in `.env`, backend completes a real OpenRouter call.
- Without key, failure is obvious via **503** in API response.
- No Kanban mutation or chat UI yet.
- Kanban API and static frontend still work unchanged.

---

## Part 9: Kanban-aware AI (structured outputs)

Send board context + user question + conversation history to the model; return reply and optional granular board operations.

### Checklist

**Operation schema**

- Define Pydantic models for AI response: `{ message: string, operations?: Operation[] }`
- Operation types (granular): e.g. `create_card`, `update_card`, `delete_card`, `move_card`, `rename_column`
- Each operation type has required fields documented in `docs/API.md` or `docs/AI.md`
- Document prompt structure: current board JSON, user message, recent history

**Chat endpoint**

- `POST /api/chat` — body: `{ message: string, history: Message[] }`; requires `X-User`
- Load current board from DB for context
- Call OpenRouter with structured output instruction (JSON schema or tool-style parsing)
- Parse and validate response; reject malformed operations with clear error (no DB corruption)
- Apply valid operations sequentially via existing Part 6 persistence layer
- Return `{ message, board? }` — include updated `BoardData` if any operations applied

**Safety**

- Validate column/card IDs exist before mutate; unknown IDs fail that operation or entire request (pick one, document it)
- Transaction or rollback strategy if partial apply is risky (keep simple: all-or-nothing preferred)
- History stays in request payload only — never written to SQLite

**Docs**

- Add `docs/AI.md` describing operation types, prompt strategy, and failure modes

### Tests

- Unit tests: parse valid structured response
- Unit tests: reject invalid JSON, unknown operation types, missing fields
- Unit tests: each operation type applied correctly (mocked DB)
- Integration: mocked LLM returns `create_card` → card appears in DB
- Integration: mocked LLM returns `move_card` → order updated in DB
- Integration: mocked LLM returns reply only (no operations) → DB unchanged
- Integration: invalid operation does not corrupt existing board data
- ~80% coverage on AI orchestration modules
- Optional live smoke test with real key

### Success criteria

- Backend answers board-aware questions and applies validated granular operations.
- Chat history is not stored in the database.
- Malformed AI output fails safely with no partial corruption.
- Endpoint ready for Part 10 UI consumption.

---

## Part 10: AI chat sidebar UI

Sidebar chat using Part 9; refresh board when operations are applied.

### Checklist

**Layout**

- Add collapsible or fixed sidebar alongside Kanban (visible only when signed in)
- Match TaskPilot colors: navy headings, blue accents, purple send button, yellow highlights
- Responsive: sidebar usable on desktop; graceful on smaller widths (collapse or stack)

**Chat behavior**

- Message list: user and assistant bubbles, scroll to latest
- Input + send button; disable while request in flight
- Maintain `history` in React state (session memory); clear on logout
- On send: `POST /api/chat` with message + history + auth headers
- Append assistant `message` to history
- If response includes `board`, update board state (or refetch `GET /api/board`)

**Error handling**

- Missing API key or server error: show message in chat panel, do not break Kanban
- Network failure: user can retry

**Docs and tests**

- Update `frontend/AGENTS.md` with chat components and API usage
- Add `data-testid` hooks for chat input, send, messages

### Tests

- Component tests: render sidebar, send message (mock fetch), display assistant reply
- Component tests: board state updates when response includes board
- Component tests: error state when API returns 503
- Component tests: history clears on logout
- Playwright (dev): login → open chat → send message (mock network or test double) → see reply
- Playwright (dev): mocked response with board update → Kanban reflects new card (or moved card)
- Playwright: regression — login, CRUD, edit, move, logout flows still pass
- Playwright (Docker sign-off): chat smoke test against stack (mocked network acceptable)
- ~80% coverage on new chat UI units

### Success criteria

- Full MVP: sign-in, persistent Kanban (including edits), AI sidebar that can change the board via granular operations.
- AI chat history lasts for the browser session only; cleared on logout.
- Kanban remains usable when OpenRouter key is missing (chat shows error).
- User can demo end-to-end locally via `scripts/start`.
- All dev E2E tests pass; Docker sign-off checks pass.

---

## Progress tracking


| Part | Name               | Status     |
| ---- | ------------------ | ---------- |
| 1    | Plan               | Complete   |
| 2    | Scaffolding        | Complete   |
| 3    | Add in Frontend    | Complete   |
| 4    | Fake user sign-in  | Complete   |
| 5    | Database modeling  | Complete   |
| 6    | Backend Kanban API | Complete   |
| 7    | Frontend + Backend | Complete   |
| 8    | AI connectivity    | Complete   |
| 9    | Kanban-aware AI    | Not started |
| 10   | AI chat sidebar UI | Not started |

**Next up:** Part 9 — Kanban-aware AI (`POST /api/chat` with structured operations).
