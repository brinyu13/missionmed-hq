# V1 Study Schedule 8010R — 8010E E1 Design Decision

Updated: 2026-07-15 UTC  
Scope: restart-safe generation-2 migration and isolated physical current reader  
Decision: ACCEPTED FOR E1; SYNTHETIC AND DEFAULT HIDDEN

## Decision

E1 accepts the ledger-owned generation-2 migration and the isolated physical
current reader for normalized Week/Block truth. It does not activate a command
writer, repository provider, route, option, feature flag, learner-data path, or
automatic installer. The accepted 8010D kernel and E0 domain/schema contracts
remain the parent authority.

## Migration law

- Generation 2 reuses the exact `mmed_v1_8010d_…` advisory-lock namespace, so
  generation-1 and generation-2 installers cannot race.
- Preflight proves the exact parent five-table schema, immutable ledger entries
  1–5, one generation-1 control row, the matching store UUID and manifest, no
  unknown owned table, no same-session temporary shadow, and no positive-
  revision generation-1 truth.
- Existing initialized generation-1 truth fails closed because no fictional
  reader-1 transformer is claimed.
- The gate durably moves from `ready/1` to `migrating/1`; migrations 6 and 7 are
  reconciled through ledger checkpoints; exact post-DDL inspection is required.
- Final activation inserts immutable generation 2 and advances the gate to
  `ready/2` in one transaction. Exact `ready/2` reruns are idempotent.
- Unowned exact tables, partial DDL, checksum drift, future ledger/control rows,
  invalid runner/timestamp provenance, and unexpected namespace tables fail
  closed.

The current reader is version `2`; `PREVIOUS_READER_VERSION` remains `null`.
Generation 1 never had a physical reader implementation, so naming reader `1`
would create a false rollback claim.

## Current-reader law

Every read pins one native database connection and requires a clean,
autocommit-on session. A same-handle SAVEPOINT probe rejects caller-owned write,
read-only, autocommit-off, and XA transaction states before `START TRANSACTION`
can alter caller state. The reader restores the exact caller isolation level.

Before provenance or Plan reads, `SHOW CREATE TABLE` non-destructively proves
that none of the seven permanent owned tables is hidden by a same-session
temporary table. Permanent information-schema shapes, the exact owned-table
set, the expected seven-row ledger, generation registry, gate, manifests,
runner identities, and timestamp chronology are revalidated on every positive
binding; no positive provenance cache is retained.

Plan, current receipt, immutable cutover-watermark receipt, Week rows, and Block
rows are read through one repeatable-read, read-only consistent snapshot.
Normalized rows rebuild the canonical Plan projection, which must match both
the stored canonical bytes and SHA-256. The immutable revision-1 watermark and
the current-revision receipt are distinct roles after revision 1.

The database suppresses `plan_json` before PHP materialization when it exceeds
2 MiB. Receipt content is represented only by bounded lengths and server-side
hashes. Week, Block, migration-ledger, and owned-table reads stop at governed
maximum-plus-one cardinality. Corrupt, oversized, torn, cross-owner, drifted,
or incomplete truth returns only `plan_corrupt` or `dependency_unavailable`;
there is no Calendar fallback and no partial content response.

## Concurrency and restart law

Independent database processes prove both directions of generation-1/
generation-2 lock exclusion. SIGKILL recovery covers every distinct durable
migration and activation state. A separate revision-3 writer commits Plan,
receipt, Week, and Block changes while a revision-2 reader is held immediately
after its Plan query: the held reader must return the complete old snapshot and
a fresh reader the complete new snapshot. A second positive owner remains
distinct throughout.

## Authorization boundary

Decision 12 remains HOLD. E1 authorizes no real schema, real learner data,
production option/control, telemetry, cohort exposure, staging promotion, or
deployment. Command writing, the shared Calendar/V1 owner arbiter, REST and
actor enforcement, runtime binding, current/N-1 rollback, and visible UI remain
E2 and later work.
