"""Structured findings ledger exposed as tools. Findings are data, never free-form files."""

from __future__ import annotations

import json

from langchain.tools import tool

from apppilot.engine.scope import current_session
from apppilot.models import AttemptOutcome, Finding, FindingStatus, Severity, VerificationAttempt, now_iso
from apppilot.runs.context import RunContext

_AGENT_FOR_SESSION = {"explore": "explorer", "verify": "verifier"}


def agent_for_session(session_id: str) -> str:
    for prefix, agent in _AGENT_FOR_SESSION.items():
        if session_id.startswith(prefix):
            return agent
    return "system"


def _finding_brief(f: Finding) -> str:
    return (
        f"{f.id} [{f.status}] ({f.severity}) {f.title}\n"
        f"  feature: {f.feature}\n  expected: {f.expected}\n  actual: {f.actual}\n"
        f"  repro: " + " -> ".join(f.repro_steps) + f"\n  evidence shots: {', '.join(f.evidence_shots) or 'none'}"
        + (f"\n  attempts: {len(f.verification_attempts)}" if f.verification_attempts else "")
        + (f"\n  session_ref: {f.session_ref}" if f.session_ref else "")
        + (f"\n  test_id: {f.test_id}" if f.test_id else "")
    )


def make_shared_tools(ctx: RunContext) -> list:
    @tool
    async def get_run_context() -> str:
        """Return the run's configuration: target app URL, test credentials, whether a server reset hook exists,
        a ready-to-paste Playwright setup snippet for isolated tests, and the product notes."""
        run = ctx.run
        creds = (
            f"username: {run.credentials.username}\npassword: {run.credentials.password}"
            if run.credentials
            else "none provided (register a new account if the app supports it)"
        )
        hook = run.reset_hook
        snippet = (
            'import { test, expect } from "@playwright/test";\n\n'
            'const APP_URL = process.env.APP_URL ?? "' + run.app_url + '";\n'
            "const tenant = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;\n\n"
            "test.beforeEach(async ({ context, request }) => {\n"
            f'  await context.addCookies([{{ name: "{hook.tenant_cookie}", value: tenant, url: APP_URL }}]);\n'
            "  await request.post(`" + hook.reset_url_template.replace("{app_url}", "${APP_URL}").replace("{tenant}", "${tenant}") + "`);\n"
            "});\n"
        )
        return (
            f"Target app URL: {run.app_url}\n"
            f"Objective: {run.objective}\n"
            f"Test credentials:\n{creds}\n"
            f"Reset hook: POST {hook.reset_url_template} with tenant cookie '{hook.tenant_cookie}' "
            "(every fresh browser session gets its own tenant, so state never leaks between sessions)\n\n"
            f"Playwright isolation snippet for generated tests:\n```ts\n{snippet}```\n\n"
            f"Product notes:\n{run.product_notes or '(none provided)'}"
        )

    @tool
    async def read_product_notes() -> str:
        """Read the product documentation supplied for this run. Expected behavior must be grounded here when possible."""
        return ctx.run.product_notes or "(no product notes were provided for this run)"

    @tool
    async def list_findings() -> str:
        """List every finding recorded in this run with its current status."""
        items = ctx.store.list_findings(ctx.run.id)
        if not items:
            return "No findings recorded yet."
        return "\n\n".join(_finding_brief(f) for f in items)

    @tool
    async def get_finding(finding_id: str) -> str:
        """Return the full JSON record of one finding (expected/actual, repro steps, evidence, attempts, session_ref)."""
        f = ctx.store.load_finding(ctx.run.id, finding_id.strip())
        if not f:
            return f"ERROR: no finding {finding_id}"
        return json.dumps(f.model_dump(), indent=2)

    return [get_run_context, read_product_notes, list_findings, get_finding]


def make_record_candidate_finding(ctx: RunContext, session_id: str = "explore"):
    @tool
    async def record_candidate_finding(
        title: str,
        severity: Severity,
        feature: str,
        expected: str,
        actual: str,
        repro_steps: list[str],
        evidence_shot_ids: list[str] | None = None,
    ) -> str:
        """Record a suspected bug as a CANDIDATE finding for independent verification. Only call this when the
        observed behavior contradicts documented behavior, an explicit UI contract (e.g. a "Saved" message implies
        persistence; a subtotal implies correct arithmetic), or a programmatic signal (404, console error, failed
        request). repro_steps must be exact, numbered-free imperative steps starting from a clean state, e.g.
        'Go to /', 'Click button "Add Widget to cart"', 'Click link "Cart (1)"'. evidence_shot_ids are the
        Screenshot ids printed at the end of snapshots."""
        fid = ctx.store.next_finding_id(ctx.run.id)
        shots = [s.strip() for s in (evidence_shot_ids or []) if s.strip()]
        sid = current_session.get() or session_id
        session = ctx.browser.sessions.get(sid)
        finding = Finding(
            id=fid,
            run_id=ctx.run.id,
            title=title.strip(),
            severity=severity,
            feature=feature.strip(),
            expected=expected.strip(),
            actual=actual.strip(),
            repro_steps=[s.strip() for s in repro_steps if s.strip()],
            evidence_shots=shots,
            evidence_urls=[ctx.shot_url(s) for s in shots],
            status="candidate",
            session_ref=session.ref if session else None,
        )
        ctx.store.save_finding(finding)
        ctx.bus.emit("finding.created", {"finding": finding.model_dump()}, agent=agent_for_session(sid), session=sid)
        return f"Recorded {fid} as a candidate finding. The supervisor will delegate independent verification."

    return record_candidate_finding


def make_update_finding(ctx: RunContext, agent: str, session_id: str | None = "verify"):
    @tool
    async def update_finding(
        finding_id: str,
        status: FindingStatus | None = None,
        attempt_outcome: AttemptOutcome | None = None,
        attempt_notes: str = "",
        attempt_shot_ids: list[str] | None = None,
        title: str | None = None,
        severity: Severity | None = None,
        expected: str | None = None,
        actual: str | None = None,
        repro_steps: list[str] | None = None,
        root_cause: str | None = None,
    ) -> str:
        """Update a finding. Verifiers: record each reproduction attempt (attempt_outcome + attempt_notes +
        attempt_shot_ids) and set the final status: confirmed (reproduced AND expected behavior is well grounded),
        potential (evidence suggests a defect but confirmation is incomplete), flaky (reproduced intermittently),
        env_failure (the test harness or environment caused it), inconclusive. You may also tighten title, expected,
        actual, severity, and repro_steps to the exact wording that reproduced."""
        f = ctx.store.load_finding(ctx.run.id, finding_id.strip())
        if not f:
            return f"ERROR: no finding {finding_id}"
        if attempt_outcome:
            shots = [s.strip() for s in (attempt_shot_ids or []) if s.strip()]
            f.verification_attempts.append(
                VerificationAttempt(
                    attempt=len(f.verification_attempts) + 1,
                    outcome=attempt_outcome,
                    notes=attempt_notes.strip(),
                    shot_ids=shots,
                    shot_urls=[ctx.shot_url(s) for s in shots],
                )
            )
            for s in shots:
                if s not in f.evidence_shots:
                    f.evidence_shots.append(s)
                    f.evidence_urls.append(ctx.shot_url(s))
            sid = current_session.get() or session_id
            if sid:
                session = ctx.browser.sessions.get(sid)
                if session:
                    f.session_ref = session.ref
        if status:
            f.status = status
        if title:
            f.title = title.strip()
        if severity:
            f.severity = severity
        if expected:
            f.expected = expected.strip()
        if actual:
            f.actual = actual.strip()
        if repro_steps:
            f.repro_steps = [s.strip() for s in repro_steps if s.strip()]
        if root_cause:
            f.root_cause = root_cause.strip()
        f.updated_at = now_iso()
        ctx.store.save_finding(f)
        ctx.bus.emit("finding.updated", {"finding": f.model_dump()}, agent=agent, session=current_session.get() or session_id)
        return f"Updated {f.id}: status={f.status}, attempts={len(f.verification_attempts)}."

    return update_finding


def make_finalize_run(ctx: RunContext):
    @tool
    async def finalize_run(report_markdown: str) -> str:
        """Save the final QA report (markdown) for this run. Call exactly once, at the very end."""
        ctx.run.report_md = report_markdown
        ctx.save_run()
        ctx.bus.emit("report.final", {"report_md": report_markdown}, agent="supervisor")
        return "Report saved. You are done."

    return finalize_run
