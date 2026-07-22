# Authentication and Authorization Report

RESULT: `LOCAL_MENTOR_AUTH_BOUNDARY_FAILS_CLOSED`

## Runtime authentication boundary

The shared MissionMed HQ session remains the sole runtime gateway for `/mmc-private/**`. The 007 local CAM asset mount is reached only after existing private-route authorization succeeds. An unauthenticated or unauthorized runtime request does not receive the CAM document or protected route metadata.

The isolated Founder review server is intentionally different: it supplies a clearly synthetic `.invalid` fixture identity and a synthetic CSRF token on loopback only. It is test infrastructure, not proof of a production login or authorization source.

## Principal derivation

Mentor requests derive the effective principal from server/session context. Client payloads cannot author tenant, environment, principal, actor, role, capabilities, assignment, workload, queue, issuer, or audience fields. The runtime enforces:

- exact configured tenant and environment;
- `FIXTURE` or `LOCAL` for the in-memory mentor runtime;
- mentor/operator role separation;
- current active assignment for subject-scoped reads and commands;
- `mmc:operations` for Operations projections;
- `mmc:review` for review decisions;
- `mmc:command` for mentor mutations;
- no STAGING/LIVE in-memory composition and no production-process local runtime.

Resource denials use policy-safe not-found behavior where existence is sensitive. Assignment expiry/revocation is rechecked at execution, not accepted from page-load state.

## CSRF and origin

The frontend obtains `authenticated` and `csrfToken` from existing same-origin `/api/auth/session`, holds the token in memory, and does not consume or persist an access token. Commands require:

- POST to the exact mentor command route;
- an approved exact origin;
- the current `X-MMHQ-CSRF` token;
- JSON content type and bounded body;
- a strict typed command envelope.

Missing origin, invalid CSRF, unsupported methods, oversized bodies, and client authority fields fail closed. Query responses and command responses use `no-store` headers.

## Role matrix

| Actor/context | Mentor reads | Mentor commands | Reviews | Operations | Student publication |
| --- | --- | --- | --- | --- | --- |
| Assigned mentor fixture principal | Allowed within assigned subjects | Allowed for eleven local kinds with exact capability | Allowed with review capability | Denied without Operations capability | Disabled |
| Operator fixture principal | General mentor role is not silently granted | Denied unless explicitly authorized | Capability-specific | Allowed with `mmc:operations` | Disabled |
| Unassigned/expired/revoked mentor | Denied or indistinguishable not found | Denied | Denied | Role-specific only; no subject bypass | Disabled |
| Anonymous/unauthorized HQ session | Private mount denied | Denied | Denied | Denied | Disabled |
| STAGING/LIVE or production process | Local in-memory runtime denied | Denied | Denied through local runtime | Denied through local runtime | Disabled |

## Evidence

Local contract and browser tests verify private authorization, exact loopback origin, CSRF, operations gating, client-authority rejection, active-assignment enforcement, subject continuity, production denial, LIVE/STAGING denial, and idempotent replay after current authorization.

## Unproved later boundaries

007 does not prove real student principal resolution, configured RLS, production cookie policy, deployed reverse-proxy behavior, staging issuer/audience, break-glass, or provider workload identity. Those remain 008/009/010 gates. No local fixture result is presented as live auth certification.
