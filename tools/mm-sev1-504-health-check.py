#!/usr/bin/env python3
"""Fail when Nginx shows a repeated, cross-Matrix PHP timeout incident.

Usage:
  ssh missionmed-kinsta 'tail -n 5000 /var/log/sitelogs/error.log' \
    | python3 tools/mm-sev1-504-health-check.py --since '2026/09/09 03:00:00'
"""

from __future__ import annotations

import argparse
import collections
import re
import sys


TIMESTAMP_RE = re.compile(r"^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})")
REQUEST_RE = re.compile(r'request: "[A-Z]+ ([^ ?"]+)')


def route_family(path: str) -> str:
    if path.startswith(("/api/scheduler/", "/wp-json/missionmed-scheduler/")):
        return "scheduler"
    if path.startswith("/api/auth/"):
        return "auth"
    if path.startswith("/wp-json/mmed/"):
        return "matrix-api"
    if path.startswith(("/storyforge", "/wp-json/missionmed/v1/storyforge")):
        return "storyforge"
    if path.startswith(("/missionaccounts", "/wp-json/missionmed/v1/missionaccounts")):
        return "missionaccounts"
    if path.startswith(("/member-dashboard", "/timeline", "/mission-residency")):
        return "matrix-page"
    return "other"


def analyze(lines: list[str], since: str) -> tuple[int, collections.Counter[str]]:
    families: collections.Counter[str] = collections.Counter()
    total = 0
    for line in lines:
        timestamp = TIMESTAMP_RE.match(line)
        if since and (not timestamp or timestamp.group(1) < since):
            continue
        if "upstream timed out" not in line and "upstream prematurely closed" not in line:
            continue
        request = REQUEST_RE.search(line)
        if not request:
            continue
        total += 1
        families[route_family(request.group(1))] += 1
    return total, families


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="", help="Nginx timestamp lower bound: YYYY/MM/DD HH:MM:SS")
    parser.add_argument("--threshold", type=int, default=5)
    parser.add_argument("--family-threshold", type=int, default=2)
    args = parser.parse_args()

    total, families = analyze(list(sys.stdin), args.since)
    matrix_families = {name for name, count in families.items() if name != "other" and count > 0}
    incident = total >= args.threshold and len(matrix_families) >= args.family_threshold
    summary = ",".join(f"{name}:{families[name]}" for name in sorted(families)) or "none"
    print(
        f"MM_SEV1_504_HEALTH_{'FAIL' if incident else 'PASS'} "
        f"timeouts={total} matrix_families={len(matrix_families)} routes={summary}"
    )
    return 2 if incident else 0


if __name__ == "__main__":
    raise SystemExit(main())
