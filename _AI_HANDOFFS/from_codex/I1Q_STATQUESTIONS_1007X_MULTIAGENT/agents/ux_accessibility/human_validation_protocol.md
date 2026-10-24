# I1Q-1007X Human Validation Protocol

## Status

**PROPOSED, NOT EXECUTED.** This protocol defines the genuine-human validation needed after the internal application is feature-complete on canonical staging. It does not certify the 1006 candidate and does not constitute medical-content approval.

## Snapshot Boundary

Initial MMOS and registration observations predated the Root Supervisor's later recovery and registration and are not current blockers here. Entry into this protocol depends on the Root Supervisor's current staging certification, not the earlier snapshot.

## Objectives

- Validate that representative users can complete safety-critical review and release-support tasks.
- Detect workflow, comprehension, accessibility, trust, and recovery failures not found by automation.
- Validate assistive-technology operation against WCAG 2.2 AA expectations.
- Measure task completion and error prevention without claiming empirical psychometrics or medical approval.

## Entry Criteria

- All 17 required workflows and 16 required states are implemented on canonical staging.
- Canonical auth, roles, datastore, audit, concurrency, and recovery behavior are operational.
- Automated UI, security, accessibility, and responsive suites are green.
- Only synthetic or explicitly authorized redacted content is used.
- No raw transcript, student speech, patient identifier, credential, or secret may enter recordings, notes, or exports.
- A rollback identity and incident contact exist for the staging session.
- No known critical or high accessibility, privacy, security, or data-integrity finding remains open.

## Participants

| Cohort | Minimum | Eligibility |
| --- | ---: | --- |
| Credentialed physician reviewers | 5 | Credential verified for study eligibility; participation is usability review, not content approval. |
| Editorial or medical-education reviewers | 5 | Performs real editorial, curriculum, or assessment-content review work. |
| First-time internal operators | 5 | No prior use of the Question Platform and no coaching beyond normal onboarding. |
| Assistive-technology users | 6 | Mix of screen reader, keyboard-only, low-vision zoom, and motor-access users. |
| Release managers or incident responders | 3 | Responsible for internal release or operational response workflows. |

Participants may satisfy more than one cohort only when results remain separately attributable. Do not replace assistive-technology users with accessibility specialists acting as proxies.

## Assistive-Technology Matrix

- VoiceOver with current Safari on macOS
- VoiceOver with current Safari on iOS
- NVDA with current Firefox or Chrome on Windows
- JAWS with current Chrome or Edge on Windows
- Keyboard-only operation at desktop and mobile-responsive widths
- 200% zoom and 400% reflow for low-vision workflows
- At least one switch-control, voice-control, or equivalent motor-access workflow where available

Record exact OS, browser, assistive-technology version, viewport, zoom, and input method for every session.

## Core Tasks

### Physician Reviewer

1. Enter through canonical authentication and identify role and assignment.
2. Open an assigned item and identify source, immutable revision, evidence currency, and review history.
3. Inspect every option, distractor rationale, correct rationale, and evidence claim.
4. Detect and resolve an expired-evidence block.
5. Reject or request revision with a required note.
6. Attempt approval after a concurrent revision and recover without approving stale content.

### Editorial And Assessment Reviewer

1. Triage and assign a candidate.
2. Edit stem and choices, including all three distractor rationales.
3. Inspect duplicate/variant context and source traceability.
4. Complete the editorial rubric and request revision.
5. Compare revisions and verify that changes address the request.
6. Recover from a stale edit without losing work.

### Privacy Officer

1. Open source detail and redaction evidence.
2. Identify a privacy-blocked source and its exact failed class.
3. Confirm that raw source content is unavailable to the role.
4. Record a block or clearance decision with an audit entry.

### First-Time Operator

1. Find a queued extraction run and explain its status.
2. Resume a resumable failure and verify progress.
3. Search for an item, open its source, and identify its current review state.
4. Find the correct remedy for a rights block.
5. Open an incident and locate the audit trail.

### Release Manager Or Incident Responder

1. Assemble an eligible internal release from approved fixtures.
2. Identify manifest, checksum, approvals, feature flags, and rollback identity.
3. Refuse release when one required gate is expired or missing.
4. Open an incident, disable the internal flag in the simulated drill, and verify audit evidence.
5. Inspect rollback and reapply results without enabling student, STAT, or Drills consumers.

### Assistive-Technology User

Assistive-technology participants execute the tasks appropriate to their work role, including navigation, long transcript inspection, table operation, editing, status/error recovery, revision comparison, and blocked-action explanation.

## Measures

- Unassisted task completion
- Completion with one neutral prompt
- Failure or unsafe completion
- Critical errors, near misses, and recovery path
- Time on task, excluding system latency where separately measurable
- Single Ease Question after each task, 1 through 7
- Confidence that the selected source, revision, and action are correct, 1 through 5
- Navigation or focus losses
- Screen-reader announcement accuracy and verbosity
- Evidence/source traceability comprehension
- Post-session usability and trust interview

## Severity

- Critical: enables wrong-revision approval, privacy/source leak, answer leak, release bypass, unrecoverable data loss, or complete task exclusion.
- High: prevents a required workflow, causes a repeated serious error, creates inaccessible recovery, or materially obscures source/evidence identity.
- Medium: significant delay, confusion, or workaround with a reliable safe path.
- Low: polish or efficiency issue without meaningful task or safety impact.

## Passing Thresholds

- Zero critical errors or near misses on approval, privacy, release, incident, and stale-revision tasks.
- 100% completion of safety-critical tasks, with no more than one neutral prompt and no unsafe workaround.
- At least 90% unassisted completion across noncritical tasks in each cohort.
- Median Single Ease Question at least 5.5 of 7 for each required task family.
- Median source/revision/action confidence at least 4 of 5 without evidence misunderstanding.
- 100% keyboard completion for every required task.
- No critical or high assistive-technology defect.
- All status, error, conflict, and save announcements understandable without visual context.
- All critical/high findings repaired and retested by affected cohorts.

These thresholds are usability gates only. They do not approve medical content or establish psychometric validity.

## Session Controls

- Obtain informed consent for observation and any recording.
- Use participant IDs, not names, in exported evidence.
- Disable recording when any unauthorized content could appear.
- Store notes and recordings only in the approved restricted evidence location.
- Moderators use a fixed script and may give only predefined neutral prompts.
- Preserve raw observations; summaries must link to session and task IDs.
- Separate product defects from training, auth, latency, and content defects.

## Required Artifacts

- Recruitment and eligibility log
- Consent record
- Environment and assistive-technology matrix
- Task script and synthetic/authorized fixture hashes
- Per-task result table
- Redacted observation notes
- Issue register with severity and owner
- Metrics summary with denominators
- Repair and retest evidence
- Final human-validation verdict signed by UX and accessibility owners

## Exit Rule

Human validation is green only when thresholds pass, every critical/high issue is closed and retested, raw evidence is preserved, and an independent verifier confirms that the summary matches the observations. A separate exact-revision physician approval remains mandatory for any medical content release and is outside this protocol.
