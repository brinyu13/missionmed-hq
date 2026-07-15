#!/usr/bin/env python3
"""Deterministic evidence-manifest and combined-handoff builder for V1-8010A."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
CORPUS_ROOT = Path("/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES")
PACKAGES = [
    "D9_MATRIX_STUDY_SCHEDULER_100",
    "D9_MATRIX_STUDY_SCHEDULER_200",
    "D9_MATRIX_STUDY_SCHEDULER_300",
    "D9_MATRIX_STUDY_SCHEDULER_350",
    "D9_MATRIX_STUDY_SCHEDULER_360",
]
ARCHIVE = Path(
    "/Users/brianb/MissionMed_Backups/V1_STUDY_SCHEDULE_8010A/"
    "V1_STUDY_SCHEDULE_HISTORICAL_CORPUS_20260715T025323Z.tar.gz"
)
ARCHIVE_SHA256 = "c2584123205b47e4566d51b3a0f88cf850df509bfd2c0bdb9b8915b683f22c01"

COMBINED = HERE / "V1_8010A_COMPLETE_COMBINED_HANDOFF.md"
FILE_MANIFEST = HERE / "V1_8010A_FILE_MANIFEST.md"
INPUT_JSON = HERE / "V1_8010A_ACCEPTED_INPUT_MANIFEST.json"
INPUT_MD = HERE / "V1_8010A_ACCEPTED_INPUT_MANIFEST.md"

EMBED_ORDER = [
    "V1_8010A_AUTHORIZATION_RECORD.md",
    "V1_8010A_PRODUCT_IDENTITY_LEDGER.md",
    "V1_8010A_DECISION_LEDGER.md",
    *[f"V1_8010A_DECISION_{number:02d}.md" for number in range(1, 15)],
    "V1_8010A_ACCEPTED_INPUT_MANIFEST.md",
    "V1_8010A_CHARACTERIZATION_BASELINE.md",
    "V1_8010A_INDEPENDENT_VERIFICATION.md",
    "V1_8010A_IMPLEMENTATION_SEQUENCE.md",
    "V1_8010A_BLOCKER_REGISTER.md",
    "V1_8010A_EVIDENCE_INDEX.md",
    "V1_8010A_COMMAND_LOG.md",
    "V1_8010A_FILE_MANIFEST.md",
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_bytes(path: Path) -> bytes:
    return path.read_bytes()


def write_if_changed(path: Path, data: bytes) -> None:
    if path.exists() and read_bytes(path) == data:
        return
    path.write_bytes(data)


def capture_corpus() -> None:
    entries: list[dict[str, object]] = []
    packages: list[dict[str, object]] = []
    for package in PACKAGES:
        package_root = CORPUS_ROOT / package
        package_entries: list[dict[str, object]] = []
        for path in sorted(item for item in package_root.rglob("*") if item.is_file()):
            raw = read_bytes(path)
            entry = {
                "package": package,
                "relative_path": path.relative_to(package_root).as_posix(),
                "size_bytes": len(raw),
                "sha256": sha256_bytes(raw),
            }
            entries.append(entry)
            package_entries.append(entry)
        normalized = b"".join(
            (
                f"{entry['relative_path']}\t{entry['size_bytes']}\t{entry['sha256']}\n"
            ).encode("utf-8")
            for entry in package_entries
        )
        packages.append(
            {
                "package": package,
                "file_count": len(package_entries),
                "size_bytes": sum(int(entry["size_bytes"]) for entry in package_entries),
                "normalized_manifest_sha256": sha256_bytes(normalized),
            }
        )

    archive_size = ARCHIVE.stat().st_size if ARCHIVE.exists() else None
    archive_digest = sha256_bytes(read_bytes(ARCHIVE)) if ARCHIVE.exists() else None
    if archive_digest != ARCHIVE_SHA256:
        raise SystemExit("private archive digest mismatch or archive unavailable")

    manifest = {
        "schema": "missionmed.v1-study-schedule.accepted-input-manifest.v1",
        "product": "V1 Study Schedule",
        "captured_utc": "2026-07-15T02:53:23Z",
        "source_root_recorded_for_local_verification": str(CORPUS_ROOT),
        "archive": {
            "path": str(ARCHIVE),
            "sha256": ARCHIVE_SHA256,
            "size_bytes": archive_size,
            "mode": "0600",
            "restore_verification": "all five package trees passed diff -qr",
        },
        "summary": {
            "file_count": len(entries),
            "size_bytes": sum(int(entry["size_bytes"]) for entry in entries),
        },
        "packages": packages,
        "entries": entries,
        "distribution": {
            "raw_corpus_tracked_in_public_repository": False,
            "quote_reuse_authorized": False,
            "reason": "integrity and attribution evidence do not establish publication or content rights",
        },
    }
    write_if_changed(
        INPUT_JSON,
        (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )

    lines = [
        "# V1-8010A Accepted Product-Input Manifest",
        "",
        "This is a hash-only provenance record for the historical V1 Study Schedule corpus. "
        "No raw prototype or quote content is reproduced here.",
        "",
        f"- Files: **{manifest['summary']['file_count']}**",
        f"- Bytes: **{manifest['summary']['size_bytes']}**",
        f"- Private archive SHA-256: `{ARCHIVE_SHA256}`",
        "- Archive permissions: `0600`",
        "- Restore test: all five extracted package trees passed `diff -qr` against their accepted sources.",
        "- Public distribution: **not authorized by this record**.",
        "- Quote reuse: **disabled pending verified source, attribution, and content-rights approval**.",
        "",
        "## Package manifests",
        "",
        "| Historical package | Files | Bytes | Normalized manifest SHA-256 |",
        "|---|---:|---:|---|",
    ]
    for package in packages:
        lines.append(
            f"| `{package['package']}` | {package['file_count']} | {package['size_bytes']} | "
            f"`{package['normalized_manifest_sha256']}` |"
        )
    lines.extend(
        [
            "",
            "## File integrity inventory",
            "",
            "| Package | Relative path | Bytes | SHA-256 |",
            "|---|---|---:|---|",
        ]
    )
    for entry in entries:
        lines.append(
            f"| `{entry['package']}` | `{entry['relative_path']}` | {entry['size_bytes']} | "
            f"`{entry['sha256']}` |"
        )
    lines.extend(
        [
            "",
            "The machine-readable equivalent is `V1_8010A_ACCEPTED_INPUT_MANIFEST.json`.",
            "",
        ]
    )
    write_if_changed(INPUT_MD, "\n".join(lines).encode("utf-8"))


def markdown_inputs() -> list[Path]:
    paths = []
    for name in EMBED_ORDER:
        path = HERE / name
        if path.exists() and path not in {COMBINED}:
            paths.append(path)
    known = {path.name for path in paths}
    extras = sorted(
        path
        for path in HERE.glob("*.md")
        if path.name not in known and path not in {COMBINED}
    )
    return paths + extras


def build_file_manifest() -> bytes:
    candidates = [
        path
        for path in sorted(HERE.iterdir(), key=lambda item: item.name)
        if path.is_file() and path not in {COMBINED, FILE_MANIFEST}
    ]
    lines = [
        "# V1-8010A File Manifest",
        "",
        "The manifest excludes itself and the generated combined handoff to avoid digest cycles.",
        "",
        "| File | Bytes | SHA-256 |",
        "|---|---:|---|",
    ]
    for path in candidates:
        raw = read_bytes(path)
        lines.append(f"| `{path.name}` | {len(raw)} | `{sha256_bytes(raw)}` |")
    lines.append("")
    return "\n".join(lines).encode("utf-8")


def build_combined() -> bytes:
    sections = [
        "# V1 Study Schedule 8010A — Full Complete Combined Handoff\n",
        "Generated deterministically by `V1_8010A_BUILD.py`. "
        "Every final Markdown deliverable is embedded verbatim; this file excludes itself.\n",
    ]
    for path in markdown_inputs():
        content = path.read_text(encoding="utf-8")
        sections.extend(
            [
                f"<!-- BEGIN EMBEDDED FILE: {path.name} -->\n",
                content.rstrip("\n") + "\n",
                f"<!-- END EMBEDDED FILE: {path.name} -->\n",
            ]
        )
    return "\n".join(sections).encode("utf-8")


def build(check: bool) -> None:
    expected_manifest = build_file_manifest()
    if check:
        if not FILE_MANIFEST.exists() or read_bytes(FILE_MANIFEST) != expected_manifest:
            raise SystemExit("file manifest is stale")
    else:
        write_if_changed(FILE_MANIFEST, expected_manifest)

    expected_combined = build_combined()
    if check:
        if not COMBINED.exists() or read_bytes(COMBINED) != expected_combined:
            raise SystemExit("combined handoff is stale")
    else:
        write_if_changed(COMBINED, expected_combined)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--capture-corpus", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.capture_corpus:
        capture_corpus()
    build(check=args.check)


if __name__ == "__main__":
    main()
