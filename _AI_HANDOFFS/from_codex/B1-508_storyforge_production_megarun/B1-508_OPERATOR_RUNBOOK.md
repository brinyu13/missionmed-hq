# B1-508 Operator Runbook

## Healthy state

Expected:

- `https://missionmedinstitute.com/storyforge/healthz` returns 200.
- `/storyforge/api/config` returns signed-JWT mode, dev auth false,
  `audioAvailable:false`, and all AI flags false.
- Railway deployment `7ce159b6-226a-4e77-8335-e5e5d06519c3` is SUCCESS.
- One Railway replica is active.
- WordPress allows exactly the Founder and zero cohorts.
- DB ledger has 9 rows, latest `20260730000100`.
- Provider is `none`; reconciliation is `off`; voice/platform force-off are `1`.
- `STORYFORGE_ASSEMBLY_EXECUTOR` is absent.

## Logs

- Railway deployment and HTTP logs: StoryForge service
  `dab015bf-15ef-4698-9f16-cbf8cf23de7a`.
- WordPress/PHP: Kinsta site logs.
- Database: Railway PostgreSQL service
  `a4a66362-c3ba-475a-ae21-2aa46624bafe`.
- Critical-system pin:
  `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`.

Never paste raw variables, JWTs, database URLs, cookie values, or private
student content into tickets or handoffs.

## Emergency controls

- Disable voice: keep `STORYFORGE_VOICE_FORCE_OFF=1` and provider `none`.
- Disable reconciliation: keep `STORYFORGE_AUDIO_RECONCILIATION=off`.
- Disable StoryForge access: disable the WordPress StoryForge gate, then wait
  at least 60 seconds for existing JWTs.
- Remove student access: restore the backed-up Founder-only option set; do not
  edit JWT claims client-side.
- Disable platform: `STORYFORGE_PLATFORM_OFF=1` is configured as defense in
  depth, but it has not been exercised as the primary kill switch. Use the
  WordPress gate for the proven access shutdown.

## Rollback

1. Drain WordPress access for one JWT TTL.
2. Preserve provider none, reconciliation off, and voice force-off.
3. Restore prior Kinsta pointer/settings from
   `B1-508-KINSTA-ROLLBACK-20260731T070100Z`.
4. Clear MyKinsta cache.
5. Redeploy the prior Railway source/deployment if required.
6. Use M4 rollback only if database rollback is specifically required; do not
   reverse M1-M3.
7. Verify hashes, DB counts, config, health, and logs before reopening.

## Data-safety check

Confirm:

- app role remains non-owner/non-BYPASSRLS;
- effective-authority gate passes;
- active stories and audit counts are explained;
- no voice/audio/reconciliation rows appear while voice is disabled;
- no unapproved WordPress user/cohort is enabled.

## Before inviting students

The Founder must name the exact authorized identities/cohort. Voice remains
disabled. After the access change, verify one eligible and one ineligible
identity and run a synthetic text-only canary.
