# I1Q-1008A Identity Contract

## Version

`i1q.identity.v1`

The server rejects a missing or different version before route authorization.

## Verified Bearer Profile

Required token properties:

- exact RANKLISTIQ issuer
- audience contains `authenticated`
- role is `authenticated`
- `is_anonymous` is false
- UUID `sub`
- UUID `session_id`
- finite `iat` and `exp`
- expiry later than issue time and current time
- only approved JWT algorithms
- remote `/auth/v1/user` response ID equals `sub`

The application profile must return the same actor UUID, at least one current known I1Q role, active state, and no revocation. Unknown roles and invalid validity windows fail closed.

## Trusted Internal Context

The adapter emits a frozen server-only context containing:

- `validated: true`
- actor ID and database-owned roles
- session ID, issue time, expiry, validation time, and explicit non-revoked state
- contract version and canonical UUID binding
- optional WordPress trace and credential status
- bearer transport, exact trusted origins, and the same session ID

`normalizeIdentityContext` independently enforces the version, actor equality, active state, expiry, freshness, and request-security binding.

## Browser Response

`GET /api/v1/session` returns only:

```json
{
  "actor": {
    "id": "synthetic-actor-id",
    "roles": ["read_only"]
  },
  "session": {
    "expires_at": "2026-07-15T20:00:00.000Z",
    "csrf_token": null
  }
}
```

The browser response excludes email, WordPress fields, Supabase tokens, credential metadata, source data, answers, and identity-provider diagnostics.

## Request Integrity

- Bearer writes require the verified bearer on the request, an exact configured HTTPS Origin, matching session identity, and no cross-site fetch classification.
- Cookie-style injected contexts require a session-bound CSRF token and an exact trusted Origin.
- GET authorization still requires a freshly validated identity.

## Unclosed Lifecycle

`OPEN`: no authorized I1Q staging origin, canonical test account, refresh implementation, provider-backed logout journey, old-tab invalidation proof, or end-to-end handoff replay proof exists. A local fail-closed logout composition point exists, but the adapter remains a candidate contract rather than authenticated staging evidence.
