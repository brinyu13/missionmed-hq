# D1-500 Backup, Restore, and Rollback Receipt

Local/disposable recovery proof: PASS.

- PostgreSQL proof cluster: `/tmp/d1-500-pg.Y5bd9y/data`, loopback port 55412.
- Custom-format backup:
  `/tmp/d1-500-pg.Y5bd9y/d1_500_proof.backup`.
- Backup SHA-256:
  `47543f7923a487870713b42e5e2ebb7d36bb5d19f9c3f72e0e666fc3aa9cd73f`.
- Isolated restore, schema validation, migration down-safety, and reapply: PASS.
- Feature kill switch: WordPress `timeline_enabled=false` and
  `rollout_stage=off`.
- Application rollback: restore the prior immutable Railway deployment.
- WordPress rollback: disable admission/navigation, restore the previous exact
  `current` pointer, then verify unrelated routes.
- Database rollback policy: preserve successful additive hardening migrations;
  restore only for verified corruption. Security-broadening down migration is
  prohibited.

Production recovery checkpoint at `2026-08-04T15:21:16Z`:

- Kinsta Timeline-scoped pre-state snapshot: PASS at
  `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- The plugin, MU route, Matrix Timeline asset directory, Timeline settings
  option, and Timeline plugin status are all recorded as absent with a verified
  SHA-256 manifest and mode-restricted files.
- Standard WP-CLI WordPress bootstrap exits with signal 139 while loading the
  existing production MU-plugin set. A non-mutating `WPMU_PLUGIN_DIR` isolation
  bootstrap succeeds and independently confirms the Timeline plugin and option
  are absent. No production MU plugin was changed or disabled for web traffic.
- Kinsta provider-native manual backup: BLOCKED because all five retained
  manual-backup slots are occupied. No existing backup was deleted.
- Railway provider-native volume backup: NOT RUN; provider UI authentication is
  required.
- Railway logical PostgreSQL backup: BLOCKED by
  `RAILWAY_SSH_UNAUTHORIZED`; no database command or migration ran.

The scoped snapshot is not a substitute for the mandatory fresh provider-native
Kinsta backup and Railway/PostgreSQL backups. No Timeline production payload may
be installed until those backups are READY and their provider receipts are
recorded.
