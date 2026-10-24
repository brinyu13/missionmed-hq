# I1Q-1007X UX Workflow Baseline Audit

## Verdict

**BLOCK for the I1Q-1006 candidate.** The isolated application is a useful synthetic UI scaffold, but it does not provide complete, operable coverage of the workflows and states required for `INTERNAL_PRODUCTION_LIVE`.

This verdict is limited to the 1006 candidate at commit `0d6f78f2a2036731ec592398ce5fd845beb54333`, using the 1006 combined handoff with SHA-256 `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572`.

## Snapshot Boundary

The initial audit observed a dirty and lagging MissionMed OS checkout and missing I1Q registration. Those observations were made before the Root Supervisor's later recovery and registration work. They are historical snapshot facts only and **must not be repeated as current blockers**. Current authority and registration status belongs to the Root Supervisor's later evidence.

The release veto in this report remains active against the 1006 candidate because it is based on UI implementation, workflow coverage, and evidence defects directly verified in the candidate.

## Evidence Inspected

- `i1q-question-platform/public/index.html`
- `i1q-question-platform/public/app.js`
- `i1q-question-platform/public/styles.css`
- `i1q-question-platform/tests/ui.test.mjs`
- `i1q-question-platform/scripts/generate_evidence.mjs`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/I1Q_1006_COMBINED_HANDOFF.md`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/browser_results.json`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/accessibility_results.json`
- `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/evidence/ux_scorecard.json`
- Nineteen supplied desktop, tablet, and mobile screenshots

## Required Workflow Coverage

| Required workflow | 1006 coverage | Finding |
| --- | --- | --- |
| Dashboard | Partial | Metrics and blockers render, but the data is synthetic and the displayed foundation status is stale relative to the completed handoff. |
| Corpus inventory | Partial | One synthetic source row renders. Filtering is not wired and refresh is disabled. |
| Source detail | Missing | Static metadata beside the transcript is not a selectable, navigable source-detail workflow. |
| Privacy status | Partial | A single `Pass` badge is shown. There is no redaction record, class result, operator decision, or blocked-state workflow. |
| Transcript evidence | Partial | A fixed synthetic transcript renders without source selection, long-transcript behavior, partial-source recovery, or evidence navigation. |
| Extraction runs | Missing | The dashboard count is not a queue, run-detail, retry, checkpoint, failure, or resume workflow. |
| Candidate triage | Partial | One selectable row renders. Assignment, quarantine, rejection, bulk action, and candidate opening are unavailable. |
| Question authoring | Partial | Fields render and a local timer changes save text, but there is no persisted save, validation result, submission, or recovery. |
| Distractor review | Partial | Distractor rationale fields and one editorial checkbox exist, but there is no dedicated plausibility, accidental-correctness, misconception, or option-class review. |
| Evidence claims | Partial | A static claim renders. `Add claim`, currency review, and durable checklist behavior are not wired. |
| Editorial review | Partial | Rubric and decision buttons render, but decisions, notes, assignment identity, revision creation, and conflicts are not implemented in the UI. |
| Physician review | Partial, correctly blocked | The unassigned-governance block is visible, but the exact-revision, credential, conflict, and signed-decision workflow is not demonstrated. |
| Revision comparison | Partial | One static three-row comparison renders without revision loading, complete field diff, decision context, or navigation. |
| Search and filters | Partial | Controls render with fixed values; no search, filtering, sorting, pagination, or result navigation is wired. |
| Release assembly | Partial, correctly blocked | A static checklist renders. Preview, assembly, manifest review, promotion, and rollback identity are not operable. |
| Incidents | Partial | An empty state renders, while `Open incident` has no behavior and there is no triage, containment, or resolution flow. |
| Audit trail | Missing | No audit-event view, filtering, hash-chain status, actor history, or immutable-record inspection exists. |

Result: 12 named navigation surfaces are present for 17 required workflows. Five required workflows have no independently operable surface, and the remaining surfaces are mostly static demonstrations rather than end-to-end tasks.

## Required State Coverage

| Required state | 1006 coverage | Finding |
| --- | --- | --- |
| Loading | Partial | Generic loading markup exists; latency, cancellation, and repeated announcement were not tested. |
| Empty | Partial | Incident empty state exists; empty inventory, search, review, extraction, and release states do not. |
| Blocked | Partial | A global governance banner and disabled actions exist; blocked reasons are not consistently associated with controls. |
| Unauthorized | Partial | Boot converts any initial API error into `Authentication required`, conflating authorization, outage, and server failures. |
| Error | Partial | Generic view error and retry exist, but initial boot lacks equivalent retry and no domain errors are represented. |
| Partial source | Missing | No state. |
| Privacy blocked | Missing | No state. |
| Rights blocked | Missing | No state. |
| Expired evidence | Missing | No state. |
| Review conflict | Missing | No state. |
| Stale edit | Missing | No UI state despite service-level optimistic-lock concepts. |
| Concurrent edit | Missing | No state. |
| Extraction queued | Missing | No state. |
| Extraction running | Missing | No state. |
| Extraction failed | Missing | No state. |
| Extraction resumable | Missing | No state. |

Result: at most five generic states are represented, while all eleven domain-specific failure, concurrency, privacy, rights, evidence, and extraction states are absent.

## Interaction Findings

- Screen behavior is bound only for navigation, refresh, editor save-text timing, and generic retry.
- `Save draft`, `Add claim`, editorial decisions, release preview, and `Open incident` have no handlers.
- The editor says `Saved locally` without demonstrating persistence or a reload round trip.
- Search and filter controls do not change results.
- Navigation changes screen content without moving focus to the new heading or workspace.
- Disabled safety actions are visually explained nearby but lack consistent programmatic descriptions.
- No deep link, back/forward history, selected-record context, or unsaved-navigation warning is demonstrated.

## Persona Impact

- Physician reviewer: cannot perform or recover an exact-revision decision.
- Medical educator and editorial reviewer: cannot persist rubric outcomes or request a revision.
- Assessment scientist: cannot inspect distractor quality, variants, duplicate families, or item-quality evidence.
- Privacy officer: cannot inspect redaction evidence or resolve privacy blocks.
- Novice operator: sees controls that look active but do nothing, reducing trust and recoverability.
- Power operator: lacks bulk action, keyboard queue operation, pagination, sorting, and durable filters.
- Assistive-technology user: receives no validated focus transition or complete task evidence.
- Release manager and incident responder: cannot execute release or incident workflows.

## Gate Result

The 1006 candidate does not satisfy Phase 7 workflow/state coverage, Phase 14 browser and concurrency coverage, Phase 15 UX convergence, or the UI portions of Phase 16 staging certification. Re-audit is required after the repairs in `ui_repairs.md` are implemented and reproducibly tested.
