# DRJ-EXAMPREP-0920B — Controlled $1 Subscription Payment Test

**Status:** LIVE VISUALS COMPLETE; WAITING FOR FOUNDER CARD ENTRY

- Founder request: create a `$1.00` initial payment for product 6360 while preserving the normal `$99.99/month` renewal, then verify and cancel the subscription after payment.
- Human boundary: Codex will not enter, request, store, or expose card data. The Founder must submit the prepared checkout and reply `Paid`.
- Coupon: `DRJTEST1-DAILY-0920A`, Woo coupon ID 9135, published with usage `0/1`, extended after its unused first window to `2026-09-21T06:54:18Z`.
- Safety: initial-payment-only, product 6360 only, individual use, one total use, one use per user, short expiry.
- Cleanup after payment: verify Stripe/Woo order, webhook/subscription, and entitlement; cancel future renewals; draft/revoke the coupon; preserve the paid parent order.
- Server calculation: initial total `$1.00`; recurring cart `$99.99/month`; no coupon present in the recurring cart.
- Browser checkout: product `Drills: Daily Rounds Access`, `$1.00` total today, `$99.99/month` recurring, first renewal October 20, 2026, LIVE Stripe card fields loaded, terms unchecked, order not submitted.
- Money moved so far: `0` cents.
- Continuation trigger: Founder enters billing/card details, accepts terms, clicks `START MY MEMBERSHIP`, then replies `Paid`.

## Supplied Arena / Daily Rounds visuals

- Arena mapping: supplied `image-1.png`, source SHA-256 `e00bf02ccebd3e2166600f391cb8e24fd030d652f586cbaef9665602ef67438a`, WordPress attachment 9137, assigned to Woo product 9017 and the locked Arena Pro pricing card.
- Daily Rounds mapping: supplied `image-2.png`, source SHA-256 `453098b43f88a23cab1477388bd33b7f87bc8b1ae93605f213eb4bee22efa18e`, WordPress attachment 9136, assigned to Woo product 6360 and the Daily Rounds pricing card.
- WPCode snippet 5973 readback SHA-256: `ac9495fe877db13d847a1b41004f4b82232d2c83c520b4a9e2f787c42d5ffb15`; active-snippet cache readback contains both image variants.
- Live page: `/examprep/courses/` now renders the Daily Rounds player screenshot with an `On-Demand` label and the Arena lobby screenshot inside the disabled/locked Arena Pro card.
- Desktop acceptance: both images loaded at 1024×662 responsive variants; card links and locked state remained correct; document `clientWidth=1280`, `scrollWidth=1280`.
- Mobile acceptance: 390×844 emulation; all pricing cards `342px` wide at `x=24`, both responsive images loaded, document `clientWidth=390`, `scrollWidth=390`.
- Provider rollback preimage: `/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0920B/visuals-preimage-20260921-045833.json`.
- Coupon-extension rollback preimage: `/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0920B/coupon-extension-preimage-20260921-045418.json`.
