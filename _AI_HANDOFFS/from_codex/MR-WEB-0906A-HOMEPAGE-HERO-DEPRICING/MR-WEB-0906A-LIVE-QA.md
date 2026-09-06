# MR-WEB-0906A Live QA

Final logged-out verification: **5/5 PASS** at `2026-09-06T23:23:19Z`, after the final CDN purge.

## Acceptance

| Check | Result | Evidence |
|---|---|---|
| Corporate hero has no prices | PASS | No `$2,799`, `$1,199`, `$5,499`, `$3,999`, `$1,849`, `$1,499`, `$3,299`, `$3,199`, or “launch tuition” in rendered homepage text |
| Corporate homepage has no Mission Residency prices | PASS | Full rendered `document.body.innerText` sweep |
| Approved institutional card copy | PASS | Exact Essentials + Complete enrollment sentence and 360 capacity-reached statement rendered |
| Mission Residency pricing unchanged | PASS | `/mission-residency/` retained Complete `$2,799`, Essentials `$1,199`, and 360 `$5,499` reference |
| Complete product unchanged | PASS | `/product/match-prep-pro/` retained IV Prep Complete, `$2,799`, and enrollment CTA |
| Cart unchanged | PASS | Authoritative Complete variation `5865` rendered at `$2,799` |
| Checkout unchanged | PASS | Complete `$2,799`; sole visible payment method `Credit / Debit Card` |
| Product provider readback | PASS | `10/10` name, price, stock, mapping, and 360-closed checks at `2026-09-06T23:22:00Z` |

Machine-readable evidence: [MR-WEB-0906A-RENDERED-ACCEPTANCE.json](MR-WEB-0906A-RENDERED-ACCEPTANCE.json)

## Visual QA

- Desktop, `1440 × 1200`: PASS. Hero hierarchy, copy, two CTAs, and institutional card are readable with no clipping. A pre-existing eight-pixel page-wide scroll-width difference also existed in the before capture and was not introduced by this bounded hero change.
- Mobile, `390 × 844`: PASS. Single-column hero/card flow is readable, both CTAs fit, and `clientWidth = scrollWidth = 390`.

Before:

- [Desktop before](screenshots/before/corporate-home-desktop.png) — SHA-256 `e2d4cd02529075c3079a16274bee91ab12fab384b5ca556b1ae49c8378c12ea4`
- [Mobile before](screenshots/before/corporate-home-mobile.png) — SHA-256 `7820ed799e444bf29607179959d7c680e75901a0fabc3fd10089e5fcac2d892d`

After, captured after all cache layers were purged:

- [Desktop after](screenshots/after/corporate-home-desktop.png) — SHA-256 `84900802721aca52827ea85e261c90ba75b755ab26b4907c478fc0cc6595a097`
- [Mobile after](screenshots/after/corporate-home-mobile.png) — SHA-256 `4dbb714ca244b96ed89ef3c6350fdae8700a64b3f5ff098bc943128272a8c383`

## Live URLs

- Corporate home: `https://missionmedinstitute.com/`
- Mission Residency: `https://missionmedinstitute.com/mission-residency/`
- IV Prep Complete canonical alias: `https://missionmedinstitute.com/product/iv-prep-complete/`
- IV Prep Complete current product URL: `https://missionmedinstitute.com/product/match-prep-pro/`
- Checkout: `https://missionmedinstitute.com/checkout/`
