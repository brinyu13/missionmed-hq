# Zelle Production UI and Regression QA

## Scoped contrast correction

The correction is confined to `.mmz-shell` and `.mmz-verified` within the Mission Residency Zelle verification component. It does not globally override WooCommerce typography.

Measured combinations:

| Surface | Foreground / background | Contrast |
| --- | --- | ---: |
| Body and labels | `#f8f4ea` / `#0d1d24` | 15.69:1 |
| Alert body | `#f8f4ea` / effective `rgb(37,52,58)` | 11.72:1 |
| Gold labels | `#dcbf86` / `#0d1d24` | 9.72:1 |
| CTA text | `#0d1d24` / `#dcbf86` | 9.72:1 |
| Input text | `#0d1d24` / `#ffffff` | 17.24:1 |
| Verified badge | `#123c2c` / `#eaf8f1` | 11.24:1 |

All exceed WCAG AA for normal text. Input focus uses a visible gold outline with offset.

## Responsive checks

Requested browser profiles: 1440 desktop, 1024 tablet, and 390 mobile. The in-app browser chrome reduced the measured content viewports to 1309, 931, and 354 pixels respectively; the mobile run is therefore narrower than the requested 390 profile. At each profile:

- explanatory text, payer label, amount, recipient, confirmation address, and CTA were readable;
- the grid collapsed to one column at mobile width;
- `scrollWidth` equaled the content viewport, so no horizontal overflow was present;
- the payer input retained a white background and dark text;
- no order/payment state or entitlement changed during UI QA.

## State coverage

- `pending`: alert, order cards, input label, input, and CTA use explicit scoped colors.
- `checking`, `not_found`, and `provider_unavailable`: use the same shell and explicit high-contrast `.mmz-note` treatment.
- `needs_review` and `already_consumed`: use the same shell and `.mmz-note` treatment.
- `verified`: uses the independently high-contrast `.mmz-verified` badge.

## Commerce regression

- Interview Week card price: `$549` unchanged.
- Complete card price: `$3,099` unchanged.
- Controlled order total: `$1.00`, isolated to order #9193.
- No public product price was changed.
- No Stripe setting, charge, refund, or order was changed.
- `mmed_mr_0912_iw_zelle_enabled`: `yes` to `no` after the launch gate failed.
- `mmed_mr_0912_complete_zelle_enabled`: `yes` to `no` after the launch gate failed.
- The global BACS configuration remains present for historical/controlled orders, but the launch-cart eligibility functions now return no Zelle offer for Interview Week or Complete.
