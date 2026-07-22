# Y2-3100 DISC-01 API and Session Authority

## Scope

Read-only mapping of the accepted CAM 4008A candidate. This report does not declare that candidate to be the tracked canonical CAM source.

## Findings

- **VERIFIED:** The inspected donor root is `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates`. Its 4008A handoff treats it as accepted candidate evidence.
- **UNKNOWN:** The exact currently tracked canonical CAM source was not established from the available repository state. No Y2 work may silently promote this donor into canon.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/server.mjs:6` through `:15` imports the mounted route handlers; `:42` through `:48` identifies protected route families; `:58` through `:94` performs dispatch.
- **VERIFIED:** Mounted public families are `/health`, `/v1`, `/v1/contracts`, `/v1/auth/me`, `/v1/reps*`, `/v1/media/*`, `/v1/reviews/*`, `/v1/vault/*`, and `/v1/entitlements/*`.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/contracts.mjs:3` through `:44` publishes 40 contracts. Lines `:53` through `:60` explicitly exclude transcript and RISE synchronization contracts.
- **VERIFIED:** Transcript and RISE route source files exist but are not imported or mounted by `server.mjs`. Their presence is not a runtime capability.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/auth/verifyJwt.mjs:53` through `:86` validates a bearer JWT against configured JWKS or secret material, issuer, audience, expiry, and a required subject.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/routeHelpers.mjs:44` through `:58` composes JWT verification with an active CAM session requirement.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/auth/requireCamSession.mjs:40` through `:98` checks `cam_auth_sessions` through the server boundary and binds session id, Supabase subject, WordPress user, audience, status, expiries, authority snapshot, entitlement hash, and reason.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/entitlements.mjs:48` through `:58` accepts server-controlled `app_metadata`, not `user_metadata`, as entitlement authority. Lines `:155` through `:252` fail closed for active-360 and administrator decisions.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/middleware/cors.mjs:16` through `:41` implements configured exact-origin checks and conditionally bounded DEV origins. Lines `:31` through `:34` allow authorization and mutation-control headers.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/supabaseServerClient.mjs:3` through `:25` keeps the service-role boundary server-side; `:47` through `:84` applies bounded provider requests and RPC calls.

## Y2 Attachment Contract

- **INFERENCE:** A future `/v1/interviews/*` family would need an explicit handler import, `requiresCamEntitlement`, dispatcher branch, public-contract declaration, audit events, and storage authority. No such family exists today.
- **VERIFIED:** Existing CORS header support is sufficient for bearer authorization, idempotency, expected-version, request, correlation, and causation headers. Origin admission would still require an explicit deployment decision.
- **ASSUMPTION:** Any future interviewer service should consume the same verified CAM authority rather than minting a parallel identity or entitlement system. This is an architectural recommendation, not current implementation evidence.

## Boundary Verdict

The reusable authority chain is strong and fail-closed. The adaptive interviewer API is absent. The Y2 Phase 0 harness remains isolated and must not be represented as a mounted CAM feature.
