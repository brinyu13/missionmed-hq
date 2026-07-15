# V1 Study Schedule — Data, API, and Identity Map

## Current data flow

| Boundary | Input | Transform | Output / owner |
|---|---|---|---|
| Client → REST | title, subject, notes, start/end or duration, completed | Client builds local ISO-like strings | Shared `mmed/v1/study-blocks` |
| REST → Study adapter | JSON + numeric route ID | Sanitize and create partial Calendar payload | `MMED_Study_Schedule` |
| Study → Calendar | `event_type=study_block` plus Calendar fields | Create/update/delete generic event | `MMED_Calendar_Engine` |
| Calendar → database | Event associative array | Shared sanitize/JSON encode | `$wpdb->prefix . mmed_events` |
| Database → client | Calendar row | Nested Calendar event plus Study projection | Legacy daily UI |

Current list reads are caller-scoped. Current update/delete safety depends on the
generic Calendar engine and does not prove Study type before delegation. The
metadata transform is lossy for partial completion updates.

## Target ownership matrix

| Object | Canonical owner | Primary key | Writers | External projection |
|---|---|---|---|---|
| Actor identity | WordPress | WordPress user ID | WordPress | Read-only V1 identity reference |
| Runway/exam/profile facts | Profile | Profile source ID/version | Profile | Versioned effective snapshot in V1 |
| Goal fields | **Open field-ownership decision** | TBD | TBD in V1-8010A | V1 may retain planning snapshot |
| Week/Block/Series | V1 repository | UUID + revision | V1 operation service only | Optional marked Calendar export |
| Reserve/Recovery | V1 repository | UUID + provenance | Learner/V1 domain | Read models |
| Focus session/actual | V1 repository | UUID | Learner session service | Shell pill/read models |
| Review/closeout | V1 repository | UUID | Learner closeout service | Streak/read models |
| Mentor ghost | V1 repository | UUID | Mentor adapter creates suggestion; learner responds | Mentor status projection |
| Plan settings | **Open ownership decision** | TBD | TBD in V1-8010A | V1 settings service is recommended, not selected |
| Calendar event | Calendar | Calendar event ID | Calendar systems | Read-only V1 anchor/import candidate |
| Course/Arena outcome | Originating system | Origin ID | Originating system | Evidence attached to V1 object |

## Target API rules

- Versioned resource schemas; reject unknown or invalid mutation fields.
- Authenticate the actor and validate the REST nonce first; then enforce
  entitlement, rollout exposure, and action permission. Query only through a
  learner-scoped repository, then enforce resource/field authorization on the
  scoped result under a non-enumerating not-found/forbidden policy.
- Never accept an arbitrary user ID or context partition from the client.
- Reject mass-assignment/unknown fields; encode stored learner/mentor content at
  its output context; rate-limit mutations and security-significant denials.
- UUID resource IDs, `If-Match`/revision preconditions, and idempotency keys.
- Atomic operation endpoint for move/resize/complete/recover/accept-ghost rather
  than generic partial row patching.
- Consistent error vocabulary for forbidden, not found, conflict, collision,
  stale revision, invalid local time, and retryable failure.
- Pagination/cursors for Journey and operation history.
- Bootstrap read model for Week/permissions/settings/anchors within the
  three-request first-use budget.
- Tombstones and audit history; delete is not silent erasure.
- Structural telemetry only; no notes/content in logs.

## Identity and entitlement boundary

WordPress authentication is the only verified canonical actor identity. V1 must
bind every Plan object to its WordPress learner owner. Whether data is also
partitioned by program/course context is an open V1-8010A decision; do not force
an undefined context key onto every row. A Supabase UUID, browser-supplied course,
HMAC handoff, or LearnDash enrollment may be an adapter input only after its
mapping contract is documented and tested.

The access service separates actor, product entitlement, rollout exposure, and
action/resource/field authorization. Administrators may inspect audit/deployment
evidence but cannot mutate learner Plan objects or confirm learner imports.
Mutation tests and pilots use learner principals. Production cohorts—explicit
learner pilot, 25%, then all eligible—are V1-8040 work only.

## Time and serialization law

Persist:

- UTC instant for actual occurrence;
- IANA timezone;
- intended local date/time for planned work;
- duration;
- week/calendar convention;
- revision and provenance.

Never infer a durable Plan timestamp solely from browser locale or a naive MySQL
datetime. Contract tests cover DST gaps/folds, timezone change, travel, Sunday/
Monday boundaries, cross-midnight blocks, and recurring-series intent.

## Legacy migration

Legacy `study_block` is an import candidate, not canonical data:

- preview and explicit learner confirmation; administrators are audit-only;
- preview token bound to source-row version/hash, owner, event type, and expiry;
- commit uses compare-and-swap and rejects source drift since preview;
- provenance key such as `legacy_calendar_event:{id}`;
- idempotent import;
- owner and type verification;
- no automatic dual-write;
- imported V1 UUID independent from Calendar ID;
- source row retained;
- reconciliation report for skipped/conflicting rows.

Every adapter event carries source identity, object identity, monotonic version,
event identity, occurrence time, and kind. Replays are idempotent; stale or
out-of-order messages cannot overwrite newer state; source moves, cancellations,
deletions, and tombstones reconcile explicitly. V1-marked Calendar exports are
excluded from inbound import/busy adapters to prevent echo.

## Retention and history gate

D9-100 carries forward a 90-day rolling operation-log rule and permanent
ReviewRecords/weekly aggregates. V1-8010A must revalidate that inherited rule
against privacy/legal requirements rather than implement “permanent” blindly.
The decision defines hot-log expiry/archive, tombstone/audit retention, read-model
rebuild limits, account deletion/anonymization, backup expiry, and tested
restore/export behavior.

## Open data-plane decision

A Plan-owned WordPress data plane is recommended but not authorized yet. V1-8010
must inspect real row volume, database capabilities, backups, migration tooling,
and data ownership, then record the physical repository choice before schema
work. For a WordPress/MySQL choice, this includes InnoDB/transaction and
isolation verification, unique idempotency/revision constraints, concurrent
migration locking, failure recovery, atomic cutover-watermark creation, and
forward-compatible schema/snapshot/compaction rules. No unknown Supabase project
and no existing diagnostic table may be chosen by convenience.
