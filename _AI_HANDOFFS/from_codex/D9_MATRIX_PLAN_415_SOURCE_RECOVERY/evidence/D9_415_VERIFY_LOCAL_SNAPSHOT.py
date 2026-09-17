#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import os
import stat
import sys
from pathlib import Path


def digest(path: Path, algorithm: str) -> str:
    value = hashlib.new(algorithm)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def load_manifest(path: Path) -> dict[tuple[str, str], dict[str, str]]:
    entries: dict[tuple[str, str], dict[str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) != 8:
            raise ValueError("manifest row does not have eight fields")
        scope, rel, kind, size, mode, sha256, md5, target_b64 = fields
        key = (scope, rel)
        if key in entries:
            raise ValueError(f"duplicate manifest key: {scope}/{rel}")
        entries[key] = {
            "type": kind,
            "size": size,
            "mode": mode,
            "sha256": sha256,
            "md5": md5,
            "target_b64": target_b64,
        }
    return entries


def local_entries(root: Path, scope: str) -> dict[tuple[str, str], Path]:
    found: dict[tuple[str, str], Path] = {(scope, "."): root}
    for current, dirs, files in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        names = list(dirs) + list(files)
        for name in names:
            item = current_path / name
            rel = item.relative_to(root).as_posix()
            found[(scope, rel)] = item
        dirs[:] = [name for name in dirs if not (current_path / name).is_symlink()]
    return found


def kind_for(mode: int) -> str:
    if stat.S_ISREG(mode):
        return "f"
    if stat.S_ISDIR(mode):
        return "d"
    if stat.S_ISLNK(mode):
        return "l"
    if stat.S_ISFIFO(mode):
        return "p"
    if stat.S_ISSOCK(mode):
        return "s"
    if stat.S_ISBLK(mode):
        return "b"
    if stat.S_ISCHR(mode):
        return "c"
    return "o"


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: verifier MANIFEST SNAPSHOT_ROOT")
    manifest_path = Path(sys.argv[1])
    snapshot_root = Path(sys.argv[2])
    roots = {
        "missionmed-hub": snapshot_root / "wp-content/plugins/missionmed-hub",
        "mu-plugins": snapshot_root / "wp-content/mu-plugins",
    }
    expected = load_manifest(manifest_path)
    observed: dict[tuple[str, str], Path] = {}
    for scope, root in roots.items():
        if not root.is_dir():
            raise FileNotFoundError(f"snapshot scope missing: {scope}")
        observed.update(local_entries(root, scope))

    mismatches: list[dict[str, str]] = []
    for key in sorted(set(expected) | set(observed)):
        scope, rel = key
        if key not in expected:
            mismatches.append({"path": f"{scope}/{rel}", "reason": "unexpected_local_entry"})
            continue
        if key not in observed:
            mismatches.append({"path": f"{scope}/{rel}", "reason": "missing_local_entry"})
            continue
        item = observed[key]
        wanted = expected[key]
        info = item.lstat()
        actual_kind = kind_for(info.st_mode)
        actual_mode = format(stat.S_IMODE(info.st_mode), "o")
        if actual_kind != wanted["type"]:
            mismatches.append({"path": f"{scope}/{rel}", "reason": "type_mismatch"})
            continue
        if actual_mode != wanted["mode"]:
            mismatches.append({"path": f"{scope}/{rel}", "reason": "mode_mismatch"})
        if actual_kind == "f":
            if str(info.st_size) != wanted["size"]:
                mismatches.append({"path": f"{scope}/{rel}", "reason": "size_mismatch"})
            if digest(item, "sha256") != wanted["sha256"]:
                mismatches.append({"path": f"{scope}/{rel}", "reason": "sha256_mismatch"})
            if digest(item, "md5") != wanted["md5"]:
                mismatches.append({"path": f"{scope}/{rel}", "reason": "md5_mismatch"})
        elif actual_kind == "l":
            target = os.readlink(item)
            encoded = base64.b64encode(os.fsencode(target)).decode("ascii")
            if encoded != wanted["target_b64"]:
                mismatches.append({"path": f"{scope}/{rel}", "reason": "symlink_target_mismatch"})
            if hashlib.sha256(os.fsencode(target)).hexdigest() != wanted["sha256"]:
                mismatches.append({"path": f"{scope}/{rel}", "reason": "symlink_sha256_mismatch"})

    result = {
        "schema_version": "1.0",
        "expected_entries": len(expected),
        "observed_entries": len(observed),
        "mismatch_count": len(mismatches),
        "mismatches": mismatches,
        "directory_size_comparison": "omitted_cross_filesystem",
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not mismatches else 1


if __name__ == "__main__":
    raise SystemExit(main())
