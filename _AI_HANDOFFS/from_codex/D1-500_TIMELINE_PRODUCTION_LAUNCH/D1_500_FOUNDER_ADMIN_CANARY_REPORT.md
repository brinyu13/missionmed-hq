# D1-500 Founder and Administrator Canary Report

Status: NOT RUN; the production route is installed but feature and access remain
disabled at the server-secret binding gate.

The sealed source and local harness pass student-canary, administrator-canary,
non-allowlisted denial, consent required/record/withdraw, JWT round trip,
entitlement-change rejection, and remote-sync authorization checks.

One administrator and one active 360 student test identity have been supplied in
the private task context. They are represented only by opaque handles
`D1-500-ADMIN-TEST-01` and `D1-500-STUDENT-360-01`; no password is stored in
evidence or Git. Required production journeys remain Founder student-persona
create/save/reload/export, approved administrator entry, unapproved
administrator denial, student denial during canary, second-user denial,
anonymous/direct-API denial, logout, account switching, stale-token rejection,
session expiry, health, logs, kill switch, and rollback. Controlled fixtures for
the remaining personas are Founder-authorized; their creation is intentionally
deferred until the API health gate passes so they exercise the real production
authorization path.
