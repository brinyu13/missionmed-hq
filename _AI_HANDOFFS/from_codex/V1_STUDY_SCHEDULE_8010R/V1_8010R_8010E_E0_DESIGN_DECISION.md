# V1 Study Schedule 8010R — 8010E E0 Design Decision

Updated: 2026-07-15 UTC  
Scope: normalized Week/Block domain and exact additive schema contract  
Decision: ACCEPTED FOR E0; SYNTHETIC AND DEFAULT HIDDEN

## Decision

E0 establishes the immutable generation-2 Week persistence contract without
activating a repository, writer, route, option, learner data path, or automatic
migration. The accepted 8010D five-table capability kernel remains unchanged.
8010E adds only migration descriptors 6 and 7 and the pure domain/inspection
logic needed to prove their exact physical meaning.

## Canonical ownership

- `plans`, `operations`, the migration ledger, generation registry, and store
  gate remain owned by the accepted 8010D kernel.
- `weeks` and `blocks` are Plan-owned normalized truth for 8010E.
- `plans.plan_json` remains a derived, atomically rebuilt, hash-verified reader
  snapshot. E0 does not make it an independently writable truth.
- Calendar, browser storage, mentors, administrators, and adapters are not
  writers.

## Physical model

### Week

One learner-owned Plan may have one Week for each Monday civil date. A Week
records its stable UUID, learner/Plan ownership, IANA timezone and profile/tzdb/
temporal-policy provenance, temporal-context hash, revision interval, and
database-authored timestamps.

### Block

A Block records stable learner/Plan/Week identity; title and activity family;
manual or external source provenance; optional goal provenance; UTC interval;
local date/minute/fold intent; timezone/profile/tzdb/temporal context; duration;
revision interval; and durable tombstone state.

The Block-to-Week foreign key is `(owner_id, plan_id, week_id)`. An explicit
matching child index prevents engine-created metadata. Week-date membership,
IANA timezone validity, DST gap/fold resolution, activity/family coupling,
collision exclusion, and cross-row revision chains remain domain/reader/writer
responsibilities because they cannot be represented safely by these row-local
constraints.

## Invariants frozen by E0

- Monday Week start and monotonic positive revisions.
- Nonempty bounded Week and Block provenance.
- 06:00–24:00 local display/edit window, 15-minute grid, 15–720-minute duration,
  no local-midnight crossing, and exact UTC duration.
- Manual blocks are flexible or tombstoned and contain no external source tuple.
- External blocks are fixed or tombstoned and contain the complete three-hash
  source tuple, unique per learner and source version.
- Goal reference/version is all-null or fully populated.
- Tombstones require both tombstone revision and timestamp, and the tombstone
  revision equals the updated revision. SQL `UNKNOWN` cannot bypass this rule.
- UTF-8 titles contain 1–120 Unicode code points under strict SQL mode.
- Plan and Week parent deletion is restricted.

## Portability decision

The exact schema inspector uses a full-consumption, narrowly normalized CHECK
expression comparator. It accepts only documented equivalent metadata forms
observed across MySQL 8 and MariaDB 10.11, including `MOD`, `%`, MariaDB infix
`MOD`, arithmetic parentheses, `TIMESTAMPADD`, MariaDB `+ INTERVAL ... MINUTE`,
and MySQL `LENGTH`/`OCTET_LENGTH` aliasing. Unknown or partially parsed metadata
fails closed.

## Migration boundary

E0 deliberately applies raw descriptors only in disposable CI databases to
prove DDL and enforcement. It does not claim a restart-safe production
migration. E1 must reuse the 8010D advisory-lock namespace, validate immutable
migrations 1–5, append ledger-owned migrations 6–7, reject unowned pre-existing
tables, commission generation 2 atomically, and prove crash recovery.

## Authorization boundary

Decision 12 remains HOLD. This decision authorizes no real schema, options,
feature flag, telemetry, learner data, exposure, staging promotion, or
production deployment.
