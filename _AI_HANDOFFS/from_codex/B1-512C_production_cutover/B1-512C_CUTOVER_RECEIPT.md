# B1-512C Core Production Cutover Receipt

**Verdict:** StoryForge B1-512 core is deployed as `v-10688bb24bca7965`. Private story media remains disabled.

## Immutable release identity

| Item | Verified value |
|---|---|
| Product commit | `8ca5d60fffcbb479fc5ced4689702fd4a7defb58` |
| Release ID | `v-10688bb24bca7965` |
| Railway deployment | `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c` (`SUCCESS`) |
| Kinsta pointer | `releases/8ca5d60fffcbb479fc5ced4689702fd4a7defb58` |
| Route SHA-256 / bytes | `02339448018c0bbede96a90de0ececb364d02a0d50f39d8a8011ad243ee81d7b` / `42807` |
| Release PHP SHA-256 / bytes | `1d89394ab98284f5e99376000663e55db6bacef9d94e8697ef062784222b3c10` / `1146741` |
| Public index SHA-256 | `e720fca216d488e966230cfd5d98da400e83e6fd38a1bb40699539d8cc18f8b2` |
| Public app SHA-256 | `cbe2999f0c70cd31617d4c1ee2f1f35ed71c1d166723509eb4c060fbfb6c46a5` |
| Public auth SHA-256 | `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` |
| Public styles SHA-256 | `5e18315007aafd2e16a1f5749842320c13386546bb677011789785979202c597` |

## Database transaction

The existing guarded runner completed exactly one additive migration:

`20260806190000_b1_512_concrete_configuration_media.sql`
SHA-256: `ab05da6827694b0c364f98bfaf5226a0008dfde915337e85136a475aaf0ff02e`

Its guarded preflight passed against the expected Railway PostgreSQL identity and 12-row pre-ledger. The apply transaction passed. Independent post-apply checks proved one target ledger row, 441 users unchanged, 23 stories unchanged, four required FORCE RLS tables, zero story-media rows, zero unresolved media-deletion intents, and `interviewPrepVisible=false`.

The locked Railway backup used by the runner was `835127ec-49f6-46a9-a55c-db6582748edd`; its independently restored local PG18 dump SHA-256 was `fc0f13e92b35ee59bba6c43854e7addc3f4b5142080db4330f48e8a942b59b7b`.

## Bounded deployment actions

1. Set `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` without triggering an intermediate deploy.
2. Set the accepted Content & Display force-off control to `0` without exposing private media.
3. Uploaded only `storyforge-v5/` with Railway `--path-as-root`; Railway reported the StoryForge build/start/health manifest and one intended replica.
4. Staged only the route and generated release PHP below Kinsta private storage, ran the existing immutable-release preflight, and atomically promoted the pointer and route while StoryForge was briefly drained.
5. Restored `storyforge_enabled=true` immediately after the release procedure.
6. Independently verified pointer, hashes, modes (`0555` release directory and `0444` release/route files), and owner/group (`theresidencyacademy:www-data`).
7. Cleared all Kinsta caches through the authenticated MyKinsta Live-site control after the host helper's known response-body/segfault condition.

## Host-helper exception

The existing Kinsta helper completed the immutable publication and then rejected the Kinsta cache response body before PHP-FPM emitted its historically observed post-write segfault. This did **not** constitute assumed success: post-write pointer, release, route, permission, public-index, and public-asset checks all independently matched the expected B1-512 bytes. The authenticated MyKinsta cache-clear request was then accepted. No broad host repair was performed.

## Candidate baseline already accepted

No source was changed during this cutover. The frozen candidate evidence remains: unit `295/295`, browser `72/72`, acceptance `130/130`, PostgreSQL PASS, conformance/accessibility `72/72`, and Critical Systems zero FAIL before cutover.
