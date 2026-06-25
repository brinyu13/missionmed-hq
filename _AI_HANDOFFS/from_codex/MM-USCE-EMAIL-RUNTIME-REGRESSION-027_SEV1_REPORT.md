# MM-USCE-EMAIL-RUNTIME-REGRESSION-027 SEV1 Report

Date: 2026-06-25  
Final verdict: LIVE_FIXED_READY_FOR_REVIEW

## Root Cause

Railway production was restored to an older/minimal `missionmed-hq` runtime after the June 24 auth/USCE/Arena recovery. That restored runtime kept the basic public-intake file but lost the known-good MM-USCE-OFFER-FLOW-003 offer runtime and server dispatch:

- `missionmed-hq/routes/usce-offer-portal.mjs`
- `missionmed-hq/routes/usce-status-tracker.mjs`
- `missionmed-hq/public/usce-decline-confirm.html`
- `missionmed-hq/server.mjs` route imports/dispatch for USCE public/admin offer/student offer/status routes

Production is Railway `missionmed-hq/server.mjs`. The parallel Next.js `app/api/**` tree is not the production runtime for this surface. The regression was therefore a missing Railway runtime module/dispatch regression, not a Postmark vendor outage, not a WooCommerce/payment issue, and not a CDN-only issue.

## Fix Applied

Commit pushed: `53a9257` (`MM-USCE-EMAIL-027: restore USCE email offer runtime`)  
Railway deployment: `2ecce718-d1e2-4c95-a0d5-6337cd542044` (`SUCCESS`, 2026-06-25 16:33:30 -04:00)

Changed runtime files:

- `missionmed-hq/server.mjs`
- `missionmed-hq/routes/usce-public-intake.mjs`
- `missionmed-hq/routes/usce-offer-portal.mjs`
- `missionmed-hq/routes/usce-status-tracker.mjs`
- `missionmed-hq/public/usce-decline-confirm.html`

Exact repair:

- Restored known-good USCE offer portal/status modules from the MM-USCE-OFFER-FLOW-003 package.
- Rewired only the missing Railway dispatch/import surface for:
  - `/api/usce/public/*`
  - `/api/usce/admin/intake-requests/{id}/offer-draft`
  - `/api/usce/admin/offers/{offerId}/token`
  - `/api/usce/admin/offers/{offerId}/message-preview`
  - `/api/usce/admin/offers/{offerId}/send`
  - `/api/usce/admin/offers/{offerId}/comms`
  - `/api/usce/offer/{token}`
  - `/api/usce/student/status`
- Updated the public intake sender display name from `MMI Clinical Rotations` to `MissionMed Clinicals`.
- Preserved the verified production sender email configuration. Live config still reports `from_email: info@missionmedinstitute.com` with Postmark live send enabled.

## Validation

Static/local validation:

- `node --check missionmed-hq/server.mjs` passed.
- `node --check missionmed-hq/routes/usce-public-intake.mjs` passed.
- `node --check missionmed-hq/routes/usce-offer-portal.mjs` passed.
- `node --check missionmed-hq/routes/usce-status-tracker.mjs` passed.
- `git diff --check HEAD~1..HEAD` passed.
- Direct current-module tests proved:
  - public intake acknowledgement renderer is MissionMed Clinicals branded and contains no Medmentum text.
  - offer renderer uses `usce_offer_ready_canonical_v1`.
  - offer email has exactly two CTAs: `Accept This Offer` and `Decline This Offer`.

Production non-mutating validation:

- `GET /api/usce/public/config` returned live Postmark/send config:
  - `intake_enabled: true`
  - `notify_dry_run: false`
  - `write_mode: supabase`
  - `schema_ready: true`
  - `notifications.provider: postmark`
  - `live_send_enabled: true`
  - `from_email: info@missionmedinstitute.com`
- Unauthenticated protected admin send route returns 401 instead of route-missing/unimplemented.
- Public offer route returns expected token-not-found behavior for invalid token.
- `/usce-decline-confirm` returns 200.
- `/api/usce/student/status` returns a student-audience 401 when unauthenticated.

Controlled live synthetic validation:

- WordPress app-password identity resolved as administrator and exchanged to a production HQ `usce_admin` session.
- Public intake submitted through `/api/usce/public/requests`.
  - Request ID: `dcaf2039-45f2-4c13-87cb-e9857ff31e8f`
  - Student test email: `info+mm-usce-email-027-20260625204222@missionmedinstitute.com`
  - Response: `202`
  - `notification_status: sent`
  - `notification_dry_run: false`
- Offer draft created through protected admin route.
  - Offer ID: `9ee02357-695e-4b9e-86cd-5d5c35a47d1e`
  - Draft status: `ready`
- Offer token minted.
- Preview saved through protected admin route.
  - Template: `usce_offer_ready_canonical_v1`
  - CTA count: `2`
  - Accept and decline URLs present.
- Live offer email sent through protected admin route.
  - Mode: `live`
  - Action: `offer_postmark_live_send`
  - Postmark MessageID: `b2df1b33-7b90-47d7-8a2f-7391c68f21cb`
- Comms readback passed.
  - Comms count: `3`
  - Preview record found: yes
  - Send record found: yes
  - Postmark record found: yes
- Offer readback after send passed.
  - Stored status: `sent` (admin UI maps this to `OFFER_SENT`)
- Public offer link opened successfully during the live sequence through `/api/usce/offer/{token}`.

Guard/browser validation:

- `_SYSTEM/tools/critical_systems_gate.py --enforce` passed protected-file, route, and CDN hash checks.
- CDN USCE admin loaded in Playwright:
  - status 200
  - console errors 0
  - app failed requests 0
  - bad app statuses 0
- WordPress USCE admin wrapper loaded in Playwright:
  - status 200
  - console errors 0
  - app bad statuses 0
  - one aborted Google Analytics beacon only
- WordPress Arena wrapper loaded in Playwright:
  - status 200
  - console errors 0
  - failed requests 0
  - bad statuses 0

## Not Touched

- Stripe/payment routing
- WooCommerce checkout/capture
- product pricing/cart
- Scheduler
- Matrix runtime/source
- Arena source/runtime
- WordPress plugin/proxy files
- R2/CDN HTML artifacts
- Supabase schema/migrations/RLS
- Next.js `app/api/**` runtime stubs

## Rollback Path

Preferred rollback is not the broken `27280193-c85b-49de-8b03-58e28ba0c9f3` runtime. Roll back to the pre-deploy commit plus the known-good auth baseline, or redeploy the current known-good package from commit `53a9257`.

Emergency command shape:

```bash
git checkout 53a9257
git archive --format=tar HEAD package.json package-lock.json railway.json .railwayignore missionmed-hq | tar -xf - -C /tmp/mm-usce-email-027-rollback
railway up --detach --service missionmed-hq --environment production --path-as-root --message 'rollback MM-USCE-EMAIL-027 known-good' /tmp/mm-usce-email-027-rollback
```

## Evidence Artifact

Sanitized live validation JSON was written to:

`/tmp/mm-usce-email-027-live-validation.json`

