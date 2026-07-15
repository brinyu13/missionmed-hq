# V1 Study Schedule 8010D — Protected Design Decision

Filed: 2026-07-15 UTC
Status: ACCEPTED FOR ISOLATED SYNTHETIC IMPLEMENTATION ONLY

## Authority

This decision implements founder authorization and accepted V1-8010A Decisions 04, 05, 06, 08, 09, 10, 12, and 13. It does not authorize production schema, options, learner data, activation, or deployment. Decision 12 remains HOLD.

The governed remote parent for 8010D is the 8010C application commit `08e3681b6ea21f1ad65bc87db4ffae0597adc951`; local HEAD is stale and must not be used as Git authority. Local bytes remain the shared implementation workspace. MR-079 continues to prohibit local Git writes and local PHP/Docker/WP-CLI.

## Additive capability-kernel schema

8010D will prove five Plan-owned capability-kernel tables, all explicitly
`ENGINE=InnoDB`, `ROW_FORMAT=DYNAMIC`, and `utf8mb4_bin`:

1. `mmed_v1_study_store_gate` — singleton physical store/generation and writer/migration gate.
2. `mmed_v1_study_store_generations` — append-only content-addressed generation and current/N-1 reader manifest.
3. `mmed_v1_study_migrations` — checksummed restartable migration ledger.
4. `mmed_v1_study_plans` — one owner-scoped synthetic Plan snapshot and durable arbitration/watermark row.
5. `mmed_v1_study_operations` — append-only revision, idempotency, request, result, and replay receipts.

This is the isolated persistence proof authorized for 8010D, not the final domain
schema promised by Decision 05. It proves migration, locking, revision,
idempotency, watermark, snapshot, reader, and recovery mechanics with synthetic
Plan bytes only. The governed Week, obligation, lineage, temporal, Focus/actual,
evidence, proposal, settings, Review, and import-provenance relations remain
mandatory additive work in 8010E through 8010H. In particular, 8010D exposes no
legacy import commit and does not claim Decision 09's source-provenance unique
constraint. No production application may be commissioned against only this
kernel. Calendar tables are never Plan storage.

Generation 1 declares one current reader and no previous reader. An N-1 reader
may be named only after an actual prior schema reader exists and passes the
compatibility suite; the string `0` is not a placeholder reader.

## Migration law

- No `dbDelta`.
- No automatic install on plugin load, activation, or request.
- Explicit connection-scoped advisory installer lock with zero-wait concurrent rejection.
- Exact immutable DDL descriptors and SHA-256 checksums.
- Exact `information_schema` postconditions for tables, engines, columns,
  indexes, foreign keys, enforced CHECK semantics, collation, and the absence of
  triggers. MySQL zero-trigger evidence requires a proven direct effective
  `TRIGGER` metadata grant for every owned table; invisible metadata is not
  absence.
- Restart after injected failure at every DDL/checkpoint boundary without assuming transactional DDL.
- Immutable checksum mismatch, partial incompatible schema, version gap, or unsupported future migration fails closed.
- No persistent `DROP`, `TRUNCATE`, destructive `ALTER`, table replacement, or
  option-only ledger. The sole `DROP TEMPORARY TABLE` is an immediately paired,
  same-connection cleanup of an internal collision probe that never drops a
  caller table.
- Initial commissioning appends generation 1 and marks the physical gate ready only after every postcondition passes.
- The manifest describes every engine, row format, table collation, column type,
  null/default/extra property, index, foreign key, and absence of extra schema.
- Migration checksums derive from immutable placeholder templates, not global
  replacement of a live WordPress prefix or collation string.
- Every mutable statement uses one cached native database handle/thread with no
  WordPress reconnect or query-replay path. Before persistent DDL, the runner
  proves all five owned names are free of same-session TEMPORARY shadows by
  creating and immediately removing its own temporary probe; exact error 1050
  preserves and rejects a caller shadow.
- The session must have autocommit enabled, no active local/XA transaction,
  and active FOREIGN KEY, UNIQUE, and (on MariaDB) CHECK enforcement. The
  runner pins `STRICT_TRANS_TABLES`, `NO_ZERO_IN_DATE`, and `NO_ZERO_DATE` for
  all protected work, verifies them before mutation, and restores the caller's
  exact SQL mode on every exit. A cryptographically unique native SAVEPOINT /
  ROLLBACK TO / RELEASE round trip is the transaction-state authority; optional
  Performance Schema instrumentation is not authority.
- Commissioning uses `READ COMMITTED`, verifies the transaction after each
  write, and ends with explicit `COMMIT AND NO CHAIN NO RELEASE` or `ROLLBACK
  AND NO CHAIN NO RELEASE`, followed by an inactive-state and connection check.

## Writer law

The C read-only repository interface remains read-only. D adds a separately typed command repository/service. No REST writer route is added in 8010D.

Every legacy Calendar Study DML and every V1 command uses the same database connection and transaction service. Universal lock order:

`store gate shared → authoritative control rows shared → owner Plan row FOR UPDATE → Calendar Study rows ascending → operation receipt`

Before either writer can lock a first-touch owner, it performs an
exact-error-checked insert-or-existing of a permanent revision-0 arbitration
row under the owner primary key, then locks and revalidates that row. A missing
row is never treated as a gap-lock mutex, and `INSERT IGNORE` is forbidden.

Commit authority comes from one same-connection transaction. After the gate
shared lock, the service directly selects the two exact, pre-provisioned C
option rows in deterministic option-name order and holds shared row locks
through commit. It requires exactly two rows, parses their database bytes
without `get_option()`, verifies the options table is InnoDB, and rejects a
connection switch or nested transaction. This closes the stop/generation
time-of-check/time-of-use window.

Non-Study Calendar operations remain outside V1 arbitration.

Legacy may commit only before the permanent owner watermark. The first V1 operation writes revision 1, canonical Plan bytes/hash, immutable operation/idempotency receipt, and watermark in one transaction. If V1 wins the owner lock, a waiting legacy writer revalidates, returns conflict, and performs zero Calendar DML. If legacy wins, it may commit first; V1 then reads the latest eligible legacy state and cuts over atomically. After watermark, legacy never resumes.

Calendar create knows its target type before transaction. Update and delete use
any pre-read only to choose a candidate fence, then lock and revalidate the
Calendar row before classification or DML. Every ownership transfer involving a
current or target Study row is rejected in 8010D. A path provisionally
classified non-Study includes the observed owner and type in its SQL predicate;
a zero-row race returns conflict and never mutates a row that became Study.
Bulk responses contain an explicit per-item success or error and never silently
omit a rejected Study item.

## Revision, identity, and idempotency

- Owner and actor are server-derived WordPress IDs and recorded separately.
- Plan and operation identifiers are canonical lowercase UUIDs.
- Every V1 command requires expected revision and a 16–64 byte case-sensitive idempotency key.
- Canonical request hash binds contract, owner, actor, action, expected revision, and canonical payload.
- `(owner_id, revision)` and `(owner_id, idempotency_key)` are database-unique.
- Exact same key/hash replays the stored result without another revision.
- Same key with changed request returns conflict.
- Under the locked owner fence, receipt replay lookup precedes stale-revision rejection.
- New writes advance the locked revision exactly once.
- Revisions cross external APIs as decimal strings.

## Physical/control reconciliation

D performs no `update_option`, `add_option`, or `delete_option`. C controls remain desired-state inputs. Commit-time arbitration locks and reads authoritative database records without relying on the WordPress object cache and matches release generation, physical store ID/generation, mode, stop, reader, and release digest.

No tables means never commissioned only when the C record also says never commissioned. A partial schema, migration failure, physical/control mismatch, unsupported reader, or corrupted Plan is unavailable and denies both writers. A reversible control can never hide a commissioned physical store.

## Current/N-1 and rollback

Every generation declares a current reader and, only when one actually exists,
an actual N-1 reader identifier. Writers emit only current schema. Unsupported
versions fail closed and never fall back to Calendar.

After any watermark, the permanent rollback floor includes the C access/domain and Calendar guards, physical probe, watermark row, current/N-1 readers, shared legacy denial, all additive Plan tables, and migration ledger. Rollback is a mode change to truthful degraded read-only; it never drops data or restores the legacy writer.

## Required proof before 8010D governance

- Real disposable WordPress/InnoDB, not `$wpdb` stubs.
- Independent database processes/connections and deterministic barriers.
- `READ COMMITTED` is set and verified before each transaction; shared-lock SQL
  is proven on MariaDB 10.11 and MySQL 8.0.16 or newer; nested transactions and connection
  switching fail closed.
- Exact engine, server, isolation, SQL mode, charset/collation, and connection evidence.
- Disabled FK/UNIQUE/MariaDB-CHECK enforcement, non-strict mode, autocommit off,
  read-only/local/XA outer transactions, PFS-disabled outer transactions,
  completion-type CHAIN/RELEASE, and preserved caller savepoint/sentinel cases.
- Same-named TEMPORARY tables both before initial DDL and as an exact-shape
  shadow beside a durable ledger; caller temporary bytes and durable authority
  must both remain untouched after rejection.
- Same-named no-op CHECK and live-trigger drift rejection, followed by exact
  compatibility only after the disposable drift is removed.
- Concurrent installer exclusion and restart after every injected DDL boundary.
- V1-first and legacy-first races for create/update/delete/type-transition/bulk paths.
- V1-vs-V1 stale revision, same/different idempotency, and owner-isolation races.
- Failure before/after each first-operation write boundary.
- Current/N-1, corrupt, missing-reader, and post-watermark rollback tests.
- Synthetic consistent backup/export, destructive alteration, fresh-database restore, and exact state/hash verification.
- One consistent backup contains all five kernel tables, both locked C control
  rows, and schema/migration/generation descriptors; restored request traffic
  remains disabled until every invariant verifies.
- Static proof of no Plan-table bypass, no Calendar truth reuse, no option writes, and no production/network dependency.

Any P0/P1 failure blocks 8010D promotion. All subagents are read-only; the supervisor remains the sole writer.
