# I1Q Runtime Database Role Contract

Contract ID: `I1Q-RUNTIME-ROLE-v1`

Status: `PROPOSED CONTRACT, PHYSICAL ROLE AUTHORITY OPEN`

## Purpose

This contract defines the least-privilege database boundary for an authenticated I1Q staging server. It does not create a role, grant access, inspect a secret, or select a preview target.

## Observed Candidate State

- `OBSERVED`: the I1Q migration revokes all access to schema `i1q` from `PUBLIC`, `anon`, and `authenticated`.
- `OBSERVED`: all 52 I1Q tables enable and force RLS.
- `OBSERVED`: the migration deliberately creates no broad runtime grant.
- `OBSERVED`: the current `PostgresRepository` requires a dedicated connection, opens a transaction, verifies `i1q.current_actor_id()`, commits on success, and rolls back and releases on failure.
- `OBSERVED`: the current repository does not establish actor context. It assumes an upstream connection adapter has already made `auth.uid()` resolve correctly.
- `OPEN`: no canonical I1Q database login role, preview database branch, project-pinned connection path, or grant manifest exists.

### Observed In-Flight Capability-Role Candidate

- `OBSERVED IN-FLIGHT`: a shared-worktree follow-on migration proposes `i1q_runtime` as a `NOLOGIN`, `NOBYPASSRLS` capability role with schema `USAGE` and exact `EXECUTE` on `i1q.resolve_current_identity()`.
- `OBSERVED IN-FLIGHT`: it grants that capability role to the built-in Supabase `authenticated` role. The companion compensation revokes the membership, and a separate reapply candidate restores it while leaving all feature flags false.
- `OBSERVED IN-FLIGHT`: the candidate is not ratified, applied, or deployed. Its physical name and grant graph are not canonical authority merely because source files exist.
- `OPEN`: this capability-role design differs from the dedicated server-login proposed default below. It intentionally makes the identity-profile RPC callable under any valid RANKLISTIQ `authenticated` session, subject to `auth.uid()` and the function's own closed response.

`REQUIRED`: Root and the RANKLISTIQ owner must choose one runtime model. Until then, neither the in-flight capability role nor the proposed dedicated login is staging-authorized. If the capability-role model is selected, this contract and its vectors must be revised explicitly, the role membership graph must be closed and checksummed, the RPC must expose only the caller's own minimum identity profile, and no table or unrelated function privilege may transitively reach `authenticated`.

## Role Separation

The following are distinct identities and must never be collapsed:

| Logical role | Purpose | Runtime data access |
| --- | --- | --- |
| `I1Q_MIGRATION_OWNER` | Apply reviewed forward migrations through the canonical workflow | Owns migration execution only. Never used by the app. |
| `I1Q_RUNTIME` | Serve authenticated I1Q API requests | Least-privilege grants below. Never owns schema objects. |
| `I1Q_AUDITOR` | Read approved operational metadata and migration evidence | Read-only, no answers, raw sources, credentials, or role mutation. |
| `I1Q_ROLLBACK_OPERATOR` | Execute the approved forward compensation through workflow | Not an application login. No normal user actor context. |

Application roles such as `platform_admin`, `author`, or `release_manager` are rows in `i1q.actor_role_memberships`. They are not PostgreSQL login roles.

## Runtime Role Attributes

`I1Q_RUNTIME` must have all of these attributes:

- login capability only through the approved server-side connection mechanism
- `NOSUPERUSER`
- `NOCREATEDB`
- `NOCREATEROLE`
- `NOINHERIT`
- `NOBYPASSRLS`
- no replication privilege
- no schema or table ownership
- no membership in migration-owner, service-role, `postgres`, `anon`, or `authenticated`
- no permission to alter its own attributes, role membership, default privileges, or search path globally
- no permission to set `session_replication_role`
- no direct browser, WordPress, or client-side connection

`OPEN`: the physical role name is not authorized.

`PROPOSED DEFAULT`: use `i1q_app_runtime` only after the RANKLISTIQ owner approves it through the project-pinned workflow. The string in this document is not a role registration.

## Closed Grant Inventory

The grant manifest is allowlist-only. Unknown objects, wildcard grants, future objects, or `ALL` privileges fail validation.

### Database And Schema

| Object | Allowed privilege |
| --- | --- |
| Exact authorized preview or staging database | `CONNECT` |
| Schema `i1q` | `USAGE` |
| Project-native identity function dependency required by `auth.uid()` | only the minimum owner-approved `USAGE` and `EXECUTE` needed by the actor binder |

No privilege is allowed on any other schema.

### Direct Table Reads Required By The Current Repository

| Table | Privilege | RLS boundary |
| --- | --- | --- |
| `i1q.item_revisions` | `SELECT` | `item_revisions_scoped_read` |
| `i1q.review_assignments` | `SELECT` | `review_assignments_scoped_read` |
| `i1q.release_memberships` | `SELECT` | release-role read policy |

No direct `INSERT`, `UPDATE`, or `DELETE` is granted on these tables. No direct table privilege is granted on answer, restricted-source, audit, feature-flag, role-membership, reviewer-credential, governance, promotion, or payload tables.

`OPEN`: the full 17-workflow staging route-to-repository map is not implemented. Any additional table read requires a new exact entry, RLS proof, response-schema proof, and negative test before it enters the runtime manifest.

### Approved Candidate Function Surface

The current repository references this closed candidate surface:

- `i1q.current_actor_id()`
- `i1q.read_item_revision_answers(text, text)`
- `i1q.read_restricted_source_reference(text, text)`
- `i1q.create_review_assignment(text, text, text, text, text, timestamptz)`
- `i1q.accept_review_assignment(text)`
- `i1q.record_review_event(text, text, text, jsonb)`
- `i1q.register_export_question_identity(text, text, text)`
- `i1q.assemble_release(text, text, text, jsonb)`
- `i1q.record_export_validation(text, text, text, text[])`
- `i1q.promote_release(text, text, text, text, jsonb, text)`
- `i1q.create_channel_artifact(text, text, text, text, text, text, text, jsonb)`
- `i1q.read_channel_artifact_payload(text, text)`

Policy evaluation may require exact `EXECUTE` on these helper functions:

- `i1q.has_active_role(text)`
- `i1q.has_any_active_role(text[])`
- `i1q.holds_governance_slot(text)`
- `i1q.revision_workflow_state(text)`
- `i1q.has_revision_assignment(text)`
- `i1q.can_read_revision(text)`
- `i1q.can_read_review_record(text, uuid)`

The actual preview grant inventory must be generated from the deployed function signatures and compared exactly. A signature mismatch or extra overload blocks the grant.

### Explicit Function Denials

`I1Q_RUNTIME` must not execute:

- `i1q.disable_i1q_behavior(text, text)`
- `i1q.append_audit_event(text, text, text, jsonb)`
- trigger functions
- immutable-record rejection functions
- internal hash-chain preparation functions
- arbitrary dynamic SQL helpers
- any unlisted function or future overload

The app receives audit effects only through approved business functions. It never supplies sequence, predecessor hash, actor label, event hash, or compensation identity.

## Secret And Connection Handling

- The database credential is stored only in the canonical deployment provider's secret facility.
- The value is never emitted to a file, shell transcript, log, screenshot, browser bundle, handoff, or test vector.
- Environment validation records only secret presence, owner, version identifier, rotation date, and non-secret fingerprint where authority permits.
- The browser receives no database URL, password, service-role token, migration-owner credential, or Supabase service key.
- Pool size and timeout are environment configuration, not user input.
- One dedicated connection is checked out per transaction and always released.

## Transaction Contract

Every authenticated database operation follows this order:

1. Resolve and validate the canonical identity outside SQL.
2. Check out one `I1Q_RUNTIME` connection.
3. Begin a transaction.
4. Set the allowed isolation and read mode.
5. Establish the actor through the owner-approved transaction-local binder.
6. Verify `i1q.current_actor_id()` equals the resolver actor UUID.
7. Resolve or re-check active roles from database-owned membership rows.
8. Execute only a parameterized allowlisted repository operation.
9. Commit, or roll back on any error.
10. Prove actor context is absent before the connection can serve a later request.

Any failure in steps 3 through 10 rejects the request and retires the connection when context-clearing cannot be proven.

## Environment Grant Manifest Shape

The future machine-readable grant manifest is closed world with exactly these top-level keys:

```text
schema_version
environment
project_id
database_fingerprint
logical_role
physical_role
role_attributes
database_privileges
schema_privileges
table_privileges
function_privileges
explicit_denials
generated_at
approved_by
evidence_sha256
```

Rules:

- `schema_version` is `i1q.runtime-role-manifest.v1`.
- `environment` is `preview` or `staging`, never `production` for I1Q-1008A.
- `project_id` is the RANKLISTIQ project selected by MR-078B.
- `physical_role`, target database, and `approved_by` remain `OPEN` until owner-ratified.
- every privilege entry contains exact object kind, fully qualified identity, signature when applicable, and privilege list
- no unknown top-level or privilege-entry key is accepted
- the evidence hash is lowercase SHA-256 over canonical JSON with the evidence field omitted

## Required Negative Proof

Staging certification requires denial with zero sensitive rows for:

- anonymous and `anon` access, plus all `authenticated` direct table and business-function access
- authenticated self-profile RPC access unless Root explicitly selects and ratifies the capability-role model
- missing actor context
- arbitrary actor UUID context
- WordPress ID used as database UUID
- request-supplied role claim
- revoked, expired, future, and unknown membership
- cross-actor and cross-assignment reads
- direct answer and source table reads
- direct audit and feature-flag mutation
- `SET ROLE`, role inheritance, and RLS bypass attempts
- wildcard table or function grants
- compensation function execution by runtime
- pooled-connection actor reuse
- service-role or migration-owner credential in browser/build/log output

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy |
| --- | --- | --- |
| `DBROLE-OPEN-01` | Physical runtime role and credential owner | `i1q_app_runtime`, created by the RANKLISTIQ owner through the canonical workflow. |
| `DBROLE-OPEN-02` | Exact preview database and branch | Dedicated RANKLISTIQ preview branch with non-production data only. |
| `DBROLE-OPEN-03` | Concrete `auth.uid()` actor binder for direct server connections | Use the project-native JWT claims mechanism after inspecting and testing the exact preview implementation. Do not restore `app.actor_id` or caller role GUCs. |
| `DBROLE-OPEN-04` | Full route-to-repository map | Grant only the current repository surface, then add exact operations as Root integrates each route. |
| `DBROLE-OPEN-05` | Auditor physical role and approved views | Separate read-only role over metadata-only views, with answers and sources structurally absent. |
| `DBROLE-OPEN-06` | Dedicated server login versus inherited Supabase capability role | Owner selects one explicit model after closed grant-graph and browser-reachability tests. Do not blend the models. |

No external database action is authorized by this document.
