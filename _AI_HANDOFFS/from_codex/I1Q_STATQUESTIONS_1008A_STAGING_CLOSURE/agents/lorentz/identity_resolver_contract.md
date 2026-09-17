# I1Q Identity Resolver Contract

Contract ID: `I1Q-IDENTITY-RESOLVER-v1`

Ticket: `I1Q-1008A`

Status: `PROPOSED CONTRACT, OPEN AUTHORITY GATES`

Scope: Dedicated I1Q server adapter only. This document does not change MissionMed HQ, WordPress, Supabase Auth, shared cookies, or shared session semantics.

## Evidence Vocabulary

- `OBSERVED`: present in the inspected source or authority record.
- `REQUIRED`: imposed by DR-006, MR-078A, MR-078B, MR-079, or the I1Q application boundary.
- `OPEN`: no current authority or runtime evidence closes the point.
- `PROPOSED DEFAULT`: a safe candidate for Root and the system owner to ratify. It is not active policy.
- `PROHIBITED`: explicitly disallowed by authority or this fail-closed contract.

## Authority Boundary

`OBSERVED`: WordPress is the identity source of truth. The current flow uses WordPress login and a short-lived signed handoff, MissionMed HQ on Railway for exchange and encrypted session handling, and RANKLISTIQ Supabase Auth for an authenticated Supabase user.

`REQUIRED`: I1Q must reuse this chain through an additive adapter. It must not create frontend sign-up, a parallel identity store, a copied session cipher, a new credential authority, or a broad shared-auth role.

`OPEN`: `MM-AUTH-ARCH-001.md` is referenced by MR-078A, MR-078B, and MR-079 but is absent from its canonical path. This contract does not invent or replace it.

## Current Observed Inputs

The following are observations from the active tracked HQ and WordPress sources. They are not a new canonical assertion format.

| Boundary | Observed fields | Contract treatment |
| --- | --- | --- |
| WordPress handoff | `wp_user_id`, `email`, `username`, `display_name`, `roles`, `iat`, `exp`, `nonce` | Identity evidence only. WordPress roles never become I1Q roles. |
| HQ `/api/auth/validate-wp` | `sub` as `wp:<id>`, `wp_user_id`, `email`, WordPress `roles`, `source`, `issued_at` | Useful binding evidence, but no I1Q audience, session identifier, revocation state, or Supabase UUID. |
| HQ `/api/auth/session` | authenticated state, CSRF token, expiry, WordPress user fields, and a Supabase-or-WordPress fallback user identifier | Browser session observation only. The fallback identifier is not sufficient for I1Q actor identity. |
| HQ `/api/auth/bootstrap` | Supabase access and refresh tokens, expiry duration, Supabase user object, `subject` as `wp:<id>`, and source | Existing Arena and STAT bootstrap behavior. Tokens remain secret-bearing session material and are never recorded in I1Q handoffs or logs. |
| I1Q injected resolver | `validated`, `actor`, `session`, `request_security` | Existing application-facing boundary. The closed shape is defined in `auth_bootstrap_contract.json`. |

`OBSERVED`: the current HQ source warns on missing or expired encrypted-session expiry but still returns the decoded payload. It also lacks an observed durable revocation check for an already issued bearer session. These observations prevent the existing HQ payload from being accepted as a staging-certified I1Q assertion without owner repair and independent proof.

## Observed In-Flight 1008A Candidate

The shared worktree now contains an unratified I1Q identity-adapter candidate. This is an implementation observation, not an authority ruling or deployed state.

- `OBSERVED IN-FLIGHT`: the candidate accepts a RANKLISTIQ Supabase Auth bearer, pins the Supabase issuer and project, expects the standard `authenticated` audience and role, requires a UUID subject and session ID, checks issue and expiry times, rejects anonymous users, and validates the bearer through the Supabase user endpoint.
- `OBSERVED IN-FLIGHT`: the candidate obtains I1Q memberships from a proposed `i1q.resolve_current_identity()` RPC grounded in `auth.uid()`.
- `OBSERVED IN-FLIGHT`: the candidate emits additional `identity` and transport fields, includes `session.issued_at`, and emits an empty CSRF token for bearer transport.
- `OBSERVED IN-FLIGHT`: the proposed RPC orders memberships alphabetically by role name, while this contract requires canonical application-role order. The adapter de-duplicates but does not restore canonical order.
- `OPEN`: the candidate has not been owner-ratified, applied to preview, deployed, or proven through the current HQ and WordPress chain. It does not by itself prove the WordPress-to-RANKLISTIQ UUID binding or durable HQ session revocation.
- `OPEN`: the standard Supabase `authenticated` audience differs from the proposed I1Q-specific audience below. Root and the auth owner must select and publish one accepted assertion profile.
- `REQUIRED`: reviewer credential metadata returned by the candidate database profile is not credential authority and must never authorize medical approval by itself.

The current `auth_bootstrap_contract.json` intentionally rejects that candidate output because the extra fields and blank CSRF value are outside its closed shape. Root must ratify either a cookie-plus-CSRF profile, a bearer profile, or an explicit closed union before integration. No adapter may silently weaken the schema to accommodate both.

## Canonical Actor Identity

### Required Mapping

The I1Q `actor.id` is the lowercase canonical Supabase Auth UUID from the authorized RANKLISTIQ user bound to the validated WordPress identity.

The mapping tuple is:

```text
(wordpress_subject, wordpress_user_id, normalized_email, ranklistiq_supabase_user_uuid)
```

Rules:

1. `wordpress_subject` must equal `wp:` plus the decimal `wordpress_user_id`.
2. `wordpress_user_id` must be a positive integer verified by the WordPress-to-HQ chain.
3. `ranklistiq_supabase_user_uuid` must be a valid UUID obtained from a server-validated RANKLISTIQ Supabase session or an authority-approved server assertion.
4. The Supabase UUID must equal the identity seen by `auth.uid()` for the database transaction.
5. Email may be used to verify the existing binding, but email is never an actor key and an email change must not mint a new I1Q actor.
6. No UUID is derived by hashing the WordPress ID or email.
7. No request header, query parameter, JSON body, browser storage value, or WordPress role may supply or override the actor UUID.

`OPEN`: the current canonical owner has not published a versioned binding assertion that proves this tuple to I1Q.

`PROPOSED DEFAULT`: the HQ/Auth owner publishes a narrow server-to-server introspection or signed assertion with a stable session ID, I1Q audience, WordPress subject, RANKLISTIQ Supabase UUID, expiry, and revocation result. The assertion is consumed only by the dedicated I1Q server.

## I1Q Role Resolution

I1Q roles are database-owned application permissions. They are not WordPress roles and are not JWT custom claims supplied by the browser.

Canonical role order:

1. `platform_admin`
2. `content_operator`
3. `author`
4. `editorial_reviewer`
5. `physician_reviewer`
6. `release_manager`
7. `privacy_officer`
8. `incident_owner`
9. `read_only`
10. `system`

Deterministic resolution:

1. Bind the verified Supabase UUID as the transaction actor.
2. Read only that actor's rows from `i1q.actor_role_memberships`.
3. Keep a membership only when `valid_from <= now`, `revoked_at IS NULL`, and `valid_until IS NULL OR valid_until > now`.
4. Reject unknown role names.
5. De-duplicate and sort roles by the canonical order above.
6. If no active known role remains, fail closed before I1Q route execution.
7. Database functions re-check membership at operation time. A resolver role snapshot never overrides current database revocation.

`PROHIBITED`: direct mappings such as WordPress `administrator` to `platform_admin`, WordPress `instructor` to `physician_reviewer`, or a title/name to physician credential status.

`REQUIRED`: `physician_reviewer` is only an application role. Medical approval additionally requires the separate credential, calibration, assignment, exact-revision, conflict, and medical-governance checks already represented by the I1Q schema. Medical governance remains unassigned.

`REQUIRED`: `system` is reserved for an authority-approved non-human service principal. A normal browser session must never receive it.

## Resolver Operation

The dedicated adapter implements this logical operation:

```text
resolveI1QIdentity(request, trustedCanonicalSessionEvidence, now)
  -> I1Q auth bootstrap payload
  -> authentication_required on any uncertainty
```

The operation is deterministic:

1. Ignore identity-like request headers and body fields.
2. Validate the canonical evidence using the owner-approved mechanism.
3. Require the exact I1Q audience and RANKLISTIQ project binding.
4. Require an opaque session ID, a valid future expiry, and an explicit not-revoked result.
5. Require validation time no more than five minutes old because the current I1Q application enforces that upper bound.
6. Resolve the actor UUID and active database roles using the rules above.
7. Bind request-security data to the same session ID.
8. Allow only exact HTTPS origins registered for the I1Q environment.
9. Return the closed payload defined by `auth_bootstrap_contract.json`.

Any parse error, owner outage, signature failure, audience mismatch, project mismatch, binding mismatch, missing session, expired session, revoked session, stale validation, empty role set, or unsupported role returns the same public authentication failure. Internal diagnostic codes may be logged only without tokens, cookies, email addresses, source content, answers, or student data.

## Session And Revocation Rules

- Expiry comparison is strict: `expires_at <= now` is expired.
- Validation staleness is strict: more than 300,000 milliseconds is stale.
- A validation time more than 30 seconds in the future is invalid.
- Revocation is fail closed. Missing revocation evidence is not equivalent to `false`.
- Logout must clear the browser cookie and make the canonical session unusable for subsequent I1Q resolution.
- Rotation or invalidation of the canonical session authority must invalidate I1Q resolution without an I1Q-specific password reset.
- Role revocation takes effect at the database operation even if a browser-safe actor summary was issued earlier.
- Request CSRF state must be session-bound and origin-bound. It is never accepted from a query parameter.

`OPEN`: the observed HQ implementation does not expose a durable session ID and revocation lookup that I1Q can independently verify.

`PROPOSED DEFAULT`: no I1Q role cache in staging. Resolve roles per request and re-check them in every database transaction until measured performance justifies a bounded cache with explicit revocation invalidation.

## Browser-Safe API Contract

The current I1Q browser calls `GET /api/v1/session`. Its success response remains exactly:

```json
{
  "actor": {
    "id": "10000000-0000-4000-8000-000000000001",
    "roles": ["read_only"]
  },
  "session": {
    "expires_at": "2026-07-15T19:00:00.000Z",
    "csrf_token": "fixture-csrf-token-0001"
  }
}
```

The schema is `$defs.browserSessionResponse` in `auth_bootstrap_contract.json`.

The response contains no WordPress role list, email, display name, Supabase access token, Supabase refresh token, HQ bearer token, cookie, database credential, source reference, answer, or raw authority evidence. It uses `Cache-Control: no-store`.

Public failures are closed objects such as `{"error":"authentication_required"}`. Adapter failure detail is not reflected to the browser.

## Authenticated Test Identities

`OPEN`: no canonical staging test identities or canonical UUIDs were provided.

`PROPOSED DEFAULT`: Root requests synthetic, non-student WordPress accounts that bind to synthetic RANKLISTIQ Auth users. Use one account per I1Q role plus one no-role account. Role combinations required for separation-of-duty tests use distinct accounts. No fixture is a credential record, and no fixture grants medical approval.

The deterministic UUIDs in `contract_test_vectors.json` are local contract fixtures only. They are not registrations, production users, or authority assignments.

## Environment Validation

An environment is eligible for this resolver only when all checks pass:

- environment is exactly `preview` or `staging`
- canonical I1Q host and HTTPS origin are registered
- identity assertion issuer and I1Q audience are owner-ratified
- RANKLISTIQ project binding is exact
- session expiry and revocation are hard failures
- canonical test identities exist and are non-student
- runtime database role and actor-binding mechanism are approved
- no secret value is present in client code, manifests, screenshots, test vectors, or handoffs
- `internal_platform_enabled`, `internal_review_enabled`, and all consumer/student flags remain false until Root separately opens the applicable gate

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy | Blocking effect |
| --- | --- | --- | --- |
| `ID-OPEN-01` | `MM-AUTH-ARCH-001` absent | Do not recreate it. Use DR-006 additive adapter authority and request an owner-ratified I1Q assertion contract. | Blocks a claim of canonical global auth architecture. |
| `ID-OPEN-02` | No versioned I1Q issuer/audience assertion | Narrow HQ/Auth server assertion for `question-platform`. | Blocks authenticated staging. |
| `ID-OPEN-03` | No durable session ID or revocation API | Opaque server session ID plus owner-side revocation check. | Blocks logout and revocation certification. |
| `ID-OPEN-04` | No authoritative WP-to-RANKLISTIQ UUID binding export | Bind only through a server-validated RANKLISTIQ session and record no alternate derived UUID. | Blocks actor provisioning. |
| `ID-OPEN-05` | No staging identities or role assignments | Synthetic non-student accounts and DB-owned role rows. | Blocks role journey tests. |
| `ID-OPEN-06` | No registered I1Q staging origin | Register one exact HTTPS origin and reject all others. | Blocks CSRF and CORS certification. |
| `ID-OPEN-07` | Shared HQ expiry and secret-configuration findings remain observed | HQ/Auth owner repairs and independently certifies them before I1Q trusts the chain. | Blocks canonical resolver acceptance. |
| `ID-OPEN-08` | In-flight direct Supabase bearer profile versus HQ assertion profile | Owner-ratified single profile or an explicit closed union, with equivalent binding, revocation, origin, and audit proof. | Blocks adapter conformance. |

## Acceptance Evidence

This contract is implementable only when a fresh verifier proves every identity, role, expiry, revocation, CSRF, origin, outage, pool-reuse, and dependent-consumer vector in `contract_test_vectors.json`. Local fixtures alone do not close any `OPEN` authority item.
