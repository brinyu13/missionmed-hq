# I1Q-1007X Genuine Human Validation Protocol

## Current Scope

Status: `PROPOSED, NOT EXECUTED`.

This protocol validates usability, accessibility, workflow safety, evidence traceability, and recovery on a future canonical staging build. It does not approve medical content, establish psychometric validity, assign medical governance, or authorize student release.

All sessions must use synthetic content or explicitly authorized privacy-safe content. No raw transcript, student speech, patient identifier, third-party identity, credential, secret, token, or production student data may enter session recordings or exported notes.

## Evidence

The current machine baseline is documented in `ux_workflow_audit.md`, `accessibility_audit.md`, and `responsive_audit.md`. Those artifacts define the entry-state findings only. The participant, browser, assistive-technology, task, and observation evidence required to complete this protocol does not yet exist.

## Findings

- Real human validation is not started.
- The required cohorts, task families, state paths, environment matrix, measures, and safety thresholds are defined below.
- Machine and simulated evidence cannot substitute for observed participant results.

## Entry Criteria

- P0 items in `ui_repairs.md` are closed and independently retested.
- All 17 workflows and 16 natural state paths pass deterministic staging tests.
- Canonical authentication, role resolution, datastore, audit, concurrency, and rollback are operational.
- Browser, responsive, keyboard, and automated accessibility suites are green.
- Evidence validation passes for the exact candidate.
- Student content, STAT consumer, and Drills consumer flags remain off.
- Medical governance may remain unassigned, but physician approval controls must remain unavailable.
- No critical or high security, privacy, source-lineage, accessibility, or data-integrity issue is open.

## Participants

| Cohort | Minimum | Eligibility |
| --- | ---: | --- |
| Credentialed physician reviewers | 5 | Credential verified for study eligibility; participation is usability review, not item approval |
| Medical educators or editorial reviewers | 5 | Performs real content, curriculum, or assessment review work |
| Assessment scientists | 3 | Experienced with item quality, variants, and pilot interpretation |
| Privacy officers or privacy-trained operators | 3 | Experienced with redaction and rights decisions |
| First-time internal operators | 5 | No prior use of the Question Platform |
| Assistive-technology users | 6 | Mix of screen reader, keyboard-only, low-vision zoom, and motor-access users |
| Release managers or incident responders | 3 | Responsible for release or operational response |

Participants may qualify for more than one cohort only when each cohort result remains separately attributable. Accessibility specialists may not replace actual assistive-technology users.

## Environment Matrix

- VoiceOver with current Safari on macOS.
- VoiceOver with current Safari on iOS.
- NVDA with current Firefox and Chrome on Windows.
- JAWS with current Chrome or Edge on Windows.
- Keyboard-only operation at desktop and responsive widths.
- 200 percent browser zoom.
- 400 percent reflow at 320 CSS pixels.
- Reduced-motion mode.
- WCAG text-spacing override.
- At least one switch-control, voice-control, or equivalent motor-access workflow where available.

Record operating system, browser, assistive-technology version, viewport, zoom, input method, candidate commit, deployment identity, and fixture hashes for every session.

## Workflow Tasks

### Sources And Privacy

1. Find one inventory source by ID and availability.
2. Open Source detail and verify title, canonical ID, hash, rights, and privacy identity.
3. Open Transcript evidence and confirm every segment belongs to the selected source.
4. Identify a partial source and explain what is absent without inferring content.
5. Identify privacy-blocked and rights-blocked sources and state the named owner and remedy.
6. Confirm that raw source content is unavailable to an unauthorized role.

### Extraction And Triage

1. Find queued, running, failed, and resumable runs.
2. Retry a failed synthetic run as a new run.
3. Resume from a verified checkpoint.
4. Confirm that partial output is not presented as complete.
5. Inspect a sanitized candidate without seeing protected answer or raw source wording.

### Authoring And Assessment Review

1. Open an exact immutable revision and identify item ID, revision ID, hash, source, and evidence.
2. Edit the stem and four choices with three distractor rationales and misconception IDs.
3. Save a new immutable draft.
4. Recover from a newer revision without overwriting it or losing protected content.
5. Review distractor plausibility, accidental correctness, option class, and safety.
6. Find an item through Search and filters, then compare two revisions.

### Editorial And Physician Review

1. Confirm the assigned reviewer, role, conflict state, evidence currency, and exact revision hash.
2. Attempt an editorial pass with an incomplete rubric and explain the block.
3. Request revision with a required note.
4. Encounter expired evidence and verify that no decision control can submit.
5. Encounter a reviewer conflict and recover through reassignment.
6. Open Physician review and verify that unassigned governance and absent credential block approval without implying a physician identity.

### Release, Incidents, And Audit

1. Inspect release gates and identify why the current release is blocked.
2. Assemble an eligible synthetic internal release when the staging fixture permits it.
3. Confirm student, STAT, and Drills flags remain off.
4. Inspect only answer-free pre-answer metadata.
5. Find an incident record and identify owner, state, and created time.
6. Trace a material action through the immutable audit trail.
7. Detect a deliberately broken sequence link in a synthetic fixture.

## Required State Tasks

Each participant cohort executes relevant natural paths for:

- loading
- empty
- blocked
- unauthorized
- error
- partial source
- privacy blocked
- rights blocked
- expired evidence
- review conflict
- stale edit
- concurrent edit
- extraction queued
- extraction running
- extraction failed
- extraction resumable

For every state, record whether the participant can identify what happened, what remained unchanged, the owner, the recovery path, and the next safe action.

## Measures

- Unassisted task completion.
- Completion with one predefined neutral prompt.
- Failure or unsafe completion.
- Critical error, near miss, and recovery path.
- Time on task, with system latency recorded separately.
- Single Ease Question from 1 through 7 after each task.
- Confidence in selected source, revision, and action from 1 through 5.
- Navigation errors and excessive tab travel.
- Focus loss and announcement accuracy.
- Source-lineage comprehension.
- Evidence and blocker comprehension.
- Post-session usability and trust interview.

## Severity

- Critical: enables wrong-source or wrong-revision action, privacy or answer leak, release bypass, unrecoverable data loss, or complete exclusion.
- High: prevents a required workflow, makes recovery inaccessible, causes repeated serious error, or materially obscures evidence identity.
- Medium: causes significant delay or confusion with a reliable safe workaround.
- Low: polish or efficiency issue without safety impact.

## Passing Thresholds

- Zero critical errors or near misses on source identity, approval, privacy, release, incident, and stale-revision tasks.
- 100 percent completion of safety-critical tasks with no more than one neutral prompt and no unsafe workaround.
- At least 90 percent unassisted completion across noncritical tasks in each cohort.
- Median Single Ease Question at least 5.5 of 7 for every required task family.
- Median source, revision, and action confidence at least 4 of 5 without evidence misunderstanding.
- 100 percent keyboard completion for every required task.
- No critical or high assistive-technology defect.
- Every status, error, conflict, save, queue, and resume announcement is understandable without visual context.
- Simulated expert board aggregate at least 9.0 with no category below 8.5 after observed defects are closed.
- Every critical and high finding is repaired and retested by an affected cohort.

These are usability gates only. They do not approve medical content.

## Session Controls

- Obtain consent for observation and any recording.
- Use participant IDs, not names, in exported evidence.
- Disable recording whenever unauthorized information could appear.
- Store notes only in the approved restricted evidence location.
- Use a fixed moderator script and predefined neutral prompts.
- Preserve raw observations with task and session identifiers.
- Separate product defects from training, content, auth, and latency issues.
- Never place participant identities, credentials, or raw content in Git.

## Required Evidence

- Recruitment and eligibility log.
- Consent record.
- Environment and assistive-technology matrix.
- Candidate commit, deployment identity, and fixture hashes.
- Per-task results with denominators.
- Redacted observation notes.
- Issue register with severity and owner.
- Metrics summary.
- Repair and retest evidence.
- Signed UX and accessibility verdict.
- Independent verification that summaries match raw observations.

## Changes

No session was run and no participant data was created. This protocol is documentation only.

## Tests

Current machine evidence is listed in `ux_workflow_audit.md`. It is an entry prerequisite, not a substitute for this protocol.

## Risks

- Recruiting only expert staff can hide first-time operator failures.
- Proxy accessibility review can miss real assistive-technology barriers.
- Using real medical or transcript material can create privacy and rights risk.
- Combining cohorts without separate denominators can hide subgroup exclusion.

## Blockers

The protocol cannot begin until the entry criteria pass on canonical staging and an approved human-research owner authorizes participant handling.

## Confidence

- 0.94 that this protocol covers the required personas, workflows, states, safety tasks, and accessibility modes.
- 0.00 as a claim that human validation has occurred.

## Paths

Protocol path:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/human_validation_protocol.md`

## Root Handoff

Root should keep real human validation `NOT STARTED`. Execute this protocol only after staging entry gates pass, preserve privacy-safe raw evidence outside Git, and commission independent verification before any UX or accessibility green claim.
