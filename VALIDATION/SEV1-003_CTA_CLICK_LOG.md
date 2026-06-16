# SEV1-003 CTA Click Log

Ticket: `MM-LAUNCH-SEV1-003-LIVE-DEPLOY-VALIDATE`

Date: 2026-06-15

Method: browser-executed DOM validation plus destination HTTP checks. No forms were submitted. No checkout/payment/user/account data was changed.

## CTA Results

| Source Page | CTA / Link | Destination | HTTP | Result |
| --- | --- | --- | ---: | --- |
| `/` | See How We Help | `/course-comparison/` | 200 | PASS |
| `/` | Book Your Free Strategy Session | `/contact/` | 200 | PASS |
| `/` | Join Match Strategy Session | `/mission-residency-waitlist/` | 200 | PASS |
| `/mission-residency/` | Read What Alumni Said | `/what-alumni-said/` | 200 | PASS |
| `/mission-residency/` | See All 3 Programs | `/mission-residency-courses/` | 200 | PASS |
| `/mission-residency/` | Read what alumni said first | `/mission-residency/MR-1503C2_WhatIsMissionResidency_OnePage.html` | 404 | FAIL - P1 dead proof link |
| `/mission-residency-courses/` | Enroll in 360 Match | `/product/360-match-mentorship/` | 200 | PASS |
| `/mission-residency-courses/` | Enroll in Match Prep Pro | `/product/iv-prep-complete/` -> `/product/match-prep-pro/` | 200 | PASS |
| `/mission-residency-courses/` | Enroll in IV Prep Essentials | `/product/interview-emergency-prep/` -> `/product/iv-prep-masterclass/` | 200 | PASS WITH WATCH: product slug remains legacy |
| `/compare-programs/` | View Courses And Enrollment | `/mission-residency-courses/` | 200 | PASS |
| `/red-flag-match-stories/` | Read What Alumni Said | `/what-alumni-said/` | 200 | PASS |
| `/red-flag-match-stories/` | Courses / Enrollment | `/mission-residency-courses/` | 200 | PASS |
| `/homepage-arena/` | Already a member? Enter Arena Now | `/my-account/?redirect_to=.../arena/` | 200 | PASS WITH WATCH |
| `/homepage-arena/` | Enter Arena Preview | `/missionmed-registration/?redirect_to=/member-dashboard/#dashboard` | 200 | PASS WITH WATCH: not direct `/arena/` |
| `/homepage-arena/` | Direct Arena route | `/arena/` | 200 | PASS |
| `/arena/` | Standard account login fallback | `/wp-admin/admin-post.php?action=mmac_hq_auth_redirect...` | Not clicked | SKIP: auth redirect side effect avoided |
| `/usce/` | Request Placement | `/rotation-request/` | 200 | PASS |
| `/usce/` | Submit a Request | `/rotation-request/` | 200 | PASS |
| `/examprep/` | Enroll Now | `/examprep/courses/` | 200 | PASS |
| `/examprep/` | Watch a Drill Session | `/examprep/watch/` | 200 | PASS |
| `/examprep/courses/` | Team Drilling Product | `/product/team-drilling-sessions/` | 200 | PASS |
| `/examprep/courses/` | 1-on-1 Product | `/product/1-on-1-tutoring-master-level/` | 200 | PASS |
| `/contact/` | Contact page | `/contact/` | 200 | PASS |
| `/my-account/` | Privacy Policy | `/privacy-policy/` | 200 | PASS |
| Footer | Terms of Agreement | `/terms-of-agreement/` | 200 | PASS |
| Footer | Refund Policy | `/refund-cancellation-policy/` | 200 | PASS |
| Footer | Privacy Policy | `/privacy-policy/` | 200 | PASS |

## CTA Watch Items

1. `/mission-residency/` has a visible proof CTA to `/mission-residency/MR-1503C2_WhatIsMissionResidency_OnePage.html`, which returns 404.
2. `/homepage-arena/` has `Enter Arena Preview` CTAs routing to registration/member dashboard rather than direct `/arena/`.
3. Product slugs for IV/Match still redirect from legacy slugs; destinations resolve, but naming debt remains in Woo/product architecture.

