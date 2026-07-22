# I1Q-3000 Validation Report

**Verdict: PASS — 29/29 deterministic checks passed.**

This validates the local archaeology package. It is not medical approval, Founder adoption, protected-runtime certification, or production authorization.

| Check | Status | Evidence |
|---|---|---|
| `required_deliverables` | **PASS** | 10/10 present; missing=[] |
| `inventory_count` | **PASS** | items=46 declared=46 |
| `unique_ids` | **PASS** | unique=46/46 |
| `chronology_rank` | **PASS** | rank range=1..46 unique=46 |
| `chronology_date_order` | **PASS** | first=2026-02-05 last=2026-07-20 |
| `launchability_counts` | **PASS** | launchable=41 nonlaunchable=5 |
| `source_paths_exist` | **PASS** | 46/46 exist |
| `allocated_source_hashes` | **PASS** | 45/45 matched; failures=[] |
| `dataless_fail_closed` | **PASS** | records=['legacy-jbank-reference'] |
| `primary_screenshot_coverage` | **PASS** | 41/41 launchable records; missing=[] |
| `screenshot_count` | **PASS** | JPEG files=69 |
| `screenshot_extensions` | **PASS** | png_files=0 bad_jpeg_magic=[] |
| `required_state_categories` | **PASS** | {"analytics": 3, "explanation_or_verdict": 4, "home_or_entry": 45, "question_or_runtime": 10, "replay": 2, "responsive": 6, "results_or_debrief": 3, "unique_interaction": 4} |
| `screenshot_provenance` | **PASS** | rows=69 files=69 failures=[] |
| `comparison_dimensions` | **PASS** | 21 dimensions on 46/46 records |
| `score_narrative_consistency` | **PASS** | contradictions=[] |
| `gallery_cards` | **PASS** | cards=46 inventory=46 |
| `gallery_filters` | **PASS** | filters=['adjacent', 'all', 'core', 'design-donor', 'direct-ancestor', 'requirements', 'supporting-artifact'] |
| `gallery_search_semantics` | **PASS** | replay_hits=6 notes_hits=6 negative_boilerplate_hits=0 |
| `gallery_pagination_accessibility` | **PASS** | page size 3, valid focus target, and hidden-state rule present |
| `question_platform_launch_help` | **PASS** | server-backed local launch command present |
| `localhost_launch_routes` | **PASS** | allowlisted card launch routes=40 |
| `gallery_javascript_syntax` | **PASS** | syntax OK |
| `launch_allowlist` | **PASS** | routes=41 expected=41 |
| `restricted_launch_exclusions` | **PASS** | dataless and restricted records excluded |
| `safe_server_boundary` | **PASS** | localhost bind and fail-closed CSP present |
| `user_facing_private_label_scan` | **PASS** | matches=[] |
| `discovery_convergence` | **PASS** | raw=17968 curated=46 |
| `census_privacy_minimized` | **PASS** | schema=i1q-3000-census-privacy-safe-v1 curated_candidates=51 |

## Browser evidence

Live in-app browser checks separately verified 3-card pagination, focus transfer to the Museum drawer heading, discriminating replay/notes search, the supporting-artifact filter, localhost launch-route rewriting, and no document-level horizontal overflow at 1440×900, 768×1024, or 390×844.

## Explicit limits

- The dataless legacy source was not hydrated or reread; its digest remains labeled as prior authenticated evidence.
- Screenshot privacy was visually spot-checked; deterministic validation checks file lineage and user-facing text, not image OCR.
- Historical shells with service dependencies were validated as launchable shells, not as current end-to-end services.
- Accessibility maturity remains prototype-specific and is not certified by this report.
