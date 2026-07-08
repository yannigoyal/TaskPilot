from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

app = FastAPI(title="TaskPilot")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/")
    def index_missing() -> dict[str, str]:
        return {
            "error": "Frontend static files not found. Build the frontend export into backend/static."
        }
