#!/usr/bin/env python3
"""Tail a run's events.jsonl and print one line per notable event (findings, tests, agent phases, status)."""

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    run_id = sys.argv[1]
    path = ROOT / "data" / "runs" / run_id / "events.jsonl"
    while not path.exists():
        time.sleep(1)
    with path.open() as f:
        while True:
            line = f.readline()
            if not line:
                time.sleep(1)
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            t, p, ts = e["type"], e["payload"], e["ts"][11:19]
            if t == "run.status":
                print(f"{ts} RUN {p.get('status')} {p.get('message') or ''}", flush=True)
                if p.get("status") in ("completed", "failed", "stopped"):
                    return 0
            elif t == "agent.start":
                print(f"{ts} START {p['agent']}: {p.get('description', '')[:110]}", flush=True)
            elif t in ("finding.created", "finding.updated"):
                fnd = p["finding"]
                print(f"{ts} {t.split('.')[1].upper()} {fnd['id']} [{fnd['status']}] ({fnd['severity']}) {fnd['title'][:100]}", flush=True)
            elif t in ("test.saved", "test.result"):
                x = p["test"]
                r = x.get("last_result") or {}
                print(f"{ts} {t.upper()} {x['id']} {r.get('status', '')} repro={r.get('reproduces_bug', '')}", flush=True)
            elif t == "tool.end" and p.get("error"):
                print(f"{ts} TOOL-ERROR {e.get('agent')} {p.get('tool')}: {p['error'][:120]}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
