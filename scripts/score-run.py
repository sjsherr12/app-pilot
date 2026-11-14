#!/usr/bin/env python3
"""Score a run against the demo shop's seeded bugs: recall, precision, decoy handling, tests that reproduce.

Usage: python3 scripts/score-run.py <run_id>
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SEEDED = {
    "cart_quantity_total": lambda t: ("quantity" in t or "qty" in t or "x3" in t or "×3" in t) and ("subtotal" in t or "line total" in t or "total" in t),
    "profile_name_not_persisted": lambda t: ("display name" in t or "profile" in t or "account" in t) and ("persist" in t or "saved" in t or "reload" in t or "revert" in t or "not kept" in t or "lost" in t),
    "first_order_link_404": lambda t: ("view order" in t or "/orders/0" in t or "order not found" in t or "off by one" in t or "off-by-one" in t),
}
DECOY = lambda t: "welcome10" in t or ("coupon" in t and "first order" in t)  # noqa: E731


def main() -> int:
    run_id = sys.argv[1]
    d = ROOT / "data" / "runs" / run_id
    run = json.loads((d / "run.json").read_text())
    findings = [json.loads(p.read_text()) for p in sorted((d / "findings").glob("F*.json"))]
    tests = [json.loads(p.read_text()) for p in sorted((d / "tests").glob("*.json"))]
    confirmed = [f for f in findings if f["status"] == "confirmed"]

    def text(f):
        return " ".join([f["title"], f["feature"], f["expected"], f["actual"], " ".join(f["repro_steps"])]).lower()

    hits = {name: [f["id"] for f in confirmed if match(text(f))] for name, match in SEEDED.items()}
    decoy_confirmed = [f["id"] for f in confirmed if DECOY(text(f))]
    explained = {fid for ids in hits.values() for fid in ids}
    false_pos = [f["id"] for f in confirmed if f["id"] not in explained]
    repro = [t for t in tests if t.get("last_result") and t["last_result"]["reproduces_bug"]]

    recall = sum(1 for ids in hits.values() if ids) / len(SEEDED)
    precision = (len(explained) / len(confirmed)) if confirmed else 0.0
    dur = None
    if run.get("started_at") and run.get("finished_at"):
        from datetime import datetime

        dur = (datetime.fromisoformat(run["finished_at"].replace("Z", "+00:00")) - datetime.fromisoformat(run["started_at"].replace("Z", "+00:00"))).total_seconds()
    print(f"run {run_id}: status={run['status']} duration={dur and f'{dur/60:.1f} min'} cost=${run['cost_usd']:.2f} tokens_in={run['tokens_in']:,} tokens_out={run['tokens_out']:,}")
    print(f"findings: {len(findings)} total, {len(confirmed)} confirmed; by status: " + ", ".join(f"{s}={sum(1 for f in findings if f['status']==s)}" for s in sorted({f['status'] for f in findings})))
    for name, ids in hits.items():
        print(f"  seeded {name:<28} {'FOUND ' + ','.join(ids) if ids else 'missed'}")
    print(f"  decoy WELCOME10 confirmed as bug:    {', '.join(decoy_confirmed) if decoy_confirmed else 'no (correct)'}")
    print(f"  confirmed findings not matching a seeded bug: {', '.join(false_pos) if false_pos else 'none'}")
    print(f"recall={recall:.0%} precision={precision:.0%} tests={len(tests)} reproducing={len(repro)}")
    for t in tests:
        r = t.get("last_result") or {}
        print(f"  test {t['id']}: {r.get('status', 'not run')} reproduces_bug={r.get('reproduces_bug')} ({t['path']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
