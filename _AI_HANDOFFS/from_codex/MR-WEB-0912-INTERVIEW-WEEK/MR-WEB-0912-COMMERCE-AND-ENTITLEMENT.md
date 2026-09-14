# MR-WEB-0912 Commerce and Entitlement Matrix

Current through: 2026-09-14 12:48 UTC

Status: **CORE CARD OFFERS ACTIVE; OPTIONAL RAILS FAIL-CLOSED**

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

## Active production objects

| Offer | Woo object | Price | LearnDash | Checkout state |
|---|---|---:|---:|---|
| IV Prep Essentials: Interview Week | parent 5504 / variation 5867 | $500 | 3646 | in stock, sold individually, purchasable, Stripe/card active |
| IV Prep Complete early card PIF | parent 3576 / variation 5865 | $3,099 through Sep 23 | 5227 | in stock, sold individually, purchasable, Stripe/card active |
| IV Prep Complete standard anchor | parent 3576 / variation 5865 | $3,499 regular | 5227 | regular-price anchor; sale expires Sep 23 11:59:59 PM EDT |

The two acceptance timestamps are `2026-09-14T12:03:20Z`, re-issued after the
single-seat correction. Each stored binding
is recomputed from the exact product, variation, current price, course, related-
course mapping, parent relationship, DR-251, and
`waived_by_founder_not_executed` financial status.

Complete includes Interview Week. Checkout never creates a separate $500 item
or charge for a Complete selection, and mixed Interview Week + Complete carts
are rejected in both directions.

Guest checkout is disabled and checkout account creation/login is enabled.
Although Woo has other global gateway registrations, a cart containing either
MR-WEB-0912 product receives only the official `stripe` gateway.

## Fail-closed paths

| Path | Final state | Reason |
|---|---|---|
| Complete early Zelle PIF $2,799 | unavailable | manual/BACS lifecycle not verified |
| Complete installments $3,299 | unavailable | cadence and mechanism not approved |
| Dr J additional $100 | unavailable | coupon eligibility and stacking not verified |
| Interview Week $500 standard-tuition credit | unavailable | deterministic, single-use, order-derived, refund-safe mechanism absent |
| Unverified logistics/claims | unavailable | no approved exact times, capacity, replay, mock-count, or refund evidence |

An old draft $100 coupon was not activated or repurposed. The 360 parent 3575
and variations 5862/5863 remain out of stock.

## Mapping, onboarding, and guard readback

- 5504 and 5867 map exactly to LearnDash `[3646]`.
- 3576 and 5865 map exactly to LearnDash `[5227]`.
- Course 3646 raw/filtered title is
  `IV Prep Essentials: Interview Week`; onboarding body present.
- Course 5227 raw/filtered title is `IV Prep Complete`; onboarding body present.
- No matching Calendar/Webex object or approved exact evening time exists.
- Cross-wired parent/variation pairs and parent-only variable-product requests
  show `This enrollment selection is not valid.` and leave the cart empty.
- Both mixed-cart directions preserve the first valid offer and reject the
  second with the Complete-includes-Interview-Week notice.
- Both parents and target variations are sold individually. Direct quantity-two
  requests fail closed, and an unsafe stale non-unit cart exposes no payment
  gateway.

## Acceptance truth

- Product/course/source readback: 13/13 PASS.
- Waiver-aware activation verification: 16/16 PASS.
- Non-payment entitlement/refund simulation: 22/22 PASS.
- Real cart and checkout rendering: both prices, exact identities, Stripe-only
  rail, account creation, and policy links PASS at 1440/1024/390.
- Direct/stale/mixed/quantity cart guard suite: 8/8 PASS.
- No Place order action was invoked.
- Independent non-financial production acceptance: ACCEPTED, including a
  retest of the original stale Complete quantity-two session with zero payment
  gateways and no Place Order control.

The 22/22 simulation and prior Mission Residency P0 transaction history support
the stack design, but neither is recorded as MR-WEB-0912 live financial
acceptance. The actual live Stripe charge, paid Woo order, entitlement,
immediate refund, and revocation lifecycle remains Founder-waived and was not
performed.

## Containment

If either offer's bound runtime facts drift, its computed checkout eligibility
fails closed. The activation controller's `disable` mode clears both acceptance
pairs and waiver options and closes both target parents/variations. A narrower
incident can clear and close only the affected offer. Exact object/source
preimages and the MyKinsta recovery point remain available.
