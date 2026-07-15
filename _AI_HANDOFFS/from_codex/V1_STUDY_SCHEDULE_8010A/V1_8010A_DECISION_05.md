# V1-8010A Decision 05 — Physical Store and Data Plane

**Status:** ACCEPTED CONDITIONALLY; MIGRATION REQUIRES CAPABILITY PROOF

## Decision

V1 selects additive, Plan-owned WordPress/InnoDB tables behind one repository
interface. It will not reuse Calendar-owned `wp_mmed_events`, diagnostic
`study_plans`/`tasks`, or an unapproved Supabase project.

The schema separates learner Plan identity/cutover, scheduled obligations,
append-only operations, focus/actual facts, external evidence, mentor proposals,
settings, and review records. Stable UUIDs identify domain objects. Database
constraints—not application prechecks alone—enforce owner-scoped uniqueness,
idempotency, lineage, and revision transitions.

## Required migration protocol

- explicit `ENGINE=InnoDB` and supported isolation characterization;
- a dedicated versioned migration runner, never `dbDelta`;
- database migration lock and concurrent-installer rejection;
- additive, restartable steps with recorded checksums;
- injected failure recovery without assuming transactional DDL;
- backup/export/restore proof before each protected application;
- current/N-1 reader compatibility;
- synthetic two-user isolation, uniqueness, retry, and atomic-watermark tests;
- no table drop as rollback.

The first V1 operation/import and learner cutover watermark commit atomically in
one DML transaction. Until the capability test passes, repository and domain
code use synthetic fixtures only and no production schema is applied.

## Authority boundary

The founder’s V1-8010A authorization covers additive, backed-up, tested,
rollback-capable schema work. Gate 12 independently blocks real learner data
until privacy/retention policy is approved.
