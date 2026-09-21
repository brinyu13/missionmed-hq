# Final Enrollment Architecture

## Buyer flow

`/examprep/courses/` → choose a path → product page → Woo cart → checkout → Stripe → Woo order/subscription → entitlement reconciliation → purchase-aware confirmation.

The enrollment page is a shared visual shell supplied by `missionmed-examprep-enrollment.php`. It does not replace Woo product/order authority. Prices, products, cart calculations, subscriptions, and entitlements remain server-side WooCommerce truth.

## Page hierarchy

1. MissionMed ExamPrep hero.
2. Accessible tabs for Live Training, On-Demand, and 1-on-1.
3. Live panel with exact trial disclosure, optional Daily Rounds add-on, and Matrix schedule.
4. On-demand panel with current Daily Rounds screenshot and locked Arena Pro preview.
5. 1-on-1 panel with single session, ten-session package, and study planning.
6. Neutral comparison based on format/accountability/resources/investment.
7. Dr. J source-grounded method.
8. Sixteen decision FAQs.
9. Final path-specific CTAs.

## Sources of truth

- Prices/cadence: Woo product/subscription metadata plus `missionmed-drj-examprep-commerce.php` validation.
- Live schedule: Matrix `wp_mmed_events`, system-owned and active Dr. J defaults only.
- Product imagery: WordPress attachments `9136` (Daily Rounds) and `9137` (Arena), supplied by the Founder.
- Method/free-trial language: source info-session and recorded-session transcripts listed in the 0921C megarun.
- Checkout/access: WooCommerce, Woo Subscriptions, LearnDash course mappings, and scoped capabilities.

## Fail-safe behavior

- Arena Pro cannot be purchased.
- Private discounted access is account-bound; a leaked code/product ID is insufficient.
- The Live add-on cannot survive without Live eligibility.
- Schedule projection omits meeting URLs, descriptions, attendees, identities, and raw metadata.
- Visual page failure does not change server price, access, or payment enforcement.
