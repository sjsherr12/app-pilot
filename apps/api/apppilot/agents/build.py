"""Builds the DeepAgents graph for a run: supervisor plus explorer / verifier / test_writer subagents."""

from __future__ import annotations

import itertools
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langchain.agents.middleware import TodoListMiddleware, wrap_tool_call

from apppilot.agents.findings_tools import (
    make_finalize_run,
    make_record_candidate_finding,
    make_shared_tools,
    make_update_finding,
)
from apppilot.agents.test_tools import make_test_tools
from apppilot.config import make_model
from apppilot.engine.scope import current_session, session_prefix_for
from apppilot.engine.tools import make_browser_tools
from apppilot.runs.context import RunContext

PROMPTS = Path(__file__).parent / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text()


def make_session_scope_middleware(browser=None):
    """Gives every `task` invocation its own browser session id ("explore-1", "verify-3", ...) and closes that
    session in the background once the task returns, so video/trace evidence is finalized during the run."""
    counters: dict[str, itertools.count] = {}

    @wrap_tool_call(name="SessionScopeMiddleware")
    async def session_scope(request, handler):
        tool_call = getattr(request, "tool_call", None) or {}
        if tool_call.get("name") != "task":
            return await handler(request)
        prefix = session_prefix_for((tool_call.get("args") or {}).get("subagent_type", "task"))
        n = next(counters.setdefault(prefix, itertools.count(1)))
        session_id = f"{prefix}-{n}"
        token = current_session.set(session_id)
        try:
            return await handler(request)
        finally:
            current_session.reset(token)
            if browser is not None:
                browser.close_session_in_background(session_id)

    return session_scope


def build_agent(ctx: RunContext):
    shared = make_shared_tools(ctx)
    explorer_tools = make_browser_tools(ctx, "explore") + shared + [make_record_candidate_finding(ctx, "explore")]
    verifier_tools = make_browser_tools(ctx, "verify") + shared + [make_update_finding(ctx, agent="verifier", session_id="verify")]
    test_writer_tools = shared + make_test_tools(ctx)
    supervisor_tools = shared + [make_update_finding(ctx, agent="supervisor", session_id=None), make_finalize_run(ctx)]

    subagents = [
        {
            "name": "explorer",
            "description": (
                "Drives a browser to map the app or to exercise ONE feature area with happy-path and edge-case "
                "scenarios, and records CANDIDATE findings with exact repro steps and screenshot ids."
            ),
            "system_prompt": load_prompt("explorer"),
            "tools": explorer_tools,
            "model": make_model("explorer"),
        },
        {
            "name": "verifier",
            "description": (
                "Independently reproduces ONE candidate finding (pass its id) in a fresh browser context against a "
                "reset environment and classifies it as confirmed / potential / flaky / env_failure / inconclusive."
            ),
            "system_prompt": load_prompt("verifier"),
            "tools": verifier_tools,
            "model": make_model("verifier"),
        },
        {
            "name": "test_writer",
            "description": (
                "Writes a standard @playwright/test regression spec for ONE confirmed finding (pass its id), runs it, "
                "and iterates until it fails on an expect() assertion that states the bug."
            ),
            "system_prompt": load_prompt("test_writer"),
            "tools": test_writer_tools,
            "model": make_model("test_writer"),
        },
    ]

    workspace = ctx.run_dir / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    backend = CompositeBackend(
        default=StateBackend(),
        routes={"/workspace/": FilesystemBackend(root_dir=str(workspace.resolve()), virtual_mode=True)},
    )
    return create_deep_agent(
        model=make_model("supervisor"),
        tools=supervisor_tools,
        system_prompt=load_prompt("supervisor"),
        middleware=[TodoListMiddleware(), make_session_scope_middleware(ctx.browser)],
        backend=backend,
        subagents=subagents,
        name="apppilot-supervisor",
    )


def build_initial_message(ctx: RunContext) -> str:
    run = ctx.run
    creds = "provided (call get_run_context)" if run.credentials else "none"
    notes = "provided (call get_run_context or read_product_notes)" if run.product_notes else "none"
    return (
        f"Objective: {run.objective}\n"
        f"Target app URL: {run.app_url}\n"
        f"Test credentials: {creds}\n"
        f"Product notes: {notes}\n"
        f"Budget: about {ctx.settings.run_timeout_s // 60} minutes total; each browser session has "
        f"{ctx.settings.max_actions_per_session} actions.\n\n"
        "Run the full workflow: recon, plan, explore, verify every candidate, write a regression test for every "
        "confirmed finding, then finalize_run with the report."
    )
