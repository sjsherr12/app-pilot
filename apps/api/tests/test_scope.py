"""The task-scoping middleware must give concurrent subagent invocations distinct, isolated session ids."""

import asyncio
from types import SimpleNamespace

from apppilot.agents.build import make_session_scope_middleware
from apppilot.engine.scope import current_session


async def test_concurrent_task_calls_get_distinct_sessions():
    mw = make_session_scope_middleware()
    seen: list[str | None] = []

    async def handler(request):
        await asyncio.sleep(0.01)
        seen.append(current_session.get())
        return "ok"

    def req(sub):
        return SimpleNamespace(tool_call={"name": "task", "args": {"subagent_type": sub}, "id": "x"})

    await asyncio.gather(
        mw.awrap_tool_call(req("explorer"), handler),
        mw.awrap_tool_call(req("explorer"), handler),
        mw.awrap_tool_call(req("verifier"), handler),
    )
    assert sorted(s for s in seen if s) == ["explore-1", "explore-2", "verify-1"]
    assert current_session.get() is None  # reset after the call

    other = SimpleNamespace(tool_call={"name": "write_todos", "args": {}, "id": "y"})
    await mw.awrap_tool_call(other, handler)
    assert seen[-1] is None
