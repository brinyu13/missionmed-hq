# IIQ-1202 migration and release preservation contract

Authority: Founder IIQ-1202 / MissionMed OS DR-370. Read the adjacent preservation
invariant first. All production user/admin state, including retained test records,
is protected. This contract does not authorize a production schema mutation.

## Default: additive, expand first

EXPAND -> BACKFILL -> DUAL-READ/DUAL-WRITE IF REQUIRED -> VERIFY -> CUT OVER ->
OBSERVE -> CONTRACT ONLY AFTER RETENTION WINDOW AND SEPARATE AUTHORIZATION.

Add nullable fields or independently reviewed safe defaults. New versions must
tolerate records created under older versions. Preserve canonical Interview UUIDs,
owner UUIDs, WordPress identity binding, local date/time, timezone, UTC instant and
DST fold together. Preserve unknown/date-only meaning; do not invent missing values.
Keep composite owner/parent foreign keys, uniqueness, history and consent intact.

Backfills must be repeatable, bounded, version-aware and observable. Never overwrite
a newer edit: use an explicit target inventory, null/version predicates and audited
progress. Reconcile concurrent legitimate edits separately from preservation failure.
Do not change an applied SQL file; append a new timestamped migration instead.

New code must read old and expanded records. Keep old fields through an observed
compatibility/retention interval. There is no automatic expiry authorizing removal:
the exact interval and contract operation require a reviewed, scoped decision.

## Destructive-change STOP gate

Deletion, populated table/column removal, ID changes, ownership changes, large
content rewrites, irreversible transformations, incompatible rollback, cascades,
or unknown migration behavior STOP before production execution. Supply all of:

1. Exact affected data/relationships/versions and privacy-safe inventory.
2. Rationale and non-destructive alternative analysis.
3. Fresh verified target-bound recoverable backup, with hash, time and custody.
4. Tested isolated restore, relational/ownership/content/ledger evidence.
5. Application rollback and forward-repair plan; preserve post-backup writes.
6. Dry run against production-shaped non-production data where possible.
7. Explicit Founder authorization for the exact target, SQL hashes and operation.
8. Independent review, fresh OS authority, exact healthy leases and preimages.

General instructions to finish, deploy, integrate or act autonomously do not grant
this authorization. An approval JSON file is evidence of an actual independent or
human decision, never permission to invent one. Provider administrator credentials
can bypass repository controls; operators remain bound by this authority.

The machine receipt uses `missionmed.interviewiq.destructive-migration-authorization.v1`;
`materials.inventory`, `rationale`, `alternatives`, `rollbackForwardRepair`, and
`dryRun` each reference exact JSON file bytes by path and SHA-256. Material schema
`missionmed.interviewiq.destructive-migration-material.v1` binds kind, target, exact
migrations, preservation-evidence hash and actual details. The dry run additionally
requires current PASS evidence from an isolated disposable socket-only target.
No checkbox or invented approval string substitutes for the original human decision.

## Backup and restore gate

For every schema-changing production release, take a fresh consistent snapshot or
logical dump of current production, including `iiq` and `iiq_migrations`. Verify the
exact project/service/volume/database/server identity, backup readability/hash,
private custody and restore mechanism. Provider feature availability is not proof.
Keep schema owner/role/membership recovery metadata without exported passwords;
runtime credentials are restored through the authorized secret store, not reports.

The logical drill holds an exported REPEATABLE READ READ ONLY snapshot while
fingerprinting and dumping, normalizes UTC/ISO dates for comparisons, and restores
only into a new socket-only non-production PostgreSQL18 cluster. Compare every
table and ledger, IDs/owners, dates/times/timezones, related events and history;
validate FK/constraint integrity, RLS and application compatibility. Stop that
temporary server after verification. Private dumps and restored data never enter Git.

The migration runner must fail before persistent changes if the independent
target/SQL/ledger approval, verified backup file/hash, freshness or matching
successful isolated restore receipt is absent. A prior empty-database backup does
not qualify current production data. Backup receipt freshness is an upper bound,
not permission to reuse an old backup when relevant production data has changed.
Take/reverify backup immediately before execution; document the recovery point.

A volume snapshot complements the separately held logical copy. Do not delete a
production volume: it can also destroy its provider backup chain. Actual current
schedule/retention/PITR and drill timing are recorded in the production data map.

## Application rollback is not database rollback

API rollback changes only the qualified immutable application image/configuration.
Frontend rollback changes only the qualified immutable asset pointer/route bytes.
Both keep the current PostgreSQL service, volume, IDs, records and migration ledger.
No deploy/start/rollback hook may reset, seed, migrate backwards or restore a DB.

Qualify the exact previous application against the expanded schema and records
written after expansion. Nullable additions are tolerated; removed/renamed fields
require a compatibility bridge before release. If older code cannot preserve/read
the forward schema, do not claim rollback readiness. Repair forward or retain the
compatible release. Keep advanced integrations disabled during a core incident.

Emergency database recovery is a separate Founder-authorized operation. Restore
first into an isolated target, establish the latest valid recovery point, reconcile
newer writes, verify owners/relationships/privacy, and plan an explicit cutover.
Restoring yesterday's backup over today's production is not an application rollback.

## Test and fixture isolation

Only the disposable harness may run database fixtures, synthetic resets, destructive
drift checks or test migrations. Validate environment and the entire effective
connection target before connection; reject production mode, remote TCP, duplicate
or unknown URL parameters, credential-bearing test URLs and unqualified paths.
Then read-only qualify the actual local cluster marker/database/user/version before
any fixture write. A localhost-looking string alone does not establish isolation.
Runtime and production deploy images contain neither fixture loaders nor migration
execution. Never use production cleanup to make a test pass.

## Mandatory release preflight and postflight

Before a release, record current source and live image/asset hashes separately,
current migration ledger, privacy-safe counts/fingerprints, exact target/leases,
backup and restore confirmation, migration plan (or no migration), compatible
application rollback plan and independent approval. Use only the protected release
path; do not add a broad CI deployment with privileged production credentials.

After a release, verify readiness and actual deployed source, migration success or
unchanged ledger, counts and representative existing-record readability, Calendar
loading/opening, new synthetic interview creation where specifically authorized,
cross-student denial, audit/history and rollback compatibility. Keep current user
edits; aggregate changes require reconciliation, not a blind reset. If preservation
fails, STOP the feature rollout and further deployments; investigate/repair/recover.

## Required automated matrix (synthetic non-production)

| Gate | Required evidence |
| --- | --- |
| A | Create interview under schema/version N. |
| B | Apply additive migration N+1. |
| C | Existing interview survives. |
| D | Canonical Interview ID is unchanged. |
| E | Owner is unchanged. |
| F | Date, time, timezone and DST choices are unchanged. |
| G | Related-event relationships remain intact. |
| H | Cancel/restore history remains intact. |
| I | New nullable fields are safe for old records. |
| J | Old record opens in the new approved UI. |
| K | Frozen previous application reads forward-compatible and newer records. |
| L | Student A cannot access Student B. |
| M | Fixture/reset paths refuse production/destructive remote execution. |
| N | Replay does not duplicate or corrupt records/ledger. |
| O | Backup and isolated restore preserve representative records and relationships. |

Record actual pass/fail counts, test source hashes, evidence paths and limits. A
source assertion or mocked restore alone is not evidence of actual data recovery.
The production current-data drill is separately required; non-production A-O tests
do not establish current provider configuration or a live deployment by themselves.

## Future research, speech, consent and privacy

Use the invariant's separate raw/edited/AI/confirmed/shared/review/publication data
classes and versioned research provenance. A pipeline/model change never silently
overwrites canonical recollection or original submitted evidence. Cancellation is
state/history-preserving. Legitimate privacy erasure is a separately scoped,
authorized retention/deletion workflow, not a development reset.
