# I1Q 1006 Path Index

## Candidate application

- `i1q-question-platform/package.json`
- `i1q-question-platform/openapi.json`
- `i1q-question-platform/src/auth.mjs`
- `i1q-question-platform/src/contracts.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/src/hash.mjs`
- `i1q-question-platform/src/pipeline.mjs`
- `i1q-question-platform/src/platform.mjs`
- `i1q-question-platform/src/privacy.mjs`
- `i1q-question-platform/src/server.mjs`
- `i1q-question-platform/src/store.mjs`
- `i1q-question-platform/public/index.html`
- `i1q-question-platform/public/styles.css`
- `i1q-question-platform/public/app.js`
- `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `i1q-question-platform/db/rollback/0001_compensating_disable.sql`
- `i1q-question-platform/fixtures/synthetic_transcript.json`
- `i1q-question-platform/fixtures/synthetic_release_input.json`
- `i1q-question-platform/fixtures/legacy_v4_mapping.synthetic.json`
- `i1q-question-platform/scripts/generate_evidence.mjs`
- `i1q-question-platform/tests/api.test.mjs`
- `i1q-question-platform/tests/migration.test.mjs`
- `i1q-question-platform/tests/performance.test.mjs`
- `i1q-question-platform/tests/platform.test.mjs`
- `i1q-question-platform/tests/ui.test.mjs`

## Independent audit

- `audit/README.md`
- `audit/lib/hardened_evaluators.mjs`
- `audit/run_official_1005_isolated.mjs`
- `audit/run_adversarial_audit.mjs`
- `audit/run_all.mjs`
- `audit/results/official_1005_suite.json`
- `audit/results/adversarial_audit_report.json`
- `audit/results/audit_summary.json`

## Governance patches

- `registration/i1q_registration_patch.json`
- `registration/protected_integration_decision_request.json`

## Machine evidence

Evidence exists under both `i1q-question-platform/evidence/` and handoff `evidence/`:

- accessibility results
- artifact checksums
- browser results
- candidate counts
- deployment manifest
- Drive discovery
- extraction metrics
- foundation audit
- health checks
- inventory report
- legacy reconciliation
- load results
- migration validation
- OpenAPI validation
- release manifest
- rollback manifest
- security results
- test results
- UX scorecard

## Visual evidence

- `screenshots/desktop-*.png`, 12 files
- `screenshots/tablet-*.png`, 3 files
- `screenshots/mobile-*.png`, 4 files

## Required Markdown packet

The 21 required phase files are in this directory. `I1Q_1006_COMBINED_HANDOFF.md` is generated from all run-created Markdown except itself and includes `audit/README.md`.

## Protected unchanged roots

- `LIVE/`
- `missionmed-hq/`
- `app/api/`
- `supabase/migrations/`
- `/Users/brianb/MissionMed/03_PROGRAMS/USMLE/DrJ-QuestionBank/`
