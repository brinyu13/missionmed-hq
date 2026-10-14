# Arena "Beta Preview" banner removal — independently reviewable patch (NOT DEPLOYED)

Ticket: MX-ARENA-AVATAR-20261013 (additional task, 2026-10-13 19:07 ET) · Author: Fable 5.1
Surface: `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` (served inline by the `/arena` WordPress wrapper, same bytes)
Surface owner: active mission MX-IVPREP-LIVE-ARENA-20261012 (Codex) holds the Arena frontend; this patch is handed to that owner. **Nothing was deployed.**

## 1. Component, trigger, source

| | |
|---|---|
| Visible text | "You're currently in the MissionMed Arena Beta Preview. The full Arena launches August 1, 2026. During beta, you may notice a few quirks while we finish final launch polish." |
| DOM node | `<div id="arenaBetaPreviewBanner" class="arena-beta-preview-banner">` appended to `<body>`, `position:fixed; top:82px; z-index:56` (76px on ≤900px) |
| Creator | `function ensureArenaBetaUi()` — live `arena.html` lines 16051-16060 (JS inside the Arena Access Gate IIFE) |
| Triggers | `init()` (L17179, every page load/login), `applyArenaAccessStateToLobby(state)` (L16171, each access-state load, incl. refresh after avatar/lobby events) and `syncArenaTrialCounters(state)` (L16166) → it is re-created whenever the access state hydrates, which is why it reappears after refresh, login, mobile, avatar generation and section navigation |
| Persistence | none — unconditional, no dismiss control, no localStorage/sessionStorage flag, no timer, no listener of its own (verified by grep) |
| Introduced | `missionmed-hq` commit `35daab7` (2026-05-30, "E9 STAT async human P0 repair source roster leaderboard") |
| Related stale copy | the locked-mode access modal (`showArenaAccessModal`, L16142) repeats "You're currently in the MissionMed Arena Beta Preview. The full Arena launches August 1, 2026." |
| Not touched (legitimate) | "Your Arena Beta Trial Has Ended" / "Your 7-day Arena Beta Trial has ended" (access-expiry modal, product name), the STAT version dropdown label `STAT V3 (Beta/testing)` (L24926, admin/version selector), "Coming soon" mode toasts, all error/permission/lock toasts and modals |

## 2. Patch (`arena_beta_banner_removal.patch`, 70 lines, 4 hunks) — applies to live bytes SHA-256 `bd44e33f0c8b75dc28bf63190f0ab9c462af1700df287e7bcd377116dea7444c` (975,617 B)

1. CSS `.arena-beta-preview-banner{…}` block removed (L4162-4181).
2. CSS mobile override `@media (max-width:900px){ .arena-beta-preview-banner{…} }` removed (L4328-4332).
3. `ensureArenaBetaUi()` no longer creates the banner; it removes any stale `#arenaBetaPreviewBanner` node and still calls `removeStudentFacingAccessDiagnostics()` (unchanged behaviour for the access chip / trial counters). Call sites unchanged → zero behavioural change elsewhere.
4. Locked-mode access modal copy: the two stale "Beta Preview … launches August 1, 2026" sentences removed; the modal, its buttons and its lock logic are unchanged. (Optional hunk — drop it if the owner wants copy untouched.)

Result file: `arena_beta_removal_candidate.html`, SHA-256 `07c1b91e62bec8745fae06c45c3534775e58b61607b5a2e072cbf530de75b7e5` (974,830 B). The avatar Download/integrity candidate (`arena_frontend_candidate.patch`) targets the same base and is independent; apply either or both.

## 3. Pre-deploy verification performed (local, headless Chromium, network blocked)

`verify_banner.py` loads base and candidate at 1440×900 and 375×812, waits 7 s after `init()`:

| file | viewport | `#arenaBetaPreviewBanner` | "Beta Preview" in DOM text | lobby init reached | page errors |
|---|---|---|---|---|---|
| live base | 1440 / 375 | present | yes | `data-lobby-state=lobby` | 0 |
| candidate | 1440 / 375 | **absent** | **no** | `data-lobby-state=lobby` | 0 |

All 26 inline scripts parse. Live site screenshots of the banner (before) are in `../evidence/06_*` and `08_*` (desktop + mobile).

## 4. Deployment steps for the surface owner (not executed)

1. Reconcile source: the live CDN bytes (`bd44e33f…`) have no exact commit in `missionmed-hq` and differ from `CRITICAL_SYSTEMS_MANIFEST.json` `cdn_arena_live.approved_sha256` (`19a519f5…`). Commit the live bytes as the baseline first, then apply the patch (`patch -p0 LIVE/arena.html < arena_beta_banner_removal.patch`), bump the VERSION header per `PRIMER_EXT_HTML_DEPLOY.md`.
2. Update the manifest pin to the candidate SHA via a decision record; take the SHARED/PATH Lease V2 claim for `LIVE/arena.html`.
3. Deploy **only** `arena.html` (`_SYSTEM/deploy.sh --manifest <arena-only manifest>`; the default manifest would also push the stale repo `LIVE/stat|drills|daily.html`). Purge Cloudflare and Kinsta for `/arena` and the CDN key.
4. Post-deploy: `curl` CDN + `/arena` → SHA `07c1b91e…` (or the owner's re-versioned hash) and `grep -c arenaBetaPreviewBanner` = 1 (only the removal line); authenticated check on desktop and 375×812 mobile after refresh, re-login, browser restart, an avatar generation, and Lobby → Profile → MedPass → Career navigation: no banner; locked-mode modal still opens with its two CTA buttons; toasts still work.

## 5. Acceptance status

**NOT LIVE.** Patch + evidence ready; deployment and live verification remain with the Arena surface owner (lease held by MX-IVPREP-LIVE-ARENA-20261012). Until deployed, students still see the banner.
