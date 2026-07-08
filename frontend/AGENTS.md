# Frontend AGENTS

Guidance for agents working in `frontend/`. Read root `AGENTS.md` and `docs/PLAN.md` first.

## Role in the project

This is a **Next.js App Router** UI for TaskPilot. The app is **statically exported** (`output: 'export'`) and served from FastAPI at `/` in Docker. Board state still lives in React memory and resets on reload. Not yet wired to auth, SQLite, or AI APIs.

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
src/app/page.tsx       Renders <KanbanBoard /> directly (no auth gate yet)
src/app/globals.css    CSS variables (color tokens), Tailwind theme, base body styles
```

`layout.tsx` is a Server Component. `page.tsx` is a Server Component that imports the client `KanbanBoard`.

### Component tree

```
KanbanBoard (client — owns all board state)
├── DndContext (@dnd-kit)
│   ├── KanbanColumn × 5
│   │   ├── SortableContext
│   │   │   └── KanbanCard × n
│   │   └── NewCardForm
│   └── DragOverlay → KanbanCardPreview
```

**State ownership:** `KanbanBoard` holds `board: BoardData` in `useState`, initialized from `initialData` in `src/lib/kanban.ts`. All mutations (rename, add, delete, move) update this single state object. There is no context provider, no external store, and no persistence.

**Drag and drop:** `DndContext` wraps the column grid. Each `KanbanCard` uses `useSortable`. Each `KanbanColumn` uses `useDroppable`. On `dragEnd`, `KanbanBoard` calls `moveCard()` from `kanban.ts` to compute the next column array. `PointerSensor` with 6px activation distance prevents accidental drags. `DragOverlay` shows `KanbanCardPreview` while dragging.

**Column rename:** Controlled `<input>` in `KanbanColumn` calls `onRename` on every keystroke (no debounce yet).

**Add card:** `NewCardForm` toggles a form; on submit calls `onAddCard` which generates a client id via `createId("card")`.

**Delete card:** `KanbanCard` has a Remove button (not part of drag listeners) that calls `onDelete`.

### Board model (`src/lib/kanban.ts`)

```ts
type Card = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

- **Normalized shape:** columns hold ordered `cardIds`; card objects live in a flat `cards` map.
- **Seed data:** `initialData` — five columns (Backlog, Discovery, In Progress, Review, Done), eight cards.
- **Pure functions:** `moveCard(columns, activeId, overId)` handles reorder within a column, move across columns, and drop onto empty column areas. `createId(prefix)` generates `${prefix}-${random}${timestamp}`.

This shape is the contract the backend should return from `GET /api/board` in Part 7 (see `docs/API.md` after Part 5).

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

Playwright tests rely on these ids for drag tests and column queries.

## Important files

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout, fonts, metadata |
| `src/app/page.tsx` | Home page — renders `LoginGate` |
| `src/app/globals.css` | Color tokens, Tailwind, base styles |
| `src/lib/kanban.ts` | Types, `initialData`, `moveCard`, `createId` |
| `src/lib/kanban.test.ts` | Unit tests for `moveCard` |
| `src/components/KanbanBoard.tsx` | Board state, DnD context, header, column grid |
| `src/components/KanbanColumn.tsx` | Column UI, rename input, droppable, sortable list |
| `src/components/KanbanCard.tsx` | Sortable card display + delete button |
| `src/components/KanbanCardPreview.tsx` | Drag overlay card (simplified) |
| `src/components/NewCardForm.tsx` | Toggle form to add a card |
| `src/components/KanbanBoard.test.tsx` | Component tests: columns, rename, add/delete |
| `next.config.ts` | Static export (`output: 'export'`, `images.unoptimized`) |
| `vitest.config.ts` | Vitest + jsdom + `@` alias + coverage reporters |
| `playwright.config.ts` | E2E against dev server on port 3000 |
| `playwright.docker.config.ts` | E2E against Docker stack on port 8000 |
| `tests/kanban.spec.ts` | E2E: load board, add card, move card |
| `src/test/setup.ts` | Vitest setup (`@testing-library/jest-dom`) |

## Current capabilities

- Rename columns inline
- Drag cards within and across columns
- Add cards (title + details)
- Delete cards

**Not implemented yet:** card edit UI, API client, persistence, AI sidebar.

| Feature | Planned part |
|---------|--------------|
| API-backed board | Part 7 |
| Card editing | Part 7 |
| AI chat sidebar | Part 10 |

## Auth (Part 4)

- `src/lib/auth.ts` — `login`, `logout`, `isAuthenticated`, `getAuthHeaders` (returns `{ "X-User": "user" }` when signed in).
- Session stored in `sessionStorage` under `taskpilot_session`.
- Demo credentials: `user` / `password`.
- `LoginGate` wraps the app in `page.tsx`; shows `LoginForm` or `KanbanBoard`.
- `KanbanBoard` accepts `onLogout`; logout button uses `data-testid="logout-button"`.
- E2E helper: `tests/auth-helpers.ts` → `loginAsDemoUser(page)`.

| Path | Purpose |
|------|---------|
| `src/lib/auth.ts` | Session auth helpers |
| `src/lib/auth.test.ts` | Auth unit tests |
| `src/components/LoginForm.tsx` | Login UI (`data-testid="login-form"`) |
| `src/components/LoginGate.tsx` | Auth gate between login and board |
| `src/components/LoginGate.test.tsx` | Login gate component tests |
| `tests/auth.spec.ts` | Auth E2E tests |
| `tests/auth-helpers.ts` | Shared Playwright login helper |

## Commands

From `frontend/`:

```bash
npm install
npm run dev              # local demo at http://localhost:3000
npm run lint             # ESLint
npm run test:unit        # Vitest (single run)
npm run test:unit:watch  # Vitest watch mode
npm run test:e2e         # Playwright vs dev server (:3000)
npm run test:e2e:docker  # Playwright vs Docker stack (:8000) — start stack from repo root first
npm run test:all         # unit + dev e2e
npm run build            # static export to out/
```

## Static export

- `next.config.ts` sets `output: "export"` and `images.unoptimized: true`.
- `npm run build` writes the site to `frontend/out/`.
- Docker copies `out/` into `backend/static/` at image build time; FastAPI serves it at `/`.

## Testing setup

### Unit tests (Vitest)

- **Location:** `src/**/*.{test,spec}.{ts,tsx}` (co-located with source).
- **Environment:** jsdom with `@testing-library/react` and `userEvent`.
- **Setup:** `src/test/setup.ts` imports `@testing-library/jest-dom`.
- **Coverage:** `@vitest/coverage-v8` configured; reporters `text` and `html`. Target ~80% on new logic per plan.
- **Run:** `npm run test:unit`.

Current tests:
- `auth.test.ts` — login, logout, headers
- `kanban.test.ts` — `moveCard` reorder, cross-column move, drop to column
- `KanbanBoard.test.tsx` — five columns render, rename, add/remove card
- `LoginGate.test.tsx` — login success/failure, logout

### E2E tests (Playwright)

- **Location:** `tests/*.spec.ts`.
- **Config:** `playwright.config.ts` — `baseURL` `http://127.0.0.1:3000`, starts `npm run dev` as webServer, Chromium only, 60s timeout.
- **Run:** `npm run test:e2e`.

- **Run (Docker):** `npm run test:e2e:docker` (stack must be running on port 8000).

Current tests:
- `auth.spec.ts` — login gate, sign-in, logout
- `kanban.spec.ts` — load board, add card, move card (logs in via `beforeEach`)

Kanban E2E uses `loginAsDemoUser` from `auth-helpers.ts` before each test.

### Dual E2E strategy

Per `docs/PLAN.md`:

- **Day-to-day:** `npm run test:e2e` — Playwright starts `npm run dev` on port 3000 (`playwright.config.ts`).
- **Docker sign-off:** from repo root run `./scripts/start`, then from `frontend/` run `npm run test:e2e:docker` (`playwright.docker.config.ts`, base URL `http://127.0.0.1:8000`).

## Constraints for agents

1. Keep changes simple; match existing patterns, styling, and `data-testid` conventions.
2. Do not introduce backend or Docker work in this folder unless the plan part requires frontend config.
3. Static export is configured; `npm run build` must keep producing a working `out/`.
4. Auth and login gate are implemented; do not add backend API calls until Part 7.
5. Until Part 7, board state may remain client-side unless the plan part says otherwise.
6. After Part 7, all board mutations must go through `/api/*` with `getAuthHeaders()` from `auth.ts`.
7. No emojis in docs or UI copy.
8. Do not add features beyond the current plan part.
9. Prefer fixing root causes over defensive patches (per root `AGENTS.md`).

## Future integration notes (for later parts)

**Part 7:** Add `src/lib/api.ts` with typed fetch wrappers per `docs/API.md`. Load board from `GET /api/board` after login. Attach `getAuthHeaders()` to every request. Replace client-generated card ids with server ids. Add card edit UI.

**Part 10:** Add chat sidebar component; call `POST /api/chat`; keep history in React state; refresh board from response or refetch.
