# I1Q-1008A Migration Preview

## Candidate Files

- base migration: `20260715122434_i1q_1007x_question_platform.sql`
- identity and role migration: `20260715193625_i1q_1008a_identity_runtime_contract.sql`
- forward compensation: `20260715193845_i1q_1008a_compensating_disable.sql`
- controlled reapply: `20260715193955_i1q_1008a_runtime_reapply.sql`
- target manifest: `i1q-question-platform/deployment/preview-target.json`
- manual workflow: `.github/workflows/i1q-1008a-preview.yml`

## Local Validation

`PASS`:

- valid JSON target manifest
- valid YAML workflow
- secret-free source test and evidence-validation job
- step-scoped preview secrets
- timestamped migration names and transaction wrappers
- duplicate-object and idempotency checks
- destructive-statement scan
- forced-RLS and role/grant checks
- production-target denial
- backup and restore evidence gate
- exact operation, commit, SQL, workflow, approval-record, and remote-history binding
- separate apply, compensation, and reapplication history gates
- post-operation role, RLS, and feature-flag checks
- artifact redaction and inventory gate that must succeed before upload
- 9 of 9 focused migration/workflow contract tests

## External Status

`NOT RUN`: no workflow dispatch, project link, dry run, provider backup or restore verification, approved schema diff, migration apply, schema checksum, hosted attack suite, or remote evidence artifact exists because the manifest is intentionally `UNASSIGNED`.

The schema-only before snapshot is explicitly a fingerprint, not a database backup. A provider backup identity and tested restore reference are mandatory before any write operation.
