#!/usr/bin/env python3
"""Start an AppPilot run against the demo shop with the real product notes and demo credentials.

Usage: python3 scripts/start-run.py ["objective text"] [--api http://localhost:8000] [--app http://localhost:3001]
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OBJECTIVE = "Test this application and find any broken functionality."


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("objective", nargs="?", default=DEFAULT_OBJECTIVE)
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--app", default="http://localhost:3001")
    ap.add_argument("--no-notes", action="store_true", help="do not attach docs/demo-shop-product-notes.md")
    args = ap.parse_args()

    notes = None if args.no_notes else (ROOT / "docs" / "demo-shop-product-notes.md").read_text()
    body = {
        "app_url": args.app,
        "objective": args.objective,
        "product_notes": notes,
        "credentials": {"username": "demo@apppilot.dev", "password": "demo1234"},
    }
    req = urllib.request.Request(
        f"{args.api}/api/runs", data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        run = json.load(resp)
    print(json.dumps({k: run[k] for k in ("id", "status", "objective", "app_url")}, indent=2))
    print(f"\nwatch: http://localhost:3000/runs/{run['id']}")
    print(f"events: {args.api}/api/runs/{run['id']}/events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
