# I1Q-1008A Path Index

## Primary Packet

- Combined handoff: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_COMBINED_HANDOFF.md`
- Supervisor report: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_REPORT.md`
- Staging certification: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_STAGING_CERTIFICATION.md`
- External blockers: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_TRUE_EXTERNAL_BLOCKERS.md`
- Human actions: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_OPEN_HUMAN_ACTIONS.md`

## Authority And Baseline

- MissionMed OS boot authority: `/Users/brianb/MissionMed_OS/BOOT.md`
- Current mission routing: `/Users/brianb/MissionMed_OS/CURRENT.md`
- I1Q passport: `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- I1Q decision: `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- MR-078A: `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md`
- MR-078B: `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- MR-079: `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- Critical Systems Contract: `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- STAT canon: `_SYSTEM/STAT_CANON_SPEC.md`
- Baseline record: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_BASELINE.md`

`MM-AUTH-ARCH-001.md` was referenced by authority records but was not present at its canonical path. That absence remains an external authority blocker.

## Product Candidate

- Production composition root: `i1q-question-platform/src/runtime.mjs`
- HTTP server: `i1q-question-platform/src/server.mjs`
- Identity adapter: `i1q-question-platform/src/identity-adapter.mjs`
- Identity and request normalization: `i1q-question-platform/src/auth.mjs`
- Shared contracts: `i1q-question-platform/src/contracts.mjs`
- Platform workflows: `i1q-question-platform/src/platform.mjs`
- PostgreSQL boundary: `i1q-question-platform/src/postgres-repository.mjs`
- Evidence validator: `i1q-question-platform/src/validate-evidence.mjs`
- API contract: `i1q-question-platform/openapi.json`
- Browser application: `i1q-question-platform/public/index.html`
- Browser controller: `i1q-question-platform/public/app.js`
- Browser styles: `i1q-question-platform/public/styles.css`
- Synthetic identity fixtures: `i1q-question-platform/fixtures/auth/i1q_authenticated_test_identities.json`

There is intentionally no `i1q-question-platform/runtime-adapters/` implementation. The staging composition root rejects startup until an owner-approved, hash-pinned persistent adapter exists.

## Datastore And Preview

- Base additive migration: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Identity and runtime-role migration: `i1q-question-platform/db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql`
- Forward compensation: `i1q-question-platform/db/rollback/20260715193845_i1q_1008a_compensating_disable.sql`
- Controlled reapply: `i1q-question-platform/db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql`
- Preview target manifest: `i1q-question-platform/deployment/preview-target.json`
- Manual preview workflow: `.github/workflows/i1q-1008a-preview.yml`

The preview target remains `UNASSIGNED`. These files were validated locally and on disposable PostgreSQL only. They were not applied to Supabase, preview, staging, or production.

## Test And Evidence

- Test estate: `i1q-question-platform/tests/`
- Application evidence: `i1q-question-platform/evidence/`
- Mirrored handoff evidence: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/evidence/`
- Evidence generator: `i1q-question-platform/scripts/generate_evidence.mjs`
- Combined handoff builder: `i1q-question-platform/scripts/build_combined_handoff.mjs`
- Combined validation: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/evidence/combined_handoff_validation.json`

## Specialist Reports

- Authority and dependencies: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/herschel/`
- Contracts: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/lorentz/`
- Security: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/security/`
- Diagnostics: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/avicenna/`
- Performance: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/darwin/`
- Release and reliability: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/release_reliability/`
- UX and accessibility: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/ux_accessibility/`
- Independent Red Team: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/red_team/`

## Protected Read-Only References

- MissionMed OS: `/Users/brianb/MissionMed_OS/`
- Matrix, Arena, STAT, Drills, and Daily protected runtime paths are enumerated with hashes in `I1Q_1008A_BASELINE.md` and the Herschel reconciliation report.
- MissionMed HQ and WordPress auth paths are enumerated in the Herschel identity authority map.

No protected runtime, MissionMed OS authority record, shared auth file, production datastore, CDN object, or deployment target was modified by I1Q-1008A.
