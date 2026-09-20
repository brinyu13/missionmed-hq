# DRJ-EXAMPREP-0920B — Controlled $1 Subscription Payment Test

**Status:** WAITING FOR FOUNDER CARD ENTRY

- Founder request: create a `$1.00` initial payment for product 6360 while preserving the normal `$99.99/month` renewal, then verify and cancel the subscription after payment.
- Human boundary: Codex will not enter, request, store, or expose card data. The Founder must submit the prepared checkout and reply `Paid`.
- Coupon: `DRJTEST1-DAILY-0920A`, Woo coupon ID 9135, published with usage `0/1`, expiring `2026-09-21T01:39:28Z`.
- Safety: initial-payment-only, product 6360 only, individual use, one total use, one use per user, short expiry.
- Cleanup after payment: verify Stripe/Woo order, webhook/subscription, and entitlement; cancel future renewals; draft/revoke the coupon; preserve the paid parent order.
- Server calculation: initial total `$1.00`; recurring cart `$99.99/month`; no coupon present in the recurring cart.
- Browser checkout: product `Drills: Daily Rounds Access`, `$1.00` total today, `$99.99/month` recurring, first renewal October 20, 2026, LIVE Stripe card fields loaded, terms unchecked, order not submitted.
- Money moved so far: `0` cents.
- Continuation trigger: Founder enters billing/card details, accepts terms, clicks `START MY MEMBERSHIP`, then replies `Paid`.
