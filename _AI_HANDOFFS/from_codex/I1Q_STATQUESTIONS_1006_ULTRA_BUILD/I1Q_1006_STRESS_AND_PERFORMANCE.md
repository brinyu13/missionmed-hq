# I1Q 1006 Stress and Performance

## Executed local load check

VERIFIED: The evidence runner inserted 10,000 synthetic candidate rows into the in-memory repository and requested a bounded 200-row page.

VERIFIED: The check passed the local threshold of 8,000 milliseconds.

VERIFIED: Exact measured time is recorded in `evidence/load_results.json` and is regenerated on every evidence run.

VERIFIED: The existing application test also exercises 5,000 synthetic inserts with a bounded 50-row page.

## Functional stress controls

- VERIFIED: Pagination is capped at 200 rows.
- VERIFIED: Duplicate IDs fail.
- VERIFIED: Idempotency keys return the original result.
- VERIFIED: Optimistic locking rejects stale mutable updates.
- VERIFIED: Immutable entities reject updates.
- VERIFIED: Audit chain validation covers high event volume in the synthetic load.
- VERIFIED: Batch plans skip completed sources and retain checkpoints.

## Not executed

BLOCKED: No authorized production-shaped database or queue exists for these tests:

- concurrent authors and reviewers
- RLS under concurrent sessions
- large real transcript rendering
- candidate queue paging on Postgres
- full-text search
- extraction throughput and provider rate limits
- release assembly at corpus scale
- API rate limiting
- database index plans
- memory and CPU under sustained server load
- queue backpressure and dead-letter recovery
- rollback under active traffic

## Performance gate

PARTIAL: Local service baseline passes.

BLOCKED: Gate 11 performance thresholds cannot pass until canonical staging provides database, queue, identity, monitoring, and representative data volumes.

DO NOT CLAIM: The local 10,000-row result is not a production load test.
