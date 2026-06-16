# SEV1-006 Final Validation Matrix

**Date:** 2026-06-15
**Validation base:** `https://missionmedinstitute.com`
**Mode:** read-only, cache-busted HTTP/API probes plus headless rendered checks
**Final verdict:** GO WITH WATCH ITEMS

## Preflight

| Check | Result |
|---|---|
| Git status before work | clean |
| Git branch | `codex/mm-launch-sev1-001-fixes` |
| Git HEAD before work | `09df6ae98c058565b3f70372e346012896e7bf36` |
| Production change made | None |
| Deployment performed | No |
| Railway used | No |

## Required URL Matrix

| URL | HTTP | Fatal/White Screen | Artifact Visibility | Result |
|---|---:|---:|---|---:|
| `/` | 200 | No | Clean | PASS |
| `/mission-residency/` | 200 | No | Clean | PASS |
| `/mission-residency-courses/` | 200 | No | Clean | PASS |
| `/compare-programs/` | 200 | No | Clean | PASS |
| `/red-flag-match-stories/` | 200 | No | Clean | PASS |
| `/homepage-arena/` | 200 | No | Clean | PASS |
| `/arena/` | 200 | No | Clean | PASS |
| `/usce/` | 200 | No | Clean | PASS |
| `/rotation-request/` | 200 | No | Clean | PASS |
| `/examprep/` | 200 | No | Clean | PASS |
| `/examprep/courses/` | 200 | No | Clean | PASS |
| `/contact/` | 200 | No | Clean | PASS |
| `/my-account/` | 200 | No | Visible clean; repair-script literals in raw source | PASS WITH NOTE |
| `/privacy-policy/` | 200 | No | Clean | PASS |
| `/terms-of-agreement/` | 200 | No | Clean | PASS |
| `/refund-cancellation-policy/` | 200 | No | Clean | PASS |
| `/cart/` | 200 | No | Visible clean; repair-script literals in raw source | PASS WITH NOTE |
| `/checkout/` | 200 via `/cart/` | No | Visible clean; repair-script literals in raw source | PASS WITH NOTE |

## Required Checks

| Check | Result | Evidence |
|---|---:|---|
| No legal 404s | PASS | All three policy pages returned 200 |
| Policy pages 200 | PASS | `/privacy-policy/`, `/terms-of-agreement/`, `/refund-cancellation-policy/` |
| No `Suggested text` | PASS | Raw and rendered checks negative |
| No ```html artifacts | PASS | Raw and rendered checks negative |
| No `ismissing` | PASS | Raw and rendered checks negative |
| No `MMission` | PASS | Raw and rendered checks negative |
| No visible `360 Elite` | PASS | Rendered checks negative |
| No public `MR-1503C2` link/string | PASS WITH NOTE | No visible/rendered link/string; raw occurrences only inside launch repair JavaScript |
| Arena primary CTA to `/arena/` | PASS | 10 rendered `Enter Arena Preview` links, all to `/arena/` |
| Red Flag mobile overflow controlled | PASS | 390px mobile render: `scrollWidth=390`, `pageLevelOverflow=false`, table `overflow-x:auto` |
| Legacy product `3577` not in catalog/search/store list | PASS | Store search/list probes exclude `3577` |
| Direct access to product `3577` preserved | PASS | Direct product URL and direct Store API by ID return 200 |
| Checkout/cart pages return without fatal | PASS | `/cart/` 200; `/checkout/` redirects to `/cart/` with no fatal |
| No public fatal errors or white screens | PASS | Required URLs returned non-empty nonfatal responses |

## Pricing Presentation

| Page | Early Prices | Regular Prices | Savings | July 1 Message | Result |
|---|---:|---:|---:|---:|---:|
| `/mission-residency/` | PASS | PASS | PASS | PASS | PASS |
| `/mission-residency-courses/` | PASS | PASS | PASS | PASS | PASS |
| `/compare-programs/` | PASS | PASS | PASS | PASS | PASS |

Validated exact strings:

- Early prices: `$1,499`, `$2,799`, `$3,999`
- Regular prices: `$1,699`, `$3,749`, `$5,499`
- Savings: `Save $200`, `Save $950`, `Save $1,500`
- Deadline: `Price increases July 1`

## Woo Store API Prices

| Product ID | Product | Price cents | Regular cents | Result |
|---:|---|---:|---:|---:|
| 5504 | IV Prep Complete Masterclass | 149900 | 149900 | PASS |
| 3576 | Match Prep Pro | 279900 | 279900 | PASS |
| 3575 | 360 Match Mentorship | 399900 | 399900 | PASS |
| 3577 | Interview Prep Foundation | 49900 | 49900 | PASS, direct access preserved |

## Legacy Product Discovery

| Probe | Result | Evidence |
|---|---:|---|
| Store API search `Interview Prep Foundation` | PASS | `count=0`, `has3577=false` |
| Store API default list | PASS | `count=18`, `has3577=false` |
| Store API visible list | PASS | `has3577=false` |
| Store API hidden list | PASS | `count=3`, `has3577=false` |
| Site product search | PASS | Does not expose legacy product |
| Direct Store API product `3577` | PASS | 200, direct access preserved |
| Direct product URL | PASS | 200, direct access preserved |

## Rendered Browser Checks

| Page | Desktop Screenshot | Mobile Screenshot | Mobile Overflow | Result |
|---|---:|---:|---:|---:|
| `/` | Nonblank | Nonblank | No | PASS |
| `/mission-residency/` | Nonblank | Nonblank | No | PASS |
| `/mission-residency-courses/` | Nonblank | Nonblank | No | PASS |
| `/compare-programs/` | Nonblank | Nonblank | No | PASS |
| `/homepage-arena/` | Nonblank | Nonblank | No | PASS |
| `/red-flag-match-stories/` | Nonblank | Nonblank | No page-level overflow | PASS |

Screenshot captures were performed in memory and not saved as files.

## Production Read-Only Checks

| Check | Result |
|---|---|
| Remote mu-plugin PHP lint | PASS |
| Remote mu-plugin SHA256 | `0395ce6aad8fe74fdae3c9beb2482b1246f8c9784d0a888b9fada98a4434274c` |
| Product `3577` visibility | `hidden` |
| Product `3577` terms | `exclude-from-catalog`, `exclude-from-search` |
| Product `3577` price | `499` unchanged |

## Notes

- `/checkout/` currently resolves to `/cart/` for an empty cart, which is acceptable for this no-mutation final smoke check.
- The raw source literals `360 Elite` and `MR-1503C2` on account/cart surfaces are inside the repair script itself, not visible content or live CTA destinations.
- No forms were submitted and no account, order, checkout, payment, product, LearnDash, Matrix, Scheduler, Arena backend, or Railway operation was performed.

