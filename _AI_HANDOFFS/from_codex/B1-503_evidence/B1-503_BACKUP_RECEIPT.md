# B1-503 Backup Receipt

Status: **PASS — pre-mutation restore gates established**

This receipt records the root-verified B1-503 recovery points. It contains no
credentials, tokens, connection strings, or other secrets.

## MyKinsta manual backup

- Note: `B1-503 pre product recovery 2026-07-28T08:03:10Z`
- Backup timestamp: `2026-07-28T08:03:10Z`
- Provider UI time zone: America/New_York
- Provider-displayed Created value: `Jul 28, 2026, 4:03 AM`
- Provider-displayed Expiry value: `Aug 11, 2026, 4:03 AM`
- Visible recovery control: the backup row included `Restore to`
- Visible capacity: `2 / 5 backups`

The root agent created this backup and verified the visible row and restore
control in MyKinsta.

## Private Kinsta recovery point

- Backup ID: `B1-503-RP-KINSTA-PRE-20260728T080310Z`
- Private remote path:
  `/www/theresidencyacademy_209/private/b1-503/B1-503-RP-KINSTA-PRE-20260728T080310Z`
- Private local path:
  `/Users/brianb/MissionMed_private_backups/B1-503/B1-503-RP-KINSTA-PRE-20260728T080310Z`
- `wordpress.sql` SHA-256:
  `3cdbf1083c9e88a7956373363e007c31d8a08a321a1da0f9591d19aa19d1ccd1`
- `missionmed_storyforge_settings.json` SHA-256:
  `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`
- `kinsta-wordpress-state.tar.gz` SHA-256:
  `fd301e234bfea28107826c34f1f818a9feb5e9e739861e8d351e5b2ec73fc88c`

The root agent created and verified the private Kinsta recovery point.

## Previous production runtime identity

- Previous deployed commit and runtime pointer:
  `4bd956b6ea222d20428c41415236a73b93576447`
- Previous pointer target:
  `missionmed-storyforge-runtime/current -> releases/4bd956b6ea222d20428c41415236a73b93576447`
- Previous release ID: `v-963b8f5eb4d8c727`
- Previous live route SHA-256:
  `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`
  (`30,528` bytes)
- Previous generated `release.php` SHA-256:
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`
  (`409,055` bytes)

These values pin the pre-B1-503 production route and pointer state required for
rollback verification.

## PostgreSQL logical backup and isolated restore rehearsal

- Backup ID: `B1-503-RP-PG-PRE-20260728T080310Z`
- Dump path:
  `/Users/brianb/MissionMed_private_backups/B1-503/B1-503-RP-PG-PRE-20260728T080310Z/storyforge-pre-b1-503.dump`
- Dump SHA-256:
  `18d737fba373c0a5da0cd43874601a0cecd2a81a9c1c9ad40d55febdd9ccea6c`
- Dump tool: `pg_dump (PostgreSQL) 18.4 (Debian 18.4-1.pgdg13+1)`
- Restore tool: `pg_restore (PostgreSQL) 18.4 (Debian 18.4-1.pgdg13+1)`
- Toolchain image:
  `sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a`
  (`arm64`, `linux`)

The SQL agent created and verified the custom-format logical dump, checked its
contents with `pg_restore`, and completed an isolated PostgreSQL 18 restore
rehearsal. The exact restore receipt was:

```text
SHAPE|18.4 (Debian 18.4-1.pgdg13+1)|3|16|15|1|0|0|0|0
LEDGER|20260726150000:93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f,20260727170000:95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f,20260727190000:ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405
ROLES|3|1|0|1
```

The restore rehearsal completed with empty stderr. The receipt preserves the
exact verified shape/count vectors, three migration-ledger rows, and role-count
vector without reinterpreting their source-query labels.

## Railway provider-native backup

- Backup ID: `59a491f8-ecb2-4fc8-b5b3-da43ccada133`
- Created: `2026-07-28T08:07:44.233Z`
- Locked: `true`
- `expiresAt`: `null`

The root agent created the Railway provider-native backup, locked it, and
verified the provider-returned identity and retention fields.

## Mutation boundary and operator attribution

- Root performed and verified the MyKinsta manual backup, the private Kinsta
  recovery point, the previous runtime identity capture, and the Railway
  provider-native backup and lock.
- The SQL agent performed the PostgreSQL logical backup verification and
  isolated PostgreSQL 18 restore rehearsal; root accepted the resulting
  receipts into the B1-503 gate.
- These were backup, verification, and evidence actions only. No production
  application code, WordPress state, StoryForge runtime, route, pointer,
  database application data, authentication configuration, or feature
  enablement was mutated. No deployment occurred.
