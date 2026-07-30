# B1-507 Backup and Restore Receipts

Status: PASS.

## Kinsta

- MyKinsta manual backup note:
  `B1-507 dormant preflight 2026-07-30`.
- Created: 2026-07-30 01:00 America/New_York.
- Expires: 2026-08-13 01:00 America/New_York.
- Restore control was present.
- Private recovery ID:
  `B1-507-RP-KINSTA-PRE-20260730T050907Z`.
- Remote root:
  `/www/theresidencyacademy_209/private/b1-507/B1-507-RP-KINSTA-PRE-20260730T050907Z`.
- Local root:
  `/Users/brianb/MissionMed_private_backups/B1-507/B1-507-RP-KINSTA-PRE-20260730T050907Z`.
- WordPress SQL SHA-256:
  `5903fd816bf3e657937fe9fff612f1f19ba25545f7a971ab924ecf851c1ac7b6`.
- StoryForge runtime archive SHA-256:
  `19bffc46997ca26412becf6e9ad9a9617651fee008ffc42f63c453f86359c3a4`.
- WordPress settings SHA-256:
  `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`.
- Pointer receipt SHA-256:
  `d7fc8962de3df523df42bd9e683f37e0166c2e14d4ea4fe9f83dc291fa549418`.

## PostgreSQL and Railway

- Logical recovery ID:
  `B1-507-RP-PG-PRE-20260730T050252Z`.
- PostgreSQL custom dump:
  `/Users/brianb/MissionMed_private_backups/B1-507/B1-507-RP-PG-PRE-20260730T050252Z/storyforge-b1-507-pre.dump`.
- Dump SHA-256:
  `42b9394b609b732ceb4b70ddccf45c70a481f8caf586867ff5a0849dfb35f53f`.
- `pg_dump` version: 18.4.
- Private files: mode `0600`.
- Railway provider backup:
  `aed95152-2d7e-46ac-9d5d-d303c1c6a474`.
- Created: `2026-07-30T05:07:51.779Z`.
- Locked: yes.
- Expiration: none.
- Volume instance:
  `8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5`.

## Isolated restore

PASS on PostgreSQL 18 after precreating the production-role names required by
the dump: `anon`, `authenticated`, and `storyforge_app`.

Authoritative rehearsal artifacts:

- `restore-receipt-v2.txt` SHA-256
  `500b3317f4d6d6cb857ad8466b3c87a38c896204b8c6d9e028c6a3a1bc4387e5`;
- `isolated-restore-v2-server.log` final SHA-256
  `6c8deea451021d437f593b6dc7dea6c7fcfec1a537ba0f1a898a65cb04762d17`;
- `isolated-restore-v2-apply.log` SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
  (empty because `pg_restore --exit-on-error` produced no diagnostics).

Restored pre-cutover shape:

- 26 public tables;
- 25 RLS tables;
- 25 policies;
- 0 FORCE RLS tables;
- 1 StoryForge user;
- 0 mentor assignments;
- exact five-row pre-cutover migration ledger;
- 0 stories, audio assets, and audit rows.

The receipt’s `ROLES|3|1|0` means all three required role names existed and the
local `storyforge_app` was a safe login role; the final zero is expected
because database logical dumps do not include cluster-global role membership.
Production membership was verified separately after migration.

The original `isolated-restore.log` is explicitly non-authoritative because its
receipt query used `checksum` instead of the ledger column `sha256`. The fresh
v2 rehearsal above corrected the query and completed successfully. Production
was never changed by rehearsal.

The machine-readable 16-field migration input is
`B1-507_DB_BACKUP_INPUT_RECEIPT.md`.
