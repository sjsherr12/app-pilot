"""REST + SSE contract checks against a synthetic finished run (no model calls)."""

import json

import pytest
from fastapi.testclient import TestClient

from apppilot.models import Finding, RunCreate
from apppilot.models import TestCase as TC
from apppilot.models import TestResult as TR
from apppilot.runs.events import RunEventBus


@pytest.fixture
def client(tmp_path, monkeypatch):
    from apppilot.api import routes
    from apppilot.runs.store import RunStore

    store = RunStore(tmp_path / "runs")
    monkeypatch.setattr(routes, "store", store)
    monkeypatch.setattr(routes.manager, "store", store)
    from apppilot.api.main import app

    run = store.create_run(RunCreate(app_url="http://localhost:3001", objective="o", credentials={"username": "u", "password": "secret"}))
    run.status = "completed"
    store.save_run(run)
    bus = RunEventBus(store.run_dir(run.id) / "events.jsonl")
    bus.emit("run.status", {"status": "running"}, agent="system")
    f = Finding(id="F001", run_id=run.id, title="t", status="confirmed")
    store.save_finding(f)
    bus.emit("finding.created", {"finding": f.model_dump()}, agent="explorer", session="explore-1")
    t = TC(id="F001-x", run_id=run.id, finding_id="F001", path="tests/x.spec.ts", code="code", last_result=TR(status="failed", reproduces_bug=True))
    store.save_test(t)
    bus.emit("run.status", {"status": "completed"}, agent="system")
    return TestClient(app), run


def test_list_and_get_run(client):
    c, run = client
    runs = c.get("/api/runs").json()["runs"]
    assert runs[0]["id"] == run.id and "credentials" not in runs[0]
    d = c.get(f"/api/runs/{run.id}").json()
    assert d["run"]["status"] == "completed"
    assert d["findings"][0]["id"] == "F001" and d["tests"][0]["last_result"]["reproduces_bug"] is True
    assert c.get("/api/runs/nope").status_code == 404


def test_sse_replays_persisted_events_in_order(client):
    c, run = client
    seqs = []
    with c.stream("GET", f"/api/runs/{run.id}/events") as resp:
        assert resp.status_code == 200
        for line in resp.iter_lines():
            if line.startswith("data:"):
                ev = json.loads(line[5:])
                seqs.append(ev["seq"])
                if ev["type"] == "run.status" and ev["payload"]["status"] == "completed":
                    break
    assert seqs == [1, 2, 3]


def test_sse_honours_last_event_id(client):
    c, run = client
    seen = []
    with c.stream("GET", f"/api/runs/{run.id}/events", headers={"Last-Event-ID": "2"}) as resp:
        for line in resp.iter_lines():
            if line.startswith("data:"):
                seen.append(json.loads(line[5:])["seq"])
                break
    assert seen == [3]
