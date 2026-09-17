# I1Q-1008A Avicenna Diagnostics Log

## Verdict

`LOCAL REPAIRS VERIFIED; AUTHENTICATED STAGING STILL BLOCKED`

The latest root candidate resolves the identity trust-boundary version gap, stale draft-save protection, and the earlier browser/runtime role conflation. The new role model is directionally correct: `authenticated` receives only a caller-scoped identity-profile capability, while `i1q_app_runtime` remains separate, browser-inaccessible, and deny-all.

State C is still not defensible. The application has no production identity or datastore composition, no staging service or target exists, and several local fail-closed defects remain. No staging test ran.

No external database, provider, production system, raw transcript, student record, secret value, or environment value was accessed. No migration or deployment ran outside disposable local PostgreSQL.

## Snapshot

Observed: `2026-07-15 16:10:14 EDT`

Branch: `i1q-statquestions-1008a`

HEAD: `81273add2c0fe350d330902d229683662896a1b1`

The candidate is concurrent and uncommitted. This report is bound to these hashes:

| Artifact | SHA-256 |
| --- | --- |
| `src/auth.mjs` | `c39b9d6e1f49056e18f0e9801513380b914f0d12edd007b7e9947abe52891a8b` |
| `src/server.mjs` | `2f80c8029627f9db82a5fe0cf787192c0c2d4a1c31cd4f76f0279f1e126d11c6` |
| `src/identity-adapter.mjs` | `1c122e33f2b49e90866b3b52b0031116eecf4f747b73b1c2fe9b838e0255b539` |
| `src/platform.mjs` | `7cef0f9132822bb918df5f8be02d4a5a9ed4d057389ad79abde7f545638512ba` |
| 1008A runtime migration | `bb1a65c4bf8d4539b9980bb04c83caba718ddfda01bcdff5fc1fe89bda9dbda1` |
| 1008A compensation | `048b752eb986531e9d46dcec1f3767138106d74d6c7c0647342c6824b7851b04` |
| 1008A reapply | `7c8402d7932c097835e4268597373946f27262578695b6920852463536b040d5` |
| Preview workflow | `462bd69e3ebedf4d9be71b7705e3884f1a332e2fded96be8620b3f1ddfc1fcf6` |
| Preview target manifest | `7907aaad09250981e586cbdcf286f3b2fd92addee70671aa3f289885a2512608` |
| Runtime PostgreSQL test | `b5677e4af353377ea7a0e36956266af54d50842edee9420f2e05265885f971c0` |
| API tests | `13f9c229ed39f703ab06a403663bfb8050db91dc171a2cfbbb89200fde1bab0f` |
| Security regression tests | `6b8d754572aa2fe82d24d859e1d03450de6c7c5112985a24f540f67c9a15412b` |

Earlier HERSCHEL hashes describe prior concurrent snapshots and must not be used for final certification.

## Validation Results

| Check | Result | Classification |
| --- | --- | --- |
| Full local Node suite | `275 total`, `273 pass`, `0 fail`, `2 skipped` | `VALIDATED LOCAL CONTROL` |
| Latest 1008A disposable PostgreSQL test | `1 pass`, `0 fail`, `0 skip` | `VALIDATED LOCAL CONTROL` |
| Base 1007X disposable PostgreSQL test on UTF-8 | `13 pass`, `0 fail`, `0 skip` | `VALIDATED LOCAL CONTROL` |
| JavaScript syntax, JSON syntax, Git whitespace | Pass | `VALIDATED LOCAL CONTROL` |
| Workflow YAML parse | Pass, syntax only | `VALIDATED LOCAL CONTROL` |
| Staging or hosted Supabase tests | Not run | `TRUE EXTERNAL BLOCKER` |

The two default suite skips are the PostgreSQL tests that require explicit disposable URLs. Both were run separately during Avicenna diagnostics.

## Resolved Local Defects

### `AV-FIX-01` Mandatory identity contract and canonical actor

`RESOLVED LOCAL DEFECT`

`normalizeIdentityContext()` now requires an identity object with exact `i1q.identity.v1`, matching canonical actor, matching Supabase actor when supplied, active state, and non-revoked state. Missing identity, wrong version, and wrong actor all return 401 in the new security regression.

### `AV-FIX-02` Exact draft-save precondition

`RESOLVED LOCAL DEFECT`

Draft PATCH now requires a 64-character `If-Match` content hash. The platform passes that client-observed hash to the repository instead of rereading and substituting the current hash. Missing precondition returns 422. A stale second writer returns 409, and the first writer's content remains intact. The browser and OpenAPI contract were updated.

### `AV-FIX-03` Browser identity and server runtime roles are separated

`RESOLVED LOCAL CONFLATION`

The old single `i1q_runtime` concept is gone.

- `i1q_identity_profile_reader` is `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` and receives schema usage plus execute only on `i1q.resolve_current_identity()`.
- `authenticated` receives only membership in `i1q_identity_profile_reader`.
- `i1q_app_runtime` is a distinct `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` role.
- `i1q_app_runtime` receives no schema, table, function, or browser membership grant.
- Compensation and reapply toggle only the identity-profile membership.

The refreshed disposable PostgreSQL test proves this clean-target shape across apply, compensation, and reapply.

### `AV-FIX-04` PostgreSQL harness missing-setting cast

`RESOLVED LOCAL DEFECT`

Both harnesses use `NULLIF(current_setting(...), '')::uuid`. The latest disposable runtime test passes, so the NULLIF issue is repaired.

### `AV-FIX-05` Credential expiry propagation

`RESOLVED LOCAL DEFECT`

The identity RPC returns `credential_expires_at`, and the adapter requires current credential evidence before setting `credential_verified=true`. The expired-credential test passes.

### `AV-FIX-06` Preview backup and role-state gate hardening

`RESOLVED LOCAL DEFECT`

The preview workflow no longer ignores a schema-fingerprint failure. Non-validate operations require committed backup and restore evidence identifiers. Post-operation SQL checks forced RLS, all flags off, no direct I1Q table grants, profile membership state, and deny-all app runtime. Evidence receives a redaction scan and hashed inventory before upload.

This is local workflow hardening, not proof that a real backup, restore, or target exists.

### `AV-FIX-07` Static shell and logout boundaries

`RESOLVED LOCAL DEFECT`

Non-demo static assets now require an injected fail-closed access resolver. Logout requires an injected canonical revocation adapter, and the regression proves that the old bearer is rejected after synthetic revocation. These are sound interfaces, but neither adapter is composed in a real staging startup yet.

## Role Model Assessment

### Identity-profile capability

Verdict: `APPROPRIATE ON A VERIFIED CLEAN TARGET`

Broad `authenticated` access to `resolve_current_identity()` is not equivalent to broad application runtime access. The function is `auth.uid()` scoped, returns only the caller's app memberships and credential status, and gives roleless users an inactive profile that the adapter denies. It exposes no authoring tables, answer keys, or raw sources.

Residual requirement: the role must have an exact global privilege graph. The migration validates role attributes but accepts a pre-existing `i1q_identity_profile_reader` without auditing unrelated direct grants, ownership, or memberships. Avicenna reproduced a dirty-target collision where a pre-existing direct SELECT grant flowed through the profile role to `authenticated`:

```text
profile_role_collision_read=nonsecret_fixture
```

This does not re-open the old app-runtime conflation. It means target uniqueness and complete privilege reconciliation remain mandatory before grant.

### Server application runtime

Verdict: `CORRECTLY RESERVED; NOT OPERATIONAL`

`i1q_app_runtime` is safely deny-all and not browser-inherited. It cannot currently read or write I1Q data and no actor binder exists. Exact target grants, connection role, actor propagation, pool behavior, ownership, and compensation semantics remain open.

Before activation, authority must define:

- the login or connection role that may assume `i1q_app_runtime`;
- exact schema, table, view, and function allowlists;
- how the verified Supabase UUID becomes `auth.uid()` or an equivalent trusted transaction actor;
- how pooled connections clear actor state;
- whether direct table operations are permitted at all;
- the deny and rollback matrix;
- a new compensation path that also disables active app-runtime capability.

Current compensation is correct only because `i1q_app_runtime` has no grants and no assignee.

## Remaining Reproduced Defects

### `AV-ID-01` Opaque privileged API-key format is accepted

`REPRODUCED DEFECT`, severity `P0`

The key guard rejects a decodable service-role JWT but still accepts an opaque synthetic `sb_secret_*` pattern. It does not prove its no-privileged-key contract. An approved publishable or legacy anonymous allowlist is required.

### `AV-DB-01` Dirty-target profile-role privileges are not rejected

`REPRODUCED DEFECT`, severity `P0`

The clean role split passes. A pre-existing profile role with unrelated direct privileges also passes the migration guard and exports those privileges to `authenticated`. The workflow checks direct table grants only in schema `i1q`, so unrelated shared-project grants remain invisible.

### `AV-DB-02` Enabled safety-flag drift survives initial apply

`REPRODUCED DEFECT`, severity `P0`

The four new flags still use `ON CONFLICT DO NOTHING`. A pre-existing `public_access_enabled=true` survived local apply. The workflow detects an enabled flag only after the migration transaction commits. The migration audit can still assert all flags off incorrectly.

### `AV-DB-03` `anon` is used without a declared guard

`REPRODUCED DEFECT`, severity `P2`

The migration declares `authenticated` but unconditionally revokes from `anon`. A local target without `anon` failed with `role "anon" does not exist`. Supabase normally supplies the role, but the dependency contract remains inaccurate.

### `AV-BUILD-01` Health reports success while auth is absent

`REPRODUCED DEFECT`, severity `P0`

An unconfigured production-mode process returned HTTP 200 and `ok=true` while `/api/v1/session` returned 401. Liveness and readiness are not separated.

## Remaining Identity And Datastore Gaps

| Gap | Classification | Consequence |
| --- | --- | --- |
| No production composition root | `OPEN IMPLEMENTATION GAP` | Identity adapter, trusted origins, audit sink, and provider config are never injected. |
| No browser bearer bootstrap | `OPEN IMPLEMENTATION GAP` | The shipped UI sends no Authorization bearer and has no canonical login flow. |
| No durable identity audit sink | `OPEN IMPLEMENTATION GAP` | Failure events are not operationally durable. |
| WordPress trace ID comes from user metadata | `OPEN IMPLEMENTATION GAP` | It must remain non-authoritative or use a server-owned map. |
| No operational PostgreSQL platform adapter | `OPEN IMPLEMENTATION GAP` | The HTTP app remains synchronous and in-memory. |
| No actor binder for `i1q_app_runtime` | `AUTHORITY PLUS IMPLEMENTATION GAP` | Direct server transactions cannot establish trusted actor identity. |
| No checksum-bound schema version reconciliation | `OPEN IMPLEMENTATION GAP` | Same-version history drift can be silently accepted. |
| Compensation does not close drifted direct grants | `OPEN IMPLEMENTATION GAP` | Unexpected profile grants can survive emergency disable. |
| New safety flags are absent from app vocabulary | `OPEN IMPLEMENTATION GAP` | Application policy does not model the four 1008A flags. |

## Remaining Workflow Gaps

| Gap | Consequence |
| --- | --- |
| Approval hash is shape-checked but not recomputed from an approval record | A syntactically valid placeholder can impersonate evidence. |
| Preview database tests still skip in normal CI | Post-operation SQL is useful but does not run the full persona and attack suites. |
| Remote migration history is captured but not compared to an approved exact history | Unexpected drift is not an explicit pre-apply stop. |
| Migration file hashes are not bound into target authorization | The approved target and exact SQL candidate are not one attestation. |
| `reapply` can execute apply, compensation, and reapply in one push on a fresh target | A separately observed disabled state is not guaranteed. |
| Workflow deploys no application | It cannot produce authenticated staging. |
| Workflow is untracked and inactive remotely | It cannot run until reviewed and registered canonically. |

## External And Protected Blockers

- `MM-AUTH-ARCH-001` remains absent.
- Shared HQ expiry, configured-secret, CORS, and replay findings require protected owner repair.
- The preview target remains `UNASSIGNED` with no project, host, database, backup, restore, approval, or credentials.
- No protected `i1q-preview` GitHub environment exists.
- No I1Q staging provider, service, hostname, route, monitoring, or rollback selector exists.
- Hosted Supabase schema exposure, JWT propagation, RLS, and pool isolation are untested.
- Live Arena, STAT, Drills, and Daily source provenance remains unresolved.
- Dependent authenticated regression baselines do not exist.

## Current State

Highest defensible state: `LOCAL ENGINEERING CANDIDATE WITH VERIFIED REPAIRS AND OPEN BLOCKERS`.

Not achieved:

- authorized preview target;
- preview migration and hosted RLS certification;
- operational server runtime role;
- authenticated staging deployment;
- staging browser, security, accessibility, performance, monitoring, or rollback proof.

State C must not be claimed.
