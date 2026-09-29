# Zelle Administrator-Confirmation State Delta

## Source

- Added explicit provider modes: `admin_confirmation` and `automated_email_match`.
- Preserved the Gmail/Chase parser call, HMAC request signing, deterministic matcher states, financial fingerprinting and replay protection.
- Added a secure Woo administrator queue, per-order nonce/capability validation, auditable review decisions and one-request/one-order claims.
- Added customer pending/submitted/verified UI using Zelle ID `missionmed` and the exact Founder QR.
- Added scoped WCAG-AA colors and focus states across all Zelle states.
- Hardened terminal claim consumption and pending-state checks so a cancelled/refunded order cannot reuse a previously consumed administrator claim.
- Production code commit: `2a43b20018865c465df3c9f81e836de066315aae`.
- Live/source verifier SHA-256: `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`.

## Runtime/configuration

- `mmed_mr_zelle_verification_mode`: `admin_confirmation`.
- `mmed_mr_0912_iw_zelle_enabled`: `no` → `yes` after acceptance.
- `mmed_mr_0912_complete_zelle_enabled`: `no` → `yes` after acceptance.
- Woo BACS title/instructions now identify `missionmed` and the secure order-received page; the old email is not a current payment destination.
- Public product prices, inventory, mappings and Stripe settings remained unchanged.

## Controlled evidence

- `#9195`: Interview Week canonical completion proved 3646-only grant, replay idempotency, then cleanup/revocation.
- `#9196`: Complete canonical completion proved 5227-only grant, no separate 3646 grant, verified customer/Matrix state, paid-state replay idempotency, then cleanup/revocation. A subsequent post-cancellation direct and authenticated-admin replay stayed cancelled/unpaid with zero protected entitlement and was audit-blocked as `order_not_pending`.
- `#9198`: reused claim blocked; unpaid; no entitlement.
- `#9197`: responsive fixture only; unpaid; no customer entitlement.
- `#9193`: real `$1` attempt not observed as received by Chase; never paid or entitled; truthfully closed.

## Final controlled state

- Orders `#9193`, `#9195`, `#9196`, `#9197`, `#9198`: cancelled.
- Controlled/test markers: removed.
- Scheduled retries: cleared.
- User 1391 courses: `[4204]` only.
- User 1391 groups: `[]`.
- LearnDash 3646: false; 5227: false; unrelated closed course 3893: false.
- No public test price or bypass remains.

## Preserved unrelated work

Only the Zelle verifier, exact QR and Zelle evidence package belong to this pivot. Existing modified B Immersive reports and unrelated untracked Claude/AAA/Bootcamp/funnel artifacts were not staged, committed, rewritten or deleted.
