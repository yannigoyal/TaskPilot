import pytest
from fastapi.testclient import TestClient

from app.main import app

AUTH_HEADERS = {"X-User": "user"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    database_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers():
    return AUTH_HEADERS.copy()
