# D1-500 Founder and Administrator Canary Report

Status: NOT RUN; production access remains disabled.

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
session expiry, health, logs, kill switch, and rollback. Founder, second eligible
student, non-360, and expired/revoked personas or controlled fixtures remain
unavailable.
