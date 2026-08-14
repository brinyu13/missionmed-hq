#!/usr/bin/env python3
"""Build the non-recursive file manifest and verbatim D9-415 Markdown handoff."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess


HANDOFF = Path(__file__).resolve().parents[1]
FILE_MANIFEST = HANDOFF / "D9_415_FILE_MANIFEST.md"
COMBINED = HANDOFF / "D9_415_COMPLETE_COMBINED_HANDOFF.md"
INTERIM_COMBINED = "D9_415_BLOCKED_PHASE_1_COMBINED_HANDOFF.md"

REQUIRED_MARKDOWN = [
    "D9_415_EXECUTIVE_VERDICT.md",
    "D9_415_FOUNDER_DECISION.md",
    "D9_415_FOUNDER_DECISION_002.md",
    "D9_415_EXECUTION_PLAN.md",
    "D9_415_DECISION_LEDGER.md",
    "D9_415_COMMAND_LOG.md",
    "D9_415_SUBAGENT_WAVE_1_SYNTHESIS.md",
    "D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.md",
    "D9_415_SNAPSHOT_CUTOFF.md",
    "D9_415_SNAPSHOT_EXCLUSION_REGISTER.md",
    "D9_415_SECRET_AND_DATA_SCAN_REPORT.md",
    "D9_415_MU_PLUGIN_RUNTIME_MANIFEST.md",
    "D9_415_MU_DEPENDENCY_GRAPH.md",
    "D9_415_BASELINE_COMMIT_PROVENANCE.md",
    "D9_415_PRODUCTION_TO_GIT_HASH_MAP.md",
    "D9_415_CALENDAR_CSS_RECONCILIATION.md",
    "D9_415_MU_PLUGIN_BACKUP_REMEDIATION.md",
    "D9_415_RUNTIME_LOCK_RECONCILIATION.md",
    "D9_415_CANONICAL_REPOSITORY_DECISION.md",
    "D9_415_IMPLEMENTATION_HOME_LOCK.md",
    "D9_415_REPRODUCIBLE_PACKAGE_REPORT.md",
    "D9_415_CI_VALIDATION_REPORT.md",
    "D9_415_DEPLOYMENT_LINEAGE_PLAN.md",
    "D9_415_ROLLBACK_PLAN.md",
    "D9_415_SUBAGENT_WAVE_2_REVIEW.md",
    "D9_415_NO_PRODUCTION_MUTATION_ATTESTATION.md",
    "D9_415_TEST_REPORT.md",
    "D9_415_RISK_REGISTER.md",
    "D9_415_AUTHORITY_CONFLICT_REGISTER.md",
    "D9_415_D9_416_NEXT_RUN_INPUTS.md",
    "D9_415_ENTITLEMENT_BEHAVIOR_DEFERRED_TO_D9_416.md",
    "D9_415_MATRIX_PASSPORT_PATCH_PROPOSAL.md",
    "D9_415_FILE_MANIFEST.md",
    "D9_415_EXECUTION_REPORT.md",
]

SUPPLEMENTAL_MARKDOWN = [
    "D9_415_DEDICATED_BRANCH_REVIEW.md",
    "evidence/WAVE_1_SUBAGENT_A.md",
    "evidence/WAVE_1_SUBAGENT_B.md",
    "evidence/WAVE_1_SUBAGENT_C.md",
    "evidence/WAVE_1_SUBAGENT_D.md",
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tracked_handoff_files() -> list[Path]:
    repo_root = Path(
        subprocess.run(
            ["git", "-C", str(HANDOFF), "rev-parse", "--show-toplevel"],
            check=True,
            stdout=subprocess.PIPE,
            text=True,
        ).stdout.strip()
    ).resolve()
    handoff_relative = HANDOFF.relative_to(repo_root).as_posix()
    tracked = subprocess.run(
        [
            "git",
            "-C",
            str(repo_root),
            "ls-files",
            "--cached",
            "--full-name",
            "-z",
            "--",
            handoff_relative,
        ],
        check=True,
        stdout=subprocess.PIPE,
    ).stdout

    files: list[Path] = []
    for item in tracked.split(b"\0"):
        if not item:
            continue
        path = repo_root / item.decode("utf-8")
        if not path.exists():
            raise RuntimeError(f"tracked handoff path is missing: {path}")
        if path.is_symlink():
            raise RuntimeError(f"tracked handoff symlink is forbidden: {path}")
        if not path.is_file():
            raise RuntimeError(f"tracked handoff path is not a file: {path}")
        files.append(path)
    return sorted(files, key=lambda item: item.relative_to(HANDOFF).as_posix())


def final_handoff_sources() -> list[Path]:
    excluded = {
        FILE_MANIFEST.resolve(),
        COMBINED.resolve(),
    }
    files: list[Path] = []
    for path in tracked_handoff_files():
        if path.resolve() in excluded:
            continue
        relative = path.relative_to(HANDOFF)
        if "forensic_snapshot_raw" in relative.parts:
            continue
        files.append(path)
    return sorted(files, key=lambda item: item.relative_to(HANDOFF).as_posix())


def build_file_manifest() -> dict[str, object]:
    rows: list[tuple[str, int, str]] = []
    aggregate_lines: list[str] = []
    for path in final_handoff_sources():
        data = path.read_bytes()
        relative = path.relative_to(HANDOFF).as_posix()
        digest = sha256(data)
        rows.append((digest, len(data), relative))
        aggregate_lines.append(f"{digest}  {len(data)}  {relative}")
    aggregate_bytes = ("\n".join(aggregate_lines) + "\n").encode("utf-8")
    aggregate_sha = sha256(aggregate_bytes)
    lines = [
        "# D9-415 File Manifest",
        "",
        "This deterministic manifest covers every Git-tracked final handoff file present before the manifest and combined file are generated. It excludes the raw forensic snapshot, itself, and the combined handoff to avoid recursive hashes. The final response separately reports the combined-file SHA-256 and the post-commit aggregate for the exact mirrored tracked handoff set.",
        "",
        f"- Source file count: {len(rows)}.",
        f"- Sorted source-manifest aggregate SHA-256: `{aggregate_sha}`.",
        "- Symlinks: excluded and forbidden.",
        "- Matched secret/private values: never emitted.",
        "",
        "| SHA-256 | Bytes | Relative path |",
        "|---|---:|---|",
    ]
    lines.extend(f"| `{digest}` | {size} | `{relative}` |" for digest, size, relative in rows)
    FILE_MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {
        "source_file_count": len(rows),
        "source_manifest_aggregate_sha256": aggregate_sha,
        "file_manifest_sha256": sha256(FILE_MANIFEST.read_bytes()),
    }


def build_combined() -> dict[str, object]:
    ordered = REQUIRED_MARKDOWN + SUPPLEMENTAL_MARKDOWN
    expected = {Path(item).as_posix() for item in ordered}
    observed = {
        path.relative_to(HANDOFF).as_posix()
        for path in tracked_handoff_files()
        if path.suffix == ".md"
        and path.name not in {INTERIM_COMBINED, COMBINED.name}
        and "forensic_snapshot_raw" not in path.relative_to(HANDOFF).parts
    }
    if observed != expected:
        raise RuntimeError(
            "standalone Markdown accounting mismatch: "
            f"missing={sorted(expected - observed)} extra={sorted(observed - expected)}"
        )

    output = bytearray()
    output.extend(
        (
            "# D9-415 Complete Combined Handoff\n\n"
            "Ticket: `D9-MATRIX-PLAN-415`\n\n"
            "This file mechanically embeds every required Markdown deliverable verbatim in mandated logical order, followed by all standalone Wave 1/dedicated-review Markdown evidence. Machine-readable JSON remains separate. The prior blocked combined artifact is retained separately and is not nested here.\n\n"
            "## Required Markdown deliverables\n\n"
        ).encode("utf-8")
    )
    embedded_hashes: list[dict[str, object]] = []
    for index, relative in enumerate(ordered):
        if index == len(REQUIRED_MARKDOWN):
            output.extend(b"## Supplemental standalone Markdown evidence\n\n")
        path = HANDOFF / relative
        data = path.read_bytes()
        if not data.endswith(b"\n"):
            raise RuntimeError(f"Markdown source lacks final newline: {relative}")
        begin = f"<!-- BEGIN VERBATIM FILE: {relative} -->\n".encode("utf-8")
        end = f"<!-- END VERBATIM FILE: {relative} -->\n\n".encode("utf-8")
        output.extend(begin)
        output.extend(data)
        output.extend(end)
        embedded_hashes.append(
            {"path": relative, "sha256": sha256(data), "byte_size": len(data)}
        )
    COMBINED.write_bytes(bytes(output))

    combined_bytes = COMBINED.read_bytes()
    for item in embedded_hashes:
        relative = str(item["path"])
        data = (HANDOFF / relative).read_bytes()
        segment = (
            f"<!-- BEGIN VERBATIM FILE: {relative} -->\n".encode("utf-8")
            + data
            + f"<!-- END VERBATIM FILE: {relative} -->\n\n".encode("utf-8")
        )
        if combined_bytes.count(segment) != 1:
            raise RuntimeError(f"combined verbatim verification failed: {relative}")
    return {
        "required_markdown_count": len(REQUIRED_MARKDOWN),
        "supplemental_markdown_count": len(SUPPLEMENTAL_MARKDOWN),
        "embedded_markdown_count": len(ordered),
        "combined_byte_size": len(combined_bytes),
        "combined_sha256": sha256(combined_bytes),
        "verbatim_verification": "PASS",
    }


def main() -> int:
    manifest = build_file_manifest()
    combined = build_combined()
    print(json.dumps({"manifest": manifest, "combined": combined}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
