from fastapi import APIRouter, HTTPException

from app.openrouter import MissingApiKeyError, OpenRouterError, chat_completion

router = APIRouter(prefix="/api/ai", tags=["ai"])

PING_PROMPT = "What is 2+2? Reply with just the number."


@router.post("/ping")
def ai_ping() -> dict[str, str]:
    """Trivial OpenRouter connectivity check. No auth required."""
    try:
        reply = chat_completion(PING_PROMPT)
    except MissingApiKeyError as exc:
        raise HTTPException(status_code=503, detail=exc.message) from exc
    except OpenRouterError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    return {"reply": reply}
