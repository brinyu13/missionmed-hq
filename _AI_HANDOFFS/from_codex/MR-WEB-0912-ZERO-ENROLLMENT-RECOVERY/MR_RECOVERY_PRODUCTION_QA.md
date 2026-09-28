# MR Zero-Enrollment Recovery — Production QA

Final machine evidence: `evidence/RECOVERY_PRODUCTION_QA.json`
Generated: `2026-09-28T17:15:53.313Z`
Live payment submitted: `false`

## Responsive matrix

| Surface | 1440 | 1024 | 390 | Key acceptance |
|---|---:|---:|---:|---|
| `/` | PASS | PASS | PASS | no forbidden copy/overflow; fixed CART visible and tappable |
| `/mission-residency/` | PASS | PASS | PASS | public; Oct 8–18 dates; prices; Complete includes IW; no private prompt |
| Complete product | PASS | PASS | PASS | `$3,099` through Oct 7; `$3,499` anchor; all choices; `view_item` |
| Interview Week product | PASS | PASS | PASS | `$549/$499`; Oct 8/11/13/15/17/18; all choices; `view_item` |
| Comparison | PASS | PASS | PASS | two-path distinction; no overflow; persistent CART |

The first pass overlapped the MyKinsta cache purge and saw a transient old desktop product render. After the purge completed, the single authorized final recheck passed every viewport and replaced the transient output as authoritative evidence.

## Checkout rails

| Rail | Product shown | Amount shown | Gateway | Result |
|---|---|---:|---|---|
| Interview Week card | `IV Prep Essentials: Interview Week - Session D: Oct 11th, 2026` | `$549.00` | Stripe | PASS |
| Interview Week Zelle | same | `$499.00` | BACS/Zelle | PASS |
| Complete card | `IV Prep Complete - Session D: Oct 11th, 2026` | `$3,099.00` | Stripe | PASS |
| Complete Zelle | same | `$3,099.00` | BACS/Zelle | PASS |
| Complete installments | `IV Prep Complete - Payment Plan - Session D: Oct 11th, 2026` | `$1,000.00` now; `$400/month for 6 months` | Stripe/WCS | PASS |

All five rails:

- returned checkout HTTP 200;
- preserved the selected product/variation;
- displayed the expected amount;
- rendered the intended payment gateway;
- included Terms and Refund links;
- showed no DRJ2026/private prompt;
- had no horizontal overflow at 390;
- exposed a fixed, visible CART control with a compliant tap target;
- emitted `add_to_cart` and `begin_checkout` data-layer evidence;
- did not submit a payment.

## Guards and content

- Mixed Interview Week + Complete cart: reduced to one product row with the protective message visible — PASS.
- Complete includes Interview Week/no extra `$549`: visible and unambiguous — PASS.
- No customer-facing internal QA/governance text — PASS.
- No OUT OF STOCK leakage — PASS.
- No mobile “use desktop” banner — PASS.
- No rendered active DRJ2026 gate — PASS.
- No stale `$2,799`, `$3,399`, `$399.84`, Sep 26, or obsolete schedule-role copy — PASS on active source/rendered surfaces.
- Product IDs and mappings preserved — PASS by production runtime readback.

## Known test boundary

This was intentionally non-financial QA. The script aborts payment-submission endpoints, and `livePaymentSubmitted` is `false`. No new lifecycle boundary was changed by this recovery release.
