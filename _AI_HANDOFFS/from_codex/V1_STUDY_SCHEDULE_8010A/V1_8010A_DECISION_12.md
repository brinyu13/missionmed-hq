# V1-8010A Decision 12 — Retention, History, Privacy, and Deletion

**Status:** IMPLEMENTATION BOUNDARY ACCEPTED; REAL-LEARNER RELEASE HOLD

## Decision

No retention value is invented in engineering. “Permanent” retention is
prohibited. The implementation may create explicit data classifications,
policy-version fields, export/delete/anonymize interfaces, consent boundaries,
and synthetic-fixture tests, but it may not activate destructive expiry jobs or
collect real learner Plan/behavior data until an approved policy defines:

- purposes and explicit windows for operations, current Plan, Review records,
  aggregates, evidence, mentor suggestions/responses, and telemetry;
- mentor-visible fields and whether minute-level actuals require opt-in;
- account deletion versus audit/tombstone preservation;
- export scope and identity verification;
- backup retention and deletion propagation;
- notice/consent requirements for study-behavior analytics.

## Safe defaults before policy approval

- synthetic identities/data only outside production;
- mentor private notes and minute-level actual sharing disabled;
- no learner-content telemetry or logs;
- no automated destructive deletion/anonymization;
- no unmanaged production copies;
- staging cleanup uses synthetic-fixture teardown and recorded verification;
- quotes remain separately gated by Decision 02.

## Effect on the execution loop

This hold does not block pure domain code, fixture UI, default-hidden access and
repository seams, local/synthetic migration proofs, accessibility, responsive,
performance, security, rollback, or package work. It blocks real-student import,
real-learner staging/production collection, production telemetry, destructive
retention jobs, cohort exposure, and production deployment until privacy/legal
approval is attached to this record.

This is the mission’s current genuine legal/privacy stop; routine engineering
must continue independently.
