# MR-WEB-0912 Foreman production QA

QA date: 2026-09-21. Final responsive/non-financial evidence was generated at `2026-09-21T12:36:06.641Z`; analytics evidence was generated at `2026-09-21T12:38:12.866Z`. The QA sweep did not submit payment. Controlled live payment evidence is recorded separately in `FINANCIAL_ACCEPTANCE.md`.

## Journey

- Landing offer actions open the private-access interstitial before public opening and retain the intended offer/destination.
- Accepted private access persists for the browser journey.
- Complete lands on canonical `/product/match-prep-pro/`, not checkout.
- Interview Week lands on canonical `/product/iv-prep-masterclass/`, not checkout.
- Product pages then expose the exact payment choices and only those payment actions proceed to Woo checkout.
- Canonical destinations preserve `utm_source`, `utm_medium`, and `utm_campaign`; a live `drj/email` round trip was observed on both product routes.

## Product pages

Complete renders Interview Week included/no separate charge; Pre-IV Checkups; Post-IV Debriefs; recurring group practice; Signature Mock pathway; Rx Replays; season support; Guarantee terms; six Interview Week dates; full-season calendar; Dr Manasa and Dr Marian proof; FAQ; $3,099/$3,499 PIF; $1,000 + 6 x $400 installment choice; and same-price PIF Zelle.

Interview Week renders the live foundation, curriculum, proof, FAQ, October 1/4/6/8/10/11 schedule, $549 card, and $499 Zelle.

## Non-financial commerce acceptance

| Path | Rendered production result |
|---|---|
| Complete card | Variation `5865`; total `$3,099`; Stripe card control rendered |
| Complete installments | Variation `5873`; `$1,000` due today; `$400/month for 6 months`; contractual total `$3,400`; Stripe subscription control rendered |
| Complete Zelle | Variation `5865`; `$3,099`; no discount; BACS selected; on-hold/no-access warning rendered |
| Interview Week card | Variation `5867`; total `$549`; Stripe card control rendered |
| Interview Week Zelle | Variation `5867`; total `$499`; BACS selected; on-hold/no-access warning rendered |

Mixed-cart protection correctly stopped an unrelated Daily Rounds cart and required an explicit replace-cart confirmation. The temporary QA cart was empty at the end. No Place Order/Start Membership action was submitted. Recent Woo readback showed no MR product order created by this QA; other concurrent orders were unrelated product `6360` and were untouched.

## Access and transitions

- Current anonymous runtime: `private_early_access`, required, DR-325, no public code disclosure, no backend seat cap.
- Anonymous direct add-to-cart returned `303` to the access prompt with a signed resume token and the selected checkout destination.
- Synthetic read-only clock at `2026-09-22 12:00:01 America/New_York`: `public_open`, `required=false`.
- Synthetic price clock after September 26: computed PIF `$3,499`.
- Woo variation `5865` stores regular `$3,499`, sale `$3,099`, sale end `2026-09-27T03:59:59Z` (September 26 11:59:59 PM ET).

## Responsive acceptance

Landing and both rich product pages passed at 1440, 1024, and 390 pixels with no horizontal overflow. Enrollment/payment controls were at least 48 pixels high on mobile. The mobile landing navigation was corrected to a clean 3-by-2 grid. Cart, pre-checkout, and checkout had no MissionMed “use desktop” warning after the targeted pre-checkout containment correction. The pre-checkout/checkout route remained usable at 390 pixels.

The persistent `CART` control is visible on the landing page, both product pages, cart, and checkout at all three viewports. It is fixed inside the viewport, links to `/cart/`, has a minimum 44-pixel tap target, shows `0` before selection and `1` after a protected offer reaches checkout, and introduces no horizontal overflow.

## Analytics

- Fresh readback loaded the Google tag bootstrap on landing, both canonical product pages, and checkout/cart.
- Main-world `dataLayer` contained the page, scroll, CTA, and upsell events, including `mr_cta_click` and `mr_upsell_shown`.
- Fresh live GA4 collector requests returned for measurement ID `G-B4B4E26HMW` on landing, Complete, Interview Week, and checkout/cart; the tested `foreman/qa/final` UTM location was present on landing and product page-view requests.
- UTM parameters survived landing to canonical Complete and Interview Week product routes.

## Runtime/mappings

- Interview Week: parent `5504`, variation `5867`, course `3646`, `$549`, mapping/parent/eligibility/checkout all true.
- Complete PIF: parent `3576`, variation `5865`, course `5227`, `$3,099` current, mapping/parent/eligibility/checkout all true.
- Complete installments: parent `5513`, variation `5873`, course `5227`, `$1,000` signup + `$400` recurring x 6, checkout true.

## Known non-blocking observations

- Existing WP CLI early text-domain notices continue.
- Checkout still contains legacy Woo shipping/address, account-password, order-note wording, and a separate optional Arena pre-checkout step. These were outside this date/product-journey correction and do not change the verified prices, products, mappings, or payment rails.
- Existing Stripe plugin code logs a non-fatal express-checkout initialization error on non-checkout custom product shells; the real checkout card controls rendered.
- Interview Week's real `$0.50` Stripe → Woo → account → LearnDash `3646` → refund → revocation lifecycle passed and is contained.
- Complete's real `$0.50` Stripe → Woo → account → LearnDash `5227` → refund → revocation lifecycle passed and is contained; no separate Interview Week item or charge was present.
- Final automation result: `FINAL_PRODUCTION_QA_ASSERTIONS=PASS`; analytics result: `ANALYTICS_LIVE_QA_ASSERTIONS=PASS`.
