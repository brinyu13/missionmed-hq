# A1 MMC Fable 5 CAM v2.0 Input Package

RESULT: `COMPLETE_CANONICAL_INPUT_PACKAGE`

This package describes the verified canonical Pro integration branch at code tip `bbdcd96d859b3eae2a04390d3500633b3961fff0`. Air reports remain provenance; only the integrated bytes and final authority matrix are implementation candidates.

## MMC Product Purpose

MMC is a mentor operating system for converting longitudinal student context and each coaching meeting into accountable, evidence-linked next actions. It should help a mentor know whom to attend to, prepare with the right personal and academic context, conduct a focused call, capture promises/tasks/notes without breaking presence, and carry verified learning into the next interaction. It also exposes a deliberately narrower student view of approved goals, tasks, deadlines, summaries, and files.

The experience is not a generic CRM, transcript viewer, or autonomous clinical/academic decision maker. AI output must remain traceable to source material, communicate uncertainty, and never silently resolve identity.

## Original MMC-005A Product Authority

The verified `mmc-v1-core/` fixture declares the MMC-005A product lineage and now passes its standalone parity validator on the Pro. It is the preserved historical product/test oracle, not the current runtime. The evolved private route is the current consolidated implementation candidate.

Known original-core paths:

- `mmc-v1-core/index.html`
- `mmc-v1-core/src/app.js`
- `mmc-v1-core/src/mmc-data-adapters.js`
- `mmc-v1-core/src/mmc-ownership-layer.js`
- `mmc-v1-core/src/styles.css`
- `mmc-v1-core/tests/mmc-core-validation.mjs`

## Current Consolidated Screens

The canonical branch private route contains:

- Today: program rollup, operating loop, urgent actions, cohorts, recent transcripts, and mentor-memory alerts.
- Actions: mentor promises, reviews, follow-ups, decisions, student actions, due state, and ownership.
- Attention-Ranked Student Directory.
- Student Intelligence Profile: scores, flags, strategy, readiness, journey, meetings, messages, files, and StoryForge readiness.
- Meeting Intelligence: Webex recording, transcript context, AI summary, actions, story insights, and mentor-only notes.
- Mentor Memory / Call Prep: personal/family context, promises, prior advice, sensitive context, and next coaching move.
- Session Command: quick reference, follow-through, live notes, tags, and objects created during the call.
- Post-Session Capture: summary, action review, visibility controls, and additional context.
- Student View Preview: approved tasks, deadlines, goals, summaries, and files.
- Quick Capture available across the mentor workflow.

## Mentor Journey

1. Triage the Today view and attention-ranked directory.
2. Open the student's longitudinal profile and identify readiness, risk, unresolved promises, and relationship context.
3. Enter pre-call briefing with source-backed personal context, prior advice, and the next best coaching move.
4. During the call, use Session Command for low-friction notes, promises, tasks, and private context.
5. Review the transcript/recording and bounded AI analysis.
6. Confirm post-session summary, ownership, deadlines, and which information is student-visible.
7. Reuse verified memory and follow-through state in the next operating loop.

## Student Journey

The student should see only explicit, approved projections: their tasks, deadlines, goals, selected meeting summaries, and submitted files. Mentor-only notes, sensitive context, internal risk reasoning, unresolved identity candidates, and unapproved AI inferences must not leak into the student view. Visibility should be object-level, reviewable, and reversible.

## Pre-Call, Live-Call, and Post-Call Workflow

- Pre-call: triage attention, verify identity/assignment, read the longitudinal brief, inspect promises and relationship context, and choose an evidence-backed next move.
- Live call: keep Session Command low-friction; capture notes, promises, tasks, and visibility intent without claiming unresolved identity or AI inference as fact.
- Post-call: bind recording/transcript provenance, run bounded analysis, review identity and confidence, approve the summary and actions, assign ownership/deadlines, and explicitly project only approved objects to the student.

## Meeting Intelligence and Persistence

The canonical branch retains the demo/local ownership layer and adds a guarded server-backed staging candidate. Persistence is disabled by default, restricted to the MMC staging project, uses an anon key plus a short-lived RLS JWT, and remains behind the existing authenticated API and CSRF gate. The migrations are preserved but unapplied; this is not proof of production persistence.

The integrated implementation now includes:

- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`
- `missionmed-hq/lib/mmc-coaching-import-worker.mjs`
- `missionmed-hq/prompts/mmc-meeting-analysis-default.md`
- `missionmed-hq/lib/mmc-student-resolution-engine.mjs`
- `missionmed-hq/lib/mmc-roster-verification-lane.mjs`
- `missionmed-hq/lib/mmc-webex-triggered-pull.mjs`
- MMC schema and coaching-intelligence migrations
- contract, worker, persistence, identity, roster, Webex, and browser validators

These implement the intended server-backed path: discover or receive a meeting artifact, preserve media provenance, resolve the student without guessing, import through a dedicated worker, generate evidence-bound analysis, stage/review persistence, and project only approved information into mentor/student experiences.

## Current AI Analysis

The default meeting-analysis prompt requires evidence-bound summaries, decisions, promises, actions, risks, and next moves. Real provider use is gated; local validation explicitly set `MMHQ_MMC_AI_ENABLED=false`. Fable must expose provenance, confidence, prompt/model version, review state, and the difference between source fact, deterministic derivation, and AI inference.

## Current Webex State

The branch includes a gated, GET-only Webex triggered-pull module and a dedicated import worker. Policy and route validators pass, and the local browser smoke confirms the pull gate remains closed without a token. The default pull module preserves an observed legacy typo path (`MissionWebexVidoes`) while the worker prefers `MissionWebexVideos`; explicit route operations pass the intended path, but the default-path divergence is documented technical debt. No Webex account or production media was mutated.

## Media and Identity Safeguards

- Preserve the original Webex/source identifiers and immutable provenance; never present copied media as a new source.
- Separate discovery/trigger policy from the worker that imports and analyzes coaching content.
- Require deterministic student resolution, roster identity bridging, and a verification lane for ambiguous matches.
- Show unresolved identity as a review state, not an inferred success.
- Keep mentor-only, sensitive, student-approved, and operational metadata visibility distinct.
- Keep generated analysis linked to source spans/artifacts, model/prompt version, time, and confidence.

## UX Drift, Information Overload, and Workflow Debt

- The current static private route is card-dense and spreads one operating loop across many screens; critical actions compete with context.
- The same student facts appear in Today, Profile, Call Prep, Session Command, Meeting Intelligence, and Student Preview without a clear canonical object hierarchy.
- Demo fixtures and local persistence make save/sync authority ambiguous.
- AI-processed badges and next-move language need visible evidence, confidence, and review state.
- Mentor memory mixes useful relationship context with sensitive material; disclosure and provenance must be unmistakable.
- The Webex, identity, worker, analysis, persistence, and review states need one comprehensible lifecycle.
- Quick capture should reduce interruption without creating an unreviewed accumulation of notes, promises, or duplicate tasks.
- Student visibility belongs in the core object model, not as a late post-session toggle alone.

## Known Opportunities

- Collapse the mentor operating loop into a progressive pre-call/live-call/post-call spine while preserving drill-down evidence.
- Replace repeated cards with canonical student, meeting, promise, task, and evidence objects plus role-scoped projections.
- Make unresolved identity, review queues, confidence, and provenance first-class states.
- Use CAM v2.0 hierarchy and restrained density to separate urgent action from longitudinal context.
- Show system boundaries: discovered, imported, analyzed, reviewed, persisted, and student-published.
- Normalize the Webex drop-zone path through a later tested ticket without losing legacy discovery.
- Preserve a visible staging/offline/demo mode so fixture data can never be mistaken for live authority.

## Technical Constraints and Non-Negotiable Protections

Fable must not redesign or weaken:

- authentication or private-route authorization;
- RLS or persistence ownership;
- the dedicated Coaching Import Worker boundary;
- deterministic identity resolution and roster verification;
- Drills isolation and protected Matrix runtime boundaries;
- media provenance and immutable source identity;
- evidence-bound AI output and human review;
- mentor-only/sensitive/student-visible separation;
- rollback and validation requirements for schema work.

No Fable recommendation may assume production migration, live configuration changes, or broader server replacement.

## Verified CAM v2.0 Authority

- Exact file: `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html`
- Size: 379,248 bytes
- SHA-256: `23b338d945baf87b173e7db7cbeba39d62dc461b325d916ab31b67f25c2e30f5`
- Supporting translation authority: `/Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/R1_MISSIONMED_CAMPUS_5002_ROWAN/02_MATRIX_HERITAGE_AND_CAM_TRANSLATION.md`

CAM v2.0 contributes the skin and feel; Matrix contributes structure. Relevant laws include the Archivo/Rajdhani type pair, ink chrome, restrained family hues, 12–14px panels, chamfered primary controls, persistent rail/HUD, right-side inspectors, short purposeful motion, and a mobile bottom rail. Content colors should indicate meaning, never become arbitrary chrome. The 407F authority also demonstrates role-scoped visibility, approval gates, deterministic-not-AI labeling, provenance summaries, versioning, and different export scopes; those are directly relevant to MMC trust design.

## Exact Files Fable Must Read

At minimum:

- the verified `mmc-v1-core/` package;
- `missionmed-hq/public/mmc-private/index.html`;
- every file under `missionmed-hq/public/mmc-private/src/`;
- `missionmed-hq/tests/mmc-private-mount-validation.mjs`;
- the verified coaching pipeline, worker, prompt, student-resolution, roster-verification, and Webex-trigger modules;
- all integrated MMC validators;
- the two preserved MMC migration files and their static validation/rollback authorities;
- the final file authority matrix, conflict report, selective-integration report, and validation report in this directory;
- the 407F CAM v2.0 authority and its Matrix/CAM translation report above.

The final hashes and dispositions for these paths are in `A1_MMC_FILE_AUTHORITY_MATRIX.md`; validation outcomes are in `A1_MMC_VALIDATION_REPORT.md`.

## Requested Fable Deliverables

Produce:

- Product Constitution;
- CAM v2.0 UX Constitution;
- Mentor Experience Constitution;
- Student Experience Constitution;
- Information Architecture;
- Interaction Architecture;
- screen hierarchy and state maps;
- responsive behavior;
- AI trust and evidence patterns;
- progressive disclosure;
- relationship and longitudinal-intelligence design;
- 2035 vision;
- Codex-ready implementation tickets;
- regression-prevention manual.

Every proposal must state which current problem it solves, which canonical files/contracts it touches, how it preserves the non-negotiables, and what deterministic validator proves the change.
