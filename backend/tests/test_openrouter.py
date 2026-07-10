"""Unit tests for the OpenRouter client."""

from unittest.mock import MagicMock

import httpx
import pytest

from app.openrouter import MissingApiKeyError, OpenRouterError, chat_completion


def test_chat_completion_parses_response_text(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "  4  "}}],
    }

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response

    reply = chat_completion("What is 2+2?", client=mock_client)

    assert reply == "4"
    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args
    assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer test-key"
    assert call_kwargs.kwargs["json"]["model"] == "openai/gpt-oss-120b"
    assert call_kwargs.kwargs["json"]["messages"][0]["content"] == "What is 2+2?"


def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(MissingApiKeyError) as exc_info:
        chat_completion("What is 2+2?")

    assert exc_info.value.status_code == 503
    assert "OPENROUTER_API_KEY" in exc_info.value.message


def test_empty_api_key_raises(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "   ")

    with pytest.raises(MissingApiKeyError):
        chat_completion("What is 2+2?")


def test_openrouter_http_error_status(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.text = "Unauthorized"
    mock_response.reason_phrase = "Unauthorized"

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response

    with pytest.raises(OpenRouterError) as exc_info:
        chat_completion("hi", client=mock_client)

    assert "401" in exc_info.value.message


def test_openrouter_malformed_response(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"choices": []}

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response

    with pytest.raises(OpenRouterError, match="missing message content"):
        chat_completion("hi", client=mock_client)


def test_openrouter_network_error(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mock_client = MagicMock()
    mock_client.post.side_effect = httpx.ConnectError("connection refused")

    with pytest.raises(OpenRouterError, match="request failed"):
        chat_completion("hi", client=mock_client)
