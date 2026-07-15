# 04 Mentor Experience Constitution

RESULT: `MENTOR_COMMAND_MODEL_DEFINED`

## Experience promise

Dr Brian should open MMC and know, within one minute, who needs him, why now, what changed, what he promised, and the safest next action. The system should make a good mentoring conversation easier without turning the conversation into clerical work. Detail remains available, but urgency and next action always win the first screen.

## The mentor questions

Every design decision must improve at least one of these questions:

1. Who needs attention today?
2. Why now, and how reliable is that reason?
3. What changed since the last meaningful interaction?
4. What did I or the student promise?
5. What is due, blocked, stale, or unresolved?
6. What should I remember and ask next?
7. What must I capture during the call?
8. What needs my review after the call?
9. What should the student see, and what must remain private?
10. What should carry into the next meeting?

## The one-minute brief

Today opens on a ranked attention queue, not aggregate KPIs. The initial tier contains the three most actionable items, followed by an explicit “four more” disclosure. The first tier shows only student, one actionable reason, due state, and one safe next action. Source, review, freshness, owner detail, and correction controls collapse into one accessible trust affordance and inspector. Priority is a transparent ordering of conditions, not a person score.

The attention dimensions are:

- **Deadline pressure:** an objective dated event is approaching or overdue.
- **Follow-through gap:** an accepted commitment has not progressed by its agreed checkpoint.
- **Review wait:** identity, evidence, analysis, or publication is waiting on an authorized person.
- **Readiness gap:** an explicit milestone requirement is incomplete, with source and rubric.
- **Data insufficiency:** required evidence is absent or stale.
- **Support context:** a mentor-approved handling note, never a numeric risk input.

Sensitive disclosures, raw meeting count, memory count, cultural/language difference, or inferred emotional state cannot raise attention. A reason always includes recourse: inspect evidence, correct, defer, contact, or dismiss with a reason.

Ordering is deterministic: true privacy/safety decision owned by the mentor; authoritative deadline consequence; overdue mentor promise; scheduled-call preparation; student commitment follow-through; review wait; data sufficiency. Within a class, earliest objective due time wins, then oldest first-observed time, then stable object ID. Duplicate reasons for one object/student collapse; no student occupies more than one initial-tier slot unless a separately classified safety decision exists. Deferred/dismissed items store reason and expiry, reappear only after material source/version change or expiry, and carry age escalation so low-priority work cannot starve. Per-day alert budgets and usefulness/dismissal review are release contracts.

## Student Workspace

The canonical student route is `/students/:studentId`. It pins verified subject link, assignment, environment, and freshness in the header. It has four stable tabs:

- **Overview:** what changed, next safe move, upcoming call, key commitments, data sufficiency, and private handling context.
- **Plan:** goals, milestones, tasks, promises, and open loops from canonical objects.
- **History:** sessions, approved observations, timeline, corrections, and supersession.
- **Files:** authorized artifacts and review state; external systems remain source owners.

Call Prep is an Overview focus mode. Mentor Memory is a private evidence/context inspector. Meeting Intelligence is a session detail and evidence view. These are not peer destinations competing in navigation.

## Call Prep

Call Prep fits one laptop viewport before deeper disclosure. It contains:

1. the call objective and reason this conversation matters now;
2. changes since the last approved interaction;
3. unresolved mentor and student commitments;
4. the next best question/action with source and review state;
5. the upcoming objective milestone;
6. private “handle with care” context with purpose and age;
7. data gaps or conflicts that constrain advice.

The mentor can mark an item stale, correct it, open evidence, or pin it to the call. Preparation target is a median of two minutes and p90 of three minutes in representative usability tests.

## Session Command

Starting a session freezes the subject and assignment in a visible banner. Student switching is disabled until the session is paused or ended. At most one active session exists per mentor unless an explicit recovery flow resumes another.

The workspace shows one objective, prior commitments, elapsed time, save/connectivity state, and a low-friction note stream. Quick capture creates a typed draft: student task, mentor task, mutual commitment, private memory, question, flag, or publication candidate. Each capture supports keyboard, touch, and an optional timestamp. Generic placeholder records are forbidden.

Capture must never publish, infer identity, or approve AI. Initial CAM v2 has no durable sensitive offline browser persistence: on disconnect, unsent memory-only content is labeled `NOT SAVED`, the loss-on-close/reload risk is explicit, and reconnect is idempotent. Any future encrypted/scoped offline persistence requires a separate approved storage ADR and is not an implementation option under this authority.

## Post-Session Review

Ending the call opens a resumable review, not a one-click save. Sections are independently reviewable:

- factual summary;
- student and mentor commitments;
- owner and due date;
- goals/milestones affected;
- private notes and sensitive context;
- AI proposals with verified evidence spans;
- candidate student publication items.

Each item can be edit, approve, reject, defer, or mark needs evidence. A review cannot imply that checkbox/input edits saved unless readback proves the resulting version. Partial failures identify exactly what saved and can be retried idempotently.

Review targets are complexity-banded, never incentives to rubber-stamp: a small manual session with at most three captures targets median ≤90 seconds; a bounded AI-assisted session with at most ten proposals targets median ≤3 minutes and p90 ≤5 minutes; larger/complex/sensitive sessions are explicitly deferred into the Review inbox with no speed penalty. Consequential items and sensitive/identity/publication decisions cannot be bulk approved.

## Work and Reviews

**Work** is Dr Brian’s cross-student obligations surface: mentor tasks, student tasks awaiting mentor action, promises, follow-ups, decisions, and aged open loops. Filters use ownership, consequence, due window, program/cohort, and evidence freshness.

**Reviews** is the human-decision inbox: AI claims, student publication, identity conflicts, and selected media exceptions. Pipeline administration, trigger policy, source diagnostics, and job repair live in a separate role-gated Operations workspace. Administrative machinery never auto-mounts inside normal Meeting Intelligence.

## Search and quick capture

`Cmd/Ctrl+K` searches students, canonical objects, sessions, and commands. Results state source, scope, and visibility. Global Quick Capture requires a student and explicit type before text; it cannot default a generic “action” to a hidden owner. If no verified assignment exists, it can create an unassigned mentor draft but cannot attach to a student.

## Switching, cohorts, and interruption

- Routes, not mutable globals, own selected student and tab state.
- Unsaved work blocks or safely stores navigation; back/forward restores the same subject, tab, filters, and scroll when safe.
- Opening a second tab does not silently overwrite a first; version conflict requires compare/reapply/discard.
- Cohort/program filters are saved mentor preferences, never authorization filters.
- Interrupted sessions and reviews show a resume card with last durable save, queued writes, and conflicts.
- Assignment expiry immediately locks new commands while preserving an appropriately redacted historical record.

## Mentor acceptance criteria

- Four of five representative mentors identify student, reason, trust state, and next action in 60 seconds or less.
- A call is prepared in a median of two minutes without opening more than one inspector.
- A basic typed capture takes median ≤10 seconds and p90 ≤20 seconds; a complete commitment with owner/date targets ≤20 seconds.
- Post-session review meets the complexity bands above, and every accepted object reads back with correct owner, due date, visibility, reviewer, and version.
- Subject continuity survives route changes, reload, back/forward, session resume, review, and multi-tab conflict.
- No private/sensitive object or AI proposal can be included in a student publication without a separate explicit decision.
- Every recommendation displays why, evidence age, origin, review state, and how to correct it.

Post-red-team mentor workflow architecture score: **9.3/10**, subject to implementation and observed usability evidence.
