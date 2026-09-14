# MR-WEB-0912 Claims and QA Evidence

Current through: 2026-09-14 12:48 UTC

Status: **ACTIVATION-CRITICAL CUSTOMER QA PASS**

## Customer-facing truth

| Claim | Production treatment |
|---|---|
| Interview Week is $500 | displayed on campaign, product, cart, and checkout |
| Complete standard tuition is $3,499 | displayed as the regular anchor |
| Complete early card PIF is $3,099 through Sep 23 | displayed and enforced by Woo sale price/end date |
| Complete includes Interview Week | stated explicitly; mixed carts blocked |
| Complete does not add another $500 | stated explicitly and protected server-side |
| Zelle $2,799 | not rendered or available |
| Installments $3,299 | not rendered or available |
| Dr J additional $100 | not rendered or available |
| $500 standard-price upgrade credit | not rendered or available |
| Exact evening times | omitted; no time invented |
| Capacities, replay, mock-count, refund, scarcity, guarantee claims | omitted unless verified |
| `142 alumni matched`, MatchFirst, prior product names/prices | removed from active public rendering |

No internal QA/governance language or `Enrollment opens after verification`
placeholder remains on the activated funnel. No OUT OF STOCK message leaks into
the curated funnel. The mobile desktop-warning banner is absent on campaign,
product, cart, and checkout routes. The homepage no longer sends prospects to
the stale waitlist; the legacy waitlist route redirects to current Mission
Residency.

## Final responsive acceptance

The fresh logged-out production sweep ran after the final bounded single-seat
source and runtime correction at 2026-09-14 12:08:58 UTC.

| Surface group | 1440 | 1024 | 390 |
|---|---:|---:|---:|
| Homepage | PASS | PASS | PASS |
| Mission Residency | PASS | PASS | PASS |
| Comparison aliases | PASS | PASS | PASS |
| Interview Week current/legacy aliases | PASS | PASS | PASS |
| Complete current/legacy aliases | PASS | PASS | PASS |
| Cart and checkout boundaries | PASS | PASS | PASS |
| Legacy waitlist redirect | PASS | PASS | PASS |
| Terms/refund/privacy | PASS | PASS | PASS |

- Public route/viewport cases: 45/45 PASS.
- Real offer checkout render cases: 6/6 PASS.
- Combined result: 51/51 PASS.
- Direct/stale/mixed/quantity cart guard cases: 8/8 PASS.
- No horizontal overflow was observed.
- No payment was submitted.
- Independent non-financial production acceptance: ACCEPTED; the verifier
  separately confirmed the 390px customer state and both quantity-two denials.

Each checkout case verified exact item identity and total, a single `stripe`
payment method, rendered Stripe Elements, account creation, Place order control,
and terms/refund/privacy links. The Place order control was never clicked.
Both products and target variations are sold individually; direct quantity-two
requests fail closed, and stale non-unit carts have no available payment
gateway.

## Analytics

Browser network evidence observed:

- Google tag loader `GT-PJ7SPCWF`;
- GA4 collection ID `G-B4B4E26HMW`;
- requests on homepage, Mission Residency, and both offer checkout paths;
- checkout analytics at desktop, tablet, and mobile widths.

## Scope boundary

This run completed only activation-critical CRO/customer-safety work directly
required by MR-WEB-0912. It did not start a whole-site or Fable CRO redesign.
The dedicated Fable closure/re-audit follows the final rendered production
state from this release.

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

The rendered/cart/checkout QA proves non-financial production behavior only. It
does not prove that a real card payment, paid-order entitlement, refund, or
revocation occurred for this release.
