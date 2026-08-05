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
