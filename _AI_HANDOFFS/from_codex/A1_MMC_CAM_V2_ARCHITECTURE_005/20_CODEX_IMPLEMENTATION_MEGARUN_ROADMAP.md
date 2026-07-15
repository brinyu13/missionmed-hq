# 20 Codex Implementation MegaRun Roadmap

RESULT: `FIVE_REMAINING_MEGARUNS_DEFINED`

## Program graph

```mermaid
flowchart LR
  A["005 · Architecture authority"] --> B["006 · Trust/data/worker kernel"]
  B --> C["007 · Mentor CAM experience"]
  C --> D["008 · Student auth/publication/agency"]
  D --> E["009 · Authorized staging RC"]
  E --> F["010 · Production preflight/release"]
```

Each run starts from the pushed SHA of its predecessor in a fresh worktree/branch, uses checkpoint commits and independent rollback, and creates individual plus literal combined handoff. Estimates are planning ranges, not promises or pressure to waive gates. No run force-pushes, silently merges main, or treats later authority as implied.

## MegaRun 006 — MMC Trust, Data, and Worker Kernel

**Prompt name:** `(A1)-MMC-CAM-v2-Codex-MegaRun-006-Trust-Data-Worker-Kernel`.

**Purpose:** close P0 security boundaries and build the canonical command/data/job/identity/evidence foundation locally before UI implementation.

**Dependency/branch:** exact pushed 005 SHA; fresh branch/worktree `a1-mmc-trust-data-worker-kernel-006` or current MissionMed OS-routed equivalent.

**Agents:** Supervisor; Sentinel/Sagan security/truth; Lorentz backend/contracts; Turing concurrency/recovery; Osler policy review. Miyamoto/Vitruvius review API/state implications only.

**006-A security seal (must pass before later phases):** disable/seal unsafe analyze/download/import endpoints; terminate oversized/malformed JSON correctly; exact Supabase/Webex origins; affirmative MMC-only AI/Webex enablement; distinct capabilities; no shared credentials; strict CSP/no-store/output escaping; negative security tests. No CAM UI work begins until this checkpoint is committed and green.

**Implementation phases:**

1. kind-specific v2 schema/migrations (unapplied), composite tenant/environment constraints, forced RLS policies/functions, principal claim contracts;
2. versioned query/command/idempotency, one-transaction canonical mutation + audit/lineage/outbox, consumer inbox;
3. durable jobs with CAS lease-generation fencing, retry/dead-letter/reconciliation and workload identity;
4. encrypted opaque asset broker, acquisition/processing/AI authority gates, streaming/TOCTOU-safe validation, dual legacy path read adapter;
5. attested identity provenance families, assignment/correction/revocation, policy registry, AI proposal/evidence/review services, publication data contracts (not student UI);
6. v1→v2 backfill/shadow/cutover tooling with single-writer/no-dual-write law.

**Exact files/families:** `missionmed-hq/server.mjs` minimal scoped mount; current pipeline/worker/Webex/resolver/roster libraries; new `routes/mmc/` and `lib/mmc/{contracts,authz,commands,queries,jobs,adapters,evidence,identity,policy,publication,observability,persistence}`; additive migrations/snippets; tests.

**Protected boundaries:** no migration apply, provider credentials/calls, production/staging mutation, source move/delete, Daily watcher/registry/R2/Stream, external write, shared auth weakening.

**Validation work:** current MMC/shared/protected-local gates; syntax/API/schema/property/RLS matrices; exact claim and origin negatives; idempotency/transaction readback; asset confinement; AI/evidence/identity/publication contract tests; cutover hash/count/single-writer simulation; backup/restore harness design.

**Browser and visual work:** local-only negative/auth/state fixtures for every touched endpoint; private mount, current client and partner-history route regression at 1280/390; verify `no-store`, safe errors, no path/secret, and no visual/client behavior regression. This run does not perform the CAM redesign.

**Stress work:** 100 concurrent command duplicates; same-key/different-payload conflicts; 1,000 lease races; 10,000 outbox events ×10 duplicates; crash at every transition; 5,000 identity negative pairs; symlink/TOCTOU/size/MIME/redirect races; bounded large transcript/media streams.

**Acceptance:** all P0 contracts in reports 07, 11–13, 16, 22; zero duplicate/stale-worker/wrong-identity/unreviewed promotion; unsafe endpoints remain disabled; migrations unapplied; no protected diff.

**Rollback:** checkpoint reverts; feature gates default off; old writer remains sole writer until an authorized later cutover; no external state changed.

**Staging authority required:** No; staging access/mutation is prohibited. **Production authority required:** No; production access/mutation is prohibited.

**Planning range:** 5–10 focused engineering days. **Stop:** `MMC_V2_TRUST_KERNEL_READY`.

**Expected result report:** `_AI_HANDOFFS/from_codex/A1_MMC_TRUST_DATA_WORKER_KERNEL_006/19_FINAL_TRUST_KERNEL_READINESS.md`.

**Combined handoff:** create all individual reports plus `A1_MMC_TRUST_DATA_WORKER_KERNEL_006_COMPLETE_COMBINED_HANDOFF.md` containing every report literally in logical order.

## MegaRun 007 — Mentor CAM v2 Experience and Operations

**Prompt name:** `(A1)-MMC-CAM-v2-Codex-MegaRun-007-Mentor-Experience`.

**Purpose:** implement the semantic responsive CAM shell, canonical mentor operating loop, evidence/review experience, and Operations UI against deterministic v2 contracts.

**Dependency/branch:** pushed 006 SHA/all security gates; fresh `a1-mmc-cam-mentor-experience-007`.

**Agents:** Miyamoto UI/UX; Vitruvius accessibility; Osler mentor safety; Darwin frontend evolution; Sagan trust rendering; Turing browser/stress; Sentinel regression.

**Prototype gate first:** create a disposable contract-driven prototype of every route anatomy at 1440/1280/1024/768/390/320 and 200% effective width. Test five-second hierarchy, long/RTL content, contrast, screen reader, mentor benchmark, and CAM sibling identity. Repair before runtime composition; prototype never becomes independent authority.

**Implementation:** CAM tokens/shell/routes/command palette/focus; Today three-plus-four attention; Student Overview/Plan/History/Files; Prep Focus; pinned Session; complexity-banded per-item Post-Session Review; Work; Reviews; role-gated Operations; evidence/continuity inspector; complete state library; no-durable-sensitive-offline behavior; accessible media/transcript.

**Exact files/families:** `missionmed-hq/public/mmc-private/index.html`; `public/mmc-private/src/{app.js,styles.css,mmc-data-adapters.js,mmc-ownership-layer.js}` compatibility seams; new `public/mmc-private/src/cam/{shell,routes,components,state,mentor,reviews,operations}/`; scoped v2 query/command UI adapters; `missionmed-hq/tests/mmc-cam/{browser,a11y,visual,usability,state}/`. Partner Demo/core remain preserved evidence only.

**Protected boundaries:** no schema/migration apply, provider call/credential, student route enablement, staging/production mutation, shared auth weakening, Matrix/Daily/registry/R2/Stream/Scheduler/Calendar/Webex write, or Partner-derived UI. Any protected shared mount touch needs a decision record and broad regression.

**Validation work:** all 006/current/shared gates; subject/session continuity; exact query/command readback; state transitions; accessibility automation/manual AT; CAM expert board; mentor task/usability thresholds and protected route/auth/CSRF regression.

**Browser and visual work:** every mentor/Operations route and empty/loading/stale/partial/error/conflict/offline-not-saved/revoked state at 1440/1280/1024/768/390/320 and 200% effective width; orientation, long/RTL content, keyboard/touch/VoiceOver/NVDA/TalkBack, reduced motion/forced colors; screenshot hashes and five-second hierarchy review.

**Stress work:** 1,000 students, 10,000 actions, 500 reviews, 100 sessions/student, 100k transcript, two tabs/session collision, long Unicode/RTL, rapid route/selection/reconnect and virtualized/nonvirtual fallback tests.

**Acceptance:** UI/UX/mentor/accessibility architecture targets earn ≥9 with observed prototype/runtime evidence; no whole-state sync, Partner inheritance, sensitive offline cache, or protected regression.

**Rollback:** checkpoint routes/feature switch preserve prior private client; no DB/provider mutation.

**Staging authority required:** No. **Production authority required:** No. Both environments and live providers remain prohibited.

**Planning range:** 4–8 focused engineering days. **Stop:** `MMC_CAM_MENTOR_READY`.

**Expected result report:** `_AI_HANDOFFS/from_codex/A1_MMC_CAM_MENTOR_EXPERIENCE_007/19_FINAL_MENTOR_CAM_READINESS.md`.

**Combined handoff:** create all individual reports plus `A1_MMC_CAM_MENTOR_EXPERIENCE_007_COMPLETE_COMBINED_HANDOFF.md` containing every report literally in logical order.

## MegaRun 008 — Student Authentication, Publication, and Agency

**Prompt name:** `(A1)-MMC-CAM-v2-Codex-MegaRun-008-Student-Publication-Agency`.

**Purpose:** resolve student principal authority and implement the separate mobile-first student product, authorship, publication, recourse, and isolation locally.

**Dependency/branch:** pushed 007 SHA; approved non-production student-auth contract/policy design (no live account mutation); fresh `a1-mmc-student-publication-agency-008`.

**Agents:** Sentinel RLS/auth/privacy; Osler/student advocate; Miyamoto/Vitruvius student UX; Lorentz serializer/policy; Sagan provenance; Turing isolation/races.

**Implementation:** exact student-principal resolution; distinct JWT scopes; publication serializer/composer/free-text safety; exact-principal readback; student Today/Plan/Tasks/Updates/Files; student-authored goals/preferences/reflections/blockers/attestations/consent choices; acknowledge/agreed/disputed/self-reported/mentor-verified separation; outside-mentor escalation contract; correction/supersession/withdrawal; no-store/no Service Worker; safe uploads/quarantine; notification pointers.

**Exact files/families:** new `missionmed-hq/public/mmc-student/{index.html,src/}`; student-specific v2 query/command adapters; `missionmed-hq/lib/mmc/{authz,publication,contracts,persistence}/`; `missionmed-hq/routes/mmc/` student query/command scopes; unapplied additive student-principal/publication/response RLS migrations/snippets; `missionmed-hq/tests/mmc-cam/{student,publication,rls,browser,a11y,security}/`.

**Protected boundaries:** no live student account, real student data, migration apply, notification send, provider call, staging/production mutation, mentor-private serializer escape, service role/BYPASSRLS, shared auth weakening, or protected-system write. Uploads are synthetic local quarantine fixtures only.

**Validation work:** role×table×CRUD/RPC plus exact claim negatives; structured/free-text leakage; exact-principal preview/payload/readback; withdrawal/tombstone/revocation; authorship/correction/escalation state contracts; full 006/007/current/shared regression.

**Browser and visual work:** student Today/Plan/Tasks/Updates/Files and all state/recovery/privacy routes at 768/390/320 plus desktop sanity; orientation, shared-device/timeout, keyboard/touch/VoiceOver/NVDA/TalkBack, plain language, long/RTL content, screenshot/lock-screen-safe notification fixtures and IMG student research evidence.

**Stress work:** 100 concurrent cross-student attempts and response retries; 1,000 publications/withdrawals; hostile bounded free text/references; revocation during read/write; cache invalidation races; 10,000 tasks/history items; upload size/MIME/quarantine concurrency.

**Acceptance:** zero cross-student/private/unreviewed/unresolved leakage; publication preview/serialized fields/readback identical under policy; student comprehension/agency thresholds; student-auth unknowns resolved before any staging enablement.

**Rollback:** student feature plane off, projection tables isolated, prior mentor product unaffected.

**Staging authority required:** No; only local/test identities. **Production authority required:** No.

**Planning range:** 4–8 focused engineering days. **Stop:** `MMC_STUDENT_PROJECTION_READY_FOR_STAGING`.

**Expected result report:** `_AI_HANDOFFS/from_codex/A1_MMC_STUDENT_PUBLICATION_AGENCY_008/19_FINAL_STUDENT_PROJECTION_READINESS.md`.

**Combined handoff:** create all individual reports plus `A1_MMC_STUDENT_PUBLICATION_AGENCY_008_COMPLETE_COMBINED_HANDOFF.md` containing every report literally in logical order.

## MegaRun 009 — Authorized Staging and Release Candidate

**Prompt name:** `(A1)-MMC-CAM-v2-Codex-MegaRun-009-Staging-Release-Candidate`.

**Purpose:** under a new explicit non-production authority, prove schema/RLS, v1→v2 cutover, dedicated providers, end-to-end synthetic pipeline, recovery, and the release candidate.

**Dependency/branch:** pushed 008 SHA; exact target/ref/credential, Authority Grants, synthetic source, migration/rollback, provider scope/budget, retention, student-test-principal, on-call owners. Fresh `a1-mmc-staging-release-candidate-009`.

**Agents:** Supervisor/release owner; Sentinel security/RLS/privacy; Sagan truth/provenance; Lorentz backend/data/cutover; Turing concurrency/recovery; Miyamoto/Vitruvius browser/visual/accessibility; Osler advising/student safety; operational/on-call reviewer.

**Exact files/families:** immutable 008 source; authorized additive `supabase/migrations/*mmc_cam_v2*` and `supabase/snippets/*mmc_cam_v2*`; scoped gateway/worker deployment manifests/config names; v1→v2 backfill/shadow/cutover/restore tools; MMC staging smoke/load/security/a11y/browser suites; prompt/model policy fixtures; `_AI_HANDOFFS/from_codex/A1_MMC_STAGING_RELEASE_CANDIDATE_009/` evidence/runbooks/screenshots.

**Protected boundaries:** exact named staging tenant/project/services only; no production, real student/media, shared credential fallback, source-system write/delete, Matrix/Daily/registry/R2/Stream/Scheduler/Calendar mutation, main merge, or unrelated deployment. Synthetic content and dedicated budgeted test providers only.

**Implementation work:** target proof/backup; apply only authorized migrations; full RLS/function introspection; backfill/shadow hash/count reconciliation; freeze v1 writer then atomic v2 gate (no dual write); isolated gateway/worker deployment; synthetic source→identity→analysis→evidence→review→canonical→publication→student response; runbooks/alerts/kill switches; prompt/model/schema/deploy rollback; WAL/backup restore and RPO/RTO measurement.

**Validation work:** every prior deterministic/shared/protected gate; applied schema/forced-RLS/function/grant introspection; role/principal matrix; end-to-end exact readback; audit/lineage/outbox/inbox completeness; provider/file/origin/security/privacy/advising review; cutover/rollback/forward-repair and restore proof.

**Browser and visual work:** authenticated mentor, Operations and exact-student journeys for every major route/state at all six widths/zoom/orientation; screenshot hashes; console/network/privacy review; axe plus manual keyboard/VoiceOver/NVDA/TalkBack; task timing/comprehension and independent CAM board.

**Stress work:** full report-22 corpus—100 duplicate commands, 1,000 lease races, 10,000 outbox events ×10, crash every transition, 5,000 identity negatives, cross-student/revocation/withdrawal races, 1,000 students/10,000 actions/500 reviews/100k transcript, provider quota/timeouts, WAL/restore under acknowledged writes.

**Acceptance:** all ≥9 board gates earned; no real student/production; restore reproduces acknowledged commands/audit/publication; SLO baselines/error budgets/runbooks; rollback does not fork truth; complete RC evidence/screenshots.

**Rollback:** atomic v2 gate off only if no post-cutover writes would fork; otherwise coherent v2 recovery/forward repair under runbook; DB/deploy/provider/feature rollback exercised without losing acknowledged writes.

**Staging authority required:** Yes—exact target/ref/credentials/synthetic data/migration/provider/backup/rollback scope. **Production authority required:** No; production remains prohibited.

**Planning range:** 3–7 focused engineering days plus review. **Stop:** `MMC_CAM_V2_RELEASE_CANDIDATE_READY`.

**Expected result report:** `_AI_HANDOFFS/from_codex/A1_MMC_STAGING_RELEASE_CANDIDATE_009/19_FINAL_STAGING_RC_READINESS.md`.

**Combined handoff:** create all individual reports plus `A1_MMC_STAGING_RELEASE_CANDIDATE_009_COMPLETE_COMBINED_HANDOFF.md` containing every report literally in logical order and the complete evidence index.

## MegaRun 010 — Production Preflight, Controlled Release, and Certification

**Prompt name:** `(A1)-MMC-CAM-v2-Codex-MegaRun-010-Production-Release`.

**Purpose:** only after explicit production authority, execute a reversible production release and monitored certification.

**Dependency/branch:** immutable 009 RC SHA; signed consent/acquisition/AI/publication/retention/legal-hold/incident policies; production identities/secrets/backups; change window; owners/on-call; rollback; protected-system approval. Create fresh branch `a1-mmc-cam-v2-production-release-010` and fresh worktree `/Users/brianb/MissionMed_worktrees/A1-MMC-CAM-v2-Production-010` from the exact 009 RC SHA, unless a newer MissionMed OS authority explicitly routes a different recorded path/name; never rewrite history or hide work on main.

**Agents:** Supervisor/release commander; production owner/on-call; Sentinel security/privacy; Sagan truth/audit; Lorentz migration/data; Turing recovery/observability; Miyamoto/Vitruvius browser/visual/accessibility; Osler advising/student-safety approver; independent rollback observer.

**Exact files/families:** immutable 009 RC artifacts; only authorized production migration/deploy/feature-plane manifests and runbooks; backup/restore/cutover tooling already proven in 009; production-safe smoke/monitor queries; `_AI_HANDOFFS/from_codex/A1_MMC_PRODUCTION_RELEASE_010/` preflight, approval, evidence and incident/rollback records. New feature code is prohibited unless separately repaired and returned through staging as a new RC.

**Protected boundaries:** exact named production tenant/project/services and approved change window only; no unrelated code/system, source-system mutation, shared credential fallback, main/history rewrite, destructive load test, real-data export, Matrix/Daily/registry/R2/Stream/Scheduler/Calendar mutation, or release outside owner/on-call/rollback authority.

**Implementation work:** preflight protected systems; target proof/backup; authorized migration/cutover; deploy gateway/worker with all planes off; auth/RLS/synthetic smoke; enable reads → commands → ingest → AI proposals → operational promotion → student publication separately; monitor security/audit/SLO/outcomes/countermetrics; rollback at any breach.

**Validation work:** verify immutable RC/approvals/target three ways; protected/auth/RLS/audit/cutover/backup checks; bounded synthetic canary per feature plane; exact readback and kill-switch/rollback evidence; retention/incident/on-call/observability readiness and monitored certification.

**Browser and visual work:** production browser smoke uses approved test principals and non-sensitive synthetic records only; mentor/student core journeys, responsive/accessibility/console/network checks and screenshot metadata at representative widths, with no unrelated signed-in chrome or real-student capture.

**Stress work:** no destructive production load. Reconfirm immutable 009 stress evidence, run only authority-bounded low-rate synthetic concurrency/canaries, monitor error budgets/queues/resources, and roll back on threshold breach.

**Acceptance:** zero protected regression/isolation/audit/data-loss issue; production runbooks/alerts/retention enforceable; exact release evidence and owner signoff; no score claimed before monitored evidence.

**Rollback:** tested database/deploy/plane-specific rollback or coherent v2 forward repair chosen by cutover invariant; withdrawal/revocation and incident communication ready.

**Staging authority required:** Prior 009 evidence is required; new staging use requires its own current scope. **Production authority required:** Yes—explicit migration/deploy/provider/data/change-window/owner authority.

**Planning range:** controlled change window plus at least 7 days staged monitoring. **Stop:** `MMC_CAM_V2_PRODUCTION_CERTIFIED` or immediate rollback.

**Expected result report:** `_AI_HANDOFFS/from_codex/A1_MMC_PRODUCTION_RELEASE_010/19_FINAL_PRODUCTION_CERTIFICATION.md` (or one exact rollback/blocker report if release aborts).

**Combined handoff:** create all individual reports plus `A1_MMC_PRODUCTION_RELEASE_010_COMPLETE_COMBINED_HANDOFF.md` containing every report literally in logical order, including approvals, observations, rollback/incident evidence and final certification state.

## Why five runs

Five is the maximum requested program size and the smallest safe program that separates backend trust, mentor experience, student authority, staging mutation, and production release. Security sealing occurs before UI, and student authorization is not hidden inside pipeline work. Checkpoint phases keep each long run resumable without manufacturing a swarm of tiny prompts.
