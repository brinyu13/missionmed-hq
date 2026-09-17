# I1Q-1007X Authentication And Bootstrap Map

## Authority And Ownership

| Layer | Owner | Governing authority | Protected |
| --- | --- | --- | --- |
| Canonical user identity | WordPress | MR-078B Data Flow Contract | Yes |
| WordPress signed handoff | WordPress/HQ | DR-006 and existing HQ handoff contract | Yes |
| First-party auth proxy | WordPress/HQ | Critical Systems Contract | Yes |
| Encrypted application session | HQ Railway runtime | Critical Systems Manifest and HQ passport | Yes |
| Supabase Auth bootstrap | HQ to RANKLISTIQ | MR-078B and DR-006 | Yes |
| I1Q actor and assignment roles | Question Platform | DR-006 and 1004C | New app-owned mapping required |
| Shared auth edits and environment | Root Supervisor | Ownership matrix | Root-only |

Assignment-time authority label: DR-006 REVIEWED CANDIDATE, CANONICAL MERGE PENDING. A clean merge into MissionMed OS main 93c0404 was later observed. This map does not independently certify or exercise production auth authority.

## Active Runtime Owner

Railway starts:

    node missionmed-hq/server.mjs

Active source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs

Inactive lookalike:

    app/api/**

At the exact 5ae58b0 source baseline, the I1Q candidate starts its own local Node server, but non-demo API requests cannot authenticate because identityResolver is null. Its public health response reports AUTH_ADAPTER_REQUIRED, and protected APIs return production_identity_adapter_required. During validation, concurrent uncommitted repairs appeared in auth.mjs and server.mjs; they were inspected only as in-flight work and did not establish a fixed, integrated, independently certified auth baseline.

## Canonical Flow

### Redirect And Handoff Flow

1. Browser opens Arena, STAT, Daily, or a future dedicated I1Q route.
2. Browser calls GET /api/auth/start or the consumer attempts POST /api/auth/exchange.
3. WordPress or HQ redirects the user to the WordPress login/account route when needed.
4. WordPress admin-post action mmac_hq_auth_redirect verifies a logged-in WordPress user.
5. WordPress signs a short-lived handoff containing WordPress user ID, email, username, display name, roles, issue time, expiry, and nonce.
6. The signed token is redirected to HQ GET /api/auth/session with an allowlisted final URL.
7. HQ verifies the handoff, creates an encrypted session, bootstraps Supabase, sets an HttpOnly session cookie, and redirects to the final first-party route.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/missionmed-hq-auth-handoff.php

Observed handoff controls:

| Control | Current behavior |
| --- | --- |
| Handoff lifetime | 60 seconds |
| Signature | HMAC SHA-256 over a base64url payload |
| Return hosts | HQ Railway plus the WordPress host |
| Final hosts | WordPress hosts only |
| Logged-out behavior | Redirect to WordPress account login |
| Missing shared handoff secret | 503 hard failure |

### First-Party Proxy Flow

WordPress captures /api/auth/* before normal templates and proxies the request to the HQ Railway origin. It forwards method, body, cookies, and non-hop-by-hop headers, then relays status, response headers, Set-Cookie, and body.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/missionmed-hq-proxy.php

Safest I1Q use: keep the browser on the WordPress origin for the handoff and use a dedicated final I1Q route that Root explicitly allowlists. Do not add a parallel login, frontend signup, or token exchange.

### Session And Bootstrap Routes

| Route | Method | Current role | I1Q treatment |
| --- | --- | --- | --- |
| /api/auth/start | GET | Builds HQ session entry and WordPress auth redirect | Reuse unchanged |
| /api/auth/session | GET | Reads current session or exchanges signed handoff; may bootstrap Supabase | Reuse for browser entry; fix expiry first |
| /api/auth/validate-wp | POST | Resolves WordPress cookie or assertion to canonical identity and applies allowed-role gate | Root-only; do not globally widen roles for I1Q |
| /api/auth/exchange | POST | Exchanges WordPress auth for encrypted HQ session and cookie | Existing first-party consumer route |
| /api/auth/bootstrap | POST | Uses HQ session to ensure/provision RANKLISTIQ Supabase Auth and return session tokens | Existing Arena/STAT path; app adapter must not expose service credentials |
| /api/auth/logout | POST | Requires CSRF for an existing session, clears cookie | Reuse; test revocation and post-logout denial |

The browser consumers call Supabase setSession with bootstrap tokens and verify identity through supabase.auth.getUser. Arena, STAT, and Daily are pinned to RANKLISTIQ.

## I1Q Role Boundary

Current I1Q application roles:

| I1Q role |
| --- |
| platform_admin |
| content_operator |
| author |
| editorial_reviewer |
| physician_reviewer |
| release_manager |
| privacy_officer |
| incident_owner |
| read_only |
| system |

These are not WordPress roles and must not be inferred directly from a WordPress role string. The safest mapping is:

1. Canonical HQ identity yields stable actor ID wp:<wordpress_user_id>, verified email, and session provenance.
2. I1Q looks up app-specific roles and active review assignments in the i1q schema.
3. The server begins a database transaction.
4. The server sets transaction-local actor and role context from its own mapping.
5. Queries execute through an I1Q repository; the browser never sets database role context.
6. The transaction is committed or rolled back and connection context is cleared by transaction scope.
7. Sensitive source and answer records require explicit privacy, assignment, phase, and finalization checks beyond a broad role.

Do not:

- Accept actor ID or app roles from request JSON or headers.
- Derive physician credentials from a WordPress role, title, or name.
- Add I1Q roles to MMHQ_ALLOWED_WP_ROLES as a shortcut.
- Share a Supabase service-role credential with the browser.
- Add public grants to the i1q schema.
- Reuse the HQ session secret in another service without a separate reviewed decision.

## Safest Adapter Choice

Preferred architecture:

| Component | Ownership | Behavior |
| --- | --- | --- |
| Dedicated I1Q service | Question Platform | Hosts I1Q UI/API only |
| Canonical session validation | Root/HQ | Narrow server-to-server introspection or signed app assertion after shared-auth repair |
| Role mapping | I1Q | App-owned role and assignment records |
| Database session | I1Q server | RANKLISTIQ server connection; transaction-local trusted actor/roles |
| Browser | I1Q | Receives only app-safe API payloads; never raw database credentials |

Fallback architecture: mount an isolated I1Q route module in HQ and add one protected dispatch point. This lowers cross-service session sharing but touches missionmed-hq/server.mjs, a protected active runtime, and therefore requires a separate decision, Root ownership, critical-system gates, and all HQ dependent-product tests.

The mapper does not recommend copying HQ encryption logic or its secret into the I1Q repository. A duplicated session implementation would create a parallel security boundary and complicate expiry, rotation, revocation, and rollback.

## Confirmed Shared-Auth Risks

| ID | Finding | Evidence | Impact | Owner | Required baseline |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | readEncryptedSession warns for missing, invalid, or expired expiresAt but returns the payload. | missionmed-hq/server.mjs lines 1026-1037 | Expired encrypted cookie or bearer sessions can remain accepted. Release-blocking for I1Q and shared consumers. | Root plus HQ/Auth Security | Unit and integration tests proving expired/missing dates return unauthenticated; Arena/STAT/HQ regression |
| AUTH-02 | SESSION_SECRET always falls back to random bytes, while startup, exchange, persistence, and health checks test SESSION_SECRET instead of CONFIGURED_SESSION_SECRET. | missionmed-hq/server.mjs lines 79-83, 577-579, 612-614, 751-753, 2231-2238 | Missing required environment secret can look configured; sessions rotate on restart and exchange is not actually disabled as messages claim. | Root plus HQ/Auth Security | Production startup hard fail on absent configured secret; restart persistence; no secret output |
| AUTH-03 | buildCorsHeaders reflects request Origin when MMHQ_ALLOWED_ORIGIN is blank and allows credentials. | missionmed-hq/server.mjs lines 3058-3070 | A future I1Q origin could accidentally broaden credentialed CORS instead of using a fixed allowlist. | Root plus HQ/Auth Security | Allowed WordPress/CDN/I1Q origins; hostile Origin denied; preflight and credential tests |
| AUTH-04 | At 5ae58b0 the I1Q candidate has no identityResolver implementation, no canonical role mapping, and no session revocation/CSRF proof. Later auth/server repair was observed in flight but not certified on one fixed commit. | i1q-question-platform/src/server.mjs and auth.mjs | No inspected baseline can yet be exposed to an authenticated audience. | Auth and Release Security Implementer for I1Q; Root for HQ bridge | Freeze the repair, integrate the Root-approved HQ bridge, and complete the auth matrix before preview |
| AUTH-05 | Candidate SQL trusts app.actor_id and app.actor_roles GUC values, while no trusted server repository or connection-pool isolation exists. | i1q-question-platform/db/migrations/0001_i1q_question_platform.sql | Caller or pooled-connection role confusion could bypass RLS if the adapter is wrong. | Architecture/Data and Auth Security | GUC spoof, pool reuse, transaction rollback, cross-assignment denial |
| AUTH-06 | Ordinary read roles can traverse broad generic application reads; independent security audit found answer/source and phase authorization failures. | I1Q source and Auth/Security audit packet | Authentication alone does not establish authorization or answer isolation. | Auth and Release Security Implementer | Closed-world response schemas and negative authorization tests |

## Required Auth Test Matrix

| Area | Tests required before preview |
| --- | --- |
| WordPress handoff | Valid, expired, malformed, wrong signature, replayed nonce, wrong return host, wrong final host, logged-out |
| HQ encrypted session | Valid cookie, valid bearer, malformed token, missing expiry, invalid expiry, expired, clock boundary, restart, rotated secret, revoked user |
| Cookie | Secure, HttpOnly, SameSite, path/domain, cross-origin behavior, logout clearing |
| CSRF | Missing, wrong, stale, cross-session, valid; every mutating app route |
| CORS | Each allowlisted origin, hostile origin, missing Origin, OPTIONS, credentials |
| Supabase bootstrap | Valid RANKLISTIQ project, provisioning idempotency, user mismatch, outage, token expiry/refresh, no key leakage |
| I1Q mapping | No roles, unknown role, read-only, each reviewer role, assignment scope, physician credential evidence, disabled actor |
| Database context | Actor and roles set locally inside transaction, spoof attempts ignored, pooled connection does not retain context |
| Error/logging | No handoff, cookie, bearer, refresh token, secret, source text, or answer in errors/logs |
| Dependent consumers | Arena, STAT, Daily auth entry and logout; HQ protected APIs; WordPress proxy |

## Tests Performed By Mapper

| Test | Result |
| --- | --- |
| Read-only route and code trace | Complete |
| Candidate BOOT/CURRENT read | Pass |
| Static Arena/STAT/Daily auth endpoint and RANKLISTIQ pin validation | Pass through VALIDATION/validate_deploy.sh |
| I1Q non-demo tests at the initial snapshot | Existing suite pass, 30 of 30; this does not clear the independent security veto |
| Concurrent auth/server repair | Observed uncommitted during validation; mapper did not execute it as a fixed auth candidate |
| Authenticated live session test | Not performed |
| Secret/environment inspection | Not performed; names only were read |
| Shared auth mutation | None |

## Blockers

- AUTH-01 and AUTH-02 require protected HQ repair before I1Q depends on the session.
- Root must choose and authorize the canonical app-specific session validation mechanism.
- The 5ae58b0 baseline lacks I1Q role and assignment mapping; later in-flight repair is not integrated or certified.
- No fixed inspected commit proves trusted transactional database context.
- CSRF, revocation, fixation, outage, and credentialed CORS evidence is absent.
- Independent security re-certification is required on one fixed integrated commit.

## Root Handoff

Keep missionmed-hq/server.mjs, WordPress relay/proxy files, shared environment, and allowed origins root-only. Assign only I1Q-owned auth and authorization repairs to the application implementer. After shared-auth defects are fixed independently, Root should publish a narrow adapter contract with input identity fields, expiry semantics, audience, error codes, role-mapping responsibility, logging rules, and rollback behavior before any app integration begins.
