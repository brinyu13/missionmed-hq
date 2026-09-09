# Live QA

## Real authorized 360 canary

The safe test-labeled 360 identity completed WordPress authentication, the RISE SSO handoff, an authenticated RISE session with `audience=rise`, full catalog/filter hydration, and feature navigation. The session role was student; Student navigation was present, Admin Tools was absent, and the operator endpoint returned HTTP 403. Page errors, request failures, and unexpected RISE API failures were zero.

## Table D - Live QA samples

| Specialty | Filter combination | Result count | Result |
|---|---|---:|---|
| Internal Medicine | J-1 | 629 | PASS |
| Internal Medicine | H-1B | 159 | PASS |
| Internal Medicine | Any Visa | 637 | PASS |
| Internal Medicine | IMG evidence | 627 | PASS |
| Internal Medicine | DO evidence | 569 | PASS |
| Internal Medicine | Deep Research | 236 | PASS |
| Internal Medicine | Enriched Research | 255 | PASS |
| Internal Medicine | J-1 + IMG evidence | 495 | PASS |
| Internal Medicine | DO + New York | 54 | PASS |
| Family Medicine | SOAP + Florida | 12 | PASS |
| Psychiatry | Deep Research + New Jersey | 0, verified true zero | PASS |
| Psychiatry | Deep Research + New York | 0, verified true zero | PASS |
| Psychiatry | Deep Research + Pennsylvania | 0, verified true zero | PASS |
| General Surgery | IMG evidence + Texas | 17 | PASS |
| Pediatrics | Enriched Research + J-1 | 26 | PASS |

Clear Filters restored 6,139 programs. Caribbean showed count zero and was disabled independently from DO. Program File opened, Student Intel was visible, SOAP showed 883 historical programs, and My Programs loaded. An existing administrator session retained Admin Tools, Research, Queue, Review, Coverage, and Student Intel controls.

The mobile canary used a fresh authorized session at 390 by 844. After the authorized 300 ms entrance animation settled, the drawer rectangle was left `15.609375`, right `390`, width `374.390625`; viewport, document client, document scroll, and body scroll widths were all exactly `390`. Temporary WordPress tokens were destroyed and exact-token verification returned false.

Anonymous `/rise/` redirected to WordPress. Anonymous direct filter API access returned HTTP 401.

## Post-recovery current-state replay

After the successful canaries above, the shared Kinsta PHP-FPM pool saturated across multiple products. On September 9 it recovered without a RISE mutation. WordPress login returned HTTP 200 in 1.227 seconds, anonymous public `/rise/` returned the expected HTTP 302 to WordPress login in 1.253 seconds, and direct RISE health returned HTTP 200 in 0.224 seconds.

A new fresh authorized 360 browser replay returned HTTP 200, `authenticated=true`, `role=student`, `audience=rise`, `privateBeta=true`, and the expected `rise:read`, `rise:premium`, `rise:private-beta`, and `rise:contribute` capabilities. Admin Tools remained absent and the operator endpoint returned HTTP 403. The replay reconfirmed all Table D counts, reset to 6,139, opened Program File and Student Intel, loaded SOAP and My Programs, and produced no page or request failures. An initial optional profile read briefly returned HTTP 503 during pool recovery; an isolated follow-up produced three consecutive HTTP 200 canonical Matrix profile reads with a profile object present, completing the seam readback.

The dedicated settled mobile replay at 390 by 844 measured viewport, document client, document scroll, and body scroll widths at exactly 390 pixels. The drawer rectangle was left `15.609375`, right `390`, width `374.390625`; therefore the drawer and document passed without horizontal overflow. Temporary sessions from every replay were destroyed and exact-token verification returned false.
