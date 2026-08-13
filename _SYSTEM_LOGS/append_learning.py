#!/usr/bin/env python3
"""Append one MissionMed learning log entry."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


LOG_PATH = Path("/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append one MissionMed learning entry.")
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--status", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--what-worked", required=True)
    parser.add_argument("--what-failed", required=True)
    parser.add_argument("--change", required=True)
    parser.add_argument("--rule", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--priority", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "task_id": args.task_id,
        "status": args.status,
        "summary": args.summary,
        "what_worked": args.what_worked,
        "what_failed": args.what_failed,
        "change": args.change,
        "rule": args.rule,
        "source": args.source,
        "priority": args.priority,
    }

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, sort_keys=True, separators=(",", ":")) + "\n")

    print("status=appended")
    print(f"path={LOG_PATH}")
    print(f"task_id={args.task_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
