# Frontend AGENTS

Guidance for agents working in `frontend/`. Read root `AGENTS.md` and `docs/PLAN.md` first.

## Role in the project

This is a **Next.js App Router** UI for TaskPilot. The app is **statically exported** (`output: 'export'`) and served from FastAPI at `/` in Docker. Board state is loaded from and persisted to the backend SQLite API after login. An AI chat sidebar calls `POST /api/chat` and can update the board in place.

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
    ├── main (header + DndContext + columns)
    └── ChatSidebar (session chat history; POST /api/chat)
```

**State ownership:** `KanbanBoard` holds `board: BoardData | null` loaded from `GET /api/board`. All mutations call `src/lib/api.ts` and replace state with the server-returned `BoardData`. Chat responses that include `board` call the same setter so the Kanban updates immediately. Loading and error states use `data-testid="board-loading"` and `data-testid="board-error"`.

**AI chat:** Collapsible fixed overlay sidebar (`ChatSidebar`). Defaults closed so the five-column board keeps full width for drag-and-drop. Open via `chat-toggle`. Keeps `messages` in React state (browser session only). On send: `api.sendChat(message, priorHistory)`. Assistant reply is appended; if `board` is present, `onBoardUpdate` replaces board state immediately. History clears on logout (KanbanBoard unmounts). Errors show in the chat panel (`chat-error`) without breaking the board.

**Drag and drop:** Multi-column `@dnd-kit` setup with one `SortableContext` per column:

- **Collision detection:** `pointerWithin` first, then `closestCorners`
- **`onDragOver`:** Moves cards between columns during drag
- **Drag start snapshot:** Column state saved in a ref; API destination from that snapshot on drop
- **`lastOverId` fallback:** When `over` is null at drag end
- **Drop zone:** Flex spacer below cards in each column

**Column rename / cards:** Unchanged from Part 7 (blur rename, add/edit/delete via API).

### Board model (`src/lib/kanban.ts`)

```ts
type Card = { id: string; title: string; details: string }
type Column = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

### API client (`src/lib/api.ts`)

| Function | Endpoint |
|----------|----------|
| `fetchBoard()` | `GET /api/board` |
| `renameColumn(id, title)` | `PATCH /api/columns/{id}` |
| `createCard(columnId, title, details)` | `POST /api/cards` |
| `updateCard(id, title, details)` | `PATCH /api/cards/{id}` |
| `deleteCard(id)` | `DELETE /api/cards/{id}` |
| `moveCard(id, columnId, position)` | `POST /api/cards/{id}/move` |
| `sendChat(message, history)` | `POST /api/chat` → `{ message, board? }` |

Every request attaches `getAuthHeaders()` (`X-User: user`).

**Dev proxy:** `next.config.ts` rewrites `/api/*` to `http://127.0.0.1:8000/api/*` during `npm run dev` only.

### Styling conventions

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent-yellow` | `#ecad0a` | Highlights, assistant bubble accent |
| `--primary-blue` | `#209dd7` | Links, key accents |
| `--secondary-purple` | `#753991` | Submit / send buttons |
| `--navy-dark` | `#032147` | Headings |
| `--gray-text` | `#888888` | Supporting text |

### Test hooks (`data-testid`)

| Pattern | Element |
|---------|---------|
| `column-{id}` | Column section |
| `card-{id}` | Card article |
| `board-loading` / `board-error` | Board load states |
| `login-form` / `logout-button` | Auth |
| `chat-sidebar` | Open chat panel |
| `chat-toggle` | Show/hide chat |
| `chat-messages` | Message list |
| `chat-message-user` / `chat-message-assistant` | Bubbles |
| `chat-input` / `chat-send` | Composer |
| `chat-error` / `chat-sending` | Chat status |

## Important files

| Path | Purpose |
|------|---------|
| `src/components/ChatSidebar.tsx` | AI chat UI + session history |
| `src/components/KanbanBoard.tsx` | Board + chat layout |
| `src/lib/api.ts` | Board + chat API client |
| `tests/chat.spec.ts` | Chat E2E (mocked `/api/chat`) |

## Current capabilities

- Login gate (`user` / `password`)
- API-backed persistent Kanban board
- Rename, drag, add, edit, delete cards
- AI chat sidebar (session history; board updates from chat)

## Commands

```bash
npm run dev              # http://localhost:3000 (proxies /api to :8000)
npm run test:unit
npm run test:e2e
npm run test:e2e:docker  # stack must be running on :8000
npm run build
```

## Constraints for agents

1. Keep changes simple; match existing patterns, styling, and `data-testid` conventions.
2. Static export must keep producing a working `out/`.
3. All board mutations and chat go through `/api/*` with `getAuthHeaders()`.
4. Chat history stays in React state only — never localStorage/SQLite.
5. No emojis in docs or UI copy.
6. Prefer fixing root causes over defensive patches.
