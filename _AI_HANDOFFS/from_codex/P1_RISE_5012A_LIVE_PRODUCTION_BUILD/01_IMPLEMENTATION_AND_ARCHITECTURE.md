# Implementation and Architecture

The implementation is additive to the existing RISE service:

1. Production PostgreSQL owns router settings, provider routes, quota ledgers, jobs, attempts, and audit events.
2. Every research table has forced RLS; no `PUBLIC`, `anon`, or `authenticated` table grant exists.
3. Server eligibility gates precede quota reservation and enforce global pause, student pause, emergency kill, entitlement, exact program allowlist, quota, route, budget, and concurrency.
4. The live canary allowlist uses stable ACGME IDs `1854831078` and `1851113100`. It does not rely on release-specific RISE internal IDs.
5. The live admin Research Router controls the real database-backed subsystem.
6. The isolated Railway worker uses transactional `FOR UPDATE SKIP LOCKED` leasing and time-limited heartbeats.
7. Worker routing is provider-neutral: loaded adapters are selected by each job's provider key. Missing adapters refund and fail closed. Provider results can enter the existing canonical `ingestProviderRecord` evidence path; replay produces no ingest payload.
8. Replay is offline, `TEST_ONLY`, internal-only, zero-spend, and cannot fabricate canonical evidence.
9. The student Program File CTA is rendered only for an allowlisted ACGME ID while all enable gates are open.

The normal build no longer overwrites the current live 5011 application from an older locked-shell derivative. The Fable-derived presentation and current live 5011 filters remain intact; `sync:fable` remains available as an explicit command, not an implicit destructive build step.

One unused additive database column named `canary_program_specialty_ids` remains from the first fail-closed identity-seam attempt. It is not read by the final application. DR-215 forbids dropping production objects; cleanup is deliberately deferred.
