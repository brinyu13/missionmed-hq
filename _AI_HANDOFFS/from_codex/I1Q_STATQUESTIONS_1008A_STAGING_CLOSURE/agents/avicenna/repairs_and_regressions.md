# I1Q-1008A Repairs And Regressions

## Verdict

`MAJOR LOCAL REPAIRS VERIFIED; EXTERNAL CERTIFICATION NOT RUN`

Avicenna edited no product, SQL, workflow, test, runtime, or protected file. This report evaluates repairs made concurrently by root.

## Verified Repairs

### 1. Identity trust boundary

Status: `RESOLVED LOCAL DEFECT`

The server now requires:

- an identity object;
- exact `i1q.identity.v1`;
- canonical actor equal to the authorized actor;
- Supabase actor equality when supplied;
- active, non-revoked state;
- valid session timing and supported transport.

Passing negative tests cover missing identity, wrong version, and wrong canonical actor.

### 2. Draft stale-write prevention

Status: `RESOLVED LOCAL DEFECT`

Draft saves require the exact client-observed hash in `If-Match`. Missing hash returns 422. A stale second writer returns 409. The first writer's update remains unchanged. Browser, server, platform, OpenAPI, and tests agree on the contract.

### 3. Identity profile and application runtime role split

Status: `RESOLVED LOCAL CONFLATION`

| Role | Browser inherited | Current grants | Current purpose |
| --- | --- | --- | --- |
| `i1q_identity_profile_reader` | Yes, through `authenticated` | `USAGE` on `i1q`; `EXECUTE` on `resolve_current_identity()` | Caller-scoped role profile only |
| `i1q_app_runtime` | No | None | Reserved for future server runtime |

Both roles are `NOLOGIN`, `NOINHERIT`, and `NOBYPASSRLS`. The disposable PostgreSQL test proves the separation across apply, compensation, and reapply.

This resolves the prior conflation. It does not authorize future app-runtime grants.

### 4. PostgreSQL NULLIF harness repair

Status: `RESOLVED LOCAL DEFECT`

Both `auth.uid()` harnesses use:

```sql
NULLIF(pg_catalog.current_setting('i1q_test.actor_id', true), '')::uuid
```

The latest disposable runtime test passes `1/1`.

### 5. Credential expiry propagation

Status: `RESOLVED LOCAL DEFECT`

`credential_expires_at` flows from the SQL profile to the adapter. Expired evidence cannot produce a verified credential context.

### 6. Workflow backup, post-state, and evidence gates

Status: `RESOLVED LOCAL DEFECT`

The workflow now:

- requires backup and restore identifiers before mutation;
- fails if a required schema fingerprint fails;
- verifies forced RLS, all flags off, and no direct I1Q table grants;
- verifies app runtime is not browser reachable and remains deny-all;
- verifies expected identity-profile membership after each operation;
- redacts and hashes evidence before upload;
- errors when evidence is absent.

These are local contract repairs. Actual provider backup and restore evidence remains external.

### 7. Static access and logout interfaces

Status: `RESOLVED LOCAL DEFECT`

Non-demo static assets now fail closed without an access adapter. Logout requires a canonical revocation adapter, and a passing regression proves the old synthetic bearer is denied afterward. Real provider composition and logout propagation remain untested.

## Current Test Baseline

| Test | Result |
| --- | --- |
| Full Node suite | `275 total`, `273 pass`, `0 fail`, `2 skipped` |
| Latest 1008A disposable PostgreSQL suite | `1 pass`, `0 fail`, `0 skip` |
| Base 1007X disposable PostgreSQL suite on UTF-8 | `13 pass`, `0 fail`, `0 skip` |

The two default skips are the PostgreSQL tests when explicit disposable URLs are absent. They were run separately during diagnostics.

## Role Model Residuals

### Clean-target result

Status: `PASS`

The clean target has exact narrow identity-profile grants and a deny-all app runtime. `authenticated` cannot inherit `i1q_app_runtime`.

### Dirty-target role collision

Status: `REPRODUCED DEFECT`, severity `P0`

The migration accepts pre-existing roles based on role attributes but does not prove their complete privilege graph. Avicenna pre-created `i1q_identity_profile_reader` with a direct synthetic table grant. After migration, `authenticated` inherited it:

```text
profile_role_collision_read=nonsecret_fixture
```

Required repair:

1. Require role-name uniqueness or reconcile all direct privileges, memberships, ownership, and grant options across the shared project.
2. Fail if either role has any privilege outside its exact approved allowlist.
3. Add dirty-target fixtures to the disposable test and preview preflight.
4. Re-run the same checks after compensation and reapply.

### Future app-runtime authority

Status: `OPEN AUTHORITY AND IMPLEMENTATION GAP`

`i1q_app_runtime` is intentionally unusable today. Before activation, define and prove exact grants, assumer, actor binder, connection-pool clearing, RLS behavior, audit identity, and compensation. Compensation currently toggles only identity-profile membership because app runtime has no capability. A future active app runtime requires a new disable path.

## Remaining Reproduced Defects

### `REG-01` Opaque privileged key accepted

Severity: `P0`

The identity verifier still accepts an opaque synthetic `sb_secret_*` pattern. Allowlist approved publishable or legacy anonymous formats and reject all unknown private formats.

### `REG-02` Safety-flag conflict remains enabled

Severity: `P0`

`ON CONFLICT DO NOTHING` preserves a pre-existing enabled flag. The workflow detects this only after commit. Initial SQL must force the invariant or fail before recording a false audit assertion.

### `REG-03` Undeclared `anon` role

Severity: `P2`

The migration still fails on a target that meets its declared dependencies but lacks `anon`.

### `REG-04` Health false positive

Severity: `P0`

Production-mode health returns 200 and `ok=true` when the identity adapter is absent and session requests fail. Add a readiness endpoint or make health fail closed for deployment promotion.

## Open Implementation Gaps

- production identity composition root;
- browser bearer bootstrap and refresh;
- durable audit sink;
- operational PostgreSQL adapter compatible with the HTTP platform;
- exact app-runtime actor binder and pool isolation;
- authoritative WordPress to Supabase trace mapping;
- all-flags-off conflict handling;
- checksum-bound migration history;
- compensation that closes drifted direct grants;
- application vocabulary for the four 1008A safety flags;
- preview execution of full PostgreSQL attack suites;
- approval-record hash verification;
- separate observed apply, compensation, and reapply stages;
- immutable application build and staging deployment;
- exact 1008A runtime provenance in health output.

## Regression Scope Not Run

- hosted Supabase JWT and PostgREST behavior;
- real custom-schema exposure;
- preview RLS persona attacks;
- pooled actor leakage;
- provider backup and restore;
- authenticated staging browser journeys;
- staging security, accessibility, responsive, and load tests;
- HQ, WordPress, Arena, STAT, Drills, Daily, and USCE regressions;
- application monitoring, canary, and rollback.

None may be reported as passing.
