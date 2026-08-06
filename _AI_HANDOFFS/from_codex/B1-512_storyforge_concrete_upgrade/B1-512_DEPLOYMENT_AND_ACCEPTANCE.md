# B1-512 Deployment and acceptance

## Candidate

- Source commit: `e42cc24de513a6a7dfe6be07b6b1d07144c381ef`.
- Release commit: `8ca5d60fffcbb479fc5ced4689702fd4a7defb58`.
- Release: `v-10688bb24bca7965`.
- App alias: `cbe2999f0c70`; styles alias: `5e18315007aa`; auth alias unchanged `d2cfc4e447d2`.
- Branch was pushed normally to `origin/codex/b1-503-storyforge-product-recovery`.

## Production state

No B1-512 production write has occurred. The accepted live baseline remains release `v-d45ca5e899878fea`, Kinsta pointer `releases/752d408f32c7becc9d10712e163ab86693998edc`, Railway deployment `17615414-9422-453a-9eb8-7d1b36f462a6`.

## Smallest safe next sequence

1. Create and lock a fresh non-expiring Railway PostgreSQL provider backup; retain its ID/receipt.
2. Create a fresh Kinsta pre-write snapshot and seal the exact current pointer/route/plugin hashes.
3. Run `scripts/apply-b1-512-production-migration.sh preflight` with the exact release commit, backup ID, dump path, and dump hash; then apply with `STORYFORGE_MIGRATION_CONFIRM=B1-512-APPLY`.
4. Deploy the API from `storyforge-v5` using Railway `--path-as-root`, with `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` and the content configuration initially force-off.
5. Publish the immutable Kinsta release and verify exact hashes.
6. Enable core configuration only for Founder canary; keep media off.
7. Verify Founder student/admin, one eligible student, one ineligible user, anonymous denial, zero 5xx, Critical Systems, and rollback preflight.

The unavailable local container suite and private-media gates do not authorize bypassing either backup gate.
