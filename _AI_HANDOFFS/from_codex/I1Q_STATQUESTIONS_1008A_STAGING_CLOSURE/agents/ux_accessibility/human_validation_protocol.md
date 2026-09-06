# I1Q-1008A Human Validation Protocol

## Status

`PROTOCOL ONLY. NOT EXECUTED.`

Local candidate reference: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

The current 8.21 score and every score in the local packet are `SIMULATED`. This protocol is the path to human evidence. It must be executed against one exact authenticated staging build after the product entry criteria pass.

## Local Evidence Available To The Study Owner

- 287 tests with 285 pass, 0 fail, and 2 expected database skips.
- 19 of 19 focused UI tests.
- 187 workflow viewport cells with zero root-overflow or visible-control failures.
- 176 state viewport cells with zero rendering, role, focus, busy, overflow, clipping, or ARIA failures.
- 68 mobile-context cells with zero missing actor or environment context.
- 34 workflow and 32 state width-equivalent reflow cells with zero observed failures.
- Requested root, pagination, mobile-context, exact-hash, and mobile-spacing repairs closed locally.

This evidence does not prove authenticated staging, real identity behavior, assistive technology, supported browsers, actual zoom, or human usability.

## Purpose

Determine whether authorized internal users can complete the full I1Q workflow safely, efficiently, and accessibly. Measure task completion, consequential-error prevention, recovery, role comprehension, source and evidence comprehension, responsive behavior, keyboard behavior, and assistive-technology behavior.

## Entry Criteria

All criteria are mandatory:

1. Record the exact staging URL, immutable build commit, deployment run, database target, and evidence window. Commit `fd7ddcd` is local candidate evidence, not deployment proof.
2. Canonical entry, expiry, revocation, reauthentication, provider outage, logout, and browser Back behavior pass independent staging tests.
3. Role resolution, purpose-scoped reads, assignment gates, exact revision identity, and atomic stale-write rejection pass security tests.
4. All twenty required client tasks are implemented and available to their authorized synthetic roles.
5. The 187 workflow viewport cells and 176 state viewport cells remain free of page-root overflow, clipping, overlap, and target failure on the exact staging build.
6. Automated accessibility, full keyboard, native 200 and 400 percent zoom, text spacing, forced colors, and contrast checks have no critical or high defect.
7. Only synthetic non-clinical fixtures are loaded. Raw transcripts, patient information, student data, secrets, credentials, production records, and real answer content are prohibited.
8. Student, public, STAT, Drills, extraction, physician-enablement, and automated-publication flags remain false.
9. The privacy owner approves fixtures, logging, screenshots, and recording.
10. No test path can create a real medical approval or student-facing release.

Failure of an entry criterion returns the study to engineering. It is not a participant failure.

## Evidence Header

Record once per test round:

| Field | Required value |
| --- | --- |
| Evidence class | `HUMAN` after execution, never `SIMULATED` |
| Staging build | Exact approved commit and deployment run |
| Test window | Start and end with time zone |
| Browser | Product and exact version |
| Operating system | Product and exact version |
| Assistive technology | Product, version, and configuration |
| Viewport or zoom | Exact dimensions or magnification |
| Fixture | Immutable synthetic fixture ID and hash |
| Role fixture | Synthetic role name only |
| Participant | Anonymous study code only |
| Facilitator | Internal study owner |
| Recording | Approved yes or no with privacy decision |
| Deviations | Every departure from protocol |

Do not record credentials, tokens, private source text, answer keys, raw transcripts, student identifiers, participant medical information, or environment values.

## Participants

Recruit at least 12 people. No participant may count as more than two primary personas.

| Persona | Minimum | Required emphasis |
| --- | ---: | --- |
| Physician reviewer | 2 | Assignment, evidence, source boundary, conflict, decision safety |
| Medical educator | 2 | Authoring, distractors, concurrency, recovery |
| Editorial reviewer | 2 | Queue, assignment, rubric, immutable decision |
| Assessment scientist | 1 | Distractor quality, validation evidence, comparison |
| Privacy officer | 1 | Privacy classes, rights, restricted-source boundary |
| Release manager | 1 | Exact revision selection, gates, validation, blocked release |
| Novice operator | 2 | Orientation, terminology, task start, recovery |
| Power operator | 2 | Search, filters, repeated work, keyboard efficiency |
| Assistive-technology user | 4 | Keyboard plus screen reader, magnification, switch, or voice |
| Incident responder | 1 | Incident creation, containment, audit linkage |

A physician reviewer evaluates workflow usability only. Participation does not establish credential verification, medical governance, medical approval, or release eligibility.

## Access Configurations

Cover every configuration at least once and repeat safety-critical tasks in the first four:

1. macOS Safari with VoiceOver.
2. iOS Safari with VoiceOver at 390 pixels.
3. Windows Firefox with NVDA.
4. Windows Edge or Chrome with JAWS.
5. Keyboard only without a pointer.
6. Native browser zoom at 200 percent and reflow at 400 percent.
7. WCAG 1.4.12 text-spacing overrides.
8. Reduced-motion preference.
9. High-contrast or forced-colors mode.
10. Switch control or voice control for representative workflows.

Exercise 320 by 568, 375 by 667, 390 by 844, 430 by 932, 768 by 1024, 1024 by 768, 1280 by 720, 1366 by 768, 1440 by 900, 1728 by 1117, and 1920 by 1080. Every workflow must run at one narrow and one desktop viewport.

## Required Workflow Tasks

Use synthetic identifiers and neutral placeholder content. Do not teach the exact click sequence.

| # | Task | Primary role | Pass evidence |
| ---: | --- | --- | --- |
| 1 | Enter through canonical authentication and recover from expiry | Any authorized role | Safe return, correct identity, one announcement, deterministic focus |
| 2 | Interpret the role dashboard and identify the next due task | Every primary role | Correct task and blocker without unavailable destinations |
| 3 | Find a candidate using queue filters and search | Content operator | Correct candidate with stable context |
| 4 | Inspect a candidate and choose an allowed disposition | Content operator | Role-gated assignment, quarantine, or rejection |
| 5 | Verify source identity and lineage without opening raw source | Privacy officer | Correct source, hash, linkage, and restriction |
| 6 | Interpret privacy status and record a permitted decision | Privacy officer | Classes, owner, consequence, and audit are clear |
| 7 | Interpret rights status and resolve allowed use | Privacy officer | Allowed and prohibited uses are distinguished |
| 8 | Create and save a complete draft question | Medical educator | Correct answer, three distractors, rationales, explanation, and exact save |
| 9 | Edit distractor quality and record a verdict | Assessment scientist | Each wrong option retains its own misconception context |
| 10 | Review an evidence claim and locate authority, currency, and anchor | Editorial reviewer | Evidence identity and limits are explained correctly |
| 11 | Create, accept, reassign, and decline an editorial assignment | Editorial reviewer | Exact actor, revision, conflict, and audit are clear |
| 12 | Attempt physician assignment with valid and invalid prerequisites | Physician reviewer | Missing credential or governance fails closed |
| 13 | Create an immutable review event after confirmation | Editorial and physician reviewers | Decision, role, revision, and consequence are verified |
| 14 | Compare two exact revisions of one item | Reviewer | Pair and protected fields are correct for purpose |
| 15 | Assemble a release from one deliberately selected revision | Release manager | Wrong revision cannot enter membership |
| 16 | Inspect validation results and trace artifact and validator | Assessment scientist | Status, timestamp, validator, hash, and evidence are understood |
| 17 | Create and contain a synthetic incident | Incident responder | Severity, owner, containment, and audit linkage are clear |
| 18 | Trace a state change through the audit trail | Auditor or read-only role | Sequence, actor, object, and hash meaning are correct |
| 19 | Log out and test browser Back | Any authorized role | Session closes and protected content cannot reappear |
| 20 | Recover from wrong-role, unauthorized-record, and revoked states | Affected roles | No leakage and one safe next action |

## Concurrency And Error Tasks

1. Load one draft in two sessions, save in one, and attempt the stale save in the other.
2. Preserve the stale editor's volatile input and explicitly compare, reapply, or discard it.
3. Switch the correct option after entering distractor rationales.
4. Attempt cross-item comparison and wrong-revision release selection.
5. Submit a review after assignment revocation or exact-hash change.
6. Trigger timeout, offline, 401, 403, 409, 422, 429, and 5xx states.
7. Refresh during a pending mutation and verify exactly-once behavior.
8. Request an unauthorized direct URL and inspect page, history, announcements, and cache.

Every rejected mutation must leave prior server state unchanged and provide a recoverable, non-leaking explanation.

## State Matrix

Exercise each state through a natural staging condition, not only a fixture selector:

- Loading.
- Empty.
- Blocked.
- Unauthorized.
- Expired session.
- Revoked session.
- Wrong role.
- Provider outage.
- Partial source.
- Privacy blocked.
- Rights blocked.
- Expired evidence.
- Review conflict.
- Stale edit.
- Concurrent edit.
- Extraction queued, running, failed, and resumable.
- Validation warning and failure.
- Corrupted artifact.
- Feature disabled.

Each state must name what happened, what did not change, the responsible owner, and one safe next action.

## Accessibility Procedure

For every assigned task, record:

- Complete keyboard operability with visible focus and no trap.
- Logical focus order and restoration after menus, dialogs, errors, and refresh.
- Correct accessible name, role, value, state, and relationship.
- Heading and landmark navigation that communicates workflow and state.
- One useful announcement per asynchronous change.
- No reliance on color, hover, pointer precision, `title`, or visual position alone.
- Reflow without page-root horizontal movement at 320 CSS pixels.
- Text and controls at native 200 percent and content at 400 percent.
- Component and focus contrast consistent with WCAG 2.2 AA.
- Target size and spacing consistent with criterion 2.5.8.
- Accessible tables, overflow regions, forms, errors, confirmations, and identifiers.
- Reduced-motion, text-spacing, and forced-colors behavior.

An accessibility barrier to a safety-critical task is critical severity.

## Measures

| Measure | Method |
| --- | --- |
| Completion | Success, assisted success, failure, or safety stop |
| Critical error | Wrong item, wrong revision, unauthorized exposure, unsafe approval, lost work, or duplicate write |
| Noncritical error | Recoverable navigation, terminology, or input mistake |
| Time on task | Start at task statement and stop at verified outcome |
| Assistance | Count and classify prompts |
| Recovery | Safe restoration without data loss |
| SEQ | Single Ease Question, 1 through 7 |
| Confidence | 1 through 5 confidence in item, role, state, and consequence |
| Comprehension | Explain source, evidence, gate, and immutable identity |
| Accessibility defect | WCAG criterion, technology, severity, and reproduction |
| Trust concern | Uncertainty about identity, environment, authority, source, or consequence |

## Exit Thresholds

All thresholds are mandatory. An average cannot hide a safety failure.

1. Safety-critical workflow completion: 100 percent unassisted after normal orientation.
2. Other workflow completion: at least 90 percent unassisted.
3. Critical errors, disclosures, wrong-item decisions, wrong-revision releases, and lost writes: zero.
4. Median SEQ: at least 5.5 of 7 for every persona and safety-critical workflow.
5. Median consequence confidence: at least 4 of 5.
6. Keyboard completion: 100 percent across all twenty workflows.
7. Screen-reader completion: 100 percent for safety-critical tasks and at least 90 percent overall.
8. Accessibility defects: zero critical or high and no unresolved WCAG 2.2 AA failure.
9. Responsive completion: no clipped or root-overflowing status, control, identity, source, or evidence content.
10. Independent post-repair score: at least 9.0 aggregate with no category below 8.5.

## Stop Conditions

Stop immediately if:

- Protected answer, restricted source, identity, or fixture credential appears outside its permitted purpose.
- A stale or wrong-role action succeeds.
- A participant can approve, release, or mutate the wrong item or revision.
- The test touches production or a non-synthetic record.
- A raw transcript, student record, patient identifier, secret, token, or environment value appears.
- A participant experiences a critical accessibility barrier or asks to withdraw.
- Logging or recording captures prohibited content.

Notify the approved privacy owner or incident owner through the approved process without copying prohibited payloads.

## Finding And Retest Rules

Every finding must include workflow, persona, role, viewport, browser, assistive technology, safe fixture ID, expected result, actual result, severity, WCAG criterion where applicable, and sanitized evidence.

After repair:

1. Re-run the exact failed task and configuration.
2. Re-run the adjacent role and authorization boundary.
3. Re-run keyboard and narrow-viewport versions.
4. Re-run stale-write or immutable-identity assertions when a mutation changed.
5. Obtain independent participant confirmation for every critical or high finding.

## Interpretation

Passing this protocol supports only an internal usability and accessibility gate. It does not establish medical approval, public rights clearance, student publication authorization, production deployment, or State C. Root must combine human evidence with canonical identity, datastore, RLS, security, deployment, monitoring, rollback, privacy, and governance evidence.
