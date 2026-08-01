# B1-510H Backup and Restore Receipt

## Recovery roots

- local private root:
  `/Users/brianb/MissionMed_private_backups/B1-510H/B1-510H-RP-zqBTuxvJ`
- Kinsta private root:
  `/www/theresidencyacademy_209/private/b1-510h/B1-510H-RP-20260801T144732Z`

Both roots are mode `0700`; private files are mode `0600`. The package contains
the pre-write WordPress database export, WordPress identity snapshot, plugin and
adapter originals, StoryForge settings, synchronization plan and scripts,
PostgreSQL custom dump, and validation receipts.

## Recorded hashes

- PostgreSQL 18 custom dump:
  `1449335a94c35f96163ff3398bfe98b7fc9cc8ed142e6dad91ab1b14224ead91`
- WordPress SQL export:
  `debba269cffc422d0a3f71a2bfeca445f10c51f884618a3ebcd935e64b28336e`
- private WordPress identity snapshot:
  `6f9c1fbbe26810ab675761a2f674230a3c4bf13f8fb5d09379276d8fe85ac67a`
- isolated-restore receipt:
  `ad124c01ca90a4c6e7b1b88aeff233c58c09ce277dfcf19bfa0992208142d429`

## PostgreSQL 18 restore rehearsal

The first disposable restore failed before application validation because the
blank isolated cluster lacked the production roles `authenticated` and
`storyforge_app`. Production was untouched. A new disposable PostgreSQL 18
cluster was created with those required local roles; the same custom dump then
restored successfully and verified:

- 32 public tables;
- 31 RLS-enabled tables;
- 35 policies;
- 2 pre-write `sf_users` rows;
- 6 stories;
- 5 recordings.

The disposable server was stopped after verification.

## Bounded rollback

1. Restore the two saved SSO files byte-for-byte.
2. Restore only the WordPress UUID metadata represented in the sealed pre-write
   snapshot.
3. Under explicit destructive authority, remove only the 439 rows proven to
   have been created by this run, or restore the full verified PostgreSQL dump
   if broader corruption is established.
4. Re-run mapping, RLS, routing, voice-scope, Matrix, and Critical Systems
   checks.

Rollback was prepared but not executed because production validation passed.
