#!/usr/bin/env python3
"""Build D9-415 production-to-Git provenance reports from sealed evidence."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
HANDOFF = Path(__file__).resolve().parents[1]
COMMIT_A = "c340a3a87732f7dc4afb06c01e4586239a050495"
TAG = "d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713"

PLUGIN_MANIFEST = HANDOFF / "D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.json"
MU_MANIFEST = HANDOFF / "D9_415_MU_PLUGIN_RUNTIME_MANIFEST.json"
T0_MANIFEST = HANDOFF / "manifests" / "D9_415_T0_FULL_PRODUCTION_MANIFEST.normalized.tsv"
JSON_OUTPUT = HANDOFF / "D9_415_PRODUCTION_TO_GIT_HASH_MAP.json"
MD_OUTPUT = HANDOFF / "D9_415_PRODUCTION_TO_GIT_HASH_MAP.md"
PROVENANCE_OUTPUT = HANDOFF / "D9_415_BASELINE_COMMIT_PROVENANCE.md"

PROTECTED = {
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
        "c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb",
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

AUTHORIZED_CONTROLLER = "23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29"


def git(*args: str, binary: bool = False) -> bytes | str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True
    )
    return result.stdout if binary else result.stdout.decode("utf-8").strip()


def commit_bytes(path: str) -> bytes:
    return git("show", f"{COMMIT_A}:{path}", binary=True)  # type: ignore[return-value]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tree_mode(path: str) -> str:
    line = git("ls-tree", COMMIT_A, "--", path)
    if not line:
        raise RuntimeError(f"Missing commit path: {path}")
    return str(line).split()[0]


def blob_id(path: str) -> str:
    return str(git("rev-parse", f"{COMMIT_A}:{path}"))


def load_t0() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with T0_MANIFEST.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle, delimiter="\t")
        for row in reader:
            if len(row) != 8:
                raise RuntimeError(f"Unexpected T0 row width: {row!r}")
            scope, relative_path, kind, size, mode, digest, md5, target = row
            rows.append(
                {
                    "scope": scope,
                    "relative_path": relative_path,
                    "type": kind,
                    "byte_size": int(size),
                    "mode": mode,
                    "sha256": digest,
                    "md5": md5,
                    "symlink_target_base64": None if target == "-" else target,
                }
            )
    return rows


def path_mapping(scope: str, entry: dict[str, object]) -> dict[str, object]:
    relative_path = str(entry["relative_path"])
    if scope == "missionmed-hub":
        git_path = f"wp-content/plugins/missionmed-hub/{relative_path}"
    else:
        git_path = f"wp-content/mu-plugins/{relative_path}"
    data = commit_bytes(git_path)
    observed = sha256(data)
    expected = str(entry["sha256"])
    size = len(data)
    expected_size = int(entry["byte_size"])
    exact = observed == expected and size == expected_size
    return {
        "production_scope": scope,
        "production_relative_path": relative_path,
        "git_path": git_path,
        "production_sha256": expected,
        "git_commit_sha256": observed,
        "production_byte_size": expected_size,
        "git_commit_byte_size": size,
        "production_mode": str(entry["mode"]),
        "git_mode": tree_mode(git_path),
        "git_blob_id": blob_id(git_path),
        "comparison": "exact" if exact else "mismatch",
    }


def escape(value: object) -> str:
    return str(value).replace("|", "\\|")


def main() -> None:
    plugin = json.loads(PLUGIN_MANIFEST.read_text(encoding="utf-8"))
    mu = json.loads(MU_MANIFEST.read_text(encoding="utf-8"))
    t0 = load_t0()

    selected_plugin = [
        entry
        for entry in plugin["entries"]
        if entry["type"] == "f" and entry["included_in_d9_415a"]
    ]
    selected_mu = [entry for entry in mu["selected_entries"] if entry["type"] == "f"]
    mappings = [path_mapping("missionmed-hub", entry) for entry in selected_plugin]
    mappings.extend(path_mapping("mu-plugins", entry) for entry in selected_mu)

    selected_mu_names = {str(entry["relative_path"]) for entry in selected_mu}
    production_mu = {
        str(entry["relative_path"]): entry
        for entry in t0
        if entry["scope"] == "mu-plugins" and entry["type"] == "f"
    }
    commit_mu_paths = str(
        git("ls-tree", "-r", "--name-only", COMMIT_A, "--", "wp-content/mu-plugins")
    ).splitlines()
    commit_mu_names = {path.removeprefix("wp-content/mu-plugins/") for path in commit_mu_paths}

    excluded_production_mu: list[dict[str, object]] = []
    for name in sorted(set(production_mu) - selected_mu_names):
        entry = production_mu[name]
        git_path = f"wp-content/mu-plugins/{name}"
        if name in commit_mu_names:
            data = commit_bytes(git_path)
            git_sha = sha256(data)
            state = "present_exact" if git_sha == entry["sha256"] else "present_different"
        else:
            git_sha = None
            state = "absent"
        excluded_production_mu.append(
            {
                "production_relative_path": name,
                "production_sha256": entry["sha256"],
                "production_byte_size": entry["byte_size"],
                "git_commit_path": git_path if name in commit_mu_names else None,
                "git_commit_sha256": git_sha,
                "git_state": state,
                "reason": "unrelated MU source outside the D9 Matrix closure",
            }
        )

    git_mu_not_observed: list[dict[str, object]] = []
    for name in sorted(commit_mu_names - set(production_mu)):
        path = f"wp-content/mu-plugins/{name}"
        data = commit_bytes(path)
        git_mu_not_observed.append(
            {
                "git_path": path,
                "git_commit_sha256": sha256(data),
                "git_commit_byte_size": len(data),
                "reason": "pre-existing repository MU source outside the D9 Matrix closure",
            }
        )

    protected: list[dict[str, str]] = []
    for key, (path, locked_sha) in PROTECTED.items():
        observed = sha256(commit_bytes(path))
        if key == "class_mmed_student_os_php":
            if observed != AUTHORIZED_CONTROLLER:
                raise RuntimeError(f"Unauthorized controller byte: {observed}")
            disposition = "authorized_current_observed_source_under_D9-415-FOUNDATION-002"
        elif observed == locked_sha:
            disposition = "active_lock_match"
        else:
            disposition = "unexplained_mismatch"
        protected.append(
            {
                "asset_key": key,
                "git_path": path,
                "active_lock_sha256": locked_sha,
                "observed_baseline_sha256": observed,
                "disposition": disposition,
            }
        )

    mismatches = [entry for entry in mappings if entry["comparison"] != "exact"]
    protected_failures = [
        entry for entry in protected if entry["disposition"] == "unexplained_mismatch"
    ]
    if len(mappings) != 135 or mismatches or protected_failures:
        raise RuntimeError(
            f"Provenance failed: mappings={len(mappings)} mismatches={len(mismatches)} "
            f"protected_failures={len(protected_failures)}"
        )

    plugin_main = commit_bytes("wp-content/plugins/missionmed-hub/missionmed-hub.php").decode(
        "utf-8"
    )
    version_match = re.search(r"^\s*\*\s*Version:\s*(\S+)", plugin_main, re.MULTILINE)
    if not version_match:
        raise RuntimeError("Plugin version header not found")

    payload = {
        "schema_version": "1.0",
        "ticket": "D9-MATRIX-PLAN-415",
        "result": "PASS",
        "observed_baseline_commit": COMMIT_A,
        "observed_baseline_tree": git("show", "-s", "--format=%T", COMMIT_A),
        "observed_baseline_tag": TAG,
        "tag_object": git("rev-parse", TAG),
        "tag_target": git("rev-list", "-n", "1", TAG),
        "plugin_version": version_match.group(1),
        "mapped_file_count": len(mappings),
        "mapped_total_bytes": sum(int(entry["git_commit_byte_size"]) for entry in mappings),
        "plugin_file_count": len(selected_plugin),
        "selected_mu_file_count": len(selected_mu),
        "path_comparisons": mappings,
        "protected_assets": protected,
        "production_mu_intentionally_outside_d9_closure": excluded_production_mu,
        "git_mu_not_observed_in_production_snapshot": git_mu_not_observed,
        "permitted_difference_policy": {
            "selected_runtime_closure": "no differences permitted",
            "unrelated_production_mu": "hash-only evidence retained; source not imported by D9-415",
            "preexisting_git_mu_outside_observation": "outside D9 closure and not packaged",
        },
        "unexplained_runtime_difference_count": 0,
    }
    JSON_OUTPUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    md: list[str] = [
        "# D9-415 Production-to-Git Hash Map",
        "",
        "Verdict: **PASS** — all 135 files in the selected runtime closure map exactly from the quiescent production snapshot to immutable commit A.",
        "",
        f"- Commit: `{COMMIT_A}`",
        f"- Tree: `{payload['observed_baseline_tree']}`",
        f"- Annotated tag: `{TAG}`",
        f"- Tag object: `{payload['tag_object']}`",
        f"- Tag target: `{payload['tag_target']}`",
        f"- Plugin version: `{payload['plugin_version']}`",
        f"- Exact files: `{len(mappings)}` (`{len(selected_plugin)}` plugin + `{len(selected_mu)}` selected MU)",
        f"- Total exact source bytes: `{payload['mapped_total_bytes']}`",
        "- T0/T1 quiescence: identical; manifest SHA-256 `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`",
        "",
        "## Protected Matrix files",
        "",
        "| Asset | Git path | Active-lock SHA-256 | Commit A SHA-256 | Disposition |",
        "|---|---|---|---|---|",
    ]
    for entry in protected:
        md.append(
            "| `{asset_key}` | `{git_path}` | `{active_lock_sha256}` | "
            "`{observed_baseline_sha256}` | {disposition} |".format(**entry)
        )
    md.extend(
        [
            "",
            "The controller is the sole active-lock mismatch. Founder Decision 002 authorizes its exact current-observed hash for source recovery only; D9-416 must adjudicate entitlement behavior.",
            "",
            "## Complete selected production-to-Git mapping",
            "",
            "| Production scope | Production path | Git path | SHA-256 | Bytes | Mode | Git blob | Result |",
            "|---|---|---|---|---:|---:|---|---|",
        ]
    )
    for entry in mappings:
        md.append(
            f"| `{escape(entry['production_scope'])}` | `{escape(entry['production_relative_path'])}` | "
            f"`{escape(entry['git_path'])}` | `{entry['production_sha256']}` | "
            f"{entry['production_byte_size']} | `{entry['production_mode']}` → `{entry['git_mode']}` | "
            f"`{entry['git_blob_id']}` | `{entry['comparison']}` |"
        )
    md.extend(
        [
            "",
            "## Production MU files intentionally outside the D9 closure",
            "",
            f"All `{len(excluded_production_mu)}` non-selected production MU files are retained as path/type/size/hash evidence in T0/T1, but D9-415 does not import or package them. This is the ticket's explicit unrelated-MU exclusion, not an unexplained runtime difference.",
            "",
            "| Production path | SHA-256 | Bytes | Commit A state | Reason |",
            "|---|---|---:|---|---|",
        ]
    )
    for entry in excluded_production_mu:
        md.append(
            f"| `{escape(entry['production_relative_path'])}` | `{entry['production_sha256']}` | "
            f"{entry['production_byte_size']} | `{entry['git_state']}` | {entry['reason']} |"
        )
    md.extend(
        [
            "",
            "## Commit A MU files not observed in production",
            "",
            f"`{len(git_mu_not_observed)}` pre-existing repository MU files were absent from the full T0/T1 production observation. They are outside the D9 closure and the deterministic Matrix package; D9-415 does not change them.",
            "",
            "| Git path | Commit A SHA-256 | Bytes | Reason |",
            "|---|---|---:|---|",
        ]
    )
    for entry in git_mu_not_observed:
        md.append(
            f"| `{escape(entry['git_path'])}` | `{entry['git_commit_sha256']}` | "
            f"{entry['git_commit_byte_size']} | {entry['reason']} |"
        )
    md.extend(
        [
            "",
            "## Provenance gate",
            "",
            "There are zero unexplained executable or runtime differences inside the selected closure. Provenance passes. This evidence authorizes safe source normalization only; it is not deployment approval.",
            "",
        ]
    )
    MD_OUTPUT.write_text("\n".join(md), encoding="utf-8")

    provenance: list[str] = [
        "# D9-415 Baseline Commit Provenance",
        "",
        "Status: **PASS**",
        "",
        "## Immutable identity",
        "",
        f"- Base commit: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`",
        f"- Observed-production commit A: `{COMMIT_A}`",
        f"- Tree: `{payload['observed_baseline_tree']}`",
        f"- Annotated tag: `{TAG}`",
        f"- Tag object: `{payload['tag_object']}`",
        f"- Tag target: `{payload['tag_target']}`",
        f"- Plugin version: `{payload['plugin_version']}`",
        f"- Selected source: `{len(mappings)}` files / `{payload['mapped_total_bytes']}` bytes",
        "",
        "## Evidence chain",
        "",
        "1. T0 and T1 were captured read-only from production and were byte-identical across 287 manifest entries.",
        "2. The local raw copy verified 287/287 after local-only mode restoration; no production write occurred.",
        "3. Secret/private-data scans covered the complete plugin plus ten selected MU files; no secret, credential, student record, log, cache, upload, session, database export, or environment file entered Git.",
        "4. Commit A maps 125/125 plugin files and 10/10 selected MU files to the direct production hashes and sizes.",
        "5. Nine protected Matrix files match the active lock. The controller exact hash is separately and narrowly authorized by Founder Decision 002.",
        "6. The tag is explicitly non-deployable and points directly to commit A.",
        "",
        "## Protected-file result",
        "",
        "| Asset | Commit A SHA-256 | Result |",
        "|---|---|---|",
    ]
    for entry in protected:
        provenance.append(
            f"| `{entry['asset_key']}` | `{entry['observed_baseline_sha256']}` | `{entry['disposition']}` |"
        )
    provenance.extend(
        [
            "",
            "## Scope boundary",
            "",
            "Commit A is an observed-production evidence baseline, not a release. It intentionally contains the production backup-named MU-plugin. It approves neither entitlement behavior nor deployment. D9-416 remains required before implementation or release, and D9-420 remains blocked.",
            "",
        ]
    )
    PROVENANCE_OUTPUT.write_text("\n".join(provenance), encoding="utf-8")

    print(json.dumps({
        "result": "PASS",
        "mapped_files": len(mappings),
        "mapped_bytes": payload["mapped_total_bytes"],
        "protected_assets": len(protected),
        "excluded_production_mu": len(excluded_production_mu),
        "git_mu_not_observed": len(git_mu_not_observed),
        "json_output": str(JSON_OUTPUT.relative_to(ROOT)),
        "markdown_output": str(MD_OUTPUT.relative_to(ROOT)),
        "provenance_output": str(PROVENANCE_OUTPUT.relative_to(ROOT)),
    }, indent=2))


if __name__ == "__main__":
    main()
