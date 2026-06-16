# MM-LAUNCH Price Decision Required

Ticket: `MM-LAUNCH-SEV1-002-MEGARUN`

Date: 2026-06-15

## Decision Type

Pricing architecture and WooCommerce product governance. This is not a request to change the SEV1-002 early-season prices.

## Confirmed Pricing Lock

| Program | Early Enrollment | Regular / High Season |
| --- | ---: | ---: |
| IV Prep Essentials | `$1,499` | `$1,699` |
| Match Prep Pro | `$2,799` | `$3,749` |
| 360 Match Mentorship | `$3,999` | `$5,499` |

## Current Woo Findings

Woo Store API currently matches early-season pricing for the three main products:

- Product `5504`: `IV Prep Complete Masterclass`, `$1,499`.
- Product `3576`: `Match Prep Pro`, `$2,799`.
- Product `3575`: `360 Match Mentorship`, `$3,999`.

Open issue:

- Product `3577`: `Interview Prep Foundation`, `$499`, remains publicly exposed.
- IV product name in Woo is still legacy: `IV Prep Complete Masterclass`.
- Woo `regular_price` and `sale_price` appear equal to early price for main products, so Woo is not modeling the July 1 increase as regular-vs-sale pricing.

## Decisions Needed Before Woo/Admin Changes

1. Should Woo main products use regular/high-season values as `regular_price` and early-season values as `sale_price`, or should Woo remain at early-season prices until July 1?
2. Should the legacy `Interview Prep Foundation` product be hidden, redirected, renamed, or left available for a specific legacy workflow?
3. Should payment-plan products be recalculated from early-season prices, regular prices, or separate written enrollment terms?
4. Should IV product ID `5504` be renamed in Woo from `IV Prep Complete Masterclass` to `IV Prep Essentials`, or is that product title coupled to historical orders/reporting?
5. Should MatchFirst pricing be visible on product pages, limited to strategy-call approval, or handled through manual invoices only?

## Safe Current Action

The source-controlled mu-plugin only changes visible presentation copy and CTA routing. It does not change WooCommerce product data, checkout totals, gateways, orders, users, or payment plans.

