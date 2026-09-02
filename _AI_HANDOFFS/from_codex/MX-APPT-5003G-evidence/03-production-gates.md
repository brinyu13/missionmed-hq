# MX-APPT-5003G production-gate record

Status: NOT DEPLOYED

## Passing gates

- Canonical authority, isolated base, source readback, real runtime-contract discovery, MX-APPT-5002 reconciliation, automated/runtime-contract checks, responsive/accessibility checks, clean local diagnostics, and no migration: PASS.

## Mandatory hard stops

1. Immutable rollback unavailable. The expected public object https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.98f87f6998eb.html returned HTTP 404.
2. Canonical publisher credentials unavailable. _SYSTEM/scheduler_publish.sh --list stops because R2 credentials are absent. No provider mutation was attempted.
3. Designated allowlisted-student acceptance unavailable. No credential was supplied and no substitute identity was used.
4. Student denial of authenticated admin routes was not witnessed. Anonymous denial is HTTP 401 and authenticated admin reads are HTTP 200, but a designated student session is required.
5. Fresh non-builder release verification unavailable. Builder-local validation cannot self-certify it.
6. Shared preference and Force Classic seam not committed. No route exists; MX-CAL-4200C owns SHARED:MISSIONMED-HUB; the candidate labels its current-session switch truthfully.

## Read-only production checks

- Anonymous Scheduler bootstrap, appointment, history, and admin probes: HTTP 401.
- Authenticated admin supported GET routes returned HTTP 200: appointments, calendar-feed, availability-grid, appointment-types, analytics, audit-log, entitlements/config.
- No live Scheduler, WordPress, Railway, Supabase, R2, appointment, entitlement, allowlist, or feature-flag state was mutated.

## Safe release prerequisites

1. Coordinate completion/release of MX-CAL-4200C and re-read shared PHP bytes.
2. Add preference and Force Classic only under fresh SHARED:MISSIONMED-HUB custody with server authorization, validation, and audit.
3. Materialize and publicly verify the exact live bytes at the immutable 98f87f6998eb rollback key without changing LIVE.
4. Make approved R2 publisher credentials available.
5. Run designated-student acceptance including authenticated admin-route denial.
6. Obtain a fresh non-builder result.
7. Re-run all tests and the publisher dry run at the final commit.
8. Only then publish and post-verify.

Rollback after prerequisite 3: _SYSTEM/scheduler_publish.sh --rollback 98f87f6998eb
