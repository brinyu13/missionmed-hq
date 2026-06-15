# SEV1-004 Live Validation Matrix

**Date:** 2026-06-15
**Validation method:** Live cache-busted HTTP probes, headless Chrome mobile render check, plus Woo Store API probes.
**Production mu-plugin SHA256:** `f2830b42fb16f604f96590f31f892294484082349b188b791845c4523eb91928`

| Check | Result | Evidence |
|---|---:|---|
| `/mission-residency/` returns 200 | PASS | Rendered status 200 |
| `/mission-residency/` has no visible `360 Elite` | PASS | Rendered body text search false |
| `/mission-residency/` has no HTML `360 Elite` | PASS | Rendered HTML search false |
| Dead `MR-1503C2_WhatIsMissionResidency_OnePage.html` CTA removed | PASS | Final cache-busted HTML search false after relative-href correction |
| Mission Residency proof/alumni CTA routes to `/what-alumni-said/` | PASS | Final cache-busted HTML includes 13 `/what-alumni-said/` hrefs and zero `MR-1503C2...` hrefs |
| `/homepage-arena/` returns 200 | PASS | Rendered status 200 |
| Primary `Enter Arena Preview` links route to `/arena/` | PASS | Headless Chrome rendered 10 `Enter Arena Preview` links, all pointing to `https://missionmedinstitute.com/arena/`; no registration anchors observed |
| Browser-side Arena preview navigation reaches `/arena/` | PASS | Navigation target status 200 |
| `/arena/` returns 200 | PASS | Rendered status 200 |
| `/red-flag-match-stories/` returns 200 | PASS | Rendered status 200 |
| Red Flag mobile table no longer creates page-level horizontal overflow | PASS | Headless Chrome mobile: `clientWidth=390`, `scrollWidth=390`, `pageLevelOverflow=false`, `.score-table` `overflow-x:auto` |
| `/mission-residency-courses/` returns 200 | PASS | Rendered status 200 |
| `/what-alumni-said/` returns 200 | PASS | Rendered status 200 |
| `/privacy-policy/` returns 200 | PASS | Rendered status 200 |
| `/terms-of-agreement/` returns 200 | PASS | Rendered status 200 |
| `/refund-cancellation-policy/` returns 200 | PASS | Rendered status 200 |
| Pricing unchanged | PASS | Woo Store API cents unchanged for products 5504, 3576, 3575, 3577 |
| No fatal public page errors observed | PASS | Target routes returned 200 |

## Woo Store API Snapshot

| Product ID | Product | Price cents | Regular cents |
|---:|---|---:|---:|
| 5504 | IV Prep Complete Masterclass | 149900 | 149900 |
| 3576 | Match Prep Pro | 279900 | 279900 |
| 3575 | 360 Match Mentorship | 399900 | 399900 |
| 3577 | Interview Prep Foundation | 49900 | 49900 |

## Notes

- The Red Flag page still reports a wider `body.scrollWidth=830` from internal table content, but `documentElement.scrollWidth=390`; the page viewport remains constrained and the table scrolls internally.
- A final probe found a relative `href="MR-1503C2_WhatIsMissionResidency_OnePage.html"` variant after the first SEV1-004 deploy. The final mu-plugin patch now rewrites that variant to `/what-alumni-said/`, and the final cache-busted probe confirmed zero remaining `MR-1503C2...` strings.
- A separate `Members ->` account navigation link still points to `/my-account/?redirect_to=...member-dashboard...`; this is not an `Enter Arena Preview` CTA and was left unchanged under the narrow watch-item scope.
- WP-CLI cache clear commands printed success; the WordPress cache command still returned nonzero after success output. This matches the existing production CLI instability observed during SEV1-003 and did not produce public fatal behavior.
