# V1 Study Schedule 8010R — 8010E E3 Shared Owner Arbiter Design Decision

Updated: 2026-07-15 UTC  
Scope: unbound shared Calendar/V1 owner-transaction kernel and synthetic race oracle  
Decision: ACCEPTED FOR AN UNBOUND SYNTHETIC SLICE; RUNTIME BINDING IS PROHIBITED

## Decision

E3 may add an unbound V1-owned owner-arbiter contract and a disposable
MySQL/MariaDB test implementation that proves the concurrency law required
before legacy Calendar Study writes and V1 commands can share one owner.

This decision does **not** authorize plugin-loader registration, a WordPress
runtime provider, Calendar routing, REST exposure, feature flags, control-row
changes, schema installation, staging, real learner data, or production use.
The checked-in legacy writer gate remains a containment preflight only and is
not accepted as a transaction arbiter.

## Evidence requiring this slice

Independent source review established that:

- Calendar classifies and gates a Study mutation before separately executing
  autocommit DML. A V1 watermark, stop, permit revocation, owner change, or
  event-type change can therefore race between the gate and the write.
- Generic Calendar update/delete relies on an unlocked pre-read. Its final
  predicate does not always bind the observed event type, so a stale non-Study
  request can race with a transition into Study.
- The E2 V1 repository owns an isolated transaction and admits only the
  synthetic fence scope. Its two boolean fence callbacks neither lock Calendar
  state nor return the locked state required for revision-zero import.
- Calendar enrollment and Session Manager contain direct Calendar SQL paths
  that do not call the V1 access gate. Bulk create can omit a rejected item
  rather than returning one explicit result per input item.
- No physical previous production reader exists. The pure current/N-1 selector
  proof therefore does not authorize a production reader downgrade or writer
  activation.

These findings make runtime activation a NO-GO. They support a GO only for the
synthetic, unbound proof defined below.

## Transaction ownership law

One arbiter owns the exact native database handle, captured connection ID,
transaction boundary, locks, mutation, commit or rollback, and restoration of
the caller's session. A mutation callback may not start, commit, roll back,
reconnect, change transaction/session controls, create a temporary authority
table, invoke WordPress actions or filters, or use another connection.

The public contract must return typed locked evidence rather than boolean
success. At minimum it carries:

- store identity, generation, release/control digest, mode, exposure, stop
  state, permit/revocation epoch, and the pinned connection ID;
- owner ID, permanent Plan identity, current revision, sticky V1 watermark,
  and restore-census result; and
- the ordered locked Calendar Study row set, row fingerprints, and aggregate
  digest used by the decision or revision-zero importer.

The synthetic entry points model two mutually exclusive paths:

1. `run_legacy_study_mutation()` revalidates locked authority and may execute
   exactly one bounded Calendar Study mutation only while the permanent Plan
   remains revision zero and no V1 watermark has ever existed.
2. `run_v1_command()` revalidates the same authority, supplies the exact locked
   Calendar snapshot to the first-operation importer, and may atomically write
   revision 1, normalized truth, receipt, and sticky watermark.

After the first V1 watermark, legacy writing for that owner is permanently
denied. Reverting a mode, release, or option cannot revive it.

## Exact lock order

Every owner-affecting synthetic Study operation must follow this order:

1. Pin the native handle, connection ID, database, prefix, encoding, SQL mode,
   isolation, autocommit, and relational controls.
2. Reject a caller-owned transaction, XA state, read-only state, temporary
   authority-table shadow, wrong database/prefix, non-InnoDB authority table,
   or missing required index.
3. Start an explicit read-write `READ COMMITTED` transaction.
4. Lock the V1 store gate shared.
5. Lock schema metadata and immutable migration-ledger records.
6. Lock the exact two control rows shared in `option_name` order and validate
   their raw database bytes.
7. Lock the commit-fresh permit/revocation record.
8. Create the permanent revision-zero owner Plan row using exact
   insert-or-existing handling, accepting only the expected duplicate-key
   race; `INSERT IGNORE` and range-gap mutex claims are forbidden.
9. Lock the owner Plan row `FOR UPDATE`.
10. Verify restore census, revision, sticky watermark, and release binding.
11. Lock the owner's Calendar Study rows in ascending event ID order and
    reclassify the request from those locked rows.
12. Lock Week/domain rows in stable key order.
13. Execute exactly one legacy Calendar mutation or one V1 command/import.
14. Write the immutable operation receipt where applicable.
15. Commit without chain or connection release, then verify and restore the
    exact caller session.

The permanent Plan row is the first-touch owner mutex even when the Calendar
set is empty. `READ COMMITTED` range locks are not used as a phantom-create
mutex.

## Mutation and identity law

- Actor and owner authority are server-derived and revalidated after locking.
- A learner Study mutation requires actor ID equal to owner ID plus current
  entitlement, assignment, permit, and non-revoked epoch.
- Raw store/control state, Decision 12 state, release readers, sticky watermark,
  and restore census are commit authority; cached preflight values are not.
- Locked Calendar owner, event type, status, and optimistic fingerprint control
  the final decision. A pre-read selects only a candidate path.
- Study owner transfer, Study-to-non-Study transition, and non-Study-to-Study
  transition remain denied until a separately governed deterministic
  multi-owner protocol exists.
- Provisionally non-Study DML must bind the observed owner and event type in
  its final predicate; zero affected rows is a conflict, never a fallback.
- Bulk inputs require an explicit ordered success or error for every item.
- Legacy-first cutover requires the V1 path to import the exact locked latest
  eligible Calendar state. If no verified importer is supplied, the V1 path
  fails `legacy_import_required` without writing a watermark.
- Ambiguous legacy-create retries remain a launch blocker until backed by a
  durable server-owned idempotency key or an explicit founder risk decision.

## Required synthetic race oracle

The unbound slice must use independent database processes and barriers, not
single-process mocks, against MySQL 8 and MariaDB 10.11. It must prove:

1. V1 wins: V1 holds the Plan mutex; legacy create/update/delete waits, then
   observes the watermark and performs zero Calendar DML.
2. Legacy wins: legacy commits first; V1 sees the exact latest locked Calendar
   state and either imports it atomically or fails `legacy_import_required`
   without a watermark.
3. Simultaneous first touch creates exactly one revision-zero Plan row.
4. A first legacy create with zero Calendar rows still blocks on the Plan row.
5. Owner/type/status/fingerprint changes between pre-read and lock fail with a
   generic conflict and never touch the wrong row.
6. Study owner/type transitions and stale non-Study mutation attempts are
   denied with zero unintended DML.
7. Mixed bulk input returns explicit ordered per-item outcomes with no silent
   rejection and no cross-owner deadlock.
8. Stop, generation, release, Decision 12, permit, and revocation races are
   revalidated after locks.
9. Same-owner operations serialize while different owners can progress apart
   from short shared authority locks.
10. Connection/session sabotage, unexpected engine/index/schema state, and
    temporary-table shadows fail before mutation.
11. Failure injection after every lock and write boundary proves rollback
    before commit; interruption after commit proves exact replay and permanent
    legacy denial.
12. Enrollment, Session Manager propagation, generic administrator fallback,
    and mixed bulk bypasses remain activation blockers until routed through the
    same law or explicitly excluded with proof.

## Authorized files for this slice

The supervisor may add only:

- `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-owner-arbiter.php`
  as an unbound V1-owned contract/kernel;
- the minimum typed E3 scope additions to
  `class-mmed-v1-study-command-service.php` and
  `class-mmed-v1-study-innodb-command-repository.php`, both of which remain
  absent from plugin boot, so the isolated V1 writer consumes locked authority
  and refuses cutover while any locked legacy Study row exists;
- synthetic test fixtures and helpers under `tests/php/`;
- the existing isolated 8010E test runner and workflow entries required to run
  those fixtures; and
- E3 evidence, review, blocker, and combined-handoff Markdown records.

The new class must not be required or instantiated by `missionmed-hub.php`, the
V1 loader, Calendar, Study Schedule, enrollment, Session Manager, REST, cron,
CLI, or any production code path.

The E2 synthetic fence scope remains byte-compatible. The E3 scope must be a
distinct exact value and must require the typed E3 interface; accepting a
string-equivalent duck type or weakening the E2 interface is prohibited.

## Explicitly prohibited protected-path changes

This slice may not modify or bind:

- `class-mmed-calendar-engine.php`;
- `class-mmed-study-schedule.php`;
- Calendar enrollment or Session Manager;
- `missionmed-hub.php`, the V1 loader, REST routes, options, feature flags, or
  control rows;
- Matrix controller or immutable Matrix JavaScript;
- any real schema, learner data, staging state, or production state.

A later Calendar/V1 binding requires a new decision record, a passing full
two-session matrix, additive index/engine proof, a verified revision-zero
importer, explicit direct-SQL-path disposition, regression evidence, rollback
evidence, and Decision 12 authority.

## Rollback and stop law

Rollback for this unbound slice is byte removal of the new unregistered class,
synthetic fixtures, runner/workflow additions, and reports. No database or
runtime rollback exists because no production path may load the class and all
database fixtures are disposable.

Unexpected runtime loading, a production reference, a hidden direct-SQL path,
an inability to prove same-connection transaction ownership, a false
two-process oracle, or any mutation outside disposable fixtures is an immediate
stop. Decision 12 remains HOLD throughout this slice.
