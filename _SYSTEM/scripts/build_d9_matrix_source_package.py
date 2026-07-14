#!/usr/bin/env python3
"""Build a deterministic, non-deploying D9 Matrix source archive."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_POLICY = (
    ROOT
    / "_SYSTEM"
    / "BASELINES"
    / "D9_MATRIX_RUNTIME_2026_07_13"
    / "D9_MATRIX_PACKAGE_POLICY.json"
)


@dataclass(frozen=True)
class SourceFile:
    source_path: str
    archive_path: str
    mode: int
    data: bytes

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()

    @property
    def byte_size(self) -> int:
        return len(self.data)


def git(*args: str, check: bool = True, binary: bool = False) -> bytes | str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=False, capture_output=True
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({result.returncode}): "
            f"{result.stderr.decode('utf-8', errors='replace').strip()}"
        )
    return result.stdout if binary else result.stdout.decode("utf-8").strip()


def git_bytes(ref: str, path: str) -> bytes:
    return git("show", f"{ref}:{path}", binary=True)  # type: ignore[return-value]


def tracked_json(ref: str, path: str) -> dict[str, Any]:
    return json.loads(git_bytes(ref, path).decode("utf-8"))


def ensure_clean_worktree() -> None:
    status = str(git("status", "--porcelain=v1", "--untracked-files=all"))
    if status:
        raise RuntimeError("dirty worktree; deterministic packaging refuses to run")


def ls_tree_files(ref: str, root: str) -> dict[str, tuple[str, str]]:
    raw = git("ls-tree", "-r", "-z", ref, "--", root, binary=True)
    result: dict[str, tuple[str, str]] = {}
    for record in bytes(raw).split(b"\0"):
        if not record:
            continue
        metadata, path_raw = record.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        path = path_raw.decode("utf-8")
        if kind != "blob":
            raise RuntimeError(f"non-blob source entry: {path}: {kind}")
        result[path] = (mode, object_id)
    return result


def parse_plugin_version(data: bytes) -> str:
    match = re.search(rb"^\s*\*\s*Version:\s*(\S+)", data, re.MULTILINE)
    if not match:
        raise RuntimeError("MissionMed Hub plugin version header is missing")
    return match.group(1).decode("ascii")


def load_context(policy_path: Path = DEFAULT_POLICY) -> dict[str, Any]:
    ensure_clean_worktree()
    policy_rel = policy_path.resolve().relative_to(ROOT).as_posix()
    policy = tracked_json("HEAD", policy_rel)
    source_commit = policy["runtime_source_commit"]
    source_tree = str(git("show", "-s", "--format=%T", source_commit))
    if source_tree != policy["runtime_source_tree"]:
        raise RuntimeError("runtime source tree does not match package policy")
    if subprocess.run(
        ["git", "merge-base", "--is-ancestor", source_commit, "HEAD"], cwd=ROOT
    ).returncode != 0:
        raise RuntimeError("runtime source commit is not an ancestor of HEAD")

    plugin_root = policy["plugin_root"]
    if subprocess.run(
        ["git", "diff", "--quiet", source_commit, "HEAD", "--", plugin_root], cwd=ROOT
    ).returncode != 0:
        raise RuntimeError("plugin runtime drifted after the pinned source commit")

    provenance = tracked_json("HEAD", policy["production_hash_map"])
    mu_manifest = tracked_json("HEAD", policy["mu_active_manifest"])
    source_lock = tracked_json("HEAD", policy["runtime_source_lock"])
    plugin_tree = ls_tree_files(source_commit, plugin_root)
    if len(plugin_tree) != policy["expected_complete_plugin_file_count"]:
        raise RuntimeError(
            f"complete plugin count mismatch: {len(plugin_tree)} != "
            f"{policy['expected_complete_plugin_file_count']}"
        )

    plugin_map = {
        entry["git_path"]: entry
        for entry in provenance["path_comparisons"]
        if entry["production_scope"] == "missionmed-hub"
    }
    if set(plugin_tree) != set(plugin_map):
        missing = sorted(set(plugin_map) - set(plugin_tree))
        extra = sorted(set(plugin_tree) - set(plugin_map))
        raise RuntimeError(f"plugin provenance path mismatch: missing={missing} extra={extra}")
    for path, entry in plugin_map.items():
        data = git_bytes(source_commit, path)
        if hashlib.sha256(data).hexdigest() != entry["production_sha256"]:
            raise RuntimeError(f"plugin production hash mismatch: {path}")
        if len(data) != entry["production_byte_size"]:
            raise RuntimeError(f"plugin production size mismatch: {path}")
        if plugin_tree[path][0] != "100644":
            raise RuntimeError(f"plugin file mode is not 100644: {path}")

    intended_mu = mu_manifest["intended_active"]
    if len(intended_mu) != policy["expected_intended_mu_file_count"]:
        raise RuntimeError("intended-active MU count mismatch")
    mu_paths = [entry["path"] for entry in intended_mu]
    for path in mu_paths:
        if subprocess.run(
            ["git", "diff", "--quiet", source_commit, "HEAD", "--", path], cwd=ROOT
        ).returncode != 0:
            raise RuntimeError(f"intended-active MU runtime drifted after source commit: {path}")
    for entry in intended_mu:
        data = git_bytes(source_commit, entry["path"])
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise RuntimeError(f"intended-active MU hash mismatch: {entry['path']}")
        if len(data) != entry["byte_size"]:
            raise RuntimeError(f"intended-active MU size mismatch: {entry['path']}")
        tree_entry = ls_tree_files(source_commit, entry["path"])
        if tree_entry.get(entry["path"], (None,))[0] != "100644":
            raise RuntimeError(f"intended-active MU mode mismatch: {entry['path']}")

    for entry in mu_manifest["quarantined_from_active_source"]:
        if subprocess.run(
            ["git", "cat-file", "-e", f"HEAD:{entry['observed_production_path']}"],
            cwd=ROOT,
            capture_output=True,
        ).returncode == 0:
            raise RuntimeError(f"quarantined backup remains active: {entry['observed_production_path']}")
        forensic = git_bytes("HEAD", entry["forensic_path"])
        if hashlib.sha256(forensic).hexdigest() != entry["sha256"]:
            raise RuntimeError(f"quarantine preservation hash mismatch: {entry['forensic_path']}")

    protected = source_lock["protected_assets"]
    for key, entry in protected.items():
        observed = hashlib.sha256(git_bytes(source_commit, entry["path"])).hexdigest()
        if observed != entry["observed_sha256"]:
            raise RuntimeError(f"protected hash mismatch: {key}: {entry['path']}")

    exclusions = set(policy["excluded_plugin_paths"])
    if not exclusions.issubset(plugin_tree):
        raise RuntimeError(f"package exclusions are missing from source: {sorted(exclusions - set(plugin_tree))}")
    package_plugin_paths = sorted(set(plugin_tree) - exclusions)
    if len(package_plugin_paths) != policy["expected_package_plugin_file_count"]:
        raise RuntimeError("package plugin count mismatch")

    main_path = f"{plugin_root}/missionmed-hub.php"
    plugin_version = parse_plugin_version(git_bytes(source_commit, main_path))
    if plugin_version != policy["plugin_version"]:
        raise RuntimeError(f"plugin version mismatch: {plugin_version} != {policy['plugin_version']}")

    archive_root = policy["archive_root"]
    files: list[SourceFile] = []
    for path in package_plugin_paths + sorted(mu_paths):
        files.append(
            SourceFile(
                source_path=path,
                archive_path=f"{archive_root}/{path}",
                mode=0o644,
                data=git_bytes(source_commit, path),
            )
        )
    if len(files) != policy["expected_package_source_file_count"]:
        raise RuntimeError("total package source count mismatch")

    forbidden_components = set(policy["forbidden_archive_components"])
    for source_file in files:
        components = set(PurePosixPath(source_file.archive_path).parts)
        if components & forbidden_components:
            raise RuntimeError(f"forbidden package component: {source_file.archive_path}")

    return {
        "policy": policy,
        "source_commit": source_commit,
        "source_tree": source_tree,
        "source_commit_epoch": int(str(git("show", "-s", "--format=%ct", source_commit))),
        "plugin_version": plugin_version,
        "files": files,
    }


def canonical_json(payload: object) -> bytes:
    return (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")


def source_manifest(context: dict[str, Any]) -> dict[str, Any]:
    entries = [
        {
            "archive_path": item.archive_path,
            "byte_size": item.byte_size,
            "mode": "0644",
            "sha256": item.sha256,
            "source_path": item.source_path,
        }
        for item in context["files"]
    ]
    return {
        "schema_version": "1.0",
        "source_commit": context["source_commit"],
        "source_tree": context["source_tree"],
        "file_count": len(entries),
        "total_bytes": sum(entry["byte_size"] for entry in entries),
        "entries": entries,
    }


def package_metadata(context: dict[str, Any], manifest_sha256: str) -> dict[str, Any]:
    policy = context["policy"]
    return {
        "schema_version": "1.0",
        "ticket": policy["ticket"],
        "package_name": policy["package_name"],
        "branch": policy["canonical_branch"],
        "source_commit": context["source_commit"],
        "source_tree": context["source_tree"],
        "source_commit_epoch": context["source_commit_epoch"],
        "plugin_version": context["plugin_version"],
        "source_file_count": len(context["files"]),
        "source_manifest_sha256": manifest_sha256,
        "excluded_plugin_paths": policy["excluded_plugin_paths"],
        "generated_from_tracked_source_only": True,
        "deterministic_tar_mtime": context["source_commit_epoch"],
        "deterministic_gzip_mtime": 0,
        "deployable": False,
        "deployment_side_effects": "NONE",
    }


def add_tar_entry(archive: tarfile.TarFile, name: str, data: bytes, mode: int, mtime: int) -> None:
    info = tarfile.TarInfo(name=name)
    info.size = len(data)
    info.mode = mode
    info.mtime = mtime
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    archive.addfile(info, io.BytesIO(data))


def add_tar_directory(archive: tarfile.TarFile, name: str, mtime: int) -> None:
    info = tarfile.TarInfo(name=name.rstrip("/") + "/")
    info.type = tarfile.DIRTYPE
    info.size = 0
    info.mode = 0o755
    info.mtime = mtime
    info.uid = 0
    info.gid = 0
    info.uname = ""
    info.gname = ""
    archive.addfile(info)


def build_package(context: dict[str, Any], output: Path) -> dict[str, Any]:
    manifest = source_manifest(context)
    manifest_bytes = canonical_json(manifest)
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    metadata = package_metadata(context, manifest_sha)
    metadata_bytes = canonical_json(metadata)
    archive_root = context["policy"]["archive_root"]
    virtual_files = [
        SourceFile(
            source_path="generated:PACKAGE_METADATA.json",
            archive_path=f"{archive_root}/.missionmed-package/PACKAGE_METADATA.json",
            mode=0o644,
            data=metadata_bytes,
        ),
        SourceFile(
            source_path="generated:SOURCE_MANIFEST.json",
            archive_path=f"{archive_root}/.missionmed-package/SOURCE_MANIFEST.json",
            mode=0o644,
            data=manifest_bytes,
        ),
        *context["files"],
    ]
    directories: set[str] = set()
    for item in virtual_files:
        parent = PurePosixPath(item.archive_path).parent
        while str(parent) not in (".", ""):
            directories.add(str(parent))
            parent = parent.parent

    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as raw_handle:
        with gzip.GzipFile(
            filename="", fileobj=raw_handle, mode="wb", compresslevel=9, mtime=0
        ) as gzip_handle:
            with tarfile.open(
                fileobj=gzip_handle, mode="w", format=tarfile.PAX_FORMAT
            ) as archive:
                for directory in sorted(directories, key=lambda value: (value.count("/"), value)):
                    add_tar_directory(archive, directory, context["source_commit_epoch"])
                for item in sorted(virtual_files, key=lambda value: value.archive_path):
                    add_tar_entry(
                        archive,
                        item.archive_path,
                        item.data,
                        item.mode,
                        context["source_commit_epoch"],
                    )

    package_bytes = output.read_bytes()
    summary = {
        "result": "PASS",
        "package_sha256": hashlib.sha256(package_bytes).hexdigest(),
        "package_byte_size": len(package_bytes),
        "source_manifest_sha256": manifest_sha,
        "source_file_count": manifest["file_count"],
        "source_total_bytes": manifest["total_bytes"],
        "archive_file_count": len(virtual_files),
        "source_commit": context["source_commit"],
        "source_tree": context["source_tree"],
        "branch": context["policy"]["canonical_branch"],
        "plugin_version": context["plugin_version"],
        "deployable": False,
        "deployment_side_effects": "NONE",
    }
    Path(str(output) + ".metadata.json").write_bytes(canonical_json(summary))
    Path(str(output) + ".source-manifest.json").write_bytes(manifest_bytes)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    try:
        context = load_context(args.policy)
        manifest = source_manifest(context)
        result: dict[str, Any] = {
            "result": "PASS",
            "source_commit": context["source_commit"],
            "source_tree": context["source_tree"],
            "branch": context["policy"]["canonical_branch"],
            "plugin_version": context["plugin_version"],
            "source_file_count": manifest["file_count"],
            "source_total_bytes": manifest["total_bytes"],
            "source_manifest_sha256": hashlib.sha256(canonical_json(manifest)).hexdigest(),
            "deployable": False,
            "deployment_side_effects": "NONE",
        }
        if not args.verify_only:
            if args.output is None:
                raise RuntimeError("--output is required unless --verify-only is used")
            if ROOT == args.output.resolve() or ROOT in args.output.resolve().parents:
                raise RuntimeError("package output must be outside the repository")
            result = build_package(context, args.output)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as exc:
        print(json.dumps({"result": "FAIL", "error": str(exc)}, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
