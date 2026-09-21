# DRJ-EXAMPREP-0921D Evidence Index

## Before

- `evidence/before/enrollment-desktop-1440.png`
- `evidence/before/enrollment-mobile-390.png`
- `evidence/before/live-product-desktop-1440.png`
- `evidence/before/live-product-mobile-390.png`

## After

- `evidence/after/enrollment-desktop-1440.png`
- `evidence/after/enrollment-mobile-390.png`
- `evidence/after/daily-product-desktop-1440.png`
- `evidence/after/daily-product-mobile-390.png`
- `evidence/after/live-product-desktop-1440.png`
- `evidence/after/live-product-mobile-390.png`

The capture helper records actual viewport and document widths. Enrollment, Daily Rounds, and Live Group Drilling all reported equal `clientWidth` and `scrollWidth` at 390px. Woo gallery carousel children intentionally sit off-canvas, but the document itself does not horizontally overflow.

## Machine-readable regression

- `regression/enrollment-runtime.json`
- `regression/live-addon-runtime.json`
- `regression/purchase-success-runtime.json`

The success-page acceptance uses the safe deterministic production renderer. Direct order-received URLs remain authorization-bound to the order key/session and were not weakened for visual QA.
