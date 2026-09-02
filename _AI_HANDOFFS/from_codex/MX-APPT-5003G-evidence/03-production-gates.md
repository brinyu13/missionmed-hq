# MX-APPT-5003G production-gate record

Status: NOT DEPLOYED

## Passing gates

- Canonical authority, isolated base, source readback, real runtime-contract discovery, MX-APPT-5002 reconciliation, automated/runtime-contract checks, responsive/accessibility checks, clean local diagnostics, no migration, approved provider access, and immutable rollback: PASS.

## Mandatory hard stops

1. Designated allowlisted-student acceptance unavailable. No credential was supplied and no substitute identity was used.
2. Student denial of authenticated admin routes was not witnessed. Anonymous denial is HTTP 401 and authenticated admin reads are HTTP 200, but a designated student session is required.
3. Fresh non-builder release verification unavailable. Builder-local validation cannot self-certify it.
4. Shared preference and Force Classic seam not committed. No route exists; MX-CAL-4200C owns SHARED:MISSIONMED-HUB; the candidate labels its current-session switch truthfully.

## Production checks

- Anonymous Scheduler bootstrap, appointment, history, and admin probes: HTTP 401.
- Authenticated admin supported GET routes returned HTTP 200: appointments, calendar-feed, availability-grid, appointment-types, analytics, audit-log, entitlements/config.
- One bounded R2 write created the immutable current-live rollback object. Public readback is HTTP 200 with the exact live hash. The LIVE alias and all WordPress, Railway, Supabase, appointment, entitlement, allowlist, and feature-flag state remained unchanged.

## Safe release prerequisites

1. Coordinate completion/release of MX-CAL-4200C and re-read shared PHP bytes.
2. Add preference and Force Classic only under fresh SHARED:MISSIONMED-HUB custody with server authorization, validation, and audit.
3. Run designated-student acceptance including authenticated admin-route denial.
4. Obtain a fresh non-builder result.
5. Re-run all tests and the publisher dry run at the final commit.
6. Only then publish and post-verify.

Rollback is verified and ready: _SYSTEM/scheduler_publish.sh --rollback 98f87f6998eb
