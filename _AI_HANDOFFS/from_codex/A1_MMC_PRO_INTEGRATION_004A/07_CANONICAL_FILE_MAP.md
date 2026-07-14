# 07 Canonical File Map

RESULT: `CANONICAL_MMC_ENGINEERING_SOURCE_MAPPED`

## Scope of this declaration

The current branch is the canonical **engineering continuation source** for Matrix Mentor Console (MMC). This is not a production-deployment declaration. The private console, its same-origin API candidate, schema foundation, deterministic validators, synthetic partner demo, historical test oracle, and current Prompt 004A evidence are now represented in one branch without replacing the shared MissionMed HQ runtime or importing the old laptop repository wholesale.

Current authority order:

1. MissionMed OS authority and protected-system records.
2. Current branch implementation and applicable passing validators.
3. Prompt 004A numbered reports and complete combined handoff.
4. Prompt 004 reports as migration provenance.
5. Commit-safe historical hash metadata.
6. Raw MacBook Air archive and quarantine as local historical evidence only.

An older document that labels itself `AUTHORITATIVE`, `LIVE`, or `READY` does not outrank current code, current validation, or this hierarchy.

## Canonical runtime map

| Path | Canonical role | Authority and handling |
| --- | --- | --- |
| `missionmed-hq/server.mjs` | Shared HQ process, private static mount, authenticated API gate, CSRF enforcement, persistence boundary, and route registration | Shared protected integration boundary. Prompt 004 already performed a semantic MMC port. Prompt 004A deliberately does not replace or broadly edit this file. |
| `missionmed-hq/public/mmc-private/index.html` | Private mentor-console document and static screen skeleton | Current private MMC UI source. Prompt 004A makes only selected-student session-note initialization neutral and student-aware; no auth or server behavior changes. |
| `missionmed-hq/public/mmc-private/src/app.js` | Screen state, renderers, Pipeline Admin UI, call-prep/session/post-session flows, meeting review, and client-side coordination | Current MMC client behavior. Prompt 004A repairs selected-student continuity across Profile, Meeting Intelligence, Mentor Memory, Session Command, and Post-Session Capture. |
| `missionmed-hq/public/mmc-private/src/styles.css` | Current private MMC visual system and responsive rules | Current styling source; unchanged in Prompt 004A. Its mobile limitations are documented rather than hidden. |
| `missionmed-hq/public/mmc-private/src/mmc-data-adapters.js` | Reality gate and source-adapter policy | Current proof that protected data domains remain fixture-backed or blocked until identity, assignment, least-privilege access, and field contracts are verified. |
| `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js` | MMC-owned mentor, assignment, session, memory, task, goal, promise, timeline, risk, readiness, and briefing projections | Current ownership and same-origin persistence candidate. Demo fixture state is not production truth. |
| `missionmed-hq/routes/mmc-coaching-pipeline.mjs` | Authenticated coaching-pipeline API, prompt versions, source assets, analysis, identity resolution, roster review, worker, and Webex trigger orchestration | Current server-side MMC pipeline source. It requires the private MMC authorization model and an allowed persistence target before serving pipeline operations. |
| `missionmed-hq/lib/mmc-coaching-import-worker.mjs` | Dedicated MP4/MOV/M4V plus transcript-pair discovery and import boundary | Current worker; intentionally separate from Daily Drills ingestion and its watcher. |
| `missionmed-hq/lib/mmc-student-resolution-engine.mjs` | Deterministic student-match evidence, confidence, and review classification | Current identity-resolution source; ambiguity routes to review instead of silent attachment. |
| `missionmed-hq/lib/mmc-roster-verification-lane.mjs` | Independent-anchor verification and explicit approval lane | Current roster bridge safeguard. It does not treat display name, title, or weak metadata as sufficient identity proof. |
| `missionmed-hq/lib/mmc-webex-triggered-pull.mjs` | Read-only Webex inventory and title-triggered local staging candidate | Current Webex foundation. Remote mutation is outside scope; local pull remains gated and was not exercised against a real account. |
| `missionmed-hq/prompts/mmc-meeting-analysis-default.md` | Evidence-bound meeting-analysis prompt | Current default prompt source; real provider execution remains gated and unproved in this run. |

## Route and lifecycle ownership

| Surface | Canonical route or flow | Boundary |
| --- | --- | --- |
| Private mentor UI | `GET /mmc-private/` and its static assets | Unauthenticated requests redirect to HQ authentication; unauthorized sessions are forbidden; route is no-index. |
| MMC persistence | `/api/mmc/persistence` | Authenticated same-origin API with CSRF on mutations, explicit enablement, allowed-project enforcement, anon/RLS-scoped runtime, and production-project refusal. |
| Coaching pipeline | `/api/mmc/coaching-pipeline/*` | Authenticated private-MMC authorization; admin-only for inventory mutations, worker, Webex, identity approval, roster approval, and prompt administration. |
| Worker lifecycle | scan -> pair -> import -> resolution/review -> analysis | Writes only to MMC-owned pipeline/intelligence tables when persistence is explicitly enabled. |
| Webex lifecycle | status -> read-only inventory -> allowed-title staging -> worker import | Default allow trigger includes `[MM-ADV]`; `[MM-IGNORE]` is denied. No remote Webex write is part of the design. |
| Student identity | candidate evidence -> deterministic resolution -> manual review or approval -> roster verification | No silent weak match. Approval and provenance are explicit states. |
| Meeting intelligence | source pointer -> student link -> structured analysis -> human review -> MMC-owned readback | Source media identity is preserved; the console does not claim copied media as a new source. |

## Schema and RLS evidence

| Path | Role | Current status |
| --- | --- | --- |
| `supabase/migrations/20260624002000_mmc_schema_foundation.sql` | Base `mmc` schema, principals, assignments, sessions, goals, tasks, memory, notes, artifacts, and access model | Canonical unapplied migration evidence. It is not proof of production schema state. |
| `supabase/migrations/20260626040000_mmc_coaching_intelligence_pipeline.sql` | Source assets, prompt versions, analysis, intelligence projections, audit/review foundations | Canonical unapplied migration evidence. |
| `supabase/snippets/20260624_mmc_schema_foundation_rls_validation.sql` | RLS validation evidence | Validation support only; not executed against production. |
| `supabase/snippets/20260624_mmc_schema_foundation_rollback.sql` | Reversible schema rollback evidence | Safety evidence only; not executed. |
| `_AI_HANDOFFS/from_codex/MMC-019_*.md` | Schema provenance, reality reconciliation, build readiness, and RLS plan | Preserved architecture provenance; current Prompt 004A reports supersede dated readiness claims. |

## UI artifacts and product oracles

| Path | Role | Disposition |
| --- | --- | --- |
| `missionmed-hq/public/mmc-private/` | Current private consolidated implementation candidate | Canonical current UI source. |
| `missionmed-hq/public/mmc-partner-demo/index.html` | Public, static, synthetic partner walkthrough with 11 screens | Canonical demonstration artifact only. It has no external calls or persistence and is not production or data authority. |
| `mmc-v1-core/` | MMC-005A standalone product fixture and parity oracle | Preserve unchanged as historical behavioral/test oracle; do not treat it as the active HQ runtime. |
| `_AI_HANDOFFS/from_codex/A1_MMC_PRO_INTEGRATION_004A/screenshots/` | Current local visual evidence | Canonical evidence for the present UX, including known mobile and empty-state debt. |

## Validator map

| Validator family | Canonical files |
| --- | --- |
| Private route and selection | `mmc-private-mount-validation.mjs`, `mmc-selection-continuity-validation.mjs` |
| Persistence and pipeline contracts | `mmc-persistence-integration-validation.mjs`, `mmc-coaching-pipeline-contract-validation.mjs` |
| Worker | `mmc-coaching-import-worker-validation.mjs`, `mmc-coaching-import-worker-route-validation.mjs` |
| Student and roster identity | `mmc-student-resolution-engine-validation.mjs`, `mmc-roster-identity-bridge-validation.mjs`, `mmc-roster-verification-lane-validation.mjs` |
| Webex trigger | `mmc-webex-trigger-policy-validation.mjs`, `mmc-webex-trigger-route-validation.mjs` |
| Partner demo | `mmc-partner-demo-validation.mjs` |
| Historical core parity | `mmc-v1-core/tests/mmc-core-validation.mjs` |
| Credentialed staging/browser probes | `mmc-persistence-staging-smoke.mjs`, roster staging/browser smokes, Webex browser smoke | Preserved, but not a license to access or mutate external systems. Run only with explicit safe environment authority. |

## Evidence and history map

| Evidence | Authority |
| --- | --- |
| `_AI_HANDOFFS/from_codex/A1_MMC_PRO_INTEGRATION_004A/01_...19_*.md` | Current numbered engineering and product handoff. |
| `A1_MMC_PRO_INTEGRATION_004A_COMPLETE_COMBINED_HANDOFF.md` | Full-content combined copy of the numbered reports; not merely an index. |
| `evidence/20260714T160834Z_PRECHANGE_STATE_MANIFEST.json` | Pre-change branch/worktree evidence. |
| `evidence/20260714T160834Z_ROLLBACK_AND_PRESERVATION_EVIDENCE.md` | Rollback and provenance evidence. |
| `historical_macbook_air/HISTORICAL_CORPUS_MANIFEST.sha256` | Commit-safe hashes and archive-relative paths for selected historical evidence. |
| `historical_macbook_air/README.md` and `PRIVACY_AND_EXCLUSION_SUMMARY.md` | Explain why raw historical report bodies remain local-only in a public repository. |
| `_AI_HANDOFFS/from_codex/A1_MMC_PRO_INTEGRATION_004/` | Prompt 004 migration reports and preserved provenance; no longer the final current-state report set. |
| Verified archive and fresh quarantine outside the repository | Complete raw MacBook Air evidence retained locally; never extracted over the canonical repository and never committed wholesale. |

The standalone historical master-architecture document is represented by its commit-safe archive manifest and local preserved source. It is not silently promoted over the HQ-mounted implementation. Five unrelated ACTN reports, credential-excluded tests, caches, transient state, media, and unrelated application artifacts remain excluded.

## Canonical conclusion

Future MMC engineering should branch from this worktree/branch after the final Prompt 004A commit and push. It should not resume from an Air bundle, dirty old-laptop branch, standalone historical runtime, partner demo, or Prompt 004 report snapshot. Production topology, schema application, real identity authority, and deployment remain separate authorized decisions.
