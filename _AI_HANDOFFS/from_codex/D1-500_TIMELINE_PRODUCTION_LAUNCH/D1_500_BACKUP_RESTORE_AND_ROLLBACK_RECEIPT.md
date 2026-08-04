# D1-500 Backup, Restore, and Rollback Receipt

Local/disposable recovery proof: PASS.

- Prior disposable PostgreSQL restore/down/reapply proof: PASS.
- Feature kill switch: `timeline_enabled=false`, `rollout_stage=off`.
- Database rollback policy: preserve successful additive hardening migrations;
  restore only for verified corruption.

Production recovery receipts:

- Timeline-scoped Kinsta snapshot: PASS at
  `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- Deleted provider backup: exactly `B1-508 pre deployment 2026-07-31`, after
  re-verifying it was the oldest manual backup, the August 4 daily backup and
  all four newer manual backups remained, the D1-500 snapshot remained intact,
  and matching B1-508 private recovery artifacts existed locally and remotely.
  The deleted MyKinsta manual item is not recoverable through MyKinsta; its
  verified private recovery sets remain.
- Replacement provider backup: `D1-500-PRE-20260804T161859Z`, created August 4
  at 12:19 PM EDT, expires August 18, READY with a restore control.
- Railway provider-native PostgreSQL volume backup: created August 4 at 12:20
  PM EDT, manual, 843 MB, READY with a restore control.
- Logical PostgreSQL dump:
  `/Users/brianb/MissionMed_private_backups/D1-500/20260804T162100Z/timeline-pre-migration.dump`.
- Logical dump SHA-256:
  `65ae8326ee7a2ba7115486187ec978494c7beae714daeb32379c2873f89436cd`.
- Dump format: PostgreSQL 18.4 custom archive; isolated restore: PASS; temporary
  restore database removed after validation.

WordPress rollback is bounded to disabling Timeline admission, deactivating the
Timeline plugin, removing its MU route, and restoring the pre-state recorded in
the scoped snapshot. Railway has no successful application deployment to roll
back yet. The failed deployment attempts created no serving release.
