# MX-MISSIONACCOUNTS-5401R

Recorded 2026-09-07; final HTTP/provider readback 2026-09-07T04:47:30.118310+00:00. All times UTC unless stated otherwise.
**Engineering repair deployed; task remains PARTIAL / NOT READY for reopening or 5402A.** FAIL below means the requested acceptance criterion is unmet, including an unperformed witness; it does not necessarily mean the repaired code failed a test. This is not Founder acceptance.

## Status of six required persisted witnesses

**0/6 complete genuine-role production UI witnesses.** The backend transactions, UI repairs, authorization/undo regressions and six capability flags are deployed. Unit, API, disposable database and synthetic UI checks do not satisfy the required real Dr J/student UI→API→authoritative DB→reload→history→other-role→undo chain.

| Family | Deployed engineering behavior and test evidence | Complete requested witness |
|---|---|---|
| Contacts | Await accepted name/email/phone save; preserve stable student UUID across roster reorder; clear to null; validate and audit; local synthetic email save/reload/clear confirmed | FAIL — real Dr J edit, production DB/history, student propagation and final restore not witnessed |
| Attendance corrections | Existing add/remove/relabel correction transaction, reason and audit/undo custody preserved; visible adapter awaits successful result; private raw source is not edited | FAIL — genuine UI/DB/role/undo sequence not witnessed |
| Billing decisions | Per-day/full-cycle/UCC/MUL/options wired; audited stable exact-ID batches, partial conflict reporting and bounded reversal; one inverse; provider-custody guard; policy clear and $300 historical cap guards tested | FAIL — genuine UI/DB/role/reversal sequence not witnessed |
| Identity adjudication | Same/different/unsure/canonical/device handling awaits server; current UUID selection; reversal and financial-domain guards; no invented human resolution | FAIL — genuine UI/DB/role/reversal sequence not witnessed |
| Exam plans | Existing authoritative select/submit/edit/withdraw/review/grace/passed state machine retained; current latest nonwithdrawn/nonsuperseded plan selection and async UI handling repaired; regression suite passes | FAIL — complete real student/Dr J sequence, reminder/grace/report UI witness not performed |
| Comp days | After-2026-09-05 default five and explicit zero override semantics repaired; reason required, prospective transaction and audit tested; local required-reason dialog error verified | FAIL — real Dr J/student persisted propagation/restore not witnessed |

Billing batches use immutable receipt, exact 1–100 student IDs, deterministic locks, expected amounts/snapshots and per-item subtransactions. The UI accepts partial success and keeps held reasons visible. Reversal permits only one inverse and refuses any dispatched/provider-bound billing custody, including failed/prepared provider dispatch. It can void only eligible internal provider-free drafts. No production invoice, charge, consent or decision was created by this task.

Working policy no longer applies pending review choices as confirmed policy. Clear uses consistent cycle→student→invoice locks. One calendar date remains one billable day even when two legitimate Step sessions exist; valid historical full-cycle $300 cap remains server-controlled. READY does not imply collectible. Automated charge code tests do not enable Live billing.

## Capability closure matrix

All six rows have API implementation, authoritative DB transactions, authorization, audit, reload-backed projections, supported reversal/restore semantics, and frontend bindings exercised by engineering tests. `student_contacts`, `attendance_corrections`, `billing_decisions`, `identity_review`, `exam_plans`, and `comp_days` were enabled at 04:25–04:26 UTC only after those tests passed. **Real-role tested = NO for every row.**

Runtime authority is the six Railway environmentConfig values. Separate DB feature_flag rows were audited with request `mx-missionaccounts-5401r-core-capabilities-enabled-20260907`, one `capabilities.enabled` event, exact preimages in `from_val`, existing three-user SSO pilot scope and public closed posture stated. The DB table alone does not enforce runtime flags; other legacy flag rows were left unchanged. Public Matrix remains 503 and final entitlement still needs repair. Auto billing false and Test-only existing integration were preserved.

## Four navigation repairs and limited browser proof

| Original visible control | Repaired route / destination | Bounded evidence |
|---|---|---|
| Start with the questions | `#/cycle/june#attention` | Exact route automated regression; original control clicked in synthetic browser, June attention rendered |
| Billing Details | `#/billing?cycle=all#rule` | Original Details clicked and keyboard-activated; rule detail rendered; reload/back checked |
| Data controls | `#/advanced/controls` | Original Advanced tools → Data controls clicked; data control totals rendered; reload/back checked |
| Classes | `#/advanced/sessions` | Original control clicked; class/source crosswalk rendered; deep-link reload and keyboard link checked |

Secondary fragment parsing and URLSearchParams fixed the original navigation failures. Data Controls and Classes now receive authoritative shapes. Recoverable route failures clear the old screen. Student routes are forced to own `#/me` view when navigating/back/deep-linking to admin paths; administrative preview is hidden for students. This role routing has automated coverage, not a real student browser witness.

The browser harness served the repaired production HTML on loopback with explicitly synthetic data and local PreviewStore. It did not contain production credentials or connect to the production DB. Actual CSS viewport measurements were 1440×900 and 1024×768; the browser's inherited 50% zoom meant tool viewport requests were not CSS widths. The attempted 390 setting never established 390 CSS pixels, so no mobile pass is reported.

At 1440/1024, limited navigation, reload/back, keyboard activation, synthetic student detail and error recovery were exercised. Console warning/error readback was empty during the observed smoke checks. The comp dialog fit 1024×768 and remained open when a missing reason produced its explicit error. A synthetic email save survived reload; clearing via keyboard and Save produced “Email cleared” and local API email null. An empty-string fill did not actually clear the browser field; keyboard select-all/backspace resolved the automation input issue without changing application source.

The local PreviewStore does not implement new billing batch RPC persistence; HTTP tests use explicit stubs while real PostgreSQL fixtures independently test transaction semantics. Do not combine those into an unperformed end-to-end proof. The temporary loopback server was stopped after checking its PID/command identity, and the browser viewport override was reset. No production student contact or other pilot workflow data was mutated during these checks.

## Remaining exact witness protocol

Use safe reversible pilot fixtures, not historical approved truth. Establish genuine Dr J and two student browser sessions after correct mapping and controlled gateway access exist. For each family capture a sanitized pre-state reference, click the original visible UI, correlate the stable request ID with the API response, verify authoritative DB row/version and audit actor/time/reason, reload the UI, verify own/other-role visibility, execute supported undo/reversal or explicit audited restore, and compare final state. Contacts restore fields through another audited save; workflow reversals must follow their specific transactions. Do not expose private records in the shared filing.

Run those workflows plus Matrix entry, search, cycle switch, reports, student exam/concern flows, dialogs and recovery at actual CSS 1440, 1024 and approximately 390. No View As, server-issued test token, local preview or passing unit count substitutes for these witnesses.

Evidence: [local-validation.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/local-validation.json), [local-browser-summary.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/local-browser-summary.json), [core-capability-activation.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/core-capability-activation.json), [principal-api-probes.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/principal-api-probes.json), [final-provider-readback.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/final-provider-readback.json).

Sanitized evidence commit: `f3f3d0c1dfc2880891cc4d0a7a1be15c481830dc`. Final filing review corrected the 498 human-cycle-row label and redacted two student UUIDs from denied-request paths before remote push.
