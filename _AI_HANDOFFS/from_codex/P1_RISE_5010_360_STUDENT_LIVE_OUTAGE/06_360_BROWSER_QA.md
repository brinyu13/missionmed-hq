# Live 360 Browser QA

## Identity and session hygiene

An existing test-labeled, currently enrolled 360 subscriber was used. Each run created a short-lived WordPress session, injected it only into an isolated headless system-Chrome context, and destroyed that exact session token afterward. Final destroy readback was `remaining_for_exact_token=false`. No raw identity or credential was logged or retained.

The successful browser traversed the real production SSO entry rather than loading the RISE service directly.

## 360 acceptance

| Check | Result | Evidence |
|---|---:|---|
| WordPress login and RISE SSO | PASS | Final URL `https://missionmedinstitute.com/rise/`; no loop or entitlement error |
| Matrix | PASS | `/member-dashboard/` HTTP 200, no login redirect, dashboard marker present |
| Home | PASS | Student role visible; `6139 canonical program identities loaded` |
| Admin isolation | PASS | Admin Tools absent; operator endpoint HTTP 403 in the student control |
| Find Programs | PASS | 6,139-program catalog loaded |
| Specialty/state filters | PASS | Internal Medicine + New York returned 76 results, showing 50 of 76 |
| Program File | PASS | File overlay opened, semantic Close File control became visible, Student Intel rendered, and sourced/pending/unknown truth labels were present |
| SOAP Explorer | PASS | `883 historical SOAP 2026 programs` |
| My Programs | PASS | Save visible after navigation, persisted across hard reload, then was removed |
| Persistence cleanup | PASS | Final UI readback `0 programs you’re tracking`; exact temporary WP session destroyed |
| Student Intel | PASS | program-specialty Student Intel API HTTP 200 and UI content rendered |
| RISE API sequence | PASS | session, status, catalog, profile, beta notice, program state, and Student Intel all returned HTTP 200 |

The beta notice was visible on fresh load and again after reload because QA closed it without acknowledging it; this intentionally avoided mutating the test identity's notice preference.

Browser diagnostics:

- page errors: 0
- failed network requests: 0
- RISE API failures: 0
- failed HTTP responses captured by the RISE page: 0
- one console message was traced exactly to `/favicon.ico` HTTP 404; it is outside the RISE API/feature path and caused no render or interaction failure

## Administrator control QA

A separate short-lived administrator browser session completed the same live SSO. It preserved the student experience and then switched to the administrator command center.

- Admin command center active: yes
- Research, Queue, Review, and Coverage controls present: yes
- Student Intel operator endpoint: HTTP 200, response keys `analytics` and `records`
- Matrix StoryForge path: HTTP 200, final `/storyforge/`, marker present
- Matrix File Vault path: HTTP 200, final `/member-dashboard/#filevault`, marker present
- exact temporary administrator WordPress session destroyed: yes

## Anonymous negative QA

- `/rise/`: HTTP 302 to the same MissionMed WordPress host
- `/api/rise/v1/programs/catalog`: HTTP 401, 80-byte error response
- `/api/rise/v1/operator/student-intel`: HTTP 401, 80-byte error response
- no catalog, student, or operator data returned

## Cache/session recovery

Multiple independently created fresh 360 sessions succeeded. The same browser session survived a hard reload and re-read saved-program state. No Kinsta purge or browser-cache workaround was necessary; future users traverse the repaired HQ audience contract rather than relying on a founder browser cache.
