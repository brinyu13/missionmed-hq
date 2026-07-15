# 03 Product Constitution

RESULT: `PRODUCT_AUTHORITY_DEFINED`

## What MMC is

Matrix Mentor Console is a human-controlled mentor intelligence operating system. It helps Dr Brian decide who needs attention, understand why, prepare a high-quality conversation, capture commitments without losing presence, review machine assistance, follow through, and preserve longitudinal advising continuity. It gives each student a separate, privacy-safe view of only the goals, tasks, milestones, summaries, feedback, and updates deliberately published to them.

MMC turns approved source evidence into reviewable coaching continuity. It does not turn a transcript into unquestioned truth.

## What MMC is not

- Not a generic CRM, EHR, surveillance dashboard, transcript warehouse, autonomous advisor, clinical decision tool, or match-prediction engine.
- Not a source of truth for WordPress, LearnDash, Matrix, Scheduler, Calendar, CRM, Webex, or residency-program data.
- Not permission to infer mental state, character, motivation, immigration status, or match probability from weak signals.
- Not a way to expose mentor notes by relabeling a field “student visible.”
- Not a substitute for Dr Brian’s judgment, a student’s agency, or official NRMP/program information.

## Primary users and jobs

| User | Job to be done | Success experience |
| --- | --- | --- |
| Dr Brian, mentor/operator | Know the most consequential next action for every student and close coaching loops. | Finds who/why/what-next in under 60 seconds; prepares a call in under 3 minutes; reviews outputs instead of reconstructing history. |
| Student | Understand the agreed plan, act, see progress, and correct misunderstandings safely. | Knows the next three actions, owners, dates, and rationale without seeing private or speculative reasoning. |
| MMC operator/admin | Resolve identity, pipeline, evidence, and review exceptions safely. | Works prioritized queues with source evidence, audit, retry, and no hidden advancement. |

## Product principles

1. **Decision before decoration.** Every primary surface answers a concrete operational question.
2. **One minute to orientation.** Today and student briefing expose change, urgency, ownership, evidence age, and next action before detail.
3. **Presence during the call.** Live capture favors a few semantic shortcuts, voice/keyboard efficiency, and recovery; it does not demand database administration.
4. **Review before consequence.** AI, identity, publication, and sensitive-state changes are proposals until an authorized human approves them.
5. **One object, many projections.** Tasks, goals, commitments, evidence, and sessions have one canonical state, reused by every screen.
6. **Progressive disclosure.** Urgent decisions stay visible; provenance and longitudinal detail remain one action away.
7. **Unknown is useful.** Missing evidence is displayed and routed; it is never converted into a reassuring score.
8. **Student agency.** Students can acknowledge, complete, comment, and request correction; they are not passive recipients of a mentor score.
9. **Interruption is normal.** Every multistep workflow can resume safely and exposes what saved.
10. **Protected ecosystems stay protected.** Integration uses narrow read adapters and MMC-owned writes only.

## Trust and evidence constitution

- Consequential claims name source, evidence span/pointer, age, origin (`observed`, `deterministic`, or `AI proposal`), confidence basis, review state, and supersession state.
- Confidence describes support for a bounded claim; it is not certainty about a person.
- Deterministic output and AI inference use different labels, icons, semantics, and accessible text.
- AI may summarize, extract proposals, organize evidence, and suggest questions. It may not verify identity, approve itself, publish to students, diagnose, or promise outcomes.
- Evidence is necessary but not sufficient for safe advice. Every consequential recommendation also names an active, human-approved advising-policy version and starts from the student’s stated goal/preferences rather than a system-imposed objective.
- A mentor override records reason and does not erase the prior evidence or decision.
- Corrections supersede; they do not silently rewrite history.

## Privacy and psychological-safety constitution

- Default visibility is mentor-only. Sensitive data receives an additional purpose and access gate.
- Student publication is an allowlisted copy with explicit approver, version, preview, and withdrawal. Private notes, internal risk rationale, raw transcripts, identity conflicts, and unreviewed AI are never eligible.
- Risk language describes an actionable workflow condition, not a personal trait. Use “deadline at risk because…” rather than “high-risk student.”
- Readiness is decomposed by objective domain and data sufficiency. No guaranteed match outcome, clinical inference, or unexplained composite score.
- Sensitive disclosures never increase a risk score merely because they exist.
- Visa, disability, nationality, race, ethnicity, religion, gender, pregnancy, health, language, age, socioeconomic context, and proxies are never inferred or used to disadvantage prioritization. An explicitly supplied eligibility fact may be used only for a narrow legitimate purpose with consent, provenance, explanation, and policy authority.
- UI language is plain, culturally comprehensible, and avoids shame, coercion, and false certainty. Official NRMP/FREIDA terminology is used only with source date and disclaimer.

## Human-control constitution

Humans approve identity links, evidence promotion, operational recommendations, and publication separately. High-consequence actions show target, scope, evidence, side effects, and rollback before confirmation. Bulk actions cannot cross students or conceal partial failure. Assignment revocation immediately removes that mentor's query, command, retry, and new-publication authority. It does not silently revoke an exact student's entitlement to an already-published projection; withdrawal, correction, expiry, and student-publication policy govern that separate lifecycle.

## Outcome constitution

MMC measures preparation time, follow-up latency, commitment closure, open-loop age, milestone movement, student acknowledgement, correction rate, review burden, identity accuracy, and pipeline reliability. These are operating and learning signals. They must not be presented as causal proof of a residency match or as a student ranking.

## 2035 vision

By 2035, MMC should act as an evidence-grounded continuity layer across a student’s longitudinal advising journey: it remembers approved commitments, detects unresolved loops, helps a mentor ask better questions, adapts communication to the student’s stated needs, and gives the student a transparent plan. It remains legible, reversible, source-aware, and human-governed as models and integrations change.

## Non-goals for CAM v2 implementation

- Autonomous outreach, application submission, rank-list strategy, or student scoring.
- Writes to external source systems.
- Production migration or deployment without separate authority.
- A broad MissionMed server/framework rewrite.
- Replacing official program data or mentor expertise.
- Training models on student data without a distinct data-governance decision.

## Rejected product patterns

- Red/yellow/green person labels without reason and recourse.
- A universal “readiness” gauge.
- Engagement streaks, shame-based overdue copy, or manipulative nudges.
- Chat-first navigation that hides objects, sources, and approval state.
- One-button “approve identity + analyze + publish.”
- Infinite dashboard cards and cloned detail fragments.
- Silent AI personalization or sensitive inference.

## Success measures and targets

| Measure | Architecture target | Guardrail |
| --- | --- | --- |
| Find highest-priority student and reason | Median ≤30 seconds; p90 ≤60 seconds in usability test | Reason and evidence age must be visible. |
| Prepare a scheduled call | Median ≤3 minutes after data is available | No claim may bypass review. |
| Record and assign a commitment | ≤20 seconds, keyboard and touch | Owner/date explicit; saved state announced. |
| Post-session review | Median ≤5 minutes for a normal session | Summary, action, privacy, and publication decisions separated. |
| Student understands next actions | ≥90% identify owner/date/next step in comprehension test | No internal risk score or private reasoning shown. |
| Cross-student or private-data leak | 0 in automated, manual, and staging tests | Any occurrence blocks release. |
| Duplicate processing on retry | 0 for deterministic retry suite | Idempotency proof required. |
| Evidence-linked AI-derived factual claims and factual premises used in consequential guidance | 100% | Missing support blocks the factual assertion. A mentor recommendation may proceed only as explicit `HUMAN_JUDGMENT` with named rationale, policy, and uncertainty—not as an unsupported fact or AI-verified claim. |
| Accessibility | WCAG 2.2 AA acceptance suite passes | No horizontal overflow at named viewports/200% zoom. |

Product success must be assessed with students and mentors across differing English fluency, IMG backgrounds, devices, and accessibility needs. A higher dashboard score is never itself a product outcome.
