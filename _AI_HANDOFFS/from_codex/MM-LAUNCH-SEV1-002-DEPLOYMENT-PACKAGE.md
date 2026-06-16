# MM-LAUNCH-SEV1-002 Deployment Package

Ticket: `MM-LAUNCH-SEV1-002-MEGARUN`

Date: 2026-06-15

## Approval Required

Production deployment approval is required before this package is applied.

Do not run `railway up`.

## Package Contents

Deploy this source-controlled file only:

- `wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

No database migration, WooCommerce product edit, checkout edit, payment gateway edit, LearnDash edit, Matrix edit, Scheduler edit, Arena backend edit, or user/account edit is included.

## Expected Post-Deploy Effects

- `/privacy-policy/`, `/terms-of-agreement/`, and `/refund-cancellation-policy/` return HTTP 200 through virtual policy rendering if WordPress pages are missing.
- Public policy links route to the canonical policy URLs.
- Legacy program names are replaced in visible launch-page copy where filtered by WordPress content/title hooks.
- `/mission-residency/`, `/mission-residency-courses/`, and `/compare-programs/` present early-enrollment pricing with regular price, savings, and July 1 reminder.
- Arena marketing CTAs route to `/arena/`.
- USCE code-fence artifacts are removed at render time.
- ExamPrep visible artifacts are suppressed where source-controlled runtime filtering can safely handle them.
- Compare and red-flag CTAs route high-intent users to enrollment/proof pages instead of generic contact dead ends.

## Post-Deploy Smoke Test

Run these checks in production after approval:

1. Visit `/privacy-policy/`, `/terms-of-agreement/`, `/refund-cancellation-policy/`; confirm HTTP 200 and no placeholder text.
2. Visit `/mission-residency/`; confirm `$2,799 Early Enrollment`, `$3,999 Early Enrollment`, regular `$3,749`, regular `$5,499`, and July 1 reminder.
3. Visit `/mission-residency-courses/`; confirm the Current Early Enrollment Pricing panel appears.
4. Visit `/compare-programs/`; confirm pricing bridge and enrollment CTA.
5. Visit `/homepage-arena/`; confirm CTAs go to `/arena/` and no `Concept demo only` copy appears.
6. Visit `/usce/`; confirm no raw code fences.
7. Visit `/examprep/`; confirm no `ismissing` artifact.
8. Visit `/examprep/courses/`; confirm design-version controls are not visible.
9. Visit `/my-account/`; confirm visible legacy program labels are cleaned if rendered through WordPress title/content hooks.
10. Do one checkout preview only with approval; no purchase or gateway change is part of this package.

## Rollback

Restore:

`_SYSTEM_LOGS/backups/MM-LAUNCH-SEV1-002-20260615-125500/wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

If the entire SEV1 mitigation must be removed, disable or remove:

`wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`

