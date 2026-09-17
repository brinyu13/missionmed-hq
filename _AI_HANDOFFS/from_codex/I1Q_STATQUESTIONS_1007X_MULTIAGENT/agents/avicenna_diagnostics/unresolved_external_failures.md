# Unresolved External Failures

## Scope

External or authority-dependent conditions that Avicenna could not prove in a read-only local diagnostic run.

## Current External Blockers

### Disposable PostgreSQL target

`psql` is installed, but `I1Q_POSTGRES_TEST_URL` is not configured. No authorized isolated database was supplied. Therefore no apply, reapply, role attack, RLS, compensation, concurrency, query-plan, or reapply-under-history proof was executed.

### Canonical datastore route

The 1007X migration and PostgreSQL repository are local untracked candidates. No evidence proves an approved RANKLISTIQ migration workflow, preview project, runtime role, connection adapter, backup, or rollback operator has accepted this exact state.

### Canonical authentication adapter

The application tests use local synthetic actors or injected resolvers. No evidence in this diagnostic run proves the MissionMed HQ identity and session adapter is wired to the Question Platform in staging or production.

### Staging and production

No staging URL, production URL, deployment record, browser smoke, monitoring signal, backup proof, or rollback execution was available or attempted. Current evidence truthfully claims `BLOCKED`, but the generated deployment manifest itself is stale.

### Medical and publication authority

Medical governance remains unassigned in the routed authority. No credentialed physician approval record was inspected. No student release is eligible. All six I1Q flags are expected to remain off.

### Real corpus release gates

The local privacy mechanics are synthetic. No source-complete human gold pilot, real-corpus privacy metric estate, real candidate extraction, or credentialed medical review was executed in this diagnostic task.

## Evidence Failure Versus External Failure

The 19 validator errors are local generated-evidence failures and can be repaired locally after the generator is corrected. They must not be mislabelled as proof that staging or production failed, because neither environment was exercised.

The skipped PostgreSQL test is an external test-environment dependency. It is also a required migration gate, so the migration remains uncertified.

## Changes

None. No provider, database, feature flag, deployment, auth system, protected consumer, or Git state was touched.

## Tests

- Local suite: `194` passed, `0` failed, `1` skipped.
- Evidence validator: `19` errors, reproduced.
- External runtime tests: not run.

## Risks

- Static SQL behavior may differ from PostgreSQL execution.
- A future runtime grant could activate currently dormant SQL authorization gaps.
- Regenerating evidence before correcting its authority inputs could replace stale evidence with newly generated but still inaccurate evidence.

## Paths

- Migration: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Compensation: `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`
- Evidence generator: `i1q-question-platform/scripts/generate_evidence.mjs`
- Generated evidence: `i1q-question-platform/evidence/`

## Confidence

High for the absence of local configuration and the observed skipped gate. No confidence claim is made about environments that were not accessed.

## Root Handoff

Keep deployment and all consumer flags blocked. After local contract repairs, use the canonical approved route to provision an isolated preview database, run the full PostgreSQL and RLS matrix with zero skips, execute compensation and reapply, then regenerate and validate evidence before considering staging.
