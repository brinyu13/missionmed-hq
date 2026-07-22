#!/usr/bin/env python3
"""Privacy-minimize discovery evidence and seal screenshot provenance.

The broad census is useful while searching, but its raw path list is not an
appropriate permanent handoff artifact. This script retains aggregate coverage
and only the source paths that appear in the curated inventory.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
SHOTS = ROOT / "I1Q-3000_SCREENSHOT_BOOK"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: object) -> None:
    temporary = path.with_suffix(path.suffix + ".new")
    temporary.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def root_label(path: str, roots: list[str]) -> str:
    for root in roots:
        if path == root or path.startswith(root + "/"):
            return root
    return "outside-scanned-roots"


def main() -> None:
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    inventory = json.loads((EVIDENCE / "curated_prototype_inventory.json").read_text(encoding="utf-8"))
    items = inventory["items"]
    safe_paths = {item["path"] for item in items}
    for item in items:
        safe_paths.update(item.get("aliases", []))

    census_path = EVIDENCE / "filesystem_candidate_census.json"
    census = json.loads(census_path.read_text(encoding="utf-8"))
    coverage = census.get("coverage", [])
    already_minimized = census.get("schema_version") == "i1q-3000-census-privacy-safe-v1"
    candidates = census.get("curated_candidates", []) if already_minimized else census.get("candidates", [])
    roots = [entry["root"] for entry in coverage if entry.get("root")]
    curated_candidates = [candidate for candidate in candidates if candidate.get("path") in safe_paths]
    aggregate = census.get("aggregate") if already_minimized else {
        "candidate_count": len(candidates),
        "by_extension": dict(sorted(Counter(candidate.get("extension") or "none" for candidate in candidates).items())),
        "by_root": dict(sorted(Counter(candidate.get("root") or "unknown" for candidate in candidates).items())),
        "content_term_hits": dict(sorted(Counter(term for candidate in candidates for term in candidate.get("content_terms", [])).items())),
        "path_term_hits": dict(sorted(Counter(term for candidate in candidates for term in candidate.get("path_terms", [])).items())),
        "launch_signal_count": sum(bool(candidate.get("launch_signal")) for candidate in candidates),
        "dataless_count": sum(bool(candidate.get("dataless")) for candidate in candidates),
        "protected_content_count": sum(bool(candidate.get("protected_content")) for candidate in candidates),
    }
    write_json(census_path, {
        "schema_version": "i1q-3000-census-privacy-safe-v1",
        "generated_at_utc": now,
        "privacy_contract": "Aggregate coverage plus curated source paths only; unrelated local paths are intentionally omitted.",
        "coverage": coverage,
        "aggregate": aggregate,
        "curated_candidate_count": len(curated_candidates),
        "curated_candidates": curated_candidates,
    })

    duplicates_path = EVIDENCE / "byte_duplicate_groups.json"
    duplicates = json.loads(duplicates_path.read_text(encoding="utf-8"))
    if duplicates.get("schema_version") == "i1q-3000-curated-duplicate-evidence-v1":
        relevant_groups = duplicates.get("groups", [])
    else:
        relevant_groups = []
        for group in duplicates.get("groups", []):
            relevant = sorted(path for path in group.get("paths", []) if path in safe_paths)
            if relevant:
                relevant_groups.append({
                    "sha256": group["sha256"],
                    "curated_paths": relevant,
                    "curated_path_count": len(relevant),
                    "unlisted_copy_count": max(0, int(group.get("count", 0)) - len(relevant)),
                })
    write_json(duplicates_path, {
        "schema_version": "i1q-3000-curated-duplicate-evidence-v1",
        "generated_at_utc": now,
        "privacy_contract": "Only curated paths are listed; unrelated duplicate paths are counted but omitted.",
        "group_count": len(relevant_groups),
        "groups": relevant_groups,
    })

    branches_path = EVIDENCE / "git_branch_candidate_census.json"
    branches = json.loads(branches_path.read_text(encoding="utf-8"))
    summarized_branches = []
    for branch in branches.get("branches", []):
        summarized_branches.append({
            "branch": branch.get("branch"),
            "tip": branch.get("tip"),
            "status": branch.get("status"),
            "matching_path_count": branch.get("matching_path_count", len(branch.get("matching_paths", []))),
        })
    write_json(branches_path, {
        "schema_version": "i1q-3000-git-branch-summary-v1",
        "generated_at_utc": now,
        "repository": branches.get("repository"),
        "privacy_contract": "Branch names, tips, status, and aggregate match counts only.",
        "branch_count": len(summarized_branches),
        "branches": summarized_branches,
    })

    exclusions_path = EVIDENCE / "filesystem_scan_exclusions.json"
    exclusions = json.loads(exclusions_path.read_text(encoding="utf-8"))
    exclusion_rows = exclusions.get("exclusions", [])
    if exclusions.get("schema_version") == "i1q-3000-scan-exclusion-summary-v1":
        exclusion_count = int(exclusions.get("exclusion_count", 0))
        by_root = Counter(exclusions.get("by_root", {}))
        by_reason = Counter(exclusions.get("by_reason", {}))
    else:
        exclusion_count = len(exclusion_rows)
        by_root = Counter(root_label(row.get("path", ""), roots) for row in exclusion_rows)
        by_reason = Counter(row.get("reason") or "unknown" for row in exclusion_rows)
    write_json(exclusions_path, {
        "schema_version": "i1q-3000-scan-exclusion-summary-v1",
        "generated_at_utc": now,
        "privacy_contract": "Counts only; excluded local paths are intentionally omitted.",
        "exclusion_count": exclusion_count,
        "by_root": dict(sorted(by_root.items())),
        "by_reason": dict(sorted(by_reason.items())),
    })

    supplemental_sources = {
        "qbank-003_02_question_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/screenshots/03-light-question.png",
        "qbank-003_03_explanation_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/screenshots/06-dark-explanation.png",
        "qbank-003_04_results_analytics_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/screenshots/07-assessment-report.png",
        "qbank-003_05_reviewer_unique_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/screenshots/08-admin-reviewer-preview.png",
        "qbank-003_06_mobile_home_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/qbank-demo/QBANK-003/screenshots/09-mobile-main-menu.png",
        "stat-914b_02_question_runtime_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/evidence/final_914b/required_48/15_standard_runtime_1440x900.png",
        "stat-914b_03_replay_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/evidence/final_914b/required_48/33_sealed_replay_1440x900.png",
        "stat-914b_04_results_debrief_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/evidence/final_914b/required_48/31_debrief_summary_1440x900.png",
        "stat-914b_05_mobile_runtime_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/I1_STAT4_914B_RENDERED_REPAIR_MEGARUN/evidence/final_914b/required_48/46_mobile_runtime_390x844.png",
        "gr-2601f_02_unique_podiums_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2601F/03_QA_EVIDENCE/03_stage_dimensional_podiums.png",
        "gr-2601f_03_question_ruling_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2601F/03_QA_EVIDENCE/09_livehost_ruling.png",
        "gr-2601f_04_readiness_analytics_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2601F/03_QA_EVIDENCE/05_exam_readiness_populated.png",
        "gr-2601f_05_career_results_synthetic.jpg": "/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/U1_GRAND_ROUNDS_2601F/03_QA_EVIDENCE/06_career_progression.png",
    }
    by_id = {item["id"]: item for item in items}
    screenshot_rows = []
    for shot in sorted(SHOTS.glob("*.jpg")):
        name = shot.name
        source_path = None
        capture_mode = "browser capture with privacy-safe local server"
        source_sha = None
        if name in supplemental_sources:
            source_path = supplemental_sources[name]
            capture_mode = "converted copy of pre-existing synthetic QA screenshot"
            source_sha = sha256(Path(source_path))
        elif name.startswith("I1Q-3000_GALLERY"):
            source_path = str(ROOT / "I1Q-3000_PROTOTYPE_GALLERY.html")
            capture_mode = "browser capture of generated gallery"
            source_sha = sha256(ROOT / "I1Q-3000_PROTOTYPE_GALLERY.html")
        else:
            matching = sorted(
                (item for ident, item in by_id.items() if name.lower().startswith(ident.lower())),
                key=lambda item: len(item["id"]), reverse=True,
            )
            if matching:
                item = matching[0]
                source_path = item["path"]
                source_sha = item.get("sha256")
            elif name.startswith("I1Q-2000"):
                source_path = by_id["i1q-2000"]["path"]
                source_sha = by_id["i1q-2000"].get("sha256")
            elif name.startswith("I1Q-2001"):
                source_path = by_id["i1q-2001"]["path"]
                source_sha = by_id["i1q-2001"].get("sha256")
            elif name.startswith("I1Q-2002"):
                source_path = by_id["i1q-2002"]["path"]
                source_sha = by_id["i1q-2002"].get("sha256")
        screenshot_rows.append({
            "file": f"I1Q-3000_SCREENSHOT_BOOK/{name}",
            "sha256": sha256(shot),
            "source_path": source_path,
            "source_sha256": source_sha,
            "capture_mode": capture_mode,
            "synthetic_or_redacted": "synthetic" if "synthetic" in name else "redacted-or-non-sensitive",
        })
    write_json(EVIDENCE / "screenshot_provenance.json", {
        "schema_version": "i1q-3000-screenshot-provenance-v1",
        "generated_at_utc": now,
        "screenshot_count": len(screenshot_rows),
        "screenshots": screenshot_rows,
    })

    write_json(EVIDENCE / "discovery_convergence_summary.json", {
        "schema_version": "i1q-3000-discovery-convergence-v1",
        "generated_at_utc": now,
        "status": "converged for accessible local evidence; offline, restricted, dataless, and unmounted archives remain explicit gaps",
        "methods": [
            "bounded filesystem census across requested roots",
            "semantic path and content-term matching",
            "byte-hash duplicate grouping",
            "Git branch and history inspection",
            "handoff and ticket-lineage inspection",
            "manual specialist review and visual launch verification",
        ],
        "coverage": coverage,
        "raw_candidate_count_before_privacy_minimization": int(aggregate["candidate_count"]),
        "curated_inventory_count": len(items),
        "launchable_count": sum(bool(item.get("launchable_html")) for item in items),
        "nonlaunchable_count": sum(not bool(item.get("launchable_html")) for item in items),
        "explicit_gaps": [
            "APFS dataless legacy reference was not hydrated",
            "restricted Zoom Notes export was cataloged but not launched or screenshotted",
            "unmounted, offline, or inaccessible external archives were not inspectable",
            "authoring AI remains unknown where the artifacts do not establish it",
        ],
        "privacy_minimization": "Unrelated local candidate and exclusion paths were reduced to aggregate counts before handoff.",
    })


if __name__ == "__main__":
    main()
