# MM-USCE-OFFER-FLOW-003 Repair Build Report

## Summary
Repaired the USCE offer flow in source only. No deployment was performed.

Work was done in clean scoped worktree:
`/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/MM-USCE-OFFER-FLOW-003-repair-build-source`

Branch:
`MM-USCE-OFFER-FLOW-003-repair-build`

## Files Changed
- `missionmed-hq/routes/usce-offer-portal.mjs`
- `missionmed-hq/server.mjs`
- `LIVE/usce_admin.html`
- `LIVE/usce_offer.html`
- `missionmed-hq/public/usce-admin.html`
- `missionmed-hq/public/usce-decline-confirm.html`
- `tests/usce-offer-flow-003.spec.mjs`
- `tests/usce-offer-preview-canonical.spec.mjs`
- `_AI_HANDOFFS/from_codex/MM-USCE-OFFER-FLOW-003_REPAIR_BUILD_REPORT.md`

## Canonical Renderer
Canonical offer email renderer:
`buildOfferEmailPresentation()` in `missionmed-hq/routes/usce-offer-portal.mjs`

For `category: "offer_ready"`, it now routes to the canonical branded renderer:
`buildClinicalOfferEmail()`

Both protected admin paths use this same source of truth:
- Preview: `saveAdminMessagePreview()` calls `buildOfferEmailPresentation()` and returns `rendered_email`.
- Send: `sendAdminOfferMessage()` calls `buildOfferEmailPresentation()` and sends the same `htmlBody` / `textBody` through Postmark.

## Before / After Admin Preview
Before:
- Admin preview modal rendered the editable plain text message body.
- Preview path and live Postmark send path did not prove they shared one renderer.
- Student-visible admin preview did not show the polished branded email shell or buttons.

After:
- Live CDN admin preview requests backend-rendered `rendered_email`.
- Preview modal displays the rendered branded HTML email in a sandboxed iframe.
- Local/demo fallback preview also renders the branded offer email shell.
- Preview contains the same canonical markers as send HTML:
  - `data-mm-cta="accept-offer"`
  - `data-mm-cta="decline-offer"`

## Offer Email Behavior
The canonical offer email now includes:
- MissionMed Clinicals branding
- tracker-style progress strip
- offer summary card
- specialty
- location
- dates/months offered
- program
- rotation length
- deadline/respond-by when present
- exactly two student CTAs:
  - `Accept This Offer`
  - `Decline This Offer`

The old placeholder text is absent:
`Your coordinator will share your secure offer link after final review`

## Accept / Decline Routing
Accept URL:
- Routes to configured WooCommerce USCE enrollment page.
- Default fallback: `https://missionmedinstitute.com/product/usce-clinical-rotations/`
- Adds `usce_offer_approved=1`, `secure_window=48h`, `offer_id`, and safe token when available.
- No WooCommerce checkout or payment internals were edited.

Decline URL:
- Routes to the confirmation page:
  `https://missionmed-hq-production.up.railway.app/usce-decline-confirm`
- Adds `offer_id` and safe token when available.
- No direct decline action is triggered from the email or `LIVE/usce_offer.html`.

## Decline Confirmation
Added source page:
`missionmed-hq/public/usce-decline-confirm.html`

Behavior:
- Loads and displays offer recap when token is present.
- Posts to `/api/usce/offer/:token/decline` to create `OFFER_DECLINE_PENDING`.
- Requires student to choose:
  - Yes, notify me about future rotations
  - No, do not notify me
- Final confirm posts to `/api/usce/offer/:token/decline/confirm`.
- Records either:
  - `OFFER_DECLINED_NOTIFY_FUTURE`
  - `OFFER_DECLINED_NO_NOTIFY`

## Admin Status Visibility
Admin source now recognizes and displays:
- `OFFER_SENT`
- `OFFER_ACCEPTED`
- `OFFER_DECLINE_PENDING`
- `OFFER_DECLINED_NOTIFY_FUTURE`
- `OFFER_DECLINED_NO_NOTIFY`

Updated status filters, badges, stats, sorting, normalization, and local demo state handling in both admin HTML variants.

## Tests / Validation
Passed:
- `node --check missionmed-hq/routes/usce-offer-portal.mjs`
- `node --check missionmed-hq/server.mjs`
- `node --test tests/usce-offer-flow-003.spec.mjs`
- `node --test tests/usce-offer-preview-canonical.spec.mjs`
- `git diff --check`

Additional validation passed:
- Inline script parse check for:
  - `LIVE/usce_admin.html`
  - `LIVE/usce_offer.html`
  - `missionmed-hq/public/usce-admin.html`
  - `missionmed-hq/public/usce-decline-confirm.html`

## Remaining Before Deploy
- Review the scoped diff.
- Confirm Railway/static serving expectation for `/usce-decline-confirm`.
- Deploy through the established source/Railway workflow only after approval.
- Post-deploy, send one controlled offer email and verify the received Postmark email matches the admin preview and contains exactly the two student CTAs.

## Safety Notes
- No deployment performed.
- No WooCommerce checkout/payment internals touched.
- No LearnDash, Arena, Matrix, Scheduler, public intake admin email resend, or unrelated systems touched.
