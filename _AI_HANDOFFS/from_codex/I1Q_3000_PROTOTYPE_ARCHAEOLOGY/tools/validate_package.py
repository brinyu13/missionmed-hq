#!/usr/bin/env python3
"""Deterministically validate the I1Q-3000 archaeology handoff."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
SHOTS = ROOT / "I1Q-3000_SCREENSHOT_BOOK"
NODE = Path("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    checks: list[dict] = []

    def check(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "status": "PASS" if passed else "FAIL", "detail": detail})

    required = [
        "I1Q-3000_PROTOTYPE_GALLERY.html",
        "I1Q-3000_DESIGN_COMPARISON.md",
        "I1Q-3000_DESIGN_EVOLUTION_REPORT.md",
        "I1Q-3000_CANONICAL_DESIGN_INVENTORY.md",
        "I1Q-3000_COMPLETE_COMBINED_HANDOFF.md",
        "I1Q-3000_SCREENSHOT_BOOK/README.md",
        "evidence/curated_prototype_inventory.json",
        "evidence/discovery_convergence_summary.json",
        "evidence/screenshot_provenance.json",
        "evidence/launch_allowlist.json",
    ]
    missing_required = [path for path in required if not (ROOT / path).is_file()]
    check("required_deliverables", not missing_required, f"{len(required) - len(missing_required)}/{len(required)} present; missing={missing_required}")

    inventory = json.loads((EVIDENCE / "curated_prototype_inventory.json").read_text(encoding="utf-8"))
    items = inventory["items"]
    ids = [item["id"] for item in items]
    check("inventory_count", len(items) == inventory.get("item_count") == 46, f"items={len(items)} declared={inventory.get('item_count')}")
    check("unique_ids", len(ids) == len(set(ids)), f"unique={len(set(ids))}/{len(ids)}")

    orders = sorted(item["approximate_creation_order"] for item in items)
    check("chronology_rank", orders == list(range(1, len(items) + 1)), f"rank range={orders[0]}..{orders[-1]} unique={len(set(orders))}")
    ordered_dates = [item["approximate_date"] for item in sorted(items, key=lambda item: item["approximate_creation_order"])]
    check("chronology_date_order", ordered_dates == sorted(ordered_dates), f"first={ordered_dates[0]} last={ordered_dates[-1]}")

    launchable = [item for item in items if item["launchable_html"]]
    nonlaunchable = [item for item in items if not item["launchable_html"]]
    check("launchability_counts", len(launchable) == 41 and len(nonlaunchable) == 5, f"launchable={len(launchable)} nonlaunchable={len(nonlaunchable)}")
    check("source_paths_exist", all(item["source_exists"] and Path(item["path"]).is_file() for item in items), f"{sum(bool(item['source_exists']) for item in items)}/{len(items)} exist")

    source_hash_failures = []
    source_hash_checked = 0
    for item in items:
        if item.get("dataless"):
            continue
        source_hash_checked += 1
        if sha256(Path(item["path"])) != item.get("sha256"):
            source_hash_failures.append(item["id"])
    check("allocated_source_hashes", not source_hash_failures, f"{source_hash_checked}/{source_hash_checked} matched; failures={source_hash_failures}")
    dataless = [item for item in items if item.get("dataless")]
    check("dataless_fail_closed", len(dataless) == 1 and not dataless[0]["launchable_html"] and "not re-read" in dataless[0]["hash_basis"], f"records={[item['id'] for item in dataless]}")

    primary_missing = [item["id"] for item in launchable if not item.get("screenshot") or not (SHOTS / item["screenshot"]).is_file()]
    check("primary_screenshot_coverage", not primary_missing, f"{len(launchable) - len(primary_missing)}/{len(launchable)} launchable records; missing={primary_missing}")
    jpgs = sorted(SHOTS.glob("*.jpg"))
    pngs = sorted(SHOTS.glob("*.png"))
    bad_magic = [path.name for path in jpgs if path.read_bytes()[:3] != b"\xff\xd8\xff"]
    check("screenshot_count", len(jpgs) == 69, f"JPEG files={len(jpgs)}")
    check("screenshot_extensions", not pngs and not bad_magic, f"png_files={len(pngs)} bad_jpeg_magic={bad_magic}")

    category_patterns = {
        "home_or_entry": r"home|splash|opening|dashboard",
        "question_or_runtime": r"question|quiz|runtime|rounds|ruling",
        "replay": r"replay",
        "explanation_or_verdict": r"explanation|verdict",
        "analytics": r"analytics|readiness|career",
        "results_or_debrief": r"results|debrief|assessment",
        "unique_interaction": r"unique|arena|hub|podium|reviewer",
        "responsive": r"mobile|tablet",
    }
    categories = {name: sum(bool(re.search(pattern, path.name, re.I)) for path in jpgs) for name, pattern in category_patterns.items()}
    check("required_state_categories", all(value > 0 for value in categories.values()), json.dumps(categories, sort_keys=True))

    provenance = json.loads((EVIDENCE / "screenshot_provenance.json").read_text(encoding="utf-8"))
    provenance_rows = provenance["screenshots"]
    provenance_by_file = {row["file"]: row for row in provenance_rows}
    provenance_failures = []
    for shot in jpgs:
        rel = f"I1Q-3000_SCREENSHOT_BOOK/{shot.name}"
        row = provenance_by_file.get(rel)
        if not row or row.get("sha256") != sha256(shot):
            provenance_failures.append(rel)
    check("screenshot_provenance", len(provenance_rows) == len(jpgs) and not provenance_failures, f"rows={len(provenance_rows)} files={len(jpgs)} failures={provenance_failures}")

    dimensions = {
        "visual_quality", "navigation", "educational_progression", "replay", "zoom_notes",
        "learning_flow", "question_progression", "ladder_concepts", "rounds_concepts",
        "explanation_philosophy", "clinical_reasoning", "interaction_speed", "student_engagement",
        "animation", "accessibility", "standalone_potential", "daily_drills_integration", "analytics",
        "teacher_experience", "student_experience", "reuse_potential",
    }
    wrong_dimensions = [item["id"] for item in items if set(item["scores"]) != dimensions]
    check("comparison_dimensions", not wrong_dimensions, f"21 dimensions on {len(items) - len(wrong_dimensions)}/{len(items)} records")

    fail_closed_rules = [
        ("replay_implementation", "No replay", "replay"),
        ("zoom_notes_behavior", "No Zoom Notes", "zoom_notes"),
        ("explanation_system", "No explanation", "explanation_philosophy"),
        ("analytics", "No analytics", "analytics"),
        ("animations", "No material animation", "animation"),
        ("daily_drills_integration", "No direct Daily Drills", "daily_drills_integration"),
        ("question_flow", "No question flow", "question_progression"),
    ]
    score_contradictions = []
    for item in items:
        for field, prefix, dimension in fail_closed_rules:
            if item[field].startswith(prefix) and item["scores"][dimension] != 0:
                score_contradictions.append(f"{item['id']}:{dimension}")
        if not item["launchable_html"] and item["scores"]["standalone_potential"] != 0:
            score_contradictions.append(f"{item['id']}:standalone_potential")
    check("score_narrative_consistency", not score_contradictions, f"contradictions={score_contradictions}")

    gallery_path = ROOT / "I1Q-3000_PROTOTYPE_GALLERY.html"
    gallery = gallery_path.read_text(encoding="utf-8")
    card_count = len(re.findall(r'<article class="prototype"', gallery))
    filters = set(re.findall(r'data-filter="([^"]+)"', gallery))
    expected_filters = {"all", "core", "direct-ancestor", "adjacent", "requirements", "design-donor", "supporting-artifact"}
    check("gallery_cards", card_count == len(items), f"cards={card_count} inventory={len(items)}")
    check("gallery_filters", filters == expected_filters, f"filters={sorted(filters)}")
    keyword_rows = re.findall(r'data-keywords="([^"]*)"', gallery)
    replay_hits = sum("replay" in row for row in keyword_rows)
    notes_hits = sum("notes" in row for row in keyword_rows)
    negative_capability_hits = sum("no replay implementation evidenced" in row or "no zoom notes behavior evidenced" in row for row in keyword_rows)
    check("gallery_search_semantics", len(keyword_rows) == len(items) and 0 < replay_hits < 20 and 0 < notes_hits < 20 and negative_capability_hits == 0 and "Title, ticket, interaction, or preserved idea…" in gallery, f"replay_hits={replay_hits} notes_hits={notes_hits} negative_boilerplate_hits={negative_capability_hits}")
    check("gallery_pagination_accessibility", 'const pageSize=3' in gallery and '#gallery\').focus' in gallery and 'tabindex="-1"' in gallery and '*[hidden]{display:none!important}' in gallery, "page size 3, valid focus target, and hidden-state rule present")
    check("question_platform_launch_help", "Copy launch command" in gallery and "I1Q_LOCAL_DEMO=1" in gallery and "src/server.mjs" in gallery, "server-backed local launch command present")
    server_routes = re.findall(r'data-server-route="([^"]+)"', gallery)
    check("localhost_launch_routes", len(server_routes) == 40 and len(set(server_routes)) == 40 and all(route.startswith(("/p/", "/t/cam-d/")) for route in server_routes) and "/t/cam-d/index.html" in server_routes and "a.href=a.dataset.serverRoute" in gallery, f"allowlisted card launch routes={len(server_routes)}")

    script_match = re.search(r"<script>(.*?)</script>", gallery, re.S)
    script_check = subprocess.run(
        [str(NODE), "--check", "-"],
        input=script_match.group(1) if script_match else "",
        text=True,
        capture_output=True,
        check=False,
    )
    check("gallery_javascript_syntax", bool(script_match) and script_check.returncode == 0, (script_check.stderr or script_check.stdout or "syntax OK").strip())

    manifest = json.loads((EVIDENCE / "launch_allowlist.json").read_text(encoding="utf-8"))
    route_ids = [route["id"] for route in manifest["routes"]]
    expected_route_ids = {item["id"] for item in launchable if item["id"] != "i1q-platform"} | {"i1q-3000-gallery"}
    check("launch_allowlist", set(route_ids) == expected_route_ids and len(route_ids) == len(set(route_ids)), f"routes={len(route_ids)} expected={len(expected_route_ids)}")
    check("restricted_launch_exclusions", "legacy-jbank-reference" not in route_ids and "zoom-notes-family" not in route_ids, "dataless and restricted records excluded")

    server_source = (ROOT / "tools/safe_static_server.py").read_text(encoding="utf-8")
    check("safe_server_boundary", '("127.0.0.1", args.port)' in server_source and "connect-src 'none'" in server_source and "form-action 'none'" in server_source, "localhost bind and fail-closed CSP present")

    user_facing = [
        ROOT / "I1Q-3000_PROTOTYPE_GALLERY.html",
        ROOT / "I1Q-3000_DESIGN_COMPARISON.md",
        ROOT / "I1Q-3000_DESIGN_EVOLUTION_REPORT.md",
        ROOT / "I1Q-3000_CANONICAL_DESIGN_INVENTORY.md",
        ROOT / "I1Q-3000_COMPLETE_COMBINED_HANDOFF.md",
        SHOTS / "README.md",
    ]
    exposed_label_files = [path.name for path in user_facing if "DANIEL B" in path.read_text(encoding="utf-8", errors="replace").upper()]
    check("user_facing_private_label_scan", not exposed_label_files, f"matches={exposed_label_files}")

    convergence = json.loads((EVIDENCE / "discovery_convergence_summary.json").read_text(encoding="utf-8"))
    check("discovery_convergence", convergence.get("curated_inventory_count") == len(items) and convergence.get("raw_candidate_count_before_privacy_minimization") == 17968, f"raw={convergence.get('raw_candidate_count_before_privacy_minimization')} curated={convergence.get('curated_inventory_count')}")
    census = json.loads((EVIDENCE / "filesystem_candidate_census.json").read_text(encoding="utf-8"))
    check("census_privacy_minimized", census.get("schema_version") == "i1q-3000-census-privacy-safe-v1" and "candidates" not in census, f"schema={census.get('schema_version')} curated_candidates={census.get('curated_candidate_count')}")

    failures = [entry for entry in checks if entry["status"] == "FAIL"]
    payload = {
        "schema_version": "i1q-3000-validation-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "verdict": "PASS" if not failures else "FAIL",
        "checks_passed": len(checks) - len(failures),
        "checks_total": len(checks),
        "checks": checks,
    }
    (EVIDENCE / "validation_report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# I1Q-3000 Validation Report",
        "",
        f"**Verdict: {payload['verdict']} — {payload['checks_passed']}/{payload['checks_total']} deterministic checks passed.**",
        "",
        "This validates the local archaeology package. It is not medical approval, Founder adoption, protected-runtime certification, or production authorization.",
        "",
        "| Check | Status | Evidence |",
        "|---|---|---|",
    ]
    for entry in checks:
        detail = entry["detail"].replace("|", "\\|").replace("\n", " ")
        lines.append(f"| `{entry['name']}` | **{entry['status']}** | {detail} |")
    lines += [
        "",
        "## Browser evidence",
        "",
        "Live in-app browser checks separately verified 3-card pagination, focus transfer to the Museum drawer heading, discriminating replay/notes search, the supporting-artifact filter, localhost launch-route rewriting, and no document-level horizontal overflow at 1440×900, 768×1024, or 390×844.",
        "",
        "## Explicit limits",
        "",
        "- The dataless legacy source was not hydrated or reread; its digest remains labeled as prior authenticated evidence.",
        "- Screenshot privacy was visually spot-checked; deterministic validation checks file lineage and user-facing text, not image OCR.",
        "- Historical shells with service dependencies were validated as launchable shells, not as current end-to-end services.",
        "- Accessibility maturity remains prototype-specific and is not certified by this report.",
        "",
    ]
    (ROOT / "I1Q-3000_VALIDATION_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"verdict": payload["verdict"], "passed": payload["checks_passed"], "total": payload["checks_total"], "failures": [entry["name"] for entry in failures]}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
