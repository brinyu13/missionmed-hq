# 15 Identity and Intelligence State

RESULT: `IDENTITY_REVIEW_LANES_AND_MENTOR_INTELLIGENCE_BASELINE_VERIFIED`

## Executive state

The reconciled branch separates three concepts that must never be conflated:

1. **Student identity** — which canonical person/assignment a source asset belongs to.
2. **Deterministic mentor intelligence** — summaries and recommendations derived from MMC-owned goals, tasks, promises, sessions, memory, and assignments.
3. **AI meeting analysis** — versioned, evidence-required inferences from a transcript, subject to human review.

Identity is never delegated to generative AI. Name-only and title-only evidence do not auto-attach a source asset. Deterministic mentor intelligence is not mislabeled as AI. AI output does not become student-visible merely because a run succeeds.

## Canonical implementation files

- `missionmed-hq/lib/mmc-student-resolution-engine.mjs`
- `missionmed-hq/lib/mmc-roster-verification-lane.mjs`
- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`
- `missionmed-hq/prompts/mmc-meeting-analysis-default.md`
- `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js`
- `missionmed-hq/public/mmc-private/src/app.js`
- `missionmed-hq/tests/mmc-student-resolution-engine-validation.mjs`
- `missionmed-hq/tests/mmc-roster-identity-bridge-validation.mjs`
- `missionmed-hq/tests/mmc-roster-verification-lane-validation.mjs`
- `missionmed-hq/tests/mmc-selection-continuity-validation.mjs`

Relevant local product evidence:

- `screenshots/03_student_directory.png`
- `screenshots/04_student_profile_goals_timeline.png`
- `screenshots/06_mentor_memory_call_prep_open_loops.png`
- `screenshots/07_selection_continuity_meeting_diego.png`
- `screenshots/08_selection_continuity_call_prep_diego.png`
- `screenshots/13_identity_roster_review_lanes.png`
- `screenshots/18_populated_meeting_state_raj.png`
- `screenshots/19_empty_meeting_state_yuki.png`

## Student-resolution state machine

The source-asset resolver emits one of:

- `VERIFIED`
- `PROBABLE`
- `MANUAL_REVIEW`
- `CONFLICT`
- `UNVERIFIED`

It evaluates meeting confidence and student confidence separately, then combines them. Current thresholds are:

| Decision | Verified threshold | Probable threshold |
| --- | ---: | ---: |
| Meeting | 0.84 | 0.68 |
| Student | 0.86 | 0.72 |
| Overall | 0.86 | 0.72 |

Auto-attachment is allowed only when all of the following hold:

- no conflict exists;
- meeting state is `VERIFIED`;
- student state is `VERIFIED`;
- combined confidence is at least 0.86;
- a canonical student ID is present;
- the candidate is not a known fixture identity.

Anything else remains review-required. A probable result is a suggestion, not an attachment.

## Resolution evidence

The resolver may use:

- existing verified/probable meeting status;
- date evidence;
- meeting-kind evidence;
- recording and transcript pointers;
- deterministic idempotency key;
- explicit student IDs in approved metadata;
- explicit subject-reference or assignment IDs;
- candidate names from approved metadata/title/filename;
- RLS-scoped identity references;
- active mentor assignments.

Candidate names are deliberately lower-confidence and cannot establish identity alone. Conflicting high-scoring candidates produce `CONFLICT`. Missing strong identity evidence produces `MANUAL_REVIEW` or `UNVERIFIED`, even when the meeting itself is clear.

The resolver returns its evidence, reasons, candidate list, confidence, auto-attach decision, and queue disposition. It explicitly records protections against production hydration, canonical identity declaration, name-only attachment, fixture attachment, and Daily Drills mutation.

## Roster verification lane

The roster lane is a second, production-safe review boundary. Its source inventory is ordered as follows:

| Priority | Evidence source | Current role |
| ---: | --- | --- |
| 1 | Existing RLS-scoped MMC identity references and mentor assignments | Strongest verified local authority |
| 2 | WordPress user | Future approved read-only strong anchor |
| 2 | LearnDash enrollment | Future approved read-only strong anchor |
| 3 | Matrix profile/student profile | Future approved read-only strong anchor; Matrix remains protected |
| 4 | Scheduler student/appointment | Future no-write strong anchor |
| 5 | CRM person/student profile | Future approved read-only strong anchor |
| 6 | Calendar title + date | Supporting only |
| 6 | Webex title + date | Supporting only |

No live source above was mutated or credential-probed in Prompt 004A.

### Promotion rule

Automatic verified promotion requires:

- a canonical student ID;
- no conflict;
- no fixture identity;
- at least two independent strong source systems;
- confidence of at least 0.86.

An explicit admin-approved promotion can proceed with at least one strong anchor, but still cannot bypass a conflict or fixture block. Name, email, Calendar title/date, Webex title/date, meeting title, and filename evidence are weak/supporting and cannot independently verify a person.

The review result preserves strong anchors, independent systems, supporting evidence, conflicts, reasons, confidence, and approval state. Approval writes only verified MMC-owned `identity_references` and `mentor_assignments`; it never writes back to WordPress, LearnDash, Matrix, Scheduler, CRM, Calendar, or Webex.

## Review workflow

```text
Source asset
  -> deterministic evidence extraction
  -> meeting confidence
  -> student candidate confidence
  -> VERIFIED / PROBABLE / MANUAL_REVIEW / CONFLICT / UNVERIFIED
  -> Pipeline Admin review queue
  -> optional roster evidence verification
  -> explicit admin approval when policy is satisfied
  -> MMC identity reference + active assignment
  -> source asset attachment to student/session
```

Every transition that establishes identity belongs in an auditable, reversible MMC-owned action. The UI must never display a suggested person as confirmed before approval.

## Selection continuity repair

The local product audit found a client-state defect: selecting one student in Directory/Profile did not reliably update Meeting Intelligence and the full Mentor Memory briefing. This could present context for two different fixture students in one operator flow.

Prompt 004A repaired only the MMC client state:

- opening a Profile now updates the active Meeting Intelligence student;
- entering Mentor Memory rerenders the full briefing, not only the focus card;
- a deterministic selection-continuity validator was added;
- browser evidence verifies continuity across Profile, Meeting Intelligence, and Call Prep.

This repair did not change server auth, persistence, schema, identity thresholds, or any external system.

## MMC-owned deterministic intelligence

The ownership layer implements the following engines over MMC-owned records:

| Engine | Inputs | Output |
| --- | --- | --- |
| Student briefing | memory, goals, tasks, promises, sessions, assignment | concise prep view and priority context |
| Open-loop detector | incomplete tasks, promises, repeated topics, session state | unresolved commitments/topics |
| Promise engine | mentor/student promises and due state | overdue/complete promise projection |
| Advice-history engine | memory and session advice | latest/repeated/not-yet-acted-on guidance |
| Timeline summarizer | sessions, tasks, goals, memory | longitudinal change/milestone summary |
| Risk summary | follow-through, due state, mentor context | bounded risk score/status |
| Readiness framework | goals, milestones, sessions, tasks | readiness score/status |
| Relationship context | verified mentor memory | personal preferences and continuity cues |
| Next-best-move engine | risk, open loops, promises, goals, context | deterministic coaching recommendation |

These are current product mechanisms, not proof of clinical or residency outcome validity. Fable should preserve their usefulness while exposing input provenance, recency, and reason codes.

## Mentor-memory classifications

The data model distinguishes:

- standard coaching context;
- sensitive relationship/personal context;
- private mentor notes;
- source-backed session advice;
- next-move recommendations;
- student-approved projections.

Sensitive or mentor-private objects must remain visually unmistakable and denied to the student view by default. A human approval action is required before any derived summary or action is projected to a student.

## AI meeting analysis

The repository default prompt and route require a structured result containing:

- summary;
- action items with owner, due signal, sensitivity, confidence, and evidence;
- story insights;
- mentor-note draft;
- sensitive topics with `mentor_only` intent;
- relationship signals and trend;
- timeline events;
- risk level, reasons, and confidence;
- readiness level, reasons, and confidence;
- next best move;
- overall confidence;
- source evidence.

Each evidence item requires a quote, location, relevance, and confidence. The server validates the complete output schema before persistence. Invalid confidence, missing evidence, unknown fields, or malformed arrays are rejected.

## Prompt and analysis versioning

The pipeline supports:

- prompt inventory;
- creation of a new prompt version;
- activation of one version;
- archival of superseded active versions;
- rollback to a prior version;
- syntax/contract testing;
- analysis-run creation and source attachment;
- mock contract analysis;
- real provider analysis when explicitly enabled.

An analysis run records provider, model, prompt version, status, attempts, start/completion time, confidence, evidence references, source asset, subject/assignment/session attachment, and runtime metadata. Prompt text belongs in the versioned database/repository prompt system, not in deployment configuration.

## Real-provider gate

Real analysis is fail-closed unless:

- the MMC AI feature is explicitly enabled;
- the provider is supported;
- a provider credential exists at runtime;
- a readable transcript pointer exists;
- a prompt body is available;
- the provider returns schema-valid structured output.

The Prompt 004A local product run kept real provider use disabled and did not read or expose credentials. A mock run remains clearly labeled as a contract validator and produces zero-confidence placeholder content, not coaching guidance.

## Persistence of structured intelligence

Validated analysis is transformed into MMC-owned records linked back to the analysis run and source asset. Depending on output, the pipeline can persist:

- session artifact/summary;
- action items;
- mentor memory;
- open loops;
- intelligence snapshot;
- audit events.

Persisted output retains confidence and evidence references. The originating source media remains external/read-only, and student visibility remains a separate review decision.

## Current trust strengths

- Identity and analysis are separate systems.
- No name-only or email-only automatic promotion.
- Fixture identities are blocked from production-style promotion.
- Calendar and Webex evidence remain supporting only.
- Confidence is explicit and bounded from 0 to 1.
- Conflicts become a review state, not an optimistic match.
- Analysis requires evidence at both item and aggregate levels.
- Prompt/model/run provenance is recordable.
- Sensitive topics and mentor notes have explicit classifications.
- All reviewed writes remain in MMC-owned RLS tables.

## Current debt

1. The UI needs a first-class evidence drawer showing source span, source type, confidence, prompt/model, and reviewer.
2. Risk/readiness/next-move cards need compact explanations of why the value changed.
3. Identity review needs a clearer difference between candidate, probable, verified, conflict, and admin-approved.
4. The live least-privilege evidence envelopes for external identity sources remain unverified.
5. Confidence thresholds need outcome-based calibration before being treated as operationally predictive.
6. Duplicate/merged identity handling and revocation need explicit UX and contracts.
7. Student publication needs object-level approval, preview, versioning, and withdrawal.
8. Sensitive memory needs retention, correction, and provenance controls.
9. Deterministic intelligence and AI inference need visually different labels everywhere.
10. Empty, stale, failed, and partial-analysis states need equal design attention to successful states.

## Fable non-negotiables

Fable must preserve:

- explicit unresolved identity;
- review queues and conflict state;
- no name/email/title-only verification;
- two-independent-strong-anchor rule for automatic promotion;
- fixture blocking;
- prompt/model/source/evidence provenance;
- deterministic-versus-AI labeling;
- mentor-only, sensitive, and student-approved separation;
- human review before student projection;
- assigned-mentor/RLS access boundary;
- auditability and reversible approval.

## Validation state

The reconciliation run's deterministic validators pass for:

- student-resolution engine;
- roster identity bridge;
- roster-verification lane;
- coaching-pipeline contract;
- coaching worker route;
- Webex trigger route;
- private mount;
- cross-screen student-selection continuity.

No credentialed production identity proof, staging schema mutation, or external source write was needed or performed.

## Conclusion

The branch contains a credible identity-safe and evidence-bound mentor-intelligence foundation. Its central product value is longitudinal continuity: what happened, what was promised, what remains open, why the student may be at risk, and what the mentor should do next. Its central safety rule is equally clear: identity and inferred guidance remain reviewable, evidenced, scoped, and human-controlled.
