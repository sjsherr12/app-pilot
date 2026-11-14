"""File-backed run store: data/runs/<run_id>/{run.json, events.jsonl, findings/, tests/, shots/, video/, traces/, workspace/}."""

from __future__ import annotations

import json
from pathlib import Path

from apppilot.models import Finding, Run, RunCreate, TestCase, new_id

SUBDIRS = ("shots", "video", "traces", "findings", "tests", "workspace")


class RunStore:
    def __init__(self, runs_dir: Path):
        self.runs_dir = runs_dir
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    # ----- runs
    def run_dir(self, run_id: str) -> Path:
        return self.runs_dir / run_id

    def create_run(self, req: RunCreate) -> Run:
        run = Run(id=new_id("run", 8), **req.model_dump())
        d = self.run_dir(run.id)
        for sub in SUBDIRS:
            (d / sub).mkdir(parents=True, exist_ok=True)
        self.save_run(run)
        return run

    def save_run(self, run: Run) -> None:
        _write_json(self.run_dir(run.id) / "run.json", run.model_dump())

    def load_run(self, run_id: str) -> Run | None:
        p = self.run_dir(run_id) / "run.json"
        if not p.exists():
            return None
        return Run.model_validate(json.loads(p.read_text()))

    def list_runs(self) -> list[Run]:
        runs: list[Run] = []
        for d in self.runs_dir.iterdir():
            if (d / "run.json").exists():
                run = self.load_run(d.name)
                if run:
                    runs.append(run)
        runs.sort(key=lambda r: r.created_at, reverse=True)
        return runs

    # ----- findings
    def next_finding_id(self, run_id: str) -> str:
        n = len(list((self.run_dir(run_id) / "findings").glob("F*.json"))) + 1
        return f"F{n:03d}"

    def save_finding(self, f: Finding) -> None:
        _write_json(self.run_dir(f.run_id) / "findings" / f"{f.id}.json", f.model_dump())

    def load_finding(self, run_id: str, finding_id: str) -> Finding | None:
        p = self.run_dir(run_id) / "findings" / f"{finding_id}.json"
        if not p.exists():
            return None
        return Finding.model_validate(json.loads(p.read_text()))

    def list_findings(self, run_id: str) -> list[Finding]:
        out = [Finding.model_validate(json.loads(p.read_text())) for p in sorted((self.run_dir(run_id) / "findings").glob("F*.json"))]
        return out

    # ----- tests
    def save_test(self, t: TestCase) -> None:
        _write_json(self.run_dir(t.run_id) / "tests" / f"{t.id}.json", t.model_dump())

    def load_test(self, run_id: str, test_id: str) -> TestCase | None:
        p = self.run_dir(run_id) / "tests" / f"{test_id}.json"
        if not p.exists():
            return None
        return TestCase.model_validate(json.loads(p.read_text()))

    def list_tests(self, run_id: str) -> list[TestCase]:
        return [TestCase.model_validate(json.loads(p.read_text())) for p in sorted((self.run_dir(run_id) / "tests").glob("*.json"))]

    def find_test(self, test_id: str) -> TestCase | None:
        for d in self.runs_dir.iterdir():
            p = d / "tests" / f"{test_id}.json"
            if p.exists():
                return TestCase.model_validate(json.loads(p.read_text()))
        return None

    # ----- artifacts
    @staticmethod
    def artifact_url(run_id: str, rel: str) -> str:
        return f"/artifacts/{run_id}/{rel.lstrip('/')}"

    def shot_url(self, run_id: str, shot_id: str) -> str:
        return self.artifact_url(run_id, f"shots/{shot_id}.jpg")


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(path)
