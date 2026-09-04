# MR-WEB-0904C Live URL Audit

Public result: **PASS**

Final raw HTTP sweep: **10/10 HTTP 200 and clean**. Final isolated, unauthenticated, rendered Chrome sweep: **12/12 PASS** at `2026-09-04T18:24:07.988Z`.

| URL | Customer truth | Checkout state | Result |
|---|---|---|---|
| `https://missionmedinstitute.com/` | Fall 2026; Complete $2,799; Essentials $1,199; 360 closed | Routes to Mission Residency | PASS |
| `https://missionmedinstitute.com/mission-residency/` | Current offer, names, inclusions, dates, capacity | Complete and Essentials direct checkout links | PASS |
| `https://missionmedinstitute.com/mission-residency-courses/` | Current concise comparison | Two valid checkout links | PASS |
| `https://missionmedinstitute.com/compare-programs/` | Current concise comparison | Two valid checkout links | PASS |
| `https://missionmedinstitute.com/course-comparison/` | Current concise comparison | Two valid checkout links | PASS |
| `https://missionmedinstitute.com/product/match-prep-pro/` | Visible title IV Prep Complete; $2,799 | Active variation 5865 | PASS |
| `https://missionmedinstitute.com/product/iv-prep-complete/` | Alias reaches current Complete surface | Active variation 5865 | PASS |
| `https://missionmedinstitute.com/product/iv-prep-masterclass/` | Visible title IV Prep Essentials; $1,199 | Active variation 5867 | PASS |
| `https://missionmedinstitute.com/product/iv-prep-essentials/` | Alias reaches current Essentials surface | Active variation 5867 | PASS |
| `https://missionmedinstitute.com/product/360-match-mentorship/` | $5,499 reference; capacity reached; enrollment closed | No checkout/add-to-cart link | PASS |
| `https://missionmedinstitute.com/cart/` | IV Prep Complete Session D; $2,799 | Correct product and total | PASS |
| `https://missionmedinstitute.com/checkout/` | IV Prep Complete; $2,799 | One top-level Credit / Debit Card method | PASS |

The automated sweep found none of the active forbidden customer claims: Match Prep Pro as the program name, IV Prep Masterclass/Foundation as the current Essentials name, July 1, current Complete $3,999, current Essentials $1,849, open $3,999 360, MatchFirst, six-month plan, Forever Match Guarantee, Session C/August 1, unlimited mocks, or an active cohort-full waitlist route.

The accepted Personal Statement Emergency price of $1,499 remains separate from IV Prep Essentials and is not a stale Essentials price.

Mobile assertions:

- Mission Residency: `innerWidth=390`, `clientWidth=390`, `scrollWidth=390`, no overflow, no stale terms. Screenshot SHA-256 `82f5701391587910082ba75e4e5a2629a8afcd32b7a51d401ccdb069d6523790`.
- Complete purchase surface: same 390px width assertions, no overflow, current name/price/CTA. Screenshot SHA-256 `35ea704a84bfa1c0f2840321b33543d174d03257e240edd5b910ecd92009e01d`.

Automation: [rendered public sweep](evidence-scripts/rendered-public-sweep-cdp.mjs) and [mobile capture](evidence-scripts/capture-mobile-cdp.mjs).
