# Responsive live QA

## Homepage

- 1440px: all eight frames exercised; one visible H1; full-bleed hero; no overflow; initial and subsequent images loaded; CTA visible.
- 1024px: frames `0` through `7` exercised with the next control; no horizontal overflow; CTA visible; control targets at least 44px.
- 390px: frames `0` through `7` exercised; viewport and hero width both 390px; no horizontal overflow; images loaded; CTA visible; controls at least 44px.
- Legacy `.mm107-hero` rendered element count: `0`.
- Stale Founder-rejected strings: `0`.

## Dedicated Mission Residency page

| Width | Result | Evidence |
|---|---|---|
| 1440 | PASS | viewport and scroll width `1440`; one static hero; one visible H1; two paths; image loaded; attribution links retained route and campaign |
| 1024 | PASS | viewport, scroll, and hero width `1024`; CTA height `54px`; two paths; image loaded; no carousel |
| 390 | PASS | viewport, scroll, and hero width `390`; header `84px`; CTA `54px`; mobile disclosure opened with seven attributed links; two paths; no carousel |

Exact live headline at every width: `YOU BUILT THE APPLICATION that earned the interview. NOW LET'S TURN THE INTERVIEW INTO A MATCH.`

