"""Per-run event bus: append-only events.jsonl plus live fan-out to SSE subscribers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from apppilot.models import Event, now_iso


class RunEventBus:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._seq = 0
        if self.path.exists():
            with self.path.open() as f:
                for line in f:
                    if line.strip():
                        self._seq += 1
        self._subs: set[asyncio.Queue] = set()
        self.closed = False

    def emit(
        self,
        type: str,
        payload: dict[str, Any] | None = None,
        *,
        agent: str | None = None,
        session: str | None = None,
    ) -> Event:
        self._seq += 1
        ev = Event(seq=self._seq, ts=now_iso(), type=type, agent=agent, session=session, payload=payload or {})
        with self.path.open("a") as f:
            f.write(ev.model_dump_json() + "\n")
        for q in list(self._subs):
            q.put_nowait(ev)
        return ev

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def replay(self, after: int = 0) -> list[Event]:
        return replay_events(self.path, after)

    def close(self) -> None:
        self.closed = True
        for q in list(self._subs):
            q.put_nowait(None)


def replay_events(path: Path, after: int = 0) -> list[Event]:
    out: list[Event] = []
    if not path.exists():
        return out
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = Event.model_validate(json.loads(line))
            except Exception:
                continue
            if ev.seq > after:
                out.append(ev)
    return out
