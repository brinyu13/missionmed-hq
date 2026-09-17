# I1Q-1007X Row Level Security

## Verdict

`FORCED RLS CONTRACT PASS LOCALLY, RUNTIME ROLE CERTIFICATION BLOCKED`

## Controls

Every table created by the 1007X migration enables and forces RLS. The candidate revokes schema and table access from `PUBLIC`, `anon`, and `authenticated`. It intentionally does not create a broad runtime grant.

Actor identity is grounded in `auth.uid()` and database membership. Historical caller-asserted role GUC semantics are not accepted. Purpose-scoped functions protect answer-bearing data, restricted source references, review writes, release assembly, validation, promotion, and compensation.

## Adversarial Proof

The disposable PostgreSQL run proved denial for anonymous access, ordinary read-only answer access, revoked reviewer access, assignment and role mismatches, channel-policy mismatches, pre-answer answer fields, release-scoped Class D keys and values in Class A and Class C artifacts, invented validation checks, and incorrect validation evidence hashes. It also executed 196 actual mixed-case release-linked identifier probes across seven families, four Class C prose fields, and seven direct or encoded variants, plus 16 encoded-marker probes and depth and 64 KiB size fail-closed cases. Every denied probe left zero rows in both artifact tables. Safe Class A and Class C artifacts and the exact official validation set succeeded.

## Remaining Risk

No canonical unprivileged runtime role exists yet, and no runtime grant manifest was supplied. The Postgres repository is not wired to the HTTP service. Staging connection pooling, transaction-local actor propagation, role revocation latency, query plans, and production policy behavior are untested.

The absence of runtime grants is deliberate fail-closed behavior, not State C readiness.
