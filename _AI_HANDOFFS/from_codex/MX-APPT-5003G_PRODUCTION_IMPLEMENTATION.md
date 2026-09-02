# MX-APPT-5003G Production Implementation Handoff

RESULT: PARTIAL

Production deployment was not attempted because mandatory designated-student and authenticated student-role-denial gates remain unresolved. Fresh non-builder verification of the final candidate passed. The shared-seam blocker is resolved, and the isolated Scheduler candidate now includes the complete account preference and Force Classic implementation.

## Custody and authority

- Worktree: /Users/brianb/MissionMed_worktrees/mx-appt-5003g-production
- Branch: codex/mx-appt-5003g-production
- Final candidate commit: 3a3f682567733075c97a00a07c42f55654182122
- HQ base: 4c86e85c186c01561ded81e1927842cd2ce0e5fc
- Preserved stale branch: codex/mx-appt-5003g-precanonical-7409a82
- MissionMed OS authority: 214f1a989ebb67e179614b4b41b54698340227ef
- Mission/passport/authorities: MX-APPT-5003G; PRODUCT_PASSPORTS/scheduler.md; DR-164; DR-165
- Lease protocol: MR-079 Lease V2
- No primary or unrelated working tree was modified, reset, cleaned, stashed, or used as a donor.

## Reconciliation and implementation

MX-APPT-5002 was reconciled by inspecting its five commits and porting narrow Scheduler assets rather than merging D9.

LIVE/scheduler/scheduler_v1.html now contains the approved StoryForge Appointments Home, Eastern greeting, real catalogue discovery, truthful entitlement fail-close, Home prefill, schedule/upcoming/history surfaces, shared Details to Time to Review flow, real provider/day/time selection, legitimate-only Join, capability-gated reschedule/cancel, safe cancel dialog, Classic fallback over the same state/API, account-backed experience switching, server-authorized Force Classic handling, honest request states, stable retry idempotency, and responsive/accessibility repairs.

The existing Scheduler backend and auth remain authoritative. No second backend, datastore, business rule, migration, entitlement, allowlist, fake record, or meeting URL was created.

## Candidate files

- LIVE/scheduler/scheduler_v1.html
- wp-content/plugins/missionmed-hub/assets/scheduler-mount.js
- wp-content/plugins/missionmed-hub/includes/class-mmed-feature-flags.php
- wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php
- _SYSTEM/SCHEDULER_SOURCE_LOCK.json
- _SYSTEM/scheduler_publish.sh
- _SYSTEM/DEPLOY_MANIFEST_SCHEDULER.json
- _SYSTEM/tools/scheduler_patch_audit.mjs
- _SYSTEM/tools/scheduler_grid_benchmark.mjs
- _SYSTEM/tools/scheduler_adapter_parity.mjs
- _SYSTEM/tools/scheduler_patch_expectations.json
- tests/scheduler/mx-appt-5003g-storyforge.spec.mjs
- tests/scheduler/mx-appt-5003g-preview-server.mjs
- this handoff and evidence directory

Database migrations: none.

## Validation

- Node suite PASS: 3 tests, 0 failures; 74 static/product/safety assertions plus 5 PHP source-contract assertions.
- Standalone PHP contract harness PASS: 10 checks for route registration, account persistence, non-admin denial, admin authorization, audit, override preservation, and reversibility. PHP syntax PASS.
- Patch audit PASS: 12 of 12. Adapter parity and JavaScript syntax PASS.
- StoryForge and Classic PASS at 390, 768, 1024, 1440 with zero overflow, clipped controls, or undersized practical targets.
- Browser diagnostics: zero runtime exceptions, console errors, warning/error messages, or network failures.
- Indexed grid benchmark: 0.93 to 2.46 ms through 200 slots.
- Final browser pass at exact 390, 768, 1024, and 1440: both presentations have zero page overflow, zero clipped visible controls, zero sub-44px visible controls, and zero warning/error console messages.
- Fresh non-builder read-only verification PASS for exact remote commit `3a3f682567733075c97a00a07c42f55654182122`; it independently covered custody, authorized diff, syntax/tests, performance, preference/Force Classic semantics, shared state, responsive behavior, rollback, and publisher dry-run zero-write behavior.
- No live booking, reschedule, cancel, preference, flag, database, alias, or deployment mutation. The only earlier provider write created the exact content-addressed rollback object described below.

## Rollback

The guarded publisher now supports an explicit --capture-live-rollback action. Using approved credentials sourced in process from the primary checkout, it required the public LIVE bytes to match the adopted full SHA-256 before writing the missing immutable object.

- Immutable URL: https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.98f87f6998eb.html
- Public result: HTTP 200
- Public SHA-256: 98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195
- LIVE alias after capture: unchanged, HTTP 200, same full SHA-256
- Rollback command: _SYSTEM/scheduler_publish.sh --rollback 98f87f6998eb

## Preference and Force Classic

MX-CAL-4200C released its shared leases with provider-clear readback. Fresh live hashes matched the preserved PHP preimages exactly before Appointments acquired `SHARED:MISSIONMED-HUB`.

The candidate adds `GET/POST /wp-json/mmed/v1/me/appointments-experience` for the current logged-in account and `GET/POST /wp-json/mmed/v1/admin/appointments-experience` for `manage_options` administrators. The preference is restricted to `classic|storyforge`. Force Classic is an existing-registry feature flag named `appointments_force_classic`; it changes presentation only, preserves the user's preference underneath, is rapidly reversible, and records a bounded 50-entry admin audit ledger. No migration or appointment-record write is involved.

The Scheduler consumes the existing Matrix `window.MMED_OS.api` nonce/auth client, so no Student OS, Matrix shell, mount adapter, CSS, or runtime-lock edit was required.

FORCE CLASSIC: PASS — candidate implementation and local authorization contract. Live acceptance remains gated on deployment and designated-student verification.

## Hard stops

1. No designated allowlisted-student credential is available. Both the in-app browser and Chrome hold the same Founder/Admin identity.
2. Authenticated live student denial of Scheduler Ops is unwitnessed. The local server contract denial passes but is not promoted to live acceptance.

LIVE remains unchanged at 98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195.

## Continuation

1. Provide or open an already-authenticated designated allowlisted-student session; do not share a password in chat.
2. Run student end-to-end acceptance, including direct admin-route denial.
3. Only if both student gates pass, deploy the two exact PHP files, run syntax/route readback, publish the guarded Scheduler bundle, public-hash verify, and complete authenticated post-release and cross-product smoke QA.

ROLLBACK: VERIFIED

## Evidence

- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/01-authority-runtime.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/02-validation.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/03-production-gates.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/validation-summary.json

PRODUCTION DEPLOYMENT: NOT DEPLOYED

FINAL STATUS: BLOCKED — HUMAN ACTION REQUIRED @GitHub @Supabase @Browser @Computer
