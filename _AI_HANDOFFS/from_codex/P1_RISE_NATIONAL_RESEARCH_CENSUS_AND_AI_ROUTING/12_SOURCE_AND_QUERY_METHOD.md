# Source and query method

Generated: 2026-09-14T00:17:44.097Z

## Current truth sources

- Deployed file-backed registry index: `rise/releases/student-rights-safe/api-index.json`; SHA-256 f1cc59f0ae43bf2e54727871c66c07bca604a15ed4bafaf5d9f08de327d21282; 6,139 programs / 31 specialty tabs / 57 exact designations. Remote deployed file hash was independently read back as the same value before this report.
- Railway PostgreSQL, schema `rise_runtime`, queried read-only through the current provider endpoint. Tables read: `canonical_current_facts`, `canonical_evidence_sources`, `registry_releases`, and count-only control/review/provider tables.
- Current facts: 5005; evidence claims: 6933; current review rows: 0; promotion lineage rows: 0.
- Current DB active registry release: rise_rights_safe_beta_20260828_460f459a0359, 909 programs. This is stale relative to the live 6,139 file-backed index and is reported as drift, not silently merged.

## Historical lineage/performance sources

- Sonnet Phase A: `02_PHASE_A_695_RECONCILIATION.csv`.
- Parallel: `03_PARALLEL_RECONCILIATION.csv`.
- Opus: `17_OPUS_RECONCILIATION.csv`.
- Provider-level final dispositions: 5012D `02_CLAIM_FINAL_DISPOSITIONS.csv`.
- Controlled Terra/Sol benchmark: 5012E `04_PROVIDER_BENCHMARK_RESULTS.csv` and sealed handoff narrative.
- 5012F Dossier V2 and 5012J/K TX/FL Adult Neurology packages for qualitative provider/validation evidence.

Historical files were used only for provider presence, lineage, cost, speed, and quality context. Present coverage/depth comes from the deployed registry plus current canonical facts.

## Program identity and scopes

- Exact IM matrix: `designation == Internal Medicine` (695 rows).
- Exact FM matrix: `designation == Family Medicine` (809 rows).
- National specialty census: browse-specialty memberships; combined programs can belong to more than one of 31 tabs.
- Historical provider presence joined on exact ACGME ID, never display name alone.

## Depth calculation

Current contract: four required domains (application requirements, visa, roster, leadership), at least 8 of 9 approved domains for Deep, at least 5 with a provider domain for Enriched, at least 2 core/static domains for Basic.

Two values are reported:

- `live_runtime_depth`: exact current code path with its current research-coverage source filter.
- `canonical_supported_depth`: same deterministic contract fed the approved current `research.*` canonical fact fields.

The difference exposes a real projection bug: current sources use `canonical_review_promotion`, while the store builds research coverage only from `completed_research_factory`. No production repair was made because this mission is analysis-only.

## Coverage semantics

A coverage flag means a usable current registry field or approved canonical fact is present. It does not mean the program supports an applicant. Unknown is never coerced to zero/no. Conflicts remain conflicts. Roster-derived composition is observational evidence, not admissions policy.

## Work-class semantics

- NO_WORK: already Deep in live emitted depth.
- PROMOTION_RECONCILIATION_ONLY: current approved facts already support Deep, or existing provider-domain attempts could satisfy the contract after review; no new call first.
- GAP_FILL_LIGHT: 1–2 missing domains.
- GAP_FILL_MEDIUM: 3–4 missing domains or substantive prior research with a larger but still delta-suitable gap.
- FULL_DEEP_RESEARCH: 5+ missing domains and no substantive provider/current research.
- HUMAN_ADVERSARIAL_REVIEW_ONLY: reserved for a current program-mapped hard conflict ledger; none can be assigned because the current ledger is empty.

## Reproducibility and limits

- All three CSVs were parsed and region-inspected using the bundled artifact workbook runtime; row counts were asserted at 31, 695, and 809.
- Historical provider final-disposition counts are provider-level, not program-level. The matrices therefore use `UNAVAILABLE_CURRENT_LEDGER_EMPTY` for per-program exceptions.
- Applicant popularity, MissionMed demand, and funnel/acquisition data were not present in approved canonical inputs. Specialty priority keeps those inputs unavailable/neutral.
- No web research, paid provider call, production mutation, router activation, or quota consumption occurred.

## Runtime, authority, and worktree readback

- Production app deployment: `ae604e94-c690-4d2c-9508-7dd9877b3c39`; build `rise_web_8a55c2a73ee5`; deployed source commit `0c066adc5e048d7ffcc88b57b6fb03adca9dc434`.
- Analysis worktree: `codex/p1-rise-5007-private-beta-full-registry-student-intel` at pre-report HEAD `027d10a0c2fdf69d07e6dc5667cfcf927597c8b8`. Unrelated pre-existing dirty files were preserved.
- MissionMed OS universal and P1-RISE-5012K dependency validation passed. The OS current registry still described 5012K as active although the product State Delta, repo, and provider runtime prove it complete; this is recorded as control-plane registry lag and was not allowed to override current product truth.
