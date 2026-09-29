# MR-WEB-0912 Bootcamp + Early-Coverage Production QA

Generated: 2026-09-28/29 ET (final evidence timestamp `2026-09-29T00:20:03.296Z`).

## Scope and method

- Anonymous isolated Chrome contexts.
- Viewports: `1440x1000`, `1024x900`, `390x844`.
- Routes: homepage, Mission Residency landing, Interview Bootcamp Week product, IV Prep Complete product, comparison, cart/mixed-cart guard, and five checkout configurations.
- Checkout POST / Stripe confirmation requests were blocked in the harness.
- **No payment was submitted. No order was created by QA.**

Primary machine-readable evidence: `evidence/BOOTCAMP_PRODUCTION_QA.json`.

Twenty-three full-page PNGs are under `evidence/screenshots/` (five route surfaces and the opened enrollment intercept at each of three viewports, plus five checkout configurations).

## Responsive route matrix

All tested routes returned HTTP 200 at all three viewports. For landing, Bootcamp product, Complete product, and comparison:

- `Interview Bootcamp Week` visible: PASS.
- early-interview protection visible and semantically accurate: PASS.
- inclusive `on or before Oct/October 18` cutoff: PASS.
- exact current dates and prices: PASS.
- Complete inclusion / no separate charge: PASS.
- no current stale exact `Interview Week`: PASS.
- no internal QA, verification, DRJ2026, out-of-stock, MatchFirst, desktop-warning, or `142 alumni` leakage: PASS.
- horizontal overflow: none.
- page-level JavaScript errors: none.
- persistent fixed CART control: present, visible, points to `/cart/`, and meets the 44px minimum tap target.

The final harness opened the Bootcamp-choice intercept at all three widths. The modal showed `INTERVIEW BOOTCAMP WEEK`, contained the Complete-inclusion explanation, and contained no exact stale `INTERVIEW WEEK`; PASS.

The homepage renders the new offer name and remains free of stale/forbidden copy. The detailed early-interview callout is intentionally placed on the Mission Residency landing and both rich product journeys rather than repeated on the general institutional homepage.

## Checkout/readback matrix (no submission)

| Path | Product shown | Total shown | Gateway state | Result |
|---|---|---:|---|---|
| Bootcamp card | `IV Prep Essentials: Interview Bootcamp Week - Session D...` | `$549.00` | Stripe selected; Zelle available | PASS |
| Bootcamp Zelle | same product identity | `$499.00` | Zelle selected; Stripe available | PASS |
| Complete card | `IV Prep Complete - Session D...` | `$3,099.00` | Stripe selected; Zelle available | PASS |
| Complete Zelle | same Complete identity | `$3,099.00` | Zelle selected; Stripe available | PASS |
| Complete installments | `IV Prep Complete - Payment Plan - Session D...` | `$1,000.00` today; `$400.00/month` for 6 months | Stripe selected | PASS |

Every checkout showed Terms and Refund Policy links, no private-access prompt, no overflow, no forbidden copy, and the persistent CART control.

Mixed-cart regression check: one product row remained and the guard displayed `Choose either Interview Bootcamp Week or IV Prep Complete`; PASS.

## Live Woo / LearnDash readback

| Object | Type | Public price/state | LearnDash | Customer-facing copy |
|---|---|---|---:|---|
| 5504 | variable parent | `$549`, published, in stock, purchasable | 3646 | `IV Prep Essentials: Interview Bootcamp Week` |
| 5867 | variation | `$549`, published, in stock, purchasable | 3646 | Bootcamp Session D title |
| 3576 | variable parent | current `$3,099`, published, in stock, purchasable | 5227 | `IV Prep Complete` |
| 5865 | variation | regular `$3,499`, sale/current `$3,099`, published, in stock, purchasable | 5227 | Complete Session D |
| 5513 | subscription parent | published, in stock, purchasable | 5227 | Complete Payment Plan |
| 5873 | subscription variation | `$400/month`, published, in stock, purchasable | 5227 | Complete Payment Plan Session D |

No scoped object contained old visible `Interview Week` copy. Slugs and mappings remained unchanged.

## Analytics continuity

- GA4 collection observed against `G-B4B4E26HMW`.
- `view_item_list`, `view_item`, `add_to_cart`, `begin_checkout`, and `mr_payment_method_selected` appeared as appropriate, with GTM DOM/load signals.
- Durable item IDs remained `5867`, `5865`, and `5873`; `item_name` for 5867 changed naturally to the new display name.
- Internal variant key `interview_week` was intentionally preserved.
- UTM parameters remained present through route and checkout journeys; no PII was added.

## Browser-visible confirmation

A separate live Chrome readback showed:

- landing title `Mission Residency | Interview Bootcamp Week & IV Prep Complete`;
- schedule callout `EARLY INTERVIEW? YOU'RE COVERED.` before the program decision;
- Bootcamp product H1 `IV Prep Essentials: Interview Bootcamp Week`;
- callout before payment choice;
- `$549` card and `$499` Zelle;
- Complete `Interview Bootcamp Week included. Never a separate charge.`;
- fixed CART control.

## Harness correction note

The first automated attempt stopped because it assumed every route had an `og:title`. The checker was corrected to record absent optional metadata as `null`; no production change was needed. A first independent review then found an old all-caps `INTERVIEW WEEK` label in the interactive enrollment modal that the initial harness did not open. Source commit `0aa0c6dc3fcfdbe65526d64dbabc6a1e34471d98` corrected that one label, and the final harness was expanded to open and grade the modal at all three widths. The completed final matrix is the evidence cited above.
