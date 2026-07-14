# 17 Fable 5 CAM v2.0 Input Package

RESULT: `FABLE_CAN_DESIGN_FROM_CURRENT_PRODUCT_REALITY`

## North star

Design a mentor command center that enables Dr Brian to understand every student quickly, prepare for every call, remember every commitment, identify risk early, recommend the next best move, turn meeting recordings into durable intelligence, and measurably improve each student's residency-match progress.

The product has two inseparable beneficiaries:

- **Dr Brian, mentor/operator:** clarity, continuity, prioritization, trustworthy intelligence, and low-friction follow-through.
- **The student:** better guidance, accountable next steps, safer continuity, and a strictly limited projection of approved information.

MMC is not a generic CRM, an autonomous advising agent, a transcript viewer, or a place where weak identity evidence becomes fact. Fable should redesign the current operating system without weakening its evidence, authorization, review, privacy, or protected-system boundaries.

## 1. Current product overview

The current private product is an HQ-mounted, fixture-safe single-page mentor console at `/mmc-private/`. It includes Today, Actions, Directory, Profile, Meeting Intelligence, Mentor Memory/Call Prep, Session Command, Post-Session Capture, Student View Preview, Quick Capture, Pipeline Admin, student-resolution review, roster verification, Webex trigger controls, and local private-alpha status.

The branch also preserves:

- `mmc-v1-core/` as the standalone MMC-005A behavioral oracle;
- a synthetic 11-screen partner demo at `/mmc-partner-demo/`;
- two unapplied MMC schema/RLS migrations;
- a dedicated media/transcript import worker;
- deterministic identity and roster lanes;
- versioned evidence-bound meeting analysis;
- 31 commit-safe current screenshots;
- the complete Prompt 004A engineering record.

It is a canonical engineering baseline, not a production-ready release. Local fixtures, disabled persistence, unapplied migrations, static Student View content, mobile overflow, and unproved live identity envelopes are visible current reality.

## 2. Current architecture

```text
Authorized mentor browser
  -> HQ session + private MMC role/capability gate
  -> /mmc-private/ static client
  -> same-origin APIs
       -> /api/mmc/persistence
            -> allowed non-production project + short-lived RLS principal
            -> forced-RLS mmc.* ownership schema
       -> /api/mmc/coaching-pipeline/*
            -> source inventory / dedicated worker
            -> Webex read-only discovery and gated local staging
            -> deterministic identity and roster review
            -> prompt versions and structured analysis
            -> MMC-owned reviewed projections

Protected external sources remain read-only or unconnected:
WordPress, LearnDash, Matrix, Scheduler, Calendar, CRM, Webex, R2, Stream, File Vault.
```

Current engineering topology is HQ-mounted. A historical standalone architecture remains useful as a constraint and rejected-alternative record, but neither topology is authorized for production until a separate decision record chooses one.

## 3. Current runtime and routes

Runtime owner: `missionmed-hq/server.mjs`. Prompt 004A does not edit it.

Primary routes:

- `GET /mmc-private/` and authorized static assets;
- `/api/mmc/persistence` for assigned MMC-owned state;
- `/api/mmc/coaching-pipeline/status` and `/inventory`;
- worker status, scan, import, and process routes;
- Webex status, recordings, and pull routes;
- source-asset inventory/import;
- student-resolution queue, resolve, and approve;
- roster-verification sources, resolve, and approve;
- prompt inventory, create, activate, rollback, and test;
- analysis-run create, attach, mock-analyze, and analyze.

All mutation routes remain behind HQ authentication, MMC-private authorization, admin gates where required, CSRF, enabled persistence, allowed-project validation, and RLS-scoped ownership.

## 4. Current data and state ownership

MMC owns 15 forced-RLS tables when the preserved migrations are explicitly applied in an authorized environment:

- identity: `identity_references`, `mentors`, `mentor_assignments`;
- sessions: `coaching_sessions`, `session_artifacts`;
- coaching continuity: `mentor_memory`, `private_notes`, `action_items`, `goals`, `open_loops`;
- derived/audit: `intelligence_snapshots`, `audit_events`;
- analysis pipeline: `ai_prompt_versions`, `coaching_source_assets`, `coaching_analysis_runs`.

External systems retain source ownership. MMC stores verified references, immutable provenance, reviewed assignments, and MMC-owned coaching objects; it does not overwrite WordPress, LearnDash, Matrix, Scheduler, Calendar, CRM, Webex, R2, Stream, or File Vault.

Browser fixture state is not canonical truth. Display preferences may be local, but durable coaching state is intended to hydrate/sync only through the same-origin MMC persistence contract.

## 5. Current screen inventory

| Surface | Current job | Important reality |
| --- | --- | --- |
| Today | Prioritize students and next calls | Dense but useful operating rollup |
| Actions | Track promises, reviews, tasks, decisions | Ownership and due state exist |
| Directory | Rank attention and select a student | Selection now propagates correctly |
| Profile | Read longitudinal student context | Goals/timeline/messages/files are embedded panels |
| Meeting Intelligence | Review sessions, media pointers, analysis | Also contains the long Pipeline Admin lifecycle |
| Mentor Memory / Call Prep | Recall relationship context, promises, next move | Selection/data/active-chip continuity repaired |
| Session Command | Capture notes and objects during a call | Opening note now follows selected student |
| Post-Session | Review summary/actions/visibility | Still fixture/local, not live publication proof |
| Student View Preview | Show approved student-facing concepts | Static default-student fixture; P0 redesign debt |
| Pipeline Admin | Scan/import/resolve/verify/analyze | Safe gates visible; hierarchy too dense |
| Partner demo | Explain product breadth to partners | Synthetic, static, desktop/laptop only |

Report 11 is the exact screen and screenshot index.

## 6. Current workflow inventory

### Mentor operating loop

1. Triage Today and attention-ranked Directory.
2. Open Profile and inspect goals, risk/readiness, tasks, promises, and timeline.
3. Enter Call Prep and identify the next best move plus relationship context.
4. Start Session Command and capture notes/actions/promises without breaking presence.
5. End the session and review summary, ownership, deadlines, private notes, and student visibility.
6. Review source/session intelligence and unresolved identity in Meeting Intelligence/Pipeline Admin.
7. Carry approved memory and open loops into the next call.

### Media/intelligence loop

`discovered -> trigger-allowed -> downloaded -> stable pair -> imported -> identity review -> roster verification -> attached -> analyzed -> human reviewed -> MMC persisted -> student approved`

### Student loop

The future student sees only explicit approved projections of their tasks, goals, deadlines, selected summaries, and files. Mentor-only notes, sensitive context, internal risk reasoning, unresolved identity, source credentials, and unapproved AI never cross that boundary.

## 7. Current intelligence engines

Deterministic MMC-owned engines exist for:

- student briefing;
- attention/risk/readiness summaries;
- goals and milestone state;
- tasks and owner/due state;
- mentor/student promises;
- open-loop detection;
- advice history and repeated guidance;
- relationship/personal context;
- longitudinal timeline;
- next-best coaching move;
- memory search and call preparation.

AI meeting analysis is separate. It requires structured summary, actions, risks, readiness, relationship signals, timeline events, next move, overall confidence, and evidence items containing quote, location, relevance, and confidence. Prompt, model, run, source, confidence, review, and evidence provenance are recordable.

## 8. Current Webex and media pipeline

The Webex foundation supports read-only inventory/detail/download through `GET`, explicit title triggers, `[MM-IGNORE]` precedence, redacted browser responses, and a disabled-until-approved pull gate. Default allowed trigger is `[MM-ADV]`; recognized group/mock/personal-statement codes require scoped allow configuration.

The dedicated worker accepts stable video plus text/VTT transcript pairs, hashes both, creates an idempotency key, records provenance, and routes incomplete or ambiguous pairs to review. It does not reuse or start the Daily Drills watcher, write `video_registry.json`, upload to R2/Stream, or mutate Scheduler/Calendar/Webex.

Known debt: `MissionWebexVidoes` versus `MissionWebexVideos` compatibility must be normalized without moving/deleting media or breaking legacy discovery.

## 9. Current identity and confidence system

Resolution states are `VERIFIED`, `PROBABLE`, `MANUAL_REVIEW`, `CONFLICT`, and `UNVERIFIED`. Overall, student, and roster automatic verification require strong evidence and a threshold of at least 0.86. A fixture identity is never production-promoted. Names, email, filenames, Calendar titles, and Webex titles are supporting evidence only.

Roster auto-promotion additionally requires at least two independent strong source systems. Admin promotion still requires a strong anchor and cannot bypass conflict or fixture blocking. Identity approval writes only MMC-owned references/assignments and never writes back to source systems.

## 10. Current security model

Non-negotiable controls:

- HQ authentication and route-specific MMC operator authorization;
- no-index private route;
- authenticated API guard and CSRF for mutations;
- persistence disabled by default;
- explicit non-production project allowlist and production-project refusal;
- anon key plus short-lived RLS principal, never service-role browser use;
- forced RLS on all 15 preserved schema tables;
- active mentor assignment scoping;
- admin gates for source, identity, prompt, analysis, and Webex operations;
- evidence, provenance, confidence, human review, and audit events;
- mentor-only/sensitive/student-approved separation.

## 11. Current screenshots

The commit-ready evidence directory contains 31 checksum-listed screenshot artifacts plus `README.md` and `SHA256SUMS`. Capture tooling assigned `.png` filenames while producing JPEG/JFIF bytes; hashes cover the exact preserved bytes:

- private major screens and current workflow (`01`–`13`);
- desktop, laptop, tablet, and mobile measurements (`14`–`17`);
- populated and empty meeting states (`18`–`19`);
- every partner-demo screen (`20_partner_01`–`20_partner_11`);
- partner mobile debt (`21`);
- independent macOS Computer Use/Chrome confirmation was completed locally, but its full-window capture was excluded from the public repository because unrelated signed-in browser chrome was outside MMC evidence scope.

Fable should read report 11 and view the screenshots before proposing hierarchy or navigation.

## 12. Current UX debt

- Dense repeated card systems obscure the pre-call/live/post-call spine.
- Pipeline Admin collapses too many lifecycle stages into one long surface.
- Private mobile content overflows; partner demo has a 980px minimum width.
- Most form controls lack programmatic labels; some navigation uses clickable `div` elements.
- Empty/loading/error/retry/permission states lack one coherent visual language.
- Evidence, confidence, deterministic-versus-AI, review, and freshness are not visible enough.
- Goals, Timeline, Open Loops, and review queues lack a settled navigation role.
- Type is often too small/muted for an operational console.

## 13. Current product debt

- Student View is a static fixture, not a selected, authorized, object-level projection.
- Fixture/local/staging/live authority can be ambiguous.
- No real end-to-end meeting-to-reviewed-intelligence proof was performed in this run.
- No outcome measurement yet connects MMC usage to preparation, follow-through, or match progress.
- Partner-demo product lifecycle is undecided.

## 14. Current technical debt

- Root `test` discovers zero tests, `build` is a placeholder, and `typecheck` has no project input.
- Production topology (standalone versus HQ-mounted) requires an explicit decision.
- Migrations are unapplied and credentialed staging proof remains future work.
- Webex drop-zone spelling diverges.
- Scale, retry, timeout, deduplication, merge/revocation, and partial-analysis cases need deterministic fixtures/tests.
- Static document lineage comments lag the guarded same-origin implementation.

## 15. Current integration debt

- Approved least-privilege read envelopes for WordPress, LearnDash, Matrix, Scheduler, CRM, Calendar, and Webex are not proven end-to-end.
- Roster evidence source precedence needs operational ownership and freshness rules.
- Student publication needs explicit approval, version, withdrawal, and cross-student isolation contracts.
- Media source retention and deletion policy must be separated from MMC derived-object retention.

## 16. Current operational debt

- No queue aging, retry SLO, failure ownership, incident playbook, or audit-review cadence.
- No production readiness dashboard or mode banner standard.
- No prompt/model rollback exercise against staged data.
- No defined review workload, escalation, or stale-evidence policy.
- No accessibility certification, browser matrix, or responsive device acceptance suite.

## 17. Protected systems

Do not redesign around access that MMC does not own. Preserve strict no-touch/no-write boundaries for:

- shared `missionmed-hq/server.mjs` security and other application routes;
- Matrix locked runtime;
- Scheduler and Calendar;
- WordPress and LearnDash;
- Webex account/recording configuration;
- Daily Drills watcher, ingestion, and `video_registry.json`;
- R2, Cloudflare Stream, File Vault;
- Arena, STAT, StoryForge, ACTN, email, payments, and unrelated HQ consumers;
- production Supabase, Railway, deployment manifests, credentials, and environment values.

## 18. Rejected architectures and approaches

- Whole old-laptop repository or server replacement.
- Wholesale `origin/main` merge to erase divergence.
- Treating a historical standalone prototype as current runtime authority.
- Treating the HQ-mounted candidate as production-authorized without a topology decision.
- Reusing Daily Drills ingestion for coaching recordings.
- Name/email/title-only identity resolution.
- Autonomous AI publication or student visibility.
- Service-role credentials in browser/runtime code.
- Raw historical-report publication into a public repository.
- Moving/deleting media to fix a path spelling conflict.

## 19. Known mistakes and lessons

- A report named “complete combined” may still be only an executive rollup; verify literal contents.
- Hash counts depend on raw tar headers versus logical members; record both models.
- Timestamps and labels like `CURRENT` or `AUTHORITATIVE` are not sufficient authority.
- A safe migration uses semantic integration and validators, not broad merges.
- Browser reality checks find state errors static validators miss: selected Profile, Meeting, briefing, active chip, and Session note must agree.
- A successful route/render is not proof of persistence, identity, AI, or production connectivity.
- Historical evidence can be preserved by exact hashes without increasing public privacy exposure.
- Protected-runtime warnings should cause no-touch containment, not opportunistic repair.

## 20. CAM v2.0 adoption requirements

Apply CAM v2.0 as a product system, not a cosmetic reskin:

- persistent mentor operating rail/HUD with a true mobile bottom rail;
- clear hierarchy between urgent next action, longitudinal context, and evidence;
- progressive disclosure and right-side inspectors for evidence/review;
- compact but readable 12–14px operational panels, tested at 200% zoom;
- restrained semantic color, not arbitrary colored chrome;
- clear mode/environment badges and source/freshness indicators;
- visible deterministic, AI, unreviewed, reviewed, sensitive, and student-approved states;
- short purposeful motion with reduced-motion support;
- role-scoped mentor and student projections from canonical objects;
- keyboard, landmark, labeling, focus, contrast, touch, and screen-reader acceptance.

## 21. Product opportunities

- A single “prepare this call” brief that explains why this student needs attention now.
- A live session workspace optimized for presence, not data entry.
- Automatic but reviewable carry-forward of promises and open loops.
- Evidence-linked “what changed since last call.”
- A risk/readiness explanation that shows reasons, freshness, and confidence.
- A dedicated review inbox for identity, media, analysis, and student publication.
- Student-visible accountability without leaking mentor-only reasoning.
- Outcome instrumentation for call-prep time, promise closure, student response, milestone progress, and match readiness.
- A partner narrative that demonstrates value without pretending synthetic data is live.

## 22. Expert-board evaluation rubric

Score each proposed architecture 0–5 in every category. Any security/privacy score below 4 or any protected-system violation is an automatic rejection.

| Category | Passing question |
| --- | --- |
| Mentor utility | Can Dr Brian know who needs attention, why, and what to do next in under one minute? |
| Student benefit | Does the design improve accountable guidance without exposing private mentor data? |
| Operating-loop coherence | Is pre-call -> live-call -> post-call -> follow-through obvious? |
| Information architecture | Are canonical objects and ownership clear, without repeated conflicting cards? |
| Trust/evidence | Are source, confidence, freshness, deterministic/AI, model/prompt, and review state visible? |
| Identity safety | Can ambiguity, conflict, fixture state, and approval never masquerade as verified identity? |
| Privacy/security | Are auth, CSRF, RLS, assignment, sensitivity, and publication boundaries preserved? |
| Integration safety | Does the design avoid writes/coupling to protected systems? |
| Accessibility | Is keyboard, screen reader, focus, contrast, zoom, touch, and reduced motion designed in? |
| Responsiveness | Is desktop depth preserved while tablet/mobile remain genuinely usable? |
| Operational resilience | Are empty, stale, partial, error, retry, duplicate, and rollback states first class? |
| Implementability | Can Codex deliver it in reversible, testable slices without server replacement? |
| Outcome measurement | Can the product demonstrate improved preparation, follow-through, and student progress? |

## 23. Full file-read priority list

### Priority 0 — current truth

1. `17_FABLE_CAM_V2_INPUT_PACKAGE.md`
2. `11_CURRENT_PRODUCT_SCREEN_INVENTORY.md`
3. `12_CURRENT_UX_AND_PRODUCT_DEBT.md`
4. `13_CURRENT_ARCHITECTURE_AND_RUNTIME.md`
5. `08_PROTECTED_ECOSYSTEM_MAP.md`
6. `10_VALIDATION_AND_REGRESSION.md`
7. every checksum-listed screenshot artifact in `screenshots/` plus `screenshots/README.md`

### Priority 1 — product implementation

8. `missionmed-hq/public/mmc-private/index.html`
9. `missionmed-hq/public/mmc-private/src/app.js`
10. `missionmed-hq/public/mmc-private/src/styles.css`
11. `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js`
12. `missionmed-hq/public/mmc-private/src/mmc-data-adapters.js`
13. `missionmed-hq/public/mmc-partner-demo/index.html`
14. all six files under `mmc-v1-core/`

### Priority 2 — pipeline, identity, and intelligence

15. `missionmed-hq/routes/mmc-coaching-pipeline.mjs`
16. `missionmed-hq/lib/mmc-coaching-import-worker.mjs`
17. `missionmed-hq/lib/mmc-student-resolution-engine.mjs`
18. `missionmed-hq/lib/mmc-roster-verification-lane.mjs`
19. `missionmed-hq/lib/mmc-webex-triggered-pull.mjs`
20. `missionmed-hq/prompts/mmc-meeting-analysis-default.md`
21. every `missionmed-hq/tests/mmc-*` validator

### Priority 3 — security/data and reconciliation

22. the two `supabase/migrations/*mmc*` files
23. the two `supabase/snippets/*mmc*` files
24. the MMC sections of `missionmed-hq/server.mjs` (do not propose broad replacement)
25. reports `01`–`09` and `14`–`19`
26. Prompt 004 reports under `_AI_HANDOFFS/from_codex/A1_MMC_PRO_INTEGRATION_004/`
27. `historical_macbook_air/README.md` and privacy summary; the raw archive is provenance, not required Fable reading.

## 24. Recommended Fable deliverables

Produce one internally consistent package containing:

1. Product Constitution.
2. Mentor Experience Constitution.
3. Student Benefit/Visibility Constitution.
4. CAM v2.0 visual and interaction constitution.
5. Canonical object and information architecture.
6. Role, permission, sensitivity, and publication state model.
7. Pre-call/live/post-call/follow-through workflow architecture.
8. Pipeline/review queue and inspector architecture.
9. Screen hierarchy, routing, deep links, and state diagrams.
10. Desktop, laptop, tablet, and mobile specifications.
11. AI trust/evidence/confidence presentation system.
12. Identity conflict/verification/revocation UX.
13. Empty/loading/error/offline/retry/partial-data state library.
14. Accessibility acceptance criteria.
15. Operational observability and outcome measurement plan.
16. Protected-system and rejected-architecture appendix.
17. Codex-ready implementation tickets with exact files, dependencies, acceptance tests, rollback, and no-deploy boundary.
18. Regression-prevention manual.

Every Fable recommendation must state: current problem, intended user outcome, canonical objects, files/contracts affected, protected invariants, responsive/accessibility behavior, failure states, and deterministic acceptance proof.

## 25. Recommended Codex implementation sequence after Fable

1. Lock the accepted Fable constitutions and decision records.
2. Add mode/source/trust primitives and a canonical object/view-state contract.
3. Build the responsive shell, semantic navigation, accessibility foundation, and state library.
4. Recompose Today and Call Prep around the one-minute mentor brief.
5. Recompose Session Command and Post-Session around low-friction capture/review.
6. Build the dedicated pipeline/review inbox and evidence inspector.
7. Replace static Student View with an authorized object-level projection and isolation tests.
8. Normalize Webex path configuration with compatibility tests and no media movement.
9. Add deterministic scale/error/retry/deduplication/identity-conflict fixtures.
10. Repair CI so explicit MMC validators, real build inputs, and type inputs run.
11. Run separately authorized staging schema/RLS/assignment/pipeline proof.
12. Only after all release gates, prepare a separate deploy decision and production runbook.

## Fable handoff conclusion

Fable should redesign from the current branch and screenshots, not from the old laptop, an old report claiming authority, or the partner demo alone. Preserve the engineering foundation and safety model; transform the product hierarchy, trust presentation, responsive behavior, and role-scoped benefit into a coherent CAM v2.0 mentor command center.
