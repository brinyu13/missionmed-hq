# I1Q RLS Actor Contract

Contract ID: `I1Q-RLS-ACTOR-v1`

Status: `LOCAL POLICY SHAPE VERIFIED, STAGING ACTOR BINDER OPEN`

## Security Objective

Every database decision must be made from a server-verified RANKLISTIQ Supabase UUID and current database-owned I1Q memberships. Authentication alone never grants answer, source, review, governance, release, or audit access.

## Observed Policy Foundation

- `i1q.current_actor_id()` returns `auth.uid()`.
- `i1q.actor_role_memberships.actor_id` is a UUID.
- active membership requires the exact role, no revocation, a started validity window, and a non-expired end window.
- every I1Q table has RLS enabled and forced.
- `PUBLIC`, `anon`, and `authenticated` are revoked from schema, tables, sequences, and functions.
- answer-bearing rows and restricted-source references have no direct read policy.
- review reads and writes are assignment-scoped and exact-revision-bound.
- the current repository verifies `i1q.current_actor_id()` after beginning its transaction but does not establish it.

### Observed In-Flight Identity RPC

`OBSERVED IN-FLIGHT`: a shared-worktree migration candidate adds a `SECURITY DEFINER` function named `i1q.resolve_current_identity()`. It obtains only `i1q.current_actor_id()`, reads that actor's membership and reviewer rows, filters membership revocation and validity windows, fixes its search path, and returns an `i1q.identity.v1` profile. Its proposed capability grant reaches the built-in Supabase `authenticated` role through `i1q_runtime` membership.

`OPEN`: the function owner, complete effective grant graph, row-shape cardinality, credential-field authority, and live PostgREST behavior have not been certified. Source presence is not staging evidence.

`REQUIRED`: any credential fields are informational database metadata only. Medical approval still requires the separate physician credential authority, assignment, calibration, exact-revision, conflict, evidence, and governance gates. The RPC cannot create credential authority.

`PROPOSED DEFAULT`: if Root selects this RPC design, validate it as a minimal self-profile endpoint under a standard Supabase bearer and keep every authoring, answer, source, release, audit, and feature-flag privilege absent. If Root selects a dedicated server connection instead, do not expose the RPC transitively to all `authenticated` users.

## Actor Context Shape

The logical transaction context is closed world:

```text
schema_version
actor_id
canonical_session_id
validated_at
expires_at
environment
identity_evidence_sha256
```

No role list, WordPress role, email, display name, credential, answer purpose, source purpose, assignment ID, or client token belongs in actor context.

Rules:

- `schema_version` is `i1q.rls-actor-context.v1`.
- `actor_id` is the lowercase verified RANKLISTIQ Supabase UUID.
- `canonical_session_id` is opaque and server-side.
- `environment` is `preview` or `staging`.
- the evidence hash identifies redacted validation evidence and never contains a token value.
- unknown keys fail validation.

## Transaction Binding

Required sequence:

1. Resolve the identity under `I1Q-IDENTITY-RESOLVER-v1`.
2. Check out a dedicated `I1Q_RUNTIME` connection.
3. Begin the transaction and set the approved isolation and read mode.
4. Establish the actor with the project-native, owner-approved transaction-local mechanism.
5. Query `i1q.current_actor_id()` and compare it byte-for-byte to the resolver UUID.
6. Deny on null, mismatch, malformed UUID, expired session, revoked session, or stale validation.
7. Resolve active roles from `i1q.actor_role_memberships` for the current actor.
8. Execute only the parameterized repository operation.
9. Commit or roll back.
10. Before connection reuse, prove `i1q.current_actor_id()` is null outside the completed transaction. Retire the connection if proof fails.

`OPEN`: the exact transaction-local mechanism that makes the real preview implementation of `auth.uid()` return the verified UUID has not been selected or tested.

`PROPOSED DEFAULT`: use the RANKLISTIQ project's native verified JWT claims context through the approved server adapter after inspecting the exact preview implementation. Do not use `app.actor_id`, `app.actor_roles`, request headers, or caller-provided GUC values.

## Role Evaluation

The active predicate is exactly:

```text
actor_id equals current_actor_id
AND role_name equals the required known role
AND revoked_at is null
AND valid_from is less than or equal to database time
AND valid_until is null or greater than database time
```

Boundary behavior:

- `valid_from == now`: active
- `valid_until == now`: inactive
- any non-null `revoked_at`: inactive
- missing membership: inactive
- unknown role: invalid data and inactive
- duplicate active membership for actor and role: integrity failure, not additive permission

Resolver roles are a browser/API convenience snapshot. SQL authorization re-evaluates memberships at operation time. A stale resolver snapshot cannot revive a revoked database membership.

## Role And Data Boundaries

| Area | Required database condition |
| --- | --- |
| Public reference metadata | exact read policy and active allowed role |
| Draft revision | actor is exact author and has active `author` role |
| Editorial review content | accepted exact assignment, exact revision hash, exact reviewer actor, active `editorial_reviewer` role |
| Medical review content | accepted exact assignment, exact revision hash, exact reviewer actor, active `physician_reviewer` role, plus separate credential and calibration checks |
| Restricted source reference | active `privacy_officer` or approved `system` service identity and purpose-scoped function |
| Release validation answers | active `release_manager`, approved workflow state, and purpose-scoped function |
| Audit event | created only by approved business function or trusted trigger |
| Feature flags | no runtime mutation policy |
| Compensation | migration or rollback operator only, with no user actor context |

`platform_admin` is not a universal answer or source bypass. `read_only` never receives answers, raw sources, reviewer credentials, or unpublished release payloads.

## Request To Database Separation

The following are always ignored or rejected as authorization input:

- `actor_id`, `user_id`, `reviewer_actor_id`, or `auth.uid` in request JSON
- actor or role headers
- WordPress role strings
- email or username
- requested database role
- assignment ownership asserted by the client
- credential status asserted by the client
- finalization state asserted by the client
- answer or source access purpose not matched to an exact server route

The server may pass business identifiers such as an assignment ID only to a closed repository method. The database derives actor identity from context and compares ownership itself.

## Revocation And Expiry

- Session expiry is checked before transaction binding.
- Session revocation is checked before transaction binding.
- Role expiry and revocation are checked by the database at operation time.
- Review assignment state and reviewer activity are checked at operation time.
- Credential expiry or revocation is checked separately for medical operations.
- A revoked role or session must fail on the next operation. No browser refresh is required for the database denial.
- No positive permission result is cached across transactions in staging.

`OPEN`: the canonical session revocation source and maximum accepted revocation propagation delay are not published.

`PROPOSED DEFAULT`: zero application role cache for staging and a hard owner-side revocation check on every resolver invocation.

## Environment Validation

The actor binder is certified per environment, never globally. Required evidence:

- exact project and database fingerprint
- definition or behavior proof for `auth.uid()` without exposing secrets
- runtime role attributes and exact grants
- actor UUID equality proof
- null actor denial
- spoofed actor and role denial
- valid, expired, future, revoked, and unknown role tests
- cross-actor and cross-assignment denial
- answer and source direct-read denial
- transaction commit, rollback, exception, timeout, and pool-reuse clearing tests
- concurrent requests from two actors on reused pool connections
- no context in logs or errors
- all six I1Q flags remain false during infrastructure certification

## Required Deterministic Vectors

`contract_test_vectors.json` defines the minimum cases. A verifier must add live environment vectors for:

- actual preview `auth.uid()` behavior
- actual physical runtime role attributes
- exact grant inventory
- actual pool implementation
- actual session revocation path
- actual database clock boundaries

Synthetic vectors prove implementation behavior only. They do not prove the preview environment.

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy |
| --- | --- | --- |
| `RLS-OPEN-01` | Approved actor binder | Project-native verified JWT claims context, set transaction-locally by the server adapter. |
| `RLS-OPEN-02` | Canonical revocation source | HQ/Auth owner introspection keyed by opaque canonical session ID. |
| `RLS-OPEN-03` | Runtime role | Least-privilege role in `runtime_role_contract.md`. |
| `RLS-OPEN-04` | Preview pool and context clearing | Dedicated pool, one transaction per operation, retire connection on failed clearing proof. |
| `RLS-OPEN-05` | Staging role fixtures | Synthetic non-student actors, one per role plus no-role and revoked-role fixtures. |
| `RLS-OPEN-06` | In-flight `resolve_current_identity()` exposure model | Ratify direct authenticated self-profile RPC or server-only resolution, then prove exact effective privileges. |

## Verdict

The policy model is suitable for preview testing. No claim of real RLS actor certification is valid until the actor binder, runtime role, and pool-clearing vectors pass against the selected preview database.
