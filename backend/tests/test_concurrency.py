"""Regression tests for the shared SQLite connection bug (docs/code_review.md A1).

The backend must open a dedicated connection per request. A single
connection shared across all requests raised
``sqlite3.InterfaceError: bad parameter or other API misuse``
under concurrent load, produced spurious 401/404 responses, and dropped
writes. These tests lock in the fix.
"""

import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _free_port() -> int:
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture
def running_server(tmp_path, monkeypatch):
    """Start the real app (single uvicorn worker, like the Docker image)
    and yield its base URL. Shut it down on teardown.
    """
    from app.database import connect, init_db

    db_path = tmp_path / "concurrency.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    # Make sure the schema + seed exist before the server starts.
    conn = connect(db_path)
    init_db(conn)
    conn.close()

    port = _free_port()
    proc = subprocess.Popen(
        ["uv", "run", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=BACKEND_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"

    deadline = time.time() + 60
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("uvicorn exited before becoming ready")
        try:
            if httpx.get(f"{base}/api/health", timeout=1).status_code == 200:
                break
        except httpx.TransportError:
            time.sleep(0.2)
    else:
        proc.kill()
        raise RuntimeError("server did not become ready in time")

    try:
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def test_connection_dependency_yields_distinct_connections():
    """Each request must get its OWN connection object, never a shared
    global. This is the core property that prevents A1.
    """
    from app.deps import get_db_connection

    gen_a = get_db_connection()
    conn_a = next(gen_a)
    gen_b = get_db_connection()
    conn_b = next(gen_b)
    try:
        assert conn_a is not conn_b, "connections are shared (A1 regression)"
        assert conn_a.execute("SELECT 1").fetchone()[0] == 1
        assert conn_b.execute("SELECT 1").fetchone()[0] == 1
    finally:
        gen_a.close()
        gen_b.close()


def test_concurrent_card_creates_all_succeed(running_server):
    """Firing many concurrent card creates must not error, drop writes,
    or corrupt the board. Reproduces the original A1 failure mode.
    """
    headers = {"X-User": "user"}
    n = 60

    def create(i: int) -> int:
        resp = httpx.post(
            f"{running_server}/api/cards",
            headers=headers,
            json={"column_id": "col-backlog", "title": f"conc-{i}", "details": "x"},
            timeout=30,
        )
        return resp.status_code

    with ThreadPoolExecutor(max_workers=n) as pool:
        codes = list(pool.map(create, range(n)))

    assert codes.count(201) == n, (
        f"expected all {n} creates to succeed, got statuses {sorted(set(codes))}"
    )

    board = httpx.get(f"{running_server}/api/board", headers=headers).json()

    referenced = [cid for col in board["columns"] for cid in col["cardIds"]]
    assert len(referenced) == len(set(referenced)), "duplicate card references"

    created = [c for c in board["cards"].values() if c["title"].startswith("conc-")]
    assert len(created) == n, f"expected {n} created cards, got {len(created)}"


def test_concurrent_moves_do_not_corrupt(running_server):
    """Concurrent moves of different cards must not produce duplicate or
    missing references.
    """
    headers = {"X-User": "user"}

    board = httpx.get(f"{running_server}/api/board", headers=headers).json()
    card_ids = list(board["cards"].keys())
    n = len(card_ids)

    def move(card_id: str) -> int:
        resp = httpx.post(
            f"{running_server}/api/cards/{card_id}/move",
            headers=headers,
            json={"column_id": "col-progress", "position": 0},
            timeout=30,
        )
        return resp.status_code

    with ThreadPoolExecutor(max_workers=n) as pool:
        codes = list(pool.map(move, card_ids))

    assert codes.count(200) == n, (
        f"expected all {n} moves to succeed, got statuses {sorted(set(codes))}"
    )

    board = httpx.get(f"{running_server}/api/board", headers=headers).json()
    referenced = [cid for col in board["columns"] for cid in col["cardIds"]]
    assert len(referenced) == len(set(referenced)), "duplicate card references after moves"
    assert len(referenced) == n, "cards lost/missing after concurrent moves"
