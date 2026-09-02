# MX-APPT-5003G production-gate record

Status: NOT DEPLOYED — final candidate pushed at `3a3f682567733075c97a00a07c42f55654182122`

## Passing gates

- Canonical authority, isolated base, source readback, real runtime-contract discovery, MX-APPT-5002 reconciliation, automated/runtime-contract checks, responsive/accessibility checks, clean local diagnostics, no migration, approved provider access, immutable rollback, shared-seam custody, account preference, audited Force Classic, and fresh non-builder verification of exact remote commit `3a3f682567733075c97a00a07c42f55654182122`: PASS.

## Mandatory hard stops

1. Designated allowlisted-student acceptance remains unavailable. The in-app browser and Chrome both resolve to the same Founder/Admin account; no substitute identity was used.
2. Student denial of authenticated live admin routes remains unwitnessed. The standalone server contract harness proves the `manage_options` gate returns false for a logged-in non-admin, but this does not replace designated-student live acceptance.

## Production checks

- Anonymous Scheduler bootstrap, appointment, history, and admin probes: HTTP 401.
- Authenticated Founder/Admin Scheduler route recovered from the earlier PHP-FPM timeout and loaded the real live catalogue with a clean browser console.
- Authenticated admin supported GET routes returned HTTP 200 in prior discovery: appointments, calendar-feed, availability-grid, appointment-types, analytics, audit-log, entitlements/config.
- Final candidate publisher dry run: PASS; planned immutable URL `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.28bce6b424e8.html` and LIVE alias update, with zero writes in dry-run mode.
- Public LIVE Scheduler remains SHA-256 `98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195`. Live shared PHP hashes remain on the recorded preimages.
- One bounded R2 write created the immutable current-live rollback object. Public readback is HTTP 200 with the exact live hash. The LIVE alias and all WordPress, Railway, Supabase, appointment, entitlement, allowlist, and feature-flag state remained unchanged.

## Safe release prerequisites

1. Run designated-student acceptance including authenticated admin-route denial.
2. Only then deploy the two exact shared PHP files and publish the guarded Scheduler bundle, followed by public hash, authenticated student/admin, responsive, console/network, and cross-product smoke verification.

Rollback is verified and ready: _SYSTEM/scheduler_publish.sh --rollback 98f87f6998eb
