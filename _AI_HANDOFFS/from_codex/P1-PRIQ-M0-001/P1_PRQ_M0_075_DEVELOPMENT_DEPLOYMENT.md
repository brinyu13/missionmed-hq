# P1-PRIQ-M0.75 development deployment

Date: 2026-08-02
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

- Local deterministic suite: PASS, 27/27 tests before the final auth-entry assertion; final combined run pending
- Frozen UI hash: PASS, `995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477`
- Frontend secret scan: PASS
- Real synthetic OpenAI route: PASS, Ask PRIQ returned schema-valid structured output through `gpt-5.6-luna`; 2xx; 2,543 ms; 548 input tokens; 191 output tokens; estimated USD 0.001694; model-run ID `0e5c49f6-8109-4b63-8848-a205ed2e0c66`
- Development deployment health: pending
- Founder/Admin rejection proof: pending deployed check
- Student-access lock proof: pending deployed check
- Independent verifier: required before calling this a verified release
