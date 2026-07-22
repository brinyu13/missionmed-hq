# P1-RISE-4006 Security Report

## Verdict

**Isolated candidate controls: PASS**
**Production security gate: FAIL CLOSED / NOT CONNECTED**

No unresolved Critical or High defect was found in the isolated candidate after repair and regression testing. Production cannot start without the absent identity, source-rights, artifact, activation, audit, abuse-control, and route configuration, so the missing infrastructure does not degrade into an insecure default.

## Implemented Controls

### Authentication and Session Binding

- Exact HQ issuer and `rise` audience validation.
- Cookie-only browser session forwarding; browser bearer tokens rejected.
- Persistent upstream session, current validation timestamp, expiry, revocation, role, and capability checks.
- Maximum 12-hour RISE session lifetime.
- Opaque HMAC-derived session identifiers; no email or upstream access token exposed to RISE.
- Public shell reveals no registry data; API access requires `rise:read`, and operator metrics require `rise:operator` or `rise:admin`.

### Request Integrity

- CSRF token required for POST, PUT, PATCH, and DELETE.
- Bounded JSON request bodies and harmless handling of malformed filters.
- Shared durable pre-auth and subject-scoped abuse checks required in production.
- External adapter calls require HTTPS, bounded responses, and timeouts.
- Artifact bootstrap accepts only same-origin URLs and verifies complete hashes before startup.

### Data and Evidence Integrity

- Production rejects preview authentication and offline or synthetic registry releases.
- Exact source-authorization set, revocation state, index hash, manifest hash, activation receipt, and asset manifest required.
- Activation receipt binds release, index, manifest, validation decision, and actor.
- Missing, expired, revoked, or mismatched source evidence blocks activation.
- Unknown values remain unknown; negative or eligibility conclusions are not inferred.

### Logging and Audit

- Structured logs carry request and build identity without raw subject IDs.
- Subject audit IDs are keyed HMAC values, not reversible hashes of predictable identities.
- Production requires an audit key.
- Proposed database audit events require `hmac-sha256`, a key ID, unique event hashes, current-head predecessor, and monotonic timestamps.

### Database Isolation

- Registry releases are immutable and release-scoped.
- Application tables are RLS-enabled and forced with no browser or runtime grants.
- Authorization redemption identity is composite-bound to sessions.
- Registry reader loses base-table and quarantine access and receives only active non-quarantine views.
- Proposed down migrations refuse destructive weakening.

## Adversarial Coverage

Tests exercised authorization drift, capability denial, wrong issuer, expiration, revocation, browser bearer rejection, missing CSRF, oversized and malformed bodies, pre-auth abuse rejection, cross-subject session insertion, audit predecessor tampering, index and asset hash tampering, source-rights expiry and revocation, synthetic production activation, XSS-shaped search, Unicode, stale async responses, and fake integration references.

## Dependency and Secret Review

- `npm audit --json`: 0 vulnerabilities across 103 dependencies.
- Secret-pattern scan found only two deliberately fake bearer values in test assertions.
- No credential, private key, production export, database URL, service-role key, or live access token was added.

## Remaining Security Preconditions

- HQ must explicitly support learner audience `rise`; the current shared source does not.
- Approved secret storage must provide artifact, abuse-controller, and audit keys.
- A dedicated RISE database owner must install reviewed RLS policies, runtime login roles, backup, and restore controls.
- Same-origin edge routing and cookie behavior require website and Cloudflare review.
- Matrix, ACTN, CAM, and StoryForge owners must approve payloads, purposes, role rules, and replay handling.
- Staging must run IDOR, cross-student, cache-leakage, session-expiry, and account-role tests with authorized accounts.

Production security remains **NO-GO** until those preconditions are independently verified.
