# I1Q-1007X Authentication

## Verdict

`LOCAL CONTRACT PASS, CANONICAL INTEGRATION BLOCKED`

## Implemented Boundary

The internal service accepts a resolver-supplied identity context, validates session state, derives the actor and roles from that trusted context, and rejects missing, expired, revoked, stale, unvalidated, or unavailable sessions. Unsafe requests require a session-bound CSRF token and trusted Origin. Local synthetic mode is restricted to loopback and refuses normalized production environments or ambiguous forwarded-host input.

The browser shell obtains its actor summary and CSRF token from `GET /api/v1/session`. It does not create a second identity store, expose a sign-up path, or accept caller-provided roles.

Answer-bearing reviewer content uses a separate injected resolver. Production mode refuses the route when that adapter is absent. The adapter receives the trusted identity context and must return a closed-world payload bound to the accepted assignment, exact immutable revision, reviewer role, and editorial or medical purpose. Direct reader, wrong actor, wrong role, wrong purpose, open assignment, completed assignment, and wrong-hash attempts fail closed.

## Negative Evidence

Direct tests cover:

- missing and unavailable identity resolvers
- expired, revoked, stale, and unvalidated sessions
- missing or incorrect CSRF tokens
- untrusted Origin values
- local-demo attempts in production
- forwarded-proxy ambiguity
- actor, reviewer, assignment, role, credential, and revision-hash substitution
- missing or malformed protected-review adapters and wrong-purpose protected reads

All current local auth and security tests pass.

## External Gate

No canonical MissionMed HQ identity resolver has been wired to an I1Q host. No authenticated staging session, WordPress relay journey, Railway session, production timeout, reauthentication, or logout path was executed. The service therefore remains fail closed outside local synthetic mode.

## Release Rule

`internal_platform_enabled` and `internal_review_enabled` remain off. Authentication is not certified for State C until the canonical adapter is owner-provided, wired to the unprivileged datastore role, and proven in staging.
