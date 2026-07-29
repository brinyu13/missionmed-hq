# B1-504B · Routing, CDN, WordPress, and Matrix Specification

Labels and ladder per the Infrastructure Authority Lock.

## 1. Public surface (VPT unless noted)

- Public URL: `https://missionmedinstitute.com/storyforge/` (base path enforced: production requires `STORYFORGE_BASE_PATH=/storyforge/`, VST config.mjs validateConfig).
- Matrix entry: the member dashboard (`/member-dashboard/`, VST default `matrix_url`) exposes the StoryForge launch only after the server-side access check passes; `assets/matrix-launch.js` is enqueued only on success (VST plugin README). Feature-off or plugin deactivation restores the protected legacy `#storyforge` behavior without touching `missionmed-hub` (VST).
- Frontend host: WordPress/Kinsta via the isolated MU route (`infra/wordpress/missionmed-storyforge-route.php`); immutable assets served with `public, max-age=31536000, immutable` (VST line 731); release identity via Kinsta pointer.
- API origin: Railway, API-only (`STORYFORGE_ORIGIN_API_ONLY=true` required in production, VST). SPA fallback and asset serving stay on the WP route, not the API.
- Cloudflare: DNS + proxy; B1-503 recorded `Cloudflare: DYNAMIC`, `Kinsta: BYPASS`, no `Age` on the app document (VPT), which is the required cache posture: HTML never cached at edge; hashed assets immutable. The dormant `infra/edge` worker is NOT part of Phase 1 (AA); RP-4 must prove no `/storyforge/*` worker route is active; if one is active, BLOCKER to Fable.

## 2. Identity and token flow (VST, verified line-level this run)

Token mint (WP plugin `missionmed-storyforge-sso.php`):
- Access decision `mmsf_entitlement_for_user`: native role mapping, allowlist `allowed_user_ids`, per-user `app_role_overrides` (student/mentor/admin), `allowed_roles`, cohort gate: when `allowed_cohorts` is non-empty, the user's cohort (`_missionmed_storyforge_cohort` meta, fallback `_mmed_cohort`, filter `missionmed_storyforge_user_cohort`) must match or the REST route returns `WP_Error('cohort_not_enabled', 403)`.
- JWT (HS256, `mmsf_issue_jwt`): claims `iss` (settings issuer), `aud` (`storyforge`), `sub` (StoryForge UUID from `mmsf_storyforge_user_id`), `iat`, `nbf` (now-2), `exp` (TTL clamp 60..300 s; default 120; B1-503 production = 60, VPT), `jti` (UUID), `wp_user_id`, `name`, `app_role`, `storyforge_eligible: true`, and `cohort` WHEN NON-EMPTY. VERIFIED SOURCE TRUTH: the cohort claim ALREADY EXISTS in the minted token. Signing secret must be >= 32 chars or the route returns 503 `storyforge_signer_unavailable`.
- Rate limiting: `missionmed_storyforge_rate_keys` option, 20 requests / 60 s defaults (VST).

API verification (`server/auth.mjs`, VST):
- jose `jwtVerify`, HS256 (or JWKS if configured), issuer + audience pinned, clockTolerance 5 s, required claims `sub, iat, exp, jti`; enforces `app_role` in {student, mentor, admin}, `storyforge_eligible === true`, UUID-shaped `sub` and `jti`, positive integer `wp_user_id`. Returns frozen identity `{sub, role, eligible, wpUserId, name, issuer}`.
- BINDING CHANGE (the only auth change in Phase 1, AA): extend the frozen identity with `cohort: String(claims.cohort || '')`. No WordPress change is required for cohort scoping; B1-504A's R-6 is resolved by this one-line API-side surface. The R-8 admin-role mapping follows the TWO-ACCOUNT RULE (Flag Authority Section 3): the founder's pilot account keeps its `student` override; a separate founder-controlled account receives the `admin` override, a WP SETTINGS change (not plugin code), executed backup-first per the carried Acceptance 2b rule. This narrowly extends the B1-504A R-8 stop-scope exemption: adding the admin account touches `allowed_user_ids` membership, and that specific addition is exempt because it grants no student any access; every other membership change stays hard-stopped without B1-505.
- Refresh: frontend refreshes tokens with skew `STORYFORGE_TOKEN_REFRESH_SKEW_SECONDS` (default 15 s, VST); logout and revocation are WordPress-session governed; the 60 s TTL is the revocation window (VPT discipline from B1-503 cutover: one TTL plus margin).
- Dev fixtures: loopback-only `issueDevToken` personas incl. cross-student and unassigned-mentor identities (VST), used by the authorization suites.

Denied access behavior (VST plugin + app):
- Not signed in: WP token route requires authentication; direct `/storyforge/` route follows the server-side access check; denied users see the plugin's denial response, and Matrix simply does not enqueue the launch.
- Signed in, not entitled: 403 with exact codes `storyforge_disabled` equivalent (`storyforge_enabled` false), `cohort_not_enabled`, or unmapped-identity 503 `storyforge_identity_unmapped` (VST). Copy for these states already exists in plugin responses; Phase 1 adds no new denial copy at the WP layer.
- API side: missing/invalid token -> `auth_required` / verification errors; ineligible -> `eligibility_required` (VST). Voice endpoints add `voice_disabled` 403 (B1-504A contract, carried).

## 3. Browser security posture (AA)

- CORS: API pins `STORYFORGE_ALLOWED_ORIGINS` (must be non-empty in production, VST); browser calls carry `Authorization: Bearer`; no cookies are used by the API; `credentials: omit` on direct R2 PUTs (VST app.js). CSRF exposure is therefore token-based, not cookie-based; no CSRF token machinery is added.
- JWT storage: in-memory in the SPA with refresh via the WP session (existing pattern, VST `public/auth.js` + bootstrap path). Binding: do not move tokens to localStorage.
- CSP: the WP route serves the app shell today without a StoryForge-specific CSP header (no CSP directives found in the route PHP, VST). AA: Phase 1 does not introduce a new CSP (a wrong CSP is a production-breaking change outside this release's need); the only new origins the app touches are the API origin and the R2 presigned host, both HTTPS. A CSP hardening pass is a post-Phase-1 item, recorded in the runbook backlog.
- `allow="microphone"`: RP-10 includes capturing whether `/storyforge/` renders inside any iframe in production (evidence says it is a direct route, VPT screenshots; if any iframe embedding exists, the embed must carry the microphone allow attribute; outcome table in the Discovery Packet).

## 4. Health, rollback routing

- API health: `GET /healthz` (VST app.mjs line 2016; Railway healthcheck bound to it).
- Frontend rollback: Kinsta pointer rollback script (VST), restores prior immutable release atomically.
- API rollback: redeploy prior Railway build (B1-503 pattern, VPT).
- WP rollback: restore plugin files + `missionmed_storyforge_settings` from the pre-change backup (carried rule).
- No DNS, zone, or Cloudflare changes are authorized in Phase 1 (AA). Any discovered need is a BLOCKER back to Fable.
