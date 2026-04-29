# MissionMed Arena Changelog

## [2026-04-29 15:05 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-ac
- Scope: Enforce locked WordPress-entry → Railway exchange/bootstrap runtime for Arena and auto-redirect unauthenticated `/arena` traffic to WordPress login.
- Files: LIVE/arena.html, CHANGELOG/CHANGELOG.md
- Notes: Set Arena auth endpoints to `https://missionmed-hq-production.up.railway.app/api/auth/{exchange,bootstrap}`, preserved Supabase session hydration checks, removed redirected-query auth stop-screen branch, and enforced automatic unauthenticated redirect back to MissionMed `/my-account` login flow for Arena entry.

## [2026-04-29 14:53 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-ab
- Scope: Remove Arena-native login surface and enforce WordPress `/my-account` entry flow with stable post-redirect auth failure handling.
- Files: LIVE/arena.html, CHANGELOG/CHANGELOG.md
- Notes: Disabled embedded Arena login-form surface (sanitized injected `loginFormHtml` + removed entry form container), enforced deterministic WordPress return target `/arena?redirected=1`, blocked repeat login redirect when `redirected=1` or `logged_out=1`, converted unauth state to single MissionMed sign-in link, and removed top-nav guest Login/Register controls while preserving A8 exchange/bootstrap/handoff markers.

## [2026-04-29 11:37 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-v
- Scope: Restore A8 Arena frontend exchange/handoff flow while preserving 500-t logout cleanup.
- Files: LIVE/arena.html
- Notes: Restored Arena exchange payload to `audience: "arena"`, reintroduced login-context exchange retry cadence, added one-time `wordpress_handoff_url` consumption (`shouldAttemptArenaAuthHandoff` / `attemptArenaAuthHandoff`) with post-handoff exchange retry (`exchange_cookie_post_handoff`), and kept HQ token fallback disabled for Arena auth while retaining 500-t logout/session purge behavior.

## [2026-04-29 11:03 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-t
- Scope: Deterministic Arena logout/session clearing to remove sticky runtime identity contamination between auth tests.
- Files: LIVE/arena.html
- Notes: Routed top-right Arena logout menu through `window.arenaLogout`, added robust logout cleanup path (Supabase sign-out, same-origin `/api/auth/logout` best-effort with exchange-derived CSRF/bearer headers, and targeted local/session storage auth key purge), and added `?logged_out=1` boot handling that clears runtime auth state before any rehydration attempt.

## [2026-04-29 10:32 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-s
- Scope: Restore A8 Supabase auth user-resolution resilience after nonce regression cleanup.
- Files: missionmed-hq/server.mjs
- Notes: Removed Supabase admin `email=` filter dependency from auth-user lookup in bootstrap flow (page/per_page list + local normalized email match), and restored magic-link fallback when ensure-user fails so runtime bootstrap does not hard-fail with `supabase_user_unresolved` before fallback is attempted.

## [2026-04-29 09:32 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-r
- Scope: Narrow Arena regression repair by scoping STAT nonce bridge behavior to STAT-origin exchange traffic only.
- Files: missionmed-hq/server.mjs
- Notes: Constrained `/wp-json/missionmed/v1/supabase-session` bridge probing to STAT-targeted exchange requests (payload/referer), while preserving nonce-forwarding support for STAT and restoring Arena exchange to the legacy non-bridge A8 path (`/wp/v2/users/me` + handoff/session fallback behavior).

## [2026-04-29 01:26 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-q
- Scope: Runtime nonce handoff repair for STAT exchange path across stat proxy, frontend exchange call, and Railway bridge forwarding.
- Files: LIVE/stat.html, missionmed-hq/server.mjs, wp-content/mu-plugins/stat-route-proxy.php
- Notes: Added server-side STAT auth config injection with `wp_rest` nonce for logged-in sessions, updated STAT exchange/debug exchange requests to attach `X-WP-Nonce` when available, and updated Railway runtime cookie-validation bridge calls to forward incoming `X-WP-Nonce` to `/wp-json/missionmed/v1/supabase-session` and `/wp/v2/users/me` fallback checks.

## [2026-04-29 01:21 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-p
- Scope: Runtime cookie-auth bridge alignment for `/api/auth/exchange` subscriber flow.
- Files: missionmed-hq/server.mjs
- Notes: Updated Railway exchange cookie validation to use the dedicated WordPress bridge endpoint (`/wp-json/missionmed/v1/supabase-session`) before legacy `wp/v2/users/me`, normalized bridge user-shape parsing, and changed runtime no-cookie exchange failure to explicit cookie-missing guidance instead of HQ token-handoff messaging. Deployed to `missionmed-hq-production.up.railway.app` (Railway deployment `d110f55d-5448-4925-814b-84e9d0f4744c` SUCCESS).

## [2026-04-29 01:10 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-p
- Scope: End-to-end STAT runtime auth bridge repair pass with live MU parity preservation and guest-identity fallback cleanup.
- Files: wp-content/mu-plugins/missionmed-hq-proxy.php, LIVE/stat.html, CHANGELOG/CHANGELOG.md
- Notes: Rebased local HQ auth proxy to live-hotfix parity, added robust cookie forwarding fallback (`HTTP_COOKIE` + `$_COOKIE`) without weakening auth boundaries, added non-secret diagnostic response header `X-MissionMed-Auth-Cookie-Source`, and replaced misleading STAT default player identity placeholders from `Dr. Brian` to neutral `Guest` so unauthenticated runtime cannot be misread as authenticated identity.

## [2026-04-28 23:10 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-l
- Scope: Re-home STAT async auth deploy continuation into dedicated worktree with hygiene preflight gates and production deploy verification.
- Files: missionmed-hq/server.mjs, LIVE/stat.html, CHANGELOG/CHANGELOG.md
- Notes: Confirmed dedicated worktree safety gates, verified scoped branch diff only, validated Railway production mapping for `missionmed-hq-production.up.railway.app`, deployed backend from worktree branch `e8-stat-async-auth-500h`, and executed STAGING→LIVE deploy pipeline plus live route smoke.

## [2026-04-28 11:32 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-d
- Scope: Verification and deploy pass for STAT human opponent lookup + friend challenge UX to STAGING/LIVE.
- Files: LIVE/stat.html, CHANGELOG/CHANGELOG.md
- Notes: Re-validated RPC presence through Supabase REST schema/permission responses, validated STAT deploy gate, and completed clean-pipeline STAGING→LIVE deployment/runtime verification for friend-mode opponent email/user-id challenge UX.

## [2026-04-28 10:40 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-c
- Scope: STAT human challenge UX/auth identity stabilization for live two-user async duel testing.
- Files: LIVE/stat.html, supabase/migrations/20260428053000_mr_stat_human_async_duel_opponent_lookup_500c.sql
- Notes: Added friend-mode pre-lock opponent field in Configure Challenge, blocked friend-mode bot fallback unless opponent resolves, upgraded challenge modal/manual path to accept exact email or UUID, added debug-gated auth diagnostics (`debug_auth=1` or `debug_duel=1`) with WordPress/Supabase session status lines, introduced scoped authenticated RPC `resolve_duel_opponent(identifier)` for exact opponent resolution with minimal returned identity, added a debug-only fallback map for `?cb=035_off` / `debug_duel=1` test emails (`match@...`, `alumni@...`) when RPC lookup is unavailable, and normalized helper-email HTML encoding to preserve STAGING/LIVE checksum stability through CDN transforms.

## [2026-04-26 02:33 UTC] MR-SYSTEM-IMPLEMENTATION-HANDOFF-005

**Files Modified:** System structure
**Change:** System structure initialized
**Risk Level:** HIGH
**Deployed:** NO
**Deployed By:** Codex
**Rollback Hash:** 9e4e0a3

## [2026-04-26 02:37 UTC] MR-SYSTEM-IMPLEMENTATION-HANDOFF-005

**Files Modified:** LIVE/arena_v1.html
**Change:** Canary comment-only change for full pipeline verification
**Risk Level:** HIGH
**Deployed:** NO
**Deployed By:** Codex
**Rollback Hash:** 9e4e0a3

## [2026-04-26 15:34 UTC]
- PROMPT: MR-E3-OUTBOX-REINTRODUCTION-016
- Scope: Feature-flagged E3 IndexedDB outbox reintroduction in LIVE STAT only.
- Files: LIVE/stat_latest.html
- Notes: Added default-OFF outbox gate with URL/localStorage/global flag paths, wired telemetry queue and flush fallback paths, preserved MMOS/auth and gameplay core behavior.

## [2026-04-26 21:10 UTC]
- PROMPT: MR-E3-OUTBOX-DUEL-SYNC-ENDTOEND-024
- Scope: STAT duel sync/outbox canary stabilization with no MMOS/auth architecture changes.
- Files: LIVE/stat_latest.html
- Notes: Normalized E3 telemetry payloads (uuid client_event_id + canonical question/pack metadata fallback), hardened outbox 409/UUID failure classification, added safe bot-duel submit soft-accept path when backend returns `duel_not_ready_for_attempt` in `active` state, and primed canonical duel metadata from `create_duel` response so E3 telemetry can resolve pack hash/question IDs before complete_match.

## [2026-04-27 08:46 UTC]
- PROMPT: MR-E3-BACKEND-CONTRACT-REPAIR-025
- Scope: Backend contract repair for Railway auth availability + E3 telemetry/duel schema compatibility.
- Files: package.json, railway.json, supabase/migrations/20260427044500_e3_backend_contract_repair.sql, supabase/snippets/20260427_e3_stat_duel_contract_repair_validation.sql
- Notes: Added explicit backend start entrypoint for Railway (`node missionmed-hq/server.mjs`), added Railway deploy manifest, patched `private_e3_ensure_match_attempt` to bridge runtime `duel_challenges` IDs into legacy `duels` FK parent when required, updated `submit_attempt` state gate to accept `active` bot-duel progression, and added rollback-safe SQL validation harness for create_duel/submit_attempt/telemetry/complete_match/idempotency checks.

## [2026-04-27 11:07 UTC]
- PROMPT: MR-R2-CREDENTIAL-CDN-REPAIR-027
- Scope: R2 credential/CDN mirror workflow hardening only (no runtime HTML routing/path rewrite).
- Files: _SYSTEM/deploy.sh, _SYSTEM/mirror_live_assets.sh, _SYSTEM/r2.env.example, .gitignore
- Notes: Added shared `_SYSTEM/r2.env` credential loader fallback to deploy pipeline, added non-secret R2 env template, added safe mirror script with preflight source checks + non-destructive signed write test + per-object verification, and gitignored local `_SYSTEM/r2.env`. Mirror remains blocked pending valid R2 write credentials (signed write returns 403).

## [2026-04-27 15:42 UTC]
- PROMPT: MR-R2-SPECIAL-CHAR-ASSET-MIRROR-029
- Scope: Fix special-character asset mirror handling for `STAT!` object and complete LIVE dependency mirroring.
- Files: _SYSTEM/mirror_live_assets.sh
- Notes: Added safe R2 key encoding helper for signed S3 requests, wired encoded key handling into probe/put/copy operations, and added script options `--test-only` plus `--only-source` for targeted retries. Verified full mirror pass `7/7` including `Mode_Lobby_Imagecard_STAT!_Duels.JPG` under `html-system/LIVE/`.

## [2026-04-27 15:54 UTC]
- PROMPT: MR-CDN-PREFIX-NORMALIZATION-031
- Scope: Normalize LIVE runtime asset prefixes to the finalized CDN `html-system/LIVE/` tree for verified Shared and STAT data dependencies.
- Files: LIVE/arena.html, LIVE/stat.html, LIVE/drills.html
- Notes: Replaced legacy internal asset prefixes `html-system/Shared/` and `html-system/STAT_VERSIONS/` with `html-system/LIVE/Shared/` and `html-system/LIVE/STAT_VERSIONS/` only where mirrored LIVE assets were verified; no route filename, MMOS, auth, or gameplay logic changes.

## [2026-04-27 16:05 UTC]
- PROMPT: MR-GOLD-STABLE-BUILD-LOCK-032
- Gold Build: `2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032`
- Source Commit Hash: `909b313`
- CDN Archive Path: `https://cdn.missionmedinstitute.com/html-system/GOLD_BUILDS/2026-04-27/`
- Validation: `validate_deploy PASS`, `validate_runtime LIVE PASS`, `/arena|/stat|/drills|/daily = 200`, required mirrored LIVE assets = `7/7 200`
- Rollback Instructions: `GOLD_BUILDS/2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032/ROLLBACK.md`
- E3 Status: outbox remains internal-only and default OFF; replay/avatar bridge remains blocked (not enabled).

## [2026-04-27 20:45 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-b
- Scope: STAT human async duel contract repair apply/validate/deploy preparation in clean isolated context.
- Files: LIVE/stat.html, supabase/migrations/20260427131000_mr_stat_human_async_duel_contract_repair_035.sql, VALIDATION/stat_async_duel_contract_035.sql
- Notes: Applied scoped MR-035 migration to RankListIQ (`fglyvdykwgbuivikqoah`) via isolated Supabase workdir, aligned frontend human duel pack activation to canonical sealed pack path, normalized submit payload to `choice_index`, aligned incoming challenge detection to `duel_challenges` query path with roster fallback, and added rollback-safe SQL harness for two-user async contract validation.

## [2026-04-28 14:35 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-j
- Scope: Runtime-vs-HQ auth separation for STAT exchange/bootstrap without changing HQ admin token policy.
- Files: missionmed-hq/server.mjs, LIVE/stat.html
- Notes: Added runtime audience/session tagging for `/api/auth/exchange`, preserved admin-only HQ token semantics, blocked runtime sessions from protected `/api/hq/*` APIs, and removed STAT runtime fallback to `/wp-json/missionmed-command-center/v1/auth/token` so STAT uses runtime exchange/bootstrap flow only.

## [2026-04-28 22:50 UTC]
- PROMPT: (E8)-STAT+Async-codex-high-500-k
- Scope: Confirm production Railway target ownership and perform scoped backend/CDN deployment validation for STAT runtime auth separation.
- Files: CHANGELOG/CHANGELOG.md
- Notes: Confirmed Railway production mapping for `missionmed-hq-production.up.railway.app` to service `missionmed-hq` in project `missionmed-hq-fix005`, deployed backend to that service, and prepared 500-k deploy validation + manual subscriber/admin browser verification steps.

## [2026-04-29 14:30 UTC]
- PROMPT: (E8)-STAT+Async-codex-extra-high-500-z
- Scope: Temporarily disable embedded Arena login form and force unauthenticated users through WordPress `/my-account` return flow back to `/arena` before exchange/bootstrap.
- Files: LIVE/arena.html, CHANGELOG/CHANGELOG.md
- Notes: Removed embedded login-form injection from Arena auth panel, preserved login/register links with `/my-account` redirect flow, and added unauth redirect trigger so Arena always routes through WordPress login prior to runtime exchange/bootstrap. Preserved 500-t logout cleanup behavior.
