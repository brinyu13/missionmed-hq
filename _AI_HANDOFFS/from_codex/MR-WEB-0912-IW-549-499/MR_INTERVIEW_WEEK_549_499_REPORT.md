# MR Interview Week $549 Card / $499 Zelle — Final Production Report

**MR INTERVIEW WEEK $549 CARD / $499 ZELLE = LIVE AND COMMERCE-ALIGNED**

Completed 2026-09-17. No live payment was submitted.

## 1. Authority, recovery and BOOT

- DR-296 is the narrow canonical authority for this change.
- Canonical MissionMed OS commit/readback: `ea604521e24525ef21540808adc1f5017ab1cf0a`.
- Universal BOOT: PASS.
- MR-WEB-0912 BOOT: PASS.
- MissionMed HQ BOOT tip: `e71b3902f40e82e4d27813cc54aa836bc13d2c35`.
- MissionMed Institute → Live daily backup: **Sep 17, 2026, 8:09 AM**.
- MyKinsta retention shown: **14 days**.
- Restore availability: visible **Restore to** control.
- No backup was created, renamed, deleted or restored.
- Final provider readback: zero active leases.

`LIVE STRIPE FINANCIAL ACCEPTANCE = WAIVED BY FOUNDER / NOT EXECUTED`

This waiver remains explicitly not-PASS.

## 2. Exact product identities

| Offer | Woo parent | Variation | Current price | LearnDash | State |
| --- | ---: | ---: | ---: | ---: | --- |
| IV Prep Essentials: Interview Week | `5504` | `5867` | `$549` card | `3646` | published, in stock, purchasable, sold individually |
| IV Prep Complete | `3576` | `5865` | `$3,099` early card; `$3,499` regular | `5227` | published, in stock, purchasable, sold individually |

Parent, variation and exact one-course mappings passed live readback. Complete was not repriced or remapped.

## 3. Exact $549 card change

- Interview Week variation `5867` regular/current Woo price changed from `$500` to `$549`.
- Parent `5504` now derives `$549`.
- Stripe remains the default card gateway.
- Card checkout renders one exact Interview Week line item and total `$549.00`.
- No Complete item or unrelated course is added.

## 4. Exact Zelle $499 mechanism

- Existing Woo BACS rail is reused and presented as Zelle.
- Zelle appears only for one exact `5504` / `5867` item, quantity one, with no coupon or other cart item.
- Selecting Zelle changes the server-side cart item price to `$499`; it is not a generic coupon.
- Card remains `$549`; the difference is exactly `$50`.
- BACS title: `Zelle — $499 total (save $50)`.
- The order is forced to `on-hold`.
- Active LearnDash Woo policy grants only on `processing`/`completed` and explicitly denies `on-hold`, so no entitlement is granted before MissionMed verifies receipt.
- Existing private Zelle instructions were preserved byte-for-byte; SHA-256 `93136900808d44d37bb694a0150831d0f234ed70c45af77dcbbfb23cf46da80f`.
- No private destination/account details appear in this report.

## 5. Affected customer surfaces

- Mission Residency production landing page: minimum pricing-truth correction only; no Fable redesign.
- Interview Week product route and current alias/redirect.
- Mission Residency courses, compare-programs and course-comparison routes.
- Woo shop/catalog and product search.
- Cart and checkout totals/order summary.
- Stripe and Zelle gateway labels/descriptions.
- Checkout policy links and on-hold/no-access explanation.
- Current campaign configuration and CTA analytics.

Emergency remains `$3,999` request-only. 360 remains `$5,499` SOLD OUT/non-purchasable. Its intentional shop `Out of stock` badge is the only observed shop stock label; Interview Week and Complete are in stock.

## 6. Stale-price search

- Current scoped source: no `$500`, `500.00`, or stale `Save $300` customer-price match.
- Rendered customer routes: no active `$500` Interview Week price.
- Shop/catalog: Interview Week `$549`; Complete `$3,099` sale / `$3,499` regular.
- Product search: Interview Week `$549`.
- Historical orders/evidence were not rewritten.

## 7. Card-path production QA

Logged out at `1440×1000`, `1024×900`, and `390×844`:

- correct `5504` / `5867` identity;
- one line item;
- total `$549.00`;
- Stripe selected by default;
- Zelle visible only as the alternate eligible rail;
- three policy links present;
- no stale `$500`;
- no overflow;
- no payment submitted.

## 8. Zelle-path production QA

At all three viewports:

- selecting Zelle triggers Woo checkout recalculation;
- total changes from `$549.00` to `$499.00`;
- `$50` savings is visible;
- `on-hold` and no-access-before-verification language is visible;
- Stripe is not charged;
- no order is placed;
- mixed-cart attempt is rejected and the existing Interview Week line remains isolated;
- stale parent-only add-to-cart produces zero checkout line items.

Coupon stacking is fail-closed in server code: any applied coupon makes the cart Zelle-ineligible and restores the card price/gateway set.

## 9. Complete regression QA

At all three viewports:

- correct `3576` / `5865` identity;
- total remains `$3,099.00`;
- Stripe is the only available gateway;
- Zelle is absent;
- there is no separate Interview Week line item;
- the landing/comparison surfaces state that Complete includes Interview Week;
- mapping remains LearnDash `5227` only.

## 10. Analytics

Existing `dataLayer` / GTM behavior is preserved.

- Stripe selection emits `mr_payment_method_selected`, offer `interview_week`, value `549`, currency `USD`.
- Zelle selection emits the same event with payment method `bacs`, value `499`, currency `USD`.
- UTMs are preserved by the existing route implementation.
- No new analytics architecture was created.

## 11. Production source and hashes

- Final production source commit: `86f5aafef3da78b5a14a1750eb240618fc0da93d`.
- Remote branch readback matched this commit.

All production file modes are `0644`. Local/remote hashes were identical at final readback; exact hashes are recorded in the preimage/state evidence.

## 12. Rollback readiness

- Full source preimage: Git commit `e7ac74e129e23e501cfdfd74c36c616162f83458`.
- Provider-object preimages and hashes: `PREIMAGE_LEDGER.md`.
- Exact provider-object rollback: `scripts/rollback-commerce.php`.
- Recovery point: MyKinsta Sep 17 backup noted above.
- Rollback restores `$500`, disables Zelle and restores prior DR-251 acceptance bindings without touching Complete, orders, users, payments or entitlements.

## 13. State delta

### Canonical authority

- Added and registered DR-296; canonical commit `ea604521e24525ef21540808adc1f5017ab1cf0a`.

### Product source

- Added `$549` card / `$499` Zelle runtime truth and restrained copy.
- Added exact Zelle eligibility, no-stack and on-hold controls.
- Added payment-method checkout recalculation.
- Added exact payment-method analytics values.
- Final source commit `86f5aafef3da78b5a14a1750eb240618fc0da93d`.

### Production provider state

- Woo `5867`: `$500` → `$549`.
- Woo parent `5504`: derived `$500` → `$549`.
- BACS/Zelle: disabled → enabled only through runtime eligibility filtering.
- DR-251 acceptance authority → DR-296.
- New Interview Week and Complete bindings created at `2026-09-17T15:21:48+00:00`.
- Latest Woo order remained `9102`; counted order population remained `25`.
- No order, payment, refund, user, entitlement or historical record changed.

### Deployment corrections

- Added the missing Woo recalculation trigger after payment-method selection.
- Corrected five staged customer asset modes from accidental `0600` to `0644`; hashes never changed.
- Final Kinsta cache purge succeeded.
- Final active lease count: zero.

### Unrelated dirty work

The pre-existing B Immersive report files remained byte-identical and were never staged or committed.

## 14. Remaining external/manual boundary

- A customer must still send the `$499` Zelle payment outside Woo.
- MissionMed must verify actual receipt before moving the order from `on-hold` to an access-granting state.
- This run did not test a real Zelle transfer, Stripe charge, order completion, refund or entitlement change.
- The existing Founder waiver remains the accepted residual financial-lifecycle risk.

## Evidence

- `PREIMAGE_LEDGER.md`
- `evidence/PRODUCTION_QA.json`
- responsive landing/card/Zelle/Complete screenshots in `evidence/`
- activation, rollback and QA scripts in `scripts/`
