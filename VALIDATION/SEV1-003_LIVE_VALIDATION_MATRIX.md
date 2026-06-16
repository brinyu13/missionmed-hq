# SEV1-003 Live Validation Matrix

Ticket: `MM-LAUNCH-SEV1-003-LIVE-DEPLOY-VALIDATE`

Date: 2026-06-15

Validated URL base: `https://missionmedinstitute.com`

Cache-busting query strings were used during validation.

## Deployment Preflight

| Check | Result |
| --- | --- |
| Git branch | `codex/mm-launch-sev1-001-fixes` |
| Git HEAD | `eec429211138bbb201d0ad9f2f76024437157ff1` |
| Pre-deploy git status | One pre-existing untracked report: `_AI_HANDOFFS/from_codex/MM-LAUNCH-SEV1-002A-LAUNCH-INTELLIGENCE.md` |
| Local PHP lint | PASS |
| Local SHA256 | `d2c270141194e3b51d2fa90815bd73fcbaea687c611d26671fd13e3f7633b91d` |

## Deployment Verification

| Check | Result |
| --- | --- |
| Production path | `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php` |
| Production backup | `/www/theresidencyacademy_209/missionmed_deploy_backups/MM-LAUNCH-SEV1-003-20260615T175404Z/` |
| Existing same-name file | None existed before deploy |
| Remote SHA256 | `d2c270141194e3b51d2fa90815bd73fcbaea687c611d26671fd13e3f7633b91d` |
| Remote PHP lint | PASS |
| Production error log | No recent fatal/parse/critical/plugin errors detected |

## Cache Clear Status

| Cache Layer | Result |
| --- | --- |
| WordPress/object cache | PASS via `wp cache flush` success output |
| Kinsta/host cache | PASS; cache-purge log shows `/kinsta-clear-cache-all` at `17:54:41` and `17:55:19` UTC |
| Kinsta CDN cache | PASS; cache-purge log shows `/kinsta-clear-cache-cdn` at `17:54:41` and `17:55:19` UTC |
| Elementor CSS/cache | PASS via `Elementor\\Plugin::instance()->files_manager->clear_cache()` |
| Autoptimize cache | PASS via `autoptimizeCache::clearall()` |
| Direct Cloudflare API purge | Not run; no separate Cloudflare credentials were used. Kinsta CDN purge and cache-busting validation were used. |

## URL Validation

| URL | HTTP | Result | Notes |
| --- | ---: | --- | --- |
| `/` | 200 | PASS WITH WATCH | Browser-visible legacy names not found after JS; one non-critical `#` link remains. |
| `/mission-residency/` | 200 | PASS WITH WATCH | Pricing markup present. One visible `360 Elite` testimonial attribution remains. One visible alumni one-page link returns 404. |
| `/mission-residency-courses/` | 200 | PASS | Current Early Enrollment Pricing present; product CTAs resolve. |
| `/compare-programs/` | 200 | PASS | Pricing bridge present; CTAs route to `/mission-residency-courses/`. |
| `/red-flag-match-stories/` | 200 | PASS WITH WATCH | Copy/name artifacts cleared. Mobile has 199px horizontal overflow from wide score table. |
| `/homepage-arena/` | 200 | PASS WITH WATCH | Concept-demo language removed. Some `Enter Arena Preview` CTAs still route to registration/member dashboard rather than direct `/arena/`. |
| `/arena/` | 200 | PASS | Arena entry loads; no concept-demo language detected. |
| `/usce/` | 200 | PASS | No raw ```html artifacts; request CTAs resolve to `/rotation-request/`. |
| `/rotation-request/` | 200 | PASS | Request flow page returns 200. |
| `/examprep/` | 200 | PASS | `ismissing` artifact removed; ExamPrep CTAs resolve. |
| `/examprep/courses/` | 200 | PASS | Design-version artifact not visible; product CTAs resolve. |
| `/contact/` | 200 | PASS | Contact page loads; footer policy links resolve. |
| `/my-account/` | 200 | PASS WITH WATCH | Public login/account shell loads and policy links resolve; checkout/account internals were not modified. |
| `/privacy-policy/` | 200 | PASS | Virtual legal page live; no placeholder/boilerplate detected. |
| `/terms-of-agreement/` | 200 | PASS | Virtual legal page live; no placeholder/boilerplate detected. |
| `/refund-cancellation-policy/` | 200 | PASS | Virtual legal page live; no placeholder/boilerplate detected. |

## Required Artifact Checks

| Check | Result |
| --- | --- |
| Legal pages return 200 | PASS |
| No `Suggested text` | PASS |
| No privacy boilerplate | PASS |
| No legal 404s | PASS |
| No ```html artifacts | PASS |
| No `ismissing` | PASS |
| No `MMission` | PASS |
| No `concept demo only` | PASS |
| No fake account creation language | PASS |
| Program names canonical on main public launch surfaces | PASS WITH WATCH: one `360 Elite` attribution remains on `/mission-residency/` |
| Early-season prices preserved | PASS |
| Regular/high-season comparison values shown | PASS |
| July 1 messaging clear | PASS |
| Woo Store API early-season prices unchanged | PASS |
| Footer policy links work | PASS |
| MatchLab not visible on main launch pages | PASS |
| USCE request flow returns 200 | PASS |
| Fatal PHP errors / white screens | PASS |
| Desktop layout | PASS |
| Mobile layout | PASS WITH WATCH: `/red-flag-match-stories/` table overflow |

## Woo Store API

| Product | Product ID | API Price | Result |
| --- | ---: | ---: | --- |
| IV Prep Complete Masterclass | `5504` | `$1,499` | PASS: early-season price unchanged |
| Match Prep Pro | `3576` | `$2,799` | PASS: early-season price unchanged |
| 360 Match Mentorship | `3575` | `$3,999` | PASS: early-season price unchanged |
| Interview Prep Foundation | `3577` | `$499` | WATCH: legacy product remains exposed |

## Visual Notes

- Desktop browser pass: no blank pages and no horizontal overflow on validated pages.
- Mobile browser pass: no blank pages. `/red-flag-match-stories/` has horizontal overflow caused by `.score-table` width around 569px in a 390px viewport.
- Policy pages render as lightweight virtual pages and are readable on mobile/desktop.
- Mission Residency pricing cards exist in DOM with visible dimensions and include regular price, early price, savings, and July 1 language.

