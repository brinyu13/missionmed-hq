#!/usr/bin/env python3
"""Fail-closed validator for the D9 Matrix intended-active MU-plugin set."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = (
    ROOT
    / "_SYSTEM"
    / "BASELINES"
    / "D9_MATRIX_RUNTIME_2026_07_13"
    / "D9_MATRIX_MU_INTENDED_ACTIVE.json"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--repo-root", type=Path, default=ROOT)
    parser.add_argument(
        "--strict-top-level",
        type=Path,
        help="Validate a package/runtime MU root; every top-level PHP must be intended-active.",
    )
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    patterns = [re.compile(pattern) for pattern in manifest["forbidden_executable_top_level_patterns"]]
    intended = manifest["intended_active"]
    intended_names = {Path(entry["path"]).name for entry in intended}
    errors: list[str] = []

    if len(intended_names) != len(intended):
        errors.append("duplicate intended-active basename")

    for entry in intended:
        relative = Path(entry["path"])
        source = args.repo_root / relative
        if any(pattern.fullmatch(relative.name) for pattern in patterns):
            errors.append(f"forbidden intended-active filename: {relative.name}")
        if not source.exists():
            errors.append(f"missing intended-active file: {relative}")
            continue
        if source.is_symlink() or not source.is_file():
            errors.append(f"intended-active path is not a regular file: {relative}")
            continue
        observed_size = source.stat().st_size
        observed_sha = sha256(source)
        if observed_size != entry["byte_size"]:
            errors.append(
                f"size mismatch: {relative}: expected {entry['byte_size']} observed {observed_size}"
            )
        if observed_sha != entry["sha256"]:
            errors.append(
                f"SHA-256 mismatch: {relative}: expected {entry['sha256']} observed {observed_sha}"
            )

    for entry in manifest["quarantined_from_active_source"]:
        active = args.repo_root / entry["observed_production_path"]
        forensic = args.repo_root / entry["forensic_path"]
        if active.exists():
            errors.append(f"quarantined executable remains active: {entry['observed_production_path']}")
        if not forensic.is_file() or forensic.is_symlink():
            errors.append(f"missing regular forensic preservation: {entry['forensic_path']}")
        elif forensic.stat().st_size != entry["byte_size"] or sha256(forensic) != entry["sha256"]:
            errors.append(f"forensic preservation mismatch: {entry['forensic_path']}")

    strict_files: list[str] = []
    if args.strict_top_level is not None:
        if not args.strict_top_level.is_dir():
            errors.append(f"strict top-level root is not a directory: {args.strict_top_level}")
        else:
            strict_paths = sorted(args.strict_top_level.glob("*.php"))
            strict_files = [path.name for path in strict_paths]
            for path in strict_paths:
                if path.is_symlink() or not path.is_file():
                    errors.append(f"strict top-level entry is not a regular file: {path.name}")
                if any(pattern.fullmatch(path.name) for pattern in patterns):
                    errors.append(f"forbidden executable backup pattern: {path.name}")
            extras = set(strict_files) - intended_names
            missing = intended_names - set(strict_files)
            if extras:
                errors.append("unexpected strict top-level PHP: " + ", ".join(sorted(extras)))
            if missing:
                errors.append("missing strict top-level PHP: " + ", ".join(sorted(missing)))

    result = {
        "result": "FAIL" if errors else "PASS",
        "manifest": str(args.manifest),
        "intended_active_count": len(intended),
        "strict_top_level": str(args.strict_top_level) if args.strict_top_level else None,
        "strict_top_level_php": strict_files,
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
