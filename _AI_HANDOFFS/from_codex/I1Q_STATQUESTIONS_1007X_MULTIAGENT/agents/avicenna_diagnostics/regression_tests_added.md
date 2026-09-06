# Regression Tests Added

## Scope

Avicenna operated read-only and added no code or tests. This file records the current test estate and the regressions Root still needs.

## Changes

Tests added by Avicenna: `0`.

The final snapshot contains 12 local test files. Three untracked datastore suites are present:

- `tests/migration-1007x.test.mjs`
- `tests/postgres-migration.test.mjs`
- `tests/postgres-repository.test.mjs`

## Current Test Result

Command: `npm test`

- Total: `195`
- Passed: `194`
- Failed: `0`
- Skipped: `1`

## Existing Coverage That Passed

- STAT and Drills adapter contracts
- Class A closed-world and answer-leak scans in application adapters
- API and auth boundaries
- Evidence validator negative fixtures
- Static migration shape, forced RLS inventory, grants, and immutable table checks
- In-memory workflow and release mechanics
- Privacy and speaker-normalization gates
- PostgreSQL repository input and transaction behavior with a fake driver
- UI workflow, accessibility, and bootstrap checks

## Missing Regression Tests

Root should add or strengthen the following before migration certification:

1. Execute the full PostgreSQL migration test on an authorized disposable database and require zero skips.
2. Call `i1q.create_channel_artifact` with answer-bearing and class D payloads labelled class A and `pre_answer`; require rejection.
3. Prove artifact channel, phase, and class match the exact referenced Channel Security Policy and its closed-world `field_rules`.
4. Attempt release validation with arbitrary or incomplete check IDs; require all six official leak tests for every artifact.
5. Prove an expired `rights_records.expires_at` blocks release even when status remains `cleared_for`.
6. Prove medical assignment cannot be created or accepted before editorial passage and that every review event completes exactly one assignment.
7. Prove draft revision editing works only before candidate freeze, then prove source, redaction, and extraction records reject update and delete.
8. Prove revision supersession and retirement have an append-only representation.
9. Run the positive and negative RLS matrix for author-own, reviewer-assigned, governance, analytics, answer, source, incident, and psychometric scope.
10. Run two concurrent compensation calls and require one compensation audit record.
11. Prove the compensation function remains unexecutable by the future runtime role.
12. Prove the evidence generator selects the accepted 1007X migration pair, emits all six flags, records all current test files, and reports current blockers rather than obsolete ones.

## Risks And Blockers

Regex assertions can prove text is present but cannot prove PostgreSQL behavior. Fake-driver tests can prove bound SQL construction but cannot prove RLS, trigger, transaction, or concurrency semantics.

## Paths

- Migration tests: `i1q-question-platform/tests/migration-1007x.test.mjs`, `tests/postgres-migration.test.mjs`
- Repository tests: `i1q-question-platform/tests/postgres-repository.test.mjs`
- Evidence tests: `i1q-question-platform/tests/evidence-validator.test.mjs`
- Security tests: `i1q-question-platform/tests/security-regressions.test.mjs`
- Current SQL: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

## Confidence

High that the listed gaps are absent from the final executed coverage. No claim is made that this list replaces a full staging test plan.

## Root Handoff

Add the focused tests after repairing the underlying contracts, then rerun the complete suite and the disposable PostgreSQL proof. Do not count a skipped database test as a passing migration gate.
