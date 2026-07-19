# Y2-3100 Session, API, Auth, And RLS

## Verified Boundaries

| Boundary | Current authority | Future Y2 rule |
|---|---|---|
| Public API | `cam-api/server.mjs:42` dispatches accepted CAM routes | Additive interview routes may mount only through this gateway under a separate release ticket |
| JWT | `src/auth/verifyJwt.mjs:30-86` verifies JOSE signature, issuer, audience, expiry, and subject | Never accept launcher, URL, or model claims as identity |
| Session | `src/auth/requireCamSession.mjs:40-98` requires an active CAM authority session | Future Brain work must bind to the same session authority |
| Entitlement | `src/routes/entitlements.mjs:48-252` uses trusted `app_metadata` and fails revoked/restricted/expired states closed | Interviewer admission remains server-derived and default-off |
| RLS | `20260714203000_y1_cam_4005r_auth_session_enforcement.sql:142-213` requires fresh entitlement and active session | Every future Y2 table needs FORCE RLS and no direct authenticated lifecycle writes |
| Mentor access | `20260713120000_y1_cam_4004_runtime_closure.sql:617-740` requires an exact active grant | No session-wide or cohort-wide review shortcut |

## CIE Attachment

CIE C0 locally defines the compatible session-clock, track-item, Moment, visibility, grant, and deep-link concepts in `/Users/brianb/MissionMed_worktrees/Y1-CIE-C0-0001/cie/src/`. It is not production authority. Future integration must adapt Y2 turn events onto that spine after a separately reviewed production adapter exists.

## Closed Phase 0 Boundary

The harness has no HTTP public service, JWT acceptance, database role, Supabase key, WordPress handoff, Matrix launch, Arena launch, or production endpoint. Synthetic session IDs are local fixture identifiers and cannot be treated as authentication.
