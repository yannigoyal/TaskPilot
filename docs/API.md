# TaskPilot REST API Contract

Kanban API for Parts 6–7. All routes are under `/api`. Static frontend is served at `/`.

Part 5 design only — implementation lands in Part 6.

## Authentication (MVP)

| Header | Required | Description |
|--------|----------|-------------|
| `X-User` | Yes, on all board routes | Username string; must match a row in `users` (demo: `user`) |

This is **local MVP trust only**, not real security. The frontend sets this header via `getAuthHeaders()` in `frontend/src/lib/auth.ts` after fake login.

| Situation | Status | Response body |
|-----------|--------|----------------|
| Header missing | `401` | `{ "detail": "Missing X-User header" }` |
| Unknown username | `401` | `{ "detail": "Unknown user" }` |
| Resource not on user's board | `404` | `{ "detail": "Not found" }` |
| Invalid request body | `422` | FastAPI validation error |
| Invalid ids / business rule | `400` | `{ "detail": "<message>" }` |

Ownership check: every column and card mutation must verify the resource belongs to the authenticated user's board (via `boards.user_id`).

## Shared types

Aligned with `frontend/src/lib/kanban.ts`:

```ts
type Card = {
  id: string;
  title: string;
  details: string;
};

type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};
```

### Mutation response convention

All successful board mutations return the **full updated board** as `BoardData`. This keeps Part 7 integration simple (replace local state from response). The client may also call `GET /api/board` after errors.

## Endpoints

### `GET /api/health`

No auth. Already implemented in Part 2.

**Response `200`:**

```json
{ "status": "ok" }
```

---

### `GET /api/board`

Return the authenticated user's Kanban board.

**Headers:** `X-User: user`

**Response `200`:** `BoardData`

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Define MVP scope",
      "details": "List core features..."
    }
  }
}
```

**Errors:** `401` if not authenticated.

---

### `PATCH /api/columns/{column_id}`

Rename a column.

**Headers:** `X-User: user`

**Body:**

```json
{ "title": "New column name" }
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string | yes, non-empty after trim |

**Response `200`:** `BoardData` (full board after rename)

**Errors:** `401`, `404` (column not on user's board), `422`

---

### `POST /api/cards`

Create a card in a column.

**Headers:** `X-User: user`

**Body:**

```json
{
  "column_id": "col-backlog",
  "title": "New task",
  "details": "Optional details",
  "position": 0
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `column_id` | string | yes | Must belong to user's board |
| `title` | string | yes | Non-empty after trim |
| `details` | string | no | Default `""`; frontend may send `"No details yet."` |
| `position` | integer | no | 0-based index in column; default append at end |

**Response `201`:** `BoardData` (server assigns card `id`, e.g. `card-{uuid}`)

**Errors:** `401`, `404` (unknown column), `400`, `422`

---

### `PATCH /api/cards/{card_id}`

Update card title and/or details (Part 7 edit UI).

**Headers:** `X-User: user`

**Body** (at least one field required):

```json
{
  "title": "Updated title",
  "details": "Updated details"
}
```

**Response `200`:** `BoardData`

**Errors:** `401`, `404`, `400`, `422`

---

### `DELETE /api/cards/{card_id}`

Delete a card.

**Headers:** `X-User: user`

**Body:** none

**Response `200`:** `BoardData`

**Errors:** `401`, `404`

---

### `POST /api/cards/{card_id}/move`

Move or reorder a card.

**Headers:** `X-User: user`

**Body:**

```json
{
  "column_id": "col-review",
  "position": 0
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `column_id` | string | yes | Target column on user's board |
| `position` | integer | yes | 0-based index in target column after move |

Backend reorders sibling cards in source and target columns so positions stay contiguous.

**Response `200`:** `BoardData`

**Errors:** `401`, `404` (card or column not found), `400`, `422`

---

### `POST /api/chat`

Kanban-aware AI chat (Part 9). Full contract: `docs/AI.md`.

**Headers:** `X-User: user`

**Body:**

```json
{
  "message": "Move the CI card to In Progress",
  "history": []
}
```

**Response `200`:** `{ "message": "...", "board"?: BoardData }` — `board` only when operations were applied.

**Errors:** `401`, `400` (invalid operations), `502` (model/parse failure), `503` (missing API key), `422`

---

## Frontend action mapping (Part 7)

| UI action | API call |
|-----------|----------|
| Load board after login | `GET /api/board` |
| Rename column | `PATCH /api/columns/{id}` |
| Add card | `POST /api/cards` |
| Edit card | `PATCH /api/cards/{id}` |
| Delete card | `DELETE /api/cards/{id}` |
| Drag-and-drop move | `POST /api/cards/{id}/move` with target column + index derived from drop target |

Drag-and-drop index: frontend computes target `column_id` and `position` from drop result (same logic as today’s `moveCard`, then map to API).

## IDs

- **Seed data** uses fixed ids from `docs/DATABASE.md` (`card-1`, `col-backlog`, etc.).
- **New cards** get server-generated ids; frontend replaces local state from the response.
- Client-side `createId()` is not accepted by the API.

## Future endpoints (not Part 6)

| Part | Endpoint | Purpose |
|------|----------|---------|
| 8 | `POST /api/ai/ping` | OpenRouter connectivity smoke test |
| 9 | `POST /api/chat` | AI chat + optional granular board operations — see `docs/AI.md` |

Part 9 chat applies mutations through the same persistence layer as the routes above. AI chat history is **not** stored in SQLite.

## Error format

FastAPI default:

```json
{ "detail": "Human-readable message" }
```

Validation errors (`422`) use FastAPI's standard `detail` array with `loc` and `msg`.

## CORS

Not required for MVP: frontend and API share the same origin when served from Docker (`localhost:8000`).
