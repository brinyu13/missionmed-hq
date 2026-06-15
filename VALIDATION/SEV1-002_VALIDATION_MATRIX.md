# SEV1-002 Validation Matrix

Ticket: `MM-LAUNCH-SEV1-002-MEGARUN`

Date: 2026-06-15

## Static Validation

| Check | Result |
| --- | --- |
| `php -l wp-content/mu-plugins/missionmed-launch-sev1-fixes.php` | PASS |
| Isolated WordPress-stub smoke test | PASS |
| Early prices preserved | PASS |
| Stale regular/high-season values corrected in source presentation | PASS |
| Privacy virtual route included | PASS |
| Compare pricing bridge uses early enrollment presentation | PASS |
| No WooCommerce product data edits | PASS |
| No checkout/payment gateway edits | PASS |
| No LearnDash/Matrix/Scheduler/Arena backend edits | PASS |
| No deployment performed | PASS |

## Live Crawl Before Deployment

These results reflect production before the SEV1-002 source-controlled package is deployed.

| URL | HTTP | Key Finding |
| --- | ---: | --- |
| `/` | 200 | Legacy `Interview Prep Foundation` and `Interview Prep Complete`; one dead `#` link. |
| `/mission-residency/` | 200 | Legacy names, stale `$3,199`/`$4,499`, four dead `#` links. |
| `/mission-residency-courses/` | 200 | Legacy `IV Prep Masterclass`; mixed installment/Zelle/payment-plan pricing. |
| `/compare-programs/` | 200 | Legacy `Interview Prep Foundation`; generic contact routing. |
| `/red-flag-match-stories/` | 200 | Legacy `360 Elite`; CTA routing needs hardening. |
| `/homepage-arena/` | 200 | `Concept demo only` copy still live; Arena entry exists elsewhere. |
| `/usce/` | 200 | Raw ```html artifact still live. |
| `/examprep/` | 200 | `ismissing` artifact still live. |
| `/examprep/courses/` | 200 | Prices `$75`, `$200`, `$300`; design-variant issue not detected by latest text crawl but remains in prior audit. |
| `/contact/` | 200 | Loads. |
| `/my-account/` | 200 | `noindex`; legacy `IV Prep Masterclass` visible in account context. |
| `/privacy-policy/` | 404 | Critical legal page blocker. |
| `/terms-of-agreement/` | 404 | Critical legal page blocker. |
| `/refund-cancellation-policy/` | 404 | Critical legal page blocker. |
| `/book/` | 404 | Dead booking route; not used as canonical CTA in new mitigation. |
| `/rotation-request` | 200 | Redirects/normalizes to `/rotation-request/`. |
| `/arena` | 200 | Arena entry exists. |
| `/daily` | 200 | Arena mode exists. |
| `/drills` | 200 | Arena mode exists. |
| `/stat` | 200 | Arena mode exists. |

## Expected Post-Deploy Validation

| Area | Expected Result |
| --- | --- |
| Legal pages | `/privacy-policy/`, `/terms-of-agreement/`, `/refund-cancellation-policy/` return 200 and show MissionMed-specific content. |
| Pricing presentation | Early enrollment price, regular strikethrough, savings, and July 1 reminder visible for three Mission Residency tiers. |
| Woo pricing | Main Woo prices remain unchanged: `$1,499`, `$2,799`, `$3,999`. |
| Program naming | Public launch pages no longer show `IV Prep Masterclass`, `Interview Prep Foundation`, `Interview Prep Complete`, `Match Prep Complete`, or `360 Elite` where filterable. |
| CTA flow | Compare page routes to `/mission-residency-courses/`; red-flag proof CTA routes to `/what-alumni-said/`; Arena CTAs route to `/arena/`. |
| USCE | Raw code-fence artifacts removed. |
| ExamPrep | `ismissing` artifact removed; design-version controls suppressed if present. |
| Footer/policy links | Dead `#` policy links and `/?page_id=3` privacy links route to canonical policy URLs. |

## Not Validated Locally

- Visual rendering inside production WordPress/Elementor after deployment.
- Checkout preview totals.
- Admin-only product configuration.
- Legal review by counsel.

