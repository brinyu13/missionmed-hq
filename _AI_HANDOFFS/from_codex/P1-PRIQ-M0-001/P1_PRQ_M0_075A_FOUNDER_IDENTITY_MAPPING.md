# P1-PRIQ-M0-075A Founder identity mapping

Date: 2026-08-02
Status: FOUNDER MAPPED; SERVER-SIDE DEPLOYED PROOF PASS; INTERACTIVE CROSS-ORIGIN HANDOFF BLOCKED

## Identity resolution

- The current authenticated WordPress account was verified through the existing server-side WordPress app-password interface.
- The returned account matched the visibly authenticated account, had an email and stable WordPress ID, held the `administrator` role, and had active `manage_options` capability.
- The existing MissionMed HQ bootstrap algorithm derived the account-specific Supabase sign-in credential server-side and resolved the corresponding stable subject from the approved Matrix Supabase project.
- Production WordPress/Matrix and `cam-dev` were confirmed to use different Supabase projects. PRIQ authentication was therefore pointed at the approved WordPress/Matrix identity project instead of assuming that similarly named dev users were equivalent.
- The exact subject was sent directly to Railway `PRIQ_FOUNDER_USER_IDS` through stdin. Its value was never printed, logged, committed, placed in browser code, or recorded here.
- No account was created, updated, reactivated, or enumerated. No historical override was used.

## Isolated redeployment

- Service: `priq-dev` only.
- Environment: `cam-dev`.
- Deployment: `b46f8595-4555-4b2d-bc81-f6e620bbff45`.
- Result: SUCCESS.
- CAM, Matrix, WordPress, production deployments, databases, and unrelated services were not changed or restarted.

## Founder proof

The same server-side bridge produced a short-lived Supabase session without printing it. That session was exchanged for an HttpOnly PRIQ session and used only for the following synthetic/public-professional checks:

- Founder exchange: PASS, role `founder`.
- Deployed frozen interface: PASS, HTTP 200, expected frozen title and bootstrap adapter present.
- Founder UI-state API: PASS, HTTP 200.
- Founder feature-control API: PASS, HTTP 200.
- Control Panel asset: PASS.
- Student access: OFF.
- Student workspace: OFF.
- Student publication: OFF.
- Unauthenticated request: HTTP 401.
- Valid project token without a Founder user subject: HTTP 401.
- Hydration: temporarily released only for the prompt-authorized synthetic Ask proof, then returned to OFF in a `finally` path.
- Ask PRIQ: PASS, structured output, OpenAI, `gpt-5.6-luna`, 2xx, 2,964 ms, 548 input tokens, 161 output tokens, estimated USD 0.001514, model-run ID `0c7fcd6c-6eaa-4c0b-a43c-172337584ec1`.

## Browser-token enforcement and exact remaining bridge

The legacy URL-fragment/session-storage bearer fallback was removed from PRIQ browser code. The frontend now uses only its HttpOnly PRIQ session cookie.

The current WordPress cookie is correctly scoped to `.missionmedinstitute.com`; the deployed PRIQ host is on `.railway.app`. Browsers therefore cannot send the WordPress HttpOnly cookie to PRIQ. The currently deployed WordPress handoff allowlist also excludes the PRIQ Railway host and its legacy non-CAM route uses a token-bearing redirect. Using that redirect or handing a Supabase token to frontend JavaScript would violate this ticket.

An interactive deployed-browser Founder session consequently requires one separately authorized infrastructure contract:

1. a development PRIQ subdomain under `missionmedinstitute.com` plus server-side WordPress-cookie validation; or
2. an approved server-to-server, signed POST assertion from the existing Matrix/HQ bridge to PRIQ, with single use, audience binding, expiry, replay protection, and no token in URLs or browser JavaScript.

Until one of those contracts is authorized, `/auth-entry` fails closed. This is an interactive handoff blocker, not a Founder identity, provider, deployment, API, frozen-UI, or student-access failure.
