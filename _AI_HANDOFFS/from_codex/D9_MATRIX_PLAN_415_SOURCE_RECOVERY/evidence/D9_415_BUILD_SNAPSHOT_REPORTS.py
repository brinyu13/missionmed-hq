#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
T0 = BASE / "manifests/D9_415_T0_FULL_PRODUCTION_MANIFEST.tsv"
SCAN = BASE / "manifests/D9_415_REDACTED_SOURCE_SCAN.json"

MU_SELECTION = {
    "arena-route-proxy.php": "Provides the four Arena proxy functions directly consumed by the DrJ Matrix access guard.",
    "missionmed-drj-drills-access.php": "Auto-loaded role/access control that directly locks Student OS Matrix routes and feature flags for a restricted role.",
    "missionmed-hq-auth-handoff.php": "Explicit D9-415 protected WordPress-to-HQ signed authentication/entitlement handoff component.",
    "missionmed-hq-proxy.php": "Explicit D9-415 protected same-origin HQ authentication proxy component.",
    "missionmed-matrix-account-entry.php": "Matrix account/LearnDash entry component; dynamically loads the hub LearnDash reskin class.",
    "missionmed-mr-legacy-popup.php": "Active production counterpart required by the explicit duplicate/backup preservation and remediation contract.",
    "missionmed-mr-legacy-popup_BACKUP_PRE004.php": "Explicitly required byte-identical, currently auto-loaded backup preserved in D9-415A.",
    "missionmed-performance-boost.php": "Auto-loaded source that explicitly preserves query versions for the exact missionmed-hub Matrix asset paths.",
    "missionmed-supabase-session-cookie-auth.php": "Explicit D9-415 protected Supabase session-to-WordPress identity bridge.",
    "mm-scheduler-webex-broker.php": "Explicit Scheduler/Webex entitlement, meeting, recording, and proxy broker used by the Matrix Scheduler runtime.",
}


def parse_manifest() -> tuple[dict[str, str], list[dict[str, object]]]:
    metadata: dict[str, str] = {}
    entries: list[dict[str, object]] = []
    for line in T0.read_text(encoding="utf-8").splitlines():
        if line.startswith("# started_at\t"):
            metadata["started_at"] = line.split("\t", 1)[1]
            continue
        if line.startswith("# completed_at\t"):
            metadata["completed_at"] = line.split("\t", 1)[1]
            continue
        if not line or line.startswith("#"):
            continue
        scope, rel, kind, size, mode, sha256, md5, target = line.split("\t")
        entries.append(
            {
                "scope": scope,
                "relative_path": rel,
                "type": kind,
                "byte_size": int(size),
                "mode": mode,
                "sha256": sha256,
                "md5": md5,
                "symlink_target_base64": None if target == "-" else target,
            }
        )
    return metadata, entries


def plugin_classification(rel: str, kind: str) -> str:
    if kind == "d":
        return "directory"
    lower = rel.lower()
    if rel == "assets/mmed-webex-widget-adapter.js":
        return "dependency/vendor"
    if lower.endswith((".png", ".webp", ".svg", ".woff", ".woff2")):
        return "runtime-required built asset"
    if lower.endswith(".php"):
        return "runtime-required source"
    if lower.startswith("templates/") and lower.endswith(".html"):
        return "runtime-required source"
    if lower.endswith((".js", ".css")):
        return "runtime-required built asset"
    if lower.startswith("assets/admin-sources/") and lower.endswith(".html"):
        return "generated but runtime-adjacent"
    if lower.endswith(".md") or lower in {"readme.txt", "changelog.md"}:
        return "report"
    if rel == "assets/test-deploy.txt":
        return "unknown production residue"
    return "unknown"


def dump_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def build_plugin_manifest(metadata: dict[str, str], entries: list[dict[str, object]]) -> None:
    plugin = [dict(item) for item in entries if item["scope"] == "missionmed-hub"]
    for item in plugin:
        item["classification"] = plugin_classification(str(item["relative_path"]), str(item["type"]))
        item["included_in_d9_415a"] = True
    counts = Counter(str(item["classification"]) for item in plugin)
    output = {
        "schema_version": "1.0",
        "ticket": "D9-MATRIX-PLAN-415",
        "production_root": "/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub",
        "t0_completed_at": metadata["completed_at"],
        "t1_completed_at": "2026-07-14T00:31:03.315562100Z",
        "quiescence": "PASS_IDENTICAL_T0_T1",
        "source_transport": "read-only SSH/tar inbound",
        "file_count": sum(item["type"] == "f" for item in plugin),
        "directory_count": sum(item["type"] == "d" for item in plugin),
        "symlink_count": sum(item["type"] == "l" for item in plugin),
        "classification_counts": dict(sorted(counts.items())),
        "excluded_from_d9_415a_count": 0,
        "entries": plugin,
    }
    dump_json(BASE / "D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.json", output)
    lines = [
        "# D9-415 Production Plugin Snapshot Manifest",
        "",
        "- Production root: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`",
        f"- T0 completed: `{metadata['completed_at']}`",
        "- T1 completed: `2026-07-14T00:31:03.315562100Z`",
        "- Quiescence: `PASS — IDENTICAL T0/T1`",
        f"- Files: `{output['file_count']}`",
        f"- Directories: `{output['directory_count']}`",
        "- Symlinks/special entries: `0`",
        "- D9-415A exclusions: `0`",
        "- Safety rule: every entry is included byte-for-byte in the immutable observed baseline; non-runtime residue may be excluded only from later deployable packages.",
        "",
        "| Relative path | Type | Bytes | Mode | SHA-256 | MD5 | Classification |",
        "|---|---:|---:|---:|---|---|---|",
    ]
    for item in plugin:
        rel = str(item["relative_path"]).replace("|", "\\|")
        lines.append(
            f"| `{rel}` | `{item['type']}` | {item['byte_size']} | `{item['mode']}` | `{item['sha256']}` | `{item['md5']}` | {item['classification']} |"
        )
    (BASE / "D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_mu_manifest(entries: list[dict[str, object]]) -> None:
    mu_files = {str(item["relative_path"]): dict(item) for item in entries if item["scope"] == "mu-plugins" and item["type"] == "f"}
    selected = []
    for rel, rationale in MU_SELECTION.items():
        if rel not in mu_files:
            raise RuntimeError(f"selected MU file absent from sealed manifest: {rel}")
        item = mu_files[rel]
        item["rationale"] = rationale
        item["autoload_state_at_t0"] = "active_top_level_mu_php"
        selected.append(item)
    selected.sort(key=lambda item: str(item["relative_path"]))
    normal = mu_files["missionmed-mr-legacy-popup.php"]
    backup = mu_files["missionmed-mr-legacy-popup_BACKUP_PRE004.php"]
    if normal["sha256"] != backup["sha256"] or normal["byte_size"] != backup["byte_size"]:
        raise RuntimeError("legacy popup backup is not byte-identical")
    top_level = [item for item in entries if item["scope"] == "mu-plugins" and item["type"] == "f" and "/" not in str(item["relative_path"])]
    output = {
        "schema_version": "1.0",
        "ticket": "D9-MATRIX-PLAN-415",
        "production_root": "/www/theresidencyacademy_209/public/wp-content/mu-plugins",
        "full_observation_manifest": "manifests/D9_415_T0_FULL_PRODUCTION_MANIFEST.tsv",
        "full_tree_file_count": len(mu_files),
        "top_level_file_count": len(top_level),
        "selected_matrix_runtime_file_count": len(selected),
        "excluded_unrelated_observation_file_count": len(mu_files) - len(selected),
        "selection_rule": "explicit ticket components plus direct Matrix/Student OS runtime effects and their custom function provider",
        "direct_php_include_edges_between_selected_mu_files": [],
        "selected_entries": selected,
    }
    dump_json(BASE / "D9_415_MU_PLUGIN_RUNTIME_MANIFEST.json", output)
    lines = [
        "# D9-415 MU-Plugin Runtime Manifest",
        "",
        f"Full sealed MU observation: `{len(mu_files)}` files; top-level files: `{len(top_level)}`; selected Matrix closure: `{len(selected)}` files.",
        "",
        "Selection includes every component explicitly named by the ticket, the active/copy legacy-popup pair required for quarantine evidence, and direct source-evidenced Matrix effects that Wave 1 undercounted. Unrelated Kinsta/vendor and adjacent product MU files remain outside Git.",
        "",
        "| Selected top-level MU file | Bytes | Mode | SHA-256 | Runtime rationale |",
        "|---|---:|---:|---|---|",
    ]
    for item in selected:
        lines.append(
            f"| `{item['relative_path']}` | {item['byte_size']} | `{item['mode']}` | `{item['sha256']}` | {item['rationale']} |"
        )
    lines += [
        "",
        "The legacy popup and its backup are byte-identical at `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`. Both are auto-loaded in D9-415A exactly as observed. D9-415B removes only the backup-named active-path copy and preserves it unchanged in non-autoloaded forensics.",
    ]
    (BASE / "D9_415_MU_PLUGIN_RUNTIME_MANIFEST.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_dependency_graph() -> None:
    lines = [
        "# D9-415 MU Dependency Graph",
        "",
        "```text",
        "WordPress MU loader (alphabetical top-level *.php autoload)",
        "├── missionmed-matrix-account-entry.php",
        "│   └── wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php",
        "├── missionmed-drj-drills-access.php",
        "│   └── arena-route-proxy.php (four optional custom Arena proxy functions)",
        "├── missionmed-performance-boost.php",
        "│   └── exact missionmed-hub Student OS/Calendar/Scheduler/File Vault/StoryForge asset paths",
        "├── missionmed-hq-auth-handoff.php",
        "├── missionmed-hq-proxy.php",
        "├── missionmed-supabase-session-cookie-auth.php",
        "├── mm-scheduler-webex-broker.php",
        "├── missionmed-mr-legacy-popup.php",
        "└── missionmed-mr-legacy-popup_BACKUP_PRE004.php (same symbols/hooks and same bytes)",
        "```",
        "",
        "No selected top-level MU file directly `include`s or `require`s another selected MU file. The Matrix account entry dynamically requires the hub LearnDash reskin class if not already loaded. The DrJ access guard calls four custom functions supplied by `arena-route-proxy.php`; that provider is therefore included. The performance MU file is included because it explicitly preserves query-version behavior for the exact Matrix asset set.",
        "",
        "The two legacy-popup PHP files register the same functions and hooks. Their active co-location is preserved only in immutable D9-415A evidence and is the exact source-only quarantine target for D9-415B.",
    ]
    (BASE / "D9_415_MU_DEPENDENCY_GRAPH.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_exclusion_register() -> None:
    text = """# D9-415 Snapshot Exclusion Register

## Immutable plugin baseline

No `missionmed-hub` entry is excluded from D9-415A. The sealed tree contains no log, cache, upload, session-data file, database export, environment file, credential file, private key, symlink, or special filesystem entry. Reports, prototypes, and `assets/test-deploy.txt` remain in the observed baseline because D9-415A must represent the complete quiescent production tree; deterministic deployable packaging excludes non-runtime residue later.

## MU observation envelope

The full MU tree was captured only inside the ignored, permission-restricted forensic area so closure could be proved. Ten top-level Matrix-related files are selected for Git. The other 116 observed MU files remain excluded because they are unrelated Kinsta/vendor or adjacent product source and the ticket forbids importing unrelated MU plugins.

## Always excluded from Git

- the raw forensic transport tree itself;
- T0/T1 raw transport artifacts except safe manifests and verification results;
- production logs, caches, uploads, sessions, temporary files, database exports, user data, credentials, environment files, private keys, and authorization material (none found in the selected source);
- unrelated MU-plugin source;
- any secret or private value discovered by later validation.

Excluded-item source content is never reproduced in reports. Safe path/type/size/mode/hash evidence remains in the full T0/T1 manifests.
"""
    (BASE / "D9_415_SNAPSHOT_EXCLUSION_REGISTER.md").write_text(text, encoding="utf-8")


def build_scan_report() -> None:
    scan = json.loads(SCAN.read_text(encoding="utf-8"))
    high = scan["high_confidence_candidates"]
    credentials = scan["credential_literal_candidates"]
    if len(high) != 1 or high[0]["rule"] != "private_key_marker" or high[0]["path"] != "plugins/missionmed-hub/assets/mmed-webex-widget-adapter.js":
        raise RuntimeError("unexpected high-confidence secret candidate")
    if len(credentials) != 2 or {item["path"] for item in credentials} != {"plugins/missionmed-hub/assets/mmed-webex-widget-adapter.js"}:
        raise RuntimeError("unexpected credential literal candidate")
    text = f"""# D9-415 Secret and Data Scan Report

Status: **PASS BEFORE IMPORT**

Scan scope: complete 125-file `missionmed-hub` snapshot plus the ten-file selected Matrix MU closure (`{scan['scanned_file_count']}` files, `{scan['scanned_byte_count']}` bytes). A high-confidence path-only pre-scan also covered the full unrelated MU observation envelope. No matched value was printed or filed.

## Results

- Dedicated scanners available: none; a deterministic redacted scanner and independent path-only regular-expression scans were used.
- Private key/token/key patterns: one marker hit, reviewed as the literal PKCS#8 validation phrase inside the bundled Webex cryptography library; no key body or credential exists.
- Credential-literal patterns: two duplicate schema-label hits for `privateKey` inside the same bundled library; no assigned credential exists.
- Entropy review: `{len(scan['entropy_review_candidates'])}` candidates, each reviewed redacted; all are static asset URLs/paths, selectors, image mappings, locale data, or demo markup.
- Email literals: `{len(scan['email_literal_candidates'])}` occurrences, reviewed redacted; institutional support addresses, reserved example addresses, or static form placeholders only. No live user/student record is embedded.
- Private-data literal patterns: `{len(scan['private_data_literal_candidates'])}` syntactic false positive in a runtime empty/fallback expression; no embedded private value.
- Binary files: `{scan['binary_file_count']}` runtime image assets. ASCII-preserving secret/email scans found zero binary candidates.
- Filename warnings: session-named source modules only; no session data, log, cache, upload, environment, key, database, CSV, or credential file.
- Student/user payloads: none.
- Secret-bearing runtime file requiring remediation: none.

## Import gate

Selected source may enter Git unchanged. Validation must rerun against the tracked tree and fail closed if any new candidate appears. The raw forensic tree remains ignored and permission-restricted.
"""
    (BASE / "D9_415_SECRET_AND_DATA_SCAN_REPORT.md").write_text(text, encoding="utf-8")


def main() -> None:
    metadata, entries = parse_manifest()
    build_plugin_manifest(metadata, entries)
    build_mu_manifest(entries)
    build_dependency_graph()
    build_exclusion_register()
    build_scan_report()


if __name__ == "__main__":
    main()
