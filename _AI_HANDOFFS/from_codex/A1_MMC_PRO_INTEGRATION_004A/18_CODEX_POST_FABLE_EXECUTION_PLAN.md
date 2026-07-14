# 18 Codex Post-Fable Execution Plan

RESULT: `POST_FABLE_IMPLEMENTATION_SEQUENCE_READY`

## Entry gate

Do not begin implementation from a verbal redesign summary. The next Codex run must receive the accepted Fable package, decision records, exact screen/state maps, protected-system constraints, and ticket acceptance criteria. It must start from:

- worktree `/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-004` or a fresh branch from its final pushed SHA;
- branch authority established by report 19;
- the current 31-screen commit-safe evidence set;
- reports 08, 10–17;
- current MissionMed OS boot/passport/authority routing.

Production deployment, schema application, live credentials, Webex media movement, and shared-system mutation remain outside implied authority.

## Execution principles

1. Implement reversible vertical slices, not a whole-app rewrite.
2. Preserve current route/auth/CSRF/RLS/assignment contracts unless an explicit decision record authorizes a scoped change.
3. Keep `missionmed-hq/server.mjs` a protected shared boundary; avoid broad replacement.
4. Separate product/UI redesign from staging-data activation and from deployment.
5. Add deterministic validators before or with each behavioral change.
6. Preserve the current implementation/screenshots as comparison evidence until the new acceptance suite passes.
7. Never use fixture data to claim live identity, persistence, AI, or student publication.

## Phase 0 — accepted architecture lock

### Deliverables

- Product, mentor, student-visibility, CAM v2.0, trust/evidence, and accessibility constitutions.
- Decision record for HQ-mounted versus standalone production topology.
- Canonical object/state ownership map.
- Protected systems and forbidden mutations list.
- Ticket graph with dependencies, acceptance evidence, and rollback.

### Gate

No implementation ticket proceeds while topology, object ownership, or student-visibility authority is contradictory.

## Phase 1 — test and mode foundation

### Work

- Make CI explicitly run every deterministic MMC validator.
- Replace placeholder/no-input quality labels with real build/type/test inputs or clearly separate JavaScript syntax/contracts from TypeScript projects.
- Add a single environment/mode model: fixture, local, staging, live.
- Add source, persistence, freshness, deterministic/AI, review, sensitivity, and publication state primitives.
- Add deterministic fixture generators for empty, large, stale, failed, partial, conflict, and retry states.

### Acceptance

- Existing validators remain green.
- CI cannot report meaningful MMC success while discovering zero tests.
- Every screen visibly and programmatically exposes its environment and data authority.
- No external request is introduced by fixture/local tests.

## Phase 2 — responsive semantic shell

### Work

- Replace pointer-only navigation/filter `div` elements with semantic controls.
- Add `<main>`, heading hierarchy, programmatic field labels, focus management, announcements, and reduced-motion support.
- Implement desktop rail, laptop/tablet adaptation, and a true mobile bottom rail/drawer.
- Establish CAM v2.0 tokens, typography, spacing, semantic colors, inspectors, density, and state components.

### Acceptance

- No horizontal overflow at 1440, 1280, 1024, 768, 390, and 320 widths.
- Keyboard-only navigation reaches all primary surfaces and returns focus correctly from overlays.
- Automated accessibility checks plus manual screen-reader/zoom/contrast/touch review pass agreed thresholds.
- Auth, routes, Pipeline Admin, and existing data behavior remain unchanged.

## Phase 3 — canonical mentor operating loop

### Work

- Define canonical Student, Task, Promise, Goal, Open Loop, Session, Artifact, Evidence, and Recommendation view models.
- Recompose Today into a one-minute attention and next-call surface.
- Recompose Profile/Call Prep into a single progressive briefing with evidence drill-down.
- Recompose Session Command for low-friction live capture.
- Recompose Post-Session into explicit summary/action/private/student-publication review.
- Make Goals, Timeline, Open Loops, and Tasks stable views or inspectors rather than duplicated card fragments.

### Acceptance

- Selection continuity remains correct across every surface and deep link.
- One object has one authoritative state; repeated presentations cannot diverge.
- Empty/loading/stale/error/permission states are distinct and actionable.
- Long names, transcripts, tasks, repeated meetings, and large queues remain usable.

## Phase 4 — trust and evidence layer

### Work

- Build an evidence inspector that shows source type/location, quote/pointer, confidence, freshness, prompt/model/run, deterministic/AI label, reviewer, and approval history.
- Explain risk, readiness, and next-best-move reasons compactly.
- Add stale, superseded, corrected, disputed, and revoked states.
- Add mentor-memory retention/correction/provenance controls.

### Acceptance

- No consequential recommendation appears without source/reason/review state.
- AI output and deterministic calculation are visually and semantically distinct.
- Sensitive and mentor-only objects are unmistakable and denied to student projections by default.

## Phase 5 — pipeline and review workspace

### Work

- Separate the current long Pipeline Admin into queue, item detail, evidence, identity, analysis, and approval stages.
- Represent the complete lifecycle from discovery to student publication.
- Add batch-safe queue aging, retry, duplicate/idempotency, partial-pair, missing-transcript, parse-failure, provider-failure, and persistence-failure states.
- Preserve explicit admin actions and audit events.

### Acceptance

- No source asset silently advances past identity or review gates.
- Retry cannot create duplicate source assets or analysis projections.
- Read-only Webex inventory and protected-system boundaries remain explicit.
- Worker tests prove no watcher, registry, R2, Stream, Scheduler, or Calendar mutation.

## Phase 6 — identity and roster experience

### Work

- Give `UNVERIFIED`, `MANUAL_REVIEW`, `PROBABLE`, `CONFLICT`, `VERIFIED`, and admin-approved states distinct UX.
- Show strong anchors, independent source systems, supporting evidence, conflicts, freshness, and confidence.
- Add merge, correction, revocation, and assignment-expiration flows inside MMC-owned data only.
- Preserve fixture blocking and two-strong-source automatic promotion.

### Acceptance

- Name, email, filename, Calendar title, or Webex title alone can never verify a person.
- Conflict cannot be bypassed by a normal approval action.
- All identity changes are auditable and reversible.
- Cross-student and inactive-assignment isolation tests pass.

## Phase 7 — real student projection

### Work

- Replace the static Student View fixture with an authorized selected-student projection from canonical MMC objects.
- Define object-level draft, approved, published, corrected, withdrawn, and expired states.
- Add mentor preview and exact diff before publication.
- Keep private notes, sensitive memory, internal risk reasoning, unresolved identity, and unapproved AI excluded.

### Acceptance

- Cross-student isolation and mentor-only denial are tested at server/RLS/browser layers.
- Student-visible objects always record approver, time, version, and source.
- Withdrawal/correction is explicit and auditable.
- No fixture content appears in live/staging student projection.

## Phase 8 — Webex/path compatibility and media hardening

### Work

- Inventory both `MissionWebexVidoes` and `MissionWebexVideos` read-only.
- Introduce one canonical configuration name while retaining legacy read compatibility.
- Add tests for both paths, collision, duplicate pair, partial write, and recovery.
- Define source media retention and derived-object retention separately.

### Acceptance

- No file is moved, overwritten, or deleted by normalization.
- No watcher is started and `video_registry.json` remains untouched.
- Webex source operations remain `GET` only; browser responses remain redacted.

## Phase 9 — authorized staging proof

This is a separate prompt with explicit non-production credentials and mutation authority.

### Work

- Verify target project/ref and rollback before migration.
- Apply migrations only to the authorized staging project.
- Run RLS matrix for administrator, assigned mentor, unassigned mentor, student projection, expired assignment, and anonymous access.
- Exercise one synthetic/non-sensitive media pair through import, identity review, analysis, persistence, briefing, and publication preview.
- Exercise prompt activation and rollback.

### Acceptance

- All 15 tables force RLS and deny unauthorized access.
- No production project, external system, or real student is used.
- Rollback and audit evidence are complete.
- Every write is scoped, reviewable, and cleanup-safe.

## Phase 10 — release candidate and deployment decision

This phase requires a new explicit deployment prompt.

### Gates

- accepted product/UX review;
- full deterministic, browser, accessibility, responsive, auth, CSRF, RLS, identity, pipeline, and shared-system regression suite;
- threat/privacy review;
- data retention and incident runbook;
- observability/SLO and rollback proof;
- current Matrix/critical-system protected gates under their own authority;
- no secret or unrelated diff;
- explicit production project/branch/deploy approval.

No earlier phase implies deployment authority.

## Proposed ticket order

| Order | Ticket theme | Main paths | Proof |
| ---: | --- | --- | --- |
| 1 | CI/validator truth | package/CI/test runners | substantive tests execute |
| 2 | Mode/trust primitives | private client/ownership | fixture/local/staging/live explicit |
| 3 | Semantic responsive shell | private HTML/CSS/app | viewport and accessibility suite |
| 4 | Canonical view models | ownership/app | no cross-screen divergence |
| 5 | Today/Call Prep | private app/CSS | one-minute mentor brief |
| 6 | Session/Post-Session | private app/ownership | capture/review continuity |
| 7 | Evidence inspector | app/pipeline schemas | provenance/trust acceptance |
| 8 | Pipeline/review workspace | app/pipeline/worker | lifecycle and failure tests |
| 9 | Identity correction/revocation | resolver/roster/pipeline | conflict/isolation tests |
| 10 | Student projection | server/RLS/app | role/cross-student denial proof |
| 11 | Webex path compatibility | Webex/worker/tests | no-move/no-delete proof |
| 12 | Staging proof | migrations/snippets/smokes | authorized RLS E2E |
| 13 | Release hardening | full stack | release gate package |

## Required regression set after every phase

- syntax checks for server, route, libraries, and private client;
- every deterministic `missionmed-hq/tests/mmc-*` validator;
- `mmc-v1-core` parity;
- selected-student continuity;
- auth/forbidden/CSRF route behavior;
- shared `VALIDATION/validate_deploy.sh`;
- Critical Systems gate;
- zero Matrix/Scheduler/Calendar/Daily/registry/R2/Stream/File Vault paths in diff unless separately authorized;
- secret/high-risk token scan;
- responsive/browser/console/accessibility checks proportional to changed surfaces;
- `git diff --check` and deliberate scope review.

## Rollback discipline

Each phase must be independently revertible and preserve the prior canonical screenshots or fixtures for comparison. Database work requires a verified rollback transaction and target identity. Media compatibility work must never use destructive cleanup. Identity/publication changes require revocation/correction paths before activation.

## Final instruction to the next Codex run

Implement the accepted Fable architecture faithfully, but keep architecture, staging activation, and deployment as separate authority gates. The successful outcome is a clearer, safer, responsive mentor operating system—not a broad server rewrite, a premature live-data claim, or a deployment hidden inside design work.
