# I1Q-1007X Proposed UI Repairs

## Scope

This is a read-only repair backlog for the I1Q-1006 candidate. No application code, migration, runtime, or deployment change was made by this analyst.

Authority and MMOS observations from the initial snapshot predated the Root Supervisor's later recovery and registration. They are not current blockers in this backlog. The priorities below arise from verified candidate UI and evidence defects.

## P0: Release Evidence Integrity

### UI-001 Replace hard-coded browser and accessibility evidence

Owner: UI QA and accessibility engineering.

Change:

- Generate browser, responsive, console, keyboard, and accessibility results from executable tests.
- Preserve raw results, browser/tool versions, operating system, commit SHA, viewport, zoom, reduced-motion state, and command identity.
- Fail evidence generation when a source run is missing or failed.

Acceptance:

- No pass field is assigned from an unconditional constant.
- Every summarized claim points to raw evidence.
- Re-running the documented command reproduces the summary or fails closed.

### UI-002 Repair the evidence validation entrypoint

Owner: Candidate maintainer.

Change:

- Implement the advertised `src/validate-evidence.mjs` contract or update the package script to a real validator.
- Validate required files, schemas, source hashes, screenshot hashes, MIME/extension agreement, commit identity, and stale evidence.

Acceptance:

- `npm run validate` exists, exits zero only for complete current evidence, and exits nonzero for missing or hard-coded inputs.

### UI-003 Rebuild visual evidence provenance

Owner: UI QA.

Change:

- Store screenshots using truthful file extensions.
- Add every screenshot to the artifact checksum manifest.
- Record full-page/viewport mode, scroll position, browser, viewport, scale, and zoom.

Acceptance:

- MIME, extension, dimensions, metadata, SHA-256, and release commit agree for every capture.

## P0: Workflow Completion

### UI-004 Implement the five missing workflows

Owner: Product UI engineering.

Required workflows:

- Source detail
- Privacy status and redaction evidence
- Extraction run queue/detail/retry/resume
- Dedicated distractor review
- Immutable audit trail inspection

Acceptance:

- Each workflow has a routable entry, selected-record context, loading/empty/error/blocked states, keyboard completion, and API-backed behavior.

### UI-005 Make presented commands functional

Owner: Product UI and API integration.

Change:

- Wire save, submit, add claim, editorial decisions, search/filter/sort, preview, incident creation, assignment, quarantine, and recovery.
- Remove or clearly mark controls that are not available in the current release.
- Do not report `Saved` until persistence is acknowledged and identity/version is confirmed.

Acceptance:

- Every enabled control has an observable, authorized result and error path.
- Reload proves persistence where persistence is claimed.

### UI-006 Implement all required states

Owner: Product UI engineering.

Change:

- Add partial source, privacy blocked, rights blocked, expired evidence, review conflict, stale edit, concurrent edit, and extraction queued/running/failed/resumable states.
- Provide exact remedy, ownership, retry/resume behavior, and safe navigation for each state.

Acceptance:

- Each of the 16 required states has a deterministic fixture, visual assertion, keyboard path, accessibility assertion, and recovery test.

## P1: Accessibility

### UI-007 Add deterministic focus management

Owner: UI accessibility engineering.

Change:

- Move focus predictably after navigation, errors, retries, dialogs, saves, review decisions, and conflict recovery.
- Keep focus visible and unobscured at every viewport and zoom.

Acceptance:

- Manual and automated focus transcripts match the documented rules.

### UI-008 Correct semantics and blocker descriptions

Owner: UI accessibility engineering.

Change:

- Replace invalid `dl`/`li` structure with valid term/description groups.
- Associate blocked-action explanations programmatically.
- Validate headings, table headers, regions, names, descriptions, errors, and live regions from the accessibility tree.

Acceptance:

- Automated semantic scans have no serious findings and manual screen-reader output is understandable without visual context.

### UI-009 Complete WCAG 2.2 AA verification

Owner: Accessibility lead and independent verifier.

Change:

- Add criterion-level automated and manual coverage for keyboard, traps, focus, contrast, non-text contrast, status, target size, zoom, reflow, text spacing, reduced motion, and authentication.

Acceptance:

- No critical/high defect remains and every applicable AA criterion has evidence and owner sign-off.

## P1: Responsive UX

### UI-010 Replace the mobile navigation overflow pattern

Owner: Product design and UI engineering.

Change:

- Provide a compact navigation control that exposes all destinations, current location, and keyboard operation without an undisclosed horizontal strip.

Acceptance:

- Current and adjacent destinations remain discoverable at 320 CSS pixels and 400% reflow.

### UI-011 Repair clipping and representative-content behavior

Owner: UI engineering.

Change:

- Constrain flexible children correctly and allow headings, banners, status text, hashes, fields, and actions to wrap.
- Test long stems, choices, citations, blockers, identities, transcript segments, and queues.

Acceptance:

- No body-level horizontal overflow, overlap, or clipped information across the responsive matrix.

## P1: Review Safety And Recovery

### UI-012 Make revision identity continuously visible

Owner: Product design.

Change:

- Show item ID, immutable revision ID/hash, source identity, assignment, current role, evidence currency, and conflict state at every review decision.

Acceptance:

- A reviewer can state exactly which immutable revision and evidence set a decision affects before activation.

### UI-013 Add concurrency and stale-evidence recovery

Owner: UI and datastore integration.

Change:

- Detect stale edits, concurrent decisions, expired claims, and withdrawn rights.
- Preserve unsaved work, show field-level differences, and require a deliberate refresh/merge/re-review choice.

Acceptance:

- Tests prove that no stale revision can be approved or silently overwrite current state.

## P2: Usability Board And Human Validation

### UI-014 Re-run the exact simulated board

Owner: UX lead independent of the implementer.

Acceptance:

- All 10 required personas and 15 required categories are scored from documented observations.
- Aggregate is at least 9.0 and no category is below 8.5.
- Every score links to evidence, issue disposition, and retest result.

### UI-015 Execute the human validation protocol

Owner: UX research and accessibility lead.

Acceptance:

- The protocol in `human_validation_protocol.md` is completed on staging.
- Critical safety tasks have no critical errors.
- Critical/high findings are repaired and retested before State C certification.

## Required Regression Scope

- All 17 workflows and 16 states
- Keyboard-only and screen-reader task runs
- 320 through 1920 pixel responsive matrix
- 200% zoom and 400% reflow
- Canonical auth roles and failures
- Stale/concurrent revisions and expired evidence
- Large queues and long transcript/content fixtures
- Release, rollback identity, incident, and audit workflows
- Dependent product smoke checks after any shared integration

## Exit Rule

The 1006 UI veto can be lifted only after P0 and P1 repairs pass reproducible tests, the board threshold passes with valid methodology, human validation is complete, and a fresh independent verifier accepts the raw evidence.
