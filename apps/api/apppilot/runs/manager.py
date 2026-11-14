"""RunManager: creates run contexts, executes the agent graph with budgets, finalizes artifacts."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage

from apppilot.agents.callbacks import AgentTraceCallback
from apppilot.agents.findings_tools import agent_for_session
from apppilot.config import Settings
from apppilot.engine.browser import BrowserSessionManager, Session
from apppilot.models import ActionRecord, Run, RunCreate, now_iso
from apppilot.runs.context import RunContext
from apppilot.runs.events import RunEventBus
from apppilot.runs.store import RunStore

log = logging.getLogger(__name__)


class RunManager:
    def __init__(self, store: RunStore, settings: Settings):
        self.store = store
        self.settings = settings
        self._tasks: dict[str, asyncio.Task] = {}
        self._contexts: dict[str, RunContext] = {}

    # ------------------------------------------------------------ public
    def create(self, req: RunCreate) -> Run:
        return self.store.create_run(req)

    async def start(self, run: Run) -> None:
        ctx = self._make_context(run)
        self._contexts[run.id] = ctx
        self._tasks[run.id] = asyncio.create_task(self._execute(ctx), name=f"run-{run.id}")

    def is_active(self, run_id: str) -> bool:
        return run_id in self._tasks and not self._tasks[run_id].done()

    def bus_for(self, run_id: str) -> RunEventBus | None:
        ctx = self._contexts.get(run_id)
        return ctx.bus if ctx else None

    async def stop(self, run_id: str) -> Run | None:
        task = self._tasks.get(run_id)
        ctx = self._contexts.get(run_id)
        if not task or not ctx:
            return self.store.load_run(run_id)
        if not task.done():
            ctx.run.status = "stopped"
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        return self.store.load_run(run_id)

    # ------------------------------------------------------------ wiring
    def _make_context(self, run: Run) -> RunContext:
        run_dir = self.store.run_dir(run.id)
        bus = RunEventBus(run_dir / "events.jsonl")
        holder: dict[str, Any] = {}

        async def on_action(session: Session, rec: ActionRecord) -> None:
            ctx: RunContext = holder["ctx"]
            ctx.sessions_seen.add(session.id)
            payload: dict[str, Any] = {
                "session": session.id,
                "kind": rec.kind,
                "url": rec.url_after,
                "shot_id": rec.shot_id,
                "shot_url": ctx.shot_url(rec.shot_id) if rec.shot_id else None,
            }
            if rec.ref:
                payload["target"] = {"ref": rec.ref, "role": rec.role, "name": rec.name}
            if rec.text is not None:
                text = rec.text
                if run.credentials and text == run.credentials.password:
                    text = "***"
                payload["text"] = text
            bus.emit("browser.action", payload, agent=agent_for_session(session.id), session=session.id)

        async def on_session_closed(session_ref: str, video_rel: str | None, trace_rel: str | None) -> None:
            ctx: RunContext = holder["ctx"]
            if not (video_rel or trace_rel):
                return
            for f in self.store.list_findings(run.id):
                if f.session_ref == session_ref:
                    if video_rel:
                        f.video_url = ctx.artifact_url(video_rel)
                    if trace_rel:
                        f.trace_url = ctx.artifact_url(trace_rel)
                    f.updated_at = now_iso()
                    self.store.save_finding(f)
                    bus.emit("finding.updated", {"finding": f.model_dump()}, agent="system")

        browser = BrowserSessionManager(
            run_id=run.id,
            run_dir=run_dir,
            app_url=run.app_url,
            reset_hook=run.reset_hook,
            headless=self.settings.headless,
            max_actions=self.settings.max_actions_per_session,
            on_action=on_action,
            on_session_closed=on_session_closed,
        )
        ctx = RunContext(run=run, run_dir=run_dir, store=self.store, bus=bus, settings=self.settings, browser=browser)
        holder["ctx"] = ctx
        return ctx

    # ------------------------------------------------------------ execution
    async def _execute(self, ctx: RunContext) -> None:
        from apppilot.agents.build import build_agent, build_initial_message

        run, bus = ctx.run, ctx.bus
        run.status = "running"
        run.started_at = now_iso()
        ctx.save_run()
        bus.emit("run.status", {"status": "running"}, agent="system")
        try:
            await ctx.browser.start()
            agent = build_agent(ctx)
            callback = AgentTraceCallback(ctx)
            config = {
                "recursion_limit": self.settings.recursion_limit,
                "callbacks": [callback],
                "metadata": {"run_id": run.id},
                "run_name": f"apppilot-{run.id}",
            }
            result = await asyncio.wait_for(
                agent.ainvoke({"messages": [HumanMessage(content=build_initial_message(ctx))]}, config=config),
                timeout=self.settings.run_timeout_s,
            )
            if not run.report_md:
                run.report_md = _final_text(result) or _fallback_report(ctx)
                bus.emit("report.final", {"report_md": run.report_md}, agent="supervisor")
            run.status = "completed"
        except asyncio.CancelledError:
            run.status = "stopped"
            run.error = "Stopped by user"
            if not run.report_md:
                run.report_md = _fallback_report(ctx)
                bus.emit("report.final", {"report_md": run.report_md}, agent="system")
        except TimeoutError:
            run.status = "completed"
            run.error = f"Time budget of {self.settings.run_timeout_s}s exhausted; results below are partial."
            if not run.report_md:
                run.report_md = _fallback_report(ctx)
                bus.emit("report.final", {"report_md": run.report_md}, agent="system")
        except Exception as e:
            log.exception("run %s failed", run.id)
            run.status = "failed"
            run.error = f"{type(e).__name__}: {str(e)[:1500]}"
            if not run.report_md:
                run.report_md = _fallback_report(ctx)
        finally:
            run.finished_at = now_iso()
            ctx.save_run()
            # Announce completion first; evidence (video/trace) keeps attaching to findings while sessions close.
            bus.emit("run.status", {"status": run.status, "message": run.error}, agent="system")
            try:
                await ctx.browser.close()  # closes remaining sessions in parallel -> attaches videos/traces
            except Exception:
                log.exception("browser close failed")
            ctx.save_run()
            bus.close()
            self._tasks.pop(run.id, None)


def _final_text(result: Any) -> str | None:
    messages = (result or {}).get("messages") if isinstance(result, dict) else None
    if not messages:
        return None
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str) and content.strip():
                return content
            if isinstance(content, list):
                text = "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
                if text.strip():
                    return text
    return None


def _fallback_report(ctx: RunContext) -> str:
    findings = ctx.store.list_findings(ctx.run.id)
    tests = {t.finding_id: t for t in ctx.store.list_tests(ctx.run.id)}
    lines = ["## Summary", f"Run ended with status `{ctx.run.status}`" + (f": {ctx.run.error}" if ctx.run.error else "."), "", "## Findings"]
    if not findings:
        lines.append("No findings were recorded.")
    else:
        lines.append("| id | status | severity | feature | title | regression test |")
        lines.append("|---|---|---|---|---|---|")
        for f in findings:
            t = tests.get(f.id)
            tcell = f"{t.id} ({t.last_result.status if t.last_result else 'not run'})" if t else "none"
            lines.append(f"| {f.id} | {f.status} | {f.severity} | {f.feature} | {f.title} | {tcell} |")
    lines += ["", "## Limitations", "This report was generated automatically because the supervisor did not finalize. Passing tests do not prove the absence of bugs."]
    return "\n".join(lines)
