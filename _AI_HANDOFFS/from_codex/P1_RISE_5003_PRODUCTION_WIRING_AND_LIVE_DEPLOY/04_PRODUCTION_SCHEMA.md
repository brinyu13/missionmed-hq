# 04 — Production Schema

No migration was applied. All SQL is explicitly proposed and forward-only.

## Proposed Files

- `rise/sql/001_rise_registry.proposed.sql`: immutable registry releases, programs, specialties, program-specialties, browse memberships, assertions/claims, sources, quarantine, activation history.
- `rise/sql/002_rise_app_and_audit.proposed.sql`: private sessions, consent/projections, saved programs, comparisons, match assessments, owner handoffs, operator queue, immutable audit and recovery evidence.
- `rise/sql/003_rise_release_security_hardening.proposed.sql`: source authorization/revocation receipts, release validation, active authorized views, session binding, audit-chain enforcement.
- `rise/sql/004_student_program_state.proposed.sql`: durable per-subject saved/applied/interviewing/ranked state and notes.

`004` uses `(subject_key, program_specialty_id)` as the stable key so user state survives a registry release change, while `last_bound_release_id` remains an enforced foreign key to the last verified program-specialty binding. It enables and forces RLS, uses a transaction-local subject key, revokes `PUBLIC`, and grants only table DML to a no-login runtime role. The service adapter HMAC-pseudonymizes the upstream subject; raw identity is not sent to the store.

All down migrations refuse destructive schema/data deletion. Application rollback must leave student rows and immutable release evidence in custody.

## Not Yet Modeled/Activated

Dedicated typed tables for residents, people, fellowships, fellows, outcomes, SOAP rows, research jobs/tasks, and review decisions were not activated. The generic immutable assertion/source model can hold evidence, but a production migration needs owner-approved privacy, provenance, retention, and relationship contracts before those domains become separate write surfaces.

The schema suite passes RLS, least-privilege, foreign-key, stable-ID, append-only, activation, revocation, and non-destructive rollback checks. Provider migration execution remains blocked.
