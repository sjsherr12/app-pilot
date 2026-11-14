"""Everything a run's tools and agents need, bundled so closures stay small."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from apppilot.config import Settings
from apppilot.models import Run
from apppilot.runs.events import RunEventBus
from apppilot.runs.store import RunStore

if TYPE_CHECKING:
    from apppilot.engine.browser import BrowserSessionManager


@dataclass
class RunContext:
    run: Run
    run_dir: Path
    store: RunStore
    bus: RunEventBus
    settings: Settings
    browser: "BrowserSessionManager"
    cumulative_cost_usd: float = 0.0
    sessions_seen: set[str] = field(default_factory=set)

    def save_run(self) -> None:
        self.store.save_run(self.run)

    def artifact_url(self, rel: str) -> str:
        return self.store.artifact_url(self.run.id, rel)

    def shot_url(self, shot_id: str) -> str:
        return self.store.shot_url(self.run.id, shot_id)
