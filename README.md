# TaskPilot

TaskPilot is an educational project management application built around a single Kanban board. The goal is a full-stack app with sign-in, persistent boards, and an AI assistant — developed incrementally in phases.

## Current Status

The repository contains a working **frontend-only** demo. Board state lives in browser memory and resets on page reload. There is no backend, database, authentication, or AI integration yet.

## Implemented Features

- Single Kanban board with five columns (Backlog, Discovery, In Progress, Review, Done)
- Rename columns inline
- Drag and drop cards between columns and within a column
- Add and delete cards with title and details
- Responsive UI using the TaskPilot color scheme

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Drag and drop | @dnd-kit |
| Unit tests | Vitest, Testing Library |
| E2E tests | Playwright |

**Planned (not implemented):** Python FastAPI backend, SQLite, Docker, OpenRouter AI, platform start/stop scripts.

## Project Structure

```
├── AGENTS.md          # Project requirements and technical direction
├── docs/PLAN.md       # Phased implementation roadmap
├── frontend/          # Next.js app (implemented)
├── backend/           # FastAPI backend (planned)
└── scripts/           # Start/stop scripts (planned)
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

From the `frontend/` directory:

```bash
npm run lint
npm run test:unit
npm run build
npm run test:e2e
```

Run all unit and E2E tests with `npm run test:all`.

## Future Roadmap

Development follows the ten-part plan in [docs/PLAN.md](docs/PLAN.md):

1. Finalize planning documentation
2. Docker and FastAPI scaffolding
3. Serve the built frontend from the backend
4. Sign-in with dummy credentials
5. Database schema design
6. Backend Kanban API
7. Frontend wired to the backend
8. OpenRouter AI connectivity
9. AI-driven board updates via structured outputs
10. AI chat sidebar in the UI
