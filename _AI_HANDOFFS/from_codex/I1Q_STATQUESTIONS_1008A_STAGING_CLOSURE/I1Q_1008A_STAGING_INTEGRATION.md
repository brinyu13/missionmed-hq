# I1Q-1008A Staging Integration

## Local Candidate

The application now has:

- a strict `i1q.identity.v1` adapter
- closed nonmedical role fixtures
- a minimal browser session response
- origin-bound bearer and CSRF write checks
- fail-closed static-shell access and deployment readiness adapters
- a canonical logout composition point and deterministic signed-out UI state
- atomic client-observed `If-Match` draft updates
- awaited platform calls at the HTTP boundary so a persistent asynchronous adapter can satisfy the service contract
- a staging-only composition root that rejects memory, synthetic, incomplete, unpinned, or noncanonical adapters
- separated database identity and application runtime roles
- fail-closed feature flags

## Integration Gaps

`BLOCKED EXTERNAL`:

- no authorized staging host or exact trusted origin
- no canonical staging test identities
- no approved bearer acquisition, refresh, provider logout, or durable revocation route
- no preview database target
- no `i1q_app_runtime` login binding, actor binder, or grant manifest
- no deployed secret inventory

`BLOCKED LOCAL ARCHITECTURE`:

- no approved `runtime-adapters/*.mjs` module exists because the target, actor binder, exact table or function grants, and canonical lifecycle are unassigned
- `PostgresRepository` remains a partial transaction and purpose-scoped data boundary rather than a complete persistent implementation of every platform workflow
- the shell exposes 17 workflow destinations plus authenticated entry, logout, and unauthorized or revoked states, but none is proven end to end against an authenticated hosted datastore

The local demo remains loopback-only and synthetic. It is not staging and must not be relabeled.

## Integration Verdict

The final product candidate at commit `fd7ddcd` now fails closed instead of starting the synthetic memory service through `npm start`. Useful local contracts are complete enough for the next infrastructure owner decision. A genuinely functioning datastore-backed authenticated staging application is not integrated.
