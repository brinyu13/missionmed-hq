# MMC-019 Reality Reconciliation

RESULT: HARD_BLOCKED_FOR_CURRENT_LIVE_VERIFICATION

SUMMARY:
- VERIFIED: The local worktree `/Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002` exists and contains MMC private route code, private static payload files, validation tests, and MMC-017A/MMC-018 handoff evidence.
- VERIFIED: The claim that `server.mjs` has zero MMC code is contradicted by current local source: `MMC_PRIVATE_ROUTE_PREFIX`, `isAuthorizedMmcPrivateUser`, `isAuthorizedMmcPrivateSession`, and `handleMmcPrivateMount` are present.
- UNVERIFIED: Current live Railway rendering and current student/admin access behavior could not be re-probed from this sandbox because shell DNS, Node fetch, generic web fetch, and Chrome inspection were unavailable or blocked.
- HARD_BLOCKED: Full current-state reconciliation cannot be completed in this sandbox because Git ref writes are denied and live Railway/Railway API DNS lookups fail.

## Scope And Authority

- VERIFIED: This reconciliation is documentation-only. It did not create schemas, migrations, deployments, API routes, production mutations, service-role access, Webex/transcript/R2 work, or source-code edits.
- VERIFIED: Bootstrap files were present in this worktree and the learning-read protocol was run with `_SYSTEM_LOGS/read_learnings.py --limit 10`.
- VERIFIED: Live production remains canonical, but current live evidence could not be freshly collected from this sandbox.
- VERIFIED: MMC-017A remains prior credentialed evidence for live deployment and smoke behavior; it is not the same as a fresh current live proof.
- UNVERIFIED: A local `MMC-019A_PRE_PRODUCTION_ARCHITECTURE_REVIEW_BOARD.md` or equivalent Claude 019A source file was not found under `_AI_HANDOFFS`; this report reconciles against the conflict claims supplied in the active goal plus inspected current source.

## Current Repo / Worktree Status

| Item | Status | Evidence |
|---|---:|---|
| Current path | VERIFIED | `pwd` returned `/Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002`. |
| Current branch | VERIFIED | `git branch --show-current` returned `mmc/canonical-discovery-002`. |
| Current HEAD | VERIFIED | `git rev-parse HEAD` returned `7b55f04ab6f0fca232efa5a0c2c90b822e187204`. |
| Current HEAD message | VERIFIED | `git show --stat --oneline --decorate HEAD` showed `MMC-014A: tighten private route authorization`. |
| Remote origin | VERIFIED | `origin https://github.com/brinyu13/missionmed-hq.git`. |
| Worktree exists | VERIFIED | `git worktree list --porcelain` listed `/Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002` on branch `refs/heads/mmc/canonical-discovery-002`. |
| Branch upstream | VERIFIED | `git branch -vv` showed `mmc/canonical-discovery-002` tracking `origin/main`, not a same-named remote branch. |
| Dirty tracked files | VERIFIED | Five MMC private files are modified: `index.html`, `src/app.js`, `src/mmc-ownership-layer.js`, `src/styles.css`, and `tests/mmc-private-mount-validation.mjs`. |
| Untracked authority handoffs | VERIFIED | Many MMC authority reports are untracked local audit/reference artifacts. |
| GitHub `main` private guard | VERIFIED | GitHub fetch of `missionmed-hq/server.mjs` showed `MMC_PRIVATE_ROUTE_PREFIX` and route-specific MMC private config. |
| HEAD private payload vs local payload | VERIFIED | `git show HEAD:missionmed-hq/public/mmc-private/src/app.js` has no `MMC_MENTOR_INTELLIGENCE`, `profilePhotoSupport`, `Student Briefing Engine`, or `local-internal-pilot-only` matches; local dirty files do. |

## Conflict Claim Reconciliation

| Claim | Reconciliation | Status |
|---|---|---:|
| `server.mjs` has zero MMC code | Current source contains MMC private route constants, route guard, route handler, static mount, route-specific role/email config, and noindex/no-store headers. | CONFLICT resolved against claim |
| `/mmc-private/` deployment is contradicted | MMC-017A reports canonical Railway deploy to project `29afe885-b9b1-425d-8fd8-8611cd275409`, production environment, service `missionmed-hq`, deployment id `2e3ef21a-4787-4b95-b03a-2303df3424a9`. | LIKELY deployed based on prior report |
| Worktree was deleted | Current `git worktree list --porcelain` includes this exact worktree. | CONFLICT resolved against claim |
| Implementation provenance is at risk | HEAD/GitHub contains the guard but not the local MMC-016 private payload markers; deployment used a temporary tree from `git archive HEAD` plus modified files. | VERIFIED risk |
| Student/logged-out denied live | MMC-017A reports student/subscriber denied and logged-out denied. Fresh re-probe failed due DNS/network restrictions. | VERIFIED prior, UNVERIFIED current |
| Admin sees MMC-016 live | MMC-017A reports admin loaded Student Briefing Engine and profile photo pilot. Fresh admin proof unavailable in this sandbox. | VERIFIED prior, UNVERIFIED current |

## Private Route Source Evidence

- VERIFIED: `missionmed-hq/server.mjs` defines `const MMC_PRIVATE_ROUTE_PREFIX = '/mmc-private';`.
- VERIFIED: `CONFIG` includes `mmcPrivateAllowedRoles` from `MMHQ_MMC_PRIVATE_ALLOWED_WP_ROLES`, defaulting to `administrator`.
- VERIFIED: `CONFIG` includes `mmcPrivateAllowedEmails` from `MMHQ_MMC_PRIVATE_ALLOWED_WP_EMAILS`.
- VERIFIED: `isAuthorizedMmcPrivateUser(user)` normalizes the WordPress user, checks route-specific roles, route-specific emails, and `manage_options`.
- VERIFIED: `isAuthorizedMmcPrivateSession(session)` calls `isAuthorizedMmcPrivateUser(session.user)`.
- VERIFIED: `handleMmcPrivateMount()` requires `GET`, redirects logged-out users to `/api/auth/start`, returns `403 mmc_private_forbidden` for unauthorized users, and sets `X-MissionMed-Private-Mount` plus `X-Robots-Tag`.
- VERIFIED: The private route branch executes before generic API/static handling in `server.mjs`.
- VERIFIED: `serveStatic()` sets `Cache-Control: no-store` for static responses.

## Private Payload Evidence

- VERIFIED: `missionmed-hq/public/mmc-private` contains exactly the expected private payload files listed by validation:
  - `index.html`
  - `src/app.js`
  - `src/mmc-data-adapters.js`
  - `src/mmc-ownership-layer.js`
  - `src/styles.css`
- VERIFIED: `app.js` exposes `window.MMC_MENTOR_INTELLIGENCE`.
- VERIFIED: `app.js` labels the runtime as `MMC-016 local Student Briefing Engine`.
- VERIFIED: `app.js` sets `productionDependencies: false` and `apiCalls: false`.
- VERIFIED: `mmc-ownership-layer.js` uses `STORAGE_KEY = "mmc.ownership.local.v1"` and browser `localStorage`.
- VERIFIED: `mmc-ownership-layer.js` sets `externalRequestsEnabled: false` and `externalWritesEnabled: false`.
- VERIFIED: Static forbidden-pattern scan over `missionmed-hq/public/mmc-private` returned no matches for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, HTTP URLs, `service_role`, `wp-json`, Scheduler APIs, Supabase, Cloudflare, R2, Railway, or Kinsta.

## Live Route Probe

| Probe | Status | Evidence |
|---|---:|---|
| Browser/web open of `/mmc-private/` | UNVERIFIED | Tool access did not return usable live evidence. |
| Shell `curl -I -L --max-time 15 https://missionmed-hq-production.up.railway.app/mmc-private/` | BLOCKED | `curl: (6) Could not resolve host: missionmed-hq-production.up.railway.app`. |
| Node `fetch()` to `/mmc-private/` | BLOCKED | Node-backed fetch returned `TypeError: fetch failed`. |
| Computer Use / Chrome inspection | BLOCKED | Local MCP approval denied access to `com.google.Chrome`, so existing admin/student browser sessions could not be inspected. |
| Railway CLI metadata | BLOCKED | `railway whoami/status` could not refresh/fetch because `backboard.railway.com` DNS/API lookup failed. |
| Git branch preservation | HARD_BLOCKED | `git switch -c codex/mmc-019-reality-schema-foundation` failed because `.git` ref lock creation was denied by filesystem permissions. |
| Logged-out denial current | UNVERIFIED | Network/DNS blocked from this sandbox. |
| Student denial current | UNVERIFIED | No authenticated student session available in this sandbox. |
| Admin render current | UNVERIFIED | No authenticated admin session available in this sandbox. |

## Reconciled Reality Verdict

- VERIFIED: Local source proves MMC private route code exists in `server.mjs`.
- VERIFIED: Local source proves MMC private static payload exists.
- VERIFIED: Local validation proves the private payload is local-only and integration-disabled in current source.
- VERIFIED: Prior MMC-017A reports prove that, at the time of that deploy/smoke, admin rendered MMC-016 live, student/subscriber was denied, and logged-out was denied.
- VERIFIED: Current provenance is not clean because the deployed MMC-016 private payload is represented as uncommitted local modifications on top of a committed MMC-014A guard baseline.
- VERIFIED: Git/GitHub source currently preserves the private route guard, but not the full local MMC-016 private payload.
- VERIFIED: The dirty MMC private payload is now preserved in `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.patch`, but it is still not committed/pushed.
- VERIFIED: The current MMC private payload files are now preserved in `_AI_HANDOFFS/from_codex/MMC-019_PRIVATE_PAYLOAD_RECOVERY.tar.gz`, but the archive is ignored by Git and not remote durable.
- UNVERIFIED: Current live route still rendering MMC-016 cannot be newly proven from this sandbox.
- UNVERIFIED: Current live student/admin access cannot be newly proven from this sandbox.
- CONFLICT: Any review stating there is no MMC private route code in current `server.mjs` conflicts with inspected local source.
- CONFLICT: Any review stating this worktree is absent conflicts with `git worktree list --porcelain`.

## Next Proof Needed

1. VERIFIED needed: credentialed live admin browser proof that `/mmc-private/` still renders MMC-016.
2. VERIFIED needed: live logged-out proof from an environment with DNS/network access.
3. VERIFIED needed: live student/subscriber denial proof from an authenticated student session.
4. VERIFIED needed: commit/push provenance for the MMC-016 private payload. An archived recovery patch now exists, but it is not equivalent to Git provenance.
