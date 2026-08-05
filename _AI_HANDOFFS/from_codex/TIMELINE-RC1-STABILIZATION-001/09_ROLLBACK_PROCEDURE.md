# Timeline RC1 Rollback Procedure

Rollback is Timeline-scoped and preserves the production database unless corruption is independently proven.

## Immediate containment

1. Set `missionmed_timeline_settings.timeline_enabled=false`.
2. Set `missionmed_timeline_settings.rollout_stage=off`.
3. Read back both values and verify the route grants no Timeline admission.

## WordPress runtime rollback

1. Verify the current pointer is `releases/timeline-wp-7230b1b928fcbad2`.
2. Atomically point `missionmed-timeline-runtime/current` to the immediately prior RC1 `releases/timeline-wp-ee40c1abc5eabe06`, or to accepted D1-500 `releases/timeline-wp-0fc51f8906decb8e` when a full RC1 rollback is required.
3. Restore the prior Timeline route from the scoped backup.
4. Verify prior hashes:
   - route `258da3f2a5edf95899f921f5d617ef4f861260ca1be24dd5a8e1c1d4c5621403`;
   - payload `e424edc9fd022dd225c84763707ef18dece073fddb433821e040bada5e25b820`.

## API rollback

1. In Railway service `mission-timeline-api`, select the prior successful package-root deployment.
2. Use Railway Rollback, which restores both build and variables.
3. Reapply the eight authorized Timeline media variables with deploy skipped if rollback removed them.
4. Verify health reports the intended prior release and direct `/v1/documents` returns `403 GATEWAY_REQUIRED`.

The rollback mechanism was exercised during RC1 after a wrong-root upload: deployment `7ebb239e-77d2-4729-a58e-1a5a60778f0e` was replaced by rollback deployment `436da8cd-87bf-4c5a-bd49-b04c667a827b`, and accepted health was restored before work continued.

## Data and media

- Do not drop or reverse the Timeline schema for an application rollback.
- The fresh Railway PostgreSQL provider backup from 2026-08-05 16:45 EDT remains restore-capable.
- The Timeline filesystem backup is `/www/theresidencyacademy_209/private/timeline-rc1-backups/20260805T204718Z` with a verified 14-file checksum manifest.
- R2 objects remain private. If RC1 is disabled, retain existing confirmed objects unless an authorized deletion is required; pending test fixtures were removed and the bucket was empty at seal.

## Reactivation

After rollback validation, restore the exact backed-up admission option only after health, access, direct-API denial, and identity tests pass. The accepted final policy is `timeline_enabled=true`, `rollout_stage=eligible_360`, one approved administrator canary ID, verified entitlement, and consent version `d1-500-v1`.

## Recovery 002 receipts and rollback targets

- Pre-recovery Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T224704Z`.
- Pre-consent-hotfix Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T231723Z-consent`.
- Railway PostgreSQL snapshot: `TIMELINE-RC1-RECOVERY-PRE-20260805T224704Z`, ID `e445676e-3929-4946-b56b-4ec544a49e24`, non-expiring at creation.
- Current Kinsta pointer: `releases/timeline-wp-7619ed467ec95270`.
- Previous working recovery pointer: `releases/timeline-wp-da5bf0b8b16bb3c7`.
- Current Railway deployment: `b0c3401a-c482-4aac-9580-8e0067554289`; immediately prior recovery deployment: `acdc8597-b42b-4afd-82cf-876526b5a31f`.
- Pre-font-packaging Kinsta snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260805T233504Z-font-assets`; checksum verified and pointer preserved.
- Current font-fixed Kinsta pointer: `releases/timeline-wp-01b09664228a865a`; immediate rollback pointer: `releases/timeline-wp-7619ed467ec95270`.

Immediate containment remains the Timeline feature/access kill switch. Application rollback does not drop the schema or delete documents/media. After rollback, verify `/healthz`, `403 GATEWAY_REQUIRED`, anonymous denial, eligible access, and unchanged unrelated applications before restoring the eligible-360 gate.
