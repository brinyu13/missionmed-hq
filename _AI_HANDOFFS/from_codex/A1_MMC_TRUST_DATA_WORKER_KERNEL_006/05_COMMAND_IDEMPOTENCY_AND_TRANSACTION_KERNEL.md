# 05 Command, Idempotency, Transaction, and Audit Kernel

RESULT: `COMMAND_TRANSACTION_KERNEL_LOCALLY_VERIFIED`

## Exact command contract

The wire contract defines seven typed commands: `task.upsert`, `session.close`, `review.decide`, `identity.decide`, `publication.approve`, `job.enqueue`, and `student.respond`. Every command carries an exact `schemaVersion: 1` envelope whose `commandId` uses the shared canonical RFC 9562 variant UUID parser (versions 1–8, including uppercase v7 normalized to lowercase; v9 rejected), plus a scoped idempotency key, expected aggregate version, target, purpose, and kind-specific bounded payload. Numeric/string coercion is prohibited: IDs must be strings and versions must be actual integers. Unknown fields, split target IDs, protected authority/lineage fields, and non-canonical values fail closed before mutation. Command timestamps use the shared strict RFC 3339 parser, so impossible calendar dates/rollover and offsets beyond `14:00` cannot enter the semantic hash.

The local command kernel owns the cross-domain transaction law, not every domain's business semantics. `task.upsert` has a canonical local handler. The other six command kinds deliberately return `501 COMMAND_HANDLER_NOT_ENABLED` until their owning evidence, identity, publication, job, session, or student-response adapter is injected. This prevents a generic command layer from synthesizing a second, weaker source of domain truth. Tests prove the failed commands leave no aggregate, audit, receipt, lineage, or outbox residue.

## Transaction and replay law

- Repository serialization spans multiple kernel instances that share a repository.
- `commandId` uniqueness is scoped by tenant and environment.
- The idempotency scope binds tenant, environment, principal, command kind, target, schema version, and key; the semantic hash additionally binds purpose, expected version, and canonical payload.
- An exact replay returns the original stored result only after current authorization is rechecked.
- Reusing a command or idempotency identity for different semantics returns deterministic `409`.
- Aggregate identity is `(tenant, environment, aggregate kind, target)` rather than command action, preventing two actions from creating parallel versions of one domain object.
- Expected version zero is valid for create; a stale version returns the canonical nested conflict envelope with `expectedVersion`, `currentVersion`, and `COMPARE_AND_REAPPLY`.
- The asynchronous domain handler runs before a second literal-true authorization check at the commit boundary. Revocation during handler execution therefore leaves no mutation.
- Aggregate, version, command receipt, object results, lineage, audit event, and outbox event commit atomically. Injected failures prove full rollback.

The success result is exact and frozen: `ok`, `status`, `commandId`, `aggregateVersion`, `objectResults`, `auditId`, `correlationId`, and `replayed`. `objectResults` is a bounded list of exact `{id, kind, version}` records so a future owning adapter can return every canonical object changed without leaking implementation data.

## Audit integrity

Each command commit appends a tenant/environment-scoped hash-chain event. The event binds sequence, previous digest, principal, effective role, subject, assignment, purpose, command identity and kind, target/version, semantic hash, before/after hashes, outcome, correlation ID, and server time. The next scoped command validates the entire prior chain before mutation; a rewritten digest stops execution with `COMMAND_AUDIT_CHAIN_INVALID`.

This is tamper-evident local evidence, not an assertion that process memory is durable. The additive SQL kernel supplies the durable append-only audit boundary; database proof is reported separately in reports 04 and 15.

## Concurrency evidence

The executable stress contract proves:

- 100 concurrent exact duplicates converge on one commit and one result identity;
- concurrent semantic mismatch, stale version, scoped command-ID reuse, split-target, and protected-lineage attacks fail deterministically;
- replay and commit-time authority are both rechecked;
- tampered audit history blocks the next mutation;
- an injected failure after any staged component leaves no partial state.

## Decision rationale and tradeoff

The rejected alternative was to install shallow default handlers for every declared command merely to make each route return success. That would duplicate the stronger domain kernels and allow syntactically valid but semantically unverified publication, identity, review, or provider work. The selected injected-owner boundary is more explicit for developers and safer for future adapters, at the cost of six deliberately unavailable command behaviors in this local foundation.

## Scope and rollback

This is a local reference/contract kernel. The HTTP gateway permits the memory kernel only in `FIXTURE` or `LOCAL`, requires an admin until persisted assignment authorization exists, and still requires single-writer cutover authority. `STAGING` and `LIVE` require a durable adapter. Rollback is commit-scoped or feature-plane disablement; no v1 writer is restored and no acknowledged v2 write may be discarded. No database, provider, staging, or production write plane was enabled.
