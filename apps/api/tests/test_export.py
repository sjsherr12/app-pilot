"""POST /api/tests/{id}/export against a throwaway git repo: local bare `origin`, fake `gh` on PATH, no network."""

import json
import os
import re
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from apppilot.models import Finding, RunCreate
from apppilot.models import TestCase as TC
from apppilot.models import TestResult as TR
from apppilot.runs.events import RunEventBus

SPEC = 'import { test, expect } from "@playwright/test";\ntest("cart math", async ({ page }) => {\n  await expect(1).toBe(2);\n});\n'
WORKFLOW = "name: AppPilot regression tests\non: [pull_request]\njobs: {}\n"
PR_URL = "https://github.com/example/app/pull/7"

# Records every call, copies the PR body, and behaves like gh: the second `pr create` says the PR exists.
FAKE_GH = """#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GH_STATE/log"
case "$1 $2" in
  "pr create")
    while [ $# -gt 0 ]; do
      if [ "$1" = "--body-file" ]; then cp "$2" "$FAKE_GH_STATE/body.md"; fi
      if [ "$1" = "--title" ]; then printf '%s' "$2" > "$FAKE_GH_STATE/title"; fi
      shift
    done
    if [ -f "$FAKE_GH_STATE/pr" ]; then
      echo 'a pull request for branch "x" into branch "main" already exists:' >&2
      echo '__PR_URL__' >&2
      exit 1
    fi
    : > "$FAKE_GH_STATE/pr"
    echo 'Creating pull request for x into main in example/app'
    echo '__PR_URL__'
    ;;
  "pr view")
    if [ -f "$FAKE_GH_STATE/pr" ]; then echo '{"url":"__PR_URL__"}'; else echo 'no pull requests found' >&2; exit 1; fi
    ;;
  "auth git-credential") exit 0 ;;
  *) echo "unexpected: gh $*" >&2; exit 2 ;;
esac
""".replace("__PR_URL__", PR_URL)


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def make_repo(root: Path, *, with_remote: bool = True, with_commit: bool = True) -> tuple[Path, Path]:
    remote = root / "remote.git"
    work = root / "work"
    subprocess.run(["git", "init", "--bare", "--quiet", str(remote)], check=True)
    git("symbolic-ref", "HEAD", "refs/heads/main", cwd=remote)
    work.mkdir()
    subprocess.run(["git", "init", "--quiet", str(work)], check=True)
    git("symbolic-ref", "HEAD", "refs/heads/main", cwd=work)
    git("config", "user.name", "Dev", cwd=work)
    git("config", "user.email", "dev@example.com", cwd=work)
    if with_commit:
        (work / "README.md").write_text("# app\n")
        git("add", "README.md", cwd=work)
        git("commit", "--quiet", "-m", "initial", cwd=work)
    if with_remote:
        git("remote", "add", "origin", str(remote), cwd=work)
        if with_commit:
            git("push", "--quiet", "-u", "origin", "main", cwd=work)
    return work, remote


@pytest.fixture
def fake_gh(tmp_path, monkeypatch):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(FAKE_GH)
    gh.chmod(0o755)
    state = tmp_path / "gh-state"
    state.mkdir()
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("FAKE_GH_STATE", str(state))
    return state


@pytest.fixture
def api(tmp_path, monkeypatch, fake_gh):
    """TestClient + a synthetic finished run whose spec and workflow exist only in the (untracked) working tree."""
    from apppilot.api import routes
    from apppilot.api.main import app
    from apppilot.runs.store import RunStore

    work, remote = make_repo(tmp_path)
    store = RunStore(tmp_path / "runs")
    monkeypatch.setattr(routes, "store", store)
    monkeypatch.setattr(routes.manager, "store", store)
    monkeypatch.setattr(routes, "_late_buses", {})
    monkeypatch.setattr(routes.settings, "repo_root", work)
    monkeypatch.setattr(routes.settings, "regression_tests_dir", work / "packages" / "regression-tests")

    run = store.create_run(RunCreate(app_url="http://localhost:3001", objective="find bugs"))
    run.status = "completed"
    store.save_run(run)
    bus = RunEventBus(store.run_dir(run.id) / "events.jsonl")
    bus.emit("run.status", {"status": "completed"}, agent="system")
    finding = Finding(
        id="F001",
        run_id=run.id,
        title="Cart line total ignores quantity at 3+",
        severity="critical",
        feature="Cart math",
        status="confirmed",
        expected="Line total = unit price × quantity: $55.50 for three tote bags.",
        actual="Line total shows $18.50 (the unit price) at quantity 3.",
        repro_steps=["Reset environment and go to / as a guest", 'Click "Add Canvas Tote Bag to cart"', "Increase quantity to 3"],
        evidence_shots=["s0007", "s0011"],
        video_url="/artifacts/x/video/verify-1.webm",
    )
    store.save_finding(finding)
    spec_rel = f"tests/{run.id}/F001.spec.ts"
    spec = work / "packages" / "regression-tests" / spec_rel
    spec.parent.mkdir(parents=True)
    spec.write_text(SPEC)
    (work / ".github" / "workflows").mkdir(parents=True)
    (work / ".github" / "workflows" / "regression.yml").write_text(WORKFLOW)
    test = TC(
        id=f"F001-{run.id[-6:]}",
        run_id=run.id,
        finding_id="F001",
        path=spec_rel,
        code=SPEC,
        last_result=TR(status="failed", error="Error: expect(received).toBe(expected)\n\nExpected: 2\nReceived: 1", duration_ms=1234, reproduces_bug=True),
    )
    store.save_test(test)
    return TestClient(app), store, run, test, work, remote, spec, fake_gh


def test_export_creates_branch_commit_push_and_pr(api):
    client, store, run, test, work, remote, _spec, gh_state = api
    before_status = git("status", "--porcelain", cwd=work)

    resp = client.post(f"/api/tests/{test.id}/export")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    branch = f"apppilot/F001-{run.id.removeprefix('run_')}"
    assert body["branch"] == branch
    assert body["pr_url"] == PR_URL
    assert re.fullmatch(r"[0-9a-f]{40}", body["commit"])
    assert body["files"] == [f"packages/regression-tests/tests/{run.id}/F001.spec.ts", ".github/workflows/regression.yml"]
    assert "opened a pull request" in body["message"]
    assert body["test"]["pr_url"] == PR_URL and body["test"]["branch"] == branch

    # The branch, its commit and both files reached origin.
    assert git("rev-parse", f"refs/heads/{branch}", cwd=remote) == body["commit"]
    assert git("show", f"{body['commit']}:packages/regression-tests/tests/{run.id}/F001.spec.ts", cwd=remote) == SPEC.strip()
    assert git("show", f"{body['commit']}:.github/workflows/regression.yml", cwd=remote) == WORKFLOW.strip()
    message = git("log", "-1", "--format=%B", body["commit"], cwd=remote)
    assert message.startswith(f"Add regression test for F001 (AppPilot run {run.id})")
    assert "Cart line total ignores quantity at 3+" in message
    assert "Expected:" in message and "Actual:" in message and "Repro steps:" in message and "  1. Reset environment" in message
    assert message.rstrip().endswith("Co-Authored-By: AppPilot <noreply@apppilot.dev>")
    assert git("rev-parse", "--abbrev-ref", f"{branch}@{{upstream}}", cwd=work) == f"origin/{branch}"

    # gh was called from the branch with the finding title and a full bug report.
    log = (gh_state / "log").read_text().splitlines()
    assert log[0].startswith("pr create --title Cart line total ignores quantity at 3+ --body-file ")
    assert log[0].endswith(f"--head {branch}")
    pr_body = (gh_state / "body.md").read_text()
    for needle in (
        "**Finding** `F001`",
        "### Expected",
        "### Actual",
        "1. Reset environment and go to / as a guest",
        "`s0007`, `s0011`",
        "**Test result:** failed in 1.2 s, reproduces the bug",
        "Expected: 2",
        ".github/workflows/regression.yml",
    ):
        assert needle in pr_body, needle
    assert pr_body.rstrip().splitlines()[-1] == "🤖 Generated with AppPilot"

    # The user's checkout was never touched and no worktree was left behind.
    assert git("rev-parse", "--abbrev-ref", "HEAD", cwd=work) == "main"
    assert git("status", "--porcelain", cwd=work) == before_status
    assert git("rev-parse", "HEAD", cwd=work) == git("rev-parse", "refs/heads/main", cwd=remote)
    assert len(git("worktree", "list", cwd=work).splitlines()) == 1

    # Persisted on the TestCase, visible through GET, and announced on the event stream.
    saved = store.find_test(test.id)
    assert saved.pr_url == PR_URL and saved.branch == branch and saved.exported_at
    assert saved.last_result.reproduces_bug is True
    detail = client.get(f"/api/runs/{run.id}").json()
    assert detail["tests"][0]["pr_url"] == PR_URL
    events = [json.loads(l) for l in (store.run_dir(run.id) / "events.jsonl").read_text().splitlines()]
    assert events[-1]["type"] == "test.exported" and events[-1]["seq"] == len(events)
    assert events[-1]["payload"]["pr_url"] == PR_URL and events[-1]["payload"]["test"]["branch"] == branch


def test_export_again_reuses_branch_and_pull_request(api):
    client, _store, run, test, work, remote, spec, gh_state = api
    first = client.post(f"/api/tests/{test.id}/export").json()
    branch = first["branch"]

    second = client.post(f"/api/tests/{test.id}/export")
    assert second.status_code == 200, second.text
    assert second.json()["pr_url"] == PR_URL
    assert second.json()["commit"] == first["commit"], "unchanged spec must not produce a new commit"
    assert "already exists" in second.json()["message"]
    assert "pr view" in (gh_state / "log").read_text()

    spec.write_text(SPEC.replace("toBe(2)", "toBe(3)"))
    third = client.post(f"/api/tests/{test.id}/export").json()
    assert third["pr_url"] == PR_URL and third["branch"] == branch
    assert third["commit"] != first["commit"]
    assert git("rev-parse", f"refs/heads/{branch}", cwd=remote) == third["commit"]
    assert git("rev-list", "--count", f"main..{branch}", cwd=remote) == "2"
    assert "toBe(3)" in git("show", f"{third['commit']}:packages/regression-tests/tests/{run.id}/F001.spec.ts", cwd=remote)
    assert len(git("worktree", "list", cwd=work).splitlines()) == 1


def test_export_without_origin_remote_is_a_clear_400(api, tmp_path, monkeypatch):
    client, store, _run, test, *_ = api
    from apppilot.api import routes

    work, _ = make_repo(tmp_path / "no-remote", with_remote=False)
    monkeypatch.setattr(routes.settings, "repo_root", work)
    resp = client.post(f"/api/tests/{test.id}/export")
    assert resp.status_code == 400
    assert "origin" in resp.json()["detail"] and "GitHub" in resp.json()["detail"]
    assert store.find_test(test.id).pr_url is None


def test_export_without_commits_is_a_clear_400(api, tmp_path, monkeypatch):
    client, _store, _run, test, *_ = api
    from apppilot.api import routes

    work, _ = make_repo(tmp_path / "empty", with_commit=False)
    monkeypatch.setattr(routes.settings, "repo_root", work)
    resp = client.post(f"/api/tests/{test.id}/export")
    assert resp.status_code == 400
    assert "no commits" in resp.json()["detail"]


def test_export_unknown_test_is_404(api):
    client, *_ = api
    assert client.post("/api/tests/nope/export").status_code == 404
