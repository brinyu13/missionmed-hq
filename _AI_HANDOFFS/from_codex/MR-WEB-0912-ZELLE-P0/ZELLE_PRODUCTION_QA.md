# Zelle Production QA — Administrator Confirmation Pivot

Date: 2026-09-29

## Responsive pending-payment UI

The production order-received component was inspected at requested widths `1440`, `1024`, and `390`.

| Check | 1440 | 1024 | 390 |
| --- | --- | --- | --- |
| Exact amount prominent | PASS | PASS | PASS |
| Zelle ID `missionmed` prominent | PASS | PASS | PASS |
| COPY returns exactly `missionmed` | PASS | PASS | PASS |
| Exact Founder QR visible, uncropped | PASS | PASS | PASS |
| Payer-name control usable | PASS | PASS | PASS |
| CTA at least 48px high | PASS | PASS | PASS |
| No horizontal overflow | PASS | PASS | PASS |
| Pending and verified states unambiguous | PASS | PASS | PASS |
| No Matrix CTA while pending | PASS | PASS | PASS |

Measured targets: copy control 48px high on desktop/tablet and 270x48px on mobile; payer input 50px; submit button 50px desktop/tablet and 53px mobile. `scrollWidth` equaled viewport width at each profile.

## QR fidelity and scannability

- Live URL: `https://missionmedinstitute.com/wp-content/mu-plugins/missionmed-mr-0912-assets/media/missionmed-zelle-qr.png`
- Source/live SHA-256: `7e1f116daf0b0dd23b66db87073b5db2df77d049535603a9abb8a21545ad6b15`
- Dimensions: 444x364 source; rendered within a white container without cropping or overlays.
- Independent decode succeeded as a Zelle payment QR for `Mission Global Group LLC`, token `missionmed`.

## Contrast and focus

All styles are scoped to `.mmz-shell` or `.mmz-verified`; no global Woo typography override was introduced.

| Surface | Foreground / background | Contrast |
| --- | --- | ---: |
| Body and labels | `#f8f4ea` / `#0d1d24` | 15.69:1 |
| Alert body | `#f8f4ea` / effective `rgb(37,52,58)` | 11.72:1 |
| Gold labels | `#dcbf86` / `#0d1d24` | 9.72:1 |
| CTA text | `#0d1d24` / `#dcbf86` | 9.72:1 |
| Input text | `#0d1d24` / `#ffffff` | 17.24:1 |
| Verified badge | `#123c2c` / `#eaf8f1` | 11.24:1 |

The focused payer field computed a 3px solid `rgb(246, 215, 154)` outline plus a 4px gold focus ring. All measured combinations exceed WCAG AA normal-text requirements.

## Live checkout rails

- Interview Week cart/card total: `$549.00`.
- Selecting Zelle changed the live item, subtotal, and total to `$499.00` and displayed `Zelle — $499 total (save $50)`.
- Complete cart/card total: `$3,099.00`; the Zelle rail displayed `Zelle — $3,099 total` with no separate discount.
- Stripe card and Zelle both rendered on the scoped checkout.
- Zelle description states the order stays on hold and access is not granted until MissionMed verifies receipt.
- No payment was submitted during final QA.

## State coverage

`pending`, `awaiting_admin`, `checking`, `not_found`, `provider_unavailable`, `needs_review`, `already_consumed`, validation/error, and `verified` use explicit scoped high-contrast treatments. The payer field remains light with dark text. Pending surfaces hide the ordinary Woo success sentence and any Matrix/customer-active CTA.

## Regression

- Both public products and active variations remain in stock and purchasable.
- Product IDs/mappings remain 5504/5867 → LearnDash 3646 and 3576/5865 → LearnDash 5227.
- Stripe is enabled in live mode and its card element renders.
- No Stripe setting, payment, refund, order or entitlement was mutated by this pivot.
- Existing paid users were not queried or rewritten; the source path is gated to mapped BACS orders only.
