"""REST + SSE routes. Shapes match the dashboard contract exactly."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from apppilot.config import settings
from apppilot.engine.testrunner import run_playwright_spec
from apppilot.models import RunCreate, now_iso
from apppilot.pr_export import ExportError, export_test_to_pr
from apppilot.runs.events import RunEventBus, replay_events
from apppilot.runs.manager import RunManager
from apppilot.runs.store import RunStore

log = logging.getLogger(__name__)
router = APIRouter()
store = RunStore(settings.runs_dir)
manager = RunManager(store, settings)
# Buses for runs that are no longer executing, so late events (test re-runs, PR exports) still reach open
# dashboards and land in events.jsonl with the right seq. One per run; the live bus wins while it is open.
_late_buses: dict[str, RunEventBus] = {}
_export_lock = asyncio.Lock()


def _run_or_404(run_id: str):
    run = store.load_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return run


def _bus_for(run_id: str) -> RunEventBus:
    bus = manager.bus_for(run_id)
    if bus is not None and not bus.closed:
        return bus
    path = store.run_dir(run_id) / "events.jsonl"
    late = _late_buses.get(run_id)
    if late is None or late.path != path:
        late = _late_buses[run_id] = RunEventBus(path)
    return late


@router.get("/runs")
async def list_runs() -> dict[str, Any]:
    return {"runs": [r.public() for r in store.list_runs()]}


@router.post("/runs", status_code=201)
async def create_run(req: RunCreate) -> dict[str, Any]:
    run = manager.create(req)
    await manager.start(run)
    return run.public()


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    run = _run_or_404(run_id)
    return {
        "run": run.public(),
        "findings": [f.model_dump() for f in store.list_findings(run_id)],
        "tests": [t.model_dump() for t in store.list_tests(run_id)],
    }


@router.post("/runs/{run_id}/stop")
async def stop_run(run_id: str) -> dict[str, Any]:
    _run_or_404(run_id)
    run = await manager.stop(run_id)
    return run.public() if run else {}


@router.get("/runs/{run_id}/events")
async def run_events(run_id: str, request: Request, after: int = 0):
    run = _run_or_404(run_id)
    last = request.headers.get("last-event-id")
    if last and last.isdigit():
        after = max(after, int(last))
    path = store.run_dir(run.id) / "events.jsonl"

    async def gen():
        cursor = after
        bus = _bus_for(run.id)
        queue = bus.subscribe()
        try:
            for ev in replay_events(path, cursor):
                cursor = ev.seq
                yield {"id": str(ev.seq), "event": "message", "data": ev.model_dump_json()}
            # Live run: stream until the bus closes. Finished run: the late bus never closes, so this also keeps
            # the connection open (server pings) and delivers re-run results and PR exports as they happen.
            while True:
                ev = await queue.get()
                if ev is None:
                    break
                if ev.seq <= cursor:
                    continue
                cursor = ev.seq
                yield {"id": str(ev.seq), "event": "message", "data": ev.model_dump_json()}
            # The run just finished: keep the connection open so EventSource does not loop on reconnects.
            while True:
                await asyncio.sleep(3600)
        finally:
            bus.unsubscribe(queue)

    return EventSourceResponse(gen(), ping=15)


@router.post("/tests/{test_id}/run")
async def rerun_test(test_id: str) -> dict[str, Any]:
    test = store.find_test(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="test not found")
    run = _run_or_404(test.run_id)
    result = await run_playwright_spec(settings, run.app_url, test, store.run_dir(run.id))
    test.last_result = result
    store.save_test(test)
    _bus_for(run.id).emit("test.result", {"test": test.model_dump()}, agent="system")
    return test.model_dump()


@router.post("/tests/{test_id}/export")
async def export_test(test_id: str) -> dict[str, Any]:
    """Push the generated spec to branch apppilot/<finding>-<run short id> and open a GitHub pull request.

    Returns {branch, pr_url | null, commit, files, message, test}. 400 when the repo has no `origin` remote or
    no commits; 502/504 when git or gh fail or hang. The user's working tree and current branch are not touched.
    """
    test = store.find_test(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="test not found")
    run = _run_or_404(test.run_id)
    finding = store.load_finding(run.id, test.finding_id)
    async with _export_lock:  # one export at a time: they share the repo's refs and worktree list
        try:
            result = await export_test_to_pr(
                repo_root=settings.repo_root,
                regression_tests_dir=settings.regression_tests_dir,
                test=test,
                finding=finding,
                run=run,
            )
        except ExportError as e:
            raise HTTPException(status_code=e.status, detail=e.detail) from e
    test = store.find_test(test_id) or test  # a re-run may have saved a new result meanwhile
    test.branch = result.branch
    test.pr_url = result.pr_url or test.pr_url
    test.exported_at = now_iso()
    store.save_test(test)
    _bus_for(run.id).emit(
        "test.exported",
        {"test": test.model_dump(), "branch": result.branch, "pr_url": test.pr_url, "commit": result.commit, "message": result.message},
        agent="system",
    )
    return {**result.as_dict(), "pr_url": test.pr_url, "test": test.model_dump()}
