#!/usr/bin/env python3
"""Run the non-deploying D9 Matrix source validation matrix."""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path
from typing import Any

# Importing the local builder must not create an untracked __pycache__ that
# makes the validator dirty its own worktree before the clean-tree gate.
sys.dont_write_bytecode = True

from build_d9_matrix_source_package import (
    DEFAULT_POLICY,
    ROOT,
    TRUSTED_BASELINE_COMMIT,
    TRUSTED_BASELINE_TAG,
    TRUSTED_NO_PRODUCTION_COMMAND_PATTERNS,
    TRUSTED_PRODUCTION_HASH_MAP_PATH,
    build_package,
    load_context,
    require_tracked_sha256,
)


HANDOFF = ROOT / "_AI_HANDOFFS" / "from_codex" / "D9_MATRIX_PLAN_415_SOURCE_RECOVERY"
SCANNER = HANDOFF / "evidence" / "D9_415_REDACTED_SOURCE_SCAN.py"
MU_VALIDATOR = ROOT / "_SYSTEM" / "scripts" / "validate_d9_matrix_mu_active_set.py"
WORKFLOW = ROOT / ".github" / "workflows" / "d9-matrix-source-validation.yml"
BUILDER = ROOT / "_SYSTEM" / "scripts" / "build_d9_matrix_source_package.py"
TRUSTED_BUILDER_SHA256 = "763b6f07c2ffc683885972c6b9ad2479dc590e7c0de10bbf2ee59a5dec0875df"
TRUSTED_SCANNER_SHA256 = "80e4a1041649e72449c3ff01b8bd1b7e2f5c898d7f16e13f57894564a8b6e38e"
TRUSTED_MU_VALIDATOR_SHA256 = "3b90850360bfc1702804b8fca59c98028e22baa2634045ca55191fffbf903138"
TRUSTED_WORKFLOW_SHA256 = "9a1d37670fb9720066896c6a2b108339aecb29f851e1d7671a33c21350f989d1"
TRUSTED_CHECKOUT_ACTION = "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5"
EXPECTED_PHP_FILE_COUNT = 61
EXPECTED_JAVASCRIPT_FILE_COUNT = 29


def validate_trusted_dependencies() -> dict[str, Any]:
    trusted = {
        BUILDER.relative_to(ROOT).as_posix(): TRUSTED_BUILDER_SHA256,
        SCANNER.relative_to(ROOT).as_posix(): TRUSTED_SCANNER_SHA256,
        MU_VALIDATOR.relative_to(ROOT).as_posix(): TRUSTED_MU_VALIDATOR_SHA256,
        WORKFLOW.relative_to(ROOT).as_posix(): TRUSTED_WORKFLOW_SHA256,
    }
    for path, digest in trusted.items():
        require_tracked_sha256("HEAD", path, digest)
    return {
        "result": "PASS_HASH_SEALED",
        "trusted_dependency_count": len(trusted),
        "mutable_policy_override": False,
    }


def run(command: list[str], *, cwd: Path = ROOT, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=True)
    if check and result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"{result.stdout}{result.stderr}"
        )
    return result


def tool_version(tool: str, arguments: list[str]) -> str | None:
    executable = shutil.which(tool)
    if executable is None:
        return None
    result = run([executable, *arguments], check=False)
    return (result.stdout or result.stderr).splitlines()[0].strip()


def validate_json() -> int:
    raw = run(["git", "ls-files", "-z", "--", "*.json"]).stdout
    paths = [item for item in raw.split("\0") if item]
    for path in paths:
        json.loads((ROOT / path).read_text(encoding="utf-8"))
    return len(paths)


def validate_syntax(context: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    syntax_root = output_dir / "syntax"
    php = shutil.which("php")
    node = shutil.which("node")
    if php is None:
        raise RuntimeError("required PHP syntax tool is unavailable")
    if node is None:
        raise RuntimeError("required Node.js syntax tool is unavailable")
    php_count = 0
    js_count = 0
    for item in context["files"]:
        suffix = Path(item.source_path).suffix.lower()
        if suffix not in (".php", ".js"):
            continue
        destination = syntax_root / item.source_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(item.data)
        if suffix == ".php":
            run([php, "-l", str(destination)])
            php_count += 1
        elif suffix == ".js":
            run([node, "--check", str(destination)])
            js_count += 1
    if php_count != EXPECTED_PHP_FILE_COUNT:
        raise RuntimeError(
            f"PHP syntax file count mismatch: {php_count} != {EXPECTED_PHP_FILE_COUNT}"
        )
    if js_count != EXPECTED_JAVASCRIPT_FILE_COUNT:
        raise RuntimeError(
            "JavaScript syntax file count mismatch: "
            f"{js_count} != {EXPECTED_JAVASCRIPT_FILE_COUNT}"
        )
    return {
        "php": "PASS_REQUIRED_TOOL",
        "php_file_count": php_count,
        "javascript": "PASS_REQUIRED_TOOL",
        "javascript_file_count": js_count,
    }


def candidate_counter(items: list[dict[str, Any]], keys: tuple[str, ...]) -> collections.Counter[tuple[str, ...]]:
    return collections.Counter(tuple(str(item[key]) for key in keys) for item in items)


def validate_scan(context: dict[str, Any]) -> dict[str, Any]:
    policy = context["policy"]
    baseline = policy["secret_and_private_data_scan_baseline"]
    mu = json.loads((ROOT / policy["mu_active_manifest"]).read_text(encoding="utf-8"))
    command = [
        sys.executable,
        str(SCANNER),
        str(ROOT),
        policy["plugin_root"],
        *[entry["path"] for entry in mu["intended_active"]],
    ]
    scan = json.loads(run(command).stdout)
    scalar_expectations = {
        "scanned_file_count": baseline["scanned_file_count"],
        "scanned_byte_count": baseline["scanned_byte_count"],
        "binary_file_count": baseline["binary_file_count"],
    }
    for key, expected in scalar_expectations.items():
        if scan[key] != expected:
            raise RuntimeError(f"scan baseline mismatch: {key}: {scan[key]} != {expected}")
    forbidden = sorted(item["path"] for item in scan["forbidden_filename_candidates"])
    if forbidden != sorted(baseline["forbidden_filename_candidates"]):
        raise RuntimeError("new or missing secret-risk filename candidate")

    expected_high = collections.Counter()
    for item in baseline["high_confidence_allowlist"]:
        expected_high[(item["path"], item["rule"], item["sha256"])] += item["count"]
    observed_high = candidate_counter(
        scan["high_confidence_candidates"], ("path", "rule", "sha256")
    )
    if observed_high != expected_high:
        raise RuntimeError("high-confidence secret candidate set changed")

    expected_credentials = collections.Counter()
    for item in baseline["credential_literal_allowlist"]:
        expected_credentials[(item["path"], item["identifier"], item["sha256"])] += item["count"]
    observed_credentials = candidate_counter(
        scan["credential_literal_candidates"], ("path", "identifier", "sha256")
    )
    if observed_credentials != expected_credentials:
        raise RuntimeError("credential-literal candidate set changed")

    expected_private = collections.Counter()
    for item in baseline["private_data_allowlist"]:
        expected_private[(item["path"], item["identifier"], item["sha256"])] += item["count"]
    observed_private = candidate_counter(
        scan["private_data_literal_candidates"], ("path", "identifier", "sha256")
    )
    if observed_private != expected_private:
        raise RuntimeError("private-data candidate set changed")
    if len(scan["entropy_review_candidates"]) != baseline["entropy_candidate_count"]:
        raise RuntimeError("entropy candidate count changed")
    if len(scan["email_literal_candidates"]) != baseline["email_literal_count"]:
        raise RuntimeError("email candidate count changed")
    return {
        "result": "PASS_HASH_SCOPED_REVIEWED_BASELINE",
        "scanned_file_count": scan["scanned_file_count"],
        "scanned_byte_count": scan["scanned_byte_count"],
        "binary_file_count": scan["binary_file_count"],
        "high_confidence_reviewed_false_positive_count": len(scan["high_confidence_candidates"]),
        "credential_schema_label_count": len(scan["credential_literal_candidates"]),
        "entropy_reviewed_count": len(scan["entropy_review_candidates"]),
        "email_reviewed_count": len(scan["email_literal_candidates"]),
        "private_data_fallback_expression_count": len(scan["private_data_literal_candidates"]),
        "unreviewed_candidate_count": 0,
    }


def extract_archive(archive_path: Path, output_dir: Path) -> None:
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive.getmembers():
            relative = Path(member.name)
            if relative.is_absolute() or ".." in relative.parts or member.issym() or member.islnk():
                raise RuntimeError(f"unsafe package member: {member.name}")
            destination = output_dir / relative
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                raise RuntimeError(f"unsupported package member type: {member.name}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            handle = archive.extractfile(member)
            if handle is None:
                raise RuntimeError(f"cannot read package member: {member.name}")
            destination.write_bytes(handle.read())


def validate_mu_strict(context: dict[str, Any], archive_path: Path, output_dir: Path) -> dict[str, Any]:
    extracted = output_dir / "extracted"
    extract_archive(archive_path, extracted)
    strict_root = extracted / context["policy"]["archive_root"] / "wp-content" / "mu-plugins"
    result = run(
        [
            sys.executable,
            str(MU_VALIDATOR),
            "--strict-top-level",
            str(strict_root),
        ]
    )
    payload = json.loads(result.stdout)
    if payload["result"] != "PASS":
        raise RuntimeError("strict MU validation failed")
    return payload


def validate_no_production_commands(context: dict[str, Any]) -> dict[str, Any]:
    paths = [
        BUILDER,
        ROOT / "_SYSTEM" / "scripts" / "validate_d9_matrix_source.py",
        MU_VALIDATOR,
        SCANNER,
        WORKFLOW,
    ]
    matches: list[dict[str, Any]] = []
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for pattern in TRUSTED_NO_PRODUCTION_COMMAND_PATTERNS:
            for match in re.finditer(pattern, text):
                matches.append(
                    {
                        "path": path.relative_to(ROOT).as_posix(),
                        "line": text.count("\n", 0, match.start()) + 1,
                        "pattern": pattern,
                    }
                )
    if matches:
        raise RuntimeError(f"production-capable command signature found: {matches}")
    return {"result": "PASS", "files_scanned": len(paths), "match_count": 0}


def validate_workflow() -> dict[str, Any]:
    text = WORKFLOW.read_text(encoding="utf-8")
    required = [
        "pull_request:",
        "contents: read",
        TRUSTED_CHECKOUT_ACTION,
        "persist-credentials: false",
        "validate_d9_matrix_source.py",
        "$RUNNER_TEMP",
        TRUSTED_PRODUCTION_HASH_MAP_PATH,
        SCANNER.relative_to(ROOT).as_posix(),
    ]
    missing = [item for item in required if item not in text]
    forbidden = [
        "workflow_dispatch:",
        "schedule:",
        "environment:",
        "secrets.",
        "upload-artifact",
        "pull_request_target:",
    ]
    present = [item for item in forbidden if item in text]
    if missing or present:
        raise RuntimeError(f"unsafe CI configuration: missing={missing} forbidden={present}")
    return {
        "result": "PASS_NON_DEPLOYING",
        "permissions": "contents: read",
        "trigger": "pull_request",
        "artifact_upload": False,
        "environment": False,
        "secrets": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        output_dir = args.output_dir.resolve()
        if ROOT == output_dir or ROOT in output_dir.parents:
            raise RuntimeError("validation output must be outside the repository")
        output_dir.mkdir(parents=True, exist_ok=True)
        context = load_context(args.policy)
        trusted_dependencies = validate_trusted_dependencies()
        build1_path = output_dir / "build-1" / "missionmed-matrix-source.tar.gz"
        build2_path = output_dir / "build-2" / "missionmed-matrix-source.tar.gz"
        build1 = build_package(context, build1_path)
        build2 = build_package(context, build2_path)
        if build1["package_sha256"] != build2["package_sha256"]:
            raise RuntimeError("deterministic package hashes differ")
        if build1["package_byte_size"] != build2["package_byte_size"]:
            raise RuntimeError("deterministic package sizes differ")

        syntax = validate_syntax(context, output_dir)
        json_count = validate_json()
        scan = validate_scan(context)
        strict_mu = validate_mu_strict(context, build1_path, output_dir)
        command_scan = validate_no_production_commands(context)
        workflow = validate_workflow()

        baseline_tag = TRUSTED_BASELINE_TAG
        tag_target = run(["git", "rev-list", "-n", "1", baseline_tag]).stdout.strip()
        if tag_target != TRUSTED_BASELINE_COMMIT:
            raise RuntimeError("baseline tag target mismatch")

        report = {
            "schema_version": "1.0",
            "ticket": "D9-MATRIX-PLAN-415",
            "result": "PASS",
            "head_commit": run(["git", "rev-parse", "HEAD"]).stdout.strip(),
            "runtime_source_commit": context["source_commit"],
            "runtime_source_tree": context["source_tree"],
            "worktree_clean": True,
            "tracked_source_completeness": "PASS",
            "trusted_input_validation": trusted_dependencies,
            "protected_hash_validation": "PASS_10_OF_10_WITH_FOUNDER_002_CONTROLLER_EXCEPTION",
            "plugin_header_version": context["plugin_version"],
            "json_validation": {"result": "PASS", "tracked_json_count": json_count},
            "syntax": syntax,
            "secret_and_private_data_scan": scan,
            "strict_mu_validation": {
                "result": strict_mu["result"],
                "intended_active_count": strict_mu["intended_active_count"],
            },
            "package_build_1": build1,
            "package_build_2": build2,
            "package_reproducibility": "PASS_IDENTICAL_SHA256_AND_SIZE",
            "no_production_command_scan": command_scan,
            "ci_configuration": workflow,
            "baseline_tag": {"name": baseline_tag, "target": tag_target, "result": "PASS"},
            "production_side_effects": "NONE",
            "database_side_effects": "NONE",
            "cache_side_effects": "NONE",
            "deployment_side_effects": "NONE",
            "tools": {
                "python": sys.version.split()[0],
                "git": tool_version("git", ["--version"]),
                "php": tool_version("php", ["--version"]),
                "node": tool_version("node", ["--version"]),
            },
        }
        rendered = json.dumps(report, indent=2, sort_keys=True) + "\n"
        if args.report:
            report_path = args.report.resolve()
            if ROOT == report_path or ROOT in report_path.parents:
                raise RuntimeError("validation report output must be outside the repository")
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(rendered, encoding="utf-8")
        print(rendered, end="")
        return 0
    except Exception as exc:
        print(json.dumps({"result": "FAIL", "error": str(exc)}, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
