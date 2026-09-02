# MX-APPT-5003G-R1 Production Implementation Handoff

RESULT: BLOCKED_BACKEND_CANCEL / SAFE_ROLLBACK_COMPLETE

Founder visual approval was received. Three guarded V2 activations were published immutably, hash-verified, tested in the designated authenticated student session, and rolled back on material failures. The latest candidate repairs live provider hydration and safely reconciles a reschedule that commits before a downstream backend error. Live cancellation still fails in the read-only backend and does not commit, so production is healthy on the byte-exact V1 artifact and V2 is not active.

## Current truth

- Ticket: `MX-APPT-5003G-R1`
- Worktree: `/Users/brianb/MissionMed_worktrees/mx-appt-5003g-production`
- Branch: `codex/mx-appt-5003g-production`
- Authority: `PRODUCT_PASSPORTS/scheduler.md`, DR-164, DR-165; canonical authority commit `214f1a989ebb67e179614b4b41b54698340227ef`
- Production alias: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html`
- Live SHA-256, freshly read back: `98f87f6998ebce9280dacf9363d86f11016fe1e31ce46f2e52e5e636ea75f195`
- Immutable rollback artifact: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.98f87f6998eb.html` — HTTP 200
- Rejected V2 deployed: NO — it was previously active, then rolled back; it is not the current live alias.
- Candidate source: `LIVE/scheduler/scheduler_v1.html`
- Candidate SHA-256: `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`
- Candidate bytes: `292441`
- Candidate immutable artifact: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.e9e480a9c72b.html` — byte-verified.
- Deterministic local review route: `http://127.0.0.1:8765/#home`
- Production deployment: attempted under guarded QA, then rolled back. V2 is not the LIVE alias.

## Preserved engineering

The implementation retains the MX-APPT-5002 repairs, real authentication/API/persistence/entitlement/allowlist/provider contracts, booking/cancel/reschedule behavior, shared Classic/StoryForge state, account-backed experience preference, audited reversible Force Classic, deterministic publishing, rollback tooling, performance work, and capability-gated actions.

No Scheduler backend, business rule, datastore, entitlement policy, allowlist, migration, fake meeting URL, or unrelated Matrix product was introduced or changed. Classic remains available over the same shared core.

## R1 presentation result

- StoryForge shell: PASS
- Left app rail: PASS
- R1 Home: PASS
- R1 Search: PASS
- Book Details: PASS
- Book Time: PASS
- Book Review: PASS
- Upcoming: PASS
- History: PASS
- Settings: PASS
- 1440: PASS
- 1024: PASS
- 768: PASS
- 390: PASS — exact-width capture, no page-level horizontal overflow; the day strip scrolls internally.

The candidate now uses the approved 64px header, 200px desktop rail, ember skewed CTAs and active navigation, Archivo/Rajdhani/Lora type roles, italic 900 editorial headings, cyan selected states, discovery-led Home, grouped search results, day-first time selection, date-tile appointment rows, settings ledger, and responsive bottom navigation.

## Validation

- Node Scheduler suite: 6/6 PASS, including provider hydration, real reschedule endpoint selection, and post-error server-readback reconciliation.
- Patch audit: 12/12 PASS.
- Adapter source changed: NO. Current-adapter parity harness is byte-identical.
- Grid benchmark: 24–200 slots remained under 2.4 ms; all `<=16ms` checks PASS and slot-button parity holds.
- `git diff --check`: PASS.
- Deterministic browser diagnostics: 0 runtime exceptions, 0 console warnings/errors, 0 log warnings/errors, 0 network failures.
- Exact 390 instrumentation: `innerWidth=390`, root/body scroll width `390`, Book Time main scroll width `390`.
- Provider Lease V2 readback for this remediation owner/session: no active leases remain.

Authenticated student QA additionally proved StoryForge rendering, real catalogue, Upcoming and History reads, safe cancel confirmation, Matrix Calendar continuity, successful reschedule/readback reconciliation, immutable publication, and exact rollback. Booking/conflict and complete post-deploy responsive/admin-denial acceptance were not continued after cancellation triggered the mandatory rollback gate.

## Evidence

- Side-by-side board: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/comparison-board.png`
- Interactive comparison: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/comparison-board.html`
- Fidelity matrix: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/fidelity-matrix.md`
- Screenshot manifest: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/screenshot-manifest.md`
- QA summary: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/qa-summary.md`
- Browser diagnostics: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/browser-diagnostics.json`
- Viewport measurements: `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/viewport-checks.json`

Required PNG set is present: seven 1440 captures, five 390 captures, plus 1024 Home and 768 Book Time.

## Live release gate

HARD STOP: the authenticated cancel endpoint returns `Cannot read properties of null (reading 'metadata')`. Fresh Upcoming and Matrix Calendar readback both show the appointment still active, so cancellation did not commit. DR-165 keeps Scheduler backend modules read-only; backend correction needs exact additional authority and its own release verification.

The authorized QA reschedule first moved the test appointment, exposed a post-commit downstream exception, and was then safely reconciled by fresh server readback. Final QA restored that appointment to its original time before cancellation was tested. The failed cancel did not alter it.

Direct student navigation to the admin preference endpoint was blocked by the designated Chrome extension before an application response could be observed. No authenticated admin-denial claim is made.

PRODUCTION: STABLE V1 / BYTE-EXACT ROLLBACK VERIFIED

V2: IMMUTABLE CANDIDATE ONLY (`e9e480a9c72b...`)

DEPLOYMENT: BLOCKED BY READ-ONLY BACKEND CANCELLATION FAILURE

See `_AI_HANDOFFS/from_codex/MX-APPT-5003G-evidence/visual-fidelity-r1/live-deployment-qa.md` for the activation chronology and bounded evidence.
