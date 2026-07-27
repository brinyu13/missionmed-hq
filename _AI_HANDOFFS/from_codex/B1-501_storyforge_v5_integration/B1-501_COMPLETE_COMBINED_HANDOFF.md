# B1-501 Complete Combined Handoff

MissionMed StoryForge V5 Matrix Integration

Recorded 2026-07-26

Local outcome: **PASS — all seven B1-501 gates green**

Production outcome: **NOT DEPLOYED; B1-502 remains blocked pending the checklist at the end**

This file consolidates the complete contents and decisions of the B1-501 Markdown deliverables in this directory.

## 1. Preflight

Branch: `b1-501-storyforge-v5-production-integration`

Starting commit: `be43c6d0a4520ed761a3d112a25452f26683f9ca`

### Authority

- Canonical V5 authority: `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
- Required and observed SHA-256: `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- The twenty B1-500 invariants and rejected-interpretation corrections remain binding.
- No product workflow, schema, RLS, state transition, or existing test was changed.

### Protected runtime

The required Matrix guard confirmed matching manifest/origin/public hashes, then exited `42` because every protected `missionmed-hub` source is absent from this exact worktree.

```bash
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/B1-StoryForge-501 \
  --assets all \
  --verify-public
```

Decision:

- **DO NOT TOUCH** `wp-content/plugins/missionmed-hub`.
- No recovery override was used.
- Matching public hashes were not treated as source-edit authority.
- Work proceeded only through the isolated plugin, edge configuration, and SPA auth/base-path seam authorized by B1-501.

### Repository mappings

| Authority assumption | Repository fact | B1-501 adaptation |
|---|---|---|
| Existing token bridge | No production WP bridge existed in this worktree. | Added `POST /wp-json/missionmed/v1/storyforge/token` in the isolated plugin. |
| Claims | B1-500 consumes `sub`, `app_role`, `storyforge_eligible`; identity display uses `wp_user_id` and `name`. | The issuer emits those claims plus standard purpose, timing, and unique-token claims. |
| SPA configuration | B1-500 uses `server/config.mjs` and `/api/config`. | Extended that seam with mount/auth/navigation configuration and no secrets. |
| Edge convention | No deployable B1-500 edge route existed. | Added minimal Cloudflare Worker static-assets routing; the production target remains a B1-502 input. |
| WP development environment | None existed for this package. | Added isolated disposable WordPress and MariaDB Compose services. |
| Mentor assignment source | B1-500 owns `public.sf_mentor_assignments` enforcement rows but no production WP export/sync. | Added a WP export adapter and local reconciliation tool; production ownership remains blocked. |
| 360 entitlement | Trusted `mmhq_cam_build_entitlement()` exists in the broader WP runtime but its protected owner is absent here. | Production students fail closed without it; a constant-gated fixture is local-only. |

No remote system, DNS record, production database, hosting project, or deployment was touched.

## 2. Seam 1 — WordPress SSO and Navigation

Status: **IMPLEMENTED and locally verified.**

Files:

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- `wp-content/plugins/missionmed-storyforge-sso/uninstall.php`
- `wp-content/plugins/missionmed-storyforge-sso/README.md`

The plugin:

- defaults `storyforge_enabled` to false;
- provides a cookie-authenticated AJAX bootstrap returning a WordPress REST nonce;
- provides `POST /wp-json/missionmed/v1/storyforge/token`;
- verifies origin, nonce, WordPress session, allowed role/cohort, and live server entitlement on every issue;
- rate limits by user and request IP;
- signs short-lived HS256 tokens using only an environment variable or server constant;
- emits B1-compatible `sub`, `app_role`, `storyforge_eligible`, `wp_user_id`, and `name`;
- fails closed for missing signer, UUID mapping, session, role, cohort, assignment, or trusted entitlement;
- maps `manage_options` to `admin`, mentor/advisor/coach to `mentor`, and other eligible users to `student`;
- requires current assignments for mentors;
- uses `mmhq_cam_build_entitlement()` for production student eligibility;
- exposes a fixture entitlement only when WordPress is explicitly local and `MISSIONMED_STORYFORGE_LOCAL_FIXTURES` is defined;
- adds server-gated Matrix navigation/tile filters, a configured menu-location hook, and local verification shortcodes;
- forces the feature flag off and clears tracked rate-limit transients on deactivation;
- deletes plugin options on uninstall.

Protected `missionmed-hub` assets were not changed.

## 3. Seam 2 — Same-Origin Edge Routing

Status: **IMPLEMENTED as code and locally verified; NOT DEPLOYED.**

Files:

- `storyforge-v5/infra/edge/worker.mjs`
- `storyforge-v5/infra/edge/wrangler.toml`
- `storyforge-v5/infra/edge/local-router.mjs`
- `storyforge-v5/scripts/build-static.mjs`
- `storyforge-v5/scripts/scan-bundle-secrets.mjs`
- `storyforge-v5/dist/`

Behavior:

- `/storyforge/*` is owned before WordPress.
- Nested client routes fall back to `index.html`.
- `index.html` is `no-store`.
- Hashed assets are `public, max-age=31536000, immutable`.
- `/storyforge/api/*` and `/storyforge/healthz` proxy to the StoryForge origin.
- Non-StoryForge paths remain WordPress-owned.
- The local proxy preserves the public forwarded host/protocol and removes stale decompression headers.
- The application pins allowed origins to the Matrix origin and rejects foreign origins.
- `workers_dev=false`; preview URLs are disabled.
- `STORYFORGE_ORIGIN` is intentionally absent from source and belongs in a protected B1-502 platform store.
- The bundle scan rejects service-role markers, signer names, private-key blocks, and common secret-key forms.

Final local candidate hashes:

| Artifact | SHA-256 |
|---|---|
| `dist/index.html` | `ab6ef723444d5fbde8d651d8252423820972bee92670f0741a9db34dda69ba9c` |
| `dist/assets/app.af177a227970.js` | `af177a227970f40d65fd07318526fcf66e3f5d9fe7e947bd2c1f9dcd0c0f1659` |
| `dist/assets/auth.888214ef5fbc.js` | `888214ef5fbcfb81854aa740a1cea7ca892bea4ae21329818efa90e88e6fac7e` |
| `dist/assets/styles.6c4c7db3b9f3.css` | `6c4c7db3b9f3ce781487ee136643fc404f6a04ed40e95e8a191df473263e0ee7` |

These hashes identify only the local candidate.

## 4. Seam 3 — SPA Authentication and Base Path

Status: **IMPLEMENTED and locally verified.**

Files:

- `storyforge-v5/public/auth.js`
- auth/base-path-only changes in `public/app.js`, `public/index.html`, and `public/styles.css`
- configuration/mount handling in `server/config.mjs` and `server/app.mjs`

Production boot:

1. Load public runtime configuration.
2. Call the same-origin WP bootstrap with the complete current URL.
3. On missing WP session, follow the returned login URL preserving the deep link.
4. Exchange the WP REST nonce for the short-lived JWT.
5. Hold the JWT only inside the auth closure in memory.
6. Load the existing StoryForge session and API.
7. Refresh before expiry and on focus/visibility return.
8. Retry one API `401` after exchange.
9. Render truthful session-ended or eligibility-revoked lockout states.

The production JWT is never stored in `localStorage`, `sessionStorage`, or a SPA cookie.

Mount behavior:

- Client paths resolve beneath configured `/storyforge/`.
- The build injects `<base href="/storyforge/">`.
- API requests use the configured base.
- Back-to-Matrix uses configured `matrixBaseUrl`.
- Nested static routes return the SPA with the correct cache policy.

The loopback-only B1-500 fixture mode remembers only a non-secret persona name in `sessionStorage` to mint a fresh local token after reload. It never persists a JWT and is unavailable when fixture auth is off.

## 5. Validation Evidence

Status: **ALL SEVEN LOCAL GATES PASS.**

The mounted browser suite used `http://127.0.0.1:4179/storyforge/`, not `file://`.

| Gate | Result | Receipt |
|---|---|---|
| 1. WP SSO round-trip | **PASS** | Anonymous deep link reached real disposable WP login; login returned to StoryForge; nonce exchange produced a valid JWT; `/api/session` completed a PostgreSQL-backed authorized query; destroying the WP session locked the already-open app. |
| 2. Revocation | **PASS** | With a 5-second local TTL, WP eligibility revocation plus focus refresh produced `Your 360 access has changed.` and the live WP entitlement message. |
| 3. Deep link | **PASS** | `/storyforge/library?filter=mine&sort=updated` returned exactly after login. |
| 4. Route precedence | **PASS** | StoryForge route identified as `storyforge`; `/member-dashboard/` identified as `wordpress` and returned HTTP 200. |
| 5. Security/cache | **PASS** | Missing nonce 403; tampered JWT 401; foreign Origin 403 `origin_not_allowed`; bundle secret scan clean; HTML no-store; hashed asset immutable. |
| 6. B1-500 regressions | **PASS** | Unit 7/7; PostgreSQL suite PASS; unchanged browser suite 3/3 with axe/mobile. Accepted B1-500 screenshots were protected via an isolated output directory. |
| 7. Reconciliation and handoffs | **PASS locally** | WP 3, database 3, no differences, `clean: true`; all required handoffs exist. This is not a production-fidelity claim. |

Primary commands:

```bash
npm run test:integration --prefix storyforge-v5
npm test --prefix storyforge-v5
npm run test:postgres --prefix storyforge-v5
bash storyforge-v5/scripts/run-e2e.sh
npm audit --prefix storyforge-v5 --audit-level=high
php -l wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php
php -l wp-content/plugins/missionmed-storyforge-sso/uninstall.php
```

Final results:

- Integration browser: `5 passed (8.3s)`
- Existing unit suite: `7 pass, 0 fail`
- PostgreSQL authorization/lifecycle suite: `STORYFORGE_POSTGRES_SUITE_PASS`
- Existing unmodified browser suite: `3 passed (3.3s)`
- npm audit: `found 0 vulnerabilities`
- PHP/JavaScript syntax checks: pass
- Assignment reconciliation: `clean: true`
- Rollback: all stages pass

Local raw receipts:

- `evidence/gates-1-through-5-local-integration.log`
- `evidence/existing-unit-suite.log`
- `evidence/postgres-authorization-suite.log`
- `evidence/existing-b1-e2e-suite.log`
- `evidence/gate-7-mentor-assignment-reconciliation.json`
- `evidence/rollback-local-verification.txt`
- `evidence/wordpress-permalink-probe.headers`

They are local receipts, never production observations.

## 6. Rollback Runbook

Status: **All stages verified locally; no production execution is authorized.**

### Stage 1 — Flag off

Set `missionmed_storyforge_settings.storyforge_enabled=false`.

Expected:

- navigation and tile disappear;
- token/bootstrap access fails with `storyforge_disabled`;
- StoryForge data remains unchanged.

Verified:

```text
default_off_shortcodes=empty
flag_off_access_state=storyforge_disabled
```

### Stage 2 — Remove only the edge route

Remove/disable the `/storyforge/*` binding without changing the Matrix catch-all.

Expected:

- WordPress owns the path again;
- `/storyforge/` returns the ordinary WordPress 404;
- other WP permalinks remain functional.

Verified:

```text
route_removed_wordpress_http=404
```

### Stage 3 — Deactivate the plugin

Deactivate `missionmed-storyforge-sso`.

Expected:

- the feature flag is forced off;
- rate-limit transients are removed;
- navigation and token registration disappear;
- no user mapping or StoryForge data is deleted.

Verified:

```text
plugin_deactivation_forced_flag_off=true
```

Before any production action: **VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.**

## 7. Project Memory

1. A guard may verify public/origin hashes and still block edits because the protected source is absent; hash agreement is not edit authority.
2. A separate default-off plugin satisfies this ticket without editing protected Matrix assets.
3. WordPress behind a local edge needs its forwarded public host applied before canonical redirect logic or a permalink can redirect to itself.
4. A decompression proxy must remove upstream content length/encoding headers or WP login HTML can truncate.
5. Production JWTs remain memory-only; legacy local reload behavior can store only a non-secret fixture persona and mint a fresh loopback token.
6. A clean local assignment reconciliation is required evidence but does not prove the unpinned production WP source.
7. Screenshot-producing regressions should run from isolated output directories to preserve accepted evidence.
8. Route precedence and ordinary WP permalink behavior must be tested together.

Resume only under B1-502 authority. Never promote these local receipts to staging or production status.

## 8. Unresolved Production Blockers

B1-501 local result: **PASS**.

B1-502 deployment: **BLOCKED**.

1. **Protected Matrix source absent.** Required: exact protected source worktree, verified lock/manifest, and B1-502 deployment authority. The recovery override is not deployment authority.
2. **Production assignment owner unpinned.** Required: authoritative WP plugin/table/API or meta contract, owner, export semantics, and clean production reconciliation against `public.sf_mentor_assignments`.
3. **Staff role mapping unratified.** Required: approved WP capability mapping into the B1 application roles `student`, `mentor`, or `admin`.
4. **Cloudflare target unpinned.** Required: approved account/project/zone identifiers, protected `STORYFORGE_ORIGIN`, and route-ownership proof.
5. **Production database authority unpinned.** Required: exact Supabase project reference, migration-history receipt, server-held sync credentials, and verified backup/PITR restore point.
6. **Founder go decision absent.** Required: pilot roles/cohorts, deployment window, rollback owner, and explicit go/no-go.

No credentials were needed or used because B1-501 prohibited remote and production mutation.

## B1-502 Deployment Readiness Checklist

- [ ] Establish current B1-502 control-plane authority and exact deployment targets.
- [ ] **VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.**
- [ ] Obtain the protected Matrix source in the authorized worktree and rerun the guard with no override.
- [ ] Pin the production WordPress entitlement and mentor-assignment owners.
- [ ] Ratify every WP capability/role to B1 application-role mapping.
- [ ] Pin the exact StoryForge Supabase project and verify migration history.
- [ ] Verify backup/PITR and complete a restore-point receipt before any real data path is enabled.
- [ ] Pin the Cloudflare account/project/zone, `STORYFORGE_ORIGIN`, and route precedence.
- [ ] Install secrets only in protected server/platform stores; rerun the bundle scan on the deploy candidate.
- [ ] Run production-source mentor-assignment reconciliation and require `clean: true`.
- [ ] Rehearse flag-off, route-removal, and plugin-deactivation rollback against the exact targets.
- [ ] Obtain the founder go/no-go decision naming pilot roles/cohorts, window, and rollback owner.
- [ ] Keep `storyforge_enabled=false` until all receipts are reviewed and founder go is explicit.
