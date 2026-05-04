# CX-OFFER-315 Wiring Handoff

RESULT: PARTIAL - SOURCE WIRED / MIGRATION AND DEPLOY HELD

## Summary

CX-OFFER-315 added the protected backend source foundation for the USCE student offer portal. It did not apply the Supabase migration, deploy Railway, promote CDN, send email, create payment, touch WooCommerce, touch LearnDash, or use Computer Use.

Migration apply was held because `supabase db push --dry-run` is blocked by the known remote/local migration history mismatch. A browser/dashboard apply is outside this no-Computer-Use prompt.

## Files Changed

- `missionmed-hq/routes/usce-offer-portal.mjs`
- `missionmed-hq/server.mjs`
- `supabase/migrations/20260504143000_usce_offer_drafts_token_portal.sql`
- `LIVE/usce_offer.html`
- `LIVE/usce_admin.html`
- `_AI_HANDOFFS/from_codex/CX-OFFER-315_WIRING_HANDOFF.md`

CX-OFFER-314 handoff artifact present and relevant:

- `_AI_HANDOFFS/from_claude_code/CX-OFFER-314_UI_SHELL_HANDOFF.md`

## Migration Created

`supabase/migrations/20260504143000_usce_offer_drafts_token_portal.sql`

Adds:

- `command_center.usce_offer_drafts`
- `public.save_usce_offer_draft(uuid, jsonb, jsonb)`
- `public.update_usce_offer_draft(uuid, jsonb, jsonb)`
- `public.mint_usce_offer_token(uuid, text, timestamptz, jsonb)`
- `public.get_usce_offer_draft_admin(uuid)`
- `public.get_usce_offer_by_token_hash(text)`
- `public.respond_usce_offer_by_token_hash(text, text, text, boolean, jsonb)`
- Helper serializers:
  - `public.usce_offer_draft_admin_json(uuid)`
  - `public.usce_offer_student_json(uuid, boolean)`

All table/RPC grants are service-only. PUBLIC, anon, and authenticated are revoked.

## Endpoints Created In Source

Protected admin endpoints, behind existing Railway `requireUsceUserSession` and `isPrivilegedWordPressUser`:

- `POST /api/usce/admin/intake-requests/:id/offer-draft`
- `PATCH /api/usce/admin/offers/:offerId`
- `GET /api/usce/admin/offers/:offerId`
- `POST /api/usce/admin/offers/:offerId/token`

Tokenized student endpoints:

- `GET /api/usce/offer/:token`
- `POST /api/usce/offer/:token/respond`

## Auth Protections

- Admin offer endpoints are mounted only after `requireUsceUserSession`.
- `requireUsceUserSession` uses `isPrivilegedWordPressUser`.
- `isPrivilegedWordPressUser` means administrator role or `manage_options`.
- `MMHQ_ALLOWED_WP_ROLES` is not used for these protected admin endpoints.
- Student endpoints are public only by token; no WordPress REST identity and no browser Supabase.

## Token Security Model

- Railway generates a raw `usce_...` token.
- Railway stores only SHA-256 token hash through the service-only RPC.
- Raw token is returned once from the token-mint endpoint.
- Token expires.
- Student read/respond endpoints hash the provided token before calling service-only RPCs.
- Student endpoint payloads are redacted and omit admin notes, internal metadata, service credentials, and intake-private data.

## UI Adapter Changes

- `LIVE/usce_offer.html` now advertises CX-OFFER-315 endpoint paths in config:
  - `/api/usce/offer/:token`
  - `/api/usce/offer/:token/respond`
- `liveAdapterEnabled` remains `false`.
- No browser live fetch was added to the offer portal.
- `LIVE/usce_admin.html` notes that token/read/respond source wiring exists, but admin browser token mint/send remains disabled.

## Validation Completed

- `node --check missionmed-hq/server.mjs`: PASS
- `node --check missionmed-hq/routes/usce-public-intake.mjs`: PASS
- `node --check missionmed-hq/routes/usce-offer-portal.mjs`: PASS
- `git diff --check`: PASS
- `LIVE/usce_offer.html` inline JS compile: PASS
- `LIVE/usce_admin.html` inline JS compile: PASS
- Route helper validation:
  - safe token: PASS
  - unsafe token: PASS
  - token hash length 64: PASS
  - accepted/alternate/invalid action normalization: PASS
  - accept returns payment handoff URL, decline returns no URL: PASS
- Local server smoke on port `4199`:
  - `GET /api/health`: 200
  - unauth admin draft create: 401
  - unauth admin offer read: 401
  - unauth admin token mint: 401
  - invalid token read: 404
  - safe token read with storage unconfigured: 503 safe storage error
  - invalid response action: 400 before storage write
  - OPTIONS token response from CDN origin: 204
- Root auth regression:
  - `/Users/brianb/MissionMed/node_modules/.bin/tsx --test tests/arena-railway-auth-audience.spec.ts`: PASS
- `npm run build`: PASS placeholder
- `npm test`: BLOCKED, local `tsx` dependency missing
- `npm run typecheck`: BLOCKED, local `tsc` dependency missing

## Migration/Deploy Status

- Migration created: yes
- Migration applied: no
- Railway deployed: no
- R2/CDN promoted: no

Reason held:

`supabase db push --dry-run` failed because remote migration versions are not present in the local migrations directory:

- `20260426174000`
- `20260426175000`
- `20260426183000`
- `20260501183000`

No `supabase migration repair`, `supabase db pull`, dashboard SQL apply, or Railway deploy was performed.

## Deferred / Blocked

- Apply migration through a live validation/apply prompt.
- Deploy Railway only after migration is applied and grants are verified.
- Validate privileged admin create/update/token mint live.
- Validate tokenized student read/respond live.
- Keep offer portal CDN promotion separate.
- Keep Postmark, notifications, WooCommerce order creation, LearnDash sync, and student portal live adapter activation separate.

## Next Recommended Prompt

Use:

`CX-OFFER-316-LIVE-VALIDATION — Apply USCE Offer Token Migration + Deploy Railway + Validate Tokenized Student Offer Endpoints`

That prompt may authorize Computer Use only for Supabase/Railway/browser live validation gates.

