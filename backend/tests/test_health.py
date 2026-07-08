from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import STATIC_DIR, app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.skipif(
    not (STATIC_DIR / "index.html").is_file(),
    reason="Frontend static export not built into backend/static",
)
def test_index_returns_login_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "TaskPilot" in response.text
    assert 'data-testid="login-form"' in response.text
    assert 'data-testid="column-col-backlog"' not in response.text
