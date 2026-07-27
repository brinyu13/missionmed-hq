# LORENTZ Wave 1 Interface Boundary Report

Recorded: 2026-07-27

Scope: read-only repository and contract inspection. No production contact or mutation.

## Verified boundary map

1. Matrix and WordPress
   - Current protected Matrix runtime owns the legacy `member-dashboard/#storyforge` module.
   - The current protected PHP source builds the StoryForge module directly when its legacy bootstrap is enabled.
   - The protected Matrix JavaScript registers a fixed `storyforge` runtime and only treats CAM `launch_url` as an external launch contract.
   - The B1-501 isolated plugin adds `missionmed_matrix_navigation_items` and `missionmed_matrix_dashboard_tiles` filters, but no current protected source consumes those filter names.
   - The isolated plugin can add a normal WordPress menu item, but that is not evidence of a Matrix sidebar entry.

2. WordPress to StoryForge authentication
   - The plugin obtains identity only from the current WordPress session.
   - Bootstrap returns a REST nonce and same-origin token endpoint.
   - Token issuance rechecks session, Origin, nonce, role, cohort, entitlement, UUID mapping, rate limit, and signer.
   - JWTs are short lived and contain `sub`, `wp_user_id`, `name`, `app_role`, and `storyforge_eligible`.
   - Production signing accepts only `STORYFORGE_JWT_SECRET` from the server environment or protected constant.
   - The browser keeps the token in memory and silently refreshes it; it does not persist the token in browser storage.

3. Founder-only boundary
   - Current plugin configuration permits roles and student cohorts, not an exact WordPress user allowlist.
   - Enabling role `admin` would allow every account with `manage_options`, contrary to the B1-502M exact-founder requirement.
   - This is a verified release-blocking interface gap. The smallest candidate repair is a server-enforced exact WordPress user-ID allowlist that defaults empty/deny and applies before entitlement, navigation, bootstrap, and token issuance.
   - The founder production WordPress identifier must be learned from a privacy-safe authenticated production query and stored only in protected server configuration or a narrowly scoped WordPress option.

4. Application API and database
   - The Node application validates issuer, audience, signature, expiry, role, eligibility, and UUID subject.
   - Each database operation begins a transaction, sets role `authenticated`, sets request JWT claims locally, and relies on PostgreSQL RLS/functions.
   - Required production bindings include database URL, public origin, Matrix return URL, WordPress bootstrap/token paths, allowed origin, issuer/audience, and one signing verification method.
   - The foundation migration is isolated under `storyforge-v5/infra/postgres/migrations`; it is not registered in any pinned production migration history.

5. Edge routing
   - Candidate Worker route is `missionmedinstitute.com/storyforge/*`.
   - Static assets are served from the Worker asset binding; deep links fall back to `index.html`.
   - HTML is `no-store`; hashed assets are immutable; other responses are `no-cache`.
   - `/storyforge/api/*` and `/storyforge/healthz` proxy to protected `STORYFORGE_ORIGIN`.
   - The candidate config does not identify the production account, zone, Worker deployment revision, application origin, or protected secret store.

6. Back to Matrix
   - Runtime configuration defaults to `https://missionmedinstitute.com/member-dashboard/`.
   - This produces a same-origin return boundary, but the exact founder journey must be verified in the real Matrix UI.

## Minimal transformation candidates

1. Add an exact, default-empty WordPress user-ID allowlist to the isolated plugin and cover it with unit/integration tests.
2. Integrate the Matrix entry without replacing legacy V2:
   - preferred: a founder-only isolated-plugin launch interceptor or a verified extension hook that sends the existing StoryForge entry to `/storyforge/`;
   - alternative only if required by runtime evidence: a guarded minimal protected Matrix change based on the exact current locked source.
3. Pin and deploy a real Node application origin before binding the edge route.
4. Apply the database migration only to an explicitly pinned StoryForge project with verified backup/PITR and migration ledger.
5. Keep mentor roles absent from the allowlist and `allowed_roles` during founder launch.

## Resolvable gaps

- exact founder account allowlist;
- unconsumed Matrix navigation filters;
- app origin and deployment mechanism;
- Worker account/zone/origin binding;
- exact database project and migration state;
- production WordPress UUID mapping and signing secret placement;
- production cache and deep-link verification.

## Safety conclusion

The B1-501 seams are internally coherent, but they are not yet deployable as an exact founder-only Matrix journey. No mutation should occur until the exact-founder allowlist, real Matrix entry integration, application origin, database target, edge target, restore points, and rollback actions are verified.

## Wave 2 local runtime hardening

Recorded: 2026-07-27

Scope: local StoryForge application runtime only. No production or remote contact, staging, commit, deployment, WordPress change, or edge change occurred.

### Implemented contracts

1. Provider port precedence
   - `server/config.mjs` now uses provider `PORT` as the fallback when `STORYFORGE_PORT` is absent.
   - An explicit valid `STORYFORGE_PORT` continues to take precedence.

2. Production shared-secret strength
   - Production shared-secret mode now rejects `STORYFORGE_JWT_SECRET` values shorter than 32 characters.
   - JWKS mode remains independent of the shared-secret requirement.
   - Local fixture auth retains its existing separate development-secret contract.

3. JWT verification hardening
   - Symmetric-key verification is explicitly restricted to `HS256`.
   - Remote JWKS verification remains on the JOSE remote-key path without imposing the symmetric-key algorithm list.
   - The signed `sub` claim must now be a canonical UUID with a valid version and RFC variant, matching the application resource-ID boundary.

4. Public health privacy
   - `/healthz` still runs the database health check and fails if that dependency is unhealthy.
   - Its successful public payload is now exactly `{"ok":true,"service":"storyforge-v5"}`.
   - Database, project, version, and other runtime metadata are not returned.
   - `createAppServer` accepts a test-only-compatible health-check dependency with the production default unchanged.
   - A concurrent pre-existing API no-store header change in `server/app.mjs` was preserved and is not claimed as Lorentz work.

5. Railway service-root descriptor
   - Added `storyforge-v5/railway.json`.
   - It selects Nixpacks, runs `npm run build`, starts with `npm start`, checks `/healthz`, uses a 30-second health-check timeout, and bounds on-failure restarts to three retries.
   - The descriptor assumes `storyforge-v5` is the Railway service root; it does not identify or mutate any Railway project or service.

6. Focused unit coverage
   - Added `tests/unit/runtime-contracts.test.mjs`.
   - Coverage pins provider-port fallback and explicit override, 31/32-character production secret behavior, HS256 acceptance and HS384 rejection, malformed UUID layout and invalid UUID variant rejection, and the exact public health response even when the internal health dependency returns private metadata.

### Verification results

- `node --check server/config.mjs`: PASS
- `node --check server/auth.mjs`: PASS
- `node --check server/app.mjs`: PASS
- `node --check tests/unit/runtime-contracts.test.mjs`: PASS
- Railway descriptor JSON parse: PASS
- `npm test`: PASS, 14/14 tests
- Scoped `git diff --check`: PASS

### Residual boundary

These changes harden only the local application deployment contract. They do not establish a Railway project/service, a production database, a WordPress signer secret, a Worker origin binding, or production readiness.

## Wave 4 cross-system interface safety review

Recorded: 2026-07-27

Scope: read-only review of the current concurrent candidate from WordPress through the browser client, Cloudflare Worker, Railway Node origin, and PostgreSQL. No source file, test fixture, provider, production system, Git index, commit, or remote was changed. This section records the tree after the bounded-fetch, JWT-claim, edge-routing, API-only-origin, WordPress no-store, identity-binding, and zero-assignment repairs visible at review time.

### End-to-end contract result

The active interfaces are now internally consistent for the narrow founder-only, audio-off, AI-off release shape. No remaining base-path, issuer format, audience format, CORS, cache-policy, origin-UI, or transaction-local identity contradiction was found in the reviewed code. Production readiness still depends on exact runtime bindings and least-privilege evidence; defaults and local tests are not proof that those bindings exist in the selected providers.

### Interface-by-interface findings

1. WordPress session to JWT
   - The central WordPress access state is feature-off by default and requires one exact allowlisted user before bootstrap, token issuance, Matrix launch adaptation, navigation, or tiles.
   - The founder administrator can be projected only by an explicit exact-user override to application role `student`; this does not grant a StoryForge admin private-story path.
   - WordPress produces `HS256` with `iss`, `aud`, canonical UUID `sub`, `iat`, `nbf`, `exp`, canonical UUID `jti`, positive `wp_user_id`, application role, and the true eligibility claim.
   - The minimum production secret length is 32 characters on both producer and consumer.
   - AJAX bootstrap applies private no-store headers before every response branch. The REST token route applies private no-store headers at route-wide post-dispatch, including converted REST errors as well as success.
   - Exact production values are still a gate: WordPress issuer, audience, secret-presence fingerprint, 60-second TTL, founder allowlist size one, founder UUID meta, and student role override must be inspected without exposing values.

2. Browser client
   - All browser network calls now pass through the bounded fetch wrapper and fail to a truthful unavailable state after 10 seconds.
   - WordPress bootstrap and token exchange are same-origin, cookie-bearing, nonce-protected requests.
   - StoryForge API authority remains only in the in-memory bearer token; no token persistence was introduced.
   - API URLs normalize to `<basePath>api/...`; the built document base and current runtime default both resolve to `/storyforge/`.
   - An existing token remains a bounded capability rather than a server-revoked session: with a production 60-second TTL and five-second verifier tolerance, logout or allowlist removal can take at most 65 seconds to invalidate an already issued token. Immediate rollback must also remove the route or suspend the origin.

3. Cloudflare Worker to Railway
   - The exact `/storyforge` route redirects to `/storyforge/`, repeated slashes canonicalize before dispatch, exact `/storyforge/api` is classified as API, and `/storyforge/api/*` strips to `/api/*`.
   - Static HTML is no-store, fingerprinted assets are immutable only on successful responses, static/API errors are nonstoreable, and the Worker installs the reviewed security-header set.
   - API success and error responses are overwritten to `Cache-Control: no-store, private` plus `Pragma: no-cache`.
   - The Worker now reconstructs the Railway request from an explicit header allowlist containing only `Accept`, `Authorization`, `Content-Type`, and `Origin`, and uses manual redirect handling. WordPress session cookies, nonce headers, and unrelated browser/provider headers therefore do not cross into Railway.
   - The original browser `Origin` is preserved for the Node allowlist check. For this same-origin release it must be exactly `https://missionmedinstitute.com`.

4. Railway origin
   - `/healthz` checks the database but returns only `ok` and the stable service name.
   - Outside local fixture mode, the origin is API-only by default. Direct origin `/` and deep links do not serve the StoryForge SPA.
   - `/api/*` responses set private no-store before origin validation or routing, and malformed JOSE input maps to a private 401 rather than a logged internal failure.
   - Shared-secret verification pins `HS256`, requires issuer, audience, `sub`, `iat`, `exp`, and `jti`, and validates canonical UUID subject/token identifiers plus a positive WordPress user ID.
   - Production must leave `STORYFORGE_JWKS_URL` unset, set `STORYFORGE_ORIGIN_API_ONLY=true`, keep development auth absent, set public and allowed origin to the public Matrix origin rather than the Railway domain, and point the Matrix return URL to the real member dashboard.

5. Railway application to PostgreSQL
   - Authenticated operations acquire one pool client, begin a transaction, execute `SET LOCAL ROLE authenticated`, set transaction-local `sub`, `app_role`, `storyforge_eligible`, and `wp_user_id`, then commit or roll back before releasing the client.
   - The new identity function cross-checks all four signed/session values against one live `sf_users` row. The schema already makes `sf_users.id` primary and `wp_user_id` unique.
   - The founder row must therefore match the exact WordPress ID, UUID meta, role `student`, and `eligible=true`; zero duplicate or additional rows remains a required production pre-enable result.
   - The zero-assignment submit repair is server-enforced: the UI disables submit, the detail projection reports assignment availability, and the replacement database function refuses the state transition without an active mentor assignment.

### Remaining release gates

1. **Release blocker until direct evidence: exact runtime bindings**
   - Prove all four base-path owners are `/storyforge/`: WordPress option/launch target, built HTML base, Worker binding, and Node configuration.
   - Prove the WordPress `iss` equals `STORYFORGE_JWT_ISSUER`, both audiences equal `storyforge`, and the protected shared-secret fingerprints match without printing the secret.
   - Prove `STORYFORGE_PUBLIC_ORIGIN` and `STORYFORGE_ALLOWED_ORIGINS` resolve to `https://missionmedinstitute.com`, while `STORYFORGE_ORIGIN` resolves only to the isolated Railway service.

2. **Release blocker until direct evidence: least-privilege database login**
   - The deployed database URL must use `storyforge_app`, not the provider administrator.
   - `storyforge_app` must be nonowner, `NOSUPERUSER`, `NOBYPASSRLS`, preferably `NOINHERIT`, own no StoryForge objects, have no direct table writes, and have membership sufficient only to `SET ROLE authenticated`.
   - Run the real authorization matrix through that exact login and prove `SET LOCAL ROLE`, direct-ID denial, direct-DML denial, rollback, and pool reuse. Local tests through a PostgreSQL owner do not satisfy this gate.

3. **Conditional release blocker: audio must remain disabled**
   - `/api/audio/:id/confirm` still performs its final update through base `pool.query` outside `withIdentity`.
   - Under the intended `storyforge_app` role the direct update should fail; under an elevated provider URL it could bypass the reviewed identity transaction.
   - This does not block the founder pilot only if every R2/audio variable is absent, `/api/config` reports audio unavailable, the record button remains disabled, and the presign route truthfully returns unavailable. Do not repair the path by granting direct update or installing an elevated database URL.

4. **Evidence gap before installation: WordPress error-cache coverage**
   - Current integration coverage observed private no-store on bootstrap success, anonymous bootstrap, nonce failure, successful token issuance, and application API failure.
   - The route-wide REST hook is structurally positioned to cover `429` and signer `5xx` responses, but focused retained evidence for those two statuses was not found in the reviewed tests. Sentinel's gate requires `200`, `401`, `403`, `429`, and `5xx`; retain those final results before WordPress installation.

5. **Nonblocking hardening gap**
   - Custom signed-claim failures `invalid_token_identifier_claim` and `invalid_wp_user_id_claim` are not currently classified alongside the other explicit claim failures in `publicError()`, so a validly signed but internally malformed token would produce a generic 500 rather than a claim-specific 401/403.
   - The reviewed WordPress producer cannot emit either malformed value, and an external actor cannot create a valid signature, so this is not a founder-release bypass. It should still be normalized before broadening issuers or identity sources.

### Wave 4 decision

**LOCAL INTERFACE CONSISTENCY: PASS WITH EXPLICIT RELEASE GATES**

**PRODUCTION ENABLEMENT: NOT ESTABLISHED BY THIS REVIEW**

The narrow founder journey may advance only with audio and AI off, one exact founder mapping, zero mentors/assignments, an API-only isolated origin, matching protected JWT bindings, and the proven `storyforge_app -> SET LOCAL ROLE authenticated` database path. Any mismatch in those observed bindings is a stop, not a configuration to infer or repair during enablement.
