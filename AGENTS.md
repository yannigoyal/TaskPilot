# TaskPilot

## Business Requirements

TaskPilot is a project management web app. Key features:
- A user can sign in
- When signed in, the user sees a Kanban board representing their project
- The Kanban board has fixed columns that can be renamed
- The cards on the Kanban board can be moved with drag and drop, and edited
- There is an AI chat feature in a sidebar; the AI is able to create / edit / move one or more cards

## Current state (Parts 1–7 complete)

- **Stack:** Next.js static export + FastAPI + SQLite in a single Docker container
- **Auth:** Fake login (`user` / `password`); API calls use `X-User: user` header
- **Board:** Persistent in SQLite; all CRUD via `/api/*` (see `docs/API.md`)
- **Not built yet:** AI chat sidebar and OpenRouter integration (Parts 8–10)

Run locally: `./scripts/start` from repo root → http://localhost:8000

## Limitations

For the MVP, there will only be a user sign in (hardcoded to 'user' and 'password') but the database will support multiple users for future.

For the MVP, there will only be 1 Kanban board per signed in user.

For the MVP, this will run locally (in a docker container)

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in `.env` in the project root (Part 8+)
- Use `openai/gpt-oss-120b` as the model
- Use SQLite local database, creating a new db if it doesn't exist
- Docker SQLite persistence via named volume `taskpilot_data` (see `docker-compose.yml`)
- Start and stop scripts in `scripts/` (Docker Compose wrappers)
- Board schema and API contract: `docs/DATABASE.md`, `docs/API.md`

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

All documents for planning and executing this project will be in the `docs/` directory.

| Document | When to read |
| -------- | ------------ |
| `docs/PLAN.md` | Part order, checklists, progress — **read before starting work** |
| `docs/DATABASE.md` | SQLite schema, seed data, DB paths |
| `docs/API.md` | REST endpoints, `BoardData` contract |
| `frontend/AGENTS.md` | Frontend architecture, API client, DnD, tests |
| `backend/AGENTS.md` | Backend layout, run/test commands |
