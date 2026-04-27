# MISSIONMED_STUDENT_LIVE_RELEASE_MANUAL_V1

**Prompt ID:** MR-CLAUDE-STUDENT-LIVE-RELEASE-MANUAL-029
**Date:** 2026-04-27
**Authority:** Operator Release Control Document
**Risk Level:** HIGH
**Status:** ACTIVE REFERENCE -- does not execute changes
**Depends On:** MISSIONMED_PRODUCTION_HARDENING_HANDOFF_PACK (MR-028), MR-078B, MR-079, MM-AUTH-ARCH-001

---

## SECTION 1 -- RELEASE STATUS SUMMARY

### Production-Ready (Core Arena Without E3)

- Deploy pipeline is scripted and tested (`_SYSTEM/deploy.sh`). Five-stage process with git gate, validation, and auto-backup.
- Rollback pipeline is scripted (`_SYSTEM/rollback.sh`). Restores from any prior commit, validates, redeploys with git gate bypass.
- Auth architecture is locked and documented. WordPress to Railway exchange/bootstrap to Supabase session to RLS queries.
- MMOS topbar integration is present in arena.html, stat.html, drills.html. daily.html is correctly exempt.
- Data flow contract (MR-078B) and Codex guardrails (MR-079) are locked. Eight invariants enforced.
- CDN base URL locked: `https://cdn.missionmedinstitute.com/html-system/LIVE/`
- Four canonical runtime files: arena.html, stat.html, drills.html, daily.html.
- Changelog, backup, and recovery infrastructure in place.

### Internal-Only (Do Not Expose to Students)

- E3 outbox telemetry: feature-flagged, default OFF. Requires `?e3_outbox=1` to activate. Backend contract issues still being resolved.
- Replay/avatar bridge: not implemented. No student-facing impact since it does not exist yet.
- Deterministic bootstrap: not enabled. Not approved for activation.

### Blocked

- **R2 write credentials are invalid.** Signed write test returns 403. No CDN deploy or rollback can execute until new credentials are provisioned. This is the single highest-priority blocker.
- **LIVE asset mirroring is blocked.** Shared assets (images, audio, data files) cannot be copied from legacy CDN paths to `html-system/LIVE/` paths until R2 credentials are fixed.
- **E3 backend contract repair migration:** Applied status to Supabase RANKLISTIQ is UNKNOWN.
- **E3 outbox real gameplay canary:** Has not passed. Backend/duel contract mismatch exposed during testing.

### Unknown

- Current LIVE CDN state: Whether all four HTML files are currently serving 200 from CDN has not been verified in this session. UNKNOWN.
- Whether shared assets (mode lobby images, audio, STAT data files) return 200 at `html-system/LIVE/` paths: UNKNOWN. Prior mirror attempts failed.
- Whether the last successful CDN deploy matches the current git HEAD: UNKNOWN.
- Railway server health: UNKNOWN in this session.

---

## SECTION 2 -- ABSOLUTE RELEASE BLOCKERS

If ANY of the following are true, **DO NOT RELEASE TO PAYING STUDENTS.**

### Blocker 1: Auth Exchange/Bootstrap Returns 502

- **Symptom:** Loading Arena shows "Connecting" indefinitely. Browser Network tab shows `/api/auth/exchange` returning 502.
- **System layer:** Railway server (server.mjs) is down or misconfigured.
- **Immediate action:** Check Railway dashboard for deployment status and logs. Verify entrypoint is `node missionmed-hq/server.mjs`. Verify environment variables are set.
- **Codex prompt focus:** "Diagnose Railway server health. Check deployment logs and entrypoint. Report status without modifying auth endpoints."

### Blocker 2: Arena Stuck on "Connecting"

- **Symptom:** Arena page loads but never transitions past connecting/loading state. No gameplay UI.
- **System layer:** Auth initialization in arena.html, or Railway, or Supabase session establishment.
- **Immediate action:** Open browser console. Check Network tab for exchange/bootstrap responses. Check for JS errors before auth code runs.
- **Codex prompt focus:** "Audit Arena auth initialization path in arena.html. Trace from page load to supabase.auth.setSession. Report exact failure point."

### Blocker 3: Daily Rounds Bypasses Menu

- **Symptom:** Clicking Daily Rounds in Arena goes directly to drills.html instead of showing the category/drill selection menu in daily.html.
- **System layer:** Arena navigation handler targeting wrong URL, or daily.html broken.
- **Immediate action:** Check Arena click handler for Daily Rounds. Verify it targets daily.html. Load daily.html directly to verify menu renders.
- **Codex prompt focus:** "Audit Daily Rounds navigation target in arena.html. Verify daily.html loads and renders category menu."

### Blocker 4: Drills Missing Valid Contract When Launched From Menu

- **Symptom:** User selects a drill from Daily Rounds menu, arrives at drills.html, sees "No valid drill contract." (Note: this message on direct drills.html load WITHOUT coming from menu is expected and NOT a blocker.)
- **System layer:** daily.html contract creation or navigation parameter passing.
- **Immediate action:** Check daily.html drill selection flow. Verify `mm_selected_drill` or `query.video_id` is being set and passed to drills.html.
- **Codex prompt focus:** "Audit daily.html drill selection and contract creation. Verify parameters are passed to drills.html navigation."

### Blocker 5: STAT Cannot Complete a Normal Duel

- **Symptom:** Any of: create_duel RPC fails, questions do not render, submit_attempt fails, result does not display, or player profile does not update after finalization.
- **System layer:** Supabase RANKLISTIQ RPCs, stat.html gameplay logic, or auth session.
- **Immediate action:** Open browser console during duel. Check each RPC call in Network tab. Identify which step fails.
- **Codex prompt focus:** "End-to-end STAT duel diagnostic. Create bot duel, play, submit, verify result. Report exact RPC failure if any."

### Blocker 6: E3 Outbox Default ON Before Approval

- **Symptom:** Loading stat.html WITHOUT `?e3_outbox=1` still shows outbox behavior (IndexedDB writes, flush attempts).
- **System layer:** Feature flag leak in stat.html.
- **Immediate action:** Load stat.html without any query parameters. Open Application > IndexedDB in DevTools. Verify no outbox database is created. Check console for outbox-related logs.
- **Codex prompt focus:** "Audit E3 outbox feature flag gate in stat.html. Verify default-OFF behavior. Confirm zero outbox activity without explicit flag."

### Blocker 7: CDN LIVE Runtime HTML Returns 404

- **Symptom:** `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` returns 404 (or any of the four files returns 404).
- **System layer:** R2 bucket objects missing, or Cloudflare custom domain misconfigured, or deploy never completed.
- **Immediate action:** Check all four LIVE URLs. Check deploy logs in `_SYSTEM_LOGS/`. Check R2 credentials.
- **Codex prompt focus:** "Verify R2 object existence for all four LIVE HTML files using signed HEAD requests. Report HTTP status codes."

### Blocker 8: GitHub / LIVE / CDN Mismatch

- **Symptom:** Content on CDN does not match the git HEAD commit. SHA256 of downloaded CDN file differs from SHA256 of local `/LIVE/` file at HEAD.
- **System layer:** Deploy pipeline interrupted, manual CDN overwrite, or git not pushed.
- **Immediate action:** Download all four LIVE files from CDN. Compare SHA256 against local `/LIVE/` files. Check `git log` for most recent deploy-related commit.
- **Codex prompt focus:** "Download LIVE HTML from CDN, compute SHA256, compare against git HEAD /LIVE/ files. Report any mismatches."

### Blocker 9: Missing Rollback Path

- **Symptom:** R2 credentials are invalid (signed write returns 403), meaning rollback.sh cannot push restored files to CDN. Or no prior commit with working LIVE files exists.
- **System layer:** Infrastructure (credentials) or git history.
- **Immediate action:** Test R2 credentials with non-destructive write. If they fail, provision new ones from Cloudflare dashboard before proceeding.
- **Codex prompt focus:** "Run non-destructive R2 signed write test. If fail, STOP and report. Do not attempt deploy or rollback."

### Blocker 10: MMOS / Topbar Missing

- **Symptom:** arena.html, stat.html, or drills.html loads but has no topbar. `window.MMOS` is undefined in console.
- **System layer:** MMOS integration removed or broken in the HTML file.
- **Immediate action:** Check page source for `window.MMOS`, `MMOS.registerMode`, and Topbar initialization. Compare against known-good version in git.
- **Codex prompt focus:** "Audit MMOS integration in arena.html, stat.html, drills.html. Verify window.MMOS, registerMode, and Topbar are present and functional."

---

## SECTION 3 -- STUDENT-LIVE GO/NO-GO CHECKLIST

Mark each item YES or NO. Any NO in a release-blocking item means NO-GO.

### A. Infrastructure

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| A1 | R2 write credentials valid | Run non-destructive signed write test (see Section 6 of hardening pack) | HTTP 200 on PUT, 200/206 on readback | [ ] | YES |
| A2 | CDN arena.html serves | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | HTTP 200, Content-Type: text/html | [ ] | YES |
| A3 | CDN stat.html serves | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | HTTP 200, Content-Type: text/html | [ ] | YES |
| A4 | CDN drills.html serves | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html` | HTTP 200, Content-Type: text/html | [ ] | YES |
| A5 | CDN daily.html serves | `curl -I https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | HTTP 200, Content-Type: text/html | [ ] | YES |
| A6 | STAGING/LIVE content match | Download STAGING and LIVE versions, SHA256 compare | Hashes match for all four files | [ ] | YES |
| A7 | Git HEAD matches LIVE CDN | SHA256 of local `/LIVE/` at HEAD matches CDN downloads | Hashes match | [ ] | YES |
| A8 | Rollback path functional | R2 credentials valid + prior stable commit exists in git | Both conditions true | [ ] | YES |

### B. Auth

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| B1 | Exchange works | Log into WordPress, load Arena, check Network for `/api/auth/exchange` | 200 with accessToken in response | [ ] | YES |
| B2 | Bootstrap works | After exchange, check `/api/auth/bootstrap` | 200 with access_token + refresh_token | [ ] | YES |
| B3 | Supabase session established | In console: `supabase.auth.getUser()` | Returns user object with UUID | [ ] | YES |
| B4 | RLS query works | In console: query player_profiles | Returns data scoped to current user | [ ] | YES |
| B5 | Unauthenticated handling | Load Arena without WordPress session | 401 from exchange, login prompt or redirect shown | [ ] | NO (expected) |

### C. Arena

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| C1 | Arena loads | Open arena.html CDN URL while authenticated | Page renders, no blocking JS errors | [ ] | YES |
| C2 | MMOS present | Console: `typeof window.MMOS` | "object" (not "undefined") | [ ] | YES |
| C3 | Topbar renders | Visual check | Topbar visible at top of page | [ ] | YES |
| C4 | No service_role in source | View page source, search "service_role" | Not found | [ ] | YES |
| C5 | No signUp in source | View page source, search "auth.signUp" | Not found | [ ] | YES |
| C6 | STAT navigation works | Click STAT mode button | Navigates to stat.html or loads STAT | [ ] | YES |
| C7 | Daily Rounds opens menu | Click Daily Rounds button | Opens daily.html with category menu (NOT drills directly) | [ ] | YES |

### D. Daily Rounds

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| D1 | Daily Rounds loads | Open daily.html CDN URL | Page renders, menu categories visible | [ ] | YES |
| D2 | Category menu populated | Visual check | At least one category with drills listed | [ ] | YES |
| D3 | Drill selection creates contract | Select a drill from menu | Navigates to drills.html with contract parameters in URL | [ ] | YES |

### E. Drills

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| E1 | Drills loads with contract | Arrive from Daily Rounds drill selection | Drill content loads and plays | [ ] | YES |
| E2 | MMOS present in drills | Console: `typeof window.MMOS` | "object" | [ ] | YES |
| E3 | Drill completes | Play through drill to end | Results/completion shown | [ ] | YES |
| E4 | Direct load without contract | Load drills.html directly (no query params) | "No valid drill contract" message | [ ] | NO (expected) |

### F. STAT Normal Mode

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| F1 | STAT loads | Open stat.html CDN URL while authenticated | Page renders, MMOS topbar present | [ ] | YES |
| F2 | Create bot duel | Initiate a duel against bot | create_duel RPC returns duel_id | [ ] | YES |
| F3 | Questions render | After duel starts | Questions and choices display correctly | [ ] | YES |
| F4 | Submit attempt | Answer all questions, submit | submit_attempt RPC succeeds, score displayed | [ ] | YES |
| F5 | Result displays | After finalization | Winner, scores, rating change shown | [ ] | YES |
| F6 | Profile updated | Check player profile after duel | Rating, wins/losses updated | [ ] | YES |
| F7 | No console errors | Check console during entire flow | No unhandled errors (warnings acceptable) | [ ] | YES |

### G. STAT E3 Outbox (Internal-Only)

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| G1 | Flag-off clean | Load stat.html WITHOUT ?e3_outbox=1 | Zero outbox IndexedDB, zero outbox console logs | [ ] | YES (flag leak blocks release) |
| G2 | Flag-on loads | Load stat.html WITH ?e3_outbox=1 | Page loads normally, no crash | [ ] | NO (internal-only) |
| G3 | Flag-on gameplay | Play duel with outbox enabled | Gameplay identical to flag-off | [ ] | NO (internal-only) |
| G4 | Queue populates | Check IndexedDB after duel with flag on | Telemetry events present in outbox queue | [ ] | NO (internal-only) |
| G5 | Flush drains | Trigger flush | Queue empties, no errors | [ ] | NO (internal-only) |

### H. Avatar Persistence

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| H1 | Save avatar | Generate/save avatar in Arena | upsert_user_avatar_record succeeds | [ ] | YES |
| H2 | Set active | Set saved avatar as active | set_active_user_avatar succeeds | [ ] | YES |
| H3 | Persists on reload | Reload Arena | Same avatar displayed | [ ] | YES |

### I. Avatar Propagation

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| I1 | Avatar in STAT | Set avatar in Arena, load STAT | Avatar visible if STAT displays it | [ ] | NO |
| I2 | Match snapshot | Play duel, query match_players | avatar_url recorded | [ ] | NO |

### J. Mobile Sanity

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| J1 | Arena mobile | Load arena.html at 375px viewport | Layout usable, no horizontal scroll | [ ] | NO |
| J2 | STAT mobile | Load stat.html at 375px viewport | Gameplay playable | [ ] | NO |
| J3 | Daily Rounds mobile | Load daily.html at 375px viewport | Menu navigable | [ ] | NO |

### K. Rollback Readiness

| # | Check | Action | Expected | Pass? | Blocks Release? |
|---|-------|--------|----------|-------|-----------------|
| K1 | R2 credentials valid | Non-destructive write test | HTTP 200 | [ ] | YES |
| K2 | Prior stable commit exists | `git log --oneline -5` in MissionMed repo | At least one prior commit with LIVE/ files | [ ] | YES |
| K3 | rollback.sh executable | `ls -la _SYSTEM/rollback.sh` | File exists and is executable | [ ] | YES |
| K4 | Rollback dry run | Run rollback.sh to HEAD~1, verify LIVE restored, then re-deploy current | Both operations complete without error | [ ] | YES (before first student release) |

---

## SECTION 4 -- 15-MINUTE PRE-LAUNCH SMOKE TEST

Run this immediately before opening student access. Every step must pass. Stop at the first failure.

**Prerequisites:** You are logged into WordPress as an admin. You have Chrome open with DevTools available.

| Step | Time | Action | Expected Outcome | Pass? |
|------|------|--------|-----------------|-------|
| 1 | 0:00 | Open `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` in Chrome | Arena loads. Topbar visible. No "Connecting" hang. | [ ] |
| 2 | 0:30 | Open DevTools Console. Type `typeof window.MMOS` | Returns `"object"` | [ ] |
| 3 | 1:00 | Open DevTools Network tab. Check for `/api/auth/exchange` | Status 200. Response contains `accessToken`. | [ ] |
| 4 | 1:30 | In Console: `(await supabase.auth.getUser()).data.user.id` | Returns a UUID string (not null, not error) | [ ] |
| 5 | 2:00 | Click Daily Rounds mode button | daily.html loads. Category menu visible with drill options. | [ ] |
| 6 | 3:00 | Select any drill from the menu | drills.html loads. Drill content plays. No "No valid drill contract" error. | [ ] |
| 7 | 4:00 | Navigate back to Arena (use topbar or browser back) | Arena loads again. Topbar present. | [ ] |
| 8 | 5:00 | Click STAT mode button | stat.html loads. MMOS topbar present. STAT UI ready. | [ ] |
| 9 | 6:00 | Start a bot duel | Duel creates. Questions render. Timer starts. | [ ] |
| 10 | 8:00 | Answer all questions and submit | Attempt submits. Score displays. Result screen shows winner. | [ ] |
| 11 | 10:00 | Check that your avatar is visible (if Arena has avatar display) | Avatar present OR avatar area is present but empty (acceptable if user has not set one) | [ ] |
| 12 | 11:00 | Navigate back to Arena | Arena loads. Topbar present. All mode buttons visible. | [ ] |
| 13 | 12:00 | Check any fullscreen/immersive mode if available | Enters and exits cleanly. Topbar still works after. | [ ] |
| 14 | 13:00 | Log out of WordPress. Reload Arena. | Exchange returns 401. Arena shows login prompt or redirect. Not stuck on "Connecting." | [ ] |
| 15 | 14:00 | Log back into WordPress. Reload Arena. | Exchange returns 200. Full session re-establishes. Arena functional. | [ ] |

**Result:** All 15 steps pass = SMOKE TEST PASS. Any failure = STOP. Do not open student access.

---

## SECTION 5 -- 60-MINUTE FULL QA PASS

Run this before the first broad student launch. Not required before every session, but required before first release and after any significant deploy.

### Block 1: Desktop Chrome (0:00-0:20)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run the full 15-minute smoke test (Section 4) | All steps pass |
| 2 | Open a second Chrome tab. Load Arena. | Both tabs functional. No session conflict. |
| 3 | Play a second STAT bot duel (sequential, not concurrent) | Second duel completes. Rating updates again. Cumulative stats correct. |
| 4 | After second duel, check player_profiles in Console | `wins` count incremented by 2 (if both won). Rating changed twice. |
| 5 | Open daily.html. Browse multiple categories. | All categories load. Drill lists populate. |
| 6 | Launch a video drill from Daily Rounds. | Video loads and plays. |
| 7 | View Page Source for arena.html. Search for `service_role` | Not found. |
| 8 | View Page Source for stat.html. Search for `service_role` | Not found. |
| 9 | View Page Source for stat.html. Search for `auth.signUp` | Not found. |

### Block 2: Incognito (0:20-0:30)

| Step | Action | Expected |
|------|--------|----------|
| 10 | Open Incognito window. Load Arena. | No WordPress session. Exchange returns 401. Login prompt or redirect. |
| 11 | Log into WordPress in Incognito. Reload Arena. | Full auth flow completes. Arena functional. |
| 12 | Play one STAT bot duel in Incognito. | Full flow works. |
| 13 | Close Incognito. Open normal Chrome. Check Arena. | Original session still valid. No interference. |

### Block 3: Mobile Viewport (0:30-0:40)

| Step | Action | Expected |
|------|--------|----------|
| 14 | In Chrome DevTools, toggle device toolbar. Set to iPhone 12 (390x844). | Viewport changes. |
| 15 | Load Arena. | Layout renders without horizontal scroll. Mode buttons tappable. |
| 16 | Navigate to STAT. Start bot duel. | Questions readable. Choices tappable. Gameplay works. |
| 17 | Navigate to Daily Rounds. | Menu navigable. Drill selection works. |
| 18 | Switch to iPad (810x1080). Repeat Arena + STAT check. | Layout scales. No broken elements. |

### Block 4: Refresh Persistence (0:40-0:45)

| Step | Action | Expected |
|------|--------|----------|
| 19 | In Arena, hard refresh (Ctrl+Shift+R). | Arena reloads. Auth re-establishes. Session intact. |
| 20 | In STAT mid-duel, refresh page. | Duel state may reset (acceptable). No crash. Can start new duel. |
| 21 | Set an avatar in Arena. Refresh. | Avatar persists. |

### Block 5: E3 Outbox Internal Canary (0:45-0:50)

| Step | Action | Expected |
|------|--------|----------|
| 22 | Load stat.html WITHOUT `?e3_outbox=1`. Open Application > IndexedDB. | No outbox database. No outbox console logs. |
| 23 | Load stat.html WITH `?e3_outbox=1`. Play a bot duel. | Gameplay identical to normal. |
| 24 | Check IndexedDB after duel. | Outbox queue has telemetry entries. |
| 25 | Trigger flush (if mechanism exists). | Queue drains. No console errors. |
| 26 | Remove `?e3_outbox=1`. Reload. Play another duel. | Zero outbox behavior. |

### Block 6: Network Console Review (0:50-0:55)

| Step | Action | Expected |
|------|--------|----------|
| 27 | Open Network tab. Filter by "4xx" and "5xx". Load Arena + play a full STAT duel. | Zero 404s on required resources. Zero 500s. (401 on exchange without WP session is expected.) |
| 28 | Check Console tab for errors (not warnings). | Zero unhandled errors during normal gameplay flow. |
| 29 | Check for CORS errors. | None. |
| 30 | Check for mixed content warnings (HTTP on HTTPS page). | None. |

### Block 7: Supabase Auth Verification (0:55-0:57)

| Step | Action | Expected |
|------|--------|----------|
| 31 | Console: `(await supabase.auth.getSession()).data.session.expires_at` | Returns a future timestamp. |
| 32 | Console: attempt to query another user's profile by modifying auth.uid() | RLS blocks. Returns empty or error. |

### Block 8: Rollback Dry Run (0:57-1:00)

| Step | Action | Expected |
|------|--------|----------|
| 33 | In terminal: `cd /Users/brianb/MissionMed && bash _SYSTEM/rollback.sh --target HEAD~1` | Backup created. LIVE restored from previous commit. Validation passes. Deploy completes. |
| 34 | Verify CDN serves the rolled-back content. | Content matches HEAD~1. |
| 35 | Re-deploy current: `bash _SYSTEM/deploy.sh` | Current HEAD re-deployed. CDN restored. |
| 36 | Run smoke test steps 1-5 again. | All pass on re-deployed current build. |

**Result:** All 36 steps pass = FULL QA PASS. Document results with date and operator name.

---

## SECTION 6 -- E3 STATUS AND RELEASE POLICY

### Current E3 Component Status

| Component | Status | Default State | Activation Method | Student-Facing? |
|-----------|--------|---------------|-------------------|-----------------|
| E3 Outbox (IndexedDB telemetry) | Internal canary | OFF | `?e3_outbox=1` URL param or localStorage flag | NO |
| Replay/Avatar Bridge | Not implemented | N/A | N/A | NO |
| Deterministic Bootstrap | Not enabled | N/A | N/A | NO |
| Normal STAT Duel Gameplay | Operational | ON | Always on | YES |

### Policy Rules

1. **Outbox stays internal-only until real canary passes.** A real canary means: one human plays a complete bot duel in a real browser with `?e3_outbox=1`, telemetry events queue, flush drains without errors, and gameplay is identical to flag-off mode. Token-assisted flush alone is not sufficient.

2. **Replay/avatar bridge stays disabled until backend contract is confirmed repaired.** The E3 backend contract repair migration (`20260427044500`) must be confirmed applied to RANKLISTIQ. After that, a separate design and canary phase is required before replay features can be enabled.

3. **Deterministic bootstrap must not be enabled unless specifically approved by Dr. Brian.** This is a future consideration, not a current requirement. Do not implement or enable it preemptively.

4. **Normal STAT can ship independently of E3 advanced telemetry.** STAT duel gameplay (create, play, submit, result, leaderboard) does not depend on the outbox, replay, or deterministic bootstrap. These are additive features that can be released later.

5. **E3 graduation requirements:**
   - Backend contract repair migration confirmed applied
   - Real browser outbox canary passed (at least 5 duel completions, zero errors)
   - Internal-only soak period (minimum 1 week with internal team using `?e3_outbox=1`)
   - Zero flag-off regressions confirmed
   - Dr. Brian approval to change default to ON

---

## SECTION 7 -- R2 / CDN RELEASE POLICY

### Runtime File Rules

- The only runtime HTML files served to students are the four canonical files at:
  - `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html`
  - `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html`
  - `https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html`
  - `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html`
- These are the ONLY production runtime URLs. No alternatives.
- WordPress page templates that embed Arena must reference these URLs. No legacy paths.

### Legacy Path Policy

- `arena_v1.html`, `drills_v1.html`, `stat_latest.html`, `mode_dailyrounds_v1.html` exist in the LIVE directory for rollback compatibility only.
- These files exist at legacy CDN paths (e.g., `html-system/Shared/`, `html-system/STAT_VERSIONS/`) and may continue to return 200. This is acceptable as archive/compatibility. They must not be used as production runtime sources.
- If a legacy path returns 200 and the corresponding LIVE path also returns 200, no action needed.
- If a legacy path returns 200 but the LIVE path returns 404, the asset must be mirrored to LIVE before release (if the asset is referenced by any LIVE HTML file).

### Asset Mirroring Rules

- Shared assets (images, audio, data files) must exist under `html-system/LIVE/` paths before any HTML file referencing them can be released.
- Mirroring is done via `_SYSTEM/mirror_live_assets.sh`. This script checks source existence, tests R2 write credentials, copies objects, and verifies each copy.
- Mirroring requires valid R2 credentials. If credentials are invalid, mirroring is blocked.
- After mirroring, run prefix normalization: verify all LIVE HTML files reference `html-system/LIVE/` asset paths, not legacy paths.

### 404 Check Policy

- Before release, every asset URL referenced by the four LIVE HTML files must return HTTP 200. Check via browser Network tab (filter for 404s during a full Arena + STAT + Daily Rounds + Drills walkthrough).
- A 404 on a required asset (JS, CSS, image used in the UI) blocks release.
- A 404 on an optional or decorative asset does not block release but should be logged for fix.

### No Route Redesign

- If CDN paths already match the `html-system/LIVE/` standard, no redesign or migration is needed.
- Do not introduce new CDN path schemes, new subdomains, or alternative CDN origins.

---

## SECTION 8 -- INCIDENT RESPONSE CHEAT SHEET

| Problem | Likely Cause | First Check | Next Action |
|---------|-------------|-------------|-------------|
| Arena stuck on "Connecting" | Auth exchange or bootstrap failing | Network tab: check `/api/auth/exchange` response code | If 502: check Railway. If 401: check WP session. If no request: check JS errors. |
| STAT click does nothing | MMOS routing broken or stat.html 404 | Console: check for JS errors on click. `curl -I` the stat.html CDN URL. | If 404: R2 issue. If JS error: audit MMOS.registerMode in arena.html. |
| Daily Rounds goes to wrong page | Arena nav handler targets drills.html instead of daily.html | Check Arena source for Daily Rounds click handler target URL | Fix navigation target. Must point to daily.html. |
| Drills contract error (from menu) | daily.html not passing contract params | Check URL that drills.html receives. Look for `mm_selected_drill` or `video_id` | Audit daily.html drill selection and URL construction. |
| STAT syncing/loading hang | Supabase session expired or RPC timeout | Console: check for Supabase auth errors. Network: check RPC response times. | If auth expired: re-auth flow should trigger. If RPC timeout: check Supabase dashboard for issues. |
| Auth 502 | Railway server down | Railway dashboard: check deployment status and logs | Redeploy Railway. Verify entrypoint is `node missionmed-hq/server.mjs`. |
| R2 asset 404s | Objects not deployed to LIVE prefix | `curl -I` the failing URL. Check STAGING prefix too. | If STAGING exists but LIVE missing: deploy pipeline interrupted. Re-run deploy.sh. |
| Outbox queue not draining | Backend telemetry endpoint error or schema mismatch | Network tab: check flush request response (look for 409/400/500) | Disable outbox (remove `?e3_outbox=1`). File Codex prompt for backend diagnosis. |
| Replay data mismatch | Replay/avatar bridge not implemented | This feature does not exist yet | No action. Replay is not enabled. Ignore any replay-related errors. |
| Avatar missing | Avatar RPC failed or user never set one | Console: query `user_avatars` table for current user | If empty: user has not set avatar (acceptable). If query errors: check RLS/auth. |

---

## SECTION 9 -- OPERATOR DECISION TREE

```
START: Is the system ready for students?
  |
  +-- Run 15-Minute Smoke Test (Section 4)
       |
       +-- ANY step fails?
       |     |
       |     YES --> STOP. DO NOT RELEASE.
       |             Identify which blocker (Section 2) matches.
       |             File Codex prompt for that blocker.
       |
       NO (all pass)
       |
       +-- Check Go/No-Go Checklist (Section 3)
            |
            +-- Any YES-blocks-release item is NO?
            |     |
            |     YES --> STOP. DO NOT RELEASE.
            |             Fix the failing item first.
            |
            NO (all release-blocking items pass)
            |
            +-- Is R2 rollback path confirmed working? (K1-K4)
            |     |
            |     NO --> STOP. Fix R2 credentials first.
            |           You cannot safely release without rollback.
            |
            YES
            |
            +-- RELEASE DECISION:
                 |
                 +-- Core Arena + STAT normal mode: GO
                 |
                 +-- E3 Outbox: Is real canary passed?
                 |     |
                 |     NO --> Keep outbox OFF (default). Release core only.
                 |     YES -> Keep outbox OFF still. Internal canary continues.
                 |            Outbox ON requires separate approval.
                 |
                 +-- Replay/Avatar Bridge: Is it implemented?
                 |     |
                 |     NO --> Not applicable. No action.
                 |     YES -> Has canary passed?
                 |             NO --> Keep disabled.
                 |             YES -> Separate approval needed.
                 |
                 +-- CDN asset 404s on non-critical items?
                 |     |
                 |     YES -> Log for fix. Release if core is unaffected.
                 |     NO --> Clean.
                 |
                 +-- Mobile QA items fail?
                       |
                       YES -> Log for fix. Not a release blocker.
                              Consider warning students about mobile limitations.
                       NO --> Clean.
```

**Summary of decision logic:**

| Condition | Decision |
|-----------|----------|
| All core checks pass, E3 fails | Release core. Keep E3 off. |
| Auth fails | Block release. |
| CDN required asset 404 | Block release. |
| CDN optional asset 404 | Release with logged defect. |
| STAT normal fails | Block release. |
| Outbox flag leak | Block release (fix flag gate first). |
| Outbox internal canary fails | Keep outbox off. Release core. |
| Replay fails | Keep replay disabled. Release core. |
| Mobile issues | Release with known limitation. |
| Rollback path broken | Block release. |

---

## SECTION 10 -- CODEX HANDOFF QUEUE

Priority ordering reflects dependency chain. P0 must complete before P1 can start.

| Priority | Prompt ID | Purpose | Blocked By | Success Criteria | Release Impact |
|----------|-----------|---------|------------|------------------|----------------|
| P0 | MR-R2-CREDENTIAL-RESOLUTION-029 | Provision and validate new R2 write credentials | Operator must create new R2 API token in Cloudflare dashboard | Non-destructive signed write test returns HTTP 200. Signed readback returns 200/206. | Unblocks ALL CDN operations. Without this, no deploy, no rollback, no release. |
| P1 | MR-R2-ASSET-MIRROR-030 | Mirror legacy-path assets to html-system/LIVE/ paths | MR-R2-CREDENTIAL-RESOLUTION-029 | mirror_live_assets.sh completes with FINAL=PASS. All source objects mirrored and verified. | Unblocks asset 404 resolution. Required for clean release. |
| P1 | MR-E3-BACKEND-CONFIRM-031 | Confirm E3 backend contract repair migration applied to RANKLISTIQ | None (read-only check) | `supabase migration list` shows 20260427044500 applied. Validation harness passes. | Required before E3 outbox canary. Does not block core release. |
| P2 | MR-CDN-PREFIX-NORMALIZATION-032 | Verify LIVE HTML files reference html-system/LIVE/ asset paths, fix any legacy refs | MR-R2-ASSET-MIRROR-030 | Zero 404s in browser Network tab when loading any LIVE HTML file. | Eliminates runtime 404 risk. |
| P2 | MR-E3-OUTBOX-REAL-CANARY-033 | Real browser gameplay canary with ?e3_outbox=1 | MR-E3-BACKEND-CONFIRM-031 | Complete bot duel with outbox. Queue drains. No errors. No gameplay regression vs flag-off. | Required before E3 outbox can graduate from internal-only. |
| P3 | MR-REPLAY-AVATAR-BRIDGE-DESIGN-034 | Design document for replay/avatar bridge | MR-E3-OUTBOX-REAL-CANARY-033 (soft dependency) | Design doc written and filed. | Future feature planning. Does not block any current release. |
| P3 | MR-GOLD-STABLE-BUILD-LOCK-035 | Tag Gold Stable Build after all P0-P2 pass | All P0-P2 items complete | Git tag created. Full QA pass (Section 5). Rollback to prior build tested. Re-deploy to gold tag tested. Changelog entry complete. | Formal release milestone. Required before first paying-student access. |

---

## SECTION 11 -- GOLD STABLE BUILD REQUIREMENTS

A Gold Stable Build can be declared when ALL of the following are simultaneously true:

| # | Requirement | Verification Method | Pass? |
|---|-------------|-------------------|-------|
| 1 | Git commit on main is tagged (e.g., `gold-stable-v1.0`) and pushed to origin | `git tag -l 'gold-stable-*'` shows tag. `git log --oneline -1` matches tag. | [ ] |
| 2 | CDN LIVE content matches tagged commit | SHA256 of each CDN LIVE file = SHA256 of corresponding file at tagged commit | [ ] |
| 3 | STAGING content matches LIVE content | SHA256 of each STAGING file = SHA256 of LIVE file | [ ] |
| 4 | Auth pass | Go/No-Go checklist Section B: B1-B4 all YES | [ ] |
| 5 | Arena pass | Go/No-Go checklist Section C: C1-C7 all YES | [ ] |
| 6 | Daily Rounds / Drills pass | Go/No-Go checklist Sections D+E: all release-blocking items YES | [ ] |
| 7 | STAT normal pass | Go/No-Go checklist Section F: F1-F7 all YES | [ ] |
| 8 | Avatar persistence pass | Go/No-Go checklist Section H: H1-H3 all YES | [ ] |
| 9 | E3 decision recorded | One of: (a) outbox canary passed and stable at default OFF, or (b) outbox confirmed zero-regression when flag off. Decision documented in changelog. | [ ] |
| 10 | Rollback tested | rollback.sh to prior commit succeeds. Re-deploy to gold tag succeeds. Both validated. | [ ] |
| 11 | No open P0 blockers | Codex queue Section 10: all P0 items resolved | [ ] |
| 12 | Changelog entry written | `CHANGELOG/CHANGELOG.md` has entry with: gold-stable tag, commit hash, date, gate results | [ ] |

---

## SECTION 12 -- FINAL RECOMMENDATION

### 1. Is this ready for paying students now?

**NO.** Three hard blockers exist:

- R2 write credentials are invalid (403 on signed write). The deploy pipeline and rollback pipeline cannot execute. Without rollback, releasing to paying students is an unacceptable risk. If something breaks, you cannot fix it through the standard pipeline.
- The current LIVE CDN state is UNKNOWN. Whether all four HTML files and their referenced assets are currently serving correctly has not been verified.
- The Gold Stable Build has not been tagged. No formal QA pass has been documented.

### 2. What exactly blocks it?

In dependency order:

1. **R2 credentials must be fixed.** Go to Cloudflare dashboard, create a new R2 API token with Object Read + Write on `missionmed-videos` bucket, save to `_SYSTEM/r2.env`, run the non-destructive write test.
2. **CDN state must be verified.** After credentials are fixed, curl all four LIVE URLs. Confirm 200 and correct content.
3. **Asset mirroring must complete.** Run `mirror_live_assets.sh` to copy shared assets to LIVE paths.
4. **Prefix normalization must be checked.** Verify zero 404s in browser during full walkthrough.
5. **Full QA pass must be run.** Section 5, all 36 steps, documented.
6. **Rollback must be tested.** rollback.sh to prior commit, re-deploy to current.
7. **Gold Stable Build must be tagged.** After all above pass.

### 3. What can be safely shown internally?

Everything that currently works via the CDN can be shown internally. This includes Arena, STAT normal mode, Daily Rounds, and Drills, assuming the current CDN files are serving (which is UNKNOWN but likely based on prior state). E3 outbox can be shown internally with `?e3_outbox=1` for testing purposes only.

Internal showing does not carry the same risk as paying-student access because:
- Internal users understand the system is in development
- Internal users can report issues directly
- No financial or reputational obligation exists for internal testing

### 4. What is the next highest-ROI action?

**Fix R2 credentials.** This single action unblocks: CDN deploys, asset mirroring, rollback capability, prefix normalization, and the Gold Stable Build process. Everything else is downstream of this.

Estimated time: 10-15 minutes in the Cloudflare dashboard to create a new R2 API token, plus 5 minutes to update `_SYSTEM/r2.env` and run the write test.

### 5. What should not be touched next?

- Do not redesign auth, MMOS, CDN routing, or the deploy pipeline. They work.
- Do not enable E3 outbox default ON.
- Do not implement replay/avatar bridge.
- Do not enable deterministic bootstrap.
- Do not run broad Codex refactoring tasks.
- Do not manually upload files to R2 via FileZilla or Cloudflare dashboard.
- Do not attempt to deploy to CDN before R2 credentials are fixed.

---

END OF MISSIONMED_STUDENT_LIVE_RELEASE_MANUAL_V1
