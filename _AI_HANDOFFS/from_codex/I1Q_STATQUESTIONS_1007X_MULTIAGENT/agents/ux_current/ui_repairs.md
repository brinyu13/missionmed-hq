# I1Q-1007X Current UI Repair Backlog

## Current Scope

This is a proposed repair backlog for the current local build at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`. It is documentation only. No product code, test, migration, evidence, flag, or provider state was changed.

The repairs preserve all protected-answer, privacy, rights, immutable-revision, and consumer-flag boundaries.

## Evidence

The backlog derives from the source paths, hashes, tests, DOM simulations, contrast calculations, and evidence-validator result recorded in the other six files in this directory.

## Findings

The current repair order is driven by four release-safety defects: selected source context can drift, expired evidence can contradict active editorial controls, responsive component styling is incomplete, and action feedback can lose focus during rerender. Browser, assistive-technology, large-queue, canonical-auth, and human evidence remain additional certification gaps.

## P0 Repairs

### UI-CUR-001 Bind one selected source context across every source workflow

Owner: Question Platform UI and datastore adapter.

Finding:

- Inventory passes `inventory_sources.id` into state.
- Source detail searches `source_records.id`, then falls back to the first source.
- Source detail always uses the first inventory row.
- Transcript evidence always uses the first inventory row and every segment.
- Privacy selection depends on the mismatched source state.

Change:

- Store distinct `selectedInventorySourceId`, `selectedSourceRecordId`, and `selectedTranscriptArtifactId` values.
- Resolve their authoritative joins through stable canonical identifiers.
- Filter transcript artifacts by selected inventory source.
- Filter normalized segments by selected transcript artifact.
- Bind rights and privacy records to the same source context.
- Fail closed with a visible lineage error when any link is missing or ambiguous.

Acceptance:

- A fixture with at least three sources proves that no title, ID, hash, rights record, privacy record, artifact, or segment can cross source boundaries.
- Deep navigation from Inventory through Source, Privacy, Transcript, Candidate, Item, and Audit preserves one displayed context.
- Tests fail if a renderer falls back to the first unrelated row.

### UI-CUR-002 Make evidence currency a decision gate

Owner: Review UI and review service.

Finding:

The editorial view displays an expired-evidence block but computes `canReview` without `!expired`.

Change:

- Include evidence currency in control eligibility.
- Keep server enforcement authoritative.
- Return an exact, safe reason when evidence expires between render and submission.
- Require fresh exact-revision review after evidence replacement.

Acceptance:

- Expired, aging beyond policy, retracted, conflicted, superseded, and missing claims cannot produce an editorial pass.
- Controls, accessible descriptions, API response, audit event, and recovery copy agree.

### UI-CUR-003 Complete the component stylesheet and mobile-navigation contract

Owner: UI engineering and product design.

Change:

- Add stable styles for every rendered class, especially record context, details, notices, scenarios, action status, blocked commands, run layout, review criteria, transcript list, pagination, hashes, and navigation toggle.
- Make `aria-expanded`, visual visibility, and `is-open` agree.
- Group 17 workflows for novice discovery without hiding current location from keyboard and screen-reader users.
- Preserve the restrained MissionMed operational design language.

Acceptance:

- No rendered component class lacks an intentional style or documented native-style decision.
- Mobile navigation is visible only when programmatic state says it is open.
- No overlap, clipping, body-level overflow, or inaccessible off-screen control occurs at the required matrix.

### UI-CUR-004 Preserve focus and status across rerenders

Owner: UI accessibility engineering.

Change:

- Define a focus destination for navigation, filtering, selection, save, decision, queue, retry, resume, release assembly, errors, and conflicts.
- Do not focus a status node that is immediately hidden.
- Preserve success and error feedback until acknowledged or until a later action supersedes it.
- Use one live announcement path per event.

Acceptance:

- Keyboard focus remains visible, valid, and predictable after every action.
- VoiceOver, NVDA, and JAWS announce one understandable status in the intended priority.
- Automated tests fail on detached focus, duplicate announcements, or cleared feedback.

### UI-CUR-005 Replace fixture-only coverage with natural state-path tests

Owner: UI QA and API integration.

Change:

- Keep deterministic state fixtures for design review.
- Add API-backed tests that naturally produce all 16 states.
- Test role denial, source absence, rights and privacy blocks, evidence expiry, reviewer conflict, stale and concurrent revisions, and extraction retry or resume.

Acceptance:

- Every state has route input, expected status, visible remedy, focus result, live announcement, and recovery assertion.
- State fixtures cannot be counted as production-path proof.

## P1 Repairs

### UI-CUR-006 Add server-side large-list contracts

Owner: API and UI engineering.

Change:

- Replace first-200 client filtering with cursor-backed server search, filters, sorting, and pagination.
- Preserve selected item and filter state without browser-stored protected content.

Acceptance:

- Inventory, candidates, revisions, review queues, incidents, and audit events remain responsive and accurate with 10,000-plus records.
- Query-plan and interaction evidence includes worst-case filters and rapid paging.

### UI-CUR-007 Integrate canonical actor and role context

Owner: MissionMed HQ auth adapter and Question Platform UI.

Change:

- Replace local actor assumptions with a server-supplied safe actor and role summary.
- Do not expose credentials, tokens, or unrestricted role material.
- Keep physician controls unavailable until assignment, credential, governance, conflict, evidence, and exact-hash gates all pass.

Acceptance:

- Positive and negative role matrices match server authorization.
- Expired, revoked, stale, or unavailable sessions fail closed with usable reauthentication guidance.

### UI-CUR-008 Improve authoring recovery without storing protected content unsafely

Owner: Authoring UI, security, and privacy.

Change:

- Provide a governed draft-recovery design that never leaks answer material into unsafe browser storage.
- Show field-level changes when a newer immutable revision exists.
- Require deliberate reapply or discard.

Acceptance:

- A refresh, session interruption, stale edit, and concurrent revision cannot silently lose work or overwrite a newer revision.
- Security review confirms no protected answer or source payload persists outside approved storage.

### UI-CUR-009 Raise focus-indicator contrast

Owner: Design system.

Change:

- Use a focus treatment with at least 3:1 contrast against both light and dark adjacent colors.
- Preserve at least a 2-pixel equivalent indicator and unobscured outline.

Acceptance:

- Computed contrast and browser screenshots pass for every interactive component and state.

### UI-CUR-010 Expand UI regression coverage

Owner: UI QA independent of the implementer.

Change:

- Execute all 17 workflows, all 16 states, every enabled command, blocked-command reason, form validation, focus transition, live region, and source-lineage invariant.
- Add responsive browser tests only when the approved browser environment is available.

Acceptance:

- Current source-pattern checks remain supporting checks, not the primary release evidence.
- Raw results identify commit, environment, browser, viewport, zoom, reduced motion, and fixture hashes.

## P2 Repairs

### UI-CUR-011 Improve navigation efficiency

Owner: Product design.

Change:

- Group the 17 workflows by Sources, Extraction, Authoring, Review, Release, and Operations.
- Provide current-work context, recent records, and safe shortcuts.
- Do not hide destinations behind icon-only controls.

Acceptance:

- First-time and power-user tasks meet the human protocol without navigation error or excessive tab travel.

### UI-CUR-012 Run the genuine board and human protocol

Owner: UX lead and independent accessibility verifier.

Acceptance:

- The 10 required personas and 15 categories are evaluated from observed tasks.
- Aggregate reaches at least 9.0 and no category is below 8.5.
- Every critical or high finding is repaired and retested.

## Changes

No repair was implemented in this audit. This file is the complete change proposal.

## Tests

Current evidence before repair:

- UI: 6 passed, 0 failed.
- Full local package: 196 passed, 0 failed, 1 skipped.
- Workflow DOM simulation: 17 of 17 rendered.
- State DOM simulation: 16 of 16 rendered.
- Evidence validation: failed with 19 errors.
- Browser and assistive-technology execution: unavailable.

## Risks

- Repairing source joins can affect privacy and rights visibility, so tests must use only synthetic or privacy-safe data.
- Adding canonical auth must not weaken current fail-closed server behavior.
- Draft recovery must not put answers, explanations, raw source content, or private references into unsafe client storage.
- Styling repairs must not turn safety states into color-only distinctions.

## Blockers

P0 items UI-CUR-001 through UI-CUR-005 block UX, accessibility, staging, and State C certification.

## Confidence

- 0.97 that the P0 items are required before staging certification.
- 0.83 in the P1 and P2 ordering pending integrated browser and performance evidence.

## Paths

Repair targets are under:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`

This backlog is under:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/ui_repairs.md`

## Root Handoff

Root should schedule P0 work before any browser certification, then run P1 scale and auth integration, then commission the independent P2 board and human validation. Keep student, STAT, and Drills flags off throughout.
