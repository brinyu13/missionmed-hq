# I1Q-1007X Datastore

## Verdict

`OFFLINE POSTGRES CONTRACT PASS, PREVIEW AND STAGING NOT RUN`

## Candidate

The additive candidate is:

`i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

It is a standalone, forward-only, transaction-wrapped migration for PostgreSQL 15 or later. It creates the additive `i1q` schema, 52 architecture and operational tables, immutable lineage, guarded draft mutation, answer isolation, source-reference isolation, review lifecycle functions, release membership, channel artifacts, validation evidence, audit history, feature flags, and compensation tracking.

The application also contains a transaction-scoped Postgres repository contract. It requires a dedicated connection, rejects invalid actor or transaction input before SQL, sets trusted actor context inside the transaction, and releases or rolls back on every tested failure path.

## Validation

Static migration tests prove table coverage, object naming, transaction headers, idempotent guards, immutable records, exact projections, answer separation, release controls, compensation, and absence of broad grants or destructive statements.

A disposable local PostgreSQL database passed all 13 migration-contract tests, including:

- first apply and exact reapply
- anonymous and role boundary attacks
- revoked-reviewer answer denial
- channel-policy confusion denial
- Class A answer leak denial
- Class A and Class C release-scoped Class D key and value denial
- 196 actual mixed-case identifier probes across seven identifier families, four Class C prose fields, and seven direct or encoded variants
- 16 separator-only and full printable-ASCII marker probes at URL depths 2 and 3
- bounded eight-pass decoding, 64 KiB scalar rejection, and zero persisted artifact or payload rows for every denied probe
- official validation evidence binding
- compensation applied twice
- retained history and forced RLS
- exact reapply after compensation

## Unresolved Integration

The HTTP service still uses the in-memory repository in local synthetic mode. No canonical RANKLISTIQ project-pinned migration directory, preview target, staging target, runtime grant manifest, or unprivileged I1Q runtime role was available. No production or staging migration was applied.

The migration remains an app-owned candidate and must not be copied into a shared migration history by hand.
