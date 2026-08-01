# B1-510I Phase B/C Deployment Receipt

## Production writes

| System | Write | Final evidence |
|---|---|---|
| Railway PostgreSQL | additive admin-console migration | ledger `20260801190000`, 10 total migrations |
| Railway API | exact StoryForge package deployment and flag redeploys | final `00496858-15f1-46d0-897b-379f63b7367c`, SUCCESS |
| Kinsta | immutable release plus isolated MU route | pointer `releases/dab4e67fe6f8044cfa8a76db435b0aa843826074` |
| Feature flags | Founder-only admin console | `allowlist:1:0`, audited endpoint |
| Runtime presentation | premium motion | `STORYFORGE_PREMIUM_MOTION=1` |
| Critical Systems | current StoryForge index/app/styles and active app alias only | commit `dc51eec`, 0 FAIL |

## Preserved production configuration

- voice scope `eligible_all:0:0`;
- transcription provider `openai`;
- primary `gpt-4o-transcribe`;
- fallback `whisper-1`;
- assembly executor `concat`;
- voice force-off `0`;
- audio reconciliation `off`;
- platform force-off `1`;
- WordPress authenticated JWT bridge and existing entitlement authority;
- private R2 credentials, bucket, and permissions;
- all Matrix-owned assets.

## Deployment incident and correction

Deployment `d0e6ccc1-d13c-45f4-bce3-8f3be0f3c896` used the repository root and started an unrelated root service. It was detected by the wrong build command and `/healthz` 404. No 5xx, data write, credential change, or schema mutation resulted. Deployment `9034a989-c3af-4bc1-a89e-55140e9f07f8` used the exact package root and restored StoryForge health. The Founder-only and motion redeploys then completed as `fa4446d0-e095-4ea9-acea-17290c1fb1e1` and final `00496858-15f1-46d0-897b-379f63b7367c`.

## Final public proof

Every current index, app, auth, styles, and logo byte matches the deterministic release. Founder student, Founder administrator, Ignacio, a second eligible student, ineligible, anonymous, cross-user denial, R2 cleanup, and zero-5xx checks passed.
