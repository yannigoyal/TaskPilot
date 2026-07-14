# TaskPilot — Code Review

Prioritized review of the full repository (backend FastAPI + SQLite, frontend Next.js static export, AI chat via OpenRouter). Every finding cites concrete evidence from the repo; no assumptions beyond what the code shows.

Scope note: the project is documented as a local-only MVP with intentionally fake auth (`AGENTS.md`, `docs/PLAN.md` Part 4/5). Findings that are *by design* for that scope are labelled; genuine defects are separated from intentional limitations.

---

## Summary

| ID | Category | Severity | Finding |
|----|----------|----------|---------|
| A1 | Architecture | **Fixed** | ~~Single shared SQLite connection across all requests~~ → replaced with a per-request connection |
| S1 | Security | High (by design) | No real auth: `X-User` header is trusted verbatim as identity |
| S2 | Security | Medium | Untrusted client `history` fed straight into the LLM prompt (injection + token-billing abuse) |
| S3 | Security | Medium | No rate limiting / concurrency guard on billed AI endpoints |
| C1/A2 | Code quality / Architecture | Medium | Fragile global-connection coupling + 3 duplicated "known user" checks + inconsistent 401/404 |
| M1 | Maintainability | Medium | Dockerfile ships test code and uses unpinned `uv:latest` |
| T1 | Testing | Medium | No concurrency tests — the shared-connection model (A1) is never challenged |
| T2 | Testing | Low/Med | `lint` lints generated `coverage/` artifacts and emits a warning |
| A3 | Architecture | Low | Local backend alone serves "static not found" (no `backend/static` produced outside Docker) |
| P1 | Performance | Low/Med | Full board reloaded + re-serialized after every mutation (and N× per chat op) |
| C2 | Code quality | Low | Position reindexing does O(n) row-by-row UPDATEs |
| C3 | Code quality | Low | `ensurePersistedBoard` busy-waits via `setTimeout` polling |
| C4 | Code quality | Low | Dead `columnId` parameter in `handleDeleteCard` |
| M3 | Maintainability | Low | `title_not_empty` validator duplicated across `schemas.py` and `ai_schemas.py` |
| S4 | Security | **Positive** | Secret handling is correct (`.env` gitignored, key never returned) |

---

## High severity

### A1 — Single shared SQLite connection across all requests  ✅ FIXED
**Evidence (original defect):**
- `backend/app/main.py:18` — `db_connection: sqlite3.Connection | None = None` (module-level global).
- `backend/app/main.py:31-34` — `open_database()` created **one** connection in the lifespan; `:38-44` stored it in that global.
- `backend/app/routes/board.py:23-26` and `backend/app/routes/chat.py:15-18` — `get_db_connection()` returned that **same global** for every request.
- `backend/app/database.py:128` — `sqlite3.connect(database_path, check_same_thread=False)`.

**Verified impact (before fix):** Firing 80 concurrent `POST /api/cards` returned `{201: 68, 404: 5, 401: 4, 500: 3}` while the same 80 **serially** returned `{201: 80}`. Server log showed `sqlite3.InterfaceError: bad parameter or other API misuse` at `routes/board.py` `_handle_board_errors`. 80 creates left the board with only 64 cards — ~24 writes were dropped.

**Fix applied:**
- `backend/app/main.py` — removed the module-global connection and `open_database()`; the lifespan now only opens a connection to run `init_db()` (schema + seed) once at startup, then closes it.
- `backend/app/deps.py` — added `get_db_connection()`, a `fastapi.Depends` generator that opens a **fresh connection per request** and closes it in `finally`. This also removes the fragile lazy `from app.main import db_connection` that previously worked around a circular import.
- `backend/app/routes/board.py` and `backend/app/routes/chat.py` — now import `get_db_connection` from `app.deps` instead of defining their own global-returning version.
- `backend/tests/test_chat_api.py` — updated the `test_chat_history_not_written_to_db` helper to open its own scoped connection (no longer imports the removed global).

**Regression tests added** (`backend/tests/test_concurrency.py`):
- `test_connection_dependency_yields_distinct_connections` — asserts two requests get distinct connection objects (guards against reintroducing a shared global).
- `test_concurrent_card_creates_all_succeed` — starts the real app (single uvicorn worker, as the Docker image does) and fires 60 concurrent card creates; asserts all 201 and board integrity holds.
- `test_concurrent_moves_do_not_corrupt` — 60 concurrent `move` requests; asserts no duplicate/missing card references.

**Result after fix:** full backend suite (66 tests) passes, including the 3 new concurrency tests; live OpenRouter test passes; frontend unit suite (37) unaffected. The duplicate `X-User` 401/404 and 500 errors under load are gone.

---

### S1 — No real authentication (by design, but zero access control)
**Evidence:**
- `backend/app/deps.py:8-13` — `get_current_username` returns the raw `X-User` header; `:16-19` `require_known_user` just returns it unchanged (it does **not** verify the user exists).
- `frontend/src/lib/auth.ts:42-49` — `getAuthHeaders()` returns `{ "X-User": session.username }`; the username *is* the credential.
- `backend/tests/conftest.py:6` — `AUTH_HEADERS = {"X-User": "user"}` confirms the only credential is the header.

**Problem:** Any client can send `X-User: user` (or any string) and act as that identity. Because the DB already supports multiple users (`docs/DATABASE.md`, `database.py` `users`/`boards` tables), a client can spoof any username. This is explicitly an MVP-local limitation (`docs/PLAN.md` Part 4/5), so it is **not** a defect for the stated scope — but it means the app must never be exposed beyond localhost without real auth.

**Recommendation:** Acceptable for local MVP. Before any networked deployment, replace `require_known_user` with real credential/session validation; rename the dependency to reflect that it does not authorize.

---

## Medium severity

### S2 — Untrusted client `history` fed into the LLM prompt
**Evidence:**
- `backend/app/routes/chat.py:23-31` — `payload.history` (request body) is passed to `run_chat` → `build_openrouter_messages`.
- `backend/app/chat.py:82-103` — `history` messages are concatenated directly into the prompt sent to OpenRouter.
- No length cap, content validation, or sanitization anywhere on `history`.

**Problem:** The chat history originates entirely from the client (browser `sessionStorage`). It is treated as trusted and injected into the model prompt. This is both a prompt-injection vector (a crafted "assistant" turn in `history` can steer operations) and a cost/DoS vector (OpenRouter is billed per token, and there is no upper bound on history size). `run_chat` also re-sends the board after history (`:87-101`), but the history itself is unguarded.

**Recommendation:** Cap `history` length/count, validate each message shape server-side, and consider not trusting client history for board-affecting turns.

### S3 — No rate limiting on billed AI endpoints
**Evidence:**
- `backend/app/openrouter.py:29` — per-call timeout 60s; `:65` a fresh `httpx.Client` per call.
- `backend/app/routes/chat.py` and `routes/ai.py` — no concurrency guard, per-user or global rate limit.

**Problem:** Every `/api/chat` request triggers a billed OpenRouter call. A client (or a loop in the UI) can fan out many requests → unbounded spend and latency. There is no guard.

**Recommendation:** Add per-session rate limiting and/or debounce; cap concurrent in-flight LLM calls.

### C1 / A2 — Fragile global coupling + duplicated and inconsistent user checks
**Evidence:**
- `backend/app/routes/board.py:23-26` & `routes/chat.py:15-18` — `get_db_connection` does `from app.main import db_connection` *inside the function* (lazy import to dodge the `main`↔`routes` circular import). Implicit dependency on `main.py` internals.
- `backend/app/routes/board.py:29-31` — `_handle_board_errors` runs `get_user_id` and raises 401, then each action (`rename_column`, etc.) calls `_require_board_id` → `get_user_id` **again** (`database.py`). Two user lookups per board request.
- `backend/app/routes/chat.py:27-28` — a *third* copy of the same "is this user known?" check, inline.
- Inconsistent status codes: unknown user → 401 in both routes, but `BoardError`/`NotFoundError` from the DB layer → 404 (`database.py` `NotFoundError`, `chat.py:40-43`). The same logical "unknown" condition can surface as 401 or 404 depending on which path runs first.

**Problem:** Auth/DB plumbing is scattered across `deps.py`, both route modules, and `database.py`; the same check is implemented three ways with different error codes. Hard to reason about, easy to regress, and wastes a query per request.

**Recommendation:** Centralize user resolution in one dependency that returns a verified user (or 401), and have all routes use it. Remove the redundant `_handle_board_errors` lookups.

### M1 — Dockerfile ships test code and uses unpinned `uv:latest`
**Evidence:**
- `Dockerfile:24` — `COPY backend/tests ./tests` copies the entire test suite into the production runtime image.
- `Dockerfile:13` — `COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/` pulls the **unpinned `latest`** uv image.
- `Dockerfile:21` — `uv sync --frozen --no-dev` is good (lockfile-respected).

**Problem:** Test sources in the production image add size and attack surface. More importantly, `uv:latest` makes builds non-reproducible: a future uv release can silently break the image build.

**Recommendation:** Drop the `tests` COPY; pin `uv` to a specific version tag (or digest).

### T1 — No concurrency tests (masks A1)
**Evidence:**
- `backend/tests/conftest.py:9-14` — the fixture uses `fastapi.testclient.TestClient` (synchronous, serial). The entire 64-test suite exercises a single connection serially.
- No test issues concurrent board/chat requests.

**Problem:** The shared-connection architecture (A1) is never stressed. "database is locked" / interleaved-transaction bugs would not be caught by CI but would appear under real uvicorn multi-thread load.

**Recommendation:** Add at least one concurrency smoke test (e.g. fire parallel `/api/board` + `/api/chat` against a `uvicorn` worker) once A1 is addressed.

### T2 — `lint` lints generated coverage artifacts
**Evidence:**
- `frontend/package.json:9` — `"lint": "eslint"` with no file restriction.
- Running it now emits: `frontend/coverage/block-navigation.js  1:1  warning  Unused eslint-disable directive`.
- `frontend/eslint.config.mjs:9-15` only global-ignores `.next/`, `out/`, `build/`, `next-env.d.ts` — not `coverage/`.
- `frontend/.gitignore` ignores `frontend/coverage`, so the file is a build artifact that eslint should not lint.

**Problem:** Lint noise from generated files; a strict CI "lint must be clean" gate would fail on an unrelated artifact.

**Recommendation:** Add `coverage/` to `globalIgnores` (or scope eslint to `src/`).

---

## Low severity

### A3 — Local backend alone serves "static not found"
**Evidence:**
- `backend/app/main.py:16` — `STATIC_DIR = .../backend/static`.
- `Dockerfile:25` — only the Docker build copies `frontend/out` → `./static`; `backend/static` is never produced by any local command and is gitignored (`.gitignore:183`).
- `backend/app/main.py:64-68` — fallback returns `{"error": "Frontend static files not found..."}` when the dir is absent.

**Impact:** Running the backend standalone (without Docker) yields a JSON error, not the app. The documented local flow uses the Next dev server + proxy (`next.config.ts:8-18`), so it works, but the bare backend is confusing.

### P1 — Full board reloaded after every mutation
**Evidence:**
- `backend/app/database.py:300,337,361,378,437` — every mutation returns `load_board(...)` (2 queries + full `BoardData` rebuild).
- `backend/app/chat.py:215-252` — each applied operation calls a DB function that returns the **full** board; an N-op chat reloads the board N+1 times.

**Impact:** Fine at seed scale (8 cards). Degrades as the board grows; the chat path is especially wasteful.

### C2 — O(n) row-by-row position UPDATEs
**Evidence:**
- `backend/app/database.py:272-281` — `_compact_column` loops and issues one `UPDATE` per card.
- `backend/app/database.py:408-433` — `move_card` similarly loops UPDATEs for reindexing.

**Impact:** Linear in column size; acceptable for MVP, not for large boards.

### C3 — `ensurePersistedBoard` busy-waits
**Evidence:**
- `frontend/src/components/KanbanBoard.tsx:96-103` — `while (pendingMutations.current > 0) await new Promise(r => setTimeout(r, 20))` polls every 20ms, then reloads the board.

**Impact:** Works, but polling is a fragile timing pattern; a promise/callback on mutation completion would be cleaner.

### C4 — Dead `columnId` parameter
**Evidence:**
- `frontend/src/components/KanbanBoard.tsx:224-227` — `handleDeleteCard(columnId, cardId)` immediately does `void columnId;`; the API call (`api.deleteCard(cardId)`) does not use it.

**Impact:** Misleading prop contract; the `onDeleteCard` signature in `KanbanColumn.tsx:15`/`KanbanCard.tsx:10` carries a column id that is discarded.

### M3 — Duplicated `title_not_empty` validator
**Evidence:**
- `backend/app/schemas.py:24-30, 39-45, 58-66` and `backend/app/ai_schemas.py:45-51, 66-74, 94-100` — the same trim-and-reject-empty validator is copied in 6 places.

**Impact:** Drift risk; a change to validation rules must be made in six spots.

---

## Positive notes (verified)
- **S4 — Secrets handled correctly.** `.env` is gitignored (`.gitignore:130`, `.dockerignore:6`); `.env.example` ships without a key; `openrouter.py:60` sends the key only as a Bearer header and never returns it to the client. Confirmed `git ls-files .env` is empty.
- **Strong backend test coverage.** 64 backend tests cover parse/validate/apply, chat all-or-nothing (`test_chat_api.py:218-247`), DB seed/lifecycle, and AI client failure modes. All pass.
- **Frontend tests pass** — 37 unit (Vitest) + 34 E2E (Playwright, both dev and Docker targets) all green at review time.
- **Clear separation of concerns** between static frontend, API, and SQLite; normalized schema supports future multi-user without redesign.

---

## Suggested priority order
1. ~~**A1** (shared connection)~~ — **FIXED** (per-request connection + 3 regression tests).
2. **C1/A2 + M1** — de-risk the auth/DB plumbing and make the Docker build reproducible (quick wins).
3. **S2 + S3** — bound/validate `history` and rate-limit billed AI calls before relying on the chat in any shared environment.
4. **T1 + T2** — close the test/lint gaps so the above don't regress.
5. Low-severity items (A3, P1, C2–C4, M3) — backlog; safe to defer.
