# B1-510H Backup and Rollback Receipt

## Status

No B1-510H production mutation occurred, so no new production backup or
rollback execution was created.

## Verified current recovery baseline

- current Kinsta pointer: `releases/1bb6e8b917d6993c4af08e9ff2408313835f123d`;
- current release: `v-a790ce4e3168384f`;
- current live SSO PHP SHA-256:
  `eaf740af712ec5ef94415bae78c3107b751977f74f413b3d60a8533202e120d7`;
- current live Matrix adapter SHA-256:
  `7b274c10affd339c05920a4181325136396758d0e418fb55cac3bf69ec58cb8b`;
- current WordPress StoryForge allowed IDs: two exact pilot accounts;
- current PostgreSQL state: two `sf_users` rows and six stories.

## Required fresh backup before later deployment

1. Create a new Kinsta/private recovery point containing the live SSO plugin,
   adapter, StoryForge settings JSON, and all affected pre-change UUID metadata.
2. Create a PostgreSQL 18 full dump and complete an isolated restore rehearsal.
3. Record the eligible export, planned UUID map, row counts, hashes, and a
   pre-write conflict report without publishing PII.
4. Seal exact rollback inputs before the first mapping or plugin write.

## Required rollback order

1. Restore the prior SSO PHP and adapter bytes.
2. Restore only B1-510H-touched WordPress UUID metadata from the sealed receipt.
3. Reconcile only B1-510H-created `sf_users` rows under explicit deletion
   authority, or restore the verified database backup if broader corruption is
   proven.
4. Purge only StoryForge/Matrix page caches if evidence shows a cached adapter.
5. Re-run protected Matrix and Critical Systems gates and confirm eligible
   students return to the exact pre-change state.

No rollback command was executed.
