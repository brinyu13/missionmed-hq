# D1-500 Identity, Entitlement, Authorization, and RLS

## Identity and entitlement

- Stable principal key: immutable Timeline UUID mapped to immutable WordPress user ID.
- Student authority: active LearnDash access to published Closed course `3893`.
- Generic login, subscriber role, direct URL possession, and client-side state are insufficient.
- Administrator authority: WordPress administrator plus the exact approved allowlist; final allowlist contains only user ID `85`.
- Remote persistence also requires consent version `d1-500-v1`.
- JWT lifetime is 120 seconds. Expired tokens fail closed; reloading under a valid WordPress session performs a new exchange and restores the correct principal context.

## Boundary results

- Anonymous token request: 401 `session_required`.
- Anonymous same-origin API: 401 `session_required`.
- Direct Railway API without gateway authority: 403 `GATEWAY_REQUIRED`.
- Non-360 and revoked personas: 403 `eligibility_required`, no Matrix entry.
- Account switch and destroyed session: prior token/context rejected.
- Second eligible student: first student's list/read/write targets were absent or 404.

## PostgreSQL controls

- Schema: `d1-timeline-db-500.1`.
- Tables: 20.
- RLS policies: 53.
- FORCE RLS omissions: 0.
- Public table privileges: 0.
- Runtime role: `timeline_authenticated`; least-privilege service/grant roles are separate.
- Administrator document access requires a bounded, expiring, independently audited resource grant.

## Fixture cleanup

Controlled WordPress IDs 1299-1303 were deleted after testing. Their posts, usermeta, LearnDash access rows, Timeline program memberships, active documents, and active grants are zero. The five Timeline principals are `DELETED`; three controlled documents are soft-`DELETED`; append-only audit and outbox evidence remains. Cleanup audit ID: `d1-500-fixture-cleanup-20260804`.
