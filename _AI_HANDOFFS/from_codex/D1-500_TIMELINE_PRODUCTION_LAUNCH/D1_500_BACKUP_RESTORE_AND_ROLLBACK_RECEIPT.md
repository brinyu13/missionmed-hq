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

Production Kinsta backup and production Railway/PostgreSQL backup: NOT RUN.
They must be created and verified immediately before the first protected
production mutation. The Critical Systems gate currently prevents that step.
