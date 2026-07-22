# 15 Concurrency, Stress, Idempotency, and Recovery

RESULT: `LOCAL_CONCURRENCY_AND_RECOVERY_KERNEL_VERIFIED`

## Tested contention matrix

| Boundary | Load/failure shape | Settled result |
| --- | --- | --- |
| Command idempotency | 100 concurrent exact duplicates | One canonical commit, one audit/outbox/receipt identity; all responses converge |
| Job leasing | 1,000 concurrent claims | One elected lease; generation fences every stale claimant |
| Outbox/inbox | 10,000 logical events delivered ten times | 100,000 attempts → 10,000 effects + 90,000 exact duplicates |
| Asset registration | 100 concurrent exact registrations | One opaque handle and atomic receipt |
| Asset revocation | 100 concurrent revocations plus context-mutation race | One converged revoked state; stale/rebound context cannot revoke another grant |
| Transcript/proposal create | 100 conflicting creates per identity | One winner; 99 deterministic conflicts; no overwrite |
| Evidence review | Concurrent ACCEPT/REJECT and queued revocation | One terminal decision or zero after revocation; no partial canonical |
| Identity corpus | 5,000 deterministic negative pairs | Zero false promotions; arbitrary-subject promotion denied |

## Command recovery properties

The repository serializes transactions across kernel instances. Semantic command hash, scoped command ID, idempotency identity, aggregate version, object results, audit, lineage, outbox, and receipt share one atomic commit. Failure injection after aggregate, audit, lineage, outbox, or receipt proves no partial state survives. Exact replay rechecks current authority; revocation during an asynchronous domain handler is caught by a second authorization check immediately before commit.

The audit chain is checked before mutation and extended in the same transaction. A rewritten prior event stops forward progress instead of allowing a false continuation.

## Provider uncertainty and worker recovery

The worker model treats provider dispatch and result persistence as separate crash windows:

1. A dispatch intent containing generation and stable provider-key digest commits before any result can be accepted.
2. A result is append-once evidence for the exact generation and is initially non-deliverable/quarantined.
3. Normal completion rechecks current authority and compatible outcome/disposition.
4. A late or revoked result is preserved but requires authorized reconciliation; it cannot be silently dropped or auto-promoted.
5. An expired dispatched generation with no result cannot be reclaimed. Operations must supply bounded immutable evidence: confirmed-not-sent may retry; unknown outcome dead-letters unless provider idempotency is proven.
6. Retry archives result/dispatch history before a new generation, preserving why a second provider attempt was safe.

Tests prove a success cannot be retried, unknown outcome cannot retry without proof, a late exact-generation response can be reconciled without the original workload, stale results lose after a newer generation, and recovery evidence/disposition is part of the authorization decision.

## Outbox/inbox recovery

Outbox dispatch has its own generation/lease and a tenant/environment/queue cursor. The consumer receives a server-bound aggregate/effect identity; target mismatch fails. Effect, inbox receipt, and `DELIVERED` state are one atomic transaction. A simulated failure before that commit leaves all three unchanged. An exact lost-response replay returns duplicate success even after lease expiry; a changed effect conflicts. Multi-kernel and cross-tenant regressions prove no snapshot/replace lost update and no global-cursor starvation.

Provider-evidence transition events remain `QUARANTINED`; an authorized terminal/reconciled transition emits the deliverable event. This prevents an outbox consumer from operationalizing evidence merely because it was recorded.

## Durable PostgreSQL lock proof

PostgreSQL 16.13 in disposable local cluster `/private/tmp/mmc006-final-proof4.fjnmwh` supplied the final exact-byte durable proof. It used the frozen migration, validation-snippet, static-validator, and JavaScript-validator hashes recorded in reports 04 and 19, not a configured MissionMed database.

- Readable publication head: session B waited on `Lock|transactionid`; after A committed, the duplicate head was rejected and exactly one readable head remained.
- Publication seal versus late child: session B waited on `Lock|transactionid`; after A committed the successor seal, the late item was rejected. The successor was `PUBLISHED`, its predecessor `SUPERSEDED`, one committed child remained, and the late-child count was zero.
- Concurrent job completion: session B waited on the scoped advisory lock. After A committed, both callers converged to the exact `FAILED` result. Exactly one `JOB_STATE_TRANSITION`, one completion event, and one provider-evidence resolution existed.
- Concurrent outbox terminal completion: session B waited on the scoped advisory lock. Both callers converged to `DEAD_LETTER`; exactly the claim and terminal delivery transitions existed, with no consumer effect/inbox row and no replay transition.

The clean migration/fixture/forced-constraint/rollback cycle passed and left all 31 tables empty; migration reapply and a fixture `COMMIT` proof also passed. Catalog inspection found 31/31 tables with RLS enabled and forced, 144/144 enabled user triggers, 65 authenticated SELECT policies, 74 security-definer and 23 invoker functions, and no public/anonymous access to the security-definer surface. The final audit chain contained 64 events with contiguous unique sequences, unique digests, zero gaps, and zero broken links. Raw server logs include three rolled-back verifier setup attempts while refining race fixtures plus the expected rejected contenders; none persisted and the final setups/outcomes were clean. These tests establish local PostgreSQL locking, idempotent convergence, and rollback behavior. They do not establish managed-Supabase latency, failover, multi-host worker throughput, provider behavior, or a runtime adapter that this run intentionally leaves sealed.

## Performance interpretation

The 100,000-delivery proof completes against deterministic process memory and validates algorithmic/idempotency behavior, not production throughput, database latency, or provider capacity. No service-level objective is inferred. Staging must repeat representative load with the durable adapter, database locks, network latency, supervisor restart, and multiple worker processes.

## Alternatives and tradeoffs

- Snapshot-and-replace repositories were rejected because concurrent kernels can lose updates.
- At-least-once provider retry without dispatch evidence was rejected because it can duplicate external effects.
- Arbitrary inbox callbacks were rejected because their side effects cannot share the receipt transaction.
- Discarding revoked/late results was rejected because it destroys the evidence needed for safe adjudication.

The selected design favors explicit quarantine and operations recovery over automatic progress. This can increase dead-letter/reconciliation workload, but makes every ambiguity visible and recoverable.

## Rollback and future proof

Local failure injection restores the exact pre-transaction state. Before external cutover, commit revert or feature-plane disablement is sufficient. After an acknowledged v2 write/provider effect, rollback cannot resurrect v1 or erase receipts; use append-only evidence and forward repair.

The exact durable PostgreSQL artifact hashes, catalog proof, and access matrix are recorded in report 04. No configured database, queue, provider, staging service, or production service was mutated by these local stress tests; only disposable local PostgreSQL databases were used.
