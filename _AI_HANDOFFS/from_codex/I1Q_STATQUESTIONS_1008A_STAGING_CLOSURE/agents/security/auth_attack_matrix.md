# I1Q-1008A Authentication And Application Attack Matrix

## Verdict

**AUTHENTICATION CLEARANCE DENIED.** Local request guards and the in-flight identity adapter behave well under their synthetic tests. The proposed adapter and personas are uncommitted, unratified, unwired, and not contract-aligned with the concurrent Lorentz closed schema. Canonical identities, the complete session lifecycle, and an authenticated staging host remain absent. Every staging-only test remains `NOT RUN`.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

Evaluated in-flight adapter SHA-256: `b1e0dd4c0c7f3961328a58809b5d4e7405d9e8c3a07599a5fac5d5823f06b039`

## Interpretation

`PASS` below always includes its scope. A `LOCAL PASS` is not a staging pass. `SOURCE GAP` identifies a tracked-source condition that must be reproduced against the protected deployed commit before exploitability is claimed. `NOT RUN` never implies success.

## Identity, Session, And Access Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Anonymous client requests `/` | Authenticated internal app denies or redirects before serving its shell | `LOCAL PASS`: non-demo server returns `401` without an explicit static-access adapter | `NOT RUN` | Compose and verify the canonical gate across the full staging host |
| AUTH-02 | Anonymous client requests `/app.js` | Deny or redirect before serving internal assets | `LOCAL PASS`: non-demo server returns `401`; an explicit synthetic gate is required for `200` | `NOT RUN` | Verify assets, source maps, and edge cache behavior in staging |
| AUTH-03 | Anonymous client requests protected dashboard API | Return `401` with no protected data | `SYNTHETIC PASS`: returned `401` | `NOT RUN` | Repeat on staging |
| AUTH-04 | Valid canonical user signs in | Stable actor identity and authorized role are established | In-flight adapter `LOCAL PASS` with synthetic callbacks; no startup composition or canonical user | `NOT RUN` | State A blocker |
| AUTH-05 | Invalid credentials or failed identity provider login | No I1Q session or shell access | No integrated login fixture | `NOT RUN` | State A blocker |
| AUTH-06 | Direct protected API request without resolver context | Fail closed | `LOCAL PASS` in API tests | `NOT RUN` | Repeat on staging |
| AUTH-07 | Resolver returns `validated: false` | Fail closed | `LOCAL PASS` | `NOT RUN` | Repeat with canonical adapter |
| AUTH-08 | Resolver omits actor, session, role, freshness metadata, or identity envelope | Fail closed | `LOCAL PASS`: the server now requires the complete identity envelope and freshness inputs | `NOT RUN` | Repeat through the ratified canonical adapter |
| AUTH-09 | Expired I1Q resolver context | Return `401`; no refresh by trusting stale context | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| AUTH-10 | HQ session has absent, invalid, or expired expiry | Reject session before I1Q | `SOURCE GAP`: tracked HQ reader warns then returns payload | `NOT RUN` | High gate; fix or disprove in deployed runtime |
| AUTH-11 | Revoked I1Q resolver context | Return `401` | `LOCAL PASS` for injected `revoked` marker | `NOT RUN` | Authoritative provider revocation remains unproven |
| AUTH-12 | Provider session revoked while HQ cookie remains | Revalidation or bounded freshness rejects continued access | No end-to-end fixture | `NOT RUN` | State A blocker |
| AUTH-13 | Wrong token issuer | Reject before I1Q context creation | In-flight adapter `LOCAL PASS` | `NOT RUN` | Ratify issuer and repeat with canonical provider |
| AUTH-14 | Wrong token audience | Reject before I1Q context creation | In-flight adapter `LOCAL PASS` | `NOT RUN` | Ratify audience and repeat with canonical provider |
| AUTH-15 | Email-only identity is supplied | Reject; email is not canonical actor identity | In-flight adapter keys actor to verified UUID; no dedicated email-only vector | `NOT RUN` | Add an explicit negative fixture |
| AUTH-16 | Unknown external ID triggers generated actor UUID | Reject; never synthesize authority | In-flight adapter requires verified UUID equality; no generated fallback found | `NOT RUN` | Repeat with canonical binding |
| AUTH-17 | Disabled or deleted MissionMed user retains a session | Reject and terminate access | No canonical account-state fixture | `NOT RUN` | State A blocker |
| AUTH-18 | Caller submits a privileged role in token, body, or header | Ignore and use authoritative membership | In-flight adapter and route tests `LOCAL PASS` | `NOT RUN` | Repeat end to end |
| AUTH-19 | Resolver supplies an unknown role | Reject | `LOCAL PASS` | `NOT RUN` | Repeat end to end |
| AUTH-20 | Authoritative role is removed during active session | New requests lose permission within defined freshness bound | In-flight resolver queries a scoped role RPC per request; canonical revocation path absent | `NOT RUN` | State A blocker |
| AUTH-21 | Session ID is changed after authentication | Reject CSRF and session-bound operations | `LOCAL PASS` for session-bound CSRF | `NOT RUN` | Add fixation and rotation fixture |
| AUTH-22 | Attacker fixes a pre-login session | Rotate session at authentication boundary | No integrated login | `NOT RUN` | Required staging test |
| AUTH-23 | Signed WordPress handoff is replayed during validity window | Second exchange is rejected atomically | `SOURCE GAP`: nonce is emitted but no tracked HQ consumption found | `NOT RUN` | High gate |
| AUTH-24 | WordPress handoff is replayed after expiry | Reject | Source has age checking; no end-to-end test | `NOT RUN` | Required staging test |
| AUTH-25 | Handoff return target changes scheme or port on an allowed host | Accept only the canonical HTTPS origin and approved port | Tracked handoff validates host; full scheme and port behavior unproven | `NOT RUN` | Add redirect abuse tests |
| AUTH-26 | Signing configuration is missing at startup | Fail startup without serving traffic | `SOURCE GAP`: tracked HQ creates process-random fallback material | `NOT RUN` | Fail-closed configuration gate |
| AUTH-27 | HQ restarts with existing sessions | Intentional documented behavior; no silent identity drift | Runtime continuity untested | `NOT RUN` | Verify without exposing configuration |
| AUTH-28 | Canonical identity provider is unavailable | Fail closed, bounded error, no stale privilege escalation | In-flight callbacks fail closed locally; no integrated provider | `NOT RUN` | Required outage test |
| AUTH-29 | User invokes logout | Canonical session invalidated, cookie cleared, protected routes denied | `LOCAL CONTRACT AND UI PASS`: POST logout requires exact write integrity and an injected revocation adapter, returns `503` without one, and has no local-only fallback; the UI sends CSRF and clears in-memory state | `NOT RUN` | Wire and verify canonical provider and cookie revocation |
| AUTH-30 | Old browser tab operates after logout | API rejects; no cached protected response | `LOCAL SYNTHETIC PASS`: injected revocation causes the old bearer to fail on the next session request, and the initiating UI disables its workspace | `NOT RUN` | Repeat with real provider, cookie, browser cache, and a separate old tab |
| AUTH-31 | Injected resolver omits identity envelope or supplies wrong version, actor, active state, or revocation state | Server rejects before route execution | `SYNTHETIC PASS`: regression suite and independent wrong-version probe fail closed | `NOT RUN` | Repeat through canonical adapter |
| AUTH-32 | Adapter output is validated against the proposed closed bootstrap schema | Exact schema match with no unknown fields | `SOURCE GAP`: adapter adds top-level identity, issued time, and transport fields and supplies an empty CSRF value in bearer mode | `NOT RUN` | Reconcile and ratify one contract |
| AUTH-33 | Scoped role-profile RPC returns a mismatched identity contract version | Reject before role profile becomes authority | `LOCAL PASS`: source enforcement and independent negative probe return `identity_contract_version_mismatch` | `NOT RUN` | Add a committed regression and repeat against preview RPC |

## CSRF, Origin, CORS, And Browser Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| WEB-01 | Mutation omits CSRF token | Return `403`; no state change | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-02 | Mutation supplies wrong CSRF token | Return `403`; no state change | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-03 | Valid CSRF token from another session | Return `403` | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-04 | Mutation comes from untrusted Origin | Return `403`; no state change | `LOCAL PASS` in I1Q resolver model | `NOT RUN` | Canonical origin source remains unproven |
| WEB-05 | Origin header is absent on browser mutation | Apply documented fail-closed policy | Local tests cover expected mutation contract | `NOT RUN` | Verify proxy behavior |
| WEB-06 | Hostile origin sends credentialed request to HQ | No reflected allow-origin header and no readable response | `OBSERVED RUNTIME` by authority mapper: shared HQ reflected an untrusted Origin with credentials; Security did not repeat the request | `NOT RUN` for I1Q staging | Immediate protected-system High gate |
| WEB-07 | Preflight requests unexpected method or header | Deny or return constrained exact policy | No deployed route evidence | `NOT RUN` | Required staging test |
| WEB-08 | Cross-origin script reads protected I1Q API | Block through same-origin and exact CORS policy | No I1Q CORS headers in local server, which is same-origin by default | `NOT RUN` | Verify entire proxy chain |
| WEB-09 | I1Q is framed by another site | Deny framing | `LOCAL PASS`: CSP frame-ancestors and X-Frame-Options present | `NOT RUN` | Verify edge preserves headers |
| WEB-10 | Referrer leaks protected path or query | No referrer disclosure | `LOCAL PASS`: no-referrer policy present | `NOT RUN` | Verify edge preserves header |
| WEB-11 | Browser or proxy caches protected response | `no-store`, private behavior, no shared cache reuse | `LOCAL PASS` for I1Q API response headers | `NOT RUN` | CDN and proxy behavior required |
| WEB-12 | Browser loads page over HTTP | Redirect to HTTPS and enforce HSTS after deployment | Not applicable locally | `NOT RUN` | Staging deployment gate |
| WEB-13 | Inline or injected script executes | Restrictive CSP blocks unexpected sources | Local CSP is restrictive; no deployed browser probe | `NOT RUN` | Run browser CSP test |
| WEB-14 | Session endpoint returns trace identity or credential evidence unnecessary for browser workflows | Closed minimal browser-safe response | `LOCAL PASS`: exact runtime projection, closed OpenAPI schema, and independent negative probe expose only actor ID, roles, expiry, and CSRF token with `no-store` | `NOT RUN` | Repeat against deployed proxy and browser |

## Authorization, IDOR, Input, And Abuse Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| APP-01 | Reviewer requests another reviewer's assignment by ID | Deny and reveal no protected content | `LOCAL PASS` | `NOT RUN` | Repeat on staging and preview DB |
| APP-02 | Reviewer uses a valid assignment for a different item revision | Deny stale or mismatched revision | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| APP-03 | User changes actor, role, review status, or owner fields in body | Ignore or reject protected fields | `LOCAL PASS` for mass assignment | `NOT RUN` | Repeat on staging |
| APP-04 | User guesses sequential or leaked resource IDs | Enforce per-object authorization, not existence alone | `LOCAL PASS` for covered resource routes | `NOT RUN` | Expand deployed corpus matrix |
| APP-05 | Malformed JSON reaches mutation route | Bounded `400`, no stack or data disclosure | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| APP-06 | Path traversal targets files outside public root | Reject | `LOCAL PASS` | `NOT RUN` | Repeat through deployment proxy |
| APP-07 | Oversized request body | Reject before memory or log amplification | Limit behavior not established end to end | `NOT RUN` | Define and verify route limits |
| APP-08 | Repeated login or bootstrap attempts | Bounded rate and observable rejection | No I1Q-specific rate limiter found; edge controls unknown | `NOT RUN` | Staging blocker until owned control is documented |
| APP-09 | Repeated extraction, review, or export attempts | Per-actor and per-route limits; idempotency where required | No deployed limiter or queue evidence | `NOT RUN` | Required internal abuse control |
| APP-10 | Error path logs session, CSRF, answer, or source data | Redacted structured log only | No deployed log capture reviewed | `NOT RUN` | Required staging log test |
| APP-11 | Client stores bearer, session, or protected content in browser storage | No persistent protected material and a ratified token-handling model | In-flight adapter expects a browser bearer; no application composition or storage path exists | `NOT RUN` | Browser and storage inspection required |
| APP-12 | Feature flag is omitted, malformed, or partially true | Consumer path remains disabled | `LOCAL PASS`: exact false-by-default handling | `NOT RUN` | Verify deployed configuration without reading values |
| APP-13 | Student-facing consumer requests unreleased content | Deny and emit no artifact | Local adapter and artifact tests pass | `NOT RUN` | Must stay disabled in staging and production |
| APP-14 | Second draft writer submits a stale client-observed content hash | Return `409` and preserve the first writer's revision | `LOCAL PASS`: exact `If-Match` is required and a two-writer regression passes | `NOT RUN` | Repeat through staging datastore |
| APP-15 | Deployment readiness omits an adapter, backing service, migration, audit, or all-flags-off proof | Return not ready and block promotion | `LOCAL PASS`: readiness stays `503` until every explicit gate is true | `NOT RUN` | Bind to canonical deployment promotion and verify each failure mode |

## Local Evidence Summary

| Run | Result | Scope |
| --- | --- | --- |
| Full Node suite after in-flight delta | 277 discovered, 275 passed, 0 failed, 2 intentional PostgreSQL skips | Local source and synthetic fixtures; both skipped DB tests were separately run in disposable instances. One earlier run had a transient UI timeout that passed in isolation and on later full reruns. |
| Focused security suite after in-flight delta | 161 discovered, 159 passed, 0 failed, 2 intentional PostgreSQL skips | Local identity, adapters, route security, readiness, preview workflow, migration source, and repository; both DB tests were separately run |
| In-flight identity adapter suite | 26 discovered, 26 passed, 0 failed, 0 skipped | Synthetic callbacks, loopback API, and logout revocation only |
| Root-fix targeted suite | 64 discovered, 64 passed, 0 failed, 0 skipped | API, security regression, and identity adapter tests, including contract, concurrency, readiness, static gate, and logout repairs |
| Preview-workflow static contract suite | 3 discovered, 3 passed, 0 failed, 0 skipped | Manual and phase-safe operation gates, secret-free validation, step-scoped migration secrets, exact approval/operation/commit/four-SQL/workflow/full-history binding, backup and restore identifiers, post-operation role/RLS/flag checks, and upload only when `steps.redact.outcome == 'success'` |
| Independent browser-session shape probe | Exact closed response and `no-store` passed | No identity trace, WordPress identity, email, credential evidence, issued time, or transport was reflected |
| Independent role-profile contract-version probe | Mismatched version rejected | Returned `identity_contract_version_mismatch` before profile use |
| Current independent evidence validator | 20 of 20 expected files present and parsed, 0 errors, claimed state `BLOCKED`, `PASS` | Frozen local evidence estate only; no preview or staging environment is claimed |
| Local unauthenticated route probe | `/`, `/app.js`, and the protected dashboard returned `401`; health returned `200` | Loopback server only; deployed edge and cookie behavior remain untested |

## Required Authentication Exit Criteria

1. A versioned canonical identity contract names immutable actor ID, provider identity, issuer, audience, active status, session ID, issued time, expiry time, validation time, role source, and revocation semantics.
2. The dedicated I1Q adapter and server normalizer implement the same closed contract without email identity, generated IDs, caller roles, unknown fields, or stale fallback state.
3. Positive and negative fixtures pass for login, expiry, revocation, role removal, disabled user, wrong issuer, wrong audience, provider outage, logout, fixation, and replay.
4. The protected HQ expiry, signing-configuration, and nonce findings are fixed or disproved, and the observed credentialed CORS reflection is repaired and regressed across shared consumers.
5. The whole staging application, including shell and assets, requires authentication through a documented application or edge boundary.
6. Staging tests prove CSRF, Origin, CORS, cookies, headers, cache, logs, rate controls, and feature flags against a non-localhost HTTPS origin.

Until those criteria pass, Security vetoes State A and every higher state.
