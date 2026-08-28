# Exact Rollback Runbook

Use rollback only for an attributable mandatory smoke failure. Capture provider status first. Do not run migration 005 down against production.

## 1. Remove public WordPress activation

Exact preimage: all three RISE MU-plugins absent and the pre-activation `wp-config.php` from the private backup.

```sh
ssh missionmed-kinsta 'set -eu
root=/www/theresidencyacademy_209/public
backup=/www/theresidencyacademy_209/private/p1-rise-5006-backups/20260828T134900Z
rm -f "$root/wp-content/mu-plugins/missionmed-rise-route.php"
rm -f "$root/wp-content/mu-plugins/missionmed-rise-sso.php"
rm -f "$root/wp-content/mu-plugins/missionmed-matrix-rise-entry.php"
cp "$backup/wp-config.php.before-rise-activation" "$root/wp-config.php"
php -l "$root/wp-config.php"
sha256sum "$root/wp-config.php"'
```

Expected restored SHA-256: `320c9eb0925f71bc4cef3ce43f36e5f08383e29c6daddb1d76f37157464afb77`.

Purge only `/rise/` and `/api/rise/v1/health` through the Kinsta MU-plugin immediate endpoint, using both single and group forms for health. Verify anonymous `/rise/` no longer exposes the application.

## 2. Restore prior isolated RISE deployment

Run from `/Users/brianb/MissionMed_worktrees/p1-rise-5005-rights-safe-production-unblock/rise`.

```sh
railway variable set RISE_BUILD_ID=rise_web_c474ac3cfcc2 --skip-deploys --project c0113625-951e-46ab-939b-dd57acc0e87c --environment 549d6597-1962-44cb-b0f5-7d88bd025e31 --service 9bce2090-ce45-4572-8291-e8da5d42acb6
railway variable set RISE_ASSET_MANIFEST_SHA256=62b2816b8f108f7f2fe074c0ac4587b86e987c1665a539ba397ae2b649d21c59 --skip-deploys --project c0113625-951e-46ab-939b-dd57acc0e87c --environment 549d6597-1962-44cb-b0f5-7d88bd025e31 --service 9bce2090-ce45-4572-8291-e8da5d42acb6
railway api 'mutation($id:String!,$usePreviousImageTag:Boolean){deploymentRedeploy(id:$id,usePreviousImageTag:$usePreviousImageTag){id status}}' --raw-var id=4d66f58f-b7e8-406c-bae8-2e7e621f462d --var usePreviousImageTag=true
```

Verify the redeployed image is `sha256:0851d6aab8c138f053c6a422123cda48935728eda1a6a36200c50c86028155ea` before proceeding.

## 3. Restore prior shared HQ deployment

Run from `/private/tmp/p1-rise-5006-hq-runtime`, which is linked to `missionmed-hq-fix005` production.

```sh
railway api 'mutation($id:String!,$usePreviousImageTag:Boolean){deploymentRedeploy(id:$id,usePreviousImageTag:$usePreviousImageTag){id status}}' --raw-var id=98bf0bda-5d96-4c1f-a243-e2a692210e66 --var usePreviousImageTag=true
```

Verify image `sha256:8382319660ba8f9a07b2003d1eb17321cd6aa271a59e9bde22cc83e7c09ddb4e`, then smoke `/health`, `/health/lor-studio`, Matrix, StoryForge, Arena, File Vault, CAM, and RankList IQ.

## 4. Database recovery

Do not run `005_rights_safe_runtime.down.sql` on production. The prior service is compatible with the additive schema, and retaining schema/data is the non-destructive rollback.

If and only if storage corruption is independently confirmed, restore the locked provider backup:

```text
backup id = b950cadf-124c-4d64-84a9-02c28fefc7bc
external id = vs_1787923306193_0rp37gzleadl1o9s
volume = 38745ae2-1b6d-4174-9515-af9a5661ddf5
```

Provider backup restoration is destructive to post-backup writes and requires an explicit incident decision. The migration down script remains limited to an empty `rise_rollback_005_*` rehearsal database.

## 5. Post-rollback acceptance

- exact provider deployment/image readback;
- WordPress preimage hash and plugin absence;
- HQ and unrelated-product smoke;
- database connectivity and row-preservation check;
- record the incident, commands, timestamps, and outcome.

ROLLBACK_READY = YES
