import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.ai_schemas import ChatRequest, ChatResponse
from app.chat import AiParseError, AiValidationError, run_chat
from app.database import BoardError, NotFoundError, get_user_id
from app.deps import require_known_user
from app.openrouter import MissingApiKeyError, OpenRouterError

router = APIRouter(prefix="/api", tags=["chat"])


def get_db_connection() -> sqlite3.Connection:
    from app.main import db_connection

    return db_connection


@router.post("/chat", response_model=ChatResponse, response_model_exclude_none=True)
def post_chat(
    payload: ChatRequest,
    username: Annotated[str, Depends(require_known_user)],
    connection: Annotated[sqlite3.Connection, Depends(get_db_connection)],
) -> ChatResponse:
    if get_user_id(connection, username) is None:
        raise HTTPException(status_code=401, detail="Unknown user")

    try:
        return run_chat(connection, username, payload.message, payload.history)
    except MissingApiKeyError as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    except AiValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    except AiParseError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except BoardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
