"""Builds the DeepAgents graph without calling any model: validates the deepagents API usage."""

from apppilot.agents.build import build_agent, build_initial_message
from apppilot.config import settings
from apppilot.engine.browser import BrowserSessionManager
from apppilot.models import Credentials, RunCreate
from apppilot.runs.context import RunContext
from apppilot.runs.events import RunEventBus
from apppilot.runs.store import RunStore


def test_graph_builds(tmp_path):
    store = RunStore(tmp_path / "runs")
    run = store.create_run(
        RunCreate(app_url="http://localhost:3001", objective="smoke", credentials=Credentials(username="u", password="p"))
    )
    run_dir = store.run_dir(run.id)
    browser = BrowserSessionManager(run_id=run.id, run_dir=run_dir, app_url=run.app_url)
    ctx = RunContext(run=run, run_dir=run_dir, store=store, bus=RunEventBus(run_dir / "events.jsonl"), settings=settings, browser=browser)
    graph = build_agent(ctx)
    assert graph is not None
    nodes = set(graph.get_graph().nodes)
    assert any("tools" in n for n in nodes), nodes
    msg = build_initial_message(ctx)
    assert "Objective: smoke" in msg and "provided" in msg
