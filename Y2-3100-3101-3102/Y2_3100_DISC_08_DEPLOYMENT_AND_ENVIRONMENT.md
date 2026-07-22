# Y2-3100 DISC-08 Deployment and Environment

## Deployment Descriptors

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/railway.json:1` through `:12` and `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/railway.json:1` through `:12` use Railpack, `npm start`, `/health`, a 120-second health timeout, and 10 restart retries.
- **UNKNOWN:** Railway project, environment, and service identities are not encoded in those files. No dashboard mutation or credentialed infrastructure lookup was performed for Y2.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/health.mjs:3` through `:55` returns redacted runtime and provider readiness without secret values.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/config.mjs:20` through `:100` fails closed on environment/provider requirements; `:102` through `:203` builds normalized configuration.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/4008A_COMPLETE_COMBINED_HANDOFF.md:57` through `:64` records a dedicated DEV environment `cam-dev`, service `cam-api-dev`, 109 provider-integration checks, and synthetic cleanup.
- **VERIFIED:** `4008A_COMPLETE_COMBINED_HANDOFF.md:66` through `:78` records Railway project `missionmed-hq-fix005`, production environment `cam-production`, API deployment `657fe712-0c8f-468e-bc41-0a8be69cd093`, HQ deployment `efe688fd-810f-4547-889f-ef982e82691e`, and hosted health/browser evidence. This is accepted handoff evidence; Y2 did not contact or mutate those services.

## Accepted Environment Names

**VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/environment/missionmedEnvBridge.mjs:17` through `:62` defines the canonical provider and deployment variable map:

- Supabase URL/key/JWT/project names: `SUPABASE_URL`, `MMHQ_SUPABASE_URL`, `MMHQ_MMC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MMHQ_SUPABASE_ANON_KEY`, `MMHQ_MMC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MMHQ_SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MMHQ_SUPABASE_SERVICE_ROLE_KEY`, `MMHQ_MMC_SUPABASE_JWT_SECRET`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`, `MMHQ_MMC_ALLOWED_SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_REF`.
- Cloudflare and R2 names: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_ACCOUNT_ID`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT_URL`, `R2_REGION`, `R2_CDN_BASE_URL`.
- Postmark names: `POSTMARK_SERVER_TOKEN`, `MMHQ_POSTMARK_SERVER_TOKEN`, `USCE_POSTMARK_SERVER_TOKEN`, `USCE_POSTMARK_FROM_EMAIL`, `SCHEDULER_EMAIL_FROM`, `USCE_POSTMARK_REPLY_TO_EMAIL`.
- WordPress names: `MMHQ_WP_BASE`, `MMHQ_WP_USERNAME`, `MMHQ_WP_APP_PASSWORD`, `MMHQ_ALLOWED_WP_ROLES`.
- Railway map names: `RAILWAY_PROJECT_NAME`, `RAILWAY_SERVICE_NAME`, `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`, and `PORT`.

- **VERIFIED:** `missionmedEnvBridge.mjs:10` through `:15` identifies `CAM_3028_SUPABASE_PROJECT_REF`, `CAM_3028_DEV_PASSWORD`, `SUPABASE_DB_PASSWORD`, and `DATABASE_URL` as retired ticket variables. They are names only and are not approved runtime inputs.
- **VERIFIED:** `missionmedEnvBridge.mjs:123` through `:131` also reads `RAILWAY_PROJECT_ID` and `RAILWAY_SERVICE_ID` only to detect Railway runtime mode.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/config.mjs:20` through `:203`, together with `missionmedEnvBridge.mjs:179` through `:182`, reads these CAM/runtime names: `NODE_ENV`, `CAM_ENV`, `CAM_AUTH_MODE`, `CAM_REP_STORAGE_MODE`, `CAM_BOUNDARY_STORAGE_MODE`, `CAM_ENTITLEMENT_MODE`, `CAM_PRODUCTION_PROVIDER_ENABLE`, `CAM_PROFILE_SCHEMA_MODE`, `CAM_ENTITLEMENT_ENFORCE_API`, `CAM_API_VERSION`, `CAM_SESSION_REGISTRY_ENFORCE`, `CAM_ENTITLEMENT_SOURCE`, `CAM_ENTITLEMENT_CACHE_TTL_SECONDS`, `CAM_360_ALLOWED_COURSE_IDS`, `CAM_360_ALLOWED_PROGRAM_TIERS`, `CAM_MOCK_360_USER_IDS`, `CAM_DEV_360_USER_IDS`, `CAM_MOCK_CAM_ADMIN_USER_IDS`, `CAM_DEV_CAM_ADMIN_USER_IDS`, `CAM_CORS_ALLOWED_ORIGINS`, `CAM_ALLOWED_ORIGINS`, `CAM_DEV_PAGES_PROJECT`, and `CAM_DEBUG_ERRORS`.

## Y2 Deployment Boundary

- **VERIFIED:** No `CAM_INTERVIEWER_*` configuration is present in the inspected CAM donor.
- **UNKNOWN:** WebRTC, TURN, LiveKit, egress, GPU, model-provider network, and worker-service requirements are not established by the current source.
- **INFERENCE:** A separately deployable interviewer worker is a reasonable isolation boundary, but it is architecture only. It is not an existing third Railway service.
- **INFERENCE:** Any future flags must be server-side, default false on missing/unknown values, and incapable of activation by URL, frontend state, Matrix, Arena, or user metadata.
- **VERIFIED:** The current kill result authorizes no environment variable, service, deployment, or public route addition.

## Boundary Verdict

Current CAM deployment descriptors are reusable examples. They do not provide a deployable interviewer service or its network/provider configuration.
