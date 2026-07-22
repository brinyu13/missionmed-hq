#!/usr/bin/env python3
"""Create the stable I1Q-3000 artifact manifest and checksum seal."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "ARTIFACT_MANIFEST.json"
CHECKSUMS = ROOT / "CHECKSUMS.sha256"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def files(*, include_manifest: bool) -> list[Path]:
    excluded = {CHECKSUMS}
    if not include_manifest:
        excluded.add(MANIFEST)
    return sorted(
        path for path in ROOT.rglob("*")
        if path.is_file()
        and path not in excluded
        and "__pycache__" not in path.parts
        and path.suffix != ".pyc"
    )


def main() -> None:
    payload_files = files(include_manifest=False)
    entries = [{
        "path": path.relative_to(ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    } for path in payload_files]
    suffix_counts = Counter((path.suffix.lower() or "no-extension") for path in payload_files)
    manifest_payload = {
        "schema_version": "i1q-3000-artifact-manifest-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ticket": "I1Q-3000",
        "authority_boundary": "Read-only design archaeology; no product adoption or production authorization.",
        "payload_file_count": len(entries),
        "payload_bytes": sum(entry["bytes"] for entry in entries),
        "by_suffix": dict(sorted(suffix_counts.items())),
        "files": entries,
    }
    MANIFEST.write_text(json.dumps(manifest_payload, indent=2) + "\n", encoding="utf-8")

    sealed_files = files(include_manifest=True)
    lines = [f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}" for path in sealed_files]
    CHECKSUMS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "payload_files": len(entries),
        "sealed_files": len(sealed_files),
        "checksum_file": CHECKSUMS.name,
        "manifest_file": MANIFEST.name,
    }, indent=2))


if __name__ == "__main__":
    main()
