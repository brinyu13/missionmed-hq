# B1-507A WordPress and Matrix Integration

Date: 2026-07-29

## Canonical production path

- User route: `https://missionmedinstitute.com/storyforge/`
- Entry owner: WordPress on Kinsta.
- Product shell: immutable StoryForge release selected by the Kinsta route pointer.
- API owner: Railway `storyforge-v5-api`.
- Authentication/bootstrap owner: `missionmed-storyforge-sso` WordPress plugin.
- Authorization owner: WordPress eligibility at bootstrap plus Railway JWT checks and PostgreSQL RLS at data access.
- Matrix return/navigation remains part of the recovered V5 shell; StoryForge is not a directly opened standalone HTML file in production.

## Files and current deployment

- Route/proxy source: `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`
- SSO plugin source: `storyforge-v5/infra/wordpress/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- Shared enrollment handoff: `wp-content/mu-plugins/missionmed-hq-auth-handoff.php`
- Current Kinsta pointer: `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`
- Current route SHA-256: `1cf024fc…`
- Current deployed plugin SHA-256: `eaf740…`
- Safe current settings: enabled; Founder user ID 1 allowlisted with student-view override; allowed role `student`; no configured cohorts; JWT TTL 60 seconds.

The live Founder session is authenticated and rendered as `brinyu` in student view.

## JWT/bootstrap flow

1. WordPress authenticates the browser and evaluates StoryForge access state.
2. The SSO plugin maps the WordPress user to a stable StoryForge UUID.
3. It issues a short-lived StoryForge JWT with role/cohort/identity claims.
4. The shell bootstraps against the Railway API through the WordPress route.
5. Railway validates issuer, audience, signature, origin, role, and feature eligibility.
6. PostgreSQL RLS independently enforces row-level ownership/access.
7. Token refresh remains WordPress-owned; logout ends the WordPress session and must invalidate practical API access.

No client-side role toggle, service-role key, or UI-only authorization is permitted.

## Entitlement logic

The current SSO code:

- trusts WordPress administrators as active admins;
- supports an exact Founder/user allowlist and safe role override;
- delegates student eligibility to `mmhq_cam_build_entitlement`;
- requires the StoryForge feature enabled and a permitted role/cohort/allowlist state.

The shared MU-plugin default enrollment authority requires:

- current LearnDash access to course ID `3893`;
- a verified qualifying purchase;
- one of product IDs `3575` or `5511`, or a recognized tier;
- recognized tiers `360elite`, `360elite_onboarding`, or `360_match_mentorship`;
- no restricted, expired, or revoked state.

This is concrete current repository logic. It is not sufficient proof that every production-configured value and currently enrolled 360 identity matches the intended Founder scope. B1-505C requires a final eligibility authority/receipt for broader cohort activation, and no final B1-505 artifact was found. Before activation, a read-only production entitlement probe must confirm the configured course/product/tier authority and representative eligible/ineligible identities, without exporting student private data.

## Access outcomes required

| Identity | Required outcome |
|---|---|
| Founder allowlisted account | Access; may use student-view override |
| WordPress administrator | Admin access |
| Currently enrolled qualifying 360 student | Student access |
| Expired/revoked/nonqualifying student | Denied |
| Anonymous user | Denied/bootstrap 401 |
| Arbitrary WordPress subscriber | Denied |
| Direct Railway caller without valid JWT/origin | Denied |

## Gateway limitations

The current generated route permits only `GET`, `POST`, and `PATCH`. It also requires `application/json` for every POST/PATCH request.

Consequences:

- Phase 1 segment upload is `multipart/form-data` and receives 415 through the production gateway.
- Explicit audio deletion uses HTTP DELETE and receives 405.
- These are unresolved code defects in the production integration seam. They are not configuration-only and are not already fixed elsewhere in the candidate.
- API-direct local tests do not prove the WordPress route.

Required fix:

1. permit only the exact Phase 1 multipart upload route and preserve its authenticated body/content-type boundary;
2. permit DELETE only for the exact authorized audio endpoint(s);
3. stream/forward bodies without logging audio or credentials;
4. preserve origin/JWT/size/timeout/fail-closed behavior;
5. add production-shaped gateway tests for multipart, DELETE, unauthorized, wrong content type, oversize, retry, and rollback;
6. regenerate the immutable WordPress release and verify protected hashes through the guard.

## Kinsta immutable release model

1. Verify the protected-runtime guard and exact candidate hashes.
2. Create a new content-addressed/commit-addressed release directory; never edit the live release in place.
3. Install/update the SSO plugin and route from the verified candidate.
4. Verify PHP syntax, ownership/modes, pointer target, route health, asset hashes, bootstrap, multipart, and DELETE behavior.
5. Cut over the route pointer only after backup/restore and backend/migration prerequisites pass.
6. Roll back by restoring the previous pointer and plugin/route receipt, then forcing voice/provider/reconciliation off.

## Current health

- `/storyforge` redirects permanently to `/storyforge/`.
- `/storyforge/healthz` returns 200.
- Unauthenticated bootstrap returns 401.
- The live route is no-indexed, no-store/dynamic, and has a microphone-compatible CSP.
- The current text shell is healthy.
- Voice cannot traverse the gateway until the code fix above is implemented and deployed.
