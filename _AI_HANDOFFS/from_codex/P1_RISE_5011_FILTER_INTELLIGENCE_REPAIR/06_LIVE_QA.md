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

## Post-acceptance current-state replay

After the successful canaries above, the shared Kinsta PHP-FPM pool saturated across multiple products. A final fresh replay received no bytes from either WordPress login or the public `/rise/` proxy before a 20-second client timeout, while `https://missionmed-rise-production.up.railway.app/api/rise/v1/health` returned HTTP 200 in 0.415 seconds with the expected build and registry. The fresh current-instant 360 SSO replay is therefore `BLOCKED_BY_SHARED_KINSTA_PHP_POOL`; no claim is made that the public entry path is presently healthy. The earlier authenticated production canary results remain valid evidence for the deployed filter behavior.
