# Frontend AGENTS

Guidance for agents working in `frontend/`. Read root `AGENTS.md` and `docs/PLAN.md` first.

## Role in the project

This is a **Next.js App Router** UI for TaskPilot. The app is **statically exported** (`output: 'export'`) and served from FastAPI at `/` in Docker. Board state is loaded from and persisted to the backend SQLite API after login.

## Stack

| Tool | Version / notes |
|------|-----------------|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 (`@import "tailwindcss"` in `globals.css`) |
| Drag and drop | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Unit tests | Vitest 3 + Testing Library + jsdom |
| E2E tests | Playwright 1.x |

Path alias: `@/*` maps to `src/*` (configured in `tsconfig.json` and `vitest.config.ts`).

## Architecture

### Page and layout

```
src/app/layout.tsx     Root HTML shell, Google fonts (Space Grotesk, Manrope), globals.css
src/app/page.tsx       Renders <LoginGate />
src/app/globals.css    CSS variables (color tokens), Tailwind theme, base body styles
```

`layout.tsx` is a Server Component. `page.tsx` is a Server Component that imports the client `LoginGate`.

### Component tree

```
LoginGate (client — auth gate)
└── KanbanBoard (client — loads board from API, owns mutations)
    ├── DndContext (@dnd-kit)
    │   ├── KanbanColumn × 5
    │   │   ├── SortableContext
    │   │   │   └── KanbanCard × n (inline edit form)
    │   │   └── NewCardForm
    │   └── DragOverlay → KanbanCardPreview
```

**State ownership:** `KanbanBoard` holds `board: BoardData | null` loaded from `GET /api/board`. All mutations call `src/lib/api.ts` and replace state with the server-returned `BoardData`. Loading and error states use `data-testid="board-loading"` and `data-testid="board-error"`.

**Drag and drop:** Multi-column `@dnd-kit` setup with one `SortableContext` per column:

- **Collision detection:** `pointerWithin` first, then `closestCorners` — avoids wrong drop targets in the 5-column grid.
- **`onDragOver`:** Moves cards between columns during drag (required for multi-container sortable).
- **Drag start snapshot:** Column state saved in a ref at drag start; API destination computed from that snapshot on drop (not from optimistic mid-drag state).
- **`lastOverId` fallback:** Used when `over` is null at drag end but was valid during drag.
- **Drop zone:** Each column has a flex spacer below cards so drops below existing cards hit the droppable area.
- On drop: optimistic update from snapshot + `api.moveCard`; server response replaces state. On API failure, board refetches.

**Column rename:** Controlled `<input>` updates local state on change; `onBlur` calls `PATCH /api/columns/{id}` when title differs from last persisted value (tracked in a ref).

**Add card:** `NewCardForm` submits to `POST /api/cards`; server assigns card id.

**Edit card:** `KanbanCard` toggles inline edit form; Save calls `PATCH /api/cards/{id}`; Cancel discards edits. Sortable drag is disabled while editing.

**Delete card:** Remove button calls `DELETE /api/cards/{id}`.

### Board model (`src/lib/kanban.ts`)

```ts
type Card = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

- **Normalized shape:** columns hold ordered `cardIds`; card objects live in a flat `cards` map.
- **Seed data:** `initialData` remains for unit tests only; runtime board comes from the API.
- **Pure functions:** `moveCard` (local DnD layout), `getMoveDestination` (API move target from column snapshot + drop target), `findColumnForItem` (resolve card/column id to column id). `createId` is legacy (tests only; server assigns ids).

### API client (`src/lib/api.ts`)

Typed fetch wrappers for all `docs/API.md` board endpoints. Every request attaches `getAuthHeaders()` (`X-User: user`). Mutations return full `BoardData`. Throws `ApiError` with a simple message on failure.

| Function | Endpoint |
|----------|----------|
| `fetchBoard()` | `GET /api/board` |
| `renameColumn(id, title)` | `PATCH /api/columns/{id}` |
| `createCard(columnId, title, details)` | `POST /api/cards` |
| `updateCard(id, title, details)` | `PATCH /api/cards/{id}` |
| `deleteCard(id)` | `DELETE /api/cards/{id}` |
| `moveCard(id, columnId, position)` | `POST /api/cards/{id}/move` |

**Dev proxy:** `next.config.ts` rewrites `/api/*` to `http://127.0.0.1:8000/api/*` during `npm run dev` only. Static export in Docker uses same-origin `/api/*` on port 8000.

### Styling conventions

Colors are CSS variables in `globals.css`, referenced as `var(--token)` or Tailwind arbitrary values like `text-[var(--navy-dark)]`:

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-yellow` | `#ecad0a` | Highlights, column markers |
| `--primary-blue` | `#209dd7` | Links, key accents |
| `--secondary-purple` | `#753991` | Submit buttons (future login/chat) |
| `--navy-dark` | `#032147` | Headings |
| `--gray-text` | `#888888` | Supporting text |
| `--surface` / `--surface-strong` | light grays/white | Backgrounds |
| `--stroke` | rgba border | Borders |
| `--shadow` | box shadow | Cards, panels |

Display headings use `font-display` (Space Grotesk). Body uses Manrope.

### Test hooks (`data-testid`)

| Pattern | Example | Element |
|---------|---------|---------|
| `column-{id}` | `column-col-backlog` | Column section |
| `card-{id}` | `card-card-1` | Card article |
| `board-loading` | — | Loading state |
| `board-error` | — | Error banner |
| `login-form` | — | Login screen |
| `logout-button` | — | Logout control |

Playwright tests rely on these ids for drag tests and column queries.

## Important files

| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Home page — renders `LoginGate` |
| `src/lib/kanban.ts` | Types, `initialData` (tests), `moveCard`, `getMoveDestination` |
| `src/lib/api.ts` | API client with auth headers |
| `src/lib/auth.ts` | Session auth helpers |
| `src/components/LoginGate.tsx` | Auth gate between login and board |
| `src/components/KanbanBoard.tsx` | Board load, mutations, DnD context |
| `src/components/KanbanColumn.tsx` | Column UI, rename, droppable |
| `src/components/KanbanCard.tsx` | Sortable card + inline edit |
| `next.config.ts` | Static export + dev API rewrite |
| `playwright.config.ts` | E2E: backend on :8000 + frontend dev on :3000 |
| `playwright.docker.config.ts` | E2E against Docker on :8000 |
| `tests/persistence.spec.ts` | Reload/logout persistence E2E |
| `tests/auth-helpers.ts` | Shared Playwright login helper |

## Current capabilities

- Login gate (`user` / `password`)
- API-backed persistent Kanban board
- Rename columns (blur saves to API)
- Drag cards within and across columns
- Add, edit, and delete cards
- Logout/login preserves board state in SQLite

**Not implemented yet:** AI chat sidebar.

| Feature | Planned part |
|---------|--------------|
| AI chat sidebar | Part 10 |

## Auth

- `src/lib/auth.ts` — `login`, `logout`, `isAuthenticated`, `getAuthHeaders` (returns `{ "X-User": "user" }` when signed in).
- Session stored in `sessionStorage` under `taskpilot_session`.
- Demo credentials: `user` / `password`.
- `LoginGate` shows `LoginForm` or `KanbanBoard`; board API calls only happen after login.

## Commands

From `frontend/`:

```bash
npm install
npm run dev              # local dev at http://localhost:3000 (proxies /api to :8000)
npm run lint             # ESLint
npm run test:unit        # Vitest (single run)
npm run test:e2e         # Playwright vs dev stack (starts backend + frontend)
npm run test:e2e:docker  # Playwright vs Docker stack (:8000) — start stack from repo root first
npm run test:all         # unit + dev e2e
npm run build            # static export to out/
```

From repo root for Docker:

```bash
./scripts/start          # http://localhost:8000
./scripts/stop
```

## Static export

- `next.config.ts` sets `output: "export"` and `images.unoptimized: true`.
- `npm run build` writes the site to `frontend/out/`.
- Docker copies `out/` into `backend/static/` at image build time; FastAPI serves it at `/`.

## Testing setup

### Unit tests (Vitest)

- **Location:** `src/**/*.{test,spec}.{ts,tsx}` (co-located with source).
- **Run:** `npm run test:unit`.

Current tests:
- `auth.test.ts` — login, logout, headers
- `api.test.ts` — API client (mocked fetch)
- `kanban.test.ts` — `moveCard`, `getMoveDestination`
- `KanbanBoard.test.tsx` — load, rename, add/remove, edit (mocked API)
- `LoginGate.test.tsx` — login success/failure, logout

### E2E tests (Playwright)

- **Location:** `tests/*.spec.ts`.
- **Dev config:** `playwright.config.ts` — starts uvicorn on :8000 (fresh SQLite at `/tmp/taskpilot-e2e-dev.db` each run) and `npm run dev` on :3000; `workers: 1` for shared DB.
- **Docker config:** `playwright.docker.config.ts` — base URL `http://127.0.0.1:8000`; run `./scripts/start` first.

Current tests (13 dev / 13 docker):
- `auth.spec.ts` — login gate, sign-in, logout
- `kanban.spec.ts` — load board, add card, cross-column drag (including drop below existing cards)
- `persistence.spec.ts` — rename, add, edit, move, delete survive reload; logout/login preserves state

## Constraints for agents

1. Keep changes simple; match existing patterns, styling, and `data-testid` conventions.
2. Static export is configured; `npm run build` must keep producing a working `out/`.
3. All board mutations must go through `/api/*` with `getAuthHeaders()` from `auth.ts`.
4. No emojis in docs or UI copy.
5. Do not add features beyond the current plan part.
6. Prefer fixing root causes over defensive patches (per root `AGENTS.md`).

## Future integration notes

**Part 8:** Backend OpenRouter ping endpoint; no frontend changes.

**Part 9–10:** Chat sidebar; `POST /api/chat`; keep history in React state; refresh board from response or refetch.
