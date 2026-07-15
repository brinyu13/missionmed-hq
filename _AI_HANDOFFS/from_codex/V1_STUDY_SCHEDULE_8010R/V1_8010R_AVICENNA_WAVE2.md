# V1-8010R Avicenna Wave 2 Architecture Review

## Verdict

8010C can proceed as a default-hidden, fixture-only seam after 8010B is sealed.
A genuine 8010D InnoDB proof cannot yet be claimed. No files were modified by
Avicenna.

## Smallest 8010C sequence

- Add a fail-closed V1 access/mode resolver for authenticated actor, verified
  360 entitlement, canonical release mode, and action/owner authorization.
- Add pure domain and repository interfaces with a null/fixture repository that
  cannot create learner truth.
- Add a separate Study-owned REST controller and namespace; do not reuse
  `MMED_REST_API::can_access()`, which checks only login.
- Add privacy-safe allowlisted observability with no learner identifier, Plan
  payload, or durable sink before privacy approval.
- Add a separately hooked, content-hashed loader that enqueues only after
  server-side access/exposure approval and no-ops while hidden.
- Bootstrap the classes without invoking migration.
- Cover every mode, missing/malformed entitlement, administrator-negative
  mutation, owner substitution, nonce failure, hidden loader, and safe
  observability with synthetic fixtures.

The namespace is not fixed by current authority and must be explicitly recorded.
The four canonical modes from Decision 13 must not be reduced to a boolean flag.
Default is `V1_HIDDEN_NO_TRUTH`.

## Entitlement boundary

The existing CAM handoff claim is evidence, not V1 authority code. A dedicated
adapter may validate its trust, currentness, revocation, expiry, and purchase or
current-legacy fields, but must fail closed and exclude the CAM administrator
override. Administrators are audit-only.

## 8010D candidate

Add a checksummed, restartable migration runner with advisory lock, a sole
transactional `$wpdb` writer, explicit `ENGINE=InnoDB` migrations, and a
disposable WordPress/MySQL integration harness. Candidate relations minimally
cover migration ledger, Plan identity/cutover, append-only operations, and
scheduled obligations. Final table names remain undecided.

Proof requires engine/isolation, two independent sessions, ownership and
idempotency constraints, concurrent-installer denial, restart after injected DDL
failure, atomic first operation/import plus watermark, current/N-1 reader,
export/destructive synthetic change/restore, and non-drop rollback.

## Hard blockers

- No disposable WordPress/MySQL/MariaDB environment, Composer/PHPUnit harness,
  backup/restore runner, or migration runner exists in the repository.
- Stub `$wpdb` fixtures cannot prove engine, isolation, locks, constraints,
  sessions, transactions, or restore.
- MR-079 does not permit local PHP, Docker, WP-CLI, MySQL, or backup commands in
  this run. Safe remote/isolated execution is required.
- Staging/production persistence later needs exact active database evidence and
  an out-of-band credential path; no secret may enter files.
- Decision 12 privacy, principal entitlement proof, and quality/RC gates block
  real learner exposure, not default-hidden 8010C source work.
