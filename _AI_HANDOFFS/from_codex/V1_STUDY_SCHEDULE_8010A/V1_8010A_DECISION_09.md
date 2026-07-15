# V1-8010A Decision 09 — Legacy Study Import and Cutover

**Status:** ACCEPTED

## Decision

Legacy Calendar Study rows are source evidence only. They are never V1 Plan
storage and are never automatically dual-written. Import is explicit,
learner-authorized, one-way, idempotent, and previewed before commit.

Eligibility requires exact learner owner, governed Study event type, source
namespace, source object ID/version, and approved metadata. A preview token
binds learner, event type, source version/hash, selected rows, expiry, and the
current Plan revision. Commit revalidates all predicates atomically, then creates
V1 UUID/revision/lineage facts without mutating legacy rows.

Database uniqueness on
`(source_system, source_object_id, source_version, learner_id)` prevents
duplicates. Missing, moved, changed, deleted, reordered, foreign-owner, and
foreign-type rows invalidate the preview. V1 projections carry an immutable
origin marker and are excluded from inbound import/busy processing.

## Cutover and rollback

Before the watermark, legacy may remain separately active. The first V1
operation/import and learner cutover watermark commit atomically; afterward V1
is the only writer. Rollback enters V1 degraded read-only and never restores a
second mutable legacy truth. Source deletion yields a versioned tombstone/evidence
event and does not erase imported history.

Only the learner principal with full V1 access may commit import. Administrators
are audit-only.

## Required proof

Tests cover duplicate/retry/concurrency, preview drift/expiry/forgery, owner/type
substitution, source move/update/delete, foreign-event integrity, export echo
suppression, every failure boundary, pre/post-watermark writer denial,
current/N-1 reading, and data-preserving rollback.
