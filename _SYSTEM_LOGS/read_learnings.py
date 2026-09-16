#!/usr/bin/env python3
"""Read recent MissionMed learning log entries."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


LOG_PATH = Path("/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read recent MissionMed learning entries.")
    parser.add_argument("--limit", type=int, default=10, help="Number of recent valid entries to print.")
    return parser.parse_args()


def load_entries(path: Path) -> tuple[list[dict[str, Any]], int]:
    if not path.exists():
        return [], 0

    entries: list[dict[str, Any]] = []
    malformed = 0
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                malformed += 1
                continue
            if isinstance(parsed, dict):
                entries.append(parsed)
            else:
                malformed += 1
    return entries, malformed


def main() -> int:
    args = parse_args()
    limit = max(args.limit, 0)
    entries, malformed = load_entries(LOG_PATH)
    recent = entries[-limit:] if limit else []

    print(json.dumps(recent, indent=2, sort_keys=True))
    if malformed:
        print(f"warning: skipped {malformed} malformed line(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
