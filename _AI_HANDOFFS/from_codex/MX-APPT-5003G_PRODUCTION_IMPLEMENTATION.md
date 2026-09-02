# MX-APPT-5003G Production Implementation Handoff

RESULT: PARTIAL

Production deployment was not attempted because mandatory rollback, credential, designated-student, authenticated student-role-denial, independent-verifier, and shared-seam gates remain unresolved. The isolated Scheduler candidate is implemented, locally validated, and suitable for continuation after those gates are satisfied.

## Custody and authority

- Worktree: /Users/brianb/MissionMed_worktrees/mx-appt-5003g-production
- Branch: codex/mx-appt-5003g-production
- HQ base: 4c86e85c186c01561ded81e1927842cd2ce0e5fc
- Preserved stale branch: codex/mx-appt-5003g-precanonical-7409a82
- MissionMed OS authority: 214f1a989ebb67e179614b4b41b54698340227ef
- Mission/passport/authorities: MX-APPT-5003G; PRODUCT_PASSPORTS/scheduler.md; DR-164; DR-165
- Lease protocol: MR-079 Lease V2
- No primary or unrelated working tree was modified, reset, cleaned, stashed, or used as a donor.

## Reconciliation and implementation

MX-APPT-5002 was reconciled by inspecting its five commits and porting narrow Scheduler assets rather than merging D9.

LIVE/scheduler/scheduler_v1.html now contains the approved StoryForge Appointments Home, Eastern greeting, real catalogue discovery, truthful entitlement fail-close, Home prefill, schedule/upcoming/history surfaces, shared Details to Time to Review flow, real provider/day/time selection, legitimate-only Join, capability-gated reschedule/cancel, safe cancel dialog, Classic fallback over the same state/API, honest request states, stable retry idempotency, and responsive/accessibility repairs.

The existing Scheduler backend and auth remain authoritative. No second backend, datastore, business rule, migration, entitlement, allowlist, fake record, or meeting URL was created.

## Candidate files

- LIVE/scheduler/scheduler_v1.html
- wp-content/plugins/missionmed-hub/assets/scheduler-mount.js
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

- Node suite PASS: 2 tests, 0 failures; 72 static/product/safety assertions.
- Patch audit PASS: 12 of 12. Adapter parity and JavaScript syntax PASS.
- StoryForge and Classic PASS at 390, 768, 1024, 1440 with zero overflow, clipped controls, or undersized practical targets.
- Browser diagnostics: zero runtime exceptions, console errors, warning/error messages, or network failures.
- Indexed grid benchmark: steady 0.95 to 2.85 ms with parity through 108 slots.
- No live booking, reschedule, cancel, preference, flag, database, or deployment mutation.

## Preference and Force Classic

No production Appointments preference route exists. The candidate truthfully labels a current-session switch and never claims account persistence.

The bounded server preference and auditable Force Classic flag require the shared Hub REST and feature-flag seam. MX-CAL-4200C is renewing SHARED:MISSIONMED-HUB; Lease V2 denied concurrent mutation. No shared PHP patch was applied.

Two byte-exact, unmodified live PHP preimages remain untracked under wp-content/plugins/missionmed-hub/includes. Do not commit, change, or remove them until shared custody is available and their live hashes are re-read.

FORCE CLASSIC: FAIL — implementation blocked by active shared-domain custody.

## Hard stops

1. Live hash 98f87f6998eb has no public immutable version; expected URL is HTTP 404.
2. R2 credentials are absent; even canonical publisher listing cannot authenticate.
3. No designated allowlisted-student credential is available.
4. Authenticated student denial of Scheduler Ops is unwitnessed.
5. Fresh non-builder verification is outstanding.
6. Preference and Force Classic shared seam is lease-blocked.

LIVE remains unchanged at 98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195.

## Continuation

1. Safely complete/coordinate MX-CAL-4200C and re-read shared PHP hashes.
2. Under fresh SHARED:MISSIONMED-HUB custody, implement/test the account preference and audited Force Classic override, or explicitly accept omission.
3. Create and verify immutable scheduler_v1.98f87f6998eb.html without repointing LIVE.
4. Provide approved R2 credential access.
5. Run designated-student QA including admin-route denial.
6. Obtain fresh non-builder verification.
7. Re-run all gates and publisher dry run at final commit.
8. Only then publish, public-hash verify, and run post-release authenticated QA.

Rollback after the legacy object exists: _SYSTEM/scheduler_publish.sh --rollback 98f87f6998eb

## Evidence

- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/01-authority-runtime.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/02-validation.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/03-production-gates.md
- _AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/validation-summary.json

PRODUCTION DEPLOYMENT: NOT DEPLOYED

FINAL STATUS: BLOCKED — HUMAN ACTION REQUIRED @GitHub @Supabase @Browser @Computer
