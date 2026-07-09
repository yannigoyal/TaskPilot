import os
from pathlib import Path

DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent.parent / "data" / "taskpilot.db"


def get_database_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", str(DEFAULT_DATABASE_PATH)))
