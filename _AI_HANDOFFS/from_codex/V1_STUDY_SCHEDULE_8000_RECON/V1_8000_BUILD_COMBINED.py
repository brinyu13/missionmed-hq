#!/usr/bin/env python3
"""Deterministically build the V1-8000 combined Markdown handoff."""

from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "V1_8000_COMPLETE_COMBINED_HANDOFF.md"

MARKDOWN_FILES = [
    "V1_8000_EXECUTIVE_VERDICT.md",
    "V1_8000_CURRENT_STATE_REPORT.md",
    "V1_8000_AUTHORITY_HIERARCHY.md",
    "V1_8000_CANONICAL_SOURCE_DECISION.md",
    "V1_8000_REPOSITORY_BRANCH_WORKTREE_MAP.md",
    "V1_8000_ARTIFACT_AND_PROTOTYPE_CENSUS.md",
    "V1_8000_PRODUCT_REQUIREMENTS_RECONSTRUCTION.md",
    "V1_8000_FEATURE_IMPLEMENTATION_MATRIX.md",
    "V1_8000_CURRENT_ARCHITECTURE.md",
    "V1_8000_TARGET_ARCHITECTURE.md",
    "V1_8000_ECOSYSTEM_DEPENDENCY_MAP.md",
    "V1_8000_PROTECTED_CONTRACT_AND_INVARIANT_REGISTER.md",
    "V1_8000_DATA_API_AND_IDENTITY_MAP.md",
    "V1_8000_RUNTIME_AND_PRODUCTION_READINESS.md",
    "V1_8000_TEST_QA_AND_OBSERVABILITY_BASELINE.md",
    "V1_8000_UI_UX_EXPERT_BOARD_RUBRIC.md",
    "V1_8000_COMPLETION_SCORECARD.md",
    "V1_8000_BLOCKER_REGISTER.md",
    "V1_8000_RISK_AND_CONFLICT_REGISTER.md",
    "V1_8000_SHORTEST_SAFE_PRODUCTION_PATH.md",
    "V1_8000_RECOMMENDED_TICKET_SEQUENCE.md",
    "V1_8000_V1_8010_NEXT_RUN_INPUTS.md",
    "V1_8000_AGENT_ORCHESTRATION_REPORT.md",
    "V1_8000_INDEPENDENT_REVIEW.md",
    "V1_8000_COMMAND_LOG.md",
    "V1_8000_DECISION_LEDGER.md",
    "V1_8000_EVIDENCE_INDEX.md",
    "V1_8000_FILE_MANIFEST.md",
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build() -> bytes:
    sources: list[tuple[str, bytes]] = []
    for name in MARKDOWN_FILES:
        data = (ROOT / name).read_bytes()
        if not data.endswith(b"\n"):
            raise ValueError(f"{name} must end with a newline")
        sources.append((name, data))

    chunks = [
        b"# V1 Study Schedule - Complete Combined Handoff\n\n",
        b"Mission: \x60V1-STUDY-SCHEDULE-8000\x60\n",
        b"Generation: deterministic from the individual Markdown deliverables listed below\n\n",
        b"## Embedded-file manifest\n\n",
        b"| File | Bytes | SHA-256 |\n",
        b"|---|---:|---|\n",
    ]
    tick = chr(96)

    for name, data in sources:
        row = f"| {tick}{name}{tick} | {len(data)} | {tick}{sha256(data)}{tick} |\n"
        chunks.append(row.encode("utf-8"))

    chunks.append(b"\n")
    for index, (name, data) in enumerate(sources):
        chunks.append(f"<!-- BEGIN EMBEDDED FILE: {name} -->\n".encode("utf-8"))
        chunks.append(data)
        suffix = "\n" if index == len(sources) - 1 else "\n\n"
        chunks.append(f"<!-- END EMBEDDED FILE: {name} -->{suffix}".encode("utf-8"))

    return b"".join(chunks)


def main() -> None:
    OUTPUT.write_bytes(build())


if __name__ == "__main__":
    main()
