# MR Recovery Campaign — Opus/Fable Implementation Handoff

## Scope

Targeted choice/CTA recovery only. Do **not** perform a full landing-page or email redesign. Do **not** send from this handoff without separate send authority and final recipient review.

## Final production truth

### Primary: Interview Week

- Name: IV Prep Essentials: Interview Week.
- Card: `$549`.
- Zelle: `$499`.
- Orientation: Thursday, October 8.
- Day 1: Sunday, October 11, 11 AM–4 PM ET.
- Day 2: Tuesday, October 13, evening; exact hours confirmed with enrollment.
- Day 3: Thursday, October 15, evening; exact hours confirmed with enrollment.
- Day 4: Saturday, October 17, 11 AM–4 PM ET.
- Day 5 / Final: Sunday, October 18, full day; exact hours confirmed with enrollment.
- URL: <https://missionmedinstitute.com/product/iv-prep-masterclass/>

### Secondary: IV Prep Complete

- Recovery PIF: `$3,099` through October 7, 2026.
- Standard PIF: `$3,499`.
- Payment plan: `$1,000` today plus six monthly payments of `$400`; `$3,400` total.
- Complete includes Interview Week. Never imply that Complete costs `$3,099 + $549`.
- Complete Zelle is the same applicable PIF tuition; there is no separate Zelle discount.
- URL: <https://missionmedinstitute.com/product/match-prep-pro/>

### Funnel

- Landing: <https://missionmedinstitute.com/mission-residency/>
- Comparison: <https://missionmedinstitute.com/mission-residency-courses/>
- The public funnel is open. No DRJ2026 code is required or requested.
- Preserve: landing → rich product page → explicit payment choice → protected checkout.

## CTA hierarchy

1. Primary CTA: Interview Week.
2. Secondary CTA: Complete for the full interview season.
3. Keep the choice simple: live foundation versus foundation plus ongoing practice/support.
4. Make “Complete includes Interview Week” explicit near every Complete price/CTA.

## UTM-ready links

### Interview Week primary

`https://missionmedinstitute.com/product/iv-prep-masterclass/?utm_source=drj&utm_medium=email&utm_campaign=mr_recovery_2026_09_28&utm_content=interview_week_primary`

### Complete secondary

`https://missionmedinstitute.com/product/match-prep-pro/?utm_source=drj&utm_medium=email&utm_campaign=mr_recovery_2026_09_28&utm_content=complete_secondary`

For WhatsApp, waitlist, or general audiences, use a truthful `utm_source`/`utm_medium` while keeping the approved campaign and offer-specific `utm_content`. Never put a recipient name, email, phone number, or student ID in UTMs.

## Measurement contract

Production implements offer-specific `view_item`, standard Woo/Site Kit `add_to_cart`, `begin_checkout`, CTA/offer/rail/destination parameters, UTM preservation, paid-order-only deduplicated `purchase`, and distinct `refund`. Woo is financial truth. Do not invent performance claims from GA4 before property-side receipt is confirmed.

## Prohibited drift

- No DRJ2026 exclusivity or code-entry language.
- No Sep 26 deadline.
- No obsolete Oct 1/4/6/8/10/11 schedule mapping.
- No `$2,799` Complete Zelle price.
- No `$3,399` or `$399.84` installment language.
- No separate `$549` charge for Complete.
- No invented evening hours, mock counts, group capacity, replay entitlement, refund promise, or outcome claim.
- Preserve approved testimonials, Dr Brian voice, logos, and Fable presentation.
