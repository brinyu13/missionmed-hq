# P1-PRIQ-M0.75 development deployment

Date: 2026-08-02
Status: DEPLOYED_CLOSED_IDENTITY_MAPPING_REQUIRED
Environment: existing MissionMed `cam-dev`
Service: isolated `priq-dev`
Student access: OFF
Hydration: Founder-controlled, paused by default and after every restart

## Scope

M0.75 connects the recovered, hash-frozen PRIQ UI to the real server-side OpenAI route and packages it as an isolated development service. It does not replace or restart `cam-api-dev`, change production, apply the proposed PRIQ database migration, ingest Ezechiel private files, or publish a student workspace.

## Access boundary

- `PRIQ_AUTH_MODE=supabase` verifies MissionMed Supabase JWTs against the project JWKS.
- Only an explicit `priq_role` of Founder/Admin, a configured Founder subject/email, or an active verified MissionMed admin override is accepted.
- Only Founder can release or pause hydration.
- Student access, publication, and override flags reject attempts to enable them.
- Browser sessions are opaque, in-memory, HttpOnly, Secure, SameSite=Strict, expire after eight hours, and disappear on restart.

## AI surfaces

| Surface | Status | Data boundary |
|---|---|---|
| Ask PRIQ | Wired | public professional evidence |
| Public research | Wired | public professional evidence |
| Profile generation | Wired | draft only; Founder review required |
| Live Copilot | Wired | synthetic/public proof; restricted input still provider-gated |
| Debrief | Wired | evidence required; restricted input still provider-gated |
| Profile Lab | Wired | public professional evidence |
| Founder Note AI | Wired but feature-flagged off | Founder only; restricted-data approval required |
| Video analysis | Adapter-blocked | no simulation or fabricated success |

## Deployment controls

- Container: `Dockerfile.priq`
- Service config: `railway.priq.json`
- Health route: `/health` returns provider configuration only as a boolean, plus access/hydration state.
- Credential source: Railway server runtime variable; never browser code or repository content.
- Supabase configuration: Railway server runtime reference to the existing development service variables.
- Persistence: local in-memory provisional; hydration and browser sessions reset on restart.

## Verification record

This section is completed from command and deployment evidence before handoff.

- Local deterministic suite: PASS, final combined `npm run priq:check`, 27/27 tests including the secure-entry assertion
- Frozen UI hash: PASS, `995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477`
- Frontend secret scan: PASS
- Real synthetic OpenAI route: PASS, Ask PRIQ returned schema-valid structured output through `gpt-5.6-luna`; 2xx; 2,543 ms; 548 input tokens; 191 output tokens; estimated USD 0.001694; model-run ID `0e5c49f6-8109-4b63-8848-a205ed2e0c66`
- Development deployment: SUCCESS, Railway deployment `a12d40c6-af41-4e19-bbcb-e69d18fd32aa`
- Development URL: `https://priq-dev-cam-dev.up.railway.app`
- Development health: PASS, HTTP 200; provider configured `true`; access `founder-admin-only`; student access `false`; hydration `false`
- Runtime logs: startup confirmed; zero error-category entries in the sanitized deployment-log check
- Founder/Admin rejection proof: PASS for unauthenticated root and API requests, HTTP 401 `AUTH_REQUIRED`
- Student-access lock proof: PASS for unauthenticated student-report request, HTTP 401 `AUTH_REQUIRED`; deterministic tests separately prove student role rejection and backend flag interlocks
- Independent verifier: required before calling this a verified release

## Exact remaining access gate

The `cam-dev` Supabase project currently contains no explicit `priq_role` records and no active verified MissionMed admin override. Safe discovery found one historical override record, but it is not active and was not assumed to be Dr. Brian. Neither the local Git author identity nor the public GitHub identity produced an unambiguous confirmed Supabase match.

Therefore the deployed service is healthy but deliberately closed. Set `PRIQ_FOUNDER_USER_IDS` or `PRIQ_FOUNDER_EMAILS` through the Railway secret/runtime interface only after Dr. Brian identifies the exact existing Supabase account. Do not guess, create a shadow account, expose user records, or promote the expired record. Once mapped, the trusted Matrix launcher can exchange that account's bearer token at `/api/auth/exchange`; hydration still remains paused until Founder explicitly releases it.
