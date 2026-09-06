# I1Q-1008A UX Repair Register

## Status

`SIMULATED RECOMMENDATIONS AND LOCAL RETEST RESULTS`

Exact candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

This document recommends repairs only. This agent did not edit product code, deploy, change flags, or use production data.

## Score Movement

| Measure | Immediate predecessor `483b0f7` | Current `fd7ddcd` | Target |
| --- | ---: | ---: | ---: |
| SIMULATED aggregate | 8.04 | 8.21 | At least 9.0 |
| Minimum category | 6.8 task speed | 6.8 task speed | At least 8.5 |

The current score increase is limited to observed local improvements. It does not credit unexecuted staging, identity, assistive-technology, cross-browser, or human work.

## Closed Local Repairs

### UX-CLOSED-001: Contain table overflow at the independent scroller

Status: `CLOSED LOCALLY`

Repair evidence:

- `.table-wrap` now has `position: relative`, bounded width, and independent horizontal overflow at `public/styles.css:516-525`.
- Regression assertions are at `tests/ui.test.mjs:437-448`.
- Root width equaled viewport in all 187 workflow and 176 state cells.
- Corpus inventory, Extraction runs, Search and filters, and Audit trail passed at both 320 and 768 while retaining wider table scroll widths.
- Direct 320-pixel gesture evidence kept `window.scrollX=0` and moved the Inventory table to `scrollLeft=300`.

Retest still required externally:

1. Native 200 and 400 percent browser zoom.
2. Keyboard and screen-reader operation of every named table region.
3. Supported browsers and real touch devices.

### UX-CLOSED-002: Show the full Physician attestation hash

Status: `CLOSED LOCALLY`

Repair evidence:

- The signed-decision field uses the full `revision.content_hash` at `public/app.js:1423-1427`.
- The browser rendered a 64-character SHA-256 at 320 pixels with no `title` and no root overflow.
- Regression assertion is at `tests/ui.test.mjs:462-468`.

### UX-CLOSED-003: Add mobile environment spacing

Status: `CLOSED LOCALLY`

Repair evidence:

- Wrapping flex and explicit 4-pixel row by 8-pixel column gaps are at `public/styles.css:155-161`.
- Computed values matched at 320, 375, 390, and 430.
- Actor and environment context remained present in all 68 phone workflow cells.

### UX-CLOSED-004: Preserve pagination, mobile context, target geometry, and full visible hashes

Status: `CLOSED LOCALLY`

Repair evidence:

- Pagination rules are at `public/styles.css:672-689`; all 11 Search viewports showed 44-pixel-high Previous and Next controls without clipping.
- Mobile layout is at `public/styles.css:963-1008`; the expanded 17-item menu had zero horizontal clips at all four phone widths.
- Refresh remained 44 by 44 in all 187 workflow cells.
- No `.hash-text[title]` or incomplete exact Physician hash remained.

## Open Product Repairs

### UX-P0-001: Complete the governed workflow contract

Priority: `P0 RELEASE BLOCKER`

Evidence:

- Candidate disposition remains disabled or read only at `public/app.js:1006-1028`.
- Privacy decision remains disabled in `public/app.js:794-846`.
- Rights resolution has no dedicated governed client command.
- Distractor verdict is disabled at `public/app.js:1146`.
- Editorial assignment creation, reassignment, and decline are absent from `public/app.js:1250-1344`.
- Validation-result inspection has no client workflow.
- Incident creation remains disabled at `public/app.js:1667-1681`.

Repair recommendation:

Implement the smallest complete, role-gated client journeys for candidate disposition, privacy decision, rights resolution, distractor verdict, assignment management, validation-result inspection, and incident creation. Each consequential command must show exact object and revision identity, consequence, authority, and fail-closed recovery.

Acceptance tests:

1. Authorized synthetic role can complete each journey against a persistent staging adapter.
2. Wrong role, wrong assignment, stale revision, missing evidence, and feature-disabled cases fail closed without leakage.
3. Loading, empty, blocked, error, conflict, and success states have deterministic focus and status announcements.
4. Every immutable event requires explicit confirmation of actor, object, revision hash, verdict, and consequence.
5. Re-run all 17 screen, 20 task, viewport, keyboard, and AT matrices.

### UX-P0-002: Prove canonical authenticated staging behavior

Priority: `P0 RELEASE GATE`

Evidence:

The local demo identifies `Local synthetic reviewer` and uses deterministic local fixtures. No canonical entry, real synthetic identity, role resolution, expiry, revocation, outage, reauthentication, logout invalidation, browser Back, RLS denial, or persistent write was exercised by this lane.

Acceptance tests:

1. Pin one immutable staging build, deployment run, database target, and fixture hash.
2. Run positive and denial personas for every role through canonical authentication.
3. Verify protected content disappears after logout, expiry, revocation, and browser Back.
4. Verify client labels never grant authority and server-side role resolution controls every protected action.
5. Keep all student and consumer flags off.

### UX-P1-003: Make dashboard and navigation role relevant

Priority: `P1`

Evidence:

Every actor receives the same 17 destinations at `public/index.html:28-45`. The dashboard at `public/app.js:626-681` summarizes the estate but does not prioritize a role-specific due queue.

Repair recommendation:

Use authoritative server capabilities to present a role-relevant start view, due work, and blockers. Keep authorization server-side. Do not imply that hidden navigation is a security control.

Acceptance tests:

1. Each persona sees its permitted next work and clear owner/blocker language.
2. Denied routes still fail closed by direct URL or API access.
3. Navigation order remains stable and keyboard efficient.
4. Novice and power users identify the next task without facilitator help.

### UX-P1-004: Bound large-result UX and preserve work context

Priority: `P1`

Evidence:

`listResource` drains pages and fails closed at 50000 rows at `public/app.js:382-424`. The 250-row regression at `tests/ui.test.mjs:470-508` closes silent truncation but not task performance. The browser still aggregates the full result.

Repair recommendation:

Add server-side filtering, sorting, query pagination, cancellation, stable deep links, return-to-queue state, saved views, and bounded bulk operations. Display result completeness and snapshot-change recovery.

Acceptance tests:

1. Complete representative find, review, return, and repeat tasks at 1000, 10000, and 50000 rows.
2. Meet agreed latency, memory, cancellation, and recovery budgets.
3. Preserve selected record and filter context after detail, error, refresh, and Back.
4. Detect snapshot drift without duplicating, omitting, or silently replacing rows.

### UX-P1-005: Add protected stale-edit recovery and immutable-decision confirmation

Priority: `P1`

Evidence:

Exact `If-Match` and stale rejection protect writes, but the local stale state does not provide a protected compare-and-reapply journey. Editorial and physician decisions do not provide a final confirmation that repeats exact identity and consequence.

Repair recommendation:

Preserve volatile edits in memory, fetch the current purpose-scoped revision, and offer Compare, Reapply, or Discard without automatic merge. Add an accessible confirmation for immutable review events.

Acceptance tests:

1. Two sessions create a real 409 against synthetic staging data.
2. The stale editor retains unsaved input without browser storage.
3. Compare shows only authorized protected fields and exact old/new hashes.
4. Reapply creates a fresh draft and never overwrites the newer revision.
5. Immutable review confirmation names actor, assignment, exact hash, verdict, and consequence.

### UX-P1-006: Execute external accessibility and human validation

Priority: `P1 RELEASE GATE`

Evidence:

The local matrix did not use VoiceOver, NVDA, JAWS, magnification, switch, voice, native 200 or 400 percent zoom, text-spacing overrides, forced colors, supported-browser combinations, real devices, or human participants.

Acceptance tests:

1. Execute `human_validation_protocol.md` against the exact staging build.
2. Achieve 100 percent keyboard completion for all twenty tasks.
3. Achieve 100 percent AT completion for safety-critical tasks and at least 90 percent overall.
4. Record zero critical or high accessibility defect.
5. Obtain an independent SIMULATED score of at least 9.0 with no category below 8.5 before replacing it with human results.

## Recommended Order

1. Complete governed client workflows.
2. Integrate and verify canonical authenticated staging with synthetic roles.
3. Add scale, context preservation, and stale-edit recovery.
4. Run supported-browser, zoom, keyboard, and assistive-technology validation.
5. Run human validation and rescore independently.

The locally actionable responsive findings requested for this retest are closed. None of the remaining recommendations should be credited as complete until its acceptance evidence exists.
