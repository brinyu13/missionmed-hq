# MMC-019 Provenance Repair

RESULT: HARD_BLOCKED

SUMMARY:
- VERIFIED: The MMC private route guard is committed at HEAD `7b55f04` in `missionmed-hq/server.mjs`.
- VERIFIED: The MMC-016 private static payload is present locally but remains uncommitted as tracked modifications.
- VERIFIED: A recovery patch artifact now preserves the exact dirty MMC private payload diff under `_AI_HANDOFFS/from_codex/`.
- VERIFIED: A recovery archive now preserves the current MMC private payload files under `_AI_HANDOFFS/from_codex/`.
- HARD_BLOCKED: Full Git provenance repair could not be completed from this environment because Git ref creation is denied by filesystem sandbox permissions and remote push/network access is unavailable.

## Scope

- VERIFIED: This report did not commit, push, deploy, migrate, create schemas, call production APIs, or mutate production.
- VERIFIED: No source files were edited as part of MMC-019 provenance repair.
- VERIFIED: This report records what must be preserved before the next implementation step.

## Provenance Evidence

| Evidence | Status | Detail |
|---|---:|---|
| Current branch | VERIFIED | `mmc/canonical-discovery-002`. |
| Current HEAD | VERIFIED | `7b55f04ab6f0fca232efa5a0c2c90b822e187204`. |
| HEAD content | VERIFIED | Commit message `MMC-014A: tighten private route authorization`; stat shows `server.mjs` and private validation test changed. |
| Private guard committed | VERIFIED | `server.mjs` includes route-specific private mount authorization at HEAD/current source. |
| Private payload files tracked | VERIFIED | `git ls-files` lists `missionmed-hq/public/mmc-private/index.html`, `src/app.js`, `src/mmc-data-adapters.js`, `src/mmc-ownership-layer.js`, `src/styles.css`, and validation test. |
| Private payload modified | VERIFIED | `git diff --name-status` shows four private static payload files and validation test modified. |
| Diff size | VERIFIED | `764 insertions(+), 14 deletions(-)` across five files. |
| Live deploy method from prior report | VERIFIED prior report | MMC-017A says deploy used `git archive HEAD` plus copied modified private mount files. |
| Remote branch safety | UNVERIFIED | The local branch tracks `origin/main`; a same-named remote branch was not verified from network. |
| Recovery patch artifact | VERIFIED | `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.patch`, SHA-256 `911ba76eedf7e5dc737a701acc656140d535b1a1f89f4727c267561a32ee3d50`, 990 lines. |
| Recovery patch Git visibility | VERIFIED | File exists on disk but is ignored by `.gitignore:60:_AI_HANDOFFS/**`; it is a filesystem recovery artifact, not Git provenance. |
| Recovery archive artifact | VERIFIED | `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.tar.gz`, SHA-256 `3d4c832e4f8c082404c7742df29c8624c54ce59a4ce2c19704b9b733363afb1c`, approximately 45 KB. |
| Recovery archive contents | VERIFIED | Includes `index.html`, `src/app.js`, `src/mmc-data-adapters.js`, `src/mmc-ownership-layer.js`, `src/styles.css`, and `tests/mmc-private-mount-validation.mjs`. |
| Recovery archive Git visibility | VERIFIED | File exists on disk but is ignored by `.gitignore:60:_AI_HANDOFFS/**`; it is a filesystem recovery artifact, not Git provenance. |
| HEAD lacks MMC-016 markers | VERIFIED | `git show HEAD:missionmed-hq/public/mmc-private/src/app.js` returned no matches for `MMC_MENTOR_INTELLIGENCE`, `profilePhotoSupport`, `Student Briefing Engine`, `local-internal-pilot-only`, or `productionPhotoUpload`. |
| Local dirty payload has MMC-016 markers | VERIFIED | Local `app.js`/`index.html` contain `MMC_MENTOR_INTELLIGENCE`, `Student Briefing Engine`, profile photo controls, and local-only photo metadata. |
| Railway metadata probe | BLOCKED | `railway whoami/status` failed because `backboard.railway.com` DNS/API lookup failed. |
| Branch creation | HARD_BLOCKED | `git switch -c codex/mmc-019-reality-schema-foundation` failed: `cannot lock ref ... Operation not permitted`. |

## Files That Must Be Preserved

| File | Status | Why It Matters |
|---|---:|---|
| `missionmed-hq/public/mmc-private/index.html` | VERIFIED modified | MMC-016 private mount HTML and briefing/photo surfaces. |
| `missionmed-hq/public/mmc-private/src/app.js` | VERIFIED modified | MMC-016 runtime harness, mentor intelligence export, local-only flags. |
| `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js` | VERIFIED modified | Local MMC ownership, memory, tasks, goals, briefing intelligence, profile photo persistence. |
| `missionmed-hq/public/mmc-private/src/styles.css` | VERIFIED modified | MMC private visual support for MMC-016 additions. |
| `missionmed-hq/tests/mmc-private-mount-validation.mjs` | VERIFIED modified | Static private mount guard/payload validation. |

## Current File Checksums

| File | SHA-256 |
|---|---|
| `missionmed-hq/public/mmc-private/index.html` | `a07401a1d784abd2e8369d82938fc60c9de87a731e0d2d2e87ab989226d63a5d` |
| `missionmed-hq/public/mmc-private/src/app.js` | `1e5ba5b22c09942a0ef321a88a7e416744ca6a8d1b5129367abe67bf5dceee39` |
| `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js` | `3061659457d2276c90f5bcff1f13aecc5688cd84273445c124dc8ea3bc5b5261` |
| `missionmed-hq/public/mmc-private/src/styles.css` | `245019ea16d0c6c7a9e4a9c6fd4746c0518ba718d8a2170afd2de5db100c2ff0` |
| `missionmed-hq/tests/mmc-private-mount-validation.mjs` | `678f00f86715dd866256de8da4fa0edfb328e385ecc43ec3f05e7e1ee1235b16` |

## Risk Classification

- HIGH: Uncommitted private payload means the live deployed MMC-016 experience is not recoverable from Git alone.
- HIGH: The branch tracking `origin/main` can cause future operators to assume HEAD equals deploy source, which is false for MMC-017A payload.
- HIGH: GitHub/HEAD preserves the route guard but not the local MMC-016 payload; deployment provenance is therefore split.
- MEDIUM: If the worktree is cleaned, reset, or deleted before commit/push, the recovery patch can restore the dirty payload but Git provenance will still be incomplete.
- MEDIUM: The recovery archive can restore full files from the current filesystem, but it is ignored by Git and not remote durable.
- MEDIUM: Prior MMC-017A report provides a narrative deploy trail, but not a durable source artifact.

## Repair Actions Performed

- VERIFIED: Inspected current branch, HEAD, worktree list, tracked files, modified file list, diff stat, and private mount validation.
- VERIFIED: Confirmed the implementation source currently exists locally.
- VERIFIED: Created this preservation report under `_AI_HANDOFFS/from_codex/`.
- VERIFIED: Created `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.patch`.
- VERIFIED: Recorded SHA-256 checksums for the recovery patch and five modified private payload/test files.
- VERIFIED: Confirmed the recovery patch is ignored by `.gitignore`, so it protects the local filesystem state but does not provide remote/Git durability.
- VERIFIED: Created `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.tar.gz`.
- VERIFIED: Recorded SHA-256 checksum and file list for the recovery archive.
- VERIFIED: Confirmed the recovery archive is ignored by `.gitignore`, so it protects the local filesystem state but does not provide remote/Git durability.
- VERIFIED: Compared committed HEAD against local dirty MMC-016 markers.
- HARD_BLOCKED: Attempted scoped branch creation and received `.git` ref lock permission denial.
- BLOCKED: Railway CLI metadata proof failed due DNS/API lookup failure.
- NOT PERFORMED: No commit was created.
- NOT PERFORMED: No branch was pushed.
- NOT PERFORMED: No deploy was run.

## Required Provenance Repair Before Any Further Deploy

1. HARD_BLOCKED in this sandbox: Create a preservation branch or fix upstream tracking so `mmc/canonical-discovery-002` does not masquerade as `origin/main`.
2. HARD_BLOCKED in this sandbox: Commit the five modified MMC private payload/test files with a message such as `MMC-017A: preserve deployed private review payload`.
3. HARD_BLOCKED in this sandbox: Push the preservation branch to GitHub.
4. BLOCKED until verified: Compare the pushed commit tree against the deployed MMC-017A private payload, or redeploy only after explicit approval.
5. VERIFIED required: Re-run `node missionmed-hq/tests/mmc-private-mount-validation.mjs` after commit and before any deploy.

## Safe Recovery Command Plan

These commands are not executed by this report. They are the recommended manual recovery sequence once commit/push is explicitly authorized.

```bash
git status --short --branch
git diff --name-status
git switch -c codex/mmc-017a-private-payload-preserve
git add missionmed-hq/public/mmc-private/index.html
git add missionmed-hq/public/mmc-private/src/app.js
git add missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js
git add missionmed-hq/public/mmc-private/src/styles.css
git add missionmed-hq/tests/mmc-private-mount-validation.mjs
node --check missionmed-hq/public/mmc-private/src/app.js
node --check missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js
node missionmed-hq/tests/mmc-private-mount-validation.mjs
git commit -m "MMC-017A: preserve deployed private review payload"
git push -u origin codex/mmc-017a-private-payload-preserve
```

## Provenance Verdict

- VERIFIED: The implementation exists locally.
- VERIFIED: The private route guard exists in committed source.
- VERIFIED: The private payload is preserved in recovery patch and archive artifacts.
- HARD_BLOCKED: Git provenance cannot be fully repaired from this sandbox because `.git` ref writes are denied and remote network access is unavailable.
- BLOCKED: Full repair requires a Git-write-capable and network-capable environment.
