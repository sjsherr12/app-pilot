import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

FIXTURES = Path(__file__).parent / "fixtures"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def mini_app_url():
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(FIXTURES)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            httpx.get(url + "/mini_app.html", timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    yield url
    proc.terminate()
    proc.wait(timeout=5)
