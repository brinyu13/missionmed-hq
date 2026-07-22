# 06 Worker, Queue, Outbox, and Inbox Kernel

RESULT: `WORKER_FENCING_RECOVERY_AND_EFFECT_IDEMPOTENCY_LOCALLY_VERIFIED`

## Canonical job contract

The job vocabulary is exact: `SOURCE_DISCOVERY`, `ASSET_ACQUISITION`, `TRANSCRIPT_PROCESSING`, `AI_ANALYSIS`, `PUBLICATION_RENDER`, and `RECONCILIATION`. Enqueue binds a canonical UUID target, exact `jobKind`, signed queue, opaque asset handle, one active `authorityGrantId`, payload digest, stable provider-idempotency-key digest, principal scope, and idempotency identity. The singular grant is intentional: every executable job has one primary policy/assignment authority that can be locked and revalidated without ambiguous “any grant” semantics; typed handoff edges carry producer/consumer lineage separately.

Claims require a derived worker principal with exact workload and queue. Worker claim, completion, outbox dispatch, inbox consumption, analysis, and asset processing are distinct capabilities; mentor, operator, and admin roles do not inherit workload-only authority.

## Lease, provider, and recovery law

- One winner is elected across 1,000 concurrent claim attempts.
- Generation increments for every new lease and fences stale workers.
- Attempts are capped at five; lease duration is bounded to 15–300 seconds.
- Lease generation, lease seconds, retry delay, and other integer fields require actual safe integers; numeric strings are rejected rather than coerced.
- A generation-bound dispatch intent containing the immutable provider-key digest must commit before the provider result can be recorded.
- Provider results are append-once per generation. The provider key cannot be rebound between dispatch, result, retry, or history.
- A successful terminal job must match one exact generation-bound result event on result digest/time, provider receipt digest, provider-idempotency truth, and provider-idempotency-key digest.
- Once a job is `SUCCEEDED`, `FAILED`, `DEAD_LETTER`, or `CANCELLED`, every later row update is rejected; provider evidence and completion identity cannot be rewritten through an owner or future privileged adapter.
- Every recorded provider result is evidence first. Its transition/outbox event is `QUARANTINED`; only a separately authorized completion or reconciliation emits a deliverable operational event.
- A response arriving just after lease expiry may be preserved only for the exact unchanged generation and owner. It cannot complete directly or make a newer lease stale.
- Revocation stops new work and completion, while preserving the already-issued exact-generation provider outcome as quarantined evidence for operations adjudication.
- An expired dispatched job is never blindly reclaimed. `CONFIRMED_NOT_SENT` may schedule bounded retry; `OUTCOME_UNKNOWN` can only dead-letter unless server-proven provider idempotency makes retry safe.
- Recovery inputs—finding, disposition, evidence digest, and retry delay—are passed into the authorization decision, recorded in immutable history, and cannot be invented by a workload principal.

## Outbox/inbox effect boundary

Outbox events are authoritative, hash-bound records with tenant, environment, job/generation, aggregate, effect kind, one immutable bounded `delivery_queue_name` (default `mmc.outbox`, not a schema-wide fixed value), and independent delivery generation. Cursor progress is tenant/environment/queue scoped, so an idle tenant cannot be starved by another tenant's scan position.

The dispatcher lease exposes the server-bound effect and aggregate identity. A consumer must return the same effect kind, target kind, and target ID. The bounded repository projection, inbox receipt, and `DELIVERED` state commit atomically; no arbitrary callback or provider side effect is accepted inside this transaction. Exact replay returns `duplicate: true` even when the delivery lease has expired, while a different effect under the same event identity conflicts.

The terminal producer event is deliverable; provider-evidence events remain quarantined. Caller-selected consumer identity and cross-tenant cursor/effect rebinding are rejected.

## Audit and stress evidence

Every job transition appends a tenant/environment-scoped hash-chain audit event before its outbox event. Rewriting prior audit content stops the next transition atomically.

The local stress contract delivered 10,000 logical events ten times each: 100,000 delivery attempts produced exactly 10,000 effects and 90,000 duplicate receipts. It also covers 1,000-way claim contention, same-repository multi-kernel serialization, stale generations, late provider results, authority revocation, lost-response replay, result-less recovery, operator adjudication, effect-target mismatch, tenant-scoped cursors, injected rollback, and tampered audit history.

## Alternatives, ecosystem impact, and rollback

A simple “lease expired, retry” queue was rejected because it can duplicate an already-issued provider effect. A generic callback inbox was rejected because it cannot atomically prove an external effect. The selected model is more verbose and requires explicit operations reconciliation, but it makes ambiguity visible and preserves evidence for forward repair.

The kernel is isolated under MMC and does not start a worker daemon, connect to Webex, invoke AI, download media, or mutate R2/Stream/File Vault. The JavaScript repository is a deterministic local reference. SQL supplies the reviewed worker/outbox/input transition RPCs for owner-seeded fixture jobs, but no authenticated runtime enqueue or canonical artifact-output mutation RPC; its PostgreSQL proof is a foundation test, not live end-to-end execution. Rollback before release is commit-scoped or feature-plane disablement; after an acknowledged v2 write, only forward repair is allowed. No provider, configured database, staging, or production mutation occurred; disposable local PostgreSQL proof is documented in reports 04 and 15.
