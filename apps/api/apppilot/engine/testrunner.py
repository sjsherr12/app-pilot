"""Runs a generated @playwright/test spec with the JSON reporter and classifies the outcome."""

from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

from apppilot.config import Settings
from apppilot.models import TestCase, TestResult, now_iso

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _walk_results(suite: dict[str, Any], out: list[dict[str, Any]]) -> None:
    for spec in suite.get("specs", []):
        for t in spec.get("tests", []):
            for r in t.get("results", []):
                out.append(r)
    for child in suite.get("suites", []):
        _walk_results(child, out)


def classify(data: dict[str, Any]) -> tuple[str, str | None, bool, list[str]]:
    """Returns (status, error_message, reproduces_bug, trace_paths)."""
    results: list[dict[str, Any]] = []
    for suite in data.get("suites", []):
        _walk_results(suite, results)
    stats = data.get("stats", {})
    unexpected = int(stats.get("unexpected", 0))
    expected = int(stats.get("expected", 0))
    messages: list[str] = []
    traces: list[str] = []
    statuses: list[str] = []
    for r in results:
        statuses.append(r.get("status", ""))
        if r.get("error") and r["error"].get("message"):
            messages.append(ANSI_RE.sub("", r["error"]["message"]))
        for e in r.get("errors", []) or []:
            m = ANSI_RE.sub("", e.get("message", ""))
            if m and m not in messages:
                messages.append(m)
        for a in r.get("attachments", []) or []:
            if a.get("name") == "trace" and a.get("path"):
                traces.append(a["path"])
    error = "\n\n".join(messages)[:4000] or None
    if unexpected == 0 and expected > 0:
        return "passed", None, False, traces
    if unexpected == 0 and expected == 0:
        return "error", error or "No tests ran. Check the spec file for syntax errors or a missing test() block.", False, traces
    if statuses and all(s == "timedOut" for s in statuses):
        return "timeout", error or "Test timed out.", False, traces
    assertion = bool(error) and ("expect(" in error or "Expected" in error)
    return "failed", error, assertion, traces


async def run_playwright_spec(settings: Settings, app_url: str, test: TestCase, run_dir: Path) -> TestResult:
    cwd = settings.regression_tests_dir
    env = {**os.environ, "APP_URL": app_url, "CI": "1", "FORCE_COLOR": "0"}
    out_dir = f"results/{test.id}"
    cmd = ["npx", "playwright", "test", test.path, "--reporter=json", "--output", out_dir]
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=str(cwd), env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=180)
    except TimeoutError:
        proc.kill()
        return TestResult(status="timeout", error="Playwright did not finish within 180s", duration_ms=180_000, ran_at=now_iso())
    stdout = out.decode(errors="replace")
    stderr = err.decode(errors="replace")
    start = stdout.find("{")
    data: dict[str, Any] | None = None
    if start >= 0:
        try:
            data = json.loads(stdout[start:])
        except json.JSONDecodeError:
            data = None
    if data is None:
        tail = (stderr or stdout)[-2000:]
        return TestResult(status="error", error=tail or "Playwright produced no JSON output", duration_ms=0, stdout_tail=tail, ran_at=now_iso())
    status, error, reproduces, traces = classify(data)
    duration = int(float(data.get("stats", {}).get("duration", 0)))
    # keep the first trace with the run's artifacts
    for tp in traces:
        src = Path(tp)
        if not src.is_absolute():
            src = cwd / src
        if src.exists():
            dest_dir = run_dir / "tests" / test.id
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest_dir / "trace.zip")
            break
    return TestResult(
        status=status,  # type: ignore[arg-type]
        error=error,
        duration_ms=duration,
        reproduces_bug=reproduces,
        stdout_tail=ANSI_RE.sub("", stderr[-1500:]) or None,
        ran_at=now_iso(),
    )
