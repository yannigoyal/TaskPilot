import os
from pathlib import Path

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "data" / "taskpilot.db"
OPENROUTER_MODEL = "openai/gpt-oss-120b"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def get_database_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", str(DEFAULT_DATABASE_PATH)))


def get_openrouter_api_key() -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    return key or None
