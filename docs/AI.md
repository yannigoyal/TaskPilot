# TaskPilot AI Chat (Part 9)

Backend Kanban-aware chat via OpenRouter. History is request-only (not stored in SQLite).

## Endpoint

`POST /api/chat` — requires `X-User`.

**Request:**

```json
{
  "message": "Move the CI card to In Progress",
  "history": [
    { "role": "user", "content": "What is on the board?" },
    { "role": "assistant", "content": "You have five columns..." }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `message` | string | yes | Current user turn (non-empty) |
| `history` | `Message[]` | no | Prior turns only; default `[]`. Roles: `user` \| `assistant` |

**Response `200`:**

```json
{
  "message": "Moved Set up CI pipeline to In Progress.",
  "board": { "columns": [], "cards": {} }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `message` | string | Assistant reply for the UI |
| `board` | `BoardData` \| omitted | Present only when one or more operations were applied |

**Errors:**

| Status | When |
|--------|------|
| `401` | Missing/unknown `X-User` |
| `422` | Invalid request body |
| `502` | OpenRouter failure or unparseable model output |
| `503` | `OPENROUTER_API_KEY` missing |
| `400` | Model returned operations that fail validation (no DB changes) |

## Model output shape

The model must return JSON only:

```json
{
  "message": "Human-readable reply",
  "operations": []
}
```

`operations` may be omitted or empty for reply-only answers.

### Operation types

| `type` | Required fields | Optional |
|--------|-----------------|----------|
| `create_card` | `column_id`, `title` | `details` (default `""`), `position` |
| `update_card` | `card_id`, and at least one of `title` / `details` | |
| `delete_card` | `card_id` | |
| `move_card` | `card_id`, `column_id`, `position` (>= 0) | |
| `rename_column` | `column_id`, `title` | |

IDs must refer to columns/cards on the authenticated user's board. Titles must be non-empty after trim.

## Prompt strategy

1. System message: role instructions and JSON schema for the response.
2. History messages (user/assistant) from the request.
3. A second system message with the **current** `BoardData` JSON (loaded from SQLite at request time), placed after history so prior turns cannot overshadow it.
4. Final user message: the new `message`.

The board JSON is always reloaded from the database for each `/api/chat` call. The frontend waits for in-flight board mutations and refetches before sending chat so the UI and AI see the same persisted state.

Model: `openai/gpt-oss-120b` via OpenRouter (`httpx`).

## Safety

- **Parse first:** Invalid JSON / unknown operation types / missing fields → `502` or `400`; no writes.
- **Validate all ops** against the current board, simulating sequential effects (e.g. a deleted card cannot be moved later in the same list).
- **All-or-nothing apply:** If any operation is invalid, reject the whole request. Validated ops run in one SQLite transaction; failure rolls back.
- Chat history is never written to SQLite.

## Failure modes

| Failure | Behavior |
|---------|----------|
| Missing API key | `503` |
| OpenRouter HTTP/network error | `502` |
| Non-JSON or schema-invalid model text | `502` |
| Valid JSON but bad IDs / empty titles / bad ops | `400`, board unchanged |
| Mid-apply DB error | Transaction rollback, board unchanged |
