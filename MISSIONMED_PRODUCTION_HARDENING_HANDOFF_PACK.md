# MISSIONMED_PRODUCTION_HARDENING_HANDOFF_PACK

**Prompt ID:** MR-CLAUDE-PRODUCTION-HARDENING-MEGARUN-028
**Date:** 2026-04-27
**Authority:** Planning / Audit / Handoff only
**Risk Level:** HIGH (architecture + safety documentation)
**Status:** REFERENCE DOCUMENT -- does not execute changes

---

## SECTION 1 -- CURRENT STATE SUMMARY

### What Is Working

- GitHub main branch is the source of truth for all Arena runtime HTML (arena.html, stat.html, drills.html, daily.html) under `/LIVE/`.
- Deploy pipeline (`_SYSTEM/deploy.sh`) is fully scripted: local validation, git gate, STAGING upload, STAGING validation, STAGING-to-LIVE promotion, cache purge, LIVE validation. Five-step process with abort on any failure.
- Rollback pipeline (`_SYSTEM/rollback.sh`) restores `/LIVE/` from any prior git commit (default HEAD~1), handles legacy path layout reconstruction, validates before redeploying, and bypasses git gate for emergency recovery.
- Deploy manifest (`_SYSTEM/DEPLOY_MANIFEST.json`) maps four canonical files to `html-system/STAGING/` and `html-system/LIVE/` R2 keys.
- Git gate enforces: no unstaged changes in deploy scope, no staged-but-uncommitted changes, HEAD must be synced to upstream before deploy.
- Pre-deploy validation (`VALIDATION/validate_deploy.sh`) and runtime validation (`VALIDATION/validate_runtime.sh`) scripts exist and are called by the deploy pipeline.
- CDN base URL is locked to `https://cdn.missionmedinstitute.com` with hardcoded enforcement in both deploy.sh and mirror_live_assets.sh.
- Auth architecture is defined and locked: WordPress session to Railway exchange/bootstrap to Supabase session. Documented in MM-AUTH-ARCH-001 and DATA_FLOW_CONTRACT (MR-078B).
- Data flow contract (MR-078B) is locked. Eight critical invariants (INV-1 through INV-8) are defined and enforced.
- Codex execution guardrails (MR-079) are locked. Whitelist/blacklist, risk classification, failure handling, and no-touch boundaries are defined.
- MMOS topbar/runtime layer is required in arena.html, stat.html, drills.html. daily.html is exempt from MMOS.
- E3 outbox is implemented behind a feature flag (default OFF) in stat.html. Token-assisted flush has passed. Real gameplay canary exposed backend/duel contract issues that are being addressed.
- Backup snapshots are created automatically by both deploy.sh and rollback.sh before any changes.
- Recovery playbooks exist for prior incidents in `_recovery/` directory.
- Changelog is maintained at `CHANGELOG/CHANGELOG.md`.

### What Is Blocked

- **R2 write credentials are invalid.** The most recent signed write test returned 403 (SignatureDoesNotMatch). Until valid R2 credentials are provisioned, no deploy or mirror operation can execute against Cloudflare R2. This blocks all CDN deployments.
- **Asset mirroring is blocked.** The mirror script (`_SYSTEM/mirror_live_assets.sh`) cannot copy legacy-path assets into `html-system/LIVE/` paths because R2 writes fail. Some legacy source objects also returned unexpected status during preflight checks.
- **E3 backend contract repair is not yet deployed.** Migration `20260427044500_e3_backend_contract_repair.sql` exists locally but deployment to Supabase RANKLISTIQ is UNKNOWN (not confirmed applied).
- **E3 outbox real gameplay canary has not passed.** Backend/duel contract issues were exposed during real browser canary testing. Until these are resolved and canary passes, outbox must remain internal-only with default OFF.
- **KNOWLEDGE_INDEX.md is missing from its canonical path.** `08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md` does not exist. Only a backup copy exists under `07_BACKUPS/`. PRIMER_CORE pre-flight check would fail on this.

### What Must Not Be Touched

- Auth exchange/bootstrap architecture (MM-AUTH-ARCH-001, MR-078B INV-7).
- Duel state machine trigger `duel_state_monotonic_fn()` (MR-078B INV-3).
- `answer_map` secrecy contract (MR-078B INV-1).
- Server-authoritative scoring logic in `submit_attempt` (MR-078B INV-2).
- `dataset_questions` and `dataset_registry` (immutable, MR-078B INV-6).
- `supabase_migrations.schema_migrations` table (MR-079 G-8).
- All files listed in MR-079 Section 8.1 (PRIMER_CORE, DATA_FLOW_CONTRACT, CODEX_EXECUTION_GUARDRAILS, etc.).
- MMOS topbar integration in arena.html, stat.html, drills.html.
- CDN base URL (`https://cdn.missionmedinstitute.com`). No alternative CDN origins.
- Deploy manifest structure and STAGING/LIVE key prefixes.

### What Must Be Validated Before Broader Rollout

- R2 credentials must be provisioned and a non-destructive signed write test must pass.
- E3 backend contract repair migration must be confirmed applied to RANKLISTIQ.
- E3 outbox real gameplay canary must pass in a real browser with a real Supabase-authenticated user.
- All four LIVE HTML files must be confirmed serving 200 from CDN with correct content.
- Auth exchange/bootstrap must be confirmed working end-to-end from WordPress login through Supabase RLS query.
- Arena-to-STAT navigation, Arena-to-Daily Rounds menu, and Daily-to-Drills contract must all pass.
- Avatar persistence and propagation must be confirmed.
- STAGING/LIVE parity must be verified (same content hash on both prefixes for all four files).

---

## SECTION 2 -- NON-NEGOTIABLE PRODUCTION RULES

1. **GitHub main = source of truth.** All runtime HTML lives in `/LIVE/` on main branch. No CDN-only edits. No manual R2 overwrites that bypass git.

2. **CDN LIVE aliases only.** Production URLs resolve to `html-system/LIVE/arena.html`, `html-system/LIVE/stat.html`, `html-system/LIVE/drills.html`, `html-system/LIVE/daily.html`. No legacy paths (`arena_versions/`, `drills_versions/`, `STAT_VERSIONS/`, `arena_v1.html`, `drills_v1.html`, `stat_latest.html`, `mode_dailyrounds_v1.html`) for production routing.

3. **STAGING before LIVE.** Every deployment uploads to `html-system/STAGING/` first, validates, then promotes to `html-system/LIVE/`. Direct LIVE writes are forbidden.

4. **No manual CDN overwrite.** No FileZilla, no Cloudflare dashboard uploads, no ad-hoc `curl PUT` outside the deploy pipeline. All CDN writes go through `deploy.sh` or `mirror_live_assets.sh`.

5. **No legacy runtime paths.** Production WordPress/Arena must not reference `arena_v1.html`, `drills_v1.html`, `stat_latest.html`, or `mode_dailyrounds_v1.html` as active runtime sources. These are archive/compatibility only.

6. **No frontend service_role.** The `supabaseServiceRoleKey` must never appear in arena.html, stat.html, drills.html, or daily.html. Service role is server-only (Railway/HQ backend). (MR-078B INV-8, MR-079 G-13)

7. **No auth bypass.** All Arena/STAT authentication must go through: WordPress session, `/api/auth/exchange`, `/api/auth/bootstrap`, `supabase.auth.setSession()`, `supabase.auth.getUser()`. No `wp-json` identity as source of truth. No `supabase.auth.signUp()` in frontend. (MR-078B INV-7)

8. **No MMOS removal.** arena.html, stat.html, and drills.html must contain `window.MMOS`, `MMOS.registerMode`, and Topbar integration. daily.html is exempt.

9. **No Daily-to-Drills contract bypass.** Drills engine must only launch via Daily Rounds flow with a valid contract (`mm_selected_drill` or `query.video_id`). Direct `/drills` load without contract is expected behavior but not a valid gameplay entry point.

10. **No outbox default ON until canary passes.** The E3 outbox feature flag must remain default OFF. Activation requires `?e3_outbox=1` URL parameter or explicit localStorage/global flag. Default ON requires: backend contract repair confirmed, real gameplay canary passed, operator approval.

11. **Changelog required for every deployment.** Every deploy or rollback must append an entry to `CHANGELOG/CHANGELOG.md` with timestamp, prompt ID, files changed, result, and deployed status.

12. **Backup before every destructive operation.** deploy.sh and rollback.sh both create timestamped backup snapshots. Any manual operation must do the same.

---

## SECTION 3 -- MASTER QA CHECKLIST

### A. Arena

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| A1 | Load `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | Page loads, no JS errors in console, MMOS topbar renders | Arena runtime is broken | YES |
| A2 | Check console for `window.MMOS` | Returns object, not undefined | MMOS integration missing | YES |
| A3 | Check console for `MMOS.registerMode` | Function exists | MMOS mode registration broken | YES |
| A4 | Verify no `service_role` string in page source | Not present | Security boundary violation | YES |
| A5 | Verify no `supabase.auth.signUp` in page source | Not present | Auth contract violation | YES |
| A6 | Click STAT mode card/button | Navigates to stat.html or loads STAT mode | Arena-to-STAT routing broken | YES |
| A7 | Click Daily Rounds card/button | Opens Daily Rounds menu (NOT drills directly) | Daily Rounds menu bypass | YES |

### B. Login/Logout

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| B1 | Load Arena while logged into WordPress | `/api/auth/exchange` returns 200 with accessToken | Exchange endpoint broken | YES |
| B2 | After exchange, call `/api/auth/bootstrap` with Bearer token | Returns `access_token` and `refresh_token` | Bootstrap endpoint broken | YES |
| B3 | After bootstrap, check `supabase.auth.getUser()` | Returns user object with valid UUID | Supabase session not established | YES |
| B4 | Execute any RLS-protected query (e.g., player_profiles) | Returns data scoped to auth.uid() | RLS or session broken | YES |
| B5 | Load Arena without WordPress session | Exchange returns 401, page shows login prompt or redirect | Auth handling for unauthenticated users broken | NO (expected behavior) |
| B6 | After logout from WordPress, reload Arena | Exchange fails, Supabase session cleared | Session not properly invalidated | YES |

### C. Daily Rounds

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| C1 | Load `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | Page loads, no blocking JS errors | Daily Rounds runtime broken | YES |
| C2 | Verify Daily Rounds shows category menu | Menu categories render with drill options | Menu data not loading from Supabase | YES |
| C3 | Select a drill from the menu | Drill contract created, navigation to drills.html with valid contract | Contract creation or navigation broken | YES |
| C4 | Verify daily.html does NOT have MMOS (this is correct) | No `window.MMOS` reference | Incorrect MMOS injection into daily.html | NO (informational) |

### D. Drills

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| D1 | Load drills.html via Daily Rounds with valid contract | Drill loads and plays | Drills engine broken | YES |
| D2 | Load drills.html directly without contract | Shows "No valid drill contract" or similar | EXPECTED behavior, not a failure | NO |
| D3 | Verify MMOS topbar present in drills.html | `window.MMOS` + `MMOS.registerMode` + Topbar | MMOS integration missing | YES |
| D4 | Complete a drill and verify results display | Results/score shown | Drill completion flow broken | YES |

### E. STAT Normal Mode

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| E1 | Load `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | Page loads, MMOS topbar renders, no blocking JS errors | STAT runtime broken | YES |
| E2 | Verify `window.MMOS` present | Returns object | MMOS integration missing | YES |
| E3 | Create a duel (bot or real opponent) | `create_duel` RPC succeeds, duel_id returned | Duel creation broken | YES |
| E4 | Play through duel questions | Questions render, choices clickable, timer works | Gameplay loop broken | YES |
| E5 | Submit attempt | `submit_attempt` RPC succeeds, server-computed score returned | Scoring broken | YES |
| E6 | View duel result (after finalization) | Result displays with correct scores, answer review available | Result display broken | YES |
| E7 | Check leaderboard | `get_leaderboard` RPC returns data | Leaderboard broken | NO |
| E8 | Check player profile updates | Rating, wins, losses updated after duel | Profile update broken | YES |

### F. STAT with ?e3_outbox=1

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| F1 | Load stat.html with `?e3_outbox=1` | Page loads normally, outbox initializes silently | Outbox initialization crashes STAT | YES (if it crashes normal mode) |
| F2 | Play a complete duel with outbox enabled | Gameplay identical to normal mode | Outbox interferes with gameplay | YES |
| F3 | Check IndexedDB for outbox queue entries | Telemetry events queued | Outbox not capturing events | NO (outbox-specific) |
| F4 | Trigger outbox flush (token-assisted) | Queue drains, events sent to backend | Flush mechanism broken | NO (outbox-specific) |
| F5 | Play a duel WITHOUT `?e3_outbox=1` | No outbox behavior, no IndexedDB writes | Feature flag leak | YES |
| F6 | Check that outbox errors do not surface to user | No visible error messages or UI disruption | Error containment broken | YES |

### G. Avatar Persistence

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| G1 | Generate/save an avatar in Arena | `upsert_user_avatar_record` RPC succeeds | Avatar write broken | YES |
| G2 | Set avatar as active | `set_active_user_avatar` RPC succeeds | Active avatar selection broken | YES |
| G3 | Reload Arena, verify avatar persists | Same avatar displayed | Avatar read or persistence broken | YES |
| G4 | Query `user_avatars` table for current user | Returns saved avatar(s) with correct `user_id = auth.uid()` | RLS or data integrity issue | YES |

### H. Avatar Propagation into STAT/Drills

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| H1 | Set active avatar in Arena, then load STAT | Avatar visible in STAT UI (if STAT displays avatars) | Avatar propagation broken | NO (depends on current STAT implementation) |
| H2 | Play a duel, check `match_players` snapshot | `avatar_url` captured at match start | Avatar snapshot not recording | NO (non-blocking but important) |
| H3 | Change avatar after match, verify old match shows old avatar | Historical match retains original avatar | Snapshot immutability broken | NO |

### I. CDN Asset Loading

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| I1 | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | HTTP 200, Content-Type: text/html | LIVE arena.html not on CDN | YES |
| I2 | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | HTTP 200, Content-Type: text/html | LIVE stat.html not on CDN | YES |
| I3 | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html` | HTTP 200, Content-Type: text/html | LIVE drills.html not on CDN | YES |
| I4 | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | HTTP 200, Content-Type: text/html | LIVE daily.html not on CDN | YES |
| I5 | Check for 404s on JS/CSS/image assets referenced by LIVE HTML files | All return 200 | Missing assets, broken references | YES |
| I6 | Verify STAGING copies match LIVE (content hash) | SHA256 of STAGING file = SHA256 of LIVE file for each | STAGING/LIVE drift | YES |

### J. Mobile/Basic Responsive Sanity Check

| # | Action | Expected Result | Failure Meaning | Blocks Release? |
|---|--------|----------------|-----------------|-----------------|
| J1 | Load arena.html in mobile viewport (375px width) | Layout renders without horizontal scroll, buttons tappable | Mobile layout broken | NO (but important) |
| J2 | Load stat.html in mobile viewport | Gameplay UI usable, questions readable, choices tappable | Mobile STAT broken | NO (but important) |
| J3 | Load daily.html in mobile viewport | Menu navigable, drill selection works | Mobile Daily Rounds broken | NO (but important) |
| J4 | Complete a STAT duel on mobile | Full gameplay loop works | Mobile gameplay broken | NO (but important) |

---

## SECTION 4 -- RELEASE GATES

### Gate 1: Auth Health

- **Pass criteria:** `/api/auth/exchange` returns 200 with valid accessToken for a logged-in WordPress user. `/api/auth/bootstrap` returns valid Supabase access_token and refresh_token. `supabase.auth.getUser()` returns a user object. RLS-protected query succeeds.
- **Fail criteria:** Any step returns an error, 401 for an authenticated user, or Supabase session is not established.
- **Codex validation target:** Automated test calling exchange + bootstrap + getUser + a sample RLS query. Script should exit non-zero on any failure.
- **Manual validation target:** Log into WordPress, load Arena, open browser console, verify `supabase.auth.getUser()` returns a user.
- **Release decision:** HARD BLOCK. No release without auth health confirmed.

### Gate 2: CDN Asset Health

- **Pass criteria:** All four LIVE HTML files return HTTP 200 from `https://cdn.missionmedinstitute.com/html-system/LIVE/`. Content-Type is `text/html`. No 404s on referenced sub-assets. STAGING and LIVE content hashes match.
- **Fail criteria:** Any file returns non-200, wrong content type, or STAGING/LIVE hash mismatch.
- **Codex validation target:** Script that curls all four LIVE URLs, checks status codes, downloads and SHA256-compares STAGING vs LIVE.
- **Manual validation target:** Open each URL in browser, check Network tab for errors.
- **Release decision:** HARD BLOCK. If R2 credentials are invalid, this gate cannot pass, and no deploy can proceed.

### Gate 3: Arena Route Health

- **Pass criteria:** Arena loads without JS errors. MMOS topbar renders. STAT button navigates to stat.html. Daily Rounds button opens menu (not drills directly).
- **Fail criteria:** JS errors block rendering, MMOS missing, navigation broken.
- **Codex validation target:** Headless browser test or manual verification script.
- **Manual validation target:** Load Arena in Chrome, click each mode, verify navigation.
- **Release decision:** HARD BLOCK.

### Gate 4: Daily-to-Drills Contract

- **Pass criteria:** Selecting a drill from Daily Rounds menu creates a valid contract and navigates to drills.html. Drills engine loads and plays the drill. Direct drills.html load without contract shows appropriate message.
- **Fail criteria:** Navigation fails, contract not created, drill does not play when launched correctly.
- **Codex validation target:** Manual or semi-automated browser test.
- **Manual validation target:** Walk through Daily Rounds flow, select drill, verify playback.
- **Release decision:** HARD BLOCK.

### Gate 5: STAT Gameplay

- **Pass criteria:** Create duel, play through questions, submit attempt, view result. Server-computed score matches expected. Player profile updated.
- **Fail criteria:** Any RPC fails, scoring mismatch, profile not updated.
- **Codex validation target:** End-to-end bot duel test via RPC calls.
- **Manual validation target:** Play a bot duel in browser, verify complete flow.
- **Release decision:** HARD BLOCK.

### Gate 6: E3 Outbox Internal Canary

- **Pass criteria:** With `?e3_outbox=1`, gameplay is identical to normal mode. Telemetry events queue in IndexedDB. Flush drains queue without errors. Without the flag, zero outbox behavior.
- **Fail criteria:** Outbox crashes STAT, interferes with gameplay, leaks when flag is off, or flush fails.
- **Codex validation target:** Browser test with flag on and off. IndexedDB inspection. Network tab verification of flush.
- **Manual validation target:** Play duels with and without flag, compare behavior.
- **Release decision:** SOFT BLOCK for outbox feature. HARD BLOCK if outbox flag leak causes normal-mode regression.

### Gate 7: Replay/Avatar Bridge Readiness

- **Pass criteria:** This gate is NOT expected to pass yet. It tracks future work. Pass requires: avatar data propagates correctly into STAT duel context, `match_players` snapshot captures avatar_url, replay system (if implemented) can reconstruct match state.
- **Fail criteria:** Avatar data missing from match context, snapshot not recording.
- **Codex validation target:** FUTURE. Not currently scoped.
- **Manual validation target:** FUTURE.
- **Release decision:** NOT a release blocker for current scope. Informational gate for E3 roadmap.

### Gate 8: Gold Stable Build Lock

- **Pass criteria:** Gates 1-5 pass. Gate 6 passes (no normal-mode regression). GitHub commit is tagged. LIVE CDN content matches tagged commit. Rollback verified against previous stable build.
- **Fail criteria:** Any hard-block gate fails, or rollback test fails.
- **Codex validation target:** Full pipeline run: deploy from tagged commit, validate, rollback to previous tag, validate, re-deploy.
- **Manual validation target:** Verify tagged commit hash, spot-check LIVE content.
- **Release decision:** Gold Stable Build requires ALL hard-block gates passing and rollback verification.

---

## SECTION 5 -- INCIDENT RESPONSE RUNBOOKS

### Runbook 1: Arena Stuck on "Connecting"

- **Symptoms:** Arena page loads but shows a "Connecting" or spinner state indefinitely. No gameplay UI renders.
- **Likely cause:** Auth exchange or bootstrap is failing silently. Railway may be down. Supabase session not established. Or a JS error in the auth initialization path is swallowed.
- **First diagnostic:** Open browser console. Check Network tab for `/api/auth/exchange` response. If 502, Railway is down. If 401, WordPress session expired. If no request at all, JS error before auth code runs.
- **What NOT to do:** Do not bypass auth. Do not hardcode Supabase tokens. Do not remove the exchange/bootstrap flow. Do not switch to `wp-json` identity.
- **Safest next Codex prompt focus:** "Diagnose Arena auth initialization path. Read arena.html auth flow. Check Railway `/api/auth/exchange` endpoint health. Report exact error without modifying auth architecture."

### Runbook 2: STAT Click Does Nothing

- **Symptoms:** User clicks STAT mode card in Arena, nothing happens. No navigation.
- **Likely cause:** MMOS routing broken. The STAT button's click handler or `MMOS.registerMode` configuration is wrong. Or stat.html URL is incorrect/404.
- **First diagnostic:** Browser console, check for JS errors on click. Check if `MMOS.registerMode` was called for STAT. Check Network tab for stat.html load attempt. `curl -I` the stat.html CDN URL.
- **What NOT to do:** Do not remove MMOS to "fix" routing. Do not hardcode direct navigation bypassing MMOS.
- **Safest next Codex prompt focus:** "Audit MMOS.registerMode calls in arena.html. Verify STAT mode registration and navigation handler. Verify stat.html CDN URL returns 200. Report findings without modifying MMOS architecture."

### Runbook 3: Daily Rounds Bypasses Menu

- **Symptoms:** Clicking Daily Rounds in Arena goes directly to drills.html instead of showing the category/drill selection menu.
- **Likely cause:** Daily Rounds navigation handler is pointing directly to drills.html instead of daily.html. Or daily.html is broken and falls through to drills.
- **First diagnostic:** Check Arena click handler for Daily Rounds button. Verify it targets daily.html, not drills.html. Load daily.html directly and verify menu renders.
- **What NOT to do:** Do not point Daily Rounds directly at drills.html as a "fix." The menu is a required step in the contract.
- **Safest next Codex prompt focus:** "Audit Daily Rounds navigation target in arena.html. Verify daily.html loads and renders category menu. Verify drill selection creates a valid contract before navigating to drills.html."

### Runbook 4: Drills Says "No Valid Drill Contract"

- **Symptoms:** User arrives at drills.html and sees "No valid drill contract" message.
- **Likely cause:** If user navigated directly to drills.html (no contract), this is EXPECTED. If user came from Daily Rounds menu, the contract was not created or not passed correctly.
- **First diagnostic:** Check how the user arrived. If from Daily Rounds, check the navigation URL for `mm_selected_drill` or `query.video_id` parameters. Check daily.html contract creation code.
- **What NOT to do:** Do not remove the contract check from drills.html. Do not make drills.html load without a contract. The contract requirement is a safety mechanism.
- **Safest next Codex prompt focus:** "Audit daily.html drill selection flow. Verify that selecting a drill creates a valid contract (mm_selected_drill or query.video_id) and passes it to drills.html navigation. Do not modify the contract validation in drills.html."

### Runbook 5: Auth Exchange/Bootstrap Returns 502

- **Symptoms:** `/api/auth/exchange` or `/api/auth/bootstrap` returns HTTP 502.
- **Likely cause:** Railway server is down or crashed. The `server.mjs` process is not running. Or Railway deployment failed.
- **First diagnostic:** Check Railway dashboard for deployment status. Check Railway logs for crash/error. Verify `server.mjs` is the correct entrypoint (should be `node missionmed-hq/server.mjs` per recent Railway config). Check if Railway has valid environment variables for WP and Supabase credentials.
- **What NOT to do:** Do not attempt to bypass Railway by calling Supabase auth directly from the frontend. Do not expose Supabase service_role key. Do not create an alternative auth path.
- **Safest next Codex prompt focus:** "Diagnose Railway server health. Check deployment logs. Verify server.mjs entrypoint and environment variables are correctly configured. Report status without modifying auth endpoints."

### Runbook 6: R2 Assets Return 404

- **Symptoms:** CDN URLs for LIVE HTML files or shared assets return 404.
- **Likely cause:** R2 objects do not exist at the expected keys. Either: deploy never ran successfully, deploy wrote to wrong keys, R2 credentials were wrong during deploy, or Cloudflare custom domain is misconfigured.
- **First diagnostic:** `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html`. If 404, try the STAGING path. If STAGING also 404, the objects were never uploaded. Check `_SYSTEM_LOGS/` for the most recent deploy or mirror log. Check for R2 credential errors.
- **What NOT to do:** Do not manually upload files via FileZilla or Cloudflare dashboard (bypasses git gate). Do not switch to legacy paths as a "fix." Do not change the CDN base URL.
- **Safest next Codex prompt focus:** "Verify R2 credentials are valid by running a non-destructive signed write test. If credentials fail, STOP and report. If credentials work, verify object existence at html-system/LIVE/ keys using signed HEAD requests. Report exact HTTP status codes for each file."

### Runbook 7: E3 Outbox Queue Does Not Drain

- **Symptoms:** With `?e3_outbox=1` enabled, IndexedDB shows queued events, but flush does not reduce the queue.
- **Likely cause:** Backend endpoint for telemetry ingestion is down, returns errors, or the duel/match contract expected by the backend does not match what the frontend is sending (schema mismatch, missing FK parent, etc.).
- **First diagnostic:** Open Network tab, trigger flush, check the outgoing request and response. Look for 409 (conflict), 400 (bad request), or 500 errors. Check if the backend expects a `duels` FK parent that does not exist (the bridge issue from MR-E3-BACKEND-CONTRACT-REPAIR-025).
- **What NOT to do:** Do not enable outbox default ON to "test harder." Do not bypass the feature flag. Do not modify the outbox to silently discard failed events.
- **Safest next Codex prompt focus:** "Diagnose E3 outbox flush failure. Check backend telemetry endpoint response codes. Verify duel/match ID contract between frontend outbox payload and backend RPC expectations. Report exact error payloads."

### Runbook 8: Supabase RPC Returns 409/400

- **Symptoms:** A Supabase RPC call (create_duel, submit_attempt, etc.) returns 409 (Conflict) or 400 (Bad Request).
- **Likely cause:** 409 usually means idempotency key collision (duplicate request) or state transition violation (monotonic trigger rejected it). 400 usually means malformed parameters or missing required fields.
- **First diagnostic:** Read the full error response body. For 409, check if the same idempotency_key was used twice (expected behavior for retries). For state violations, check current duel state. For 400, check RPC parameter names and types against the function signature.
- **What NOT to do:** Do not remove idempotency constraints. Do not weaken the state machine trigger. Do not retry the same failing call in a loop (MR-079 G-6).
- **Safest next Codex prompt focus:** "Audit the failing RPC call. Read the RPC function definition. Compare expected parameters and state preconditions against what the frontend is sending. Report the mismatch without modifying RPC definitions or constraints."

### Runbook 9: CDN LIVE/STAGING Mismatch

- **Symptoms:** STAGING content differs from LIVE content (different SHA256 hashes for the same file).
- **Likely cause:** A deploy was interrupted between the STAGING upload and the LIVE promotion. Or a subsequent STAGING upload happened without promotion. Or STAGING was manually modified.
- **First diagnostic:** Download both STAGING and LIVE versions. `diff` them. Check `_SYSTEM_LOGS/` for the most recent deploy log. Check if deploy.sh completed all 5 steps.
- **What NOT to do:** Do not manually overwrite LIVE from STAGING outside deploy.sh. Do not assume STAGING is newer/correct without checking git.
- **Safest next Codex prompt focus:** "Compare STAGING and LIVE content for all four HTML files. Download via CDN, compute SHA256 hashes. Check git log for most recent deploy commit. Determine which version matches the git HEAD. Report without modifying CDN objects."

### Runbook 10: Bad Deploy Rollback

- **Symptoms:** A deployment introduced a regression. Need to revert to the previous stable state.
- **Likely cause:** Code change broke something that validation did not catch.
- **First diagnostic:** Identify the commit that was deployed. Check `CHANGELOG/CHANGELOG.md` for the rollback hash. Verify the rollback target commit is known and accessible.
- **What NOT to do:** Do not manually edit LIVE HTML files on the CDN. Do not panic-deploy a "fix" without going through the full pipeline. Do not skip validation on the rollback.
- **Recovery steps:** Run `_SYSTEM/rollback.sh --target <known_good_commit_hash>`. The script will: create a backup of current LIVE, restore LIVE from the target commit, validate, deploy with git gate bypass, and validate LIVE post-deploy. Confirm rollback by running the QA checklist (Section 3) against the restored build.

---

## SECTION 6 -- R2 / CDN CREDENTIAL RUNBOOK

### Required Cloudflare/R2 Permissions

- The R2 API token must have `Object Read` and `Object Write` permissions on the `missionmed-videos` bucket.
- If using S3-compatible API (which the scripts do), the token must be an R2 API token (not a Cloudflare API token). These are different. R2 API tokens generate an Access Key ID and Secret Access Key pair for S3-compatible access.
- For cache purge (optional), a separate Cloudflare API token with `Zone > Cache Purge` permission is needed, plus the Zone ID.

### Required Local Environment Variable Names

```
R2_ACCESS_KEY_ID=<from Cloudflare R2 API token>
R2_SECRET_ACCESS_KEY=<from Cloudflare R2 API token>
R2_BUCKET=missionmed-videos
R2_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_REGION=auto
R2_CDN_BASE_URL=https://cdn.missionmedinstitute.com

# Optional, for cache purge:
CLOUDFLARE_API_TOKEN=<Cloudflare API token with Cache Purge permission>
CLOUDFLARE_ZONE_ID=<Zone ID for missionmedinstitute.com>
```

### What Must Never Be Committed

- `_SYSTEM/r2.env` (contains actual credentials; already in `.gitignore`)
- `cloudflare key.txt` (legacy credential file; should also be gitignored)
- Any file containing `R2_SECRET_ACCESS_KEY` or `CLOUDFLARE_API_TOKEN` values
- The `.env` file in `UPLOAD ENGINE_Arena+Drills+Mode_HTML/`

### How to Test Non-Destructive Write

```bash
# Create a small test file
echo "r2-write-test $(date -u +%Y%m%dT%H%M%SZ)" > /tmp/r2_test.txt

# Upload to a safe test key (not overwriting any real object)
curl --silent --show-error --fail --max-time 60 \
  --aws-sigv4 "aws:amz:auto:s3" \
  --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
  --request PUT \
  --header "Content-Type: text/plain; charset=utf-8" \
  --upload-file /tmp/r2_test.txt \
  "${R2_ENDPOINT_URL}/${R2_BUCKET}/html-system/LIVE/_r2_write_test/test.txt" \
  --output /dev/null \
  --write-out "HTTP %{http_code}\n"

# Expected: HTTP 200
# If 403 (SignatureDoesNotMatch): credentials are wrong or lack write permission
# If 403 (AccessDenied): token does not have permission for this bucket
```

### How to Mirror Assets into LIVE

Use the existing `_SYSTEM/mirror_live_assets.sh` script. It:
1. Loads credentials from `_SYSTEM/r2.env`
2. Checks all source objects exist on public CDN
3. Runs the non-destructive signed write test
4. Copies each source object to its `html-system/LIVE/` equivalent using S3 COPY
5. Verifies each copy via public GET (status code + size match)
6. Writes a detailed log to `_SYSTEM_LOGS/`

Run: `bash _SYSTEM/mirror_live_assets.sh`

### How to Verify 200 vs 404

```bash
# Check public CDN availability
curl -I "https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html"
# Look for: HTTP/2 200

# Check with signed request (verifies object exists in R2 bucket)
curl --silent --show-error --max-time 30 \
  --aws-sigv4 "aws:amz:auto:s3" \
  --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
  --header "Range: bytes=0-0" \
  --output /dev/null \
  --write-out "HTTP %{http_code}\n" \
  "${R2_ENDPOINT_URL}/${R2_BUCKET}/html-system/LIVE/arena.html"
# 200/206/416 = exists. 404 = missing.
```

### How to Handle Spaces/Special Characters in Keys

R2 object keys with spaces or special characters (e.g., `Mode_Lobby_Imagecard_STAT!_Duels.JPG`) must be URL-encoded in HTTP requests. The mirror script uses `%20` for spaces and `%21` for `!` in the SOURCES array. When constructing curl commands manually:
- Space = `%20`
- `!` = `%21`
- Do NOT use `+` for spaces (S3-compatible APIs treat `+` literally)

### What to Do If SignatureDoesNotMatch Occurs

1. STOP. Do not retry with the same credentials.
2. Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are copied correctly (no trailing whitespace, no newlines).
3. Verify `R2_ENDPOINT_URL` matches the Cloudflare account that owns the R2 token.
4. Verify the R2 API token has not been revoked or rotated in the Cloudflare dashboard.
5. If all above check out, create a NEW R2 API token in Cloudflare dashboard with explicit Object Read + Write on `missionmed-videos` bucket.
6. Update `_SYSTEM/r2.env` with the new credentials. Do not commit.
7. Re-run the non-destructive write test.
8. If it still fails: the account ID may be wrong, or the bucket name may be wrong. Verify in Cloudflare dashboard.

### What Codex Should and Should Not Do

**Codex MAY:**
- Read `_SYSTEM/r2.env.example` to understand expected variable names
- Run the non-destructive write test
- Run `mirror_live_assets.sh` if write test passes
- Run `deploy.sh` if all validation passes
- Read and report deploy/mirror logs

**Codex MUST NOT:**
- Create or modify R2 API tokens (requires Cloudflare dashboard)
- Hardcode credential values in any script or committed file
- Commit `_SYSTEM/r2.env` or any file containing secrets
- Bypass the signed write test and proceed to deploy assuming credentials work
- Modify R2 bucket settings, custom domain configuration, or CORS rules

---

## SECTION 7 -- E3 STAT ROADMAP

### Phase 1: Backend DB Contract Repair

- **Prerequisites:** Valid Supabase RANKLISTIQ credentials. MR-079 guardrails loaded.
- **Success criteria:** Migration `20260427044500_e3_backend_contract_repair.sql` confirmed applied. `submit_attempt` accepts `active` bot-duel progression. `private_e3_ensure_match_attempt` bridges `duel_challenges` IDs into legacy `duels` FK parent when required. Validation harness passes all checks (create_duel, submit_attempt, telemetry, complete_match, idempotency).
- **Rollback trigger:** Migration fails to apply cleanly, or validation harness reports failures.
- **Feature flag state:** `e3_outbox` remains default OFF. No change.
- **Codex task type:** Database migration + validation. HIGH risk per MR-079.

### Phase 2: Outbox Real Browser Canary

- **Prerequisites:** Phase 1 complete. R2 credentials valid (so LIVE stat.html can be deployed with any needed fixes).
- **Success criteria:** A real human plays a complete bot duel in a real browser with `?e3_outbox=1`. Telemetry events queue in IndexedDB. Flush drains all events to backend without errors. Backend RPCs return 200. No gameplay regression compared to flag-off mode.
- **Rollback trigger:** Any gameplay regression, flush failure, or backend RPC error.
- **Feature flag state:** `e3_outbox` remains default OFF. Canary uses URL parameter only.
- **Codex task type:** Testing + frontend fix (if needed). MEDIUM risk.

### Phase 3: Outbox Internal-Only Rollout

- **Prerequisites:** Phase 2 canary passed. At least 5 successful duel completions with outbox enabled without errors.
- **Success criteria:** Internal team uses `?e3_outbox=1` for all STAT sessions for a defined period (e.g., 1 week). Zero flush failures. Zero gameplay regressions. Backend telemetry data is accurate and complete.
- **Rollback trigger:** Any flush failure, data integrity issue, or gameplay regression reported by internal users.
- **Feature flag state:** `e3_outbox` remains default OFF. Internal team uses URL parameter.
- **Codex task type:** Monitoring + fix (if needed). LOW-MEDIUM risk.

### Phase 4: Replay/Avatar Bridge Planning

- **Prerequisites:** Phase 3 stable. Avatar persistence and propagation confirmed working (QA checklist G and H).
- **Success criteria:** Design document exists specifying: how avatar data flows into STAT duel context, how `match_players` snapshot is used for replay, what data is needed to reconstruct a match for replay, and what frontend changes are required.
- **Rollback trigger:** N/A (planning phase).
- **Feature flag state:** No change.
- **Codex task type:** Planning + documentation. LOW risk.

### Phase 5: Replay/Avatar Bridge Canary

- **Prerequisites:** Phase 4 design approved. Implementation built behind a separate feature flag.
- **Success criteria:** Avatar data correctly propagates into STAT duel context. `match_players` captures `avatar_url` at match start. Replay can reconstruct match state from stored data. Separate feature flag controls replay functionality.
- **Rollback trigger:** Avatar propagation fails, snapshot not recording, or replay reconstruction produces incorrect state.
- **Feature flag state:** `e3_outbox` default OFF. New replay feature flag default OFF.
- **Codex task type:** Implementation + testing. HIGH risk.

### Phase 6: Optional Broader Rollout

- **Prerequisites:** Phases 1-3 stable for sustained period. Phase 5 canary passed (if replay is in scope). Operator approval.
- **Success criteria:** `e3_outbox` default changed to ON. All users generate telemetry. No increase in error rates. Backend handles load.
- **Rollback trigger:** Error rate increase, performance degradation, or data integrity issues at scale.
- **Feature flag state:** `e3_outbox` default ON. Flag remains available for emergency disable.
- **Codex task type:** Configuration change + monitoring. MEDIUM risk.

### Phase 7: Deterministic Bootstrap Decision

- **Prerequisites:** Phase 6 stable. Data collected on whether non-deterministic factors in duel creation cause issues.
- **Success criteria:** Decision made: either deterministic bootstrap is needed (and implemented), or it is confirmed unnecessary based on production data.
- **Rollback trigger:** N/A (decision point).
- **Feature flag state:** No change unless implementation is required.
- **Codex task type:** Analysis + decision. LOW risk.

---

## SECTION 8 -- CODEX PROMPT QUEUE

| Priority | Prompt ID | Purpose | Branch | Reasoning | Scope | Blocked By | Success Criteria |
|----------|-----------|---------|--------|-----------|-------|------------|------------------|
| P0 | MR-R2-CREDENTIAL-RESOLUTION-029 | Validate new R2 credentials and confirm non-destructive write test passes | main | HIGH | Infrastructure: credential validation only, no runtime changes | Operator must provision new R2 API token in Cloudflare dashboard first | Signed write test returns 200. Signed read-back returns 200/206. |
| P1 | MR-R2-ASSET-MIRROR-030 | Run mirror_live_assets.sh to copy legacy assets into html-system/LIVE/ paths | main | HIGH | CDN: asset mirroring, no HTML changes | MR-R2-CREDENTIAL-RESOLUTION-029 | All SOURCES in mirror script return PASS. 0/N failures. Log confirms FINAL=PASS. |
| P1 | MR-E3-BACKEND-CONFIRM-031 | Confirm E3 backend contract repair migration is applied to RANKLISTIQ | main | HIGH | Database: read-only verification, no new migrations | None | `supabase migration list` shows 20260427044500 as applied. Validation harness passes. |
| P2 | MR-CDN-PREFIX-NORMALIZATION-032 | After asset mirroring, verify all LIVE HTML files reference html-system/LIVE/ asset paths (not legacy) | main | MEDIUM | Frontend: audit + targeted path fixes if needed | MR-R2-ASSET-MIRROR-030 | Zero 404s in browser Network tab when loading any LIVE HTML file. |
| P2 | MR-E3-OUTBOX-REAL-CANARY-033 | Run real browser gameplay canary with ?e3_outbox=1 | main | MEDIUM | Testing: play a bot duel, verify outbox queue + flush | MR-E3-BACKEND-CONFIRM-031 | Complete bot duel with outbox. Queue drains. No errors. No gameplay regression. |
| P3 | MR-REPLAY-AVATAR-BRIDGE-DESIGN-034 | Design document for replay/avatar bridge | main | LOW | Planning: document only, no code | MR-E3-OUTBOX-REAL-CANARY-033 | Design document written, reviewed, and filed. |
| P3 | MR-GOLD-STABLE-BUILD-LOCK-035 | Tag a Gold Stable Build after all P0-P2 items pass | main | HIGH | Release: git tag + full QA pass + rollback verification | All P0-P2 items | Git tag created. Full QA checklist (Section 3) passes. Rollback to previous build verified. Re-deploy to Gold tag verified. |

---

## SECTION 9 -- RED-TEAM FINDINGS

### Finding 1: R2 Credentials Are a Single Point of Failure

- **Risk:** If R2 credentials are invalid, ALL deploys, mirrors, and rollbacks that touch CDN are blocked. The entire production pipeline stops.
- **Severity:** CRITICAL
- **Current state:** Credentials are invalid (403 on signed write). This is actively blocking progress.
- **Mitigation:** Operator must provision new credentials from Cloudflare dashboard. Store in `_SYSTEM/r2.env` (gitignored). Consider documenting a second operator who can access the Cloudflare account if the primary is unavailable. The deploy script already has a fallback chain (env vars, r2.env, cloudflare key.txt), which is good.

### Finding 2: Operator Confusion Between Legacy and LIVE Paths

- **Risk:** The repo still contains `arena_v1.html`, `drills_v1.html`, `stat_latest.html`, `mode_dailyrounds_v1.html` in the LIVE directory alongside the canonical files. An operator or Codex could accidentally reference or deploy from legacy files.
- **Severity:** HIGH
- **Mitigation:** Legacy files should remain for rollback compatibility (rollback.sh reconstructs from them) but should be clearly documented as archive-only. Consider adding a `LEGACY_DO_NOT_DEPLOY.md` marker file in the LIVE directory. The deploy manifest only references the four canonical files, which provides a safety net.

### Finding 3: Codex Could Accidentally Overreach on Database

- **Risk:** Codex prompts that touch the data layer could accidentally modify production Supabase data, drop tables, or run repair commands. MR-079 guardrails exist but depend on Codex actually reading and following them.
- **Severity:** HIGH
- **Mitigation:** Every Codex prompt that touches data must include the MR-079 preamble. The guardrails document defines a whitelist/blacklist and STOP protocol. The risk is highest when Codex encounters an error and tries to "fix" it with increasingly destructive commands. The failure handling decision tree (MR-079 Section 7) is the key defense.

### Finding 4: Claude Could Over-Design Solutions

- **Risk:** Claude (this system) could propose broad rewrites, new architectures, or "improvements" that conflict with the locked system contracts. The operator could then feed these into Codex prompts.
- **Severity:** MEDIUM
- **Mitigation:** This prompt explicitly forbids design proposals. Future prompts should maintain the same constraint: Claude produces plans and audits, Codex executes scoped changes, neither redesigns working systems.

### Finding 5: Manual FileZilla Steps Are Dangerous

- **Risk:** If the operator uses FileZilla (or Cloudflare R2 dashboard) to manually upload files to the CDN, the git gate is bypassed. The CDN state diverges from the git state. deploy.sh would later overwrite the manual change, or the manual change would persist while git shows something different.
- **Severity:** HIGH
- **Mitigation:** Rule 4 in Section 2 (no manual CDN overwrite) addresses this. The deploy pipeline is the only authorized write path. If FileZilla is the only available tool (e.g., during an emergency and deploy.sh is broken), the operator MUST immediately commit the same content to git and document the manual override in the changelog. This should be a last-resort exception, not a workflow.

### Finding 6: KNOWLEDGE_INDEX.md Missing from Canonical Path

- **Risk:** PRIMER_CORE pre-flight check requires `08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`. This file does not exist at that path. Strict adherence to PRIMER_CORE would block every task.
- **Severity:** MEDIUM
- **Mitigation:** Either restore KNOWLEDGE_INDEX.md from the backup copy to its canonical path, or update PRIMER_CORE to reference the actual location. This is a documentation/structure issue, not a runtime issue.

### Finding 7: Environment Credentials Scattered Across Multiple Files

- **Risk:** R2 credentials exist in at least two locations (`_SYSTEM/r2.env` and `UPLOAD ENGINE_Arena+Drills+Mode_HTML/.env`). If one is updated and the other is not, different tools use different (possibly invalid) credentials.
- **Severity:** MEDIUM
- **Mitigation:** Consolidate to `_SYSTEM/r2.env` as the single source. deploy.sh already prefers this. mirror_live_assets.sh already uses this. The UPLOAD ENGINE `.env` should be deprecated in favor of the shared location, or both should source from the same file.

### Finding 8: No Automated Monitoring or Alerting

- **Risk:** If CDN starts returning 404s, or Railway goes down, or Supabase RLS breaks, there is no automated detection. The operator discovers issues only when a user reports them or when manually checking.
- **Severity:** MEDIUM (for current scale)
- **Mitigation:** For the current scale (pre-broad-release), manual QA is acceptable. Before broad release to paying students, consider adding: a simple uptime check (curl the four LIVE URLs every 5 minutes), a health endpoint on Railway, and Supabase dashboard alerts for RPC error rate spikes.

### Finding 9: Rollback Script Depends on R2 Credentials

- **Risk:** rollback.sh calls deploy.sh, which requires valid R2 credentials. If credentials are invalid (as they are now), rollback cannot execute.
- **Severity:** HIGH
- **Mitigation:** The rollback script restores local `/LIVE/` files from git and then deploys them. If R2 credentials are invalid, the local restore succeeds but the CDN deploy fails. In this scenario, the operator would need to fix credentials before the rollback reaches CDN. This is a compound failure mode: bad deploy + bad credentials = stuck. Mitigation: always validate R2 credentials proactively, before they are needed for an emergency.

---

## SECTION 10 -- FINAL GOLD STABLE BUILD CRITERIA

A Gold Stable Build can be declared when ALL of the following are true:

1. **GitHub commit/tag:** A specific commit on main is tagged (e.g., `gold-stable-v1.0`). The tag is pushed to origin.

2. **CDN LIVE checksum parity:** SHA256 of each LIVE HTML file downloaded from CDN matches SHA256 of the same file at the tagged commit in git.

3. **STAGING/LIVE parity:** SHA256 of each STAGING HTML file on CDN matches its LIVE counterpart. No orphaned STAGING content from interrupted deploys.

4. **Auth pass:** QA checklist Section B items B1-B4 all pass. Exchange returns 200, bootstrap returns tokens, getUser returns user, RLS query succeeds.

5. **Arena pass:** QA checklist Section A items A1-A7 all pass. MMOS present, no security violations, navigation works.

6. **Daily/Drills pass:** QA checklist Sections C and D pass. Menu renders, contract creation works, drill plays.

7. **STAT pass:** QA checklist Section E items E1-E6 all pass. Duel creation, gameplay, scoring, and results all work.

8. **Avatar pass:** QA checklist Section G items G1-G4 pass. Avatar persistence confirmed.

9. **E3 outbox decision:** Either: (a) outbox canary has passed and outbox is stable at default OFF (acceptable for Gold Stable), or (b) outbox code has been confirmed to cause zero regression when flag is off (acceptable for Gold Stable). The outbox does NOT need to be default ON for Gold Stable.

10. **Rollback verified:** Rollback to the previous known-good commit has been tested end-to-end: rollback.sh runs, deploy succeeds, QA checklist passes on rolled-back build. Then re-deploy to the Gold Stable tag and verify again.

11. **No open P0 blockers:** All Priority 0 items from the Codex Prompt Queue (Section 8) are resolved.

12. **Changelog entry:** Gold Stable Build is documented in `CHANGELOG/CHANGELOG.md` with the tag, commit hash, date, and the full list of gates that passed.

---

## SECTION 11 -- EXECUTIVE SUMMARY FOR FUTURE THREADS

```
MISSIONMED ARENA SYSTEM BRIEFING (paste into any new thread)
Date: 2026-04-27 | Authority: MR-CLAUDE-PRODUCTION-HARDENING-MEGARUN-028

ARCHITECTURE:
- MissionMed Arena is a browser-based medical education platform.
- Runtime HTML: arena.html, stat.html, drills.html, daily.html
- Served from Cloudflare R2 CDN at: https://cdn.missionmedinstitute.com/html-system/LIVE/
- Source of truth: GitHub main branch, /LIVE/ directory
- Auth: WordPress -> Railway exchange/bootstrap -> Supabase session (RLS-enforced)
- Supabase project (Arena/STAT): fglyvdykwgbuivikqoah (RANKLISTIQ)
- Supabase project (HQ/CRM): plgndqcplokwiuimwhzh (GROWTH ENGINE)
- MMOS topbar required in arena.html, stat.html, drills.html. NOT in daily.html.

DEPLOY PIPELINE:
- Local validate -> git gate -> STAGING upload -> STAGING validate -> promote LIVE -> cache purge -> LIVE validate
- Scripts: _SYSTEM/deploy.sh, _SYSTEM/rollback.sh, VALIDATION/validate_deploy.sh, VALIDATION/validate_runtime.sh
- Manifest: _SYSTEM/DEPLOY_MANIFEST.json

ACTIVE STANDARDS (LOCKED):
- MR-078B: Data Flow Contract (8 invariants, write authority matrix, read rules)
- MR-079: Codex Execution Guardrails (whitelist/blacklist, STOP protocol, no-touch boundaries)
- MM-AUTH-ARCH-001: Auth architecture spec
- MR-078A: Supabase Migration Protocol

FORBIDDEN ACTIONS:
- No frontend service_role key
- No supabase.auth.signUp() in frontend
- No wp-json identity as source of truth
- No manual CDN overwrites bypassing git
- No legacy runtime paths (arena_v1.html, etc.) for production routing
- No MMOS removal from arena/stat/drills
- No outbox default ON until canary passes
- No direct table writes to duel_challenges, duel_attempts, player_profiles, dataset_questions
- No modification of duel_state_monotonic_fn trigger
- No answer_map access before finalization

CURRENT BLOCKERS:
- R2 write credentials invalid (403 on signed write). Blocks all CDN deploys.
- E3 backend contract repair migration: applied status UNKNOWN.
- E3 outbox real gameplay canary: not yet passed.
- KNOWLEDGE_INDEX.md missing from canonical path.

HOW TO AVOID BREAKING THE SYSTEM:
1. Read _SYSTEM/CODEX_EXECUTION_GUARDRAILS.md before any data/migration work.
2. Read _SYSTEM/DATA_FLOW_CONTRACT.md before any data layer changes.
3. Never run commands not on the MR-079 whitelist.
4. Always deploy through deploy.sh. Never manually write to R2.
5. STAGING before LIVE. Always.
6. Backup before every destructive operation.
7. If a command fails, STOP. Do not retry without understanding why.
8. When in doubt, do a read-only diagnostic first.
```

---

## SECTION 12 -- FINAL RECOMMENDATION

### What to Do Next

1. **Fix R2 credentials immediately.** This is the single highest-priority blocker. Go to the Cloudflare dashboard, create a new R2 API token with Object Read + Write on the `missionmed-videos` bucket, update `_SYSTEM/r2.env`, and run the non-destructive write test. Until this is done, no CDN deployment or rollback is possible.

2. **Confirm E3 backend contract repair migration status.** Run `supabase migration list` against RANKLISTIQ to verify `20260427044500` is applied. If not applied, apply it following MR-078A protocol.

3. **Run the full QA checklist (Section 3) against the current live CDN state.** This establishes the baseline. Document what passes and what fails.

4. **After R2 credentials are valid, run the asset mirror.** This unblocks the 404 issue for shared assets in `html-system/LIVE/` paths.

5. **After items 1-4, run the E3 outbox real gameplay canary.** One complete bot duel with `?e3_outbox=1` in a real browser.

### What NOT to Do Next

1. Do not attempt to deploy anything to CDN before R2 credentials are fixed.
2. Do not enable E3 outbox default ON. It stays OFF until the canary passes.
3. Do not redesign the auth architecture, MMOS integration, or deploy pipeline. They work. Focus on unblocking the credential issue and validating what exists.
4. Do not send Codex on broad refactoring tasks. Keep prompts scoped to one objective.
5. Do not manually upload files to R2 via FileZilla or dashboard.

### Is the Current System Ready for Paying Students?

**NO.** Not yet. Specific reasons:

- R2 credentials are invalid. The deploy and rollback pipelines are non-functional for CDN operations. If something breaks in production, rollback cannot execute. This is an unacceptable risk for paying students.
- The current LIVE CDN state has not been QA-validated against the full checklist. It is UNKNOWN whether all four files are serving correctly, whether auth works end-to-end, and whether shared assets are available at LIVE paths.
- E3 outbox is unfinished. While it is behind a feature flag and should not affect normal operation, the backend contract issues it exposed suggest underlying data layer fragility that needs resolution before student-facing use.
- No automated monitoring exists. For paying students, there must be at minimum a basic uptime check.

### What Must Happen Before Broad Release

1. R2 credentials fixed and non-destructive write test passing.
2. Full QA checklist (Section 3) passing with documented results.
3. All Release Gates 1-5 (Section 4) confirmed passing.
4. At least one successful deploy + rollback cycle through the full pipeline.
5. Gold Stable Build tagged, verified, and documented.
6. Basic uptime monitoring in place (even a simple cron curl check).
7. At least one person besides the operator knows how to execute a rollback.

---

END OF MISSIONMED_PRODUCTION_HARDENING_HANDOFF_PACK
