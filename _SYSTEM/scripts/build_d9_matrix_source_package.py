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

# D9-415E fail-closed trust anchors. These values are deliberately independent
# of the mutable JSON policy so a pull request cannot repin the recovered
# runtime, relax the package boundary, or redefine the provenance chain by
# changing JSON inputs alone.
TRUSTED_RUNTIME_SOURCE_COMMIT = "e12cd99aa9c019a6f99325c0b961aa50db945472"
TRUSTED_RUNTIME_SOURCE_TREE = "9e0408d93a37c0d6f73a4d06aa9da135b79c9b90"
TRUSTED_BASELINE_TAG = "d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713"
TRUSTED_BASELINE_COMMIT = "c340a3a87732f7dc4afb06c01e4586239a050495"
TRUSTED_POLICY_SHA256 = "6719d7820a3f5cd4397f68e048b4bce591b93aaaff2d19c15563965c674d23bf"
TRUSTED_PRODUCTION_HASH_MAP_PATH = (
    "_AI_HANDOFFS/from_codex/D9_MATRIX_PLAN_415_SOURCE_RECOVERY/"
    "D9_415_PRODUCTION_TO_GIT_HASH_MAP.json"
)
TRUSTED_PRODUCTION_HASH_MAP_SHA256 = "81046f4c828594667c6692521501d5d69bdd73035fc3dc99f0f0ba7e5b8ff63a"
TRUSTED_MU_MANIFEST_PATH = (
    "_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/"
    "D9_MATRIX_MU_INTENDED_ACTIVE.json"
)
TRUSTED_MU_MANIFEST_SHA256 = "dbfc6d5da0d64fa7071e437cd225de33dda658be2f60ac6a75d8b000cadd7803"
TRUSTED_SOURCE_LOCK_PATH = (
    "_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/"
    "D9_MATRIX_RUNTIME_SOURCE_LOCK.json"
)
TRUSTED_SOURCE_LOCK_SHA256 = "d9c5eeda6b244d1491f2c45f22736d4f31382940c38dd0285c1c4eed02e0e861"
TRUSTED_PLUGIN_ROOT = "wp-content/plugins/missionmed-hub"
TRUSTED_PLUGIN_VERSION = "1.5.1"
TRUSTED_ARCHIVE_ROOT = "missionmed-matrix-source"
TRUSTED_COMPLETE_PLUGIN_COUNT = 125
TRUSTED_PACKAGE_PLUGIN_COUNT = 120
TRUSTED_INTENDED_MU_COUNT = 9
TRUSTED_PACKAGE_SOURCE_COUNT = 129
TRUSTED_EXCLUDED_PLUGIN_PATHS = (
    "wp-content/plugins/missionmed-hub/CHANGELOG.md",
    "wp-content/plugins/missionmed-hub/MULTI_DIVISION_DASHBOARD_INTEGRATION.md",
    "wp-content/plugins/missionmed-hub/WEBEX_WIDGET_RESEARCH.md",
    "wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-sdk-tiles.inactive.js",
    "wp-content/plugins/missionmed-hub/assets/test-deploy.txt",
)
TRUSTED_PROTECTED_ASSETS = {
    "student_os_js": (
        "wp-content/plugins/missionmed-hub/assets/student-os.js",
        "646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a",
    ),
    "student_os_css": (
        "wp-content/plugins/missionmed-hub/assets/student-os.css",
        "111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33",
    ),
    "class_mmed_student_os_php": (
        "wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php",
        "23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29",
    ),
    "calendar_v4_js": (
        "wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js",
        "e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa",
    ),
    "calendar_v4_css": (
        "wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css",
        "6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e",
    ),
    "scheduler_mount_js": (
        "wp-content/plugins/missionmed-hub/assets/scheduler-mount.js",
        "2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578",
    ),
    "file_vault_js": (
        "wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js",
        "f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd",
    ),
    "file_vault_css": (
        "wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css",
        "6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990",
    ),
    "storyforge_js": (
        "wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js",
        "a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa",
    ),
    "storyforge_css": (
        "wp-content/plugins/missionmed-hub/assets/student-os-storyforge.css",
        "5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8",
    ),
}
TRUSTED_NO_PRODUCTION_COMMAND_PATTERNS = (
    "(?i)\\bssh\\s+[^\\n]+",
    "(?i)\\bscp\\s+[^\\n]+",
    "(?i)\\brsync\\s+[^\\n]+",
    "(?i)\\bgit\\s+push\\b",
    "(?i)\\bgh\\s+pr\\s+merge\\b",
    "(?i)\\bwp\\s+(?:plugin|option|cache|db)\\b",
    "(?i)\\bsupabase\\s+(?:db|migration|functions)\\b",
    "(?i)\\bcurl\\b[^\\n]*(?:-X|--request)\\s*(?:POST|PUT|PATCH|DELETE)",
    "(?i)\\bkubectl\\s+(?:apply|delete|patch|set)\\b",
    "(?i)\\bhelm\\s+(?:install|upgrade|uninstall)\\b",
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


def require_tracked_sha256(ref: str, path: str, expected: str) -> None:
    observed = hashlib.sha256(git_bytes(ref, path)).hexdigest()
    if observed != expected:
        raise RuntimeError(f"trusted input digest mismatch: {path}")


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
    if policy_path.resolve() != DEFAULT_POLICY.resolve():
        raise RuntimeError("alternate package policies are forbidden for the sealed D9-415 baseline")
    policy_rel = DEFAULT_POLICY.relative_to(ROOT).as_posix()
    require_tracked_sha256("HEAD", policy_rel, TRUSTED_POLICY_SHA256)
    policy = tracked_json("HEAD", policy_rel)
    fixed_policy = {
        "runtime_source_commit": TRUSTED_RUNTIME_SOURCE_COMMIT,
        "runtime_source_tree": TRUSTED_RUNTIME_SOURCE_TREE,
        "plugin_root": TRUSTED_PLUGIN_ROOT,
        "plugin_version": TRUSTED_PLUGIN_VERSION,
        "archive_root": TRUSTED_ARCHIVE_ROOT,
        "production_hash_map": TRUSTED_PRODUCTION_HASH_MAP_PATH,
        "mu_active_manifest": TRUSTED_MU_MANIFEST_PATH,
        "runtime_source_lock": TRUSTED_SOURCE_LOCK_PATH,
        "expected_complete_plugin_file_count": TRUSTED_COMPLETE_PLUGIN_COUNT,
        "expected_package_plugin_file_count": TRUSTED_PACKAGE_PLUGIN_COUNT,
        "expected_intended_mu_file_count": TRUSTED_INTENDED_MU_COUNT,
        "expected_package_source_file_count": TRUSTED_PACKAGE_SOURCE_COUNT,
    }
    for key, expected in fixed_policy.items():
        if policy.get(key) != expected:
            raise RuntimeError(f"sealed package policy field mismatch: {key}")
    if tuple(policy.get("excluded_plugin_paths", [])) != TRUSTED_EXCLUDED_PLUGIN_PATHS:
        raise RuntimeError("sealed package exclusion list mismatch")
    if tuple(policy.get("no_production_command_patterns", [])) != TRUSTED_NO_PRODUCTION_COMMAND_PATTERNS:
        raise RuntimeError("sealed production-command policy mismatch")
    require_tracked_sha256(
        "HEAD", TRUSTED_PRODUCTION_HASH_MAP_PATH, TRUSTED_PRODUCTION_HASH_MAP_SHA256
    )
    require_tracked_sha256("HEAD", TRUSTED_MU_MANIFEST_PATH, TRUSTED_MU_MANIFEST_SHA256)
    require_tracked_sha256("HEAD", TRUSTED_SOURCE_LOCK_PATH, TRUSTED_SOURCE_LOCK_SHA256)
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
    if set(protected) != set(TRUSTED_PROTECTED_ASSETS):
        raise RuntimeError("sealed protected-asset key set mismatch")
    for key, (path, digest) in TRUSTED_PROTECTED_ASSETS.items():
        if protected[key].get("path") != path or protected[key].get("observed_sha256") != digest:
            raise RuntimeError(f"sealed protected-asset authority mismatch: {key}")
    observed_baseline = source_lock.get("observed_baseline", {})
    if observed_baseline.get("tag") != TRUSTED_BASELINE_TAG:
        raise RuntimeError("sealed baseline tag name mismatch")
    if observed_baseline.get("commit") != TRUSTED_BASELINE_COMMIT:
        raise RuntimeError("sealed baseline tag target mismatch")
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
    archive_root_path = PurePosixPath(archive_root)
    if (
        archive_root_path.is_absolute()
        or len(archive_root_path.parts) != 1
        or archive_root_path.parts[0] in {"", ".", ".."}
    ):
        raise RuntimeError("archive root must be one safe relative path component")
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
