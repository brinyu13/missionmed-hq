# B1-500 — StoryForge V5 Full Complete Combined Codex Handoff

**Generated:** 2026-07-26
**Actual outcome:** `PARTIAL — REVERSIBLE V5 FOUNDATION AND CORE COACHING LOOP IMPLEMENTED AND VERIFIED; PRODUCTION INTEGRATION/RELEASE BLOCKED`

This file contains every Markdown deliverable created by Codex in this run. Each section below is an exact snapshot of the named file at combination time.


---

## Combined source: `AGENTS.md`

# StoryForge V5 Agent Contract

This worktree is scoped to B1-500.

## Product authority

- The only product, UI, UX, visual-design, interaction, navigation, and workflow authority is `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`.
- Its required SHA-256 is `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- Earlier StoryForge prototypes and existing V3 runtime assets may be inspected only to establish infrastructure ownership, locks, and compatibility. They must never determine V5 behavior.
- Preserve the twenty product invariants and the rejected-interpretation corrections in the combined engineering handoff.

## Engineering and safety

- Read the execution prompt, combined handoff, canonical HTML, and applicable `_SYSTEM` contracts before changes.
- Treat StoryForge Matrix JS/CSS/PHP as protected. Run `_SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public` before protected edits. Never use its recovery-only override as deployment authority.
- Do not edit `wp-content/plugins/missionmed-hub` StoryForge assets unless the protected source exists in this exact worktree, its lock verifies, and the ticket has deployment authority.
- Keep StoryForge schema candidates outside root `supabase/migrations` until the exact StoryForge Supabase project and migration-history gate are pinned.
- Never add a client-side service-role key, role toggle, fake AI result, fake audio success, or UI-only authorization.
- Run authorization tests against real PostgreSQL. Private means inaccessible by direct ID as well as absent from lists.
- Use additive migrations, immutable originals/revisions, append-only audit events, transaction-bound notifications, and server-enforced state transitions.
- Do not deploy to staging or production without the founder gates named by the B1-500 authority.

## Records

Keep plans, evidence, work logs, gate packets, and the complete combined handoff under `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/`.


---

## Combined source: `storyforge-v5/README.md`

# StoryForge V5

This is the isolated, reversible B1-500 implementation source. The pinned canonical V5 artifact is the only product authority.

The package is not independently authorized for production deployment. It must be integrated through the verified protected Matrix StoryForge owner after the database, identity, storage, staging, and founder gates are resolved.

## Verification

```sh
npm install
npm test
npm run test:postgres
npm run test:e2e
```

The PostgreSQL and browser suites create temporary databases under `/tmp`. Browser identities are locally signed fixtures, available only on loopback with `STORYFORGE_DEV_AUTH=1`.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/00_STAGE0_DISCOVERY_AND_BASELINE.md`

# B1-500 Stage 0 — Discovery and Baseline

**Recorded:** 2026-07-26 14:56 EDT
**Outcome:** `PARTIAL — DISCOVERY COMPLETE; PRODUCTION INTEGRATION BLOCKED, REVERSIBLE LOCAL IMPLEMENTATION AUTHORIZED`

## Authority verified

- Read in required order:
  1. `STORYFORGE_V5_CODEX_5_6_SOL_EXECUTION_PROMPT.md`
  2. `STORYFORGE_V5_COMPLETE_COMBINED_ENGINEERING_HANDOFF.md`
  3. `storyforge-v5.html`
- Canonical artifact SHA-256 observed in this session:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- The observed hash matches the execution contract.
- No applicable pre-existing `AGENTS.md` was present in the current directory or ancestor chain. A ticket-scoped `AGENTS.md` has therefore been added.
- V5 is the only product authority. V3 paths and hashes below are infrastructure evidence only.

## Repository baseline

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-500`
- Branch: `b1-500-storyforge-v5-production`
- Starting HEAD: `4d1a8f5950668eed35a619f9a17aca7553c8308c`
- Remote: `https://github.com/brinyu13/missionmed-hq.git`
- Starting tracked worktree state: clean.
- Starting untracked input: the founder-provided B1-500 authority directory.
- Root runtime: Node 20+ CommonJS repository with `missionmed-hq/server.mjs` as the active Railway process.
- `app/api/**` is an inactive lookalike for current production and is not an integration target.
- No `.github` workflow and no `.openai/hosting.json` were found.

## Protected Matrix runtime

The mandated Matrix runtime guard was run against the current manifest, production origin, and public assets.

- Production StoryForge JS SHA-256: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`
- Production StoryForge CSS SHA-256: `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`
- Both live hashes matched the current lock manifest.
- Guard result for this worktree: `BLOCKED`.
- Cause: all protected Matrix source paths are absent here, including the StoryForge JS and CSS sources.
- The recovery-only override phrase printed by the guard was not used.

Therefore no protected Matrix file, WordPress loader, production asset, or deployment state may be mutated from this worktree.

## Active infrastructure observed

### Railway

A read-only authenticated Railway status call reported:

- Project: `missionmed-hq-fix005`
- Project ID: `29afe885-b9b1-425d-8fd8-8611cd275409`
- Environment: `production`
- Environment ID: `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`
- Service: `missionmed-hq`
- Service ID: `3d18b017-4fc9-4b22-b097-ba879816d374`
- Reported state: `online`
- Reported deployment ID: `adbc174c-c55d-43b4-863b-ce3e806943d7`
- Public URL: `https://missionmed-hq-production.up.railway.app`

This is resource/deployment status only, not a claim that StoryForge V5 or application health is live.

### Supabase/PostgreSQL

- Supabase CLI: `2.75.0`.
- PostgreSQL client/server tools: `16.13`.
- Docker is installed but its daemon is unavailable.
- No local Supabase stack is running.
- `supabase projects list` could not authenticate because no access token is available.
- No StoryForge project ref is pinned in this worktree.
- The active HQ auth bridge is hard-pinned to Supabase project `fglyvdykwgbuivikqoah`.
- Project `plgndqcplokwiuimwhzh` is explicitly forbidden by that auth bridge.
- Root `supabase/migrations` belongs to the established root data-flow contract and is not safe to repurpose for an unpinned StoryForge project.
- Root migration timestamps were inspected; no duplicate fourteen-digit prefix was observed.

### WordPress identity and eligibility

The active WordPress handoff implementation computes `cam_entitlement` from real LearnDash/WooCommerce state and signs it into the WordPress handoff payload. However:

- `missionmed-hq/server.mjs` normalizes WordPress identity without preserving `cam_entitlement`.
- its Supabase bootstrap writes identity/roles metadata but not StoryForge/360 eligibility;
- learner audiences currently include `arena`, `stat`, `daily`, and `drills`, not `storyforge`;
- generic learner authorization currently requires identity fields, not verified 360 eligibility.

The existing bridge is the correct ownership seam, but it requires an additive, guarded StoryForge audience/claim adapter before it can enforce the B1-500 entitlement chain.

### Object storage

- The repository has an S3-compatible Cloudflare R2 convention and private credentials convention.
- The canonical existing bucket default is `missionmed-videos`; it cannot be assumed to be an approved StoryForge-audio bucket.
- No usable R2 credentials are available in this ticket context.
- No `wrangler` CLI is installed.
- A StoryForge-specific private bucket, lifecycle, CORS, signed-URL rules, and retention policy are not pinned.

### GitHub

- Git remote metadata is readable.
- `gh auth status` reported an invalid token. PR/check mutation or inspection through `gh` is unavailable.

### Mentor assignment source

No verified production mentor-assignment source of truth was found in the active runtime, root migrations, or WordPress implementation. The V5 schema will model many-to-many assignment, but production synchronization is `UNKNOWN` until its owner is named.

### Legacy StoryForge data

No verified production data source or export was found. Older protected source paths exist in historical commits, but they are neither product authority nor evidence of a live data store. Legacy migration remains a founder gate if real data is identified.

## Contradictions that constrain implementation

1. **Standalone recommendation vs. protected Matrix reality.** The handoff recommends a standalone SPA or separately hosted path, while current production ownership is a protected Matrix App Mode route. V5 source can be built independently, but production mounting must use the protected owner and a fresh runtime lock.
2. **JWT entitlement recommendation vs. current auth bridge.** WordPress computes the right entitlement, but the active HQ session/Supabase bootstrap drops it. Client metadata cannot be trusted as a substitute.
3. **Supabase recommendation vs. no project pin.** No StoryForge project, PITR state, migration baseline, or credential is available. Root migrations must not silently become StoryForge migrations.
4. **R2 recommendation vs. storage policy gap.** S3-compatible machinery exists, but the video bucket and deploy scripts are not authority for private StoryForge audio.
5. **Deployment recommendation vs. missing protected source.** Live hashes are known-good, but source recovery is not authorized by this ticket. A local package cannot be represented as deployable until it is integrated into a verified protected source worktree.
6. **Recommended E2E identity vs. missing staging credentials.** Real staging WordPress/Supabase identities are unavailable. Local signed fixture identities may test code paths, but cannot satisfy production SSO completion.

## Stage 0 decision

Proceed through reversible work:

- isolated V5 frontend and API source;
- isolated additive PostgreSQL migration candidate;
- real local PostgreSQL authorization/state tests;
- local browser tests using clearly marked signed fixture identities;
- runbooks, threat model, release and founder-gate packets.

Do not:

- edit protected Matrix assets;
- place migrations in the root project directory;
- change the active shared auth bridge;
- upload to R2;
- deploy Railway, WordPress, Supabase, CDN, staging, or production;
- claim local fixture identity as real SSO.

## Stage 0 acceptance

`PASS` for discovery. `BLOCKED` for production integration until the StoryForge project, protected source owner, auth claim adapter, mentor-assignment owner, storage policy, and credentials are resolved.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/01_LIVING_IMPLEMENTATION_PLAN.md`

# B1-500 Living Implementation Plan

**Status:** active
**Product lock:** StoryForge V5 canonical artifact only

## Stage 0 — Discovery

Status: `COMPLETE / PRODUCTION BOUNDARIES RECORDED`

- Verify authority and artifact hash.
- Identify active runtime, auth, database, storage, deployment, mentor assignment, legacy data, and protected-source reality.
- Record every recommendation/reality contradiction before implementation.

## Stage 1 — Foundation

Status: `COMPLETE AS AN ISOLATED CANDIDATE / NOT APPLIED`

- Create isolated V5 package and environment contract.
- Add additive Postgres schema candidate with RLS, immutable originals/revisions, append-only audit, transaction-bound notifications, many-to-many assignments, questions/workshops/import provenance, and truthful AI/audio flags.
- Implement server-side identity/eligibility enforcement and state transitions.
- Execute a raw authorization matrix and lifecycle proof against real PostgreSQL.

## Stage 2 — Student experience

Status: `PARTIAL — TEXT LIFECYCLE AND RESPONSIVE CLIENT VERIFIED; REAL SSO AND AUDIO BLOCKED`

- V5 navigation and responsive shell.
- Home, Library, Quick Capture/Workspace, Prep, Notifications.
- Private draft, save, submit, revise/resubmit, self-score, uses, question mapping proposals.
- Media capture with truthful unsupported/unavailable behavior if private storage is not configured.
- Browser, accessibility, interruption, and persistence checks.

## Stage 3 — Mentor experience

Status: `PARTIAL — CANONICAL COACHING LOOP VERIFIED; REMAINING ADVANCED SURFACES NOT RELEASE-READY`

- Mentor Home, Students, five-bucket Review Queue, Activity.
- Assigned-student access only.
- Full review, feedback, score, classification, follow-up, approval, attribution.
- Two-mentor canonical coaching loop and notification round trip.

## Stage 4 — Prep and governance

Status: `PARTIAL — MANUAL PREP AND IMPORT FOUNDATION VERIFIED; GOVERNANCE/AI PROMOTION BLOCKED`

- Prep landing, question library, manual next-natural questions.
- Workshop pairs with separate student and mentor strengths.
- Paste/CSV/XLSX preview, provenance, draft-first commit, duplicate flags, and rollback.
- AI endpoint remains server-gated and truthful until provider/DPA/budget gates.

## Stage 5 — Staging and UAT packet

Status: `PACKET PREPARED / EXECUTION BLOCKED`

- Prepare environment, backup/restore, rollback, scale, accessibility, and founder UAT procedures.
- Do not stage without project/source/credential gates.

## Stage 6 — Production release packet

Status: `PACKET PREPARED / FOUNDER GO-LIVE GATE CLOSED`

- Prepare go/no-go checklist and monitored rollback.
- No production action without explicit founder go-live approval.

## Evidence discipline

Every stage record distinguishes:

- `VERIFIED`: observed in this session with a command/test/browser trace.
- `UNKNOWN`: unavailable or unowned.
- `ASSUMPTION`: used only in local test fixtures.
- `BLOCKED`: cannot proceed without authority, credential, safety, or source resolution.
- `DO NOT TOUCH`: protected or concurrently dirty state outside this worktree.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/02_RUNBOOK.md`

# StoryForge V5 Local Verification Runbook

This runbook is for the isolated B1-500 source package. It is not production deployment authority.

## Preconditions

- Run from the repository root.
- Verify the canonical artifact hash:

```sh
sha256sum _AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html
```

- Verify the current branch and worktree:

```sh
git branch --show-current
git status --short
```

- Before any protected integration, run:

```sh
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public
```

A blocked guard means no protected edit or deployment.

## Install isolated dependencies

```sh
npm install --prefix storyforge-v5
```

## Real PostgreSQL suite

```sh
npm run test:postgres --prefix storyforge-v5
```

The script creates an ephemeral PostgreSQL 16 cluster under `/tmp`, applies the candidate migration, executes the authorization matrix and lifecycle checks, and destroys only its own temporary cluster.

## Browser suite

```sh
npm run test:e2e --prefix storyforge-v5
```

The browser suite uses installed Google Chrome, an ephemeral real PostgreSQL cluster, and locally signed fixture identities that are enabled only by `STORYFORGE_DEV_AUTH=1`.

## Local manual browser

```sh
npm run dev:db --prefix storyforge-v5
```

Use the printed loopback URL. Local fixture identity is not production WordPress SSO.

## Production hard stops

Do not apply a migration, mount the app, create a bucket, change shared auth, stage, or deploy until all of the following are pinned:

- StoryForge Supabase project ref and migration history;
- verified protected Matrix source worktree and owner;
- StoryForge auth audience plus server-signed eligibility claim;
- mentor-assignment source and synchronization owner;
- private audio bucket, lifecycle, CORS, signed URL TTL, and retention policy;
- staging credentials and rollback point;
- required founder policy/UAT/go-live approvals.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/03_WORK_LOG.md`

# B1-500 Work Log

## 2026-07-26

- Read the execution prompt, complete combined handoff, canonical V5 artifact, historical handoff, and applicable system contracts.
- Verified the canonical V5 SHA-256.
- Verified branch, HEAD, remote, clean tracked baseline, runtime ownership, migration layout, and tool availability.
- Ran the protected Matrix asset inventory and live-origin/public preflight. Live hashes match the lock; source is absent; guard blocked protected edits.
- Verified the main checkout is concurrently dirty and treated it as `DO NOT TOUCH`.
- Verified read-only Railway resource/deployment status.
- Verified Supabase, GitHub, Docker, PostgreSQL, Node/npm, R2 tooling, and credential boundaries.
- Traced WordPress 360 entitlement generation and the active HQ/Supabase auth bootstrap. Found the entitlement propagation gap.
- Searched for a verified mentor assignment source and legacy StoryForge data source; none found.
- Added the ticket-scoped agent contract and Stage 0 records.

Next: implement and test the isolated reversible source package.

- Added `storyforge-v5/` with a no-client-secret browser client, bearer-auth API, purpose-bound JWT verifier, PostgreSQL adapter, private-R2 signed upload adapter, parser, and fail-closed feature flags.
- Added an additive 1,221-line PostgreSQL migration candidate outside the root Supabase migration directory.
- Added ephemeral PostgreSQL harnesses for foundation, local browser, and E2E verification.
- Initial PostgreSQL startup was blocked by sandbox shared-memory limits; reran the isolated harness with explicit approval.
- Fixed numeric type casts found by the first database run. The final authorization/lifecycle suite passes 29 named assertions.
- Installed isolated dependencies after explicit network approval.
- The first XLSX dependency audit found a high-severity no-fix advisory. Removed it.
- The second parser brought a vulnerable archive dependency tree. Removed it.
- Replaced it with `read-excel-file` plus a direct RFC 4180-style CSV parser; valid XLSX, malformed input, duplicates, near-duplicates, formula-like cells, and limits pass.
- Final full npm advisory audit reports zero vulnerabilities.
- Fixed a volatile-composite expansion error found by the raw API/browser suite. RPCs now execute exactly once through `SELECT * FROM function(...)`.
- Fixed student visibility of attributed mentor names and co-mentor visibility through narrow, security-definer boolean helpers; story privacy did not broaden.
- Final Chrome suite: three tests passed, covering raw API privacy, canonical two-mentor coaching loop, real event notification, immutable original, truthful audio/AI gates, desktop/mobile screenshots, and axe.
- Attempted the separate in-app browser connection after loading its required workflow; discovery reported no available browser. No claims depend on that surface.
- No deployment, migration apply, protected source mutation, bucket creation, shared auth edit, production write, commit, push, or PR was performed.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/04_PROJECT_MEMORY.md`

# StoryForge V5 Project Memory

## Absolute product lock

Only the pinned V5 artifact determines behavior. Older StoryForge source can establish ownership or compatibility, never product behavior.

## Current protected-runtime fact

On 2026-07-26, the production StoryForge JS/CSS matched the current Matrix manifest, but the corresponding protected sources were absent from this worktree. The guard blocked. Do not use its recovery override as normal implementation or deployment authority.

## Current integration seam

The active WordPress handoff already computes signed `cam_entitlement`. The active Railway auth bridge drops that field before its session and Supabase bootstrap. The safe future change is an additive StoryForge audience/claim adapter owned by the shared auth runtime, not client inference and not a second identity system.

## Database boundary

No StoryForge Supabase project is pinned. Root migrations cannot be assumed to target StoryForge. Keep the B1-500 migration candidate isolated until project ref, migration history, PITR/backup state, and credential authority are verified.

## Privacy boundary

Assigned mentors may read only submitted/non-private stories. Unassigned mentors and admins have no private-story read path. No support override exists without a founder policy and explicit audited implementation.

## Truthfulness boundary

Local fixture identities are test infrastructure, not SSO. Missing R2 means recording/upload is unavailable, not simulated. Missing approved AI configuration means a truthful gated state, never canned suggestions.

## Production boundary

Never deploy from this package alone. Production requires verified protected source integration, a new runtime lock, staging evidence, founder UAT, and explicit founder go-live approval.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/05_ARCHITECTURE_ADAPTATION_AND_CONTRADICTIONS.md`

# StoryForge V5 Architecture Adaptation

## Decision

Build V5 as an isolated, deployable source package whose product surfaces follow the canonical artifact, while keeping its infrastructure adapters replaceable. Do not mutate the active shared runtime until the responsible owners and protected sources are available.

## Target topology

```text
WordPress / LearnDash eligibility
  -> existing signed HQ handoff
  -> future StoryForge audience + eligibility adapter
  -> short-lived StoryForge JWT
  -> StoryForge API
  -> PostgreSQL RLS/RPCs
  -> private R2 signed upload/download adapter

Protected Matrix App Mode
  -> mounts built V5 client through verified StoryForge JS/CSS owner
```

## Reversible local topology

```text
loopback-only signed fixture identity
  -> same StoryForge API authorization contract
  -> ephemeral real PostgreSQL 16
  -> V5 browser client
```

The fixture signer cannot start unless `STORYFORGE_DEV_AUTH=1` and the request is loopback. Production identity rejects the fixture path.

## Adaptations

### UI mounting

The V5 client is developed independently for testability. Its production output is intended to be mounted through the existing protected Matrix StoryForge owner after source recovery/verification. It does not replace Matrix navigation or create a competing product path.

### Authentication

The API accepts a purpose-bound StoryForge JWT containing identity, actor role, and verified eligibility. The local signer is test-only. Production issuance belongs in the existing HQ bridge so WordPress remains the identity/eligibility authority.

### Data

The schema is a versioned candidate local to the package. It uses PostgreSQL-native RLS and server-enforced functions so it can be reviewed and tested before a Supabase project is selected. It is not copied into root migrations.

### Audio

The API adapter uses private S3-compatible signed operations only when an approved StoryForge bucket is configured. Otherwise the client must disclose that recording storage is unavailable.

### AI

The client never contains model keys or synthetic answers. The server endpoint remains closed until provider, DPA, budget, flags, prompt/version persistence, PHI minimization, and evaluation gates are supplied.

## Unresolved ownership

- protected Matrix source recovery and integration;
- StoryForge Supabase project;
- production JWT issuer change;
- mentor-assignment synchronization;
- private StoryForge R2 bucket;
- retention/deletion/export/archive policy;
- admin support/private access policy;
- production path;
- staging/UAT and production go-live authority.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/06_STAGE1_FOUNDATION_EVIDENCE.md`

# B1-500 Stage 1 — Foundation Evidence

**Outcome:** `PASS AS ISOLATED CANDIDATE / NOT PRODUCTION-APPLIED`

## Implemented

- Purpose-bound JWT verification with issuer, audience, expiration, signature, UUID subject, actor role, and `storyforge_eligible` enforcement.
- Local signed fixture identities only when explicitly enabled and bound to loopback.
- Real PostgreSQL schema for:
  - users and many-to-many active mentor assignments;
  - stories, immutable originals, durable revisions, feedback, private audio metadata;
  - transaction-bound notifications and append-only audit events;
  - questions, story-question pair strengths, workshops, next-natural questions;
  - import batches/rows and AI provenance records.
- PostgreSQL RLS for student-self, student-other, assigned mentor, unassigned mentor, admin, and anonymous.
- Security-definer state transitions with direct client DML revoked.
- Student create/edit/submit/resubmit, mentor open/review/approve, notification-read, workshop, manual question, import commit/rollback, and audio-metadata RPCs.
- Narrow co-assignment helpers so mentor attribution is visible without broadening story access.

## Real PostgreSQL evidence

Command:

```sh
bash scripts/run-postgres-tests.sh
```

Final result: `STORYFORGE_POSTGRES_SUITE_PASS`.

The suite executed 29 named assertions against an ephemeral PostgreSQL 16 server, including:

- student-self reads private;
- student-other, assigned mentor, unassigned mentor, and admin all receive zero private rows by direct ID;
- anonymous has no table privilege;
- revoked/missing eligibility closes reads and creates;
- authenticated clients have no direct story update privilege;
- immutable original differs from later current text and revisions persist;
- assigned-only visibility after submission;
- unassigned crafted review RPC denied;
- notification and mentor mutation commit together;
- revise/resubmit/approve state sequence;
- two distinct mentor actors and co-mentor display attribution;
- separate student/mentor workshop strengths;
- draft-first import, exact duplicate flag, retire-on-rollback;
- append-only audit and multi-actor history.

## JWT/parser/unit evidence

Command:

```sh
npm test
```

Final result: seven passed, zero failed.

- Valid signed eligible token accepted.
- Expired token rejected.
- Forged signature rejected.
- Missing eligibility and forged service role rejected.
- Paste duplicate/near-duplicate/formula/empty-row checks pass.
- Valid XLSX parsing passes.
- Unsupported format and row limits fail closed.

## Not production-applied

The migration remains in `storyforge-v5/infra/postgres/migrations`, not root `supabase/migrations`, because the StoryForge project ref, migration history, PITR/backup state, and credentials are unresolved.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/07_STAGE2_STUDENT_EVIDENCE.md`

# B1-500 Stage 2 — Student Experience Evidence

**Outcome:** `PARTIAL`

## Verified in headless Google Chrome against real PostgreSQL

- V5-responsive shell with Student Home, Library, Capture, Prep, Notifications, and Workspace.
- Private text capture and durable save.
- Self score rendered as stoplight dots with `Self` label and full aria names.
- Editable private/needs-revision states and read-only submitted states.
- Explicit submit, mentor round trip, notification deep link, revise, resubmit, and final approved view.
- Immutable original remains visible beside current text.
- Desktop and 390-pixel mobile layouts rendered and were captured.
- Core Student Home produced no serious or critical axe violations.
- AI copy is explicitly gated; no generated or canned result is displayed.
- With R2 absent, Record mode says storage is unavailable and its start control is disabled; no capture/upload is claimed.

## Screenshot receipts

- `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-home.png`
  - SHA-256 `4a615cf2d2904b8ee55f5138c0103912b474038224e637a81fa2e4c5d7f48a73`
- `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-student-mobile.png`
  - SHA-256 `a735c6b192a33c583bad9b260af7254078088b234ee81c4ecae530dd995a16f7`

## Release-blocking gaps

- Browser identity is a signed local fixture, not real WordPress staging SSO.
- Private audio signing/verification code exists, but no approved bucket or credentials exist and MediaRecorder/upload recovery is not release-verified.
- Screenshot behavior was visually inspected against the canonical authority, but no approved pixel-diff baseline has been ratified.
- Full canonical student detail powers—story-question proposals, suggestion acceptance/edit history, and every legacy-data path—are not complete.

Stage 2 therefore cannot be labeled production-complete.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/08_STAGE3_MENTOR_EVIDENCE.md`

# B1-500 Stage 3 — Mentor Experience Evidence

**Outcome:** `PARTIAL`

## Verified

- Mentor Home summary and assigned roster.
- State-derived Review Queue with awaiting-review, in-review, waiting-on-student, approved, and all views.
- Opening a submission is a distinct event from review.
- Assigned mentor reads submitted work; unassigned mentor sees zero rows and cannot invoke review by crafted request.
- Full-review core includes real feedback/ask, mentor score, classification, follow-up flag, request-revision, and approval.
- Mentor writes never overwrite student story text.
- Student notification is created in the same database transaction as review.
- Two assigned mentors act in sequence with their own immutable attribution.
- Co-assigned mentors and the student see both mentor names in coaching history.
- Approved work moves to a history state in the UI rather than presenting an immediate extra review form.

## Canonical loop

The Chrome suite completed:

1. student captures privately;
2. student submits;
3. mentor one opens without reviewing;
4. mentor one scores and requests revision with feedback;
5. student receives the real-event notification;
6. student revises;
7. student resubmits;
8. mentor two opens the resubmission;
9. mentor two scores and approves;
10. original, current revision, two mentor actors, and approved history remain visible.

Screenshot:

- `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/evidence/storyforge-v5-approved-workspace.png`
- SHA-256 `a81c74ef9cf49b01865c2688c02b4b6ddf2431a80d08c3151011b7ab7d29df1f`

## Release-blocking gaps

- Real staging mentor accounts and production assignment synchronization are unavailable.
- Teaching Mode, anonymized compare rules, Story Anatomy live actions, 1:1 session workflow, complete custom-range activity, and all canonical roster/cohort controls are not release-complete.
- No founder-approved admin support/private-story access path exists; admins correctly remain unable to read stories.

Stage 3 therefore cannot be labeled production-complete.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/09_STAGE4_PREP_GOVERNANCE_EVIDENCE.md`

# B1-500 Stage 4 — Prep and Governance Evidence

**Outcome:** `PARTIAL`

## Implemented and verified

- Approved institutional question library with provenance and governance state.
- Question Workshop data model with dual questions, preferred question, student why, mentor coaching notes, gaps, and separately stored student/mentor strengths.
- Manual next-natural-question creation for the student or an assigned mentor.
- Paste, CSV, and XLSX parser paths.
- Five-megabyte and 5,000-row limits.
- Exact normalized duplicate detection and near-duplicate token similarity.
- Formula-like cell warning and safe export representation.
- Malformed CSV failure.
- Import review rows with selected/unselected state.
- Commit creates institutional questions as `draft`, never approved.
- Batch rollback retires questions rather than hard-deleting them.
- Import and rollback actions preserve actor/batch provenance.
- AI endpoint is server-only and closed by independent role/mode flags. With flags closed it returns `ai_feature_gated`; it never supplies a fake result.

## Dependency security

- Removed `xlsx` after npm reported a high-severity no-fix advisory.
- Removed `exceljs` after its transitive archive stack produced high-severity advisories.
- Final parser: `read-excel-file` for XLSX plus local data-only CSV parsing.
- Final full `npm audit --audit-level=high`: `found 0 vulnerabilities`.

## Release-blocking gaps

- The browser surface currently exposes paste review; CSV/XLSX server paths are verified by unit tests but file-picker UX is not release-complete.
- Governance approval/retirement review UI and assignment drawer are incomplete.
- Story-question mapping proposals/confirmations are modeled but not wired end to end.
- The founder has not approved an AI provider DPA, budget, model, or promotion gate. Clinical generation remains closed; manual coaching is the only implemented clinical path.

Stage 4 therefore cannot be labeled production-complete.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/10_SECURITY_THREAT_MODEL.md`

# StoryForge V5 Security and Authorization Review

**Review outcome:** `LOCAL CONTROLS PASS / PRODUCTION ASSURANCE BLOCKED`

## Protected assets

- student identity and verified 360 eligibility;
- private story text and immutable original;
- revisions, scores, classifications, question mappings, coaching history;
- private audio objects and metadata;
- mentor assignment graph;
- notifications and append-only audit trail;
- question import provenance;
- AI prompts/outputs and provider credentials.

## Trust boundaries

1. WordPress/LearnDash/WooCommerce eligibility issuer.
2. MissionMed HQ handoff/JWT issuer.
3. Matrix client.
4. StoryForge API.
5. PostgreSQL/RLS.
6. private R2 object store.
7. future AI provider.

Production is blocked because boundaries 2, 5, and 6 do not yet have StoryForge-specific ownership/configuration.

## Threats and implemented mitigations

| Threat | Mitigation and evidence |
|---|---|
| Client role toggle/forged role | No production role switch. Signed `app_role`; forged service role unit test denied. |
| Forged/expired token | JOSE signature, issuer, audience, expiry, UUID subject, and eligibility checks; tests green. |
| Revoked eligibility | Claim and current database profile must both be eligible; false claim closes reads and RPCs. |
| Private story enumeration | RLS returns zero rows by direct ID for all non-owner personas, including assigned mentor and admin. |
| Unassigned mentor access | Assignment is server/RLS enforced; list, direct ID, and crafted review probe denied. |
| Silent mentor edit | Base story DML revoked; mentor RPC never writes student text. |
| Original overwrite | Database trigger makes owner/original/created timestamp immutable; revision test green. |
| Duplicate RPC side effects | API uses `SELECT * FROM function(...)`; avoids volatile composite re-evaluation found during E2E. |
| Fake notification | Review mutation and notification insert occur in one transaction. |
| False mentor attribution | Actor comes from verified subject; two-mentor and co-mentor tests green. |
| Audit tampering | Authenticated update/delete not granted; trigger rejects owner-level update/delete. |
| Public storage/guessable URL | Only private S3-compatible presigned PUT adapter; no bucket means truthful 503. |
| Oversized/malicious import | Size/row caps, data-only parsing, malformed CSV error, formula warning, duplicate review, no embedded rendering. |
| Vulnerable parser | Two unsafe dependency choices removed; final complete npm audit reports zero advisories. |
| Client AI key/fake output | No client key; closed server endpoint; independent flags; unavailable returns an error, never canned data. |
| Error leakage | Unknown server faults return generic 500 copy; known gated/validation states are explicit. |
| Clickjacking/content injection | Same-origin CSP, frame-ancestor allowlist, no inline script/style dependency, nosniff, referrer and permissions policies. |
| Dev identity exposure | Fixture signer requires explicit flag, 24+ character secret, loopback request, and loopback bind. |

## Unresolved production risks

- The active HQ bridge drops the real `cam_entitlement`; production claim issuance is not implemented.
- No StoryForge Supabase project, current migration history, PITR, backup receipt, or credential is available.
- Mentor assignment synchronization has no verified owner.
- No private StoryForge audio bucket, lifecycle, CORS, retention, or malware policy is approved.
- Admin support access and retention/deletion/export/archive policy are founder gates.
- No staging identity/authorization test has run.
- No protected Matrix source integration or new runtime lock exists.

## Security verdict

`PASS` for the isolated authorization design and tested code paths.
`BLOCKED` for production security authorization and deployment.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/11_STAGE5_STAGING_UAT_PACKET.md`

# B1-500 Stage 5 — Staging and Founder UAT Packet

**Status:** `PREPARED / NOT EXECUTED`

## Entry gates

All must be verified before staging:

- protected StoryForge source recovered in a clean, ticket-scoped worktree;
- Matrix preflight green with current origin/public hashes;
- StoryForge Supabase project ref and complete migration history pinned;
- live/staging backup and rollback point created;
- WordPress staging issuer emits a server-signed StoryForge audience and verified eligibility claim;
- mentor assignment staging source contains at least two mentors for the test student;
- private StoryForge audio bucket/policy approved and credentials installed;
- retention/deletion/export/archive founder decision recorded;
- admin private-support-access founder decision recorded;
- production path decision recorded;
- legacy data source decision recorded.

If any entry gate fails, Stage 5 result is `BLOCKED`, never green.

## Staging sequence

1. **VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.**
2. Record current protected manifest, source/origin/public hashes, Railway deployment, Supabase project/ref, migration table, R2 policy, and WordPress issuer version.
3. Apply the reviewed additive migration through the canonical migration protocol.
4. Deploy the API behind default-OFF StoryForge route/feature flags.
5. Mount V5 through the protected Matrix owner and reseal the lock.
6. Seed only approved question-library content if no legacy source exists.
7. Run the 29-assertion Postgres matrix against staging identities and the raw staging API.
8. Run Student, Mentor One, Mentor Two, Unassigned Mentor, Admin, and Anonymous E2E suites.
9. Run audio interruption/resume/upload/download authorization tests if storage is approved.
10. Load-scale with at least 300 stories and 100 students.
11. Run complete axe/keyboard/screen-reader and mobile passes.
12. Run backup restore and application rollback drills.
13. Freeze the staging candidate hash; any change invalidates prior receipts.

## Founder UAT script

### Student persona

- enter from the approved MissionMed path;
- verify eligibility and identity copy;
- capture a private story;
- prove mentor cannot see it;
- save, score, and submit;
- inspect exact status language;
- receive mentor feedback notification;
- open deep link, compare original/current, revise and resubmit;
- inspect final approval and history;
- create a question workshop and manual follow-up;
- inspect truthful AI/audio availability.

### Mentor persona

- inspect Home and assigned roster;
- prove no private draft appears;
- open submitted story without reviewing;
- add score, feedback, classification, follow-up, and request revision;
- use second mentor to re-review and approve;
- verify both mentor names and no silent student-field edit;
- inspect queue buckets, history, Prep, import review, Teaching Mode, and 1:1 paths.

### Admin persona

- inspect assignment and governance surfaces;
- prove private story is unreadable by direct ID;
- import questions into draft review;
- approve/retire through ratified governance;
- exercise any founder-approved support path and inspect its visible audit event—or confirm no path exists.

## UAT founder gate

Stage 5 cannot pass until the founder signs the exact frozen staging candidate after the full student and mentor walkthrough.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/12_STAGE6_PRODUCTION_RELEASE_PACKET.md`

# B1-500 Stage 6 — Production Release Packet

**Status:** `PREPARED / NO PRODUCTION ACTION AUTHORIZED`

## Required approvals

- founder staging UAT approval for the frozen candidate;
- explicit founder production go-live approval;
- retention/deletion/export/archive policy;
- admin support/private-story access policy;
- production URL/path;
- AI remains independently closed unless its own later gate passes;
- optional email remains post-GA unless separately approved;
- legacy migration approval only if Stage 0 follow-up identifies real data.

## Go/no-go checklist

- exact commit, built artifact hash, migration hash, manifest hash, and environment variable names recorded;
- current production source/origin/public hashes green;
- protected-source preflight green;
- database backup/PITR receipt and restore drill green;
- additive migration history clean and target ref exact;
- WordPress eligibility claim verified with eligible, ineligible, revoked, expired, and forged cases;
- assignment sync verified;
- private audio CORS, TTL, object prefix, MIME, size, lifecycle, and cross-user tests green;
- 29-assertion authorization matrix green against production-equivalent staging;
- full Chrome/browser, accessibility, mobile, scale, and canonical loop green;
- no high-severity dependency advisory;
- observability and on-call owner assigned;
- rollback owner and rollback target confirmed.

## Release sequence

1. Announce change window and freeze concurrent writers.
2. Verify live and create fresh rollback receipts.
3. Apply database change through the pinned canonical project.
4. Deploy API with StoryForge route default OFF.
5. Integrate/mount protected V5 source; verify new lock before upload.
6. Enable founder-approved internal accounts only.
7. Run anonymous, student, mentor, unassigned, and admin smoke probes.
8. Enable approved cohort.
9. Observe errors, auth denials, latency, notification integrity, and storage verification.
10. Expand only if the written thresholds remain green.

## Rollback

- Disable the StoryForge route/feature flag first.
- Restore the exact prior protected asset deployment and manifest lock.
- Roll Railway back to the release-time recorded deployment, not the older Stage 0 observation by assumption.
- Leave additive database tables intact during application rollback; destructive data removal requires the retention policy and a separate founder-approved plan.
- Stop new audio signing; retain objects under the approved policy.
- Restore database only from a verified release-time backup when data integrity—not application compatibility—requires it.
- Re-run live origin/public hashes and anonymous/authenticated smoke probes.

## Hard stop

No command in this run deployed, migrated, uploaded, purged, toggled, or rolled back production. The Stage 6 gate remains closed.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/13_FOUNDER_GATE_DECISION_LOG.md`

# B1-500 Founder Gate Decision Log

All entries remain open unless explicitly marked otherwise.

| Gate | Status | Required decision/evidence |
|---|---|---|
| Retention/deletion/export/archive | `OPEN — FOUNDER` | Policy by artifact type, revocation behavior, export scope, and deletion authority. |
| Admin support/private story access | `OPEN — FOUNDER` | No-access policy or exact emergency access workflow with visible audit. Current build has no access. |
| StoryForge Supabase project | `OPEN — INFRA/FOUNDER` | Exact project ref, region, ownership, migration history, PITR, and credentials. |
| Protected Matrix source owner | `OPEN — INFRA` | Clean source worktree, current lock, integration owner, deployment procedure. |
| WordPress StoryForge claim | `OPEN — AUTH OWNER` | Additive audience and signed `cam_entitlement` propagation without a second identity system. |
| Mentor assignment source | `OPEN — PRODUCT/INFRA` | Production source of truth and synchronization contract. |
| Private audio storage | `OPEN — INFRA/FOUNDER` | Dedicated bucket, lifecycle, CORS, TTL, retention, monitoring, and credentials. |
| Production URL/path | `OPEN — FOUNDER` | Exact Matrix route/mount decision. |
| Legacy data migration | `OPEN IF DATA EXISTS` | Name a verified source or explicitly record “no legacy data.” |
| AI provider/DPA/budget | `OPEN — FOUNDER` | Provider, no-training DPA, budget/rate caps, model/prompt versions. AI stays closed. |
| Student general AI | `OPEN — POST-BETA` | Separate promotion after mentor general-suggestion beta. |
| Clinical mentor AI | `OPEN — POST-EVAL` | Eval set, hallucination test, mentor panel, documented pass. |
| Clinical student AI | `OPEN — POST-BETA` | Separate promotion after clinical mentor beta. |
| Optional email | `OPEN — POST-GA` | Founder decision; no email is implemented. |
| Stage 5 UAT | `OPEN — FOUNDER` | Sign frozen staging candidate after full student/mentor walkthrough. |
| Stage 6 go-live | `OPEN — FOUNDER` | Explicit production deploy authorization. |

No founder decision was inferred in this run.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/14_TEST_AND_BROWSER_EVIDENCE.md`

# B1-500 Test and Browser Evidence

**Evidence date:** 2026-07-26
**Final local test outcome:** `PASS`

## Commands and results

| Command | Result |
|---|---|
| `sha256sum .../storyforge-v5.html` | Pinned hash matched. |
| `python3 _SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public` | Live hashes matched; protected source absent; guard blocked edits. |
| `npm test` | 7 passed, 0 failed. |
| `bash scripts/run-postgres-tests.sh` | 29 named assertions passed; `STORYFORGE_POSTGRES_SUITE_PASS`. |
| `bash scripts/run-e2e.sh` | 3 passed, 0 failed in headless Google Chrome. |
| `npm audit --audit-level=high` | 0 vulnerabilities. |
| `node --check` on server/client/test modules | PASS. |
| `git diff --check` | PASS. |

The harmless first curl line in the E2E output is the readiness loop polling before the server binds; the subsequent readiness check and suite passed.

## Chrome coverage

- raw API privacy before and after submission;
- assigned vs. unassigned vs. admin direct-ID behavior;
- truthful closed AI and audio API behavior;
- private capture;
- student self score;
- submit;
- mentor open/review/request-revision;
- student notification/deep link/revise/resubmit;
- second mentor open/review/approve;
- immutable original/current comparison;
- two mentor names;
- desktop and mobile rendering;
- no serious/critical axe issues on Student Home.

## Visual inspection

The captured Student Home, mobile Student Home, and approved Mentor Workspace were opened and visually inspected in this session. The rendered system uses the canonical V5 parchment/wine/coral language, serif hierarchy, rail/mobile navigation, status chips, stoplight score dots, original/current separation, and explicit gated states.

The separate in-app browser discovery returned no browsers, so no result is attributed to that surface. The browser claims above come from the successful installed Google Chrome Playwright run and inspected PNG receipts.

## Scope boundary

This evidence uses ephemeral local PostgreSQL and locally signed fixture identities. It is valid evidence for the source behavior tested; it is not evidence of WordPress staging SSO, Supabase production, R2 production, Matrix integration, or production readiness.


---

## Combined source: `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/15_FINAL_OUTCOME_AND_NEXT_ACTION.md`

# B1-500 Final Outcome and Next Action

## Actual outcome

`PARTIAL — REVERSIBLE V5 FOUNDATION AND CORE COACHING LOOP IMPLEMENTED AND VERIFIED; PRODUCTION INTEGRATION/RELEASE BLOCKED`

## Stages

- Stage 0: complete.
- Stage 1: complete as an isolated, unapplied PostgreSQL/API candidate.
- Stage 2: partial; text lifecycle/responsive browser verified, real SSO/audio incomplete.
- Stage 3: partial; canonical two-mentor coaching loop verified, advanced mentor surfaces incomplete.
- Stage 4: partial; manual prep/import foundation verified, full governance/mapping/AI promotion incomplete.
- Stage 5: packet prepared; staging not entered.
- Stage 6: packet prepared; production gate closed.

## Changed locally

- ticket-scoped `AGENTS.md`;
- all Codex records in the required directory;
- isolated `storyforge-v5/` package:
  - browser client and visual system;
  - JWT/API/database/storage/import adapters;
  - additive PostgreSQL migration candidate and fixtures;
  - unit, PostgreSQL, Playwright, axe, desktop/mobile, and runbook tooling;
  - isolated dependency lockfile.

No protected runtime, root migration, shared auth, Railway resource, Supabase project, WordPress deployment, CDN/R2 object, production data, remote branch, or PR changed.

## Exact next action

The founder/infrastructure owner must name:

1. the exact StoryForge Supabase project ref and migration authority;
2. the clean protected Matrix source worktree/owner;
3. the mentor-assignment source;
4. the private StoryForge audio bucket policy; and
5. the retention/admin-support/production-path decisions.

Then the auth owner should implement and review the additive StoryForge audience that carries the already-computed signed `cam_entitlement`. After those inputs exist, resume at the Stage 5 entry checklist—first verifying and backing up live state and creating a proven rollback point.

## Branch and commit

- Branch: `b1-500-storyforge-v5-production`
- HEAD: `4d1a8f5950668eed35a619f9a17aca7553c8308c`
- Starting and ending HEAD are identical.
- No commit, push, or PR was created.
- The founder authority directory and all implementation/record files remain untracked for review.
