# D1-500 Backup, Restore, and Rollback Receipt

## Backups

- Timeline-scoped Kinsta snapshot: `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- The exact oldest manual backup `B1-508 pre deployment 2026-07-31` was deleted only after the authorized inventory checks passed.
- Replacement Kinsta backup: `D1-500-PRE-20260804T161859Z`, READY, restore control present, retained until August 18.
- Railway PostgreSQL manual volume backup: READY, 843 MB, restore control present.
- Logical dump: `/Users/brianb/MissionMed_private_backups/D1-500/20260804T162100Z/timeline-pre-migration.dump`.
- Dump SHA-256: `65ae8326ee7a2ba7115486187ec978494c7beae714daeb32379c2873f89436cd`.
- PostgreSQL 18 custom archive isolated restore: PASS; temporary restore database removed.

## Rollback and kill switch

- Kill switch rehearsal: setting `timeline_enabled=false` and `rollout_stage=off` removed admission and returned `timeline_disabled`; exact eligible-360 settings were restored and read back.
- WordPress scoped rollback was exercised when experimental runtime `eeb4786` caused a blank Matrix response: the previous Timeline MU route/runtime pointer was restored, PHP restarted, cache purged, and Matrix health reverified before the corrected release proceeded.
- Current rollback target is limited to the Timeline plugin, MU route, immutable runtime pointer, Railway API deployment, and Timeline schema. It must not restore the whole Kinsta environment unless independently justified because that could affect unrelated applications.
- API rollback: disable admission first, then stop/redeploy the exact Railway service; health must identify the restored release before re-entry.
- Database rollback policy: preserve the successful additive schema unless verified corruption requires the provider backup or validated logical restore.

Current release pointer: `releases/timeline-wp-0fc51f8906decb8e`. Prior immutable Timeline runtimes remain available. Backup and scoped rollback readiness: PASS.
