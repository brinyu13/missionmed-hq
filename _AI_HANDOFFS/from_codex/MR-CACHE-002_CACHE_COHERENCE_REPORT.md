# MR-CACHE-002 Cache Coherence Report

RESULT: PARTIAL

Deterministic validation tooling was added and live-state evidence was generated. The live runtime itself is still unresolved because the public CDN/WordPress artifacts do not match this branch's local source. No deploy, purge, cache invalidation, auth change, runtime HTML change, secret readout, commit, or push was performed.

## Branch And Status

- Starting branch: `mr/cache-coherence-repair-001`
- Ending branch: `mr/cache-coherence-repair-001`
- Starting git status: clean
- Starting commit: `7409a82f056b58335e996dda7e101c310c982f1f`
- Ending git status at report creation: untracked validation tooling and reports only
- Commit status: not committed because strict live-state validation fails
- Push status: not pushed

## Files Inspected

- `_SYSTEM/PRIMER_CORE.md`
- `_SYSTEM/SESSION_PRIMER_V2.md`
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`
- `MISSIONMED_STUDENT_LIVE_RELEASE_MANUAL_V1.md`
- `MISSIONMED_PRODUCTION_HARDENING_HANDOFF_PACK.md`
- `_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md`
- `_SYSTEM/deploy.sh`
- `_SYSTEM/rollback.sh`
- `_SYSTEM/mirror_live_assets.sh`
- `_SYSTEM/DEPLOY_MANIFEST.json`
- `VALIDATION/validate_deploy.sh`
- `VALIDATION/validate_runtime.sh`
- `wp-content/mu-plugins/arena-route-proxy.php`
- `wp-content/mu-plugins/stat-route-proxy.php`
- `wp-content/mu-plugins/drills-route-proxy.php`
- `wp-content/mu-plugins/mmvs-drills-proxy.php`
- `wp-content/mu-plugins/missionmed-hq-proxy.php`
- `missionmed-hq/server.mjs`
- `missionmed-hq/public/usce.html`
- `missionmed-hq/public/usce-admin.html`
- `missionmed-hq/public/usce-student.html`
- `LIVE/arena.html`
- `LIVE/stat.html`
- `LIVE/daily.html`
- `LIVE/drills.html`

Missing requested knowledge files in this worktree:

- `MISSIONMED_MASTER_KNOWLEDGE.md`
- `KNOWLEDGE_INDEX.md`

## Files Modified

- `VALIDATION/validate_live_state.sh`
- `VALIDATION/live_state_report.mjs`
- `_SYSTEM/purge_runtime_cache.sh`
- `_AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.json`
- `_AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_STRICT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-002_CACHE_COHERENCE_REPORT.md`

## Files Intentionally Untouched

- Runtime HTML source: `LIVE/arena.html`, `LIVE/stat.html`, `LIVE/daily.html`, `LIVE/drills.html`
- Auth/session/bootstrap/exchange code
- Supabase schema, RLS, functions, migrations, and production database state
- Railway secrets/env and runtime deployment state
- WordPress production content
- WooCommerce, LearnDash, payments, enrollment, Postmark, Gmail
- Arena/STAT/Daily/Drills gameplay logic
- VIDEO_SYSTEM internals and USCE offer logic

## Cache Layers Found

| Layer | Where Configured | Can Serve Stale? | Freshness Validation | Safe Purge Path |
|---|---|---:|---|---|
| Local source | `LIVE/*.html` | Yes, if branch is stale | SHA256 local file | Git source reconciliation |
| Git branch/commit | `mr/cache-coherence-repair-001` at `7409a82` | Yes, if not source of deployed artifact | branch, commit, status | choose/merge/redeploy approved source |
| Deploy manifest | `_SYSTEM/DEPLOY_MANIFEST.json` | Yes, if mapping wrong | source to STAGING to LIVE keys | manifest review, no broad change |
| Deploy pipeline | `_SYSTEM/deploy.sh` | Low if used cleanly | validation, STAGING, LIVE, scoped purge | deploy script exact URLs only |
| R2 public object/CDN URL | `https://cdn.missionmedinstitute.com/html-system/LIVE/*.html` | Yes | normal and cache-busted GET, SHA256, headers | exact URL purge only |
| Cloudflare edge | response headers | Yes | `cf-cache-status`, `cache-control`, `last-modified`, body SHA | exact URL purge via `_SYSTEM/purge_runtime_cache.sh --execute --reason ...` |
| WordPress route proxy | `wp-content/mu-plugins/*route-proxy.php` | Yes | wrapper status, headers, markers, body SHA | exact wrapper URL purge; Kinsta manual if needed |
| Kinsta/WordPress cache | visible via `x-kinsta-cache` | Yes | `x-kinsta-cache`, wrapper body markers | no API script found; manual Kinsta purge if evidence supports |
| Elementor/generated CSS | not active for proxied runtime routes | Unlikely here | route proxies bypass theme/header/footer | not applicable |
| Browser cache | browser runtime | Yes | normal vs cache-busted URL, incognito check | no-store headers; hard refresh/incognito |
| Service worker | none found | No service worker found | repo search for serviceWorker/sw.js | not applicable |

## Root Cause Findings

This is not presenting as a simple stale CDN edge object. For all four canonical runtime files, the normal CDN response and cache-busted CDN response are identical to each other, but both differ from this branch's local `LIVE/*.html` source.

Observed public CDN hashes:

| Route | Local SHA | CDN SHA | Classification |
|---|---|---|---|
| `/arena` | `2d8eebdd261a` | `6994ede87299` | `SOURCE/DEPLOY MISMATCH` |
| `/stat` | `350108cc24ed` | `e318ec6f0530` | `SOURCE/DEPLOY MISMATCH` |
| `/daily` | `aa7b7ff42f51` | `a298e7ef47b8` | `SOURCE/DEPLOY MISMATCH` |
| `/drills` | `cd79a2f1c822` | `a4c781758dee` | `SOURCE/DEPLOY MISMATCH` |

Git object lookup against local refs found:

- CDN `/arena` matches commit `138d1e3` on `av3/profile-locker-v3-current-arena-repair-002-g`.
- CDN `/daily` matches commit `5c19f4a` on `md-daily-drills-nonwiring-megarun-007`.
- CDN `/drills` matches commit `5c19f4a` on `md-daily-drills-nonwiring-megarun-007`.
- CDN `/stat` did not match any local git object found for STAT HTML paths.

That means production currently appears to be a composite of artifacts from multiple sources, not a coherent deploy of this branch.

## Exact Changes Made

- Added `VALIDATION/validate_live_state.sh` as the safe entrypoint.
- Added `VALIDATION/live_state_report.mjs` to generate markdown and JSON evidence for local source, git state, CDN normal/cache-busted responses, WordPress wrappers, selected cache headers, markers, and route classification.
- Added `_SYSTEM/purge_runtime_cache.sh` as a dry-run-first exact-URL Cloudflare purge helper. It refuses broad zone purges and requires `--execute --reason`.
- Generated live evidence reports under `_AI_HANDOFFS/from_codex/`.

No runtime HTML or production configuration was changed.

## Validation Commands Run

- `pwd`
- `git branch --show-current`
- `git status --short`
- `git log --oneline --decorate -8`
- `git diff --name-status`
- `git remote -v`
- `git branch -vv`
- `bash VALIDATION/validate_runtime.sh --env LIVE --manifest _SYSTEM/DEPLOY_MANIFEST.json --live-dir LIVE --timeout 30`
- `node --check VALIDATION/live_state_report.mjs`
- `bash -n VALIDATION/validate_live_state.sh`
- `bash -n _SYSTEM/purge_runtime_cache.sh`
- `bash _SYSTEM/purge_runtime_cache.sh`
- `bash _SYSTEM/purge_runtime_cache.sh --cdn-only`
- `bash VALIDATION/validate_live_state.sh --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.md --json-output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.json`
- `bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_STRICT.md`
- `bash VALIDATION/validate_deploy.sh --live-dir LIVE`
- `git diff --check`
- `rg -n "[ \t]+$" ...`

`shellcheck` was not available in this environment, so shell scripts were checked with `bash -n` and dry-run execution.

## Live URLs Tested

- `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html`
- `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html?mm_final_validation=20260508T1608`
- `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html`
- `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html`
- `https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html`
- `https://missionmedinstitute.com/arena`
- `https://missionmedinstitute.com/stat`
- `https://missionmedinstitute.com/daily`
- `https://missionmedinstitute.com/drills`
- `https://missionmedinstitute.com/drills?entry=daily_rounds`
- `https://missionmed-hq-production.up.railway.app/hq`
- `https://missionmed-hq-production.up.railway.app/usce.html`
- `https://missionmed-hq-production.up.railway.app/usce-admin.html`
- `https://missionmed-hq-production.up.railway.app/usce-student.html`

Computer Use final validation loaded a dedicated Chrome window for the CDN normal URL, CDN cache-busted URL, WordPress `/arena`, and incognito WordPress `/arena`. Public CDN and incognito WordPress showed the expected public/login-required Arena runtime. Existing authenticated browser state also loaded the WordPress wrapper without requiring me to enter credentials.

## Cache Headers Observed

CDN canonical HTML:

- `cache-control: no-cache, no-store, must-revalidate`
- `cf-cache-status: DYNAMIC`
- `content-type: text/html; charset=utf-8`
- `last-modified` varied by artifact
- no `age` header observed in captured evidence

WordPress wrappers:

- `cache-control: no-cache, must-revalidate, max-age=0, no-store, private`
- `cf-cache-status: DYNAMIC`
- `x-kinsta-cache: MISS` or `BYPASS`
- `x-missionmed-route` present for proxies
- `x-missionmed-upstream-status: 200`

Railway USCE static routes:

- `cache-control: no-store`
- `server: railway-edge`

## Route Truth Table

| Route | Local File | Deploy Destination | Public URL | Wrapper URL | Expected Cache | Classification |
|---|---|---|---|---|---|---|
| `/arena` | `LIVE/arena.html` | `html-system/LIVE/arena.html` | CDN arena URL | `https://missionmedinstitute.com/arena` | no-store/no-cache | `SOURCE/DEPLOY MISMATCH` |
| `/stat` | `LIVE/stat.html` | `html-system/LIVE/stat.html` | CDN stat URL | `https://missionmedinstitute.com/stat` | no-store/no-cache | `SOURCE/DEPLOY MISMATCH` |
| `/daily` | `LIVE/daily.html` | `html-system/LIVE/daily.html` | CDN daily URL | `/daily`, `/drills?entry=daily_rounds` | no-store/no-cache | `SOURCE/DEPLOY MISMATCH` |
| `/drills` | `LIVE/drills.html` | `html-system/LIVE/drills.html` | CDN drills URL | `https://missionmedinstitute.com/drills` | no-store/no-cache | `SOURCE/DEPLOY MISMATCH` |
| `/hq` | `missionmed-hq/public/index.html` expected but absent | Railway static/app route | Railway `/hq` | none found | private/no-cache observed | `UNKNOWN` |
| USCE request | `missionmed-hq/public/usce.html` | Railway static | Railway `/usce.html` | none found | no-store | `LIVE CURRENT` |
| USCE admin | `missionmed-hq/public/usce-admin.html` | Railway static | Railway `/usce-admin.html` | none found | no-store | `LIVE CURRENT` |
| USCE student/tracker | `missionmed-hq/public/usce-student.html` | Railway static | Railway `/usce-student.html` | none found | no-store | `LIVE CURRENT` |

## Rollback Plan

No production rollback is needed for this task because no production deploy or cache purge was performed.

If Brian authorizes a future deploy and it fails validation:

1. Do not broad-purge.
2. Preserve the failing evidence report.
3. Use `_SYSTEM/rollback.sh --target <known-good-commit>` only from a clean, authorized worktree and only with valid R2 credentials.
4. Re-run `bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_AFTER_ROLLBACK.md`.

## Remaining Risks

- Signed R2 object state was not checked because no R2 credentials were read or used.
- Kinsta cache cannot be purged automatically from this repo; only headers were observed.
- `/stat` live CDN artifact does not map to a local git object found in this worktree.
- Browser-visible version/checksum marker does not exist in the runtime, so browser validation relies on visible DOM plus HTTP/body-hash tooling.
- The target branch does not represent current production runtime state.

## Recommended Future Deploy Workflow

1. Choose the intended source of truth: either reconcile this branch to the currently deployed artifacts or choose a single approved branch/commit to deploy.
2. Run `bash VALIDATION/validate_deploy.sh --live-dir LIVE`.
3. Deploy only from a clean branch using `_SYSTEM/deploy.sh` with valid R2 credentials and Brian authorization.
4. Run strict live-state validation immediately after deploy.
5. If strict validation reports only `DEPLOYED BUT CDN STALE`, run the exact-url purge helper with a reason.
6. Re-run strict validation and save the report.
7. Do not release to students until all four canonical routes classify as `LIVE CURRENT`.

Exact command Brian should run after future deploys:

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_AFTER_DEPLOY.md
```

Optional exact purge dry run:

```bash
bash _SYSTEM/purge_runtime_cache.sh
```

Optional exact purge execution, only after evidence supports it:

```bash
bash _SYSTEM/purge_runtime_cache.sh --execute --reason "post-deploy exact runtime URL refresh after source/deploy match"
```

## Confidence

Confidence: 88%.

Reservation: confidence is high that the current problem is source/deploy mismatch rather than CDN edge staleness, because normal and cache-busted CDN bodies are identical and WordPress wrappers proxy those same CDN bodies. Confidence is not 100% because signed R2 object metadata, Cloudflare dashboard purge state, Kinsta dashboard cache state, and a browser-visible version marker were not available in this scoped run.

What would raise confidence closer to 100%:

- Signed R2 HEAD/GET evidence for each object without exposing credentials.
- A clean deploy from a single known source commit.
- Strict live-state validation passing for all four canonical routes.
- A nonintrusive DOM/runtime marker containing commit and SHA.
- Kinsta/Cloudflare dashboard confirmation of exact URL purge status if purging is used.
