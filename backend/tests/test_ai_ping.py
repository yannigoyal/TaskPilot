"""Tests for POST /api/ai/ping."""

from unittest.mock import patch

import pytest


def test_ai_ping_returns_reply(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    with patch("app.routes.ai.chat_completion", return_value="4") as mock_chat:
        response = client.post("/api/ai/ping")

    assert response.status_code == 200
    assert response.json() == {"reply": "4"}
    mock_chat.assert_called_once()


def test_ai_ping_missing_key_returns_503(client, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.post("/api/ai/ping")

    assert response.status_code == 503
    assert "OPENROUTER_API_KEY" in response.json()["detail"]


def test_ai_ping_does_not_require_auth(client, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    with patch("app.routes.ai.chat_completion", return_value="4"):
        response = client.post("/api/ai/ping")

    assert response.status_code == 200


@pytest.mark.live
def test_ai_ping_live_openrouter(client, monkeypatch):
    """Real OpenRouter call. Run with: uv run pytest -m live -v"""
    from pathlib import Path

    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        pytest.skip(".env not found")

    key = None
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if stripped.startswith("OPENROUTER_API_KEY="):
            key = stripped.partition("=")[2].strip().strip('"').strip("'")
            break

    if not key:
        pytest.skip("OPENROUTER_API_KEY not set in .env")

    monkeypatch.setenv("OPENROUTER_API_KEY", key)

    response = client.post("/api/ai/ping")

    assert response.status_code == 200, response.text
    reply = response.json()["reply"]
    assert "4" in reply
