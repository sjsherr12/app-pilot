"""Per-invocation browser session scoping.

The supervisor may run several subagents at once. Each `task` call is wrapped by middleware that sets
`current_session` (e.g. "explore-2") for the duration of the call; browser and findings tools read it, so
every subagent invocation gets its own isolated browser session without any change to tool signatures.
"""

from __future__ import annotations

from contextvars import ContextVar

current_session: ContextVar[str | None] = ContextVar("apppilot_current_session", default=None)

SESSION_PREFIX = {"explorer": "explore", "verifier": "verify", "test_writer": "test", "test-writer": "test"}


def session_prefix_for(subagent_type: str) -> str:
    key = str(subagent_type or "task").strip().lower()
    return SESSION_PREFIX.get(key, key.replace("_", "-"))
