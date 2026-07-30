# B1-507A Authority Document Index

Date: 2026-07-29
Ticket: B1-507A
Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`

## Classification key

- **Binding/current** — controls the stated decision unless a more specific later authority overrides it.
- **Current evidence** — records implementation or production state; it does not create product authority.
- **Partially superseded** — still controls unaffected material, but named later rulings replace part of it.
- **Historical** — useful for provenance, rollback, or deployed-baseline evidence only.
- **Advisory/incomplete** — useful planning material that is not sufficient launch authority.

## Canonical product and recovery baseline

| Document | Date | Classification | Controls / present use | Later effect |
|---|---:|---|---|---|
| `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html` | 2026-07 | Binding/current for unchanged V5 product | Original Founder-approved V5 UI, navigation, visual language, workflows; SHA-256 `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` | B1-504A adds voice without redesigning these surfaces |
| `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/B1-500_STORYFORGE_V5_FULL_COMPLETE_COMBINED_HANDOFF.md` | 2026-07-27 | Historical implementation evidence | V5 repository foundation, tests, invariants, deferred production gates | B1-503 records the recovered live product |
| `_AI_HANDOFFS/from_codex/B1-501_storyforge_v5_integration/B1-501_COMPLETE_COMBINED_HANDOFF.md` | 2026-07 | Historical integration evidence | Local Matrix/WordPress seam and local launch context | Production receipts below control deployed state |
| `_AI_HANDOFFS/from_codex/B1-502_storyforge_production_deployment/B1-502_COMPLETE_COMBINED_HANDOFF.md` | 2026-07 | Historical deployment evidence | Initial production deployment provenance | Superseded as product/deployment baseline by B1-503 |
| `_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/B1-502M_COMPLETE_COMBINED_HANDOFF.md` | 2026-07 | Historical failure/recovery context | Authentication and production-repair provenance | B1-503 receipts are the current production baseline |
| `_AI_HANDOFFS/from_codex/B1-503_PRODUCT_RECOVERY_REPORT.md` | 2026-07-28 | Current historical baseline | Root cause of product-authority drift, screen recovery evidence | V5.5 work must preserve this recovered product |
| `_AI_HANDOFFS/from_codex/B1-503_COMBINED_HANDOFF.md` | 2026-07-28 | Current historical baseline | Canonical B1-503 product recovery and live-state summary | B1-504A/504B extend it for Phase 1 voice |
| `_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_PRODUCTION_DEPLOYMENT_RECEIPT.md` | 2026-07-28 | Current production evidence | Deployed commit/release/routes/hashes | Still describes live production, not the local V5.5 candidate |
| `_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_BACKUP_RECEIPT.md` | 2026-07-28 | Historical backup evidence | B1-503 backup provenance | A fresh prelaunch recovery point is required |
| `_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_DB_BACKUP_RECEIPT.md` | 2026-07-28 | Historical backup evidence | Database backup provenance | A fresh pre-migration backup and restore proof are required |
| `_AI_HANDOFFS/from_codex/B1-503_evidence/B1-503_CUTOVER_ROLLBACK_PACKET.md` | 2026-07-28 | Historical rollback evidence | Working B1-503 rollback procedures | B1-506C amendment adds V5.5-specific rollback conditions |

## V5.5 product authority

| Document | Date | Classification | Controls / present use | Later effect |
|---|---:|---|---|---|
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/storyforge-v5.5-prototype.html` | 2026-07 | Binding/current | Founder-reviewable V5.5 Phase 1 interaction authority; SHA-256 `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90` | r2 and later rulings refine named details |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/storyforge-v5.5-prototype-r2.html` | 2026-07 | Binding/current for r2 deltas | Later prototype refinements; SHA-256 `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b` | B1-506B replaces the 90-second and reconciliation details where explicit |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PRODUCT_AUTHORITY_LOCK.md` | 2026-07 | Binding/current, one open Founder gate | Phase boundaries, no student AI, consent/retention decision boundary, product non-negotiables | B1-506A/B resolve only named engineering decisions; FG-1 remains open |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PHASE1_PRODUCTION_BLUEPRINT.md` | 2026-07 | Binding/current | Recording, segment upload, near-live transcript, finish/save workflow | B1-506A/B make exact schema and lifecycle amendments |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_API_DATA_FEATURE_FLAG_CONTRACTS.md` | 2026-07 | Binding/current except amended fields | E1-E13 contracts, schema/flags/authorization boundaries | Exact schema and E11/E13 details amended by B1-506A |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_R2_AUDIO_STORAGE_PRIVACY_LIFECYCLE.md` | 2026-07 | Binding/current except later reconciliation rulings | Private storage, key model, retention, deletion, cleanup | B1-506A/B refine lifecycle procedures |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_TRANSCRIPTION_PROVIDER_BAKEOFF.md` | 2026-07 | Binding/current | Human corpus, provider bakeoff, thresholds and release evidence | B1-506A fixes the exact primary/fallback models |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PRODUCTION_ACCEPTANCE_ROLLOUT_ROLLBACK.md` | 2026-07 | Binding/current except named later sequencing | Phase 1 acceptance, staged exposure, failure and rollback criteria | B1-505C and B1-506B refine sequencing/lifecycle |
| `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_COMBINED_HANDOFF.md` | 2026-07 | Binding synthesis | Consolidated V5.5 product authority | Specific source documents and later rulings control conflicts |

## Infrastructure and platform authority

All files below are under `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/`.

| Document | Classification | Controls / present use | Later effect |
|---|---|---|---|
| `B1-504B_INFRASTRUCTURE_AUTHORITY_LOCK.md` | Binding/current | Platform ownership, isolation, fail-closed boundaries | B1-506A amends exact implementation details |
| `B1-504B_STORYFORGE_PLATFORM_INTEGRATION_CONTRACT.md` | Binding/current | WordPress/Matrix/Railway/PostgreSQL integration | Actual repository and B1-506C expose the current gateway gap |
| `B1-504B_ROUTING_CDN_WORDPRESS_MATRIX_SPEC.md` | Binding/current | Canonical route and proxy model | Current B1-503 route is live; Phase 1 methods need amendment |
| `B1-504B_DATABASE_RLS_MIGRATION_SPEC.md` | Partially superseded | Original schema/RLS intent | B1-506A executable SQL and current migrations control exact schema |
| `B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md` | Partially superseded | Private R2 and lifecycle intent | B1-506A/B control exact later lifecycle/reconciliation |
| `B1-504B_TRANSCRIPTION_RUNTIME_AND_PROVIDER_LOCK.md` | Partially superseded | Provider boundary and isolation | Its older model name is superseded by B1-506A |
| `B1-504B_FEATURE_FLAG_ROLLOUT_AUTHORITY.md` | Binding/current | Default-off and scoped activation | B1-505C gives the later activation train |
| `B1-504B_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md` | Advisory/current map | Intended file/endpoint ownership | Repository is implementation truth |
| `B1-504B_PRODUCT_CONFORMANCE_ACCEPTANCE_MATRIX.md` | Binding/current | Product acceptance mapping | B1-506B adds exact 90-second behavior |
| `B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md` | Binding operational baseline | Deployment and rollback order | B1-506C rollback amendment is later and more specific |
| `B1-504B_OBSERVABILITY_OPERATOR_RUNBOOK.md` | Binding operational baseline | Health, telemetry, operator checks | B1-506A/B add voice/reconciliation signals |
| `B1-504B_EXECUTIVE_DECISION_AND_READINESS.md` | Advisory snapshot | Readiness at B1-504B time | Superseded by current repository/production evidence |
| `B1-504B_COMBINED_HANDOFF.md` | Binding synthesis | Consolidated platform authority | Specific documents and later amendments control conflicts |
| `B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md` | Advisory/historical | Discovery assignment | Not launch authority |

## Delivery, amendments, and implementation evidence

| Document | Date | Classification | Controls / present use | Later effect |
|---|---:|---|---|---|
| `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_DELIVERY_EXECUTION_PLAN.md` | 2026-07 | Binding sequencing authority | Staged delivery, activation train, S18+ prerequisites | References a final B1-505 eligibility authority that is absent |
| `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md` | 2026-07 | Historical execution prompt | B1-506 implementation scope | Completed by later artifacts |
| `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md` | 2026-07-29 | Current evidence | RP-7/RP-8, provider, eligibility, and external-gate discovery | Does not create missing authority |
| `_AI_HANDOFFS/from_cowork/B1-506A_storyforge_v55_bounded_authority_amendment/B1-506A_FABLE_AUTHORITY_AMENDMENT.md` | 2026-07-29 | Binding/current | Six bounded rulings: provider, M1/RLS, audit, E11/E13, lifecycle, assembly candidates | B1-506B settles the two remaining named rulings |
| Same directory: `B1-506A_EXECUTABLE_SQL_AND_CONTRACTS.md` | 2026-07-29 | Binding/current | Exact SQL/contracts for the bounded amendment | Repository migrations must match |
| Same directory: `B1-506A_READINESS_AND_EXTERNAL_GATES.md` | 2026-07-29 | Binding gate definition | External evidence required before activation | Current B1-507A verifies present state |
| Same directory: `B1-506A_COMBINED_HANDOFF.md` | 2026-07-29 | Binding synthesis | Amendment package overview | Specific amendment files control conflicts |
| Same directory: `B1-506A_CODEX_IMPLEMENTATION_PROMPT.md` | 2026-07-29 | Historical execution prompt | Authorized B1-506A implementation lanes | Completed by implementation evidence |
| `_AI_HANDOFFS/from_cowork/B1-506B_storyforge_v55_final_binding_rulings/B1-506B_FABLE_BINDING_RULINGS.md` | 2026-07-29 | Binding/current | Exact 90-second UX and weekly reconciliation rules | No later Fable ruling located |
| `_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506A_IMPLEMENTATION_HANDOFF.md` | 2026-07-29 | Current evidence | B1-506A code/migration implementation | B1-506C is later |
| Same directory: `B1-506A_COMPLETE_COMBINED_HANDOFF.md` | 2026-07-29 | Current evidence | Complete B1-506A implementation record | B1-506C is later |
| Same directory: `B1-506_IMPLEMENTATION_EVIDENCE.md` | 2026-07-29 | Current evidence | Tests, hashes, local evidence | B1-506C contains later final receipts |
| Same directory: `B1-506_COMBINED_HANDOFF.md` | 2026-07-29 | Current evidence | Pre-amendment combined status | B1-506C supersedes status claims |
| `_AI_HANDOFFS/from_codex/B1-506/B1-506_COMPLETE_COMBINED_HANDOFF.md` | 2026-07-29 | Historical evidence | Earlier B1-506 combined handoff | Superseded by B1-506C |
| `_AI_HANDOFFS/from_codex/B1-506C_storyforge_v55_final_two_rulings/B1-506C_IMPLEMENTATION_HANDOFF.md` | 2026-07-29 | Current evidence | Exact B1-506B ruling implementation | Combined handoff is the later synthesis |
| Same directory: `B1-506C_COMPLETE_COMBINED_HANDOFF.md` | 2026-07-29 | Current implementation evidence | 36/36 ledger, hashes, tests, unresolved authority gates | Repository and live probes verify current claims |
| Same directory: `B1-506C_DORMANT_DEPLOYMENT_PREFLIGHT_COMBINED_HANDOFF.md` | 2026-07-29 | Current preflight evidence | Default-off deployment packet and live baseline | B1-507A corrects the production DB table-existence claim |
| Same directory: `B1-506C_ROLLBACK_RUNBOOK_AMENDMENT.md` | 2026-07-29 | Binding/current operational amendment | V5.5 rollback rungs, feature/provider/reconciliation off states | Must be used with fresh launch receipts |

## Missing and stale artifacts

- No B1-506D or B1-506E artifact exists in the repository.
- No final B1-505 eligibility/360-authority handoff exists; B1-505C references one for broader cohort activation.
- `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` is stale: it predates the V5.5 release candidate, contains B1-503-era route/release data, and still describes the removed StoryForge Cloudflare Worker as pending decommission. It must be regenerated by its authorized owner before cutover.
- B1-506C’s production preflight described B1-506 tables as empty; the fresh read-only PostgreSQL probe proved the three tested Phase 1 tables do not yet exist. The fresh probe controls present state.

## Count

This index classifies 52 authority, evidence, runbook, prototype, or receipt artifacts, plus three missing/stale artifact findings. Specific higher-authority source documents control over combined summaries when they conflict.
