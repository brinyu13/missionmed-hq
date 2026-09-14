# MR-WEB-0912 Commerce and Entitlement Matrix

Current through: 2026-09-14 02:39 UTC

Status: **MR-WEB-0912 PRODUCTION = BLOCKED** pending the exact $1.00
minimum-charge authorization and controlled live acceptance.

## Woo and entitlement objects

| Offer | Exact object | Current production state | Activation guard |
|---|---|---|---|
| Interview Week | parent 5504 / variation 5867 / course 3646 | `IV Prep Essentials: Interview Week`; $500; published but out of stock; exact mapping `[3646]` | Requires its own live acceptance timestamp and binding plus exact runtime price, parent, mapping, stock, and purchasability checks |
| Complete | parent 3576 / variation 5865 / course 5227 | `IV Prep Complete`; $3,099 early card price; $3,499 regular anchor; published but out of stock; exact mapping `[5227]` | Requires its own live acceptance timestamp and binding plus time-appropriate price, parent, mapping, stock, and purchasability checks |
| 360 | parent 3575 / variations 5862, 5863 / course 3893 | $5,499 published reference; out of stock | Preserved closed and outside MR-WEB-0912 activation |

Guest checkout is disabled and checkout account/login is enabled. Direct
add-to-cart URLs, stale carts, inactive offers, and carts containing both
Interview Week and Complete are rejected server-side. Complete includes
Interview Week and must not create a second charge.

## Payment and adjustment paths

| Path | Authority amount | Current evidence | Production state |
|---|---:|---|---|
| Interview Week card | $500 | Product/mapping/price readback PASS; non-payment entitlement lifecycle PASS; live $0.50 acceptance not run | fail-closed |
| Complete early card PIF | $3,099 | Product/mapping/price readback PASS; non-payment entitlement lifecycle PASS; live $0.50 acceptance not run | fail-closed |
| Complete standard | $3,499 | Regular-price anchor configured; no separate live transaction required during early window | display/expiry anchor; fail-closed with offer |
| Complete early Zelle PIF | $2,799 | BACS/Zelle disabled; no operational lifecycle proof | unavailable |
| Complete installments | $3,299 total | No approved cadence, mechanism, or lifecycle | unavailable |
| Dr J alumni | additional $100 | Old draft coupon is not safely scoped or stacking-proven | unavailable |
| Interview Week credit | $500 toward standard Complete only | No deterministic, single-use, order-derived, refund-safe implementation | unavailable |

The card path uses the official Stripe gateway in live mode with only card
enabled. The account is US/USD with charges enabled and card-payments active.
Woo taxes are disabled. WooPayments and BACS are disabled.

## Entitlement and onboarding readback

- 5504/5867 maps exactly to LearnDash 3646.
- 3576/5865 maps exactly to LearnDash 5227.
- Course 3646 raw and filtered title:
  `IV Prep Essentials: Interview Week`; onboarding body present; zero steps.
- Course 5227 raw and filtered title:
  `IV Prep Complete`; onboarding body present; zero steps.
- No matching Calendar/Webex object exists.
- No approved exact evening time exists, so no time was invented.
- Non-payment grant/refund/reorder harness: 22/22 PASS.

## Controlled live-card acceptance

Stripe's verified minimum for the current USD/card configuration is $0.50.
The accepted design therefore uses two sequential $0.50 charges, one for each
actual product identity, for an aggregate temporary charge of $1.00.

The private authenticated controller records the real public line subtotal but
sets only the controlled order line total to $0.50. It never changes a product
price and creates no coupon, public route, or public filter. For each offer it
must prove:

1. exact product, variation, account, public subtotal, $0.50 line total, and no
   coupon, fee, tax, shipping item, or second product;
2. successful buyer login and a live Stripe USD/card charge;
3. Woo paid-order state and correct LearnDash entitlement/counter;
4. unrelated-course exclusion;
5. immediate idempotent Stripe refund and native Woo full refund;
6. correct entitlement revocation with unrelated access preserved;
7. removal of temporary-login metadata, every WordPress session, private URLs,
   and any Woo payment token.

Refund containment proceeds even if an acceptance assertion fails. The overall
verdict remains FAIL unless both paid acceptance and post-refund containment
pass. The state machine supports safe retry after Stripe has refunded but Woo
has not yet recorded the refund.

Current controller SHA-256:
`3ee54ba3417efb26cf7d413861fa3b4c5aa8c4a1d45c48556cc996b25be89c0d`.
Independent source/design review: PASS. Live preflight: 14/14 PASS. No controlled
order, subscriber, private live-card manifest, or charge exists.

## Authorization gate

Do not create the controlled orders or initiate payment until the Founder says:

> I authorize two $0.50 live Stripe charges, totaling $1.00, followed by
> immediate refunds.

`execute prompt` does not name the financial total and is not sufficient.

## Per-offer activation rule

After authorization, run Interview Week and Complete sequentially. Hard-stop
and keep the affected offer closed on any failure. After both terminal refunds,
separately prove public product data, rendered prices, direct-cart totals, and
checkout totals at $500 and $3,099 without another charge. Activate only the
offer whose entire lifecycle passes, then perform logged-out rendered QA and
fresh independent production acceptance.

Optional Zelle, installments, alumni coupon/stacking, upgrade credit, and
unapproved session logistics remain independently fail-closed. If DR-246/247
permits partial activation, they do not block a fully proven card offer.
