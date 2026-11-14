"""Export a generated regression test to a GitHub pull request ("open a PR with the test").

Every git/gh call goes through ``asyncio.create_subprocess_exec`` with an argv list (never a shell
string) and is bounded by ``COMMAND_TIMEOUT_S``. The user's checkout is never touched: the spec is
committed on branch ``apppilot/<finding_id>-<run short id>`` inside a temporary git worktree under the
system temp dir, pushed with ``git push -u origin <branch>`` and turned into a PR with ``gh pr create``.
Exporting the same test again reuses the branch and the open pull request.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from apppilot.models import Finding, Run, TestCase

log = logging.getLogger(__name__)

COMMAND_TIMEOUT_S = 120
BRANCH_PREFIX = "apppilot"
CO_AUTHOR_TRAILER = "Co-Authored-By: AppPilot <noreply@apppilot.dev>"
PR_FOOTER = "🤖 Generated with AppPilot"
WORKFLOW_REL = Path(".github/workflows/regression.yml")


class ExportError(Exception):
    """The export failed; ``status`` is the HTTP status the API answers with."""

    def __init__(self, detail: str, status: int = 500):
        super().__init__(detail)
        self.detail = detail
        self.status = status


@dataclass
class ExportResult:
    branch: str
    pr_url: str | None
    commit: str
    files: list[str]
    message: str

    def as_dict(self) -> dict:
        return {"branch": self.branch, "pr_url": self.pr_url, "commit": self.commit, "files": list(self.files), "message": self.message}


@dataclass
class Cmd:
    argv: list[str]
    code: int
    out: str
    err: str

    @property
    def ok(self) -> bool:
        return self.code == 0


# ----------------------------------------------------------------------------- naming


def run_short_id(run_id: str) -> str:
    """``run_6b4c9ec9`` -> ``6b4c9ec9``."""
    return run_id.removeprefix("run_") or run_id


def branch_name(test: TestCase, run_id: str) -> str:
    raw = f"{BRANCH_PREFIX}/{test.finding_id}-{run_short_id(run_id)}"
    return re.sub(r"[^A-Za-z0-9._/-]+", "-", raw)


# ----------------------------------------------------------------------------- subprocess plumbing


def _describe(argv: list[str]) -> str:
    """``git -C x -c k=v push --quiet -u origin b`` -> ``git push origin`` (for error messages)."""
    words = [Path(argv[0]).name]
    skip = 0
    for a in argv[1:]:
        if skip:
            skip -= 1
            continue
        if a in ("-C", "-c"):
            skip = 1
            continue
        if a.startswith("-"):
            continue
        words.append(a)
        if len(words) == 3:
            break
    return " ".join(words)


def _tail(s: str, n: int = 600) -> str:
    s = s.strip()
    return s if len(s) <= n else "…" + s[-n:]


async def run_cmd(
    argv: list[str | Path],
    *,
    cwd: Path,
    env: dict[str, str],
    check: bool = True,
    status: int = 500,
) -> Cmd:
    args = [str(a) for a in argv]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(cwd),
            env=env,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as e:
        raise ExportError(f"`{args[0]}` is not installed or not on PATH; install it and export again.", 500) from e
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=COMMAND_TIMEOUT_S)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        raise ExportError(f"`{_describe(args)}` did not finish within {COMMAND_TIMEOUT_S}s.", 504) from None
    res = Cmd(args, proc.returncode or 0, out.decode(errors="replace"), err.decode(errors="replace"))
    if check and not res.ok:
        detail = _tail(res.err or res.out) or f"exit code {res.code}"
        raise ExportError(f"`{_describe(args)}` failed: {detail}", status)
    return res


# ----------------------------------------------------------------------------- remote URL helpers


def remote_host(url: str) -> str | None:
    if "://" in url:
        return urlparse(url).hostname
    m = re.match(r"^[\w.-]+@([\w.-]+):", url)  # git@github.com:owner/repo.git
    return m.group(1) if m else None


def repo_slug(url: str) -> str | None:
    """``owner/repo`` from an https or ssh remote URL, else None."""
    if "://" in url:
        path = urlparse(url).path
    elif ":" in url:
        path = url.split(":", 1)[1]
    else:
        return None
    path = path.strip("/").removesuffix(".git")
    return path if path.count("/") == 1 and all(path.split("/")) else None


def compare_url(origin_url: str, branch: str) -> str | None:
    host, slug = remote_host(origin_url), repo_slug(origin_url)
    return f"https://{host}/{slug}/compare/{branch}?expand=1" if host and slug else None


def _credential_args(origin_url: str, gh: str | None) -> list[str]:
    """Let git fall back to the gh CLI's token for github.com over HTTPS (after any helper the user configured)."""
    if not gh or not origin_url.startswith("http") or remote_host(origin_url) != "github.com":
        return []
    return ["-c", f"credential.https://github.com.helper=!{gh} auth git-credential"]


def _last_url(text: str) -> str | None:
    urls = re.findall(r"https?://\S+", text)
    return urls[-1].rstrip(".,)") if urls else None


def _json_url(text: str) -> str | None:
    try:
        url = json.loads(text).get("url")
    except (ValueError, AttributeError):
        return None
    return url if isinstance(url, str) and url.startswith("http") else None


def _one_line(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


# ----------------------------------------------------------------------------- text


def result_line(test: TestCase) -> str:
    r = test.last_result
    if r is None:
        return "not run yet"
    secs = f"{r.duration_ms / 1000:.1f} s"
    if r.status == "passed":
        return f"passed in {secs} (the bug did not reproduce on the build that was tested)"
    if r.status == "failed":
        if r.reproduces_bug:
            return f"failed in {secs}, reproduces the bug (fails on an expect() assertion)"
        return f"failed in {secs}, but not on an assertion (the spec may need attention)"
    if r.status == "timeout":
        return f"timed out after {secs}"
    return f"error after {secs}: the spec did not run"


def _wrap(text: str, indent: str = "") -> str:
    paragraphs = [p.strip() for p in text.strip().splitlines() if p.strip()]
    if not paragraphs:
        return f"{indent}(not recorded)"
    return "\n".join(textwrap.fill(p, width=72, initial_indent=indent, subsequent_indent=indent) for p in paragraphs)


def commit_message(test: TestCase, finding: Finding | None, run: Run, spec_rel: str) -> str:
    lines = [f"Add regression test for {test.finding_id} (AppPilot run {run.id})", ""]
    if finding:
        lines += [_wrap(finding.title), ""]
        meta = f"Severity: {finding.severity}. Status: {finding.status}."
        if finding.feature:
            meta += f" Feature: {finding.feature}."
        lines += [meta, "", "Expected:", _wrap(finding.expected, "  "), "", "Actual:", _wrap(finding.actual, "  "), ""]
        if finding.repro_steps:
            lines.append("Repro steps:")
            for i, step in enumerate(finding.repro_steps, 1):
                lines.append(textwrap.fill(_one_line(step), width=72, initial_indent=f"  {i}. ", subsequent_indent="     "))
            lines.append("")
    lines += [f"Test: {spec_rel}", f"Last result: {result_line(test)}.", "", CO_AUTHOR_TRAILER, ""]
    return "\n".join(lines)


def pr_title(test: TestCase, finding: Finding | None) -> str:
    title = _one_line(finding.title) if finding and finding.title.strip() else f"Regression test {test.id}"
    return title[:200]


def pr_body(test: TestCase, finding: Finding | None, run: Run, spec_rel: str, has_workflow: bool) -> str:
    out: list[str] = []
    if finding:
        head = f"**Finding** `{finding.id}` · **Severity** {finding.severity} · **Status** {finding.status}"
        if finding.feature:
            head += f" · **Feature** {finding.feature}"
        out += [head, f"Found and verified by AppPilot in run `{run.id}` against `{run.app_url}`.", ""]
        out += ["### Expected", finding.expected.strip() or "_not recorded_", ""]
        out += ["### Actual", finding.actual.strip() or "_not recorded_", ""]
        out += ["### Steps to reproduce"]
        out += [f"{i}. {_one_line(s)}" for i, s in enumerate(finding.repro_steps, 1)] or ["_not recorded_"]
        out += ["", "### Evidence"]
        shots = ", ".join(f"`{s}`" for s in finding.evidence_shots) or "none recorded"
        extra = " together with the verification video and Playwright trace" if finding.video_url or finding.trace_url else ""
        out.append(f"Screenshots {shots} from run `{run.id}`; open the run in the AppPilot dashboard to view them{extra}.")
    else:
        out += [f"Regression test `{test.id}` written by AppPilot in run `{run.id}` against `{run.app_url}`."]
    out += ["", "### Regression test", f"`{spec_rel}`", ""]
    r = test.last_result
    line = f"**Test result:** {result_line(test)}"
    if r:
        line += f" · ran {r.ran_at}"
    out.append(line)
    if r and r.error:
        snippet = "\n".join(r.error.strip().splitlines()[:8])[:700]
        out += ["", "```text", snippet, "```"]
    tail = "The spec asserts the expected behavior, so it fails while the bug exists and passes once it is fixed."
    if has_workflow:
        tail += f" CI runs it through `{WORKFLOW_REL.as_posix()}`."
    out += ["", tail, "", PR_FOOTER, ""]
    return "\n".join(out)


# ----------------------------------------------------------------------------- the export itself


async def _identity_args(worktree: Path, env: dict[str, str]) -> list[str]:
    email = await run_cmd(["git", "-C", worktree, "config", "--get", "user.email"], cwd=worktree, env=env, check=False)
    if email.ok and email.out.strip():
        return []
    return ["-c", "user.name=AppPilot", "-c", "user.email=noreply@apppilot.dev"]


async def export_test_to_pr(
    *,
    repo_root: Path,
    regression_tests_dir: Path,
    test: TestCase,
    finding: Finding | None,
    run: Run,
) -> ExportResult:
    repo_root = repo_root.resolve()
    env = {
        **os.environ,
        "GIT_TERMINAL_PROMPT": "0",
        "GH_PROMPT_DISABLED": "1",
        "GH_NO_UPDATE_NOTIFIER": "1",
        "GH_PAGER": "cat",
        "NO_COLOR": "1",
    }
    for k in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
        env.pop(k, None)
    gh = shutil.which("gh")

    # ---- preconditions: a remote to push to and a commit to branch from
    remote = await run_cmd(["git", "-C", repo_root, "remote", "get-url", "origin"], cwd=repo_root, env=env, check=False)
    if not remote.ok:
        raise ExportError(
            "This repository has no `origin` remote, so there is nowhere to open a pull request. "
            "Push the repo to GitHub first (for example `gh repo create --source=. --push`), then export again.",
            400,
        )
    origin_url = remote.out.strip()
    head = await run_cmd(["git", "-C", repo_root, "rev-parse", "--verify", "--quiet", "HEAD"], cwd=repo_root, env=env, check=False)
    if not head.ok:
        raise ExportError(
            "The repository has no commits yet, so there is no base for a pull request. "
            "Make an initial commit on your main branch and push it to GitHub first, then export again.",
            400,
        )
    head_sha = head.out.strip()

    spec_src = regression_tests_dir / test.path
    try:
        spec_rel = spec_src.resolve().relative_to(repo_root)
    except ValueError:
        raise ExportError(f"The regression test directory {regression_tests_dir} is outside the repository {repo_root}.", 500) from None
    if not spec_src.is_file() and not test.code.strip():
        raise ExportError(f"The spec file {spec_rel.as_posix()} is missing and the test has no saved code to export.", 400)

    branch = branch_name(test, run.id)
    cred = _credential_args(origin_url, gh)
    tmp = Path(tempfile.mkdtemp(prefix="apppilot-export-"))
    worktree = tmp / "worktree"
    files: list[str] = []
    try:
        # ---- branch: reuse local, else reuse origin's, else create from HEAD; always in a throwaway worktree
        await run_cmd(["git", "-C", repo_root, "worktree", "prune"], cwd=repo_root, env=env, check=False)
        local = await run_cmd(
            ["git", "-C", repo_root, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], cwd=repo_root, env=env, check=False
        )
        if local.ok:
            await run_cmd(["git", "-C", repo_root, "worktree", "add", "--quiet", worktree, branch], cwd=repo_root, env=env)
            base_note = f"Reused local branch {branch}"
        else:
            on_remote = await run_cmd(
                ["git", "-C", repo_root, *cred, "ls-remote", "--heads", "origin", branch], cwd=repo_root, env=env, check=False
            )
            if on_remote.ok and on_remote.out.strip():
                await run_cmd(
                    ["git", "-C", repo_root, *cred, "fetch", "--quiet", "origin", f"+refs/heads/{branch}:refs/remotes/origin/{branch}"],
                    cwd=repo_root,
                    env=env,
                    status=502,
                )
                await run_cmd(
                    ["git", "-C", repo_root, "worktree", "add", "--quiet", "-b", branch, worktree, f"origin/{branch}"], cwd=repo_root, env=env
                )
                base_note = f"Reused branch {branch} from origin"
            else:
                await run_cmd(["git", "-C", repo_root, "worktree", "add", "--quiet", "-b", branch, worktree, head_sha], cwd=repo_root, env=env)
                base_note = f"Created branch {branch} from {head_sha[:7]}"

        # ---- files: the spec, plus the regression workflow when the branch lacks it
        dest = worktree / spec_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if spec_src.is_file():
            shutil.copyfile(spec_src, dest)
        else:
            dest.write_text(test.code)
        files.append(spec_rel.as_posix())
        workflow_src = repo_root / WORKFLOW_REL
        has_workflow = (worktree / WORKFLOW_REL).is_file()
        if workflow_src.is_file() and not has_workflow:
            (worktree / WORKFLOW_REL).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(workflow_src, worktree / WORKFLOW_REL)
            files.append(WORKFLOW_REL.as_posix())
            has_workflow = True

        # ---- commit (only when something changed)
        await run_cmd(["git", "-C", worktree, "add", "-f", "--", *files], cwd=worktree, env=env)
        staged = await run_cmd(["git", "-C", worktree, "diff", "--cached", "--quiet"], cwd=worktree, env=env, check=False)
        if staged.code not in (0, 1):
            raise ExportError(f"`git diff` failed: {_tail(staged.err)}")
        committed = staged.code == 1
        if committed:
            msg = tmp / "COMMIT_EDITMSG"
            msg.write_text(commit_message(test, finding, run, spec_rel.as_posix()))
            identity = await _identity_args(worktree, env)
            await run_cmd(
                ["git", "-C", worktree, *identity, "-c", "commit.gpgsign=false", "commit", "--quiet", "--no-verify", "-F", msg],
                cwd=worktree,
                env=env,
            )
        commit = (await run_cmd(["git", "-C", worktree, "rev-parse", "HEAD"], cwd=worktree, env=env)).out.strip()

        # ---- push
        await run_cmd(["git", "-C", worktree, *cred, "push", "--quiet", "-u", "origin", branch], cwd=worktree, env=env, status=502)
        pushed = "pushed the updated test" if committed else "nothing new to commit"

        # ---- pull request
        manual = compare_url(origin_url, branch)
        hint = f" Open it by hand at {manual}." if manual else ""
        pr_url: str | None = None
        if gh is None:
            message = f"{base_note} and pushed it to origin, but the GitHub CLI (gh) is not installed, so no pull request was opened.{hint}"
        else:
            body = tmp / "PR_BODY.md"
            body.write_text(pr_body(test, finding, run, spec_rel.as_posix(), has_workflow))
            created = await run_cmd(
                [gh, "pr", "create", "--title", pr_title(test, finding), "--body-file", body, "--head", branch],
                cwd=worktree,
                env=env,
                check=False,
            )
            if created.ok and _last_url(created.out):
                pr_url = _last_url(created.out)
                message = f"{base_note}, pushed it to origin and opened a pull request."
            else:
                view = await run_cmd([gh, "pr", "view", branch, "--json", "url"], cwd=worktree, env=env, check=False)
                pr_url = _json_url(view.out) if view.ok else None
                if pr_url:
                    message = f"A pull request for {branch} already exists; {pushed}."
                else:
                    err = _tail(created.err or created.out, 300) or "no output"
                    message = f"{base_note} and pushed it to origin, but `gh pr create` failed: {err}{hint}"
        log.info("exported %s to %s (%s)", test.id, branch, pr_url or "no PR")
        return ExportResult(branch=branch, pr_url=pr_url, commit=commit, files=files, message=message)
    finally:
        await run_cmd(["git", "-C", repo_root, "worktree", "remove", "--force", worktree], cwd=repo_root, env=env, check=False)
        shutil.rmtree(tmp, ignore_errors=True)
        await run_cmd(["git", "-C", repo_root, "worktree", "prune"], cwd=repo_root, env=env, check=False)
