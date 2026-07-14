from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from app.config import get_database_path
from app.database import connect, init_db
from app.routes.ai import router as ai_router
from app.routes.board import router as board_router
from app.routes.chat import router as chat_router

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure the database file, schema, and seed exist before serving.
    # Each request opens its OWN connection (app.deps.get_db_connection),
    # so concurrent requests never share connection/transaction state.
    connection = connect(get_database_path())
    init_db(connection)
    connection.close()
    yield


app = FastAPI(title="TaskPilot", lifespan=lifespan)

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(board_router)
app.include_router(ai_router)
app.include_router(chat_router)

if STATIC_DIR.is_dir():
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="static")
else:

    @app.get("/")
    def index_missing() -> dict[str, str]:
        return {
            "error": "Frontend static files not found. Build the frontend export into backend/static."
        }
