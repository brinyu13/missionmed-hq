# I1Q-1007X Current UX Workflow Audit

## Current Scope

This is a read-only expert review of the current local Question Platform build at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at commit `4b154e8deb60ddf9a002f8a01a8fec90518b8966`; the later repository commit added offline datastore candidate files without changing any reviewed UI, server-shell, or UI-test hash.

The reviewed surface is the local synthetic internal application. This report does not certify staging, production, medical content, canonical authentication, real corpus use, or student release.

Browser execution was unavailable. No standalone Playwright or Computer Use substitute was used. Interaction findings come from source inspection, the repository test suite, and deterministic JSDOM simulation. Visual and assistive-technology findings remain unverified until genuine browser and human testing occurs.

## Evidence

Reviewed paths:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/index.html`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/styles.css`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/ui.test.mjs`

Reviewed file hashes:

| Path | SHA-256 |
| --- | --- |
| `public/app.js` | `21205e3c1d85293a4eb5e4e9a80ccf0623188e936d6ce594bb142daaa29e340c` |
| `public/index.html` | `664b5e7661ee1b8dbea8005097c6b6c8c10c336a97b2bc10c2393c4070227a49` |
| `public/styles.css` | `d1ebbb9cdf5c6c5cdb14af1e101a0f6b79d217507acee02e4a4096f6cca14cb8` |
| `src/server.mjs` | `eacdedd01ac4c3ca52becabbaad208109f677da3acdf08878d1a3fedc0bb094d` |
| `tests/ui.test.mjs` | `c8d60fb5c3127b795ab121c422bfdd69d63ea3e486bf4512e90767e9f2a540b4` |

## Findings

All required workflows and state fixtures now have deterministic local rendering coverage. Release remains blocked because selected source context is not reliably joined across workflows, expired evidence is omitted from editorial control eligibility, key responsive component styles are absent, focus and status continuity need repair, and no real browser or human validation exists.

## Workflow Findings

`DOM PASS` means the workflow rendered in deterministic JSDOM against the local synthetic API. It does not mean browser, visual, human, or production acceptance.

| Required workflow | Current result | Finding |
| --- | --- | --- |
| Dashboard | DOM PASS, partial | Counts, governance blockers, all six feature flags, and consumer guardrails render. The source is local synthetic data and no canonical session was exercised. |
| Corpus inventory | DOM PASS, unsafe handoff | Search and availability filters render, but `Open details` stores an inventory ID while Source detail expects a source-record ID. The selected record can drift. |
| Source detail | DOM PASS, blocked for traceability | Source, inventory, rights, and privacy data render, but the source is selected independently while inventory is always the first row at `app.js:552-553`. Multi-source evidence can be mislabeled. |
| Privacy status | DOM PASS, partial | All eight required privacy classes render and write controls are correctly blocked. Selection depends on the mismatched source identifier, so the displayed record is not reliably bound to the inventory choice. |
| Transcript evidence | DOM PASS, blocked for traceability | Safe segments and explicit availability render. The workflow uses the first inventory row and every returned segment at `app.js:666-667`, without binding artifact and segment rows to the selected source. |
| Extraction runs | DOM PASS, synthetic only | Queue, queued, running, failed, retry, checkpoint, and resume fixtures work in memory. They are labeled non-clinical and do not prove a persisted extraction service. |
| Candidate triage | DOM PASS, read-only | Sanitized metadata renders. Assignment, quarantine, and rejection remain blocked because no governed write route is exposed. |
| Question authoring | DOM PASS, partial | The explicit save route creates an immutable revision and checks current hash plus newest revision. Protected values are not prefilled. There is no durable draft recovery, and rerendered success feedback can lose focus. |
| Distractor review | DOM PASS, read-only | Four sanitized choices and review criteria render, while answer-aware review and durable review recording remain unavailable. |
| Evidence claims | DOM PASS, read-only | Claim text, authority, status, and expiry render. Governed evidence creation is intentionally unavailable. |
| Editorial review | DOM PASS, unsafe edge | Exact revision and assignment context render and a verdict can be submitted. `canReview` at `app.js:1019` omits the computed expired-evidence condition even though the page says expired evidence blocks verdict controls. |
| Physician review | DOM PASS, correctly blocked | The local role and unassigned medical governance keep approval controls unavailable. Canonical credential and actor integration were not exercised. |
| Revision comparison | DOM PASS, partial | The current fixture has one revision, so the empty state is reached. Static inspection shows a field table for two revisions, but no real-browser comparison task was executed. |
| Search and filters | DOM PASS, scale-limited | Query, status, sorting, and client pagination render. Only the first 200 revisions are requested, so the 10,000-plus queue requirement is not met. |
| Release assembly | DOM PASS, correctly blocked | Exact revision, medical approval, evidence currency, and consumer flags render. Promotion is unavailable and no staging release was assembled. |
| Incidents | DOM PASS, read-only | Immutable incident records and an empty state render. Incident creation is intentionally blocked because no governed route is exposed. |
| Audit trail | DOM PASS, partial | Filters, immutable event details, hashes, and sequence-link continuity render. The UI correctly disclaims cryptographic verification. Large-volume behavior is untested. |

## State Findings

All 16 required state fixtures rendered with the requested `data-state`, a recovery command, a synthetic-only boundary, and focused state heading in deterministic DOM simulation.

| Required state | DOM fixture | Natural workflow evidence | Current result |
| --- | --- | --- | --- |
| Loading | Yes, `status` | Initial and per-view loading markup | Partial, no latency or AT run |
| Empty | Yes, `status` | Inventory, triage, evidence, diff, search, incidents | Partial, no browser run |
| Blocked | Yes, `status` | Governance and release blocks | Partial, API paths not exhaustive |
| Unauthorized | Yes, `alert` | Physician role and API errors | Partial, canonical auth absent |
| Error | Yes, `alert` | Safe retry renderer | Partial, outage recovery untested |
| Partial source | Yes, `status` | Source and transcript availability | Partial, source binding defective |
| Privacy blocked | Yes, `status` | Source and privacy notices | Partial, governed resolution unavailable |
| Rights blocked | Yes, `status` | Source notice | Partial, governed resolution unavailable |
| Expired evidence | Yes, `status` | Evidence and review notices | Unsafe, editorial controls can remain active |
| Review conflict | Yes, `status` | Editorial conflict check | Partial, role matrix untested in browser |
| Stale edit | Yes, `status` | Newer-revision check before save | Partial, durable recovery absent |
| Concurrent edit | Yes, `status` | Revision and assignment hash checks | Partial, editor API conflict gets generic status |
| Extraction queued | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction running | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction failed | Yes, `status` | In-memory fixture | Synthetic only |
| Extraction resumable | Yes, `status` | In-memory fixture | Synthetic only |

## Persona Findings

- Physician reviewer: exact-revision identity is visible, but approval is correctly unavailable and real credentialed operation is untested.
- Medical educator and editorial reviewer: core forms exist, but expired evidence can contradict enabled controls and saved-feedback focus is unstable.
- Assessment scientist: distractor criteria are visible, but no answer-aware review or quality evidence can be recorded.
- Privacy officer: all eight classes are visible, but the selected source can map to the wrong privacy record.
- Novice operator: named navigation is comprehensive, while 17 destinations and partially available commands impose a high learning burden.
- Power operator: filters exist, but no shortcuts, bulk actions, durable views, or server-side large-queue navigation exist.
- Assistive-technology user: semantic foundations are useful, but focus continuity and status announcement behavior need real AT testing.
- Release manager: release gates are legible and fail closed, but no staging workflow or manifest inspection run is proven.
- Incident responder: audit inspection is present, but incident creation and operational containment are not available.

## Changes

No application, test, server, migration, evidence, feature-flag, or provider change was made. This report is the only change represented by this file.

## Tests

- `node --check public/app.js`: passed.
- `node --test tests/ui.test.mjs`: 6 of 6 passed.
- `npm test`: 196 passed, 0 failed, 1 skipped disposable-PostgreSQL test.
- Deterministic JSDOM workflow simulation: 17 of 17 workflows rendered without an error state, except Physician review intentionally included an unauthorized notice.
- Deterministic JSDOM state simulation: 16 of 16 state fixtures matched requested identity, role, focus, recovery command, and synthetic boundary.
- Semantic DOM scan: no unnamed controls, duplicate IDs, or broken `aria-describedby` and `aria-labelledby` references in the local synthetic render.
- `npm run validate`: failed closed with 19 current evidence errors.

## Risks

- A wrong source, inventory record, transcript segment set, privacy record, or rights record can appear under one selected context.
- Editorial reviewers can receive a visual expired-evidence block while decision controls remain enabled.
- Local synthetic interactions can appear more complete than the unavailable real datastore and canonical-auth experience.
- Client-only list loading cannot support the required large corpus safely or efficiently.
- The code-level semantic checks do not expose visual overflow, contrast, browser focus, or assistive-technology behavior.

## Blockers

1. Repair selected-record lineage across inventory, source, privacy, transcript artifact, and transcript segment views.
2. Include evidence currency in editorial decision eligibility and verify the server rejects stale evidence.
3. Complete current CSS and responsive behavior, then run real browser matrices.
4. Repair focus and live-status continuity after rerendering actions.
5. Pass genuine keyboard, screen-reader, zoom, reduced-motion, contrast, and target-size validation.
6. Complete the real human protocol before any UX or accessibility green claim.

## Confidence

- 0.98 in workflow and state source coverage findings.
- 0.97 in the source-selection and expired-evidence defects.
- 0.78 in visual and responsive risk severity because browser rendering was unavailable.
- 0.00 as a claim of real human validation or WCAG 2.2 AA conformance.

## Paths

Application root:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

Current audit directory:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/`

## Root Handoff

Root should preserve the UX release veto, treat the DOM passes as local synthetic engineering evidence only, and route the P0 repairs in `ui_repairs.md` before staging certification. Do not use this report to claim State C, medical approval, or student release.
