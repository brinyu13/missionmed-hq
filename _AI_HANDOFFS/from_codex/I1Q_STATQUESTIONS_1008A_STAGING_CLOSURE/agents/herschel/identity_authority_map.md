# I1Q-1008A Identity Authority Map

## Verdict

`MAPPED, BUT CANONICAL I1Q IDENTITY RESOLUTION IS NOT YET COMPLETE`

The observed MissionMed identity chain is WordPress identity -> signed WordPress handoff -> MissionMed HQ session on Railway -> RANKLISTIQ Supabase Auth bootstrap. DR-006 authorizes a dedicated additive I1Q adapter that reuses this chain. A concurrent, untracked `i1q.identity.v1` implementation candidate and synthetic fixture set appeared during this discovery, but no application startup wires it, no authority record ratifies it, and no authenticated I1Q staging identity has been exercised. The authority document named `MM-AUTH-ARCH-001` is missing.

This report is read-only discovery. No secret or environment value, student record, raw transcript, production database, protected source, feature flag, or runtime configuration was changed.

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `AUTHORITY` | A current canonical record establishes the rule. |
| `OBSERVED SOURCE` | Current tracked source directly establishes the behavior. |
| `OBSERVED IN-FLIGHT SOURCE` | Concurrent untracked or modified worktree source exists, but is not committed, ratified, deployed, or runtime authority. |
| `OBSERVED RUNTIME` | A read-only request directly established current runtime behavior. |
| `MISSING` | Required evidence or implementation was searched for and not found. |
| `PROPOSED SAFE PATH` | Recommendation only, not current authority. |
| `PROTECTED` | Root and the named system owner must control any change. |

Discovery snapshot: 2026-07-15. Source HEAD: `81273add2c0fe350d330902d229683662896a1b1`.

Working-tree reconciliation: concurrent changes were read after the initial snapshot. They were not made, modified, staged, or certified by HERSCHEL.

## Authority Chain

| Layer | State | Authority or evidence | Ruling |
| --- | --- | --- | --- |
| I1Q mission authority | `AUTHORITY` | `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md` | Dedicated authenticated internal app; reuse canonical MissionMed auth and session; no parallel identity system. |
| Product boundary | `AUTHORITY` | `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md` | WordPress, HQ, Railway, RANKLISTIQ, Matrix, Arena, STAT, and Drills are protected dependencies. |
| Identity source of truth | `AUTHORITY` | `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`, MR-078B | WordPress owns identity fields; Railway owns HQ session state; Supabase Auth owns Arena and STAT authentication state. |
| Runtime owner | `AUTHORITY` and `OBSERVED SOURCE` | Critical Systems Contract and Manifest; `railway.json` | Railway starts `node missionmed-hq/server.mjs`. `app/api/**` is not current production authority. |
| Global auth architecture | `MISSING` | MR-078B and MR-079 both cite `08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md` | No file named `MM-AUTH-ARCH-001.md` exists under `/Users/brianb/MissionMed`. Runtime behavior does not fill this authority gap. |
| I1Q role authority | `AUTHORITY` | DR-006 plus the I1Q schema boundary | I1Q roles and assignments are app-owned. WordPress roles must not be treated as I1Q roles. |
| Medical authority | `AUTHORITY` | DR-006 | Medical governance is unassigned. A physician placeholder cannot approve medical content. |
| I1Q adapter candidate | `OBSERVED IN-FLIGHT SOURCE` | `i1q-question-platform/src/identity-adapter.mjs`, `tests/identity-adapter.test.mjs`, `fixtures/auth/i1q_authenticated_test_identities.json`, plus concurrent edits to `src/auth.mjs` and `src/server.mjs` | Defines a candidate contract and synthetic tests only. It is not wired by an application composition root or deployment route and is not authority. |

## Missing MM-AUTH-ARCH-001

`MISSING AUTHORITY: MM-AUTH-ARCH-001`

MR-078B names the expected path as:

`08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md`

MR-079 also depends on it. A filename search under `/Users/brianb/MissionMed` returned no match. This missing document means the following cannot be claimed as globally canonical from inspected authority:

- cross-service session assertion format and version;
- issuer and audience rules for a dedicated I1Q service;
- stable canonical actor identifier semantics;
- revocation and logout propagation semantics;
- server-to-server introspection rules;
- token rotation and session-secret ownership;
- the authoritative mapping between WordPress ID and Supabase UUID;
- whether a new app may consume the HQ cookie directly or only a narrow assertion.

DR-006 still permits a dedicated mission-specific I1Q adapter that follows the observed chain and does not weaken shared auth. That mission-specific permission is not a substitute for the missing global architecture record.

## Observed Runtime Chain

```text
Browser
  -> WordPress authenticated account
  -> wp-admin/admin-post.php?action=mmac_hq_auth_redirect
  -> 60-second HMAC-signed handoff
  -> MissionMed HQ /api/auth/session on Railway
  -> encrypted HQ cookie and bearer session
  -> /api/auth/bootstrap
  -> RANKLISTIQ Supabase Auth session
  -> auth.uid() for RANKLISTIQ RLS
```

### WordPress Handoff

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/wp-content/mu-plugins/missionmed-hq-auth-handoff.php`

`OBSERVED SOURCE` fields in the signed handoff:

| Field | Type or meaning |
| --- | --- |
| `wp_user_id` | Integer WordPress user ID |
| `email` | WordPress email |
| `username` | WordPress login |
| `display_name` | WordPress display name |
| `roles` | WordPress role strings |
| `iat` | Issued-at Unix seconds |
| `exp` | Expiry, 60 seconds after issue |
| `nonce` | Generated UUID string |

The handoff signs a base64url payload with HMAC SHA-256. Allowed return hosts are the production HQ Railway host and WordPress host. Allowed final hosts are WordPress hosts only. A dedicated I1Q staging hostname is not currently allowlisted.

### WordPress First-Party Proxy

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/wp-content/mu-plugins/missionmed-hq-proxy.php`

`OBSERVED SOURCE`: WordPress intercepts `/api/auth/*`, forwards method, body, cookies, and non-hop-by-hop headers to `https://missionmed-hq-production.up.railway.app`, then relays status, response headers, `Set-Cookie`, and response body. There is no I1Q-specific route or staging target.

### MissionMed HQ Identity And Session

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/missionmed-hq/server.mjs`

| Route | Observed purpose | I1Q status |
| --- | --- | --- |
| `GET /api/auth/start` | Builds WordPress handoff redirect | Existing shared route; no I1Q final route registered. |
| `GET /api/auth/session` | Exchanges a handoff or reads current encrypted session; may bootstrap Supabase | Protected; current expiry handling is unsafe. |
| `POST /api/auth/validate-wp` | Resolves WordPress cookie or assertion and returns canonical identity fields | Protected; not registered for I1Q use. |
| `POST /api/auth/exchange` | Creates encrypted HQ session and cookie | Existing shared consumer route. |
| `POST /api/auth/bootstrap` | Ensures or resolves Supabase Auth user and returns Supabase session tokens | Existing Arena and STAT route; not an I1Q resolver. |
| `POST /api/auth/logout` | Checks CSRF for an existing session and clears cookie | Shared route; no I1Q journey executed. |

`toCanonicalIdentity()` currently returns `sub = wp:<wordpress_user_id>`, `wp_user_id`, email, WordPress roles, source, and issued time. It does not include the Supabase UUID.

The HQ session stores the WordPress integer as `session.user.id`. After successful Supabase bootstrap it also stores `session.supabaseUserId`. The response field `dbocUserId` falls back from `supabaseUserId` to the WordPress integer, so its type and identity domain are not stable before bootstrap.

### Supabase UUID Mapping

`OBSERVED SOURCE` behavior:

1. HQ derives a bootstrap credential from WordPress ID and email.
2. HQ looks up or creates a Supabase Auth user by email through an admin API.
3. HQ writes `wp_user_id` and `subject = wp:<id>` into Supabase user metadata.
4. HQ signs in the user and stores the returned Supabase `user.id` UUID in the HQ session.
5. RANKLISTIQ user tables use `auth.uid()` UUIDs.

The tracked legacy RPC `public.resolve_supabase_user_uuid(text, text)` in `supabase/migrations/20260422123000_avatar_locker_identity_stat.sql` searches `auth.users` metadata by WordPress ID, then falls back to email. It is granted to `anon` and `authenticated`. Because I1Q explicitly forbids email-only authorization and requires a versioned trusted resolver, this RPC is evidence of an existing mapping helper, not canonical I1Q identity authority.

`player_profiles.player_id`, avatar ownership, and duel ownership are keyed to the Supabase Auth UUID through `auth.uid()`.

## I1Q Actor And Role Boundary

Current I1Q role vocabulary:

```text
platform_admin
content_operator
author
editorial_reviewer
physician_reviewer
release_manager
privacy_officer
incident_owner
read_only
system
```

The final 1007X migration candidate stores `actor_role_memberships.actor_id` as UUID and defines `i1q.current_actor_id()` as `auth.uid()`. Therefore the current datastore candidate treats the Supabase Auth UUID as the database actor identity.

The I1Q HTTP server accepts a resolver-supplied `actor.id` string and roles and remains fail-closed in non-demo mode when no resolver is injected. The concurrent untracked `identity-adapter.mjs` candidate defines `i1q.identity.v1`, pins issuer configuration to RANKLISTIQ, requires audience `authenticated`, verifies the bearer against `/auth/v1/user`, uses the verified Supabase UUID for `actor.id` and `canonical_actor_id`, and obtains I1Q roles from a supplied role-profile resolver. Concurrent `auth.mjs` and `server.mjs` edits normalize and expose this shape. No tracked startup or provider composition injects the adapter, supplies the role-profile resolver or audit sink, or deploys it. The candidate therefore reduces implementation uncertainty but does not resolve authority or operations.

`MISSING`: no authoritative contract currently decides whether `canonical_actor_id` is identical to the Supabase UUID or is a separate identifier with an explicit mapping. The observed SQL strongly favors UUID identity, while 1007X prose also discussed `wp:<id>` as a stable actor label. Root and Lorentz must resolve this explicitly.

`PROPOSED SAFE DEFAULT FOR ROOT DECISION`: use the verified Supabase Auth UUID as `canonical_actor_id` for I1Q authorization and RLS, retain `wordpress_user_id` and `wp:<id>` only as source identifiers, and reject any email-only or caller-provided mapping. This is a proposal, not current authority.

I1Q roles must come from active `i1q.actor_role_memberships`, governance slots, and exact review assignments. They must not come from WordPress role strings, display names, email domains, request headers, or client JSON.

## Runtime Security Findings

| ID | State | Finding | Impact | Owner |
| --- | --- | --- | --- | --- |
| `ID-AUTH-01` | `OBSERVED SOURCE` | `readEncryptedSession()` logs a warning for missing, invalid, or expired `expiresAt` and still returns the payload. | Expired or malformed encrypted sessions can remain accepted. | HQ/Auth owner and Root |
| `ID-AUTH-02` | `OBSERVED SOURCE` | `SESSION_SECRET` always falls back to random bytes, while startup and exchange checks test the fallback rather than `CONFIGURED_SESSION_SECRET`. | Missing configuration can appear healthy and sessions rotate across restarts. | HQ/Auth owner and Root |
| `ID-AUTH-03` | `OBSERVED SOURCE` and `OBSERVED RUNTIME` | `buildCorsHeaders()` reflects the request Origin when no fixed origin is configured and allows credentials. A read-only request on 2026-07-15 with `Origin: https://herschel-invalid.example` received that same `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`. | Current production auth permits credentialed CORS reflection for an arbitrary origin. This blocks I1Q staging reliance on shared HQ auth. | HQ/Auth owner and Security |
| `ID-AUTH-04` | `OBSERVED SOURCE` | WordPress issues a nonce but no nonce-consumption store is visible in the HQ parser. | One-time replay protection is unproven. | WordPress/HQ Auth owner |
| `ID-AUTH-05` | `OBSERVED IN-FLIGHT SOURCE` and `MISSING` | An untracked candidate now supplies issuer, audience, contract version, bearer verification, app-role callback, failure codes, and synthetic personas. It has no ratification, committed source identity, application wiring, operational role-profile implementation, durable audit sink, staging identity, or deployment evidence. | The candidate is reviewable, but State A identity authority still cannot pass. | Root and Lorentz |
| `ID-AUTH-06` | `MISSING` | Critical Systems Manifest omits `/api/auth/validate-wp`, `/api/auth/logout`, the WordPress handoff/proxy files, and every I1Q route. | Protected auth coverage and rollback are incomplete. | Root and Critical Systems owner |
| `ID-AUTH-07` | `OBSERVED SOURCE` | WordPress handoff final targets are restricted to WordPress hosts. | A dedicated direct staging host cannot currently complete the observed handoff. | WordPress/HQ owner and Deployment owner |

The live HQ health route returned HTTP 200 on 2026-07-15. Health reachability does not clear the auth findings above.

## Resolved Versus Missing Authority

| Question | Result |
| --- | --- |
| Who owns canonical person identity? | `RESOLVED`: WordPress. |
| Who owns current shared session runtime? | `RESOLVED`: MissionMed HQ on Railway. |
| Which Supabase project owns Arena and STAT identity? | `RESOLVED`: RANKLISTIQ `fglyvdykwgbuivikqoah`. |
| May I1Q create a parallel login or identity store? | `RESOLVED`: no. |
| May I1Q own app roles and assignments? | `RESOLVED`: yes, additively in `i1q`. |
| Is physician authority inferable from WordPress role or title? | `RESOLVED`: no. |
| What is the global canonical auth architecture? | `MISSING`: `MM-AUTH-ARCH-001` is absent. |
| What exact assertion or introspection contract may I1Q consume? | `MISSING AUTHORITY`; an in-flight bearer-contract candidate exists. |
| What is the canonical actor ID type? | `MISSING`; observed SQL uses Supabase UUID. |
| Is shared HQ auth safe for staging today? | `NO`: expiry, configured-secret, CORS, and replay proof remain unresolved. |
| Are authenticated role fixtures available? | `IN-FLIGHT ONLY`: one untracked synthetic fixture registry exists and has not been staged or certified. |

## Safe Integration Path

1. `PROTECTED`: Authority maintainer files `MM-AUTH-ARCH-001` at the cited canonical path, or explicitly records that DR-006's versioned mission adapter governs I1Q while the global document remains missing. Do not pretend the document exists.
2. `PROTECTED`: HQ/Auth owner repairs fail-open expiry, configured-secret checks, and credentialed CORS through the Critical Systems process. Prove nonce replay disposition, logout, restart, revocation, and outage behavior.
3. Root and Lorentz review, reconcile, and explicitly ratify or reject the in-flight `i1q.identity.v1` candidate. The resulting versioned contract must cover issuer, audience, canonical actor semantics, Supabase UUID, WordPress ID, permitted email handling, expiry, validation time, active/revoked state, credential state, and failure codes.
4. Use a dedicated I1Q server adapter. Do not copy HQ encryption logic, reuse its secret in a second service, widen WordPress roles, accept client roles, or expose service-role credentials.
5. Resolve I1Q roles and exact assignments from app-owned database rows after canonical identity validation.
6. Bind database authorization to the same verified Supabase UUID and prove no cross-session, pooled-connection, actor-substitution, or email-fallback path exists.
7. Review and certify the in-flight synthetic fixtures for administrator, editorial reviewer, physician placeholder, privacy reviewer, release manager, auditor, unauthorized student, unauthenticated visitor, revoked identity, and expired session. The physician placeholder remains non-approving.
8. Run the full auth attack matrix and dependent WordPress, HQ, Arena, STAT, Daily, USCE, and logout regressions before staging certification.

## Exact Blockers Returned To Root

| Blocker | Required owner action |
| --- | --- |
| Missing `MM-AUTH-ARCH-001` | Authority maintainer must file it or explicitly govern the mission-specific substitute without inventing global policy. |
| Shared HQ expiry defect | HQ/Auth owner must fail closed and regress all consumers. |
| Shared HQ configured-secret defect | HQ/Auth owner must test the configured value, hard fail in production, and prove restart persistence without exposing values. |
| Live hostile-origin CORS reflection | HQ/Auth owner must register a fixed allowlist and deny hostile origins. |
| No canonical actor authority | Root and Lorentz must decide and version the WordPress ID, Supabase UUID, and canonical actor relationship; the in-flight candidate's choice is not authority by itself. |
| Candidate resolver and fixtures are not operational | Root must review, authorize, commit through the owning lane, wire, and stage the dedicated adapter, role-profile resolver, audit sink, and fixture registry. |
| No I1Q route registration | Deployment owner must register route, audience, return target, origin, health, owner, and rollback before auth integration. |

## Protected No-Touch Boundary

HERSCHEL made no change to `missionmed-hq/server.mjs`, WordPress mu-plugins, Railway, Supabase, auth users, environment configuration, Critical Systems records, Matrix, consumer runtimes, I1Q feature flags, or production data.
