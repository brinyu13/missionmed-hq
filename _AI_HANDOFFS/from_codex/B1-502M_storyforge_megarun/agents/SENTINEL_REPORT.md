# SENTINEL — Premutation Safety, Authentication, Isolation, and Rollback Report

Recorded: `2026-07-27T16:38:52Z`

Wave: **B1-502M Wave 1 — read-only discovery**

Production contact or mutation by Sentinel: **NONE**

## Decision

**PREMUTATION NO-GO — SENTINEL APPROVAL WITHHELD**

This is a Wave 1 safety decision, not a terminal MegaRun outcome. Production mutation may proceed only after the blocking findings and evidence gates below are resolved and Sentinel reviews the exact mutation plan, restore identifiers, and rollback commands.

The most important verified candidate-level blockers are:

1. **The current WordPress seam does not enforce the founder-only cohort.** `storyforge_enabled` is global. `allowed_roles` and `allowed_cohorts` are not an exact-user allowlist; cohort checks apply only to students. Every WordPress user with `manage_options` maps to `admin`, receives an automatically active admin entitlement, and passes when the global flag and `admin` role are enabled. Enabling the current candidate for the founder therefore enables every other qualifying administrator.
2. **The edge worker weakens private API cache headers.** The origin sets `Cache-Control: no-store`, but `worker.mjs` rewrites non-HTML, non-fingerprinted responses—including `/storyforge/api/*`—to `Cache-Control: no-cache`. `no-cache` permits storage with revalidation and is not an acceptable private-story response policy.
3. **The database migration is explicitly unpinned.** Its header says `Target project: UNPINNED — DO NOT APPLY OUTSIDE THE ISOLATED TEST HARNESS.` No production project, migration history, backup/PITR point, co-tenancy boundary, or restore owner is established by the inspected evidence.
4. **Logout and entitlement revocation are not instantaneous server-side revocations.** WordPress session and entitlement are rechecked only when issuing or refreshing a JWT. An already issued JWT remains valid until its short expiry; `jti` is emitted but is not checked against a revocation store. This is acceptable only if the production TTL is explicitly approved, measured, and shown to bound access after logout/revocation.
5. **The founder WordPress role does not imply a founder student workflow.** A `manage_options` user is always issued `app_role=admin`. Database story capture and editing functions require `student`; the admin UI deliberately excludes private-story access. The exact founder acceptance journey and database role must be reconciled without widening private-data access or creating a role mismatch.

## Evidence basis and limits

Verified locally:

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Current branch at inspection: `b1-502-storyforge-production-deployment`
- Current local HEAD at inspection: `e76193176e50fa0f0c329b40017c3e48b94510ef`
- Verified implementation baseline: `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc`
- B1-501 local validation: integration browser 5/5, unit 7/7, browser 3/3, PostgreSQL authorization PASS, bundle/dependency scan clean, local rollback stages PASS.
- B1-502 prior result: `BLOCKED BEFORE MUTATION`; no prior production contact or mutation.
- Protected `missionmed-hub` shell, PHP owner, and legacy StoryForge assets are absent from this worktree.
- Current local protected manifests register the legacy `member-dashboard/#storyforge` Runtime V2 path and assets, not V5 `/storyforge/*`.

Candidate file fingerprints inspected:

| Candidate | SHA-256 |
|---|---|
| `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php` | `cf7c2cfe4b34a97530b22a5570bb9a6eb92dcb8f809b4bfb1718017b3e5aad38` |
| `storyforge-v5/public/auth.js` | `888214ef5fbcfb81854aa740a1cea7ca892bea4ae21329818efa90e88e6fac7e` |
| `storyforge-v5/server/auth.mjs` | `9f813662ae0f26cf44fe0c1bcd750225b447a2e8579b938565054abb87aa1517` |
| `storyforge-v5/server/db.mjs` | `c98100aa02b3710bf3e4ecc729ad2f750af26dfaf0d4a73645cbaf712f6c81cf` |
| `storyforge-v5/infra/edge/worker.mjs` | `6d73a6645ce87ac3445527174c7ee07fe1ad279e525e2c34d7c322dc03f5065b` |
| `storyforge-v5/infra/postgres/migrations/20260726150000_b1_500_storyforge_v5_foundation.sql` | `93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f` |

Not verified by Sentinel:

- any live account, hostname, provider project, route, origin, deployment, database, backup, entitlement, user mapping, cache rule, runtime revision, or production response;
- any credential value;
- any production student, mentor, or founder identifier.

## Authentication and authorization chain

| Step | Implemented candidate behavior | Safety boundary |
|---|---|---|
| 1. WordPress session | Browser uses the existing WordPress authentication cookie. Anonymous bootstrap returns a same-origin WordPress login URL preserving a sanitized `/storyforge/` return path. | WordPress remains the primary session owner. StoryForge must not create a second password login. |
| 2. Feature and entitlement | `mmsf_access_state()` checks the global `storyforge_enabled` setting, mapped app role, student cohort when configured, and a live entitlement source. | Feature flag defaults off only when the option is first created. An existing option is not reset on activation; it must be explicitly forced off and verified before deployment. |
| 3. Role mapping | `manage_options` becomes `admin`; `mentor`, `advisor`, or `coach` becomes `mentor`; other users become `student`. | This mapping is broad and is not an exact founder allowlist. Production role ownership and founder workflow compatibility must be proven. |
| 4. Entitlement source | Admin is automatically trusted/active; mentor is active when assignment IDs exist; student requires `mmhq_cam_build_entitlement()`. Local fixture entitlement requires both local environment and the fixture constant. | Mentor must remain disabled for founder launch. Student entitlement must fail closed if the protected owner is unavailable. Admin auto-entitlement is unsafe for founder-only isolation without an exact-user gate. |
| 5. Stable identity | `_missionmed_storyforge_user_id` must contain a UUID or issuance fails closed. | The founder mapping must be unique, redacted in receipts, backed up before change, and match one live `sf_users` row with the same role and eligibility. |
| 6. Bootstrap and nonce | Authenticated `admin-ajax.php?action=missionmed_storyforge_bootstrap` returns a fresh WordPress REST nonce and token endpoint; response uses WordPress no-cache headers. | Production response headers must be captured. Cross-origin bootstrap readability and return-URL safety must be tested. |
| 7. Token endpoint | POST verifies an allowed Origin when an Origin header is present, validates the REST nonce, reads the current WP session, reruns access/entitlement checks, rate-limits by user and request IP, and returns `no-store, private`. | Missing-Origin behavior is allowed by the candidate and must be explicitly accepted and tested. The REST route has a permissive registration callback, so all real authorization must remain in the endpoint callback. |
| 8. JWT | WordPress emits short-lived HS256 JWTs with `iss`, `aud`, `sub`, `iat`, `nbf`, `exp`, `jti`, `wp_user_id`, `name`, `app_role`, and `storyforge_eligible=true`. Default TTL is 120 seconds, bounded to 60–300 in production. | `STORYFORGE_JWT_SECRET` is a shared high-value secret. It must exist only in protected WordPress and app-runtime stores, be at least 32 bytes, never appear in output/logs/bundles, and have a tested rotation/rollback process. |
| 9. Browser token custody | `auth.js` holds the bearer token only in a closure in memory, refreshes before expiry and on focus/visibility, clears it on failed exchange/401, and retries one API 401. | Production must have `devAuth=false`; no JWT may appear in local/session storage, cookies, URLs, error telemetry, console logs, or service-worker caches. |
| 10. App verification | The Node origin verifies signature, issuer, audience, expiry, allowed role, eligible claim, and UUID-shaped subject. | Production issuer/audience/signing mode must match WordPress exactly. The WP producer is HS256; configuring only JWKS on the consumer would be incompatible. |
| 11. Database session | Each operation starts a transaction, sets local role `authenticated`, installs `sub`, `app_role`, and eligibility claims, then commits or rolls back. | The production connection role, ability to `SET ROLE`, RLS enforcement, pool reset behavior, and absence of elevated bypass paths must be proven against the exact project. |
| 12. RLS and RPCs | RLS requires a live `sf_users` row whose ID, role, and eligibility match signed claims. Private stories are readable only by their student owner; assigned mentors cannot read private stories, and admins have no private-story override. Writes use role-checked security-definer functions. | Direct-ID denial, unassigned mentor denial, cross-student denial, revoked identity denial, and admin no-private-story access must pass on production schema without displaying private data. |

## Logout, revocation, and expiry

The candidate has no production StoryForge logout endpoint or server-side token denylist:

- the production UI exposes Back to Matrix, not a StoryForge logout button;
- WordPress logout/session destruction prevents the next bootstrap or refresh;
- entitlement revocation prevents the next token issuance;
- a bearer token already issued remains valid until `exp`;
- `jti` is unique but is not persisted or consulted;
- focus/visibility refresh can lock the UI sooner, but it is not a substitute for the server-side expiry bound.

Approval requires:

1. exact production JWT TTL recorded without exposing the secret;
2. measured proof that a destroyed WordPress session cannot mint a new token;
3. measured proof that a revoked entitlement cannot mint a new token;
4. proof that the old token is rejected no later than TTL plus the documented five-second verifier tolerance;
5. proof that a stale tab locks on focus/visibility and that all API calls fail after expiry;
6. confirmation that no CDN, browser cache, or service worker can replay a private response after logout;
7. an explicit decision that this bounded revocation latency is acceptable for the founder cohort.

## Founder-only isolation

Required invariant: one exact redacted WordPress founder account is eligible; every other account, including another administrator, is denied through navigation, bootstrap, token issuance, direct URL, and direct API access.

Current candidate does **not** meet that invariant:

- `storyforge_enabled` is one global boolean;
- `allowed_roles` is role-wide;
- `allowed_cohorts` is checked only for students;
- every `manage_options` user becomes `admin`;
- every such admin receives an automatically trusted and active entitlement;
- mentor and student are allowed by the default settings when the global flag is enabled;
- there is no `allowed_user_ids` or equivalent exact-user check in `mmsf_access_state()`.

Sentinel will accept either:

- an explicit, fail-closed exact-user allowlist in the isolated StoryForge plugin; or
- a separately owned and registered production policy seam that provides equivalent server-side denial on every path.

The implementation must be source-reviewed and tested; a hidden UI item, client-side condition, role-only rule, cohort-only rule, or manually omitted database row is insufficient.

Before founder enablement, all of the following must be true:

- feature flag explicitly off during deployment;
- exact founder WordPress ID selected from current production session/account evidence and recorded only in redacted form;
- exact founder UUID mapping unique and consistent with the database;
- founder database row exists with the intended application role and `eligible=true`;
- all other administrators denied, even though they have `manage_options`;
- students denied;
- mentors/advisors/coaches denied and no assignment rows enable access;
- anonymous and logged-out users denied;
- direct `/storyforge/` cannot reveal data or reach an authenticated API session;
- no demo identities or local fixture rows exist;
- `STORYFORGE_DEV_AUTH` and `MISSIONMED_STORYFORGE_LOCAL_FIXTURES` are absent/false.

Role warning: the current founder WordPress admin maps to StoryForge `admin`. Admin can use governance surfaces but cannot create or edit a story and cannot read private stories. If founder acceptance requires a real student story workflow, the Supervisor must resolve the founder test identity and database role explicitly. It must not grant admin private-story access or silently treat every WordPress admin as a student.

## Cache, routing, and origin isolation

Candidate behavior:

- Worker route is configured for `missionmedinstitute.com/storyforge/*`.
- `/storyforge/api/*` and `/storyforge/healthz` proxy to `STORYFORGE_ORIGIN`.
- HTML receives `no-store`; fingerprinted assets receive immutable one-year caching.
- SPA paths fall back to `index.html`.
- paths outside the configured prefix return 404 from the Worker.

Blocking cache defect:

- the origin sets `Cache-Control: no-store` for all responses;
- `apiResponse()` passes private API responses through `withCachePolicy()`;
- `withCachePolicy()` replaces the origin header with `no-cache` for JSON/API responses.

Before approval, `/storyforge/api/*` must return at least `Cache-Control: no-store, private` end-to-end and provider cache rules must prove bypass for:

- `/storyforge/api/*`;
- WordPress AJAX bootstrap;
- `/wp-json/missionmed/v1/storyforge/token`;
- all responses bearing `Authorization` or WordPress cookies.

Additional required route evidence:

- `/storyforge` canonical redirect or ownership behavior is explicit, not only `/storyforge/`;
- `/storyforge/*` wins only its intended prefix and does not shadow WordPress, `/member-dashboard/`, other Matrix apps, admin, REST, or static assets;
- SPA deep links and refresh work;
- route removal restores the exact previous owner;
- cache purge is limited to StoryForge paths;
- the app origin cannot be used to bypass the Matrix entry/edge policy;
- direct-origin requests still require bearer authorization and do not trust Origin as authentication;
- the unauthenticated health endpoint does not disclose the production database name or other environment metadata.

## Shared dependencies and protected assets

| Boundary | Shared/protected dependency | Premutation constraint |
|---|---|---|
| WordPress authentication | Production cookies, sessions, REST nonces, login redirects, admin AJAX, user roles/capabilities | No cookie format, login, global auth, or unrelated REST changes. Capture current plugin/config state and test ordinary WP login/admin/member dashboard before and after. |
| Entitlement | Protected `mmhq_cam_build_entitlement()` owner | Locate and hash the actual production owner. Do not copy, replace, weaken, or infer its semantics. Missing/untrusted entitlement defaults to deny. |
| WordPress data | `missionmed_storyforge_settings`, rate-limit transients, founder UUID user meta, cohort/assignment meta | Snapshot exact pre-state. Do not query or print unrelated user data. Do not bulk-populate or promote demo mappings. |
| Matrix shell | Protected `student-os.js`, `student-os.css`, `class-mmed-student-os.php`, route classes, lazy loader | Prefer the isolated plugin filters only if the live shell demonstrably consumes them. Any protected edit requires current source, guard preflight, fresh Kinsta backup, scoped guarded deploy, origin/public hash verification, and all Matrix route regressions. |
| Legacy StoryForge | `student-os-storyforge.js`, `student-os-storyforge.css`, `member-dashboard/#storyforge` | Preserve as fallback through founder acceptance. Do not overwrite or delete V2 assets as part of V5 deployment. |
| Edge/CDN | Zone routes, Worker/custom domain, cache rules, WordPress catch-all, DNS | Export current configuration first. Add only the precise `/storyforge/*` binding. No broad cache, DNS, or catch-all mutation. |
| App origin | Node runtime, environment bindings, deployment revision, logs | Pin owner/project/revision. Store secrets only in provider secrets. Preserve prior deployment/config and prevent direct-origin bypass. |
| PostgreSQL/Supabase | Exact project, `public` schema, `authenticated` role, migration history, RLS, PITR | Migration must not run until the project and history are pinned and collision/co-tenancy checks pass. No root `supabase/migrations` promotion by assumption. |
| Object storage | Optional R2 endpoint, bucket, credentials, signed URLs | Leave audio unavailable unless the exact bucket, object prefix, CORS, retention, credential scope, and rollback are separately verified. |

The local Matrix lock protocol also says protected Matrix work must not silently change auth/session/bootstrap, Supabase, R2, payments, LearnDash, or production student data. B1-502M authorization is scoped to StoryForge but does not waive the guard, backup, hash, and no-regression requirements.

## Restore boundaries and exact prerequisites

### 1. WordPress StoryForge integration

Required restore evidence before change:

- current active plugin list and relevant StoryForge plugin version/hash;
- readable archive of any existing `missionmed-storyforge-sso` directory;
- JSON snapshot of `missionmed_storyforge_settings` with no secret values;
- snapshot of affected founder mapping/cohort meta only;
- current rate-limit option/transient namespace inventory;
- fresh Kinsta/WordPress database and filesystem backup ID, timestamp, scope, readability check, owner, and estimated restore time;
- presence/fingerprint—not value—of the signing-secret configuration.

Rollback:

1. set `storyforge_enabled=false`;
2. verify bootstrap/token returns `storyforge_disabled` and navigation disappears;
3. deactivate only `missionmed-storyforge-sso`;
4. restore the prior plugin directory and option/meta values if they changed;
5. verify WordPress login, admin, member dashboard, and unrelated REST routes.

Do not uninstall during emergency rollback; uninstall deletes options and is not needed to make the integration inert.

### 2. Matrix navigation/dashboard

Required restore evidence before change:

- current protected source worktree;
- successful `matrix_runtime_guard.py preflight --assets all` against current origin/public state;
- fresh Kinsta backup ID;
- local, production-origin, and cache-busted public hashes for every touched asset;
- exact protected diff and route/browser baseline for dashboard, Calendar, Scheduler, File Vault, Messages, and legacy StoryForge.

Rollback:

- if navigation is contributed only by the isolated plugin, flag-off/deactivation is the rollback;
- if any protected shell asset changes, restore only the touched asset from the fresh guard backup using the guarded process, verify origin/public hashes, and rerun all Matrix app-mode journeys.

### 3. Edge routing and cache

Required restore evidence before change:

- account/zone identifier, route owner, current route order, Worker/custom-domain bindings, DNS, cache rules, and active deployment/version IDs;
- exported readable pre-change configuration;
- current behavior for `/storyforge`, `/storyforge/`, `/storyforge/*`, `/member-dashboard/`, WordPress admin/REST, and unrelated site routes;
- exact command/API operation to restore the prior binding and prior Worker version.

Rollback:

1. feature off first;
2. remove only the new `/storyforge/*` binding;
3. restore prior Worker/custom-domain/cache configuration if altered;
4. purge only StoryForge cache keys;
5. verify WordPress and Matrix route ownership and legacy fallback.

### 4. Application origin and assets

Required restore evidence before change:

- provider project/service owner;
- current application deployment ID, artifact hashes, environment-variable name inventory, and previous working deployment;
- candidate commit and `dist` hashes;
- health/readiness definition that does not expose private environment details;
- exact provider rollback command and expected time.

Rollback:

- detach route first if the origin is unsafe;
- restore the previous app deployment/config by immutable deployment ID;
- never expose or print environment values;
- verify the origin is no longer externally reachable except through the intended edge path.

### 5. Database

Required restore evidence before change:

- exact Supabase/PostgreSQL project reference and accountable owner;
- migration ledger and collision check for every `sf_*` object;
- role/privilege and RLS state;
- fresh PITR/backup identifier, timestamp, retention window, readability/restorability proof, RPO/RTO, and restore owner;
- privacy-safe pre-migration object existence and row-count receipt;
- exact founder row/mapping plan; no demo seed;
- proof whether the database is shared with other products.

Rollback rules:

- the migration is additive and transaction-bound, so a failed application must roll back the transaction;
- after a successful migration, normal release rollback is feature-off and route/plugin rollback, leaving dormant schema/data intact;
- do not drop StoryForge objects or run a destructive down migration without a separately approved retention plan;
- do not restore a shared database merely to remove StoryForge; PITR can destroy unrelated writes;
- database restore is reserved for corruption or an independently isolated recovery target and requires post-restore RLS, migration-ledger, and application-health verification.

## Premutation gate table

| Gate | Evidence required for PASS | Wave 1 state |
|---|---|---|
| 1. Production target | Direct provider/host receipts pinning canonical WordPress/Matrix environment, current revision, owners, and deploy mechanisms | **UNVERIFIED** |
| 2. Source and revision | Clean canonical source, exact commit/artifact hashes, protected-source lock match | **PARTIAL — local candidate only** |
| 3. WordPress deployment | Current plugin owner/target, exact diff, default-off receipt, deploy and rollback command | **UNVERIFIED** |
| 4. Matrix navigation | Live hook consumption or guarded protected diff; current hashes and full app-mode regression baseline | **UNVERIFIED** |
| 5. Edge routing | Account/zone/project, exported route/cache config, precedence proof, API cache bypass, independent rollback | **FAIL — candidate API cache defect plus unpinned provider** |
| 6. Database | Exact project/history/RLS, collision-free migration, least-privilege connection, backup/PITR | **FAIL — migration explicitly unpinned** |
| 7. Founder entitlement | Exact-user server allowlist, redacted founder mapping, role-compatible DB row, other-admin denial | **FAIL — exact founder isolation absent** |
| 8. Assignment behavior | Mentor role disabled and default-deny; no production assignment import for founder launch | **POSSIBLE BUT UNPROVEN** |
| 9. Restore points | Fresh readable target-specific IDs for every changed system with owner/RTO | **NONE** |
| 10. Rollback | Exact commands against exact targets plus feature-off/route/plugin/app/DB boundaries | **PARTIAL — local rehearsal only** |
| 11. Privacy | Production RLS/direct-ID tests, no demo data, private responses noncacheable, redacted logs | **FAIL — API cache policy; production tests absent** |
| 12. Secrets | Protected store presence/fingerprints, bundle scan, log/header redaction, rotation path | **PARTIAL — local bundle scan only** |
| 13. Legacy fallback | Current V2 revision and route proven; no V2 asset change; restoration test | **PARTIAL — stale/local authority only** |

Sentinel approval requires every gate to be `PASS`. Mentor assignment may be `PASS — DISABLED` for the founder launch.

## Evidence packet required before Sentinel approval

The Supervisor must present one redacted, internally consistent packet containing:

1. production environment, repository, branch, commit, current WordPress revision, current Matrix hashes, edge deployment ID, app deployment ID, and database project/migration revision;
2. exact changed systems/files/config keys and a diff for each;
3. exact founder allowlist implementation and tests proving denial for a second administrator, student, mentor, anonymous user, logged-out user, expired token, revoked entitlement, and crafted direct API request;
4. founder WordPress-to-StoryForge UUID mapping uniqueness and matching `sf_users` role/eligibility, with identifier redacted;
5. proof mentor access is disabled and assignment reconciliation is not required for this founder-only stage;
6. API/auth cache headers at origin, edge, and browser showing `no-store, private`, plus provider cache-rule export;
7. exact issuer/audience/TTL/signing mode match and secret-presence fingerprints without values;
8. proof production fixture auth, local fixtures, demo seed, and service-role frontend keys are absent;
9. production RLS results for private-by-ID denial, cross-student denial, unassigned mentor denial, admin no-private-story access, revoked identity, and transaction rollback, reported only as counts/statuses;
10. fresh restore IDs for WordPress/filesystem, Matrix assets, edge config, app deployment/config, and database if mutated;
11. tested rollback commands, owners, RTOs, and expected post-rollback hashes/routes;
12. feature-off production validation covering Matrix login, WP admin, member dashboard, every protected Matrix module, existing legacy StoryForge, unrelated routes, static assets, and no secret/log leakage;
13. a pre-enable receipt proving `storyforge_enabled=false`, then a scoped command that enables exactly one founder identifier without enabling an entire role;
14. an immediate rollback watch plan covering route shadowing, infinite loading, entitlement leakage, private data, logout/revocation, cache mixing, asset mismatch, DB errors, and Matrix regressions.

## Mutation approval rules

Sentinel will reject any plan that:

- enables `admin` role globally as a substitute for an exact founder allowlist;
- relies on hidden navigation or client-side checks as authorization;
- deploys while the global flag may already be true;
- permits private API responses to be stored by a CDN/browser;
- applies the migration to an inferred or shared project without an exact restore boundary;
- seeds demo identities or imports the student population for founder testing;
- enables mentor access before assignment authority is reconciled;
- edits protected Matrix assets without current source, guard, backup, and hash proof;
- changes a catch-all route, DNS, WordPress auth, payments, LearnDash, or unrelated Matrix modules;
- uses a recovery override as deployment authority;
- prints tokens, cookies, user identifiers, student data, secret values, or provider credentials.

Safe execution order after approval:

1. create and verify all restore points;
2. install/deploy app, plugin, navigation, route, and any required additive migration with feature explicitly off;
3. validate Matrix/WordPress/unrelated routes, auth denial, cache isolation, assets, and rollback controls;
4. enable only the exact founder allowlist entry;
5. run founder, ineligible, logout, revocation, direct-ID, and privacy tests;
6. immediately feature-off and execute bounded rollback on any mandatory trigger.

## Mandatory rollback triggers

Immediately set the feature off and begin the bounded rollback sequence for:

- any non-founder token issuance or API session;
- access by another administrator solely because of role;
- mentor access or private-story visibility;
- cached/mixed private API responses;
- failed logout/revocation beyond the approved TTL;
- secret/token/cookie/private-data exposure;
- Matrix login, dashboard, or protected-module regression;
- route shadowing or unrelated WordPress route failure;
- infinite loading or mismatched application assets;
- incorrect database project, migration drift, RLS bypass, corruption, or unexpected non-StoryForge writes;
- loss of the legacy fallback before founder acceptance;
- inability to execute or verify the documented rollback.

Rollback order:

1. set `storyforge_enabled=false`;
2. remove only `/storyforge/*`;
3. deactivate/revert the isolated StoryForge WordPress integration;
4. restore only touched Matrix navigation/dashboard state;
5. restore prior app assets/configuration;
6. restore database only when required under the isolated, proven recovery plan;
7. verify Matrix login, member dashboard, all protected modules, WordPress, and legacy StoryForge;
8. preserve redacted logs, hashes, and receipts for diagnosis.

## Sentinel handoff

The isolated plugin, memory-only JWT design, short token TTL, transaction-local database identity, RLS, additive migration, and local rollback rehearsal are useful safety foundations. They are not production approval.

The Supervisor should route the exact-user allowlist and founder-role issue to Lorentz/Darwin, the API cache defect to Lorentz/Darwin, and all production target/restore discovery to Herschel/Sagan. Return the resulting exact diffs and redacted restore receipts to Sentinel before any production mutation.

# SENTINEL — Phased Railway / PostgreSQL Release-Gate Re-Review

Recorded: `2026-07-27T17:20:00Z`

Scope: current local candidate, B1-502M agent evidence, corrected MissionMed OS authority, and the proposed isolated Railway application plus PostgreSQL topology. This section supersedes the Wave 1 decision only for the narrowly defined Phase 0 resource bootstrap below.

Production, provider, remote Git, and protected-runtime mutation by Sentinel: **NONE**

## Current decision

**APPROVE — PHASE 0 ISOLATED RESOURCE BOOTSTRAP ONLY**

**REJECT — DATABASE BOOTSTRAP OR MIGRATION**

**REJECT — APPLICATION DEPLOYMENT**

**REJECT — WORDPRESS INSTALLATION OR CONFIGURATION**

**REJECT — CLOUDFLARE WORKER DEPLOYMENT OR ROUTE BINDING**

**REJECT — FOUNDER ENABLEMENT**

Phase 0 approval is deliberately smaller than Stage A and is not a declaration that the 13 premutation gates pass. It exists only to resolve the circular requirement that exact provider identifiers cannot be registered until new isolated resources exist. DR-011 and the corrected StoryForge passport authorize that bounded bootstrap. The Critical Systems manifest must then be updated with the resulting exact identifiers before any source deployment, database bootstrap, migration, public application domain, Worker deployment, WordPress mutation, or route binding.

## Evidence re-reviewed

- MissionMed OS `main` and locally recorded `origin/main` are both at corrective authority commit `4f3c7e89efbb55956a39066bce7e42598f55a244`.
- DR-011, the StoryForge passport, mission record, authority index, product index, generated `CURRENT.md`, and filing receipt now truthfully record a local-track, founder-only, feature-off-first deployment mission.
- The founder is represented only by opaque handle `B1-502M-FOUNDER-01`; no raw identifier or enumerable digest is in the reviewed authority.
- Direct read-only evidence records that the StoryForge Railway project/service, isolated StoryForge database, Cloudflare Worker, WordPress plugin directory, WordPress option, `/storyforge`, and `/storyforge/` were absent before mutation.
- Existing MissionMed HQ Railway runtime and all four observed Supabase projects are explicitly excluded from StoryForge ownership.
- Current production legacy StoryForge JS/CSS and Matrix PHP/shell hashes match the active Matrix lock. The isolated launch-adapter plan does not edit those protected files.
- The local plugin now has an empty-by-default exact user allowlist, an exact-user application-role override, activation that always forces the feature off, and a founder-only Matrix launch adapter.
- The local server/edge candidate now pins HS256 shared-secret verification, a canonical UUID subject, provider `PORT`, a redacted public health response, private API cache headers, and slashless `/storyforge` canonicalization.
- The latest retained Playwright integration report contains `5` expected tests, `0` unexpected tests, and `ok: true`. The unit report records `14/14` passing, and `git diff --check` passed during this review.
- The current product worktree is still dirty and contains untracked generated output. The scanner also remains ignored by the repository name pattern unless explicitly force-added. No dirty or untracked tree is an acceptable deploy baseline.
- The Critical Systems manifest still has no V5 StoryForge runtime owner, source pin, database owner, WordPress seam, route, feature flag, founder cohort, browser journey, or rollback registration.
- A fresh full PostgreSQL run, existing browser suite, clean build/diff receipt, audit receipt, and final tracked-source inventory are not yet retained for the post-repair tree.

## Phase 0 approval boundary

The Supervisor may create, in the already verified Railway account/workspace:

1. exactly one new StoryForge-specific Railway project and production environment;
2. exactly one empty StoryForge application service with no repository/source attachment and no deployment;
3. exactly one new isolated Railway PostgreSQL service in that project.

The following controls are conditions of approval:

- Reconfirm and retain the prestate that no StoryForge-named project or service exists immediately before creation.
- Use new StoryForge-specific names and copy the provider-issued project, environment, service, and database IDs exactly into a redacted receipt.
- Do not select, relink, rename, redeploy, restart, or change variables on the existing MissionMed HQ project or any other service.
- Do not attach GitHub, a repository root, a branch, a Docker image, a template application, or an automatic deployment trigger to the empty app service.
- Do not generate or retain a public application domain in Phase 0. If the provider creates one automatically, disable it before leaving the phase and record that result.
- Treat any provider-created PostgreSQL TCP proxy as credential-protected infrastructure, not as the authorized StoryForge web route. Record its enabled/disabled state without printing host credentials. The eventual app must use Railway private networking.
- Do not run `bootstrap_local.sql`, the StoryForge migration, `seed_local.sql`, ad hoc DDL, founder provisioning, or any database write beyond provider provisioning.
- Do not create a Cloudflare Worker, route, DNS record, Kinsta file, WordPress option, WordPress meta row, or secret.
- Do not print or file provider-generated passwords, connection strings, tokens, or variable values.
- Capture the exact deletion/suspension operation for only the newly created empty resources. Absence is the prestate; deletion of those exact empty resources is the Phase 0 rollback.
- Stop Phase 0 if a command resolves to an existing project/service, attaches source, starts a deployment, or targets an account other than the verified MissionMed owner.

This approval expires as soon as source, SQL, a public app domain, a non-provider-generated secret, WordPress, or Cloudflare is introduced.

## Required gate immediately after Phase 0

Before the next runtime mutation:

1. register the exact Railway project, environment, app service, PostgreSQL service, region, private-network boundary, source-root intent, deploy owner, and rollback owner in `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`;
2. update the migration header from `UNPINNED` to the exact isolated target without changing its timestamp;
3. define a real plain-PostgreSQL migration ledger; a prose receipt alone and the Supabase CLI ledger are not sufficient for this Railway database;
4. commit all intended B1-502M source and manifest changes, including the currently ignored scanner, without generated Playwright/Wrangler output or unexplained screenshot drift;
5. push the exact canonical branch and verify the remote commit before any deployment;
6. rerun and retain build, bundle scan, unit, PostgreSQL, browser, integration, PHP/Node syntax, audit, `git diff --check`, and `dist` reproducibility results.

## Database phase gate

**CURRENT DECISION: REJECT**

Approval may be requested again only with all of the following:

- exact Railway database/service/environment IDs and ownership pinned in the manifest and migration header;
- zero `sf_*` collision result and a recorded migration-ledger prestate;
- a private pre-migration custom-format logical dump, SHA-256, and successful `pg_restore --list` result;
- a separately protected globals/role backup or reproducible role-definition receipt, because `pg_dump -Fc` does not back up cluster roles;
- an exact restore command and an isolated restore target or equivalent provider-proven recovery path;
- a production-specific role bootstrap, not `bootstrap_local.sql`;
- `anon` and `authenticated` as `NOLOGIN` roles;
- `storyforge_app` as `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, and preferably `NOINHERIT`, with membership permitting only `SET ROLE authenticated`;
- proof that `storyforge_app` owns no database, schema, table, sequence, or function and has no schema-create or direct write privilege;
- a random SCRAM-protected app password passed only through protected stdin/provider secret storage;
- the application connection string built for `storyforge_app` over Railway private networking; the provider admin/deploy URL must not be installed in the app service;
- a reviewed immutable in-database migration ledger recording version `20260726150000` and the applied SHA-256;
- migration execution under the separate deploy credential with `ON_ERROR_STOP`, no `seed_local.sql`, and no demo/mentor/assignment rows;
- post-apply object, owner, grant, RLS, function-owner, ledger, and row-count receipts;
- the authorization matrix rerun through an actual `storyforge_app` connection, proving `SET LOCAL ROLE authenticated`, direct-ID denial, no `BYPASSRLS`, no direct DML, and transaction rollback.

The founder row is not a seed. It may be inserted only after the exact WordPress UUID mapping is selected, while the feature is still off, with one matching eligible `student` row and privacy-safe count evidence.

Normal rollback after a successful additive migration is feature off plus route/plugin/app rollback. Do not drop the schema, delete a founder story, or restore the database merely to undo an application release. Database restore is reserved for corruption and must run against the isolated recovery plan.

## Application-origin phase gate

**CURRENT DECISION: REJECT**

The service may not deploy until the clean remote commit, exact service root, build/install behavior, environment-name inventory, database role boundary, and rollback operation are pinned.

One additional release blocker exists in the reviewed code: the Railway Node origin currently serves the full SPA at `/` and on deep links. A generated Railway domain would therefore present a separate standalone StoryForge site. Before origin deployment, production must use an API-only origin mode or an equivalent provider/edge control that makes direct-origin UI paths fail closed while preserving `/healthz` and authenticated `/api/*`. The public health response may expose only the stable service status already implemented.

The first deployment has no prior app revision. Its rollback must therefore be captured as detach/suspend/delete of only that deployment or service, not an invented previous revision. After the first healthy immutable deployment, record its deployment ID and artifact hashes before any replacement.

Required production environment policy:

- shared-secret HS256 only for this release; JWKS unset;
- exact issuer, audience, public origin, Matrix return URL, and allowed origin;
- `STORYFORGE_DEV_AUTH` false/absent;
- local fixture variables absent;
- AI flags absent/false;
- all R2/audio variables absent;
- JWT secret at least 32 random bytes and value never printed;
- database URL belongs to `storyforge_app`, never the provider admin.

## WordPress and Matrix feature-off phase gate

**CURRENT DECISION: REJECT**

Before installing the isolated plugin, retain a fresh private Kinsta database/filesystem backup, readable WordPress export, `wp-config.php` backup, plugin-directory absence, option-row absence, exact founder-meta prestate, active-plugin list, legacy StoryForge hashes, and restore commands. Protected `missionmed-hub` files remain untouched.

Two cache defects must be repaired and tested before installation:

1. AJAX bootstrap currently calls WordPress `nocache_headers()` but does not explicitly guarantee `Cache-Control: no-store, private` plus `Pragma: no-cache` on success and error.
2. The REST token endpoint applies those headers only to its success `WP_REST_Response`; `WP_Error` responses are not covered by the helper.

The exact bootstrap and token routes must return private no-store headers for `200`, `401`, `403`, `429`, and `5xx` responses. Tests must cover both authenticated and denied paths.

Feature-off installation means:

- activate the plugin and immediately verify `storyforge_enabled=false`;
- leave `allowed_user_ids` empty during shared-health validation, or configure exactly one founder ID while the global feature remains false;
- configure a 60-second production JWT TTL;
- install the shared signer only in protected WordPress configuration;
- set one unique founder UUID mapping and matching database row without logging the raw identifiers;
- load no Matrix adapter while feature off;
- prove another administrator, students, mentors, anonymous users, and logged-out users receive no V5 navigation, bootstrap, or token.

## Edge and route phase gate

**CURRENT DECISION: REJECT**

The exact route pair is narrowly scoped:

- `missionmedinstitute.com/storyforge`
- `missionmedinstitute.com/storyforge/*`

The current Worker still has two release blockers:

1. exact `/storyforge/api` is treated as a static SPA deep link because routing proxies only `api/`; it must be classified as API and return a private no-store JSON denial/not-found response;
2. static Worker/asset responses do not set the Node origin's CSP, frame protection, referrer policy, content-type protection, or permissions policy. The Worker must apply the reviewed security-header contract to HTML and static responses, with focused Worker tests.

Before route binding, retain the Cloudflare account/zone, route-table prestate, precedence, cache-rule export, Worker version ID, asset hashes, protected origin binding, exact removal operation, and StoryForge-only purge operation. Confirm that WordPress bootstrap/token routes bypass storage and that authorization-bearing responses cannot be cached.

Rollback must remove **both** the exact `/storyforge` route and `/storyforge/*` route. Removing only the wildcard would leave the slashless redirect owner active. Verify `/storyforge`, `/storyforge/`, `/member-dashboard/`, WordPress admin/REST, Matrix modules, and unrelated site routes after removal.

## Founder enablement phase gate

**CURRENT DECISION: REJECT**

Enablement may occur only after feature-off production validation passes and all earlier gates are approved. The production option must contain exactly:

- allowlist size `1`, containing only the founder account;
- `app_role_overrides` mapping only that account to `student`;
- `allowed_roles` containing only `student`;
- no mentor roles, mentor assignments, cohorts, or general students;
- 60-second token TTL.

The matching `sf_users` row must be unique, role `student`, and eligible. No other `sf_users` rows or application records may exist before founder testing.

Required negative checks include a second administrator, ordinary student, mentor/advisor/coach, anonymous user, logged-out founder, removed allowlist, expired JWT, tampered JWT, direct `/storyforge/`, direct API, guessed story ID, and direct origin. An old token must fail no later than 65 seconds after logout or allowlist removal. Any access by a non-founder, cache mixing, fixture/demo display, private-data exposure, or inability to feature-off immediately is a mandatory rollback trigger.

## Approved rollback sequence

On a trigger, the Supervisor is approved to:

1. set `storyforge_enabled=false`;
2. remove both exact StoryForge Cloudflare route bindings;
3. deactivate only `missionmed-storyforge-sso`;
4. restore only its option/meta/config/plugin state if needed;
5. detach or suspend the isolated app deployment/domain;
6. leave a successfully applied additive database schema dormant unless corruption requires the isolated restore plan;
7. verify WordPress login/admin, member dashboard, Dashboard, Calendar, Scheduler, File Vault, Messages, legacy StoryForge, and unrelated site routes;
8. preserve sanitized evidence and continue diagnosis.

No approval is granted to mutate existing MissionMed HQ Railway services, existing Supabase projects, protected `missionmed-hub` assets, broad Cloudflare/DNS/cache configuration, student populations, mentor assignments, payments, LearnDash, or unrelated products.

# SENTINEL — Wave 7 Premutation GO/NO-GO

Recorded: `2026-07-27T17:40:28Z`

Scope: read-only review of the current B1-502M candidate, the verified isolated
Railway target and database backup receipt, the proposed Kinsta/Cloudflare/
Railway restore sequence, and the active MIYAMOTO report.

Production, provider, remote Git, protected-runtime, and product-source mutation
by Sentinel: **NONE**. Sentinel appended only this report section.

## Wave 7 decision

| Requested action | Decision |
|---|---|
| (a) Create Kinsta and edge restore points | **APPROVE — RESTORE EVIDENCE ONLY, UNDER THE BOUNDARY BELOW** |
| (b) Commit and push the release source | **REJECT — CURRENT TREE IS NOT AN APPROVED RELEASE CANDIDATE** |
| (c) Apply schema or mutate app, plugin, or edge in feature-off mode | **REJECT — PREMUTATION NO-GO REMAINS ACTIVE** |

This is not a terminal MegaRun outcome. The founder-only authorization,
private-cache, origin-isolation, identity-binding, and zero-mentor repairs are
material improvements, but they do not override an active product-authority
NO-GO or an unsafe migration runner.

## Repaired controls accepted at candidate level

Sentinel accepts the following as **locally implemented, production pending**:

- The WordPress seam has a default-empty exact `allowed_user_ids` gate. An
  administrator is not admitted merely by `manage_options`; only an exact
  allowlisted account can reach navigation, bootstrap, or token issuance.
- An exact allowlisted founder can be mapped to StoryForge role `student`
  without granting administrators a private-story override.
- WordPress bootstrap and token responses, including denied/error paths, and
  application/edge API responses are covered by `Cache-Control: no-store,
  private` plus `Pragma: no-cache`.
- Browser API calls omit WordPress credentials, and the Worker forwards only
  the allowlisted request headers; WordPress cookies are not forwarded to
  Railway.
- The Railway Node origin is API-only by default outside local fixture mode.
  `/healthz` remains a redacted health surface and direct-origin UI paths fail
  closed.
- JWT validation now requires bounded signed identity metadata, including a
  valid `jti` and positive WordPress user ID. The database transaction installs
  that WordPress ID, and the additive migration binds it to the unique
  `sf_users.wp_user_id`.
- A student with no active mentor assignment can still create and edit a
  private story, but both the server RPC and the UI deny submission and present
  mentor review as unavailable.
- Mentor enablement remains out of scope. The intended founder database starts
  with zero mentor assignments and no demo data.

These conclusions are source-level findings. They require fresh retained
post-repair tests and production negative checks before enablement.

## Production target and database backup evidence

The exact isolated Railway target is internally consistent across the manifest,
migration headers, and runner:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- production environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- application service `dab015bf-15ef-4698-9f16-cbf8cf23de7a`;
- PostgreSQL service `a4a66362-c3ba-475a-ae21-2aa46624bafe`.

The pre-migration database receipt
`B1-502M-RP-DB-PRE-20260727T173144Z` is accepted as a readable database-level
restore point: PostgreSQL 18 custom format, SHA-256 beginning `8b192d`, 885
bytes, successful `pg_restore --list`, and zero expected TOC/public-table
entries for the fresh database.

That dump does not capture cluster roles. Before SQL mutation, retain either a
protected globals/role backup or a privacy-safe receipt proving the prestate of
`anon`, `authenticated`, and `storyforge_app`, with exact compensating
operations. Do not print password hashes or provider credentials.

## New database release blocker: runner is not atomic

`storyforge-v5/scripts/apply-production-migrations.sh` is described as an atomic
production runner, but its current execution is not atomic across bootstrap and
migrations:

1. `bootstrap_production.sql` commits role and ledger changes;
2. the app password is changed in a separate command;
3. `storyforge_app` is made `LOGIN` in another command;
4. only then does the runner perform its StoryForge-object collision check;
5. each migration is subsequently applied in its own transaction.

A collision refusal, checksum refusal, or failure in the second migration can
therefore leave roles, credentials, the ledger, or the first migration
committed. The verified dump does not repair cluster-role state.

Schema mutation remains **NO-GO** until:

- all collision and ledger-prestate checks occur before the first write;
- role bootstrap, login/password state, both migrations, and ledger inserts
  either commit as one reviewed unit or have an independently tested exact
  compensation path that restores every intermediate state;
- the runner is exercised against disposable PostgreSQL 18 for success and
  forced failure after each stage;
- the resulting `storyforge_app` is verified as `LOGIN`, `NOINHERIT`,
  `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and
  `NOBYPASSRLS`, owns no StoryForge object, has no schema-create or direct-write
  privilege, and can only use the intended `authenticated` policy boundary;
- the authorization matrix is rerun through the real `storyforge_app`
  connection.

## Active MIYAMOTO NO-GO

The three MIYAMOTO release blockers remain active:

1. **P0:** the current parchment/light candidate is not the hash-pinned
   canonical dark StoryForge V5 interface;
2. **P0:** Back to Matrix disappears at tablet/mobile widths because
   `.rail-foot` is hidden and the mobile navigation has no replacement;
3. **P1:** an early `/api/config` failure exposes raw `Failed to fetch` without
   a retry or Back-to-Matrix action.

These findings independently prohibit application/static-asset release. The
current Critical Systems manifest also labels the present light `index.html`
and `app.8569a6eccfcb.js` hashes as `approved_sha256`. That approval claim is
not supportable while MIYAMOTO's P0 finding is active. Regenerate and pin the
asset hashes only after canonical reconciliation, side-by-side desktop/mobile
review, and product sign-off.

## Restore-point approval boundary

Sentinel approves creating restore evidence now because it does not alter live
request behavior:

### Kinsta

- Create a fresh private database/filesystem backup and record its immutable
  identifier, timestamp, scope, owner, RTO, and exact restore procedure.
- Retain readable archives/exports for the current active-plugin list,
  `missionmed-storyforge-sso` directory absence, StoryForge option absence,
  exact affected founder-meta prestate in redacted form, rate-limit namespace
  prestate, `wp-config.php`, and the protected legacy Matrix/StoryForge files.
- Verify archive and database readability without printing secrets, cookies,
  raw founder identifiers, private user data, or configuration values.
- Do not install, activate, configure, or upload the StoryForge plugin during
  this approval.

### Cloudflare edge

- Export and retain the account/zone-scoped Worker, route-order, cache-rule, and
  binding prestate, including the verified absence of
  `missionmed-storyforge-v5` and both StoryForge routes.
- Record exact rollback operations for deleting only the future Worker version
  and both exact route bindings:
  `missionmedinstitute.com/storyforge` and
  `missionmedinstitute.com/storyforge/*`.
- Record a StoryForge-only cache purge operation, but do not run it now.
- Do not upload a placeholder Worker, bind a route, alter DNS, alter a catch-all
  rule, or change cache behavior under this restore-point approval.

If any backup/export cannot be read back or resolves to a different site,
account, zone, or environment, this approval terminates before mutation.

## Commit/push gate

The current worktree is dirty and includes generated Wrangler/Playwright output,
changed historical screenshots, rebuilt assets, and an active UI-authority
failure. It must not be presented or pushed as release source.

Re-request approval only after:

- the three MIYAMOTO defects are repaired without weakening the signed-role,
  privacy, assignment, or fail-closed controls;
- the migration runner and role restore boundary above are repaired and tested;
- the Critical Systems manifest no longer records unapproved asset hashes;
- the canonical dark candidate is rebuilt reproducibly and its final hashes are
  registered;
- all intended source is tracked, including the ignored bundle scanner, while
  `.wrangler/`, Playwright reports, bytecode, and unrelated screenshot drift
  are excluded or restored;
- unit, PostgreSQL, existing browser, integration, edge, PHP/Node syntax,
  bundle scan, audit, critical-system gate, `git diff --check`, and rollback
  rehearsals all pass on the exact final tree;
- a clean source inventory shows no unrelated change or secret.

## Thirteen-gate Wave 7 table

| Gate | Wave 7 state | Remaining evidence |
|---|---|---|
| 1. Production target | **PASS** | Exact Kinsta, Railway, and Cloudflare owners/targets have been resolved; preserve receipts. |
| 2. Source and revision | **FAIL** | Active UI-authority mismatch, unsafe runner, dirty tree, no approved remote release commit. |
| 3. WordPress deployment | **PARTIAL / NO-GO** | Local exact-user and cache repairs pass review; Kinsta restore point, exact install/config receipt, and feature-off production checks are absent. |
| 4. Matrix navigation | **PARTIAL / NO-GO** | Isolated adapter avoids protected edits; real hook/launch behavior and protected-module regression remain unverified. |
| 5. Edge routing | **PARTIAL / NO-GO** | Exact routes, cache, cookie stripping, and rollback shape are correct locally; edge prestate export, approved assets, Worker version, and production isolation checks are absent. |
| 6. Database | **FAIL** | Exact target and readable database dump pass; atomic execution, role/global restore, post-apply grants/RLS, and real app-role tests fail or remain absent. |
| 7. Founder entitlement | **PARTIAL / NO-GO** | Exact-user enforcement passes locally; unique production WP-ID/UUID/row binding and negative-account tests remain absent. |
| 8. Assignment behavior | **PASS — DISABLED DESIGN / PRODUCTION PENDING** | Zero-mentor submit denial is implemented; production must prove zero assignments and mentor denial. |
| 9. Restore points | **PARTIAL** | Database dump exists; Kinsta, edge, plugin/config, and first-app-deployment boundaries remain to be retained. |
| 10. Rollback | **PARTIAL** | Correct order and both route removals are documented; exact target commands/IDs and a feature-off rehearsal remain pending. |
| 11. Privacy | **PARTIAL / NO-GO** | Local RLS/cache/identity controls are improved; production RLS/direct-ID/cache/logout tests and canonical error UX remain pending. |
| 12. Secrets | **PARTIAL / NO-GO** | Design keeps secrets server-side; protected secret installation, role-password handling, deployed-bundle/log scan, and rotation receipt remain pending. |
| 13. Legacy fallback | **PARTIAL / NO-GO** | Protected V2 assets are unchanged and hash-pinned; feature-off production health and post-route-removal fallback have not been exercised. |

## Conditionally acceptable feature-off sequence

The proposed sequence is acceptable in shape, but **not approved for execution
yet**:

1. create and verify the Kinsta/edge restore evidence approved above;
2. repair the UI, migration runner, manifest, and tests;
3. commit and push an approved clean release revision;
4. apply the atomic database bootstrap/migrations from the separate deploy
   credential and verify the least-privilege app-role matrix;
5. deploy the Railway origin API-only, with the `storyforge_app` private
   connection and AI/audio/dev fixtures absent;
6. install and activate the isolated WordPress plugin with
   `storyforge_enabled=false`, an empty allowlist during shared-health checks,
   and no loaded Matrix adapter;
7. upload the approved Worker version without routes, verify its artifact, then
   bind only the exact and wildcard StoryForge routes while the feature remains
   off;
8. run WordPress, Matrix, legacy, unrelated-route, cache, direct-origin, and
   feature-off regressions;
9. create exactly one bound founder row/UUID/WordPress mapping while still off,
   prove all other counts are zero, then enable exactly that founder;
10. run founder and negative-account validation, with immediate rollback on any
    mandatory trigger.

No schema, application deployment, WordPress plugin/configuration, Worker
upload, route, feature flag, founder mapping, or founder-row mutation is
approved by this Wave 7 decision.

## Wave 7 migration-runner correction

Recorded: `2026-07-27T17:45:06Z`

Review scope: the repaired production migration runner only. This correction
supersedes the earlier finding titled “New database release blocker: runner is
not atomic.” It does not alter the active MIYAMOTO, manifest, source-release, or
deployment NO-GO decisions.

**MIGRATION-RUNNER BLOCKER: RESOLVED**

The repaired runner now establishes the required inaccessible-partial-state
boundary:

- Exact Railway project and database-service identifiers, deploy commit shape,
  backup-ID shape, and password length are validated before database writes.
- Ledger presence, `sf_*` class/function collisions, migration checksums, and
  collisions for `anon`, `authenticated`, and `storyforge_app` are checked
  before mutation.
- Bootstrap SQL, every pending migration, and every matching ledger insert are
  streamed through one `psql --single-transaction` execution.
- `storyforge_app` is created as `NOLOGIN` inside that atomic transaction.
- Only after the complete schema and ledger commit succeeds does the runner
  configure a client-side SCRAM password and enable `LOGIN`.
- A password or final-login failure therefore leaves a complete, ledgered
  schema with an inaccessible `NOLOGIN` app role. The operation is safely
  rerunnable; it does not leave an accessible partially migrated role.

Disposable PostgreSQL evidence accepted:

- A forced SQL failure exited `3` and left `sf_users` absent, the migration
  ledger absent, and all three StoryForge roles absent; the retained result was
  `1|1|0`.
- A normal first run followed by an idempotent second run returned
  `2|1|0|0`: two ledgered migrations, one least-privilege login role, zero
  StoryForge users, and zero active assignments.
- A query through the app-role `SET ROLE authenticated` boundary returned zero
  rows.
- Turing independently forced a migration-ledger conflict and observed schema
  rollback.

The exact fresh Railway production prestate is also accepted:

`ledger_absent|class_objects|functions|role_collisions=1|0|0|0`

This proves the ledger is absent, no StoryForge classes or functions exist, and
none of the three role names collides on the pinned production target. Together
with the previously verified custom-format database backup, the reproducible
role definitions, transactional role creation, and exact absence receipt
resolve the earlier role/global-prestate concern without requiring restoration
of a pre-existing StoryForge role.

Execution must still use the exact verified backup identifier
`B1-502M-RP-DB-PRE-20260727T173144Z` and retain the post-apply owner, grant,
RLS, role-attribute, ledger, row-count, and real `storyforge_app` authorization
receipts. Those are execution validations, not defects in the repaired runner.

This focused PASS does **not** approve application assets, the WordPress plugin,
the Worker, route binding, founder provisioning, feature enablement, commit, or
push. The canonical dark-interface mismatch, mobile Back-to-Matrix failure, raw
fetch failure, unapproved manifest asset pins, dirty release tree, missing
remaining restore points, and production validation gates remain active.

---

# SENTINEL — Superseding Final Premutation Verdict

Recorded: `2026-07-27T18:51:22Z`

Verdict: **GO FOR FEATURE-OFF STAGE A AFTER FINAL COMMIT/PUSH; FOUNDER
ENABLEMENT REMAINS GATED**

This section supersedes the Wave 1 premutation `NO-GO` and all earlier scoped
PASS/NO-GO notes. Sentinel reviewed the final staged candidate, provider
premutation receipts, restore evidence, mutation order, and retained test
receipts. Sentinel did not contact or mutate production, stage files, commit,
push, or deploy.

## Resolved Wave 1 blockers

- Admission is enforced by a default-empty exact WordPress user-ID allowlist
  before role, navigation, bootstrap, or token issuance. The exact founder may
  be mapped from native WordPress administrator to StoryForge `student`; every
  other administrator remains denied.
- Activation and deactivation force `storyforge_enabled=false`.
- WordPress bootstrap/token success and failure responses are
  `no-store, private`. Token issuance requires a live WordPress session, REST
  nonce, exact-user access, current entitlement, stable UUID mapping, and
  configured signer.
- JWT verification requires signature, issuer, audience, `iat`, `exp`, `jti`,
  UUID subject, positive WordPress user ID, role, and eligibility. Tokens stay
  in memory. Browser API requests omit cookies, and the Worker forwards only
  `accept`, `authorization`, `content-type`, and `origin`.
- Worker API success and failure responses are forced to
  `no-store, private`; HTML and errors are noncacheable; only successful
  fingerprinted assets are immutable. Missing fingerprinted assets are not
  cached.
- Database identity binds UUID, WordPress user ID, role, and eligibility.
  `storyforge_app` is `NOINHERIT`, `NOBYPASSRLS`, and non-superuser, owns no
  StoryForge object, and must enter the transaction-local `authenticated`
  policy role.
- The runner pins the exact Railway project/database service, requires the full
  release commit and backup ID, checks collision/ledger state, and applies
  bootstrap, three migrations, and ledger rows atomically.
  `storyforge_app` remains `NOLOGIN` until schema commit.
- Zero-assignment submission is denied before state mutation. Mentor access
  and assignment import remain disabled.
- Production fails startup unless the Railway origin is API-only at
  `/storyforge/`. Its exact upload root is `storyforge-v5/`; repository-root
  upload is prohibited.
- The Worker owns only `missionmedinstitute.com/storyforge` and
  `missionmedinstitute.com/storyforge/*`; the complete observed route
  inventory had no precedence conflict.
- Protected `missionmed-hub`, legacy StoryForge, `LIVE/`, `missionmed-hq/`,
  and root `supabase/` paths have no candidate changes. Live, public, backup,
  and delegated-lock hashes agree for all four protected assets.

## Restore and rollback approval

Readable premutation references:

- Kinsta/WordPress/Matrix:
  `B1-502M-RP-KINSTA-PRE-20260727T174625Z`;
- isolated PostgreSQL:
  `B1-502M-RP-DB-PRE-20260727T173144Z`;
- Cloudflare absent state:
  `B1-502M-RP-CF-ABSENT-20260727T174734Z`;
- Railway application absent state:
  `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

The Kinsta archive passed an isolated extraction rehearsal and all protected
hashes matched. The PostgreSQL 18 custom dump passed `pg_restore --list` and
represents the verified empty before-state.

Approved fail-safe rollback:

1. force `storyforge_enabled=false`;
2. remove only the two StoryForge Worker routes/Worker, returning the recorded
   origin-owned `404` state;
3. deactivate only `missionmed-storyforge-sso` and take only the isolated
   Railway StoryForge application offline;
4. leave the isolated database dormant during normal rollback, restoring its
   empty backup only for proven corruption;
5. reverify Matrix login, WordPress admin, member dashboard, legacy
   StoryForge, unrelated routes, and the protected hashes.

No protected `missionmed-hub` restoration is part of normal rollback because
this release does not modify it.

## Final local release-candidate evidence

- unit: **23/23 PASS**;
- real PostgreSQL authorization/lifecycle: **PASS** with
  `STORYFORGE_POSTGRES_SUITE_PASS`;
- browser/API: **7/7 PASS**;
- serialized WordPress/PostgreSQL/edge integration: **6/6 PASS**;
- critical-systems local pins: **14/14 PASS**;
- deterministic build, Wrangler dry-run inventory, bundle scan, dependency
  audit, syntax checks, and `git diff --check`: **PASS**;
- final built hashes:
  - index `e01b4565a81b0ca796e485dbda29417adc7e30c7f4dcb55144a4624a1bdcd7b6`;
  - app `be5fd3fe4ee9ff840d103dab448010bec5204a01748f83ba2785f839185399fd`;
  - auth `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`;
  - styles `0938034a27f6a288ae621eb2c222f2d5748bb0d6f880ab58ad08af2a9414fb4e`.

## Exact remaining execution conditions

These are point-of-execution conditions, not implementation defects:

1. Commit the exact candidate, push normally, and use that full commit SHA in
   the migration ledger and provider receipts.
2. Immediately before mutation, reverify backup readability, protected hashes,
   the isolated database's empty/collision-free state, and continued
   Worker/route absence.
3. Keep the plugin's allowlist empty and feature flag explicitly false through
   schema, origin, plugin, Worker, route, cache, and shared-system health
   validation.
4. Do not create the founder row/mapping or enable Stage B until current
   production evidence selects exactly one founder account. A broad name match
   is insufficient. Prove that account is the sole allowlist entry, has the
   sole `student` override, matches the one `sf_users.wp_user_id`/UUID row,
   and leaves all other administrators, students, mentors, and anonymous users
   denied.
5. After migration, prove three exact ledger checksums, required role
   attributes/ownership/grants, zero users, and zero assignments. After founder
   binding, prove exactly one eligible student, zero assignments, and no
   demo/fixture/import/story/audio/AI data.
6. Production must use HS256 consistently with the protected signer,
   developer auth and local fixtures off, API-only origin, canonical base path,
   AI off, audio unconfigured, and mentor access off.
7. Cloudflare Cache Rules and legacy Page Rules remain configuration-level
   **UNKNOWN** because the available OAuth credential lacks both read scopes.
   Founder enablement is prohibited unless repeated cache-busted production
   probes show HTML, API, bootstrap/token, denial, and missing-asset responses
   are dynamic with no `Age` and required noncacheable headers. Any `HIT`,
   nonzero `Age`, or weakened private cache header is an immediate rollback
   trigger.
8. Stage B requires the real founder Matrix journey plus negative-account
   checks: no second login, canonical dark V5 hashes, bounded startup,
   deep-link refresh, Back to Matrix session continuity, other-admin/student/
   mentor denial, logout/revocation within TTL plus five-second verifier
   tolerance, direct-ID privacy, and no secret/private data in logs or
   responses.

Subject to these exact conditions, Sentinel approves the bounded feature-off
Stage A plan. Sentinel does not approve founder enablement by role, by a
non-unique identity match, before effective cache checks, or before the
matching WordPress/UUID/database binding is proven.
