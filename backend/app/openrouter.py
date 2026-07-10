"""OpenRouter chat completions client (httpx)."""

from __future__ import annotations

import httpx

from app.config import OPENROUTER_BASE_URL, OPENROUTER_MODEL, get_openrouter_api_key


class OpenRouterError(Exception):
    """Raised when OpenRouter is misconfigured or the request fails."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class MissingApiKeyError(OpenRouterError):
    def __init__(self) -> None:
        super().__init__("OPENROUTER_API_KEY is not configured", status_code=503)


def chat_completion(
    prompt: str,
    *,
    api_key: str | None = None,
    model: str = OPENROUTER_MODEL,
    timeout: float = 60.0,
    client: httpx.Client | None = None,
) -> str:
    """Send a single user prompt and return the assistant message text."""
    return chat_completion_messages(
        [{"role": "user", "content": prompt}],
        api_key=api_key,
        model=model,
        timeout=timeout,
        client=client,
    )


def chat_completion_messages(
    messages: list[dict[str, str]],
    *,
    api_key: str | None = None,
    model: str = OPENROUTER_MODEL,
    timeout: float = 60.0,
    client: httpx.Client | None = None,
) -> str:
    """Send a chat message list and return the assistant message text."""
    key = api_key if api_key is not None else get_openrouter_api_key()
    if not key:
        raise MissingApiKeyError()

    payload = {
        "model": model,
        "messages": messages,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    owns_client = client is None
    http_client = client or httpx.Client(timeout=timeout)
    try:
        response = http_client.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
    except httpx.HTTPError as exc:
        raise OpenRouterError(f"OpenRouter request failed: {exc}") from exc
    finally:
        if owns_client:
            http_client.close()

    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise OpenRouterError(
            f"OpenRouter returned {response.status_code}: {detail}",
            status_code=response.status_code,
        )

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise OpenRouterError("OpenRouter response missing message content") from exc

    if not isinstance(content, str) or not content.strip():
        raise OpenRouterError("OpenRouter response missing message content")

    return content.strip()
