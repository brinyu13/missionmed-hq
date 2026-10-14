# MX-ARENA-AVATAR-20261013 — Arena frontend polish: live production acceptance

Date: 2026-10-13 20:48 – 21:20 ET (2026-10-14 00:48 – 01:20 UTC) · Verifier: Fable 5.1 (builder = verifier; see Independence)
Surface: `https://missionmedinstitute.com/arena/` (WordPress wrapper serving CDN object `html-system/LIVE/arena.html`), authenticated as the founder (`brinyu`, Supabase `a66fd7d3-c924-4369-be6a-e39c35660294`), built-in browser. **No student accounts touched; no existing founder avatar deleted.**
Backend: **untouched** — `GET /api/avatar/health` still reports build `MX-ARENA-AVATAR-20261013_V2_IDENTITY_ROUTE`, `started_at 2026-10-13T23:09:37Z` (the founder's deployment `a426cfd9…`), no redeploy.

## Releases (single surface, `release/deploy_arena_single_surface.sh`, run from the device VM)

| Rel | Live sha256 (arena.html) | UTC | Content | Receipt |
|---|---|---|---|---|
| base | `bd44e33f0c8b75dc28bf63190f0ab9c462af1700df287e7bcd377116dea7444c` | pre-release | DRJ-DAILY-DRILLS-RECOVERY 2026-10-12 build (kept: `release/receipts/arena.html.ROLLBACK_bd44e33f`) | — |
| r1 | `4caa7d900e05b0a48a0514c8ec8518b23a5cc34d75247b8ac5ed61332a2749bb` | 00:48:39 | banner removal, logo branding, two-step deletion, Download/integrity/gender fixes | `receipt_20261014T004839Z.json` |
| r2 | `a1d76893e6abf0cb6450504f7d0a3cb794177120b944916d1dd899624c97c233` | 01:04:21 | fix found in live test: Escape/backdrop no longer propagate to the document-level handlers that close the locker (capture-phase, scoped to the open dialog) | `receipt_20261014T010421Z.json` |
| **r3 (final)** | **`4d6580fa0b8c4752b0921db8247b35b01097c8438910eb73d518e8a3f099da28`** (996,257 B) | **01:09:13** | fix found in live test: after a failed delete the same dialog is re-armed so "Try again" is a real retry (previously dead until Cancel/reopen) | `receipt_20261014T010913Z.json` |

Brand asset: `https://cdn.missionmedinstitute.com/arena/assets/branding/missionmed-institute-logo-9f960ed9c3.png` — live, sha256 `9f960ed9c3…` = supplied logo pixels, `Cache-Control: immutable`, CORS `*`.
Wrapper / page-cache check: logged-in requests (what students see) bypass Kinsta's page cache and served each release immediately (verified in the authenticated browser: r3 code present after reload). Anonymous (logged-out) requests to `/arena/` kept a Kinsta page-cache copy of **r1** (`x-kinsta-cache: HIT`) for 2 h after r3 — the deploy script's no-token fallback cannot purge Kinsta. Cleared at 03:17Z via WP admin → Kinsta Cache → "Clear Site Cache"; 30 s later anonymous `/arena/` served r3 (`x-kinsta-cache: MISS`). **Procedure note:** after any Arena single-surface release, clear the Kinsta site cache (or supply `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` in `r2.env` for the script's purge step).
Each release was gated on the live bytes equalling the previously reviewed release (drift gate) and verified by sha on STAGING and LIVE.

## Founder acceptance criteria A–N (live, r3 unless noted)

| # | Criterion | Result | Evidence |
|---|---|---|---|
| A | Beta Preview banner absent on desktop | **PASS** — `#arenaBetaPreviewBanner` absent, `.arena-beta-preview-banner` 0 nodes, no "Beta Preview" text; verified at 1440×900 after hard reload (r1 and r3) | `evidence/frontend_live/A_lobby_desktop_1440_no_banner.jpg` |
| B | Absent on tablet / mobile | **PASS** — 768×1024 and 375×812 (Android-UA emulation) | `B_lobby_tablet_768_no_banner.jpg`, `C_lobby_mobile_375_no_banner.jpg` |
| C | Avatar head/face fully visible, no empty space where the banner was | **PASS** — all three viewports; lobby layout unchanged (banner node and its CSS removed, nothing replaces it) | A/B/C |
| D | Does not reappear after refresh / login / navigation / avatar generation | **PASS** — creator `ensureArenaBetaUi()` now only removes a stale node; checked after reload ×3, locker open/close, generation + Use Avatar, Profile/Lobby navigation | console + A–K |
| E | Official logo on Avatar Studio surfaces | **PASS** — v3 Avatar Studio topbar (desktop + mobile), Upload-Your-Photo modal header (preview / generating / Avatar Ready), locker "Avatar Studio" tile (desktop + mobile). All three `<img data-mm-brand-logo>` slots load the CDN asset (280×113 natural); rendered aspect 2.478 = natural in every slot (`object-fit: contain`), no stretch/recolor, transparency preserved on dark headers | `D_`, `E_`, `F_`, `G_`, `H_`, `L_` |
| F | Single centralized asset reference, no duplicates | **PASS** — one `window.ARENA_BRAND_LOGO_URL`, `applyArenaBrandLogos()` fills the slots; no other logo copies in the Arena page | source grep (`ARENA_BRAND_LOGO_URL` ×3 = declaration + 2 uses) |
| G | Delete: first click never deletes; styled modal with required title/message, thumbnail, correct ID, Cancel safe + "Yes, Delete Avatar" destructive, focus on Cancel | **PASS** — title "Delete this avatar?", copy "Are you sure you want to delete this avatar? This action cannot be undone.", thumbnail + full ID, `role=dialog aria-modal`, Cancel focused on open; 0 DELETE requests on open (fetch observer) | `I_delete_modal_desktop_active_note.jpg` |
| H | Cancel / Escape / backdrop / dismiss → no deletion, locker intact | **PASS (r2+)** — each path closed only the dialog, 0 DELETE requests, 8 rows / 8 tiles unchanged, locker stayed open, focus returned to the Del button. (r1 FAIL → fixed in r2: Escape also closed the locker.) | console `[AVATAR_DELETE_CONFIRM_RESOLVED] reason: escape / cancel / backdrop` |
| I | Active-avatar note | **PASS** — "This is your currently active avatar. After deletion, your most recent saved avatar will become active." shown only for the active record; hidden for a non-active one (mobile check on `8caa8b37…`) | I, M |
| J | Failed deletion keeps the avatar, actionable error, no optimistic removal | **PASS** — with a test-only in-page stub returning HTTP 500 for the DELETE: exactly one request (`DELETE /rest/v1/user_avatars?id=eq.<id>&user_id=eq.<uid>`), dialog stayed open with "Could not delete this avatar. … Try again or press Cancel to keep it.", confirm re-enabled, focus on Cancel, 8 rows / 8 tiles intact, toast "Could not delete avatar. Your avatar was kept." | `J_delete_failure_case_avatar_preserved.jpg` |
| K | Retry after failure works; confirm deletes exactly the intended record; loading state; success confirmation | **PASS (r3)** — same dialog, second "Yes, Delete Avatar" → button "Deleting…" (disabled) → server-confirmed row id match → dialog closed → toast "Avatar deleted." Requests: 1 stubbed failure + 1 real, both scoped to `c8c17962…` + founder `user_id`. Record gone (8 → 7 rows), tile gone. (r2 FAIL → fixed in r3: retry click was inert.) | console `[AVATAR_DELETE_CONFIRMED] attempt: 1 / 2`, `[AVATAR_DELETE_SUCCESS]`, `K_locker_after_delete_fallback_active.jpg` |
| L | Deleting the active avatar → documented fallback, no silent arbitrary activation | **PASS** — `[AVATAR_DELETE_ACTIVE_FALLBACK_APPLIED] fallback_avatar_id = 1105b204…` (the most recent remaining record, exactly as the note promised), persisted via `set_active_user_avatar`, `[AVATAR_DB_VERIFIED] player_profiles.active_avatar_id = 1105b204…`, lobby + nav thumbnail re-rendered | K + console |
| M | Avatar generation / persistence regression (original Upload Your Photo flow) on the new frontend | **PASS** — file set on the real `#avatarFileInput`, preview step now shows the Character Base toggle (Male selected), Looks Good → branded "Generating avatar" → "Avatar Ready / Character Unlocked"; `[AVATAR_SOURCE_INTEGRITY] match:true, engine: identity_openai`; record `c8c17962…` saved, active, `[AVATAR_DB_VERIFIED] avatar_count 8`; lobby rendered the new avatar after Use Avatar. Download: `[AVATAR_DOWNLOAD_OK] 1,462,219 B image/png ext png`, tab did not navigate, no new tab (previous FAIL now PASS). Input for this disposable run was the founder's own previously generated likeness (consented), not a new raw photo. | `G_`, `H_` |
| N | No unrelated regressions; founder's records preserved | **PASS** — 7 pre-existing founder avatars intact (`1105b204, 0c890863, d5be1ee5, 14fbfb4d, 7e3c1e10, 1d55a68a, 8caa8b37`); the only deleted record is the disposable one created in M; founder's active avatar restored to its pre-test value `14fbfb4d…` through the normal UI; no console errors other than the two intentionally stubbed DELETE failures; Drills/Daily/STAT/Matrix objects untouched (single-object release) | final DB check: 7 rows, active `14fbfb4d` |

Mobile deletion dialog: fits 375 px (card 339 px), stacked full-width buttons, Cancel works (`M_delete_modal_mobile.jpg`).

## Source control / manifest state (for the founder's Mac)

Worktree `/Users/brianb/MissionMed_worktrees/MX-ARENA-AVATAR-20261013` (branch `fable/mx-arena-avatar-20261013`) now holds, **uncommitted**: `LIVE/arena.html` = r3 bytes (`4d6580fa…` = live CDN), `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` `cdn_arena_live.approved_sha256` = `4d6580fa…`, one `CHANGELOG.md` entry (01:13 UTC), untracked `_AI_HANDOFFS/from_fable/`. Live = pin = worktree verified.
Commits/push could not be made from the device VM (git lock files cannot be deleted there; no push credentials). Run on the Mac:

```
rm -f /Users/brianb/MissionMed/.git/worktrees/MX-ARENA-AVATAR-20261013/index.lock   # only if present
bash /Users/brianb/MissionMed_worktrees/MX-ARENA-AVATAR-20261013/_AI_HANDOFFS/from_fable/MX-ARENA-AVATAR-20261013/release/git_reconcile_and_commit.sh
```
(commits: live-bytes baseline `bd44e33f…` → r3 candidate → manifest pin + changelog + handoff package; then pushes the branch). A stale lock from the earlier attempt was moved to `.git/worktrees/MX-ARENA-AVATAR-20261013/stale-index-lock-fable-20261013` and can be deleted.

Rollback: `bash …/release/rollback_arena_single_surface.sh …/release/receipts/arena.html.ROLLBACK_bd44e33f` (pre-release bytes) or `…/arena.html.ROLLBACK` (r2 bytes).

## Independence
Builder = verifier. Mitigations: deterministic gates (sha on STAGING/LIVE, drift gate), network-level DELETE observer, DB counts read directly through the founder's own Supabase session, offline harness (`release/verify_delete_modal.py`, 15/15 incl. propagation + retry cases), screenshots A–M. Two live-only defects (H, K) were found by this pass and fixed before sign-off; a second reviewer should spot-check H/J/K.

## Verdict
**All three directive items are live and verified in the student-facing Arena (r3).** Backend untouched. Remaining items are listed in `REPORT.md` §11.
