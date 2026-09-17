# MR 2026-27 Dr J Private Early Access - Production Report

## Final status

`MR 2026–27 DR J PRIVATE EARLY ACCESS = LIVE AND VERIFIED`

Completed 2026-09-17. This was a bounded access-control deployment, not a landing-page redesign and not a financial acceptance run.

## Authority and BOOT

- Scoped authority: `DR-299`, `decisions/DR-299_mr_web_0912_drj_private_early_access.md`.
- Canonical authority commit: `231f2544ae769b8cf885ee3160d1a39bfc4815ca`.
- Exact canonical decision SHA-256: `b17878086c632566e7d2c867e1f35959b4a4811009b05d85f8b2556877f1bf39`; exact remote readback matched.
- Canonical MissionMed OS tip at final readback: `b5093476f7a647c1fec3fce41760c978f7fb2ac5`.
- Universal BOOT dependency validation: PASS against MissionMed HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- `MR-WEB-0912` mission-profile BOOT validation: PASS against the same HQ tip.
- Canonical OS lint: PASS; existing repository warnings remained warnings and were not broadened into this mission.
- Registry/provider lease state at close: no active leases.

DR-299 authorizes only the time-bounded access gate. It does not change prices, products, course mappings, payments, refund authority, capacity, or the existing Founder financial-test waiver.

## Recovery and custody

- MyKinsta manual backup verified before deployment:
  - created: Sep 17, 2026, 11:25 AM;
  - note: `Sept 17th`;
  - expiry: Oct 1, 2026, 11:25 AM;
  - restore control: visible;
  - retention shown: 14 days.
- No backup was created, renamed, restored, or deleted by this run.
- Exact production preimages and rollback instructions are in `PREIMAGE_LEDGER.md` and `ROLLBACK.md`.
- Deployment used scoped fencing epoch `3007`. The production copy and exact hash readback completed inside its 30-second window. The lease expired before the later release call acknowledged it; no provider mutation occurred after expiry.
- Targeted Kinsta cache purge used fresh fencing epoch `3009`, which was explicitly released successfully.
- Final active lease count: zero.

## Source and production deployment

- Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`
- Branch: `codex/mr-web-0912-interview-week`
- Production source commit: `8d620206d055cc9044cda8ddbba27a29d36341bd`
- Remote branch readback: exact match.

| Deployed file | Final SHA-256 |
| --- | --- |
| `wp-content/mu-plugins/missionmed-mr-p0.php` | `62830aa98855d1b4cf2e0528fec85592a5368a4afa2e922fd5dcf202b4db27ab` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js` | `a5a1f02eba1302af48af56c63a15bddf985fe12837283f42d96e2f48abe47b08` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/production.css` | `c68ed0c56d702c09908431adebe34fd9df5188329ec026350bd4d661e5294bca` |

All three live hashes match the committed source. PHP syntax, JavaScript syntax, Git whitespace checks, and the 17-assertion private-access unit harness pass.

## Implemented access experience

- The public Mission Residency page remains browsable without a code prompt.
- The prompt opens only after Interview Week or Complete enrollment intent, or after a protected direct-path interception.
- The modal uses the Founder-directed private-enrollment copy and labels the field `Private access code`; it is not presented as a coupon or discount.
- Valid access is persisted in a signed, `Secure`, `HttpOnly`, `SameSite=Lax` browser cookie scoped to the site.
- The cookie expires at the public-opening boundary; server-side time logic independently stops requiring it at the boundary.
- The originally selected offer or signed same-origin direct destination is retained.
- Resume tokens are HMAC-signed, time-bound, same-origin, and tamper-checked.
- The raw private code is absent from deployed PHP and absent from analytics payloads. Only its SHA-256 comparison value is deployed.
- Failed attempts are rate-limited by a salted client fingerprint; no raw code or direct identifier is stored in analytics.
- Legitimate WooCommerce administrators bypass the campaign gate; unrelated products are not gated.
- No backend 20-seat or count-based capacity rejection exists. Runtime explicitly reports `backend_seat_cap: false`.

## Automatic public opening

- Authoritative opening: `2026-09-19T12:00:00-04:00`.
- Timezone: `America/New_York`.
- UTC instant: `2026-09-19T16:00:00Z`.
- Exact epoch: `1789833600`.
- At the injected exact opening instant, runtime reported:
  - gate active: false;
  - access granted without cookie: true;
  - mode: `public_open`;
  - access required: false;
  - backend seat cap: false;
  - Interview Week add-to-cart: allowed at $549, Woo `5504/5867`, LearnDash `3646`;
  - Complete add-to-cart: allowed at $3,099, Woo `3576/5865`, LearnDash `5227`.

No host clock, production option, product, or price was changed for this simulation.

## Private-window acceptance matrix

| Requirement | Result | Production proof |
| --- | --- | --- |
| Public landing browsable | PASS | HTTP 200; no prompt before enrollment intent at 1440/1024/390 |
| Code not published | PASS | Landing rendered without the private code at all three viewports |
| No-code landing enrollment blocked | PASS | Enrollment intent opens the modal instead of checkout |
| Direct Interview Week add-to-cart blocked | PASS | HTTP 303 to signed Mission Residency access-resume URL |
| Direct Complete add-to-cart blocked | PASS | HTTP 303 to signed Mission Residency access-resume URL |
| Product/stale routes blocked | PASS | Both active legacy product routes return HTTP 303 into the gate |
| Protected cart without access blocked | PASS | Existing protected Woo session returns HTTP 303 into the gate |
| Protected checkout without access blocked | PASS | Existing protected Woo session returns HTTP 303 into the gate |
| Wrong code blocked | PASS | REST response HTTP 403 `invalid_code`; friendly modal error rendered |
| Valid Interview Week access | PASS | Resumed `/checkout/`; exact `5504/5867` line at $549 |
| Valid Complete access | PASS | Resumed `/checkout/`; exact `3576/5865` line at $3,099 |
| Access persists | PASS | Runtime changed from required=true/granted=false to required=false/granted=true in the same browser journey |
| Repeated valid access permitted | PASS | Multiple controlled valid access calls succeeded; no count gate exists |
| Code changes no price | PASS | Endpoint and runtime report `changes_price: false`; checkout amounts remained authoritative |
| Interview Week card | PASS | Stripe/card rendered at $549 |
| Interview Week Zelle | PASS | Zelle rendered at $499 only for Interview Week |
| Zelle hold/no-access | PASS | Exact-order filter returns `on-hold`; LearnDash grants only `processing/completed` and denies `pending/on-hold/cancelled/refunded/failed/checkout-draft` |
| Complete card | PASS | Stripe/card rendered at $3,099 |
| Complete includes Interview Week | PASS | Complete checkout has one Complete line and no separate $549 Interview Week line |
| Product/course mappings | PASS | Runtime exact arrays `[3646]` and `[5227]`; mapping and parent verification true |
| No financial submission | PASS | Place Order was never invoked; latest Woo order remains `9102` |

## Responsive and rendered QA

Logged-out production QA passed at:

- 1440 desktop: no initial prompt, no forbidden/internal copy, no overflow, modal usable, 233x59 CTA target, no page errors;
- 1024 tablet: no initial prompt, no forbidden/internal copy, no overflow, modal usable, 213x53 CTA target, no page errors;
- 390 mobile: no initial prompt, no forbidden/internal copy, no overflow, modal usable, 343x59 CTA target, no page errors.

The mobile checkout was also rendered for both offers. Interview Week displayed $549 card and $499 Zelle-on-hold; Complete displayed $3,099 card and no Zelle rail. No payment was submitted.

Evidence:

- `evidence/LIVE_PRIVATE_ACCESS_QA.json`
- `evidence/private-access-1440.png`
- `evidence/private-access-1024.png`
- `evidence/private-access-390.png`
- `evidence/checkout-interview_week-390.png`
- `evidence/checkout-complete-390.png`

## Analytics and UTM proof

- Existing Google tag `GT-PJ7SPCWF` remains present.
- Runtime data-layer events observed:
  - `mr_private_access_prompt`;
  - `mr_private_access_rejected`;
  - `mr_private_access_accepted`.
- Payloads include offer and public/private enrollment state, not the raw code.
- A controlled `utm_source=whatsapp`, `utm_medium=email`, and `utm_campaign=drj-private-qa` journey retained all three values on the resumed checkout URL.

## Commerce and provider readback

| Offer | Woo | Price/rail | LearnDash | State |
| --- | --- | --- | --- | --- |
| Interview Week | `5504/5867` | $549 Stripe; $499 Zelle | `3646` | purchasable, mapped, accepted |
| IV Prep Complete | `3576/5865` | $3,099 early card | `5227` | purchasable, mapped, accepted |

- Stripe gateway: enabled.
- BACS/Zelle gateway: enabled, runtime-filtered to the one exact eligible Interview Week cart.
- Founder financial status remains `WAIVED BY FOUNDER / NOT EXECUTED`; `passed` remains false under DR-296.
- No product price, stock, mapping, order, payment, refund, user, entitlement, coupon, or historical record was mutated by this run.
- Latest Woo order remained `9102` before and after the non-financial tests.

## Unrelated work preservation

The pre-existing dirty state was neither staged nor committed:

- three modified B Immersive final-resume report files;
- `Claude outputs/`;
- `AAA_CORRECTION_V2/`;
- `AAA_MASTERING/`;
- `WARM_AUDIENCE_AAA/`.

The source commit contains only the three access-gate production files and its focused unit harness.

## Rollback readiness

Rollback is source-only because this release made no WooCommerce, LearnDash, order, payment, entitlement, or user data mutation. Under a fresh narrow lease, restore the three preimages from source commit `36aaa2fbfab507003926783b870d0079689eb7a9`, purge Kinsta cache, and re-read hashes/routes. See `ROLLBACK.md`.

## Remaining external/manual boundaries

- The exact Saturday transition is proven by the production time-injection seam but cannot be observed in real wall-clock time until Sep 19 at noon ET.
- Live Stripe financial acceptance remains Founder-waived and was not executed; it is not recorded as PASS.
- This execution contains builder verification and production readback. No new independent-verifier session was requested or performed for this bounded access-only release.

## Production URLs

- `https://missionmedinstitute.com/mission-residency/`
- `https://missionmedinstitute.com/mission-residency-courses/`
- `https://missionmedinstitute.com/product/iv-prep-masterclass/`
- `https://missionmedinstitute.com/product/match-prep-pro/`
- `https://missionmedinstitute.com/cart/`
- `https://missionmedinstitute.com/checkout/`

## STATE DELTA

- Canonical authority: DR-299 added and registered; no global policy weakened.
- Source: three production files changed in commit `8d620206d055cc9044cda8ddbba27a29d36341bd`; one focused unit harness added.
- Production: the same three files deployed with exact hash parity; targeted cache purged.
- Customer journey: public browsing preserved; enrollment-only private gate active until the exact public-open instant; access persists and resumes the intended offer.
- Commerce: prices, products, mappings, rails, inventory, bindings, and Founder financial waiver unchanged.
- Data: zero orders, payments, refunds, users, entitlements, coupons, or product records changed.
