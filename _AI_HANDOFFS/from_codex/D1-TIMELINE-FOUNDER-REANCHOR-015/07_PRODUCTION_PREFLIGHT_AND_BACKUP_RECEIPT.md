# D1 Timeline Founder Re-anchor 015 — Production Preflight and Backup Receipt

Date: 2026-08-25

Status: UNIT 24 IN PROGRESS — PRODUCTION CUTOVER HELD AT GOVERNING GATES

## Accepted immutable candidate

- Branch: `codex/d1-timeline-founder-reanchor-015`
- Source commit: `5161196686b566013f2bd8c7b0ead635f47e1e95`
- Static release: `timeline-0123e6d04c8082e7`
- WordPress release: `timeline-wp-786b0330f1a9686b`
- WordPress index SHA-256: `cefe130c646f13f8828f8c9e33bfafcd77be9039dc1366b09758b63ce58af546`
- Release-manifest SHA-256: `75be8a66cd1741696b966c4c0438cd862d17d2415474f3b93d02435177b2144a`
- Candidate Matrix-launch cache key: `500.0.8`

The cache-key correction changed only the Timeline-owned WordPress route adapter. PHP syntax validation passed, the affected WordPress/media tests passed 20/20, and the clean release build verified 66/66 packaged files plus 24/24 runtime assets. The earlier complete affected regression remains 842/842 PASS.

## Production baseline preserved

No WordPress, Kinsta, Matrix, CDN, DNS, Railway application, or database cutover was performed before the required gates.

- Live WordPress pointer: `releases/timeline-wp-07ccdfca8e35757c`
- Live static release: `timeline-d1d87b186972225b`
- Live source commit: `a6165951d3e3f2aa5150f68223dac283880b8e7d`
- Live Railway deployment: `f3c45dd7-49a1-47e2-ada3-f258acd92c28`
- Live Railway image: `sha256:203900d9b39fc525187dfc0f41f04d18608c50c02020bbe18a2e92472d8ce5bc`
- Live API health release: `timeline-d1d87b186972225b`
- Database schema: `d1-timeline-db-500.1`

These live identifiers remain the exact rollback baseline.

## Provider-native PostgreSQL backup

The authorized pre-release provider-native backup was created and independently re-listed through Railway's supported backup interface.

- Name: `D1-TIMELINE-FOUNDER-REANCHOR-015-PRE-20260825T155613Z`
- Backup ID: `39d25b5e-2090-4b91-b8d0-d945645bcdce`
- External ID: `vs_1787673392439_xbps0lu6sg9ohkvz`
- Created: `2026-08-25T15:56:32.506Z`
- PostgreSQL volume instance: `bbb515b8-9398-4b0b-b637-2905eb4086bc`
- Source-volume state: `READY`
- Referenced size: `890 MB`
- Expiration: none

`usedMB` remained `null` at the immediate read-back. This is recorded as delayed provider size metadata, not represented as restore proof. Exact name, provider IDs, current creation timestamp, non-empty external ID, source-volume state, and independent list visibility establish creation. An isolated restore was not performed at this checkpoint.

## Kinsta backup gate

The authenticated MyKinsta session is available, but the current manual/daily inventory and the new provider-native Timeline pre-release backup have not yet been verified. No Kinsta backup was deleted. No production file was changed.

## Initial D1-worktree governing-gate results

### Critical Systems gate — FAIL CLOSED

The official enforced gate exited nonzero because:

- protected `missionmed-hq/server.mjs` is dirty in the shared authority repository;
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` is dirty in the shared authority repository;
- `cdn_usce_admin_live` actual SHA-256 `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c` differs from governed SHA-256 `115aa040f57a0fdaf3f49f6e398423b93635633b901eb01d7ffc85142e91ddd4`;
- `cdn_arena_live` actual SHA-256 `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` differs from governed SHA-256 `19a519f583439056af56bcf513f2fb26f872369c458ac958093bde48d9acb12a`.

### Matrix runtime guard — FAIL CLOSED

The first official preflight, using the D1 worktree's inherited stale lock and wrong source worktree, exited `42` because three Matrix asset groups differed from that lock at that checkpoint:

- `student_os_js`: governed `c1d972...`; live origin/public `16ca42...`
- `student_os_css`: governed `111942...`; live origin/public `707ab5...`
- `class_mmed_student_os_php`: governed `5ed6e9...`; live origin `80d510...`

The other seven Matrix asset groups matched. All ten local MissionMed-hub source paths expected by the guard are absent from the isolated D1 worktree.

## Read-only reconciliation finding

Fresh source/origin/public reconciliation classifies these failures as stale and split control-plane custody, not unexplained live drift:

- the current USCE and Arena live hashes are already accepted in pushed `origin/main` commit `4c86e85` and the prior D1 custody record;
- the current accepted Critical Systems manifest is in pushed commit `396e45` and produces 112 PASS, 0 FAIL, and 2 expected warnings against live state;
- the current Matrix JS/CSS/PHP hashes are `809093d2b5b2bc05cdd4f355511f2c8d5303c71edbca4f71823d319976ced54f`, `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`, and `80d510b4bb5531b7ad23689084f7173372dfbd5d5c7102365d85ab3e645f7a51`;
- immutable Matrix JS/CSS source is bound to commit `056d199`, its deployment/lock record is `e117c5d`, and the latest pushed custody manifest is commit `aeebff0`;
- Kinsta origin and cache-busted public delivery agree for the current enqueued Matrix runtime;
- the unrelated dirty `server.mjs`, dirty shared lock manifest, and concurrent File Vault candidate files remain preserved and excluded;
- no Matrix, USCE, Arena, StoryForge, File Vault, CDN, DNS, or HQ runtime mutation is indicated for the Timeline release.

The remaining defect is authority fragmentation: the latest accepted Matrix custody and latest accepted Critical Systems custody live on divergent branches, while D1-015 requires the official gates and does not itself authorize selecting or merging shared-owner manifests. The release therefore remains fail-closed until one clean governing manifest is reconciled or the Founder explicitly authorizes commits `aeebff0` and `396e45` as the read-only D1-015 release-gate baselines with zero shared-runtime mutation.

## Immutable detached-gate proof

The official tools were then run from disposable detached clones at the exact accepted commits. No shared repository, manifest, worktree, or runtime was changed.

### Critical Systems accepted custody

- Commit: `396e45e57b60cb98d11dc2fe2450525b929006b0`
- Official result: exit `0`
- Totals: 114 checks = 112 PASS, 2 expected WARN, 0 FAIL
- Warnings: non-Node Kinsta StoryForge start-command representation is not machine-checked; four browser journeys remain external to the report-only script

### Matrix accepted custody

- Commit: `aeebff09233d95deafa32e26600f606c3770c83c`
- Official result: exit `0`
- Totals: 17/17 asset groups local = approved = origin = public where public applies
- Warnings: 0
- Blocked: 0

### Independent Timeline registration custody

- Timeline registration commit: `b75c78963c32a7c066652611388a5e3f3f170cee`
- Restored in: `4c86e85c186c01561ded81e1927842cd2ce0e5fc`
- Registration commit is an ancestor of accepted D1 source `5161196686b566013f2bd8c7b0ead635f47e1e95`
- Registered project: `295b3d56-f555-4851-91f4-eb32d7dc88e1`
- Registered API service: `12bfaf69-f883-42b5-a380-b6beea49f251`
- Registered PostgreSQL service: `134e537e-d48b-4452-acf6-8c3af2ce03db`

No registration repair is required. The only remaining shared-system issue is the missing authority to bind the already accepted split custody commits as Unit 24's read-only release-gate baselines.

## Safety verdict at this checkpoint

The Timeline candidate is committed, pushed, packaged, and locally verified. The live production release remains unchanged and available. The PostgreSQL pre-release backup exists. Kinsta backup verification and all cutover actions remain withheld pending the exact Founder binding of the already accepted split custody commits. No override phrase was used and no safety gate was weakened.
