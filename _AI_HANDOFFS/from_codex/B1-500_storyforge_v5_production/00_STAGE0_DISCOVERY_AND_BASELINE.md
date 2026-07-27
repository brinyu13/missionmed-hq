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
