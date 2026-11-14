"""Pydantic models shared by the engine, agents, API, and the dashboard contract.

The dashboard (apps/dashboard) is built against these shapes; keep field names stable.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

RunStatus = Literal["queued", "running", "completed", "failed", "stopped"]
FindingStatus = Literal["candidate", "confirmed", "potential", "flaky", "env_failure", "inconclusive"]
Severity = Literal["critical", "high", "medium", "low"]
AgentName = Literal["supervisor", "explorer", "verifier", "test_writer", "system"]
AttemptOutcome = Literal["reproduced", "not_reproduced", "blocked"]
TestStatus = Literal["passed", "failed", "error", "timeout"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_id(prefix: str, nhex: int = 6) -> str:
    return f"{prefix}_{secrets.token_hex(nhex)[:nhex]}"


class Credentials(BaseModel):
    username: str
    password: str


class ResetHook(BaseModel):
    """How to put the target app into a clean, isolated state.

    The engine sets `tenant_cookie` on every fresh browser context and POSTs to the
    rendered `reset_url_template` so the server side of that tenant is reset too.
    Apps without a hook still work; verification then relies on a fresh browser context only.
    """

    reset_url_template: str = "{app_url}/__test/reset?tenant={tenant}"
    tenant_cookie: str = "apx_tenant"


class RunCreate(BaseModel):
    app_url: str
    objective: str
    product_notes: str | None = None
    credentials: Credentials | None = None
    reset_hook: ResetHook = Field(default_factory=ResetHook)


class Run(BaseModel):
    id: str
    objective: str
    app_url: str
    product_notes: str | None = None
    credentials: Credentials | None = None
    reset_hook: ResetHook = Field(default_factory=ResetHook)
    status: RunStatus = "queued"
    created_at: str = Field(default_factory=now_iso)
    started_at: str | None = None
    finished_at: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    report_md: str | None = None
    error: str | None = None

    def public(self) -> dict[str, Any]:
        """Shape returned by the API (never leaks credentials)."""
        return self.model_dump(exclude={"credentials"})


class VerificationAttempt(BaseModel):
    attempt: int
    outcome: AttemptOutcome
    notes: str = ""
    shot_ids: list[str] = Field(default_factory=list)
    shot_urls: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    id: str
    run_id: str
    title: str
    severity: Severity = "medium"
    feature: str = ""
    expected: str = ""
    actual: str = ""
    repro_steps: list[str] = Field(default_factory=list)
    evidence_shots: list[str] = Field(default_factory=list)
    evidence_urls: list[str] = Field(default_factory=list)
    status: FindingStatus = "candidate"
    verification_attempts: list[VerificationAttempt] = Field(default_factory=list)
    video_url: str | None = None
    trace_url: str | None = None
    root_cause: str | None = None
    test_id: str | None = None
    # Browser session generation (e.g. "verify-2") whose video/trace become this finding's evidence
    # once that context closes. Internal bookkeeping; harmless for the dashboard.
    session_ref: str | None = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class TestResult(BaseModel):
    status: TestStatus
    error: str | None = None
    duration_ms: int = 0
    reproduces_bug: bool = False
    ran_at: str = Field(default_factory=now_iso)
    stdout_tail: str | None = None


class TestCase(BaseModel):
    id: str
    run_id: str
    finding_id: str
    path: str
    code: str
    last_result: TestResult | None = None
    created_at: str = Field(default_factory=now_iso)


class Event(BaseModel):
    seq: int
    ts: str
    type: str
    agent: str | None = None
    session: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class ActionRecord(BaseModel):
    """One browser interaction, logged with semantic selector info for test generation."""

    kind: str
    ref: str | None = None
    role: str | None = None
    name: str | None = None
    href: str | None = None
    text: str | None = None
    value: str | None = None
    url_before: str = ""
    url_after: str = ""
    shot_id: str | None = None
    ts: str = Field(default_factory=now_iso)
