# B1-508 Database Production Receipt

## Pre-migration baseline

- PostgreSQL: 18.4.
- Migration ledger: 8 rows, M1-M3 complete.
- StoryForge users: 1.
- Stories: 2.
- Audit events: 22.
- Recording sessions, segments, audio assets, deletion intents,
  reconciliation runs: all 0.

The accepted M1 hash and exact production baseline were checked before M4. The
fresh provider backup and PG18 dump/restore receipt were mandatory inputs to
the runner.

## Applied migration

Only M4 was applied:

`storyforge-v5/infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state.sql`

- Forward SHA-256:
  `ae86a5ea104becf7dff244fa3188338f8ad13eef58190abd47522ca2e2e733d7`
- Rollback SHA-256:
  `c7fc9fc846a030eafabf2eb6e98354a9d0668e16a91a9d3746c3071df99cd38c`

The WordPress gate was disabled and drained for one JWT TTL. The transaction
committed M4. A stale external post-commit verifier then reported failure
because it did not enumerate the new M4 grants. No rollback was attempted
against a committed, independently healthy migration.

The verifier was corrected to enumerate every M4 relation, routine, policy,
shared dependency, and role attribute. A focused regression was added.

## Post-migration verified state

- Ledger: 9 rows.
- Latest: `20260730000100`.
- M4 tables: all 3 present.
- `storyforge_app`: LOGIN, not superuser, not CREATEDB, not CREATEROLE, not
  REPLICATION, not BYPASSRLS.
- Role membership: exact `authenticated` membership.
- Feature flag: `voice_capture=off`.
- Voice allowlist/cohorts: 0/0.
- Effective-authority gate:
  `B1_507B_EFFECTIVE_AUTHORITY_PASS`.
- M4 post-commit privilege closure: `true`.

## Post-canary durable state

- Users: 1.
- Total stories: 3.
- Active stories: 2.
- Audit events: 26.
- Recording sessions, segments, audio assets, deletion intents, and
  reconciliation runs: all 0.

The additional story is the synthetic B1-508 canary, archived through the
authorized API. Story originals and audits are immutable/append-only, so a
manual hard delete would have violated higher authority. Its archive is the
truthful cleanup state.

## Final local verification

- Existing PostgreSQL suite: 12/12.
- Binding PG/contract suite: 130/130.
- PostgreSQL version parity: 18.4.
- Zero skips and zero failures.
