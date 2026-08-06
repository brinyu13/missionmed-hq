# B1-512C StoryForge Core Production Cutover — Final Complete Handoff

## Outcome

The exact tested B1-512 core release is live in production:

- release `v-10688bb24bca7965`;
- source commit `8ca5d60fffcbb479fc5ced4689702fd4a7defb58`;
- Railway deployment `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c`;
- immutable Kinsta pointer `releases/8ca5d60fffcbb479fc5ced4689702fd4a7defb58`.

The core additions are active: Finish It/submission treatment, Content & Display configuration, text-size preference, environment Preview/Cancel/Save behavior, and reversibly hidden Interview Prep. Private story media remains explicitly force-off and unexposed.

## Exact production evidence

The guarded B1-512 migration ran once, with its accepted SHA-256 and locked backup receipt. Its independent post-state check showed unchanged 441 users and 23 stories, 4/4 required FORCE RLS tables, hidden Interview Prep, and zero media/deletion-intent rows.

Kinsta immutable production values:

- route `02339448018c0bbede96a90de0ececb364d02a0d50f39d8a8011ad243ee81d7b`, 42807 bytes;
- generated release `1d89394ab98284f5e99376000663e55db6bacef9d94e8697ef062784222b3c10`, 1146741 bytes;
- modes `0444` (route/release) and `0555` (release directory);
- owner/group `theresidencyacademy:www-data`;
- public index/app/auth/styles SHA-256 values recorded in `B1-512C_CUTOVER_RECEIPT.md`.

The deployed backend returned health HTTP 200, anonymous protected session HTTP 401, and bad-origin API HTTP 403. No bounded Railway 5xx entries were found. Critical Systems completed 111 PASS / 0 WARN / 0 FAIL.

## Private-media hard stop

`STORYFORGE_STORY_MEDIA_FORCE_OFF=1` is set. No photo/video controls were visible in the live eligible-student workspace. This cutover did not upload private story media, call a transcription provider, modify R2, alter identities, alter LearnDash, alter WordPress roles, or change Matrix assets.

## Canary and remaining role-session note

The currently available signed student session passed the core UI, display-preference, hidden-navigation, controlled submission/reversal, and original-audio-replay smoke. Anonymous/bad-origin denial passed. The current Chrome session did not contain Founder/Admin, second eligible, or authenticated ineligible identities, so those interactive role-matrix checks were not simulated or claimed as rerun; see `B1-512C_PRODUCTION_CANARY_RESULTS.md` for the precise boundary. Existing B1-511A Founder Administrator View/mentor-note evidence remains preserved because B1-512 did not touch that authority path.

## Recovery and rollback

Fresh locked Railway, MyKinsta, local PG18 restore, and Kinsta pointer/route snapshot evidence preceded production writes. The new Kinsta rollback receipt and retained prior Railway deployment allow narrow reversal without destructive database action. See `B1-512C_ROLLBACK_STATUS.md`.

## Files changed by B1-512C custody

- `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` — only current StoryForge release pins/asset aliases.
- This directory's five Markdown receipts and `MANIFEST.sha256`.

No application source, migration source, authentication, entitlement, Matrix, WordPress role, R2, or private-media code was modified by B1-512C.
