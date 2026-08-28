# Validation Report

Date: 2026-08-28

## Automated validation

| Gate | Result |
|---|---|
| RISE unit/server/security/contract tests | 116 pass, 0 fail |
| Playwright browser acceptance | 12 pass, 0 fail |
| HQ RISE-audience isolation | 1 pass, 0 fail |
| Selected existing HQ security/auth regressions | 91 pass, 0 fail |
| HQ production build validation | 67 pass, 0 fail |
| PHP lint | 3/3 RISE MU-plugins pass |
| RISE npm audit | 0 vulnerabilities |
| Railway target verifier | pass |
| Production runtime RLS verifier | pass |
| Migration 005 isolated up/down rehearsal | pass |
| UI lock hash/diff | exact hash; no diff from base |

The repository-root placeholder test command discovered zero tests; it is not counted as a validation suite. The authoritative RISE package suite is `rise/npm test`.

## Rights and data safety

- Student API index SHA-256: `119982e51d38e4294bb05bf33122718ec76275736b233f4ddd7d21aca5765486`.
- Exactly 26 rights-safe HRSA awardee-specialty identity records.
- `fields: {}` for every record; no ACGME identifier, hospital, ZIP, award amount, narrative, logo, photo, or deep-research assertion in the student projection.
- No restricted workbook in Git or deployment image.
- Zero deep-research claims and zero SOAP records published.
- Demo/synthetic medical values are excluded from production assets; unknown remains explicit.
- Source rights are hash-bound, live-checked, current, and fail closed.

## Live persona and route QA

### Anonymous

- `/rise/` returns a login redirect.
- `/api/rise/v1/session` returns 401 with `no-store, private`.
- `/api/rise/v1/health` exposes only the intentionally accepted service/build/release status and no student/program content.

### Authenticated administrator using student experience

- WordPress login and the server-side RISE audience exchange succeed.
- The isolated audience cookie survives two hard reloads while the generic Matrix/HQ cookie remains separate.
- Home renders the personalized identity, Tell Me About interaction, fit/My Programs/profile hierarchy, and four feature doors.
- Find Programs defaults to list and reports 26 records; the Grid control activates.
- A Program File opens as the routed immersive overlay.
- All six tabs render evidence-safe content or honest missing states.
- Sources & Freshness opens with provenance and current/unknown coverage.
- Admin Research states `NOT AUTHORIZED`; processor/cost are unavailable and paid Run is disabled pending a bounded server preview and confirmation.
- Fresh console after SSO and repeated reloads: zero errors.

No separate eligible/premium live persona was available. Premium mapping is unresolved and therefore fails closed. The suite tests normal student, admin, anonymous, entitlement, profile degradation, persistence, and paid-spend denial paths. No production save was created in the founder's account; My Programs' live authenticated read returned 200, while browser reload persistence and cross-subject isolation were verified in the automated service/DB tests.

### Narrow viewport

At 390 × 844 the document reported `clientWidth = scrollWidth = 354`; greeting, Tell Me About, and all four feature doors remained present. The viewport override was reset after the check.

## Zero blast radius

- Signed-in Matrix dashboard rendered successfully after activation.
- StoryForge Matrix mode opened its private workspace handoff.
- File Vault Matrix mode rendered for the authorized administrator.
- Arena returned HTTP 200.
- Timeline retained its protected HTTP 303 behavior.
- `missionmed-hq /health` and `/health/lor-studio` returned HTTP 200.
- WordPress home and login returned HTTP 200; anonymous member dashboard retained HTTP 302.
- CAM production services remained `SUCCESS/RUNNING` in provider readback.
- RankList IQ source/configuration was untouched; its Matrix/Supabase console initialized without errors.
- The unrelated `ivprep-profile-b-worker` and old LOR staging deployment were already outside the RISE change set and were not modified. No RISE-attributable regression was found.

LIVE_QA_PASS = YES
ZERO_BLAST_RADIUS_PASS = YES
