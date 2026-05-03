# MD Daily/Drills SOT Reconciliation 004

**Prompt:** `(MD)-SOT-RECON-IMPLEMENTATION-HIGH-004`
**Date:** 2026-05-03
**Branch:** `md-daily-drills-sot-recon-004`
**Base:** `origin/main` at `38ad5fb1798e9eae40b4fedc844c4b1c1231be81`
**Status:** PARTIAL - STAT authority decision required

## Runtime Filename Contract

Contract B is authoritative for runtime filenames:

- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/stat.html`

Contract A is legacy/archive/rollback compatibility only:

- `LIVE/arena_v1.html`
- `LIVE/mode_dailyrounds_v1.html`
- `LIVE/drills_v1.html`
- `LIVE/stat_latest.html`

Do not route production runtime to Contract A paths. Do not create new
production filenames.

## Files Reconciled In This Branch

The following approved MD runtime files were copied from
`md-merger-daily-drills-lab-914` into the reconciliation branch:

| File | origin/main size / sha256 | reconciled size / sha256 |
|------|---------------------------|---------------------------|
| `LIVE/arena.html` | `765510` / `1657c2ab29af86836262fdd27b92402f738c202e6d96f75b3ec440bf16ca12be` | `812245` / `eabef46639b7e6752af2a0dd75329566d755b25ea991395ba2cb1f8f68d991e9` |
| `LIVE/daily.html` | `150069` / `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `156872` / `29b5aac8f91715510255872187434c9324421a5496663fe61643ff7a319bb992` |
| `LIVE/drills.html` | `432092` / `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `440404` / `12a24d1ade5e7d635cb48704283d4fbd4360d2a2e17a6f793997faef4a0ab2d2` |

`LIVE/stat.html` was intentionally left at `origin/main` pending Control Tower
authority review.

## STAT VARIANT REVIEW

Three STAT variants are available:

| Source | Size | SHA256 | Evidence |
|--------|------|--------|----------|
| `origin/main:LIVE/stat.html` | `344178` | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | GitHub source of truth today, but does not match CDN runtime. |
| `md-merger-daily-drills-lab-914:LIVE/stat.html` | `412715` | `4a2ff152e4c2bcdb92ac0f3da4d46ba1c54ee42f80f15ff62baa9263c9c336ba` | MD branch variant, but does not match CDN runtime and is not on origin. |
| Current CDN `LIVE/stat.html` | `436584` | `a6dc2698fc39c8e4609ef41efa38ec5d06685e8c6a9c9f9b8f5a8859409e7618` | Tester-facing runtime. Header marker: `2026-05-02 17:29 STAT_AVATAR_PRESENTATION_REPLAY_932`; no matching local or origin branch ref found after remote refresh. |

Recommended authoritative candidate for review: CDN `STAT_AVATAR_PRESENTATION_REPLAY_932`,
because it is the current tester-facing STAT runtime and has the newest explicit
version markers. Risk: it is not GitHub-backed, so it may be a manual CDN
overwrite or an unpushed artifact. Control Tower must confirm this artifact is
approved before it is committed as `LIVE/stat.html`.

Risks by candidate:

- `origin/main`: preserves GitHub authority, but would roll back current live
  STAT runtime and may drop later avatar snapshot/replay work.
- MD branch local: captures some branch work, but still diverges from current
  live runtime and has no clear authority over CDN.
- CDN 932: best matches current runtime, but must not become GitHub source of
  truth until Control Tower approves the CDN artifact source.

Decision required: approve one exact `LIVE/stat.html` source by SHA256 before
this reconciliation can become complete.

## LAB Artifact Handling

`LIVE/LAB/daily_drills_unified_lab.html` is preserved as explicit lab evidence.

- Size / SHA256: `56004` / `b8b0826ed5748910fe42340ab9a981c1bb59aece963e0191c60a8da17d4647ca`
- Version marker: `MD-MERGER-DAILY-DRILLS-LAB-915-2026-05-02`
- Marker: `labOnly: true`
- Secret scan: no `service_role`, R2 secret, private key, GitHub token, Slack token, or OpenAI-style secret key markers found
- Runtime status: not referenced by deploy manifest, deploy scripts, validation scripts, CDN runtime paths, or WordPress proxies

This artifact must not be promoted to `LIVE/*.html` or wired into runtime paths
without a separate approved implementation prompt.

## Validation

Commands run:

- `git status --short`
- `git diff --stat`
- `git diff --name-status`
- Contract B file presence check
- Deploy manifest inspection
- Active legacy reference check against deploy/proxy/validation surfaces
- `VALIDATION/validate_deploy.sh`
- `VALIDATION/validate_runtime.sh --env LIVE --timeout 20`

Results:

- Contract B files present: PASS
- Deploy manifest points to Contract B: PASS
- Active legacy Contract A references in deploy/proxy/validation surfaces: none found
- `validate_deploy`: PASS
- `validate_runtime`: FAIL, one known issue: CDN checksum mismatch for `html-system/LIVE/stat.html`

## Remaining Blockers

- Control Tower must choose the authoritative `LIVE/stat.html` variant.
- No CDN deploy was performed.
- CDN will remain out of GitHub parity until a later approved deploy after the
  STAT decision.
- AI QA, selected tester beta, and production-shape review remain blocked.
