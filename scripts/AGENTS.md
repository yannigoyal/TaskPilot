# TaskPilot Scripts

Docker Compose wrappers to start and stop the local stack.

## Commands

From repo root:

```bash
./scripts/start   # docker compose up --build -d
./scripts/stop    # docker compose down
```

App URL: http://localhost:8000

Verify: open `/` for the Kanban board, or `curl http://localhost:8000/api/health`.

Requires Docker and Docker Compose.

SQLite is stored in a Docker named volume (`taskpilot_data`), so the stack works even when the project lives on an external drive. Reset data with `docker compose down -v`.
