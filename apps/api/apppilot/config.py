"""Environment, budgets, model factory, and the price table."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]  # apps/api/apppilot/config.py -> repo root
load_dotenv(REPO_ROOT / ".env")
load_dotenv()  # also honor a .env in the current directory


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _path(raw: str) -> Path:
    p = Path(raw).expanduser()
    return p if p.is_absolute() else (REPO_ROOT / p).resolve()


class Settings:
    repo_root: Path = REPO_ROOT
    data_dir: Path = _path(os.getenv("DATA_DIR", "data"))
    regression_tests_dir: Path = REPO_ROOT / "packages" / "regression-tests"
    default_app_url: str = os.getenv("APP_URL", "http://localhost:3001")
    headless: bool = _bool("APPPILOT_HEADLESS", True)
    max_actions_per_session: int = int(os.getenv("APPPILOT_MAX_ACTIONS", "150"))
    run_timeout_s: int = int(os.getenv("APPPILOT_RUN_TIMEOUT_S", "2400"))
    recursion_limit: int = int(os.getenv("APPPILOT_RECURSION_LIMIT", "500"))
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("APPPILOT_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    ]

    @property
    def runs_dir(self) -> Path:
        return self.data_dir / "runs"


settings = Settings()

# USD per million tokens: (input, output). Cache reads are billed at 10% of input, cache writes at 125%.
PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
}

ROLES = ("supervisor", "explorer", "verifier", "test_writer")


def model_name(role: str) -> str:
    return os.getenv(f"APPPILOT_{role.upper()}_MODEL") or os.getenv("APPPILOT_MODEL", "claude-opus-5-5")


def effort(role: str) -> str:
    if role == "supervisor":
        return os.getenv("APPPILOT_SUPERVISOR_EFFORT", "high")
    return os.getenv(f"APPPILOT_{role.upper()}_EFFORT") or os.getenv("APPPILOT_WORKER_EFFORT", "medium")


def make_model(role: str):
    """ChatAnthropic for a role. Opus 5.5 always thinks (adaptive); depth is controlled by `effort`."""
    from langchain_anthropic import ChatAnthropic

    return ChatAnthropic(
        model=model_name(role),
        max_tokens=16000,
        thinking={"type": "adaptive"},
        effort=effort(role),
        timeout=180,
        max_retries=3,
    )


def estimate_cost(model: str, input_tokens: int, output_tokens: int, cache_read: int = 0, cache_write: int = 0) -> float:
    key = next((k for k in PRICES_PER_MTOK if model.startswith(k)), None)
    if key is None:
        return 0.0
    inp, out = PRICES_PER_MTOK[key]
    uncached = max(input_tokens - cache_read - cache_write, 0)
    return (uncached * inp + cache_read * inp * 0.10 + cache_write * inp * 1.25 + output_tokens * out) / 1_000_000
