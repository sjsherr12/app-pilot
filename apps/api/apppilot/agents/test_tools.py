"""Tools for the test writer: read the reproduction's action log, save a spec, run it."""

from __future__ import annotations

import json
import re

from langchain.tools import tool

from apppilot.engine.testrunner import run_playwright_spec
from apppilot.models import TestCase, now_iso
from apppilot.runs.context import RunContext


def make_test_tools(ctx: RunContext) -> list:
    tests_dir = ctx.settings.regression_tests_dir / "tests" / ctx.run.id

    @tool
    async def get_action_log(session_ref: str = "verify") -> str:
        """Return the exact browser interactions of a session as JSON lines (kind, role, accessible name, typed text,
        URL before/after). Pass the finding's session_ref (e.g. "verify-2") to get the verifier's reproduction, or
        "explore" for the latest exploration session. Use the role + name pairs for getByRole/getByLabel locators."""
        log = ctx.browser.action_log(session_ref.strip())
        if not log:
            known = ", ".join(sorted(ctx.browser.action_logs)) or "none"
            return f"ERROR: no action log for '{session_ref}'. Known sessions: {known}"
        lines = []
        for rec in log:
            d = rec.model_dump(exclude_none=True, exclude={"ts", "shot_id", "ref"})
            if ctx.run.credentials and d.get("text") == ctx.run.credentials.password:
                d["text"] = "<password from get_run_context>"
            lines.append(json.dumps(d))
        return "\n".join(lines)

    @tool
    async def save_regression_test(finding_id: str, code: str) -> str:
        """Save a @playwright/test spec for a finding. The spec must import from "@playwright/test", contain at least
        one test(), assert the EXPECTED behavior with expect(), and use relative paths like page.goto('/cart').
        Returns the test id to pass to run_regression_test. Saving again for the same finding overwrites the file."""
        fid = finding_id.strip()
        finding = ctx.store.load_finding(ctx.run.id, fid)
        if not finding:
            return f"ERROR: no finding {fid}"
        problems = []
        if "@playwright/test" not in code:
            problems.append('missing import from "@playwright/test"')
        if not re.search(r"\btest\s*\(", code):
            problems.append("no test() block")
        if "expect(" not in code:
            problems.append("no expect() assertion")
        if problems:
            return "ERROR: spec rejected: " + "; ".join(problems)
        tests_dir.mkdir(parents=True, exist_ok=True)
        path = tests_dir / f"{fid}.spec.ts"
        path.write_text(code)
        rel = str(path.relative_to(ctx.settings.regression_tests_dir))
        test_id = f"{fid}-{ctx.run.id[-6:]}"
        existing = ctx.store.load_test(ctx.run.id, test_id)
        test = TestCase(
            id=test_id,
            run_id=ctx.run.id,
            finding_id=fid,
            path=rel,
            code=code,
            last_result=None,
            created_at=existing.created_at if existing else now_iso(),
        )
        ctx.store.save_test(test)
        if finding.test_id != test_id:
            finding.test_id = test_id
            finding.updated_at = now_iso()
            ctx.store.save_finding(finding)
            ctx.bus.emit("finding.updated", {"finding": finding.model_dump()}, agent="test_writer")
        ctx.bus.emit("test.saved", {"test": test.model_dump()}, agent="test_writer")
        return f"Saved test {test_id} at packages/regression-tests/{rel}. Now call run_regression_test('{test_id}')."

    @tool
    async def run_regression_test(test_id: str) -> str:
        """Run a saved spec against the target app with Playwright. Reports pass/fail, duration, the failure message,
        and whether the failure is an expect() assertion (which means the test reproduces the bug) or a broken
        locator/timeout (which means the test itself needs fixing)."""
        test = ctx.store.load_test(ctx.run.id, test_id.strip())
        if not test:
            return f"ERROR: no test {test_id}"
        result = await run_playwright_spec(ctx.settings, ctx.run.app_url, test, ctx.run_dir)
        test.last_result = result
        ctx.store.save_test(test)
        ctx.bus.emit("test.result", {"test": test.model_dump()}, agent="test_writer")
        verdict = {
            "passed": "PASSED. On a build where the bug exists this means the test does NOT reproduce it: tighten the assertion so it checks the expected behavior that is currently broken.",
            "failed": (
                "FAILED with an expect() assertion: the test reproduces the bug. Done."
                if result.reproduces_bug
                else "FAILED, but not on an expect() assertion (likely a locator timeout or a thrown error). Fix the test, save again, and re-run."
            ),
            "error": "ERROR: the spec did not run. Fix the code and save again.",
            "timeout": "TIMEOUT: the test hung. Simplify waits/locators and re-run.",
        }[result.status]
        return (
            f"Result: {result.status} in {result.duration_ms} ms\n{verdict}\n\n"
            + (f"Failure message:\n{result.error[:2500]}\n" if result.error else "")
            + (f"\nstderr tail:\n{result.stdout_tail}" if result.stdout_tail and result.status == "error" else "")
        )

    return [get_action_log, save_regression_test, run_regression_test]
