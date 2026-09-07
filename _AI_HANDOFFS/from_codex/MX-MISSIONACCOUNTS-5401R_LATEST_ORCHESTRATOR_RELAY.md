# MX-MISSIONACCOUNTS-5401R — Latest Orchestrator Relay

Recorded 2026-09-07 from the latest filed reports and provider readbacks. This relay is the current thread status for orchestration.

## Executive status

The bounded 5401R engineering repair is deployed and evidence-filed, but the product has **not** reached full AAA acceptance or a fully functional public deployment. MissionAccounts remains intentionally closed at the Matrix/WordPress gateway with a generic HTTP 503. The direct Railway backend is healthy, the source-preserving Zoom repair is applied, and the six core capabilities are deployed behind the current signed-principal/pilot access layer.

Do not report “AAA successful,” “Founder accepted,” “Matrix reopened,” or “READY FOR MX-MISSIONACCOUNTS-5402A.” Those claims require the remaining security, entitlement, genuine-role, persistence, responsive, and independent acceptance gates below.

## What this thread accomplished

### Source and authority custody

- Repair worktree: `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R`
- Branch: `codex/mx-missionaccounts-5401r`
- Deployed application source: `48e4283277e9601b6026bd09bd177216582b8fbb`
- Latest evidence/report filing commit: `669578f7607cfc28df180479f254a21de9e6b152`
- Remote branch was verified at that filing commit.
- Original dirty donor worktree was preserved.
- Approved 5300A canon was preserved at SHA `3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8`.
- Fresh universal and 5401R BOOT validation passed before filing.
- No shared Matrix bundle or stale donor was overwritten.

### Production application and WordPress changes

- Repaired application image deployed successfully through Railway. Latest app deployment: `8b38d28f-a285-47f7-8096-9f7aa852d43a`; image: `sha256:d676f9ffb57e311bd82abcf20a65d26d01e4dd31dfaade7d1942f3baa20fd376`.
- Private auth/session lifecycle was hardened: stale-generation rejection, full principal comparison, private state clearing on logout/page lifecycle, reload on principal change, private response headers, and protected error handling.
- Navigation and workflow adapters were repaired for the four previously failing action families: Start with the questions, Billing Details, Data controls, and Classes.
- Awaited transaction handling, durable audit/history, stable student UUID selection, bounded billing batch/reversal behavior, policy clear, identity/device protections, exam-plan selection, comp-day reason handling, and source-health display were implemented and regression-tested.
- Dedicated WordPress MU route and SSO files were backed up, syntax-checked, deployed, and hash-verified.
- The unconditional public 503 guard was deliberately retained.

### Supabase and Zoom repair

- Four new reviewed migrations were applied to the isolated MissionAccounts Supabase project.
- Guarded audited repair receipt: `44f24da2-b69e-4a20-af39-ec9d87a393d0`.
- Canonical historical classes now read June `34`, July `35`, August `31`.
- Raw evidence and physical event custody were preserved: `5575` source rows, `4018` physical events, `3941` effective events.
- `72` participant occurrences are exact corroborations; `5` remain unresolved and held for review.
- `76` duplicate-derived technical student projections/attendance days were retired from the active projection without deleting source evidence.
- Final database readback: `0` invoices, `0` charges, `0` consents, `0` billing decisions, `0` running reconciliations.
- Production historical replay returned duplicate/idempotent with no new mappings, identities, corroborations, historical recomputation, or billing effects.
- Raw, historical, financial, and operation integrity checks remained unchanged after replay.

### Capability activation and worker state

- Exactly six core capability variables were enabled after implementation and transaction/security tests: contacts, attendance corrections, billing decisions, identity review, exam plans, and comp days.
- Activation was audited with preimages. Real-role witness status remains `NOT_VERIFIED` for every capability.
- Live charging and automatic billing remain disabled. Production `/api/config` reports payment setup disabled, mode disabled, and no publishable key.
- The dedicated Zoom worker was paused during repair, then restored with the same verified image. It is now scheduled for `30 6 * * *` UTC; the next actual scheduled execution had not yet been witnessed when this report was filed.

### Verification completed

- Source validation passed.
- Node suite passed `176/176`.
- Disposable PostgreSQL migration/transaction tests passed, including two-connection concurrency and retirement race checks.
- Historical import/replay verification passed.
- Targeted privacy, auth, workflow, navigation, billing, canonicalization, and UI regression tests passed.
- Direct signed-principal HTTP probes passed for Founder, two existing pilot student principals, anonymous denial, alternating principals, and foreign-student authorization denial. These were engineering probes using process-memory tokens, not genuine browser acceptance.
- Limited synthetic browser smoke passed at actual CSS dimensions `1440×900` and `1024×768` for navigation, reload/back, keyboard activation, synthetic student detail, contact save/clear, and required-reason error recovery. The requested `390` CSS-pixel workflow was not established.

## What is still required for full AAA and fully functional deployment

### P0 privacy and controlled reopening

1. Obtain and verify an unconditional Kinsta origin/full-page/Nginx and Edge cache exclusion for the complete `/missionaccounts` namespace, including the dedicated SSO token endpoint and private descendants. It must not depend on cookies, Authorization headers, query parameters, or method quirks.
2. Retain the generic 503 for all non-controlled traffic while provider rules are verified. A final probe observed a generic unsupported token-route GET returning `X-Kinsta-Cache:HIT` despite `no-store`; no private payload was exposed, but this proves headers alone are insufficient.
3. Establish a controlled provider source-IP admission path for QA, with all other sources still receiving 503.
4. Run the complete same-canonical-URL matrix: anonymous, Founder, real Dr J, Student A, Student B, alternation, reload/warm request, logout, clean browser, and repeated requests. Capture safe identity proofs and cache headers without exporting cookies, tokens, names, emails, or private payloads.
5. Reopen the route only after every matrix row passes. Any cross-user anomaly immediately restores containment.

### Matrix integration and entitlement

1. Resolve the stale shared Matrix runtime warning with the current runtime owner and authority record. The live Matrix controller/JS/CSS hashes differ from the applicable locked runtime; the previous thread correctly stopped before shared mutation.
2. Implement or verify a real Matrix discovery/active-app/family-return seam under a separate exact shared-domain fence.
3. Replace the temporary three-user SSO allowlist with server-authoritative entitlement discovery for the intended product and roles. Existing provider observations are not enough to hardcode a final entitlement model.
4. Prove that entitled users can discover/open MissionAccounts naturally and non-entitled users cannot.

### Genuine Dr J and student acceptance

1. Identify the intended real Dr J WordPress account and verify its product mapping.
2. Obtain genuine authenticated browser sessions for Dr J and two distinct students through normal login. Do not use View As, synthetic PreviewStore data, or server-issued test tokens as substitutes.
3. Prove own-record-only student visibility, no admin/provider jargon, correct payment-disabled messaging, student attendance/report flow, exam/comp/grace display, logout safety, and mobile behavior.

### Six complete persisted workflow witnesses

For each workflow, record pre-state, visible UI action, API response, authoritative DB row/version, reload persistence, audit/history, correct other-role visibility, and supported undo/reversal/final-state proof:

- Contacts
- Attendance corrections
- Billing decisions, including valid cap/UCC/MUL/no-charge and reversal cases
- Identity adjudication and device/class ambiguity
- Exam plans, approval/date changes, grace/passed/reminder behavior
- Comp days, including default five-day behavior, override reason, prospective state, and audit

Current count is **0/6 complete genuine-role production UI witnesses**. Backend tests and synthetic UI smoke do not close this gate.

### Responsive and payment acceptance

- Repeat actual real-role workflows at CSS widths approximately `1440`, `1024`, and `390`, verifying dialogs, overflow, keyboard activation, error recovery, search, reports, exam flow, billing review, and student entry.
- Complete a fresh safe Stripe Test/provider witness if required by the independent audit. Keep Live charging, automatic billing, real cards, real invoices, and real money movement disabled.
- Capture the first successful post-resume daily worker execution and its no-duplicate/no-billing-effects readback.

### Independent closure

- Update the five filed reports with the new evidence only after the gates pass.
- Keep builder engineering evidence separate from Founder acceptance.
- Have the independent MX-MISSIONACCOUNTS-5402A auditor perform the full re-acceptance audit.
- Only then may the status change to AAA-successful, fully functional, and ready for 5402A.

## Current human/provider dependencies

- Explicit authorization is still needed before sending the prepared Kinsta support request; it has not been sent.
- Kinsta must provide effective exclusion and controlled-QA confirmation.
- The current Matrix runtime owner must reconcile the stale controller/runtime lock.
- The user must identify the real Dr J account and provide access to genuine Dr J and two student browser sessions without sharing passwords or tokens.

## Source reports and sanitized evidence

- [Repair completion](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_REPAIR_COMPLETION.md)
- [Security and reopening evidence](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_SECURITY_REOPENING_EVIDENCE.md)
- [Zoom reconciliation](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_ZOOM_RECONCILIATION.md)
- [Workflow witnesses](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_WORKFLOW_WITNESSES.md)
- [5402A continuation handoff](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_TO_5402A_HANDOFF.md)
- Sanitized evidence directory: `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R`

## Orchestrator instruction

Treat this relay as a status and continuation brief, not as a release approval. Preserve the public 503 and the current rollback posture until the P0 cache/security matrix and every required genuine-role AAA witness pass. Do not infer full functionality from the passing automated suites, provider deployment state, or pilot HTTP probes.
