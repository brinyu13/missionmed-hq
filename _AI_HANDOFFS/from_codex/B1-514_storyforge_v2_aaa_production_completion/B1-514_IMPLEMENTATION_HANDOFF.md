# B1-514 Implementation Handoff

## Verdict

**LOCAL V2 IMPLEMENTATION AND HARDENING COMPLETE — CUTOVER REMAINS STOP-SAFE ON EXTERNAL GATES**

## Sealed candidate

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Source-hardening commit: `3a1d7ccfa73e5cd8f8cf358383a0b245215c13d2`
- Release commit: `0d1db330713a94051301ec94d4c7c7dc96a1486c`
- Release: `v-06c677f9362ced63`
- Release PHP SHA-256: `c456e0801899cd3ef82e8426920a6ebbe1f3eb10855b8fc8586bcacee5ec9497`
- App asset: `app.9144d2195328.js`
- App asset SHA-256: `9144d21953287a2b505a446be260a6b346c7c2c2c88f2125427f68bfe552f587`
- Final ten-migration train SHA-256: `3c3f02099c3d47a549582c417cab9e27e68c6f48bbf4f854838a63285f9e25a1`

## Final implementation tranche

The final tranche closed the evidence-backed P0/P1 gaps found after the original local seal:

1. Added durable guest-voice finish identities, retry-safe completion, permanent/transient cleanup intents, revoke/expiry/abandonment cleanup, and lost-ack recovery in `20260810280000_b1_514_guest_voice_cleanup_recovery.sql` and `server/guest-voice.mjs`.
2. Added a signed WordPress-to-Railway guest ingress boundary. WordPress converts the client address into a one-way HMAC pseudonym; Railway verifies method, path, timestamp, pseudonym, and signature before guest work. Raw client addresses are not forwarded or persisted.
3. Corrected Postmark webhook ingress. Postmark's configured custom secret header terminates at WordPress; WordPress replaces it with a body-bound HMAC for the private Railway handler. Caller-supplied Railway signatures are never forwarded.
4. Replaced the guest path's forbidden direct `sf_users` read with the bounded `SECURITY DEFINER` `sf_guest_view(text)` projection. It returns only the invited student's first/display name and non-secret invitation fields.
5. Fixed the sole renderer so `sf_users.inspiration_layout` hydrates back into Grid/List state after reload.
6. Extended the PostgreSQL runner so the exact ten-migration train and both governed seeds execute before both legacy authorization/conformance matrices; filesystem train drift fails closed.
7. Added five enabled-V2 real-browser acceptance IDs covering consent/privacy/HUD/recommendations, purposeful versions and Inspiration persistence, student/guest Request-a-Story, mentor transcript/audio playback, and theme/environment persistence.
8. Extended the survival verifier to classify additive V2 story relationships without treating new empty tables as V1 loss, while still failing on synthetic historical V2 rows.

## Production-source files changed in the final tranche

- `storyforge-v5/public/app.js`
- `storyforge-v5/server/app.mjs`
- `storyforge-v5/server/requests.mjs`
- `storyforge-v5/server/guest-voice.mjs`
- `storyforge-v5/server/gateway-ingress.mjs`
- `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`
- `storyforge-v5/infra/postgres/migrations/20260810280000_b1_514_guest_voice_cleanup_recovery.sql`
- deterministic `dist`, edge alias, and WordPress release artifacts for `v-06c677f9362ced63`

Supporting scripts and tests are enumerated by commits `3a1d7cc` and `0d1db33`.

## Safety properties retained

- One production renderer; no prototype wrapper, duplicate event authority, or synthetic fallback.
- Historical visibility stays SQL `NULL` and private-safe.
- Every V2 database flag remains default `off`; every server force-off remains fail-closed.
- Student ownership, WordPress signed identity, LearnDash eligibility, admin mode, mentor assignment, RLS, private R2 storage, immutable originals/history, and append-only audit remain server/database authoritative.
- No private story, transcript, token, email, raw client IP, R2 object key, provider secret, or credential is written to the evidence package.
- No production migration, deployment, feature activation, R2 mutation, or Postmark call occurred.

## Live production state

Production remains the independently verified B1-512C baseline:

- Source `8ca5d60fffcbb479fc5ced4689702fd4a7defb58`
- Release `v-10688bb24bca7965`
- Railway deployment `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c`
- Kinsta pointer `releases/8ca5d60fffcbb479fc5ced4689702fd4a7defb58`

