# Y2-3102 Complete Combined Handoff

- Contract: `missionmed.y2.combined-handoff.v1`
- Source files: `10`
- Inclusion law: Every primary source report below is unabridged exactly once.

<!-- BEGIN Y2_3102_TEN_STUDENT_PILOT_PROTOCOL.md -->
# Y2-3102 Ten-Student Pilot Protocol

Status: draft only. No recruitment, enrollment, processing, publishing, billing, or learner activation is authorized by this ticket.

## Purpose And Scope

Evaluate whether adults using formative residency-interview practice find the MissionMed Interviewer Brain relevant, grounded, safe, and worth continuing. The pilot does not measure residency readiness, clinical competence, personality, emotion, deception, program fit, rankability, or Match probability.

- Cohort: up to 10 consenting adult students after D5 entitlement approval.
- Duration: one month.
- Planned use: four sessions per student, up to 20 minutes each.
- Individual allowance: 80 minutes per calendar month, no rollover.
- Rolling limit: 40 minutes in any seven-day window.
- Cohort planning volume: 800 minutes monthly.
- Circuit breaker: $75 monthly variable-provider spend for the cohort.

## Preconditions

1. Phase 0 technical tests and frozen holdout pass without kill-rule activation.
2. D3, D4, D5, D6, D7, and D9 are resolved as applicable.
3. Purpose-specific consent, withdrawal, deletion, auth, entitlement, and incident flows pass in a separate release ticket.
4. Human IMG-representative speech, network impairment, identical-Brain two-rail, browser/device, transcript fidelity, and spend gates pass.
5. Brian names pilot, privacy, incident, rollback, and support owners.

## Session Law

- Explain that this is simulated formative practice and not an admissions interview.
- Permit pause, skip, withdrawal, and human escalation without penalty.
- No PHI, identifiable patient material, real application documents, or protected-trait probing.
- The current pilot draft therefore does not activate applicant-material grounding; D3 approval and a revised protocol are required before that separate consent choice can be offered.
- One useful probe at pressure rungs 0-1 and at most two at rung 2+.
- Human instructors alone interpret evidence and author coaching or Orders.
- A provider or authority uncertainty denies admission before a chargeable session.

## Evidence Collection

Collect only session admission, duration, provider usage, recovery states, grounded decision events, guard activations, instructor review time, and consented feedback. Recordings and research reuse remain off unless separately consented and approved.

## Exit

Close every session, reconcile provider usage, complete deletion/retention actions, revoke grants, export aggregate non-identifying results, and hold a human go/no-go review. No automatic expansion follows a favorable result.
<!-- END Y2_3102_TEN_STUDENT_PILOT_PROTOCOL.md -->

<!-- BEGIN Y2_3102_CONSENT_DRAFT.md -->
# Y2-3102 Consent Draft

Status: product/privacy/legal draft. It is not final policy and must not be presented to students without approval.

## Plain-Language Notice

MissionMed proposes an optional simulated residency-interview practice session using an automated interviewer. It is formative practice, not a real interview, evaluation, diagnosis, readiness assessment, ranking, program-fit decision, or Match prediction. A human MissionMed instructor remains responsible for any coaching.

## Separate Choices

Each purpose requires an independent affirmative choice:

- Live AI text/voice processing by named processors.
- Audio recording.
- Transcript storage.
- Grounding on an explicitly selected applicant-material pack only after D3 and a later pilot protocol explicitly authorize it; it is excluded from the current ten-student draft.
- Grounding on instructor-set focus items.
- Sharing specified artifacts with a named instructor.
- Product-improvement research use.
- Optional future physiology processing.

No choice may be inferred from membership, entitlement, attendance, another consent, or a preselected box.

## Data Notice

Before consent, disclose each processor, data type, purpose, region, training use, default retention, configured retention, deletion evidence class, access recipients, and MissionMed retention rule. Contractual zero-retention is a weaker evidence class than provider-verified absence and must be labeled honestly.

## Control

The learner may pause, skip a question, stop the session, revoke sharing, withdraw a consent, request correction, or request deletion. Withdrawal stops new processing but cannot undo processing already completed. The interface must state what is deleted, retained, deidentified, or awaiting provider confirmation.

## Draft Retention Proposal

- Live processor content: configured zero retention where contractually available.
- Raw audio: off by default; if separately authorized, no more than 30 days.
- Transcript, Brain events, and instructor packet: no more than 30 days unless the learner explicitly saves a named artifact under a reviewed policy.
- Consent, audit, incident, and deletion evidence: retained only for the reviewed governance period, with content minimized or pseudonymized.

Brian, privacy, and legal review must approve or replace these durations before pilot activation.

## Acknowledgment

Consent records policy version/hash, purpose, scope, processor profile, grant time, expiry, withdrawal time, and actor. A withdrawn receipt is never reactivated; a new purpose requires a new receipt.
<!-- END Y2_3102_CONSENT_DRAFT.md -->

<!-- BEGIN Y2_3102_INSTRUCTOR_REVIEW_WORKFLOW.md -->
# Y2-3102 Instructor Review Workflow

Status: draft only.

1. Verify the instructor identity and an exact live artifact grant. Administrator status alone does not grant learner-content access.
2. Open the evidence-first packet. Confirm synthetic/simulation status, persona/plan/policy/model versions, session event range, source hashes, and consent state.
3. Read what the learner said, then what the Brain asked. Do not begin with the machine rationale.
4. For every probe, verify the cited answer span, move type, probe index/cap, policy tag, and guard outcome.
5. For a possible contradiction, verify two exact spans and neutral handling. Dismiss any unsupported conflict.
6. Verify callbacks are accurate and useful, not theatrical recall.
7. Verify STAR-gap probes were relevant to a behavioral/situational answer and stayed within cap.
8. Check prohibited-question, sensitive-boundary, injection, recovery, and reconnect events.
9. Correct or dismiss machine observations. The system must preserve the correction and never silently rewrite history.
10. Author any coaching or Order as the human instructor. The Brain cannot create, approve, or publish an Order.
11. Revoke access or initiate deletion when requested. Confirm completion evidence before saying data is deleted.

## Three-Minute Gate

An independent instructor must identify, within three minutes: what was said, what was probed, why, the exact evidence, cap compliance, guard outcomes, contradiction handling, callback behavior, and recovery state. Failure pauses the pilot and requires report redesign.
<!-- END Y2_3102_INSTRUCTOR_REVIEW_WORKFLOW.md -->

<!-- BEGIN Y2_3102_STUDENT_FEEDBACK_INSTRUMENT.md -->
# Y2-3102 Student Feedback Instrument

Status: draft only. Responses do not establish educational efficacy.

Use a five-point agreement scale plus optional comments unless noted.

1. The interviewer questions felt relevant to what I had just said.
2. Follow-up questions helped me add useful detail.
3. The interviewer stopped probing at an appropriate point.
4. The interviewer recovered clearly when I paused, skipped, or changed direction.
5. I understood when the system was automated and when a human instructor was responsible.
6. I felt able to pause, skip, or stop without penalty.
7. I understood what information was stored and shared.
8. I felt the questions stayed within appropriate professional boundaries.
9. Callbacks to earlier details were accurate and useful.
10. The session felt culturally and linguistically respectful.
11. The 20-minute cap felt: too short / about right / too long.
12. I would choose another session: yes / maybe / no.
13. I would prefer this as: included in membership / optional paid add-on / instructor-led only / would not use.
14. What was the most useful moment?
15. What felt repetitive, uncomfortable, confusing, or unnecessary?

Optional self-report such as “I feel more prepared” may be collected only as subjective experience. It must not be represented as proof of improved interview performance, readiness, or Match outcome.
<!-- END Y2_3102_STUDENT_FEEDBACK_INSTRUMENT.md -->

<!-- BEGIN Y2_3102_INSTRUCTOR_FEEDBACK_INSTRUMENT.md -->
# Y2-3102 Instructor Feedback Instrument

Status: draft only.

Record review duration and use a five-point agreement scale unless noted.

1. I could identify what the learner said, what was probed, and why in under three minutes.
2. Each probe was grounded in an exact, accessible evidence span.
3. Follow-ups were answer-specific rather than generic templates.
4. The probe cap and transition timing were appropriate.
5. Callbacks were accurate and instructionally useful.
6. STAR-gap prompts targeted material missing information without forcing STAR everywhere.
7. Possible contradictions were quoted accurately and handled without accusation.
8. Persona behavior remained consistent without changing safety rules.
9. Recovery and reconnect behavior was understandable.
10. The report made consent, provenance, simulation, and limitations visible.
11. The system avoided clinical, psychological, personality, emotion, deception, readiness, ranking, program-fit, and Match conclusions.
12. The interaction treated IMG pathways, code-switching, caregiving, remediation, resource constraints, and non-linear experiences without caricature or extra skepticism.
13. Which probe should have been omitted?
14. Which missed follow-up would have added the most value?
15. Would you use this evidence to guide your own coaching? Why or why not?

Any prohibited inference, false applicant fact, unsupported contradiction, consent failure, or cross-session leak is a safety event, not merely a low rating.
<!-- END Y2_3102_INSTRUCTOR_FEEDBACK_INSTRUMENT.md -->

<!-- BEGIN Y2_3102_DEMAND_AND_WTP_TEST.md -->
# Y2-3102 Demand And Willingness-To-Pay Test

Status: prepared only. Do not publish, recruit, charge, or collect payment in this ticket.

## Hypotheses

- Existing MissionMed learners will reserve time for repeated AI interview practice.
- The preferred value is attributable to answer-specific probing and instructor continuity, not novelty.
- Some learners will accept a bounded add-on price after seeing truthful limits.

## Test Cells

1. Waitlist: describe a 20-minute formative practice session and ask for an email-free internal expression of interest.
2. Priced intent: randomize a nonbinding price point and ask whether the learner would reserve, not merely “like,” the feature.
3. Mentor-driven Wizard-of-Oz: a human operates the frozen text Brain with an explicitly consenting volunteer; no deception about automation.

## Measures

Record invitation denominator, qualified interest, reservation intent, chosen price, cancellation, completed sessions, repeat use, time consumed, and reason for refusal. Do not infer demand from satisfaction alone.

## Decision Rule

Brian must pre-register the minimum qualified-interest and repeat-use thresholds before launch. Proceeding past Phase 0 requires both technical evidence and demand evidence. A technically passing harness may still be stopped for weak demand.

## Honesty

No claim of savings, superiority, readiness improvement, or guaranteed price is permitted. Any stated $20-$52 monthly cohort estimate is a planning range derived from current assumptions, excludes labor and avatars, and must be refreshed against contracted prices before launch.
<!-- END Y2_3102_DEMAND_AND_WTP_TEST.md -->

<!-- BEGIN Y2_3102_USAGE_METERING_AND_ENTITLEMENT.md -->
# Y2-3102 Usage Metering And Entitlement

Status: operational specification only; no entitlement or billing system is changed.

## Admission Contract

Before a chargeable session, the server must atomically verify:

- authenticated active CAM authority session;
- D5-approved entitlement;
- all required purpose consents;
- individual monthly use below 80 minutes;
- rolling seven-day use below 40 minutes;
- requested duration within the session cap;
- cohort circuit breaker open;
- provider readiness and current rate profile known;
- one idempotent admission reservation.

Any missing, stale, conflicting, or unavailable authority fails closed before provider connection.

## Metering Events

Use immutable `ADMISSION_RESERVED`, `SESSION_STARTED`, `USAGE_PROVISIONAL`, `SESSION_ENDED`, `PROVIDER_RECONCILED`, `RESERVATION_RELEASED`, and `ADMIN_OVERRIDE_RECORDED` events. Every event carries a stable idempotency key, session ID, provider reference hash, quantity, unit, source, event time, received time, and supersession link.

Provider reports never directly overwrite MissionMed usage. Reconciliation compares provider quantity with MissionMed monotonic session duration and records a bounded adjustment.

## Warnings And Limits

- 75% warning: 60 of 80 monthly minutes.
- 90% warning: 72 minutes.
- 100%: deny new chargeable admission.
- No rollover and no paid top-ups during the pilot.
- Administrator override is server-derived, time-bounded, purpose-recorded, and cannot bypass consent or the cohort spend breaker.

Duplicate, delayed, out-of-order, or replayed usage events are idempotent. An abandoned reservation expires and is reconciled; it cannot silently consume a full session.
<!-- END Y2_3102_USAGE_METERING_AND_ENTITLEMENT.md -->

<!-- BEGIN Y2_3102_COST_DASHBOARD_AND_CIRCUIT_BREAKERS.md -->
# Y2-3102 Cost Dashboard And Circuit Breakers

Status: specification only. No vendor account, spend, alert, or dashboard is activated.

## Dashboard

Show, by day and month:

- admitted, started, completed, abandoned, and denied sessions;
- MissionMed minutes, provider-reported minutes, and reconciliation delta;
- STT, model, TTS, rail, egress, and storage cost components;
- cost per session, per student, and per completed minute;
- 75%, 90%, and 100% usage warnings;
- cohort spend against the $75 breaker;
- unknown or missing provider reports;
- duplicate/replayed events and manual adjustments;
- current price-profile version and effective date.

No transcript, applicant content, bearer value, provider credential, or raw user identifier appears in cost telemetry.

## Circuit Breakers

- Hard deny before a new chargeable session when projected cohort spend would exceed $75.
- Hard deny when price configuration or provider usage reporting is missing/stale.
- Cap each session at the approved duration and terminate provider work after bounded grace.
- Stop automatic retries after a bounded attempt/cost budget.
- Pause a provider on reconciliation drift, duplicate billing, or anomalous unit price.
- Keep deletion and incident handling available while admissions are off.

The planning estimate of approximately $20-$52 monthly for 800 minutes is not a guarantee. It excludes labor, avatars, taxes, negotiated enterprise controls, and incident overhead.
<!-- END Y2_3102_COST_DASHBOARD_AND_CIRCUIT_BREAKERS.md -->

<!-- BEGIN Y2_3102_SUCCESS_PAUSE_AND_KILL_CRITERIA.md -->
# Y2-3102 Success, Pause, And Kill Criteria

## Technical Success

- Exact T1-T7 Phase 0 gates pass on development and frozen holdout evidence.
- No guardrail, injection, cross-session, fabricated-fact, probe-cap, or consent failure.
- Ledger restart/reconnect is deterministic and corruption fails closed.
- Independent instructor packet review is correct and under three minutes.
- Real Phase 1 prerequisites later pass without weakening policy.

## Pilot Success

Brian must pre-register demand thresholds. Suggested measures are completion, repeat use, instructor utility, grounded follow-up rate, redundant-probe rate, boundary safety, recovery success, review time, cost per completed minute, and deletion completion. Student self-report is experience evidence only.

## Immediate Pause

Pause admissions on any prohibited question; clinical, psychological, personality, emotion, deception, readiness, ranking, program-fit, or Match inference; ungrounded applicant fact; false contradiction; consent or grant failure; cross-session leak; probe-cap breach; provider-retention mismatch; missing usage report; spend-breaker uncertainty; or false deletion claim.

## Kill

- T1-T4 materially fail after two deliberate policy iterations.
- Any unresolved injection or guardrail failure.
- Harm cannot be reduced without weakening evidence or increasing pressure.
- Required provider privacy/deletion conditions cannot be contracted or verified.
- Demand evidence fails the pre-registered threshold.
- Costs cannot be bounded below the pilot circuit breaker.
- Instructor review remains too opaque or burdensome.

Killing or pausing the pilot does not erase audit/deletion obligations and does not affect existing manual CAM practice.
<!-- END Y2_3102_SUCCESS_PAUSE_AND_KILL_CRITERIA.md -->

<!-- BEGIN Y2_3102_PILOT_OPERATIONS_CHECKLIST.md -->
# Y2-3102 Pilot Operations Checklist

Status: draft only. Every unchecked release item blocks pilot activation.

## Before Activation

- [ ] Founder decisions D3-D7 and D9 recorded as applicable.
- [ ] Pilot, privacy, incident, support, and rollback owners named.
- [ ] Adult eligibility and D5 entitlement confirmed server-side.
- [ ] Consent copy/version approved and withdrawal tested.
- [ ] Provider contracts, regions, training use, retention, and deletion evidence verified.
- [ ] Human IMG accent and code-switching benchmark passed.
- [ ] Network impairment and identical-Brain two-rail comparison passed.
- [ ] Browser/device, reconnect, transcript fidelity, and accessibility passed.
- [ ] Usage ledger, warnings, admission reservation, reconciliation, and $75 breaker fault-tested.
- [ ] Deletion closure includes every Y2 artifact and processor evidence class.
- [ ] Support pathway and emergency disable rehearsed.

## Daily

- [ ] Health, admission denial, provider error, cost drift, and reconciliation reviewed.
- [ ] No missing reports, duplicate usage, stuck sessions, or pending critical deletions.
- [ ] Incidents triaged without reading learner content unless authorized and necessary.

## Per Session

- [ ] Authority, entitlement, consent, quota, duration, provider readiness, and spend reserved atomically.
- [ ] Learner can pause, skip, stop, and reach human support.
- [ ] Session closes, provider usage reconciles, and reservation releases.

## Shutdown

- [ ] Disable new admissions and provider calls.
- [ ] Preserve audit and continue deletion workers.
- [ ] Revoke scoped credentials and grants.
- [ ] Reconcile all usage and spend.
- [ ] Complete or truthfully park deletion jobs.
- [ ] Notify affected participants using approved incident copy.
- [ ] Export aggregate evidence and hold a human review before any restart.
<!-- END Y2_3102_PILOT_OPERATIONS_CHECKLIST.md -->
