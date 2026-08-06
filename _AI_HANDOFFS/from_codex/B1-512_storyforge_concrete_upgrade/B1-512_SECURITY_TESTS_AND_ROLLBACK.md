# B1-512 Security tests and rollback

## Passing evidence

- Unit: 295/295.
- PostgreSQL/RLS/migration suite: PASS; binding acceptance: 130/130; focused B1-512 privacy/configuration: 3/3.
- Browser E2E: 72/72.
- Canonical conformance: 54 unaffected surfaces passed, then all 18 affected/adjacent B1-512 surfaces passed after narrow documented conformance updates; effective total 72/72.
- API-only build, deterministic release provenance, secret scan, npm audit, and `git diff --check`: PASS; npm audit found zero vulnerabilities in `storyforge-v5`.
- WordPress integration suite reached its container-only gate and could not run because the previously unavailable local container socket remains absent. No container troubleshooting was attempted.

## Backup/restore

- Fresh PostgreSQL 18 custom dump: `/Users/brianb/MissionMed_private_backups/B1-512/DB-xHaL8y92/storyforge-production.pg18.dump`.
- SHA-256: `835c5a6fa484307658b916e18c374abc9dc2cc3a596935c31ef07a14908379e1`.
- Isolated restore: PASS, `441` users, `23` stories, `12` migrations.

## Rollback

Before production writes: obtain a locked non-expiring Railway provider backup and fresh Kinsta snapshot. Rollback order is prior Kinsta pointer/route, prior Railway deployment `17615414-9422-453a-9eb8-7d1b36f462a6`, leave the additive migration dormant, and restore PostgreSQL only under incident authority. All new lanes have independent default-closed force-off controls.
