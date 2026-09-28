# MR Zero-Enrollment Recovery — Analytics Contract

## Destination and privacy

- GA4 measurement destination: `G-B4B4E26HMW`.
- Woo remains the financial source of truth.
- No name, email, phone, account ID, payment detail, private-access code, or other PII is included by the recovery events.
- QA traffic can be distinguished through QA UTM values used by the acceptance harness.

## Event contract

| Event | Trigger | Required identity |
|---|---|---|
| `view_item_list` | Mission Residency landing offer list | item/variation IDs, offer identity, current price, UTM |
| `view_item` | rich Interview Week or Complete product page | item/variation ID, offer identity, current price, UTM |
| `add_to_cart` | Woo add-to-cart | standard Site Kit/Woo payload; no duplicate custom event |
| `begin_checkout` | protected checkout renders with a supported offer | cart items, offer, destination `/checkout/`, UTM |
| `mr_offer_cta_click` | offer/payment-choice CTA | offer, CTA location, intended rail, destination, price, UTM |
| `mr_payment_method_selected` | checkout rail selection changes | offer, `card` or `zelle`, destination, value |
| `purchase` | Woo thank-you page for a paid order only | Woo order ID as `transaction_id`, value/currency/items/payment type/UTM |
| `refund` | customer order detail where refunded total is positive | same Woo order ID, refunded value/currency/items/UTM; never a purchase |

`purchase` and `refund` use separate session-storage dedupe keys. `purchase` cannot fire for an unpaid order. `refund` cannot create a second purchase.

## Attribution fields

- `offer`: `interview_week`, `complete`, or `complete_installment`.
- `cta_location`: the originating content/choice location when available.
- `rail`: `card` or `zelle`.
- `destination_path`: normalized target path.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`: preserved from the entry journey.

## Recovery campaign UTMs

### Primary Interview Week

`utm_source=drj&utm_medium=email&utm_campaign=mr_recovery_2026_09_28&utm_content=interview_week_primary`

### Secondary Complete

`utm_source=drj&utm_medium=email&utm_campaign=mr_recovery_2026_09_28&utm_content=complete_secondary`

Use the same campaign/content semantics for waitlist/general/WhatsApp distribution, changing only the truthful source/medium. Do not place recipient identity in any UTM.

## Verification result

- Product and checkout `dataLayer` events: PASS.
- UTM carry into offer and checkout payloads: PASS.
- GA4 page-view requests to `G-B4B4E26HMW`: observed.
- Property-side GA4 Realtime receipt for every custom ecommerce event: UNVERIFIED in this run; no GA4 Admin mutation was made.
- Custom dimensions in the GA4 UI for offer/CTA/rail/destination: not altered. The event parameters are present for later bounded registration if MissionMed analytics governance requires reporting dimensions.
- Independent review saw both a structured `dataLayer` payload and a `gtag('event', ...)` command for some product-view instrumentation. It did not observe duplicated GA4 network receipts, but property-side count validation is required before interpreting campaign conversion totals.
