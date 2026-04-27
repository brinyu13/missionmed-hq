# A7_ARENA_LOGIN_ACCEPTANCE_PACKAGE_2001

**Prompt ID:** (A7)-ARENA_ECO_FINETUNE-claude-high-2001
**Date:** 2026-04-27
**Risk Level:** LOW (AUDIT/STRATEGY per PRIMER_CORE deterministic table)
**Scope:** No-edit red-team UX/auth acceptance audit for Arena login/logout containment

---

## RESULT: READY

The Arena login/logout containment work is architecturally sound, correctly scoped, and ready for Codex credentialed validation. No blocking issues found in the code review. One narrow follow-up recommended (copy polish), but it is non-blocking.

---

## 1. EXECUTIVE VERDICT

The current approach is **acceptable and correctly scoped**.

The implementation makes the right architectural calls: WordPress stays the session entry point, Railway remains the auth authority via exchange/bootstrap, Supabase gets its session only through setSession after bootstrap, and the proxy rewrites direct Railway URLs to same-origin `/api/auth/*` paths so cookies travel correctly. The `arena-route-proxy.php` mu-plugin is clean, defensive, and minimal. It does exactly three things: (1) intercept `/arena`, (2) fetch from CDN, (3) inject auth config and rewrite auth URLs. That is the right amount of code for this problem.

The one area that deserves scrutiny during credentialed validation is the WP login form injection path. The proxy generates `wp_login_form()` HTML and injects it into the Arena panel via `MM_ARENA_AUTH_CONFIG.loginFormHtml`. The client-side `renderArenaAuthFormIntoPanel()` then sets `innerHTML` from that payload. This is a legitimate server-rendered form, not a client-side auth bypass, but the form POST will navigate the browser to `wp-login.php` (standard WP behavior), then redirect back to `/arena`. That redirect-back path is the one thing Codex must verify with real credentials.

The approach is not overengineered. It is not undervalidated for the work that can be done without credentials. The remaining gap is purely "log in with a real account and watch the round-trip." That is the correct next step.

---

## 2. OVERENGINEERING REVIEW

### Code Approach: Reasonable

The `arena-route-proxy.php` is ~275 lines. It handles: route interception, CDN fetch, auth URL rewriting, auth config injection, login form generation, and error handling. Each function has a single responsibility. The `str_replace` approach for rewriting Railway URLs to same-origin is blunt but correct and zero-regex, which means it will not break on edge cases. The fallback chain for config injection (`</head>` first, then `<body>`, then prepend) is appropriately defensive.

The client-side auth code in `arena.html` is more complex but justified: `getArenaAuthConfig()` tries `window.MM_ARENA_AUTH_CONFIG`, then `window.mmArenaAuth`, then `window.top.*` variants. This multi-source lookup exists because the same HTML can run inside an iframe (Elementor) or standalone (proxy). That is a real deployment concern and the code handles it correctly.

### Validation Process: Simple Enough

Logged-out validation has already confirmed: CDN 200s, proxy 200s, no redirect to `/my-account`, auth panel visible, exchange returns 400 unauthenticated, bootstrap returns 401 unauthenticated. This is the correct unauthenticated test surface. The only remaining step is credentialed validation.

### Production Promotion Process: Simple Enough

The LIVE CDN path is already set. The proxy already points to the LIVE CDN. There is no staging-to-production promotion step required. The current CDN artifact IS production. The proxy IS live as a mu-plugin.

### Remaining Authentication Validation: Needs Narrowing

Codex should validate exactly 4 auth transitions, not a broad auth audit:
1. Logged-out visitor arrives at `/arena` and sees auth panel
2. Visitor submits WP login form (or clicks through to `/my-account`) and returns to `/arena`
3. Post-login exchange/bootstrap/setSession chain completes and lobby appears
4. Logout via nonce URL returns to `/arena?logged_out=1` in logged-out state

That is the complete acceptance surface. Nothing else needs to be tested for this specific containment fix.

---

## 3. LOCKED-RUNTIME COMPLIANCE CHECKLIST

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | WordPress login/session/redirect role preserved | PASS | `arena-route-proxy.php` generates `wp_login_form()` with `redirect` set to `/arena`. Login goes through WP `wp-login.php`. Logout uses `wp_logout_url()` with nonce. |
| 2 | Railway exchange/bootstrap preserved | PASS | `AUTH_EXCHANGE_URL = '/api/auth/exchange'` and `AUTH_BOOTSTRAP_URL = '/api/auth/bootstrap'` in arena.html. Proxy rewrites any hardcoded Railway URLs to same-origin. Railway backend remains sole auth authority. |
| 3 | Supabase setSession/getUser preserved | PASS | `ensureSupabaseSessionViaWordPress()` calls `arenaSupabase.auth.setSession(bootstrap.tokens)` then `arenaSupabase.auth.getUser()` for verification. Line 6776+ in arena.html. |
| 4 | RLS-protected queries only after valid session | PASS | Supabase queries occur only after `ensureSupabaseSessionViaWordPress()` returns true. The `resolveSupabaseIdentityFromWordPress()` function calls `getUser()` before any data queries. |
| 5 | No WP REST identity authority | PASS | `/wp-json/wp/v2/users/me` is not used as Arena identity authority. The WP REST token path (`WORDPRESS_AUTH_TOKEN_PATH`) is only used as a fallback to obtain an exchange token when cookie-based exchange fails, which feeds into Railway, not into identity directly. |
| 6 | No Supabase password auth | PASS | No `signInWithPassword`, `signUp`, or direct Supabase auth calls found. Only `setSession` and `getUser`. |
| 7 | No service_role exposure | PASS | No `service_role` key anywhere in arena.html or the proxy. Supabase client uses anon key only. |
| 8 | No old Supabase project | PASS | Only `fglyvdykwgbuivikqoah.supabase.co` referenced. No `plgndqcplokwiuimwhzh` found. |
| 9 | No localStorage/sessionStorage proof-of-auth | PASS | Auth state determined by exchange/bootstrap chain, not by reading storage. `ArenaUser.authenticated` is set only after successful identity resolution. |
| 10 | No Drills ingestion impact | PASS | Drills launch logic, `mm_selected_drill`, and `/drills/?video_id=` routing are untouched by the auth panel or proxy changes. |
| 11 | No STAT gameplay impact | PASS | STAT routing and gameplay logic are in `stat.html`, not modified. Arena-to-STAT handoff uses `MMOS.registerMode` which is unrelated to login containment. |
| 12 | No MMOS lifecycle impact | PASS | `window.MMOS` and `MMOS.registerMode` are not modified by the auth panel logic. The auth panel renders before MMOS initializes and is hidden once auth completes. |

---

## 4. FINAL UX ACCEPTANCE CRITERIA

### Logged Out: Visiting /arena

The student visits `missionmedinstitute.com/arena` without being logged in. They should see:

- The Arena loading screen (particles, branding) transitions to the entry screen
- The entry screen shows the auth panel (`#entryAuthPanel`) with:
  - A headline explaining login is needed
  - A brief explanation of why (drills, stats, rank tied to account)
  - An embedded WP login form (username/password fields, "Continue to Arena" button)
  - A "Use full account page" link (fallback to `/my-account`)
  - A "Create account" link
- The "Enter Arena" button shows "Sign In Required" and is disabled
- The URL remains `/arena` (no redirect to `/my-account` or elsewhere)
- The page feels like Arena, not like WordPress. Dark theme, Arena branding, glass panel aesthetic

### After Login

- Student submits the embedded login form OR clicks through to `/my-account` and logs in
- Browser redirects back to `/arena` (via the `redirect_to` hidden input or WP redirect)
- The proxy re-serves the Arena HTML, this time with `isLoggedIn: true` in `MM_ARENA_AUTH_CONFIG`
- Exchange runs (cookie-based), returns 200
- Bootstrap runs, returns Supabase tokens
- `setSession` establishes the Supabase session
- `getUser` verifies the session
- Auth panel hides, entry button unlocks, lobby appears
- Avatar, topbar username/level/XP, and user identity populate
- No flash of logged-out panel before lobby appears

### After Logout

- Student triggers logout (topbar logout or programmatic)
- Browser navigates to `wp_logout_url` (includes nonce) which clears WP session
- WP redirects to `/arena?logged_out=1`
- The proxy serves Arena HTML again, this time with `isLoggedIn: false` and `loggedOutParam: true`
- Auth panel appears with the logged-out message: "You signed out. Sign in to re-enter the Arena."
- Enter Arena button is disabled again
- Refreshing `/arena?logged_out=1` stays logged out (no stale cookie resurrection)
- No authenticated data (avatar, username, stats) is visible

---

## 5. COPY REVIEW

### Current Copy (in arena.html)

- **Title:** "Sign in to enter the Arena"
- **Detail:** "Your drills, stats, rank, and duels are tied to your MissionMed account."
- **Login CTA:** "Continue to Arena" (on the WP form submit button)
- **Fallback link:** "Open Login" / "Use full account page" (contextual)
- **Register link:** "Create account"
- **Logged-out message:** "You signed out. Sign in to re-enter the Arena."
- **Button locked state:** "Sign In Required"

### Recommended Final Copy

**Headline:** "Sign in to enter the Arena"
(Keep as-is. Direct, clear, Arena-native.)

**Subheadline/detail:** "Your drills, stats, and rank are saved to your MissionMed account."
(Drop "duels" since duels are not yet live. Simpler sentence. Changed "tied" to "saved" for clearer meaning.)

**Login CTA (form submit):** "Enter Arena"
(Shorter. More confident. "Continue to Arena" implies a waiting step.)

**Fallback link:** "Use full login page"
(Clearer than "Use full account page." The student wants to log in, not manage their account.)

**Register link:** "Create account"
(Keep as-is. Clear and standard.)

**Logged-out success message:** "Signed out. Log in to return to the Arena."
(Shorter. Removes "You" for tighter copy. Clearer next action.)

**Button locked state:** "Sign In Required"
(Keep as-is. Unambiguous.)

**Fallback/login issue helper line (add if not present):** "Having trouble? Try the full login page or contact support@missionmedinstitute.com"
(Optional. Only if the embedded form has known issues with certain browsers.)

---

## 6. CODEX VALIDATION HANDOFF

Codex should run the following checklist with a real student-tier WordPress account. Each step must be explicitly confirmed PASS or FAIL.

### Pre-Validation Setup
- [ ] Use an incognito/private browser window
- [ ] Confirm no active WordPress session (visit `/my-account` and see login form)
- [ ] Have DevTools Network tab open, filtered to XHR/Fetch

### A. Logged-Out /arena
- [ ] Navigate to `missionmedinstitute.com/arena`
- [ ] Confirm URL stays as `/arena` (no redirect)
- [ ] Confirm response header `X-MissionMed-Route: arena-proxy` present
- [ ] Confirm auth panel is visible
- [ ] Confirm "Enter Arena" button says "Sign In Required" and is disabled
- [ ] Confirm embedded WP login form is rendered (username + password fields)
- [ ] Confirm "Use full login page" and "Create account" links are present and have correct hrefs

### B. Login via Embedded Form
- [ ] Enter valid credentials in the embedded form
- [ ] Submit the form
- [ ] Confirm browser navigates to `wp-login.php` POST then redirects
- [ ] Confirm final destination is `/arena` (not `/my-account`, not a 404)

### C. Auth Chain (post-login)
- [ ] In DevTools Network, confirm `/api/auth/exchange` request fires
- [ ] Confirm exchange returns 200 with `accessToken` in payload
- [ ] Confirm `/api/auth/bootstrap` request fires with Bearer token
- [ ] Confirm bootstrap returns 200 with `access_token` and `refresh_token`
- [ ] Confirm no requests to `plgndqcplokwiuimwhzh.supabase.co` (old project)
- [ ] Confirm requests go to `fglyvdykwgbuivikqoah.supabase.co` (correct project)

### D. Authenticated Arena State
- [ ] Confirm auth panel is hidden
- [ ] Confirm "Enter Arena" button is clickable (or lobby auto-entered)
- [ ] Confirm lobby appears with user identity (avatar/username/level)
- [ ] Confirm topbar shows authenticated state
- [ ] Confirm no JS console errors related to auth

### E. Refresh/Back Button
- [ ] Refresh the page on authenticated `/arena`
- [ ] Confirm authenticated state persists (no flash of login panel)
- [ ] Press browser back button
- [ ] Confirm no redirect loops or broken states

### F. Logout
- [ ] Trigger logout (topbar logout control)
- [ ] Confirm browser navigates through WP logout (nonce URL)
- [ ] Confirm final destination is `/arena?logged_out=1`
- [ ] Confirm auth panel shows logged-out message
- [ ] Confirm no authenticated data visible (avatar, username, stats cleared)
- [ ] Refresh `/arena?logged_out=1`
- [ ] Confirm state remains logged out after refresh

### G. Cross-Surface Smoke
- [ ] Log back in to Arena
- [ ] Navigate Arena to STAT and confirm STAT loads with auth
- [ ] Navigate STAT back to Arena and confirm Arena is still authenticated
- [ ] Navigate Arena to Daily Rounds menu
- [ ] Navigate Daily Rounds to Drills via valid contract and confirm Drills loads
- [ ] In a new tab, navigate directly to `/stat` while logged out
- [ ] Confirm `/stat` shows appropriate unauthenticated state
- [ ] In a new tab, navigate directly to `/drills` while logged out
- [ ] Confirm `/drills` loads without crash (no-contract direct load is not a failure)

---

## 7. FAILURE MODE TABLE

| # | Failure Mode | Likely Cause | Severity | What Codex Should Check | Rollback Needed? |
|---|-------------|-------------|----------|------------------------|-----------------|
| 1 | Login form submits but does not return to Arena | `redirect_to` param missing or WP overriding redirect with `/my-account` | HIGH | Check final redirect destination after form POST. Check `redirect_to` hidden input value in form HTML. | No. Fix `redirect_to` in proxy `wp_login_form()` call or in WP redirect filters. |
| 2 | Login succeeds but exchange/bootstrap fails | Railway backend down, CORS misconfigured, or cookie not forwarded on same-origin `/api/auth/*` | HIGH | Check Network tab for exchange 4xx/5xx. Check Railway logs. Check that proxy path forwards to Railway. | No. Diagnose Railway/proxy. Arena falls back to login link gracefully. |
| 3 | Login panel stays visible after successful auth | `hideArenaEntryAuthPanel()` not called, or `isLoggedIn` config not set to true by proxy | MEDIUM | Check `MM_ARENA_AUTH_CONFIG.isLoggedIn` value in page source. Check `showArenaAuthRequiredState` call path. | No. Fix conditional in entry screen transition. |
| 4 | Logout fails nonce validation | WP nonce expired or malformed `logoutUrl` | MEDIUM | Click logout, check if WP returns "Are you sure?" page instead of redirecting. Check nonce freshness. | No. Nonce is generated fresh each proxy serve. Likely a cache issue. |
| 5 | Logout returns to /my-account instead of /arena | `wp_logout_url()` redirect param not set to `/arena?logged_out=1` | HIGH | Check the logout URL in page source. Check `buildArenaLogoutUrl()` output. | No. Fix `wp_logout_url()` call in proxy. |
| 6 | Refresh causes stale auth state | Browser caching the proxy response despite `no-cache` headers | MEDIUM | Check response headers for `Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private`. Check CDN cache. | No. Fix cache headers or add cache-bust param. |
| 7 | Back button creates redirect loop | Multiple redirects stacking in browser history (login -> arena -> login) | LOW | Press back button 3-4 times from authenticated arena. Check for loops. | No. Likely a `replaceState` fix needed. |
| 8 | STAT loses auth after Arena login | STAT not picking up WP session cookie or using different Supabase init | LOW | Navigate Arena -> STAT. Check STAT auth state. Check that WP cookie is present. | No. STAT auth is independent of this fix. |
| 9 | Daily/Drills handoff breaks | Login containment patch accidentally modified MMOS or drill contract routing | LOW | Launch drill from Daily Rounds. Check for JS errors. Check `mm_selected_drill` presence. | No. These systems are untouched by this patch. |
| 10 | Direct /drills loads differently | `drills-proxy` or CDN artifact changed | LOW | Navigate to `/drills` directly. Compare behavior to pre-patch. | No. Drills proxy is a separate mu-plugin. |
| 11 | CDN serves stale arena.html | R2/Cloudflare cache not purged after last upload | MEDIUM | Compare `arena.html` version header from CDN response vs. local LIVE copy. | No. Purge CDN cache. |
| 12 | Proxy injects config in wrong position | No `</head>` tag in arena.html or malformed HTML | LOW | Check page source for `MM_ARENA_AUTH_CONFIG` script tag position. Confirm it appears before Arena JS. | No. Proxy has 3-tier fallback (head, body, prepend). |

---

## 8. DO-NOT-TOUCH LIST

The following systems, files, and paths MUST NOT be modified during Codex final validation and closeout. Codex is validating, not implementing.

**Application Surfaces:**
- STAT gameplay logic and UI (`stat.html`)
- Drills ingestion engine and drill contract handling (`drills.html`)
- Daily Rounds mode logic and scheduling (`daily.html`)
- MMOS lifecycle, `registerMode`, mode switching, and topbar wiring

**Backend:**
- Supabase schema, RLS policies, and migrations
- Railway exchange/bootstrap endpoint code (`server.mjs`, auth routes)
- `missionmed-hq-proxy.php` (unless separately scoped in a different prompt)

**Infrastructure:**
- CDN routing paths (`html-system/LIVE/`)
- Runtime filenames (`arena.html`, `stat.html`, `drills.html`, `daily.html`)
- Cloudflare R2 bucket configuration
- `package.json` / `package-lock.json` / any lockfiles

**Unrelated Systems:**
- IV On-Call / DBOC interview system
- USCE portal and enrollment
- MedMail / Leads / Payments modules
- WordPress theme files (unless directly related to redirect filters)
- Avatar generation endpoint (Railway `/api/avatar/*`)

**Config:**
- Supabase project keys (anon key, project URL)
- Railway environment variables
- WordPress `wp-config.php`

---

## 9. FINAL ACCEPTANCE REPORT TEMPLATE

Codex should use this exact template when reporting final validation results:

```
ARENA LOGIN/LOGOUT CONTAINMENT - FINAL VALIDATION REPORT
=========================================================

Prompt ID: [Codex prompt ID]
Date: [YYYY-MM-DD]
Validator: Codex
Browser: [browser + version]
Account: [test account role, e.g. "student-tier WP user"]

RESULT: [FIXED / PARTIAL / NOT FIXED / ROLLBACK RECOMMENDED]

---

LOGGED-OUT ARENA:
- /arena stays on /arena: [PASS/FAIL]
- Auth panel visible: [PASS/FAIL]
- Embedded WP form rendered: [PASS/FAIL]
- Enter button locked: [PASS/FAIL]
- No redirect to /my-account: [PASS/FAIL]

LOGIN:
- Form submission works: [PASS/FAIL]
- Returns to /arena: [PASS/FAIL]
- No intermediate error pages: [PASS/FAIL]

AUTH CHAIN:
- Exchange 200: [PASS/FAIL]
- Bootstrap 200: [PASS/FAIL]
- setSession success: [PASS/FAIL]
- getUser returns valid user: [PASS/FAIL]
- Correct Supabase project: [PASS/FAIL]

AUTHENTICATED ARENA:
- Auth panel hidden: [PASS/FAIL]
- Lobby loads: [PASS/FAIL]
- User identity populated: [PASS/FAIL]
- No console auth errors: [PASS/FAIL]

LOGOUT:
- Logout navigates correctly: [PASS/FAIL]
- Returns to /arena?logged_out=1: [PASS/FAIL]
- Logged-out message shown: [PASS/FAIL]
- No stale auth data: [PASS/FAIL]

REFRESH/BACK BUTTON:
- Auth refresh preserves state: [PASS/FAIL]
- Back button no loops: [PASS/FAIL]

CROSS-SURFACE:
- Arena -> STAT -> Arena: [PASS/FAIL]
- Arena -> Daily: [PASS/FAIL]
- Daily -> Drills: [PASS/FAIL]
- Direct logged-out /stat: [PASS/FAIL]
- Direct logged-out /drills: [PASS/FAIL]

FILES CHANGED:
- [list any files modified during validation, or "None - validation only"]

ISSUES:
- [list any issues found, or "None"]

FIXES APPLIED:
- [list any fixes, or "N/A - validation only"]

RECOMMENDATION:
- [Close / Narrow follow-up needed / Hold / Rollback]

CONFIDENCE: [percentage]
```

---

## 10. GO / NO-GO DECISION

**DECISION: GO. Continue with Codex credentialed validation.**

The architecture is correct. The proxy is clean. The client-side auth flow follows the locked runtime exactly. Unauthenticated validation has passed. The only remaining work is to confirm the round-trip with real credentials, which is exactly what Codex should do next.

No hold. No rollback. No narrow follow-up patch required before validation.

**After validation completes successfully:** the copy polish items from Section 5 can be addressed in a separate, low-risk copy-only patch. They are not blocking.

---

## CONFIDENCE

**Claude Confidence: 88%**

**Reservation:** I have not observed a live credentialed login round-trip. The code review confirms the architecture is correct and the proxy generates the right form/redirect/config, but there could be a WP redirect filter, a plugin conflict, or a Railway CORS edge case that only surfaces with real cookies. The 12% gap is entirely "I cannot run the browser test myself."

**What would raise confidence closer to 100%:** A single successful credentialed round-trip (login -> exchange -> bootstrap -> lobby -> logout -> logged-out panel) observed by Codex with Network tab evidence. That one test covers the entire remaining risk surface.

---

## PRE-FLIGHT NOTE

`read_learnings.py` and `LEARNINGS_LOG.jsonl` are not present in the filesystem. These appear to have been removed or relocated during a prior cleanup. This is a LOW-risk audit task producing only review artifacts with no code changes, so this does not block execution. The missing learning infrastructure should be restored in a separate maintenance task.

---

REPORT:

WHAT WAS DONE:
- Loaded SESSION_PRIMER_V2 (redirected to PRIMER_CORE per deprecation notice)
- Loaded PRIMER_CORE and applied all active rules
- Read KNOWLEDGE_INDEX for routing context
- Read `arena-route-proxy.php` (275 lines, full review)
- Read `LIVE/arena.html` auth sections (login panel HTML, CSS, auth config resolution, exchange/bootstrap chain, entry screen transitions, logout URL construction)
- Produced 10-deliverable acceptance package

RESULT:
- Arena login/logout containment is architecturally sound and ready for credentialed validation

RISK LEVEL: LOW

ISSUES:
- `read_learnings.py` and `LEARNINGS_LOG.jsonl` missing from filesystem
- Minor copy polish opportunity (non-blocking)

FIXES:
- N/A (no-edit audit)

VERIFICATION:
- Cross-referenced proxy code against locked auth runtime (WordPress -> Railway -> Supabase)
- Verified no forbidden patterns (old Supabase project, service_role, password auth, localStorage proof-of-auth, WP REST identity authority)
- Verified exchange/bootstrap/setSession/getUser chain in arena.html matches locked architecture
- Confirmed proxy rewrites Railway URLs to same-origin paths
- Confirmed proxy injects auth config with login form HTML, logout URL with nonce, and correct redirect targets

STATUS: COMPLETE
