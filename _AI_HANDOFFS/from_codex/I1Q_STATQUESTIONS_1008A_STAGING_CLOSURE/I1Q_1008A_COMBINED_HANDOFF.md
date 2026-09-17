============================================================
FILE: agents/avicenna/diagnostics_log.md
============================================================
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

============================================================
FILE: agents/avicenna/repairs_and_regressions.md
============================================================
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

============================================================
FILE: agents/avicenna/unresolved_external_failures.md
============================================================
# I1Q-1008A Unresolved External Failures

## Verdict

`LOCAL ROLE CONFLATION RESOLVED; EXTERNAL RUNTIME AUTHORITY AND STAGING RESOURCES REMAIN OPEN`

This file lists external or protected prerequisites. Local defects are separated at the end. No staging test, external migration, external database query, deployment, feature-flag change, or protected write occurred.

## 1. Global Identity Authority

Classification: `TRUE EXTERNAL BLOCKER`

`MM-AUTH-ARCH-001` remains absent. The authority maintainer must file it or explicitly record the scope of the mission-specific `i1q.identity.v1` substitute.

The record must settle actor identity, WordPress to Supabase mapping, issuer, audience, revocation, logout, replay, refresh, cross-service assertion, and route ownership.

## 2. Protected HQ Authentication Repairs

Classification: `PROTECTED DEPENDENCY BLOCKER`

HERSCHEL documented unresolved encrypted-session expiry, configured-secret fallback, credentialed hostile-origin CORS, and handoff replay findings. HQ and WordPress owners must repair and certify these through the Critical Systems process.

## 3. Preview Datastore Target

Classification: `TRUE EXTERNAL BLOCKER`

The target manifest is still `UNASSIGNED`. Missing:

- nonproduction project ref;
- database host and name;
- target owner;
- written approval record and verified hash;
- provider backup identity;
- tested restore reference;
- exposed `i1q` schema registration;
- migration-owner identity;
- operational auditor role;
- monitoring destination.

Production RANKLISTIQ and Growth Engine remain forbidden preview substitutes.

## 4. Exact Runtime Grant Authority

Classification: `TRUE EXTERNAL BLOCKER` plus `OPEN IMPLEMENTATION GAP`

The local role separation is resolved:

- `authenticated` receives only caller-scoped identity-profile lookup;
- `i1q_app_runtime` is separate, deny-all, and not browser inherited.

The datastore and security owners must now authorize the future server contract:

- exact role or connection identity allowed to assume `i1q_app_runtime`;
- exact schema, function, table, view, and sequence grants;
- prohibition or allowlist for direct table access;
- actor binder from verified Supabase UUID to transaction context;
- pooled-connection actor reset;
- audit actor behavior;
- role ownership and global privilege graph;
- emergency disable and reapply behavior.

Until this is filed and implemented, `i1q_app_runtime` must remain deny-all. Current compensation is sufficient only for the current deny-all state.

## 5. GitHub Preview Environment

Classification: `TRUE EXTERNAL BLOCKER`

The workflow remains an untracked local candidate. No protected `i1q-preview` environment or active I1Q workflow is registered.

Required owner action:

- review and merge the repaired workflow canonically;
- create a protected environment with reviewers and branch restrictions;
- provision only named preview credentials;
- bind dispatch to the exact reviewed commit and SQL hashes;
- verify the approval record, not only its shape.

No secret value belongs in Git, reports, logs, or artifacts.

## 6. Dedicated I1Q Staging Service

Classification: `TRUE EXTERNAL BLOCKER`

No provider, service ID, owner, build root, hostname, route, health URL, readiness URL, allowed-origin binding, source policy, log destination, monitor, or rollback selector exists.

The root Railway configuration deploys protected MissionMed HQ and cannot be reused.

## 7. Hosted Supabase And RLS Certification

Classification: `TRUE EXTERNAL BLOCKER`

Disposable PostgreSQL proves local SQL behavior. It does not prove:

- hosted JWT claim propagation;
- PostgREST role selection;
- custom-schema exposure;
- identity-profile RPC reachability;
- revoked-token behavior;
- cross-user isolation;
- app-runtime actor binding;
- pooled-session clearing;
- provider backup and restore.

Run the full authenticated persona and attack matrix only after the target and role authority are approved.

## 8. Protected Runtime Provenance

Classification: `PROTECTED DEPENDENCY BLOCKER`

Live Arena, STAT, Drills, and Daily bytes differ from tracked source, and no current live hash maps to a reachable same-named Git blob. Arena also differs from its approved manifest hash.

Protected product and deployment owners must register authoritative source, live hash, deployment event, rollback artifact, and drift disposition. I1Q must not touch these runtimes.

## 9. Dependent Product Baselines

Classification: `PROTECTED DEPENDENCY BLOCKER`

No owner-certified authenticated baseline exists for WordPress auth, HQ, Arena, STAT, Drills, Daily, USCE, compensation, or reapply. Consumer and student flags remain off.

## 10. Monitoring And Application Rollback

Classification: `TRUE EXTERNAL BLOCKER`

No I1Q monitor, alert owner, deployment marker, canary policy, immutable application rollback artifact, or provider rollback route exists. Database compensation alone is not application rollback.

## Not External: Repair Before Trigger

These are local engineering defects and should be closed before requesting preview apply:

- dirty-target privilege reconciliation for `i1q_identity_profile_reader`;
- opaque privileged-key acceptance;
- enabled safety-flag conflict preservation;
- undeclared `anon` role dependency;
- no identity composition root or browser bootstrap;
- no operational PostgreSQL application adapter;
- no actor binder for the reserved app runtime;
- health success while authentication is absent;
- preview CI skipping the full database attack suites;
- approval hash and exact remote history not verified;
- apply, compensation, and reapply stages can collapse into one push.

The identity contract-version defect, stale draft save, old role conflation, NULLIF harness issue, credential-expiry propagation, ignored schema-fingerprint failure, unauthenticated static shell, and missing logout adapter boundary are resolved locally and are not external blockers.

## Exit Conditions

External blockers clear only when:

1. Identity authority and protected auth repairs are filed and verified.
2. A named synthetic-only nonproduction Supabase target is approved.
3. Exact identity-profile and app-runtime privilege graphs are reconciled on that target.
4. The repaired workflow is active in a protected GitHub environment.
5. Preview apply, attack certification, compensation, disabled-state verification, reapply, and re-certification run as separate observable stages.
6. A dedicated I1Q service deploys an immutable artifact with fail-closed readiness.
7. Authenticated staging browser and API journeys pass.
8. Monitoring, rollback, and protected dependent regressions pass.

Until then, `AUTHENTICATED_STAGING_LIVE` and State C remain unachieved.

============================================================
FILE: agents/darwin/behavioral_parity_report.md
============================================================
# I1Q-1008A Darwin Behavioral Parity Report

## Verdict

`PASS_LOCAL_NO_REFACTOR`

Evidence class: `VERIFIED_LOCAL`

Darwin applied no product refactor. The final candidate-code fingerprint is:

`cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26`

Behavioral parity is preserved for Darwin's zero-change scope and the latest executable suite. Another authorized worker changed preview integration artifacts concurrently, so byte identity is not claimed for the full worktree timeline. Root regenerated the evidence estate afterward, and final validation passes 20 of 20 with zero errors and claimed state `BLOCKED`. This is not staging certification and not a production claim.

## Candidate Boundary

- Worktree: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A`
- Branch: `i1q-statquestions-1008a`
- HEAD: `81273add2c0fe350d330902d229683662896a1b1`
- Product code changed by Darwin: none
- Migration or workflow changed by Darwin: none
- Evidence estate changed by Darwin: none
- Protected system changed by Darwin: none

## Verification Matrix

| Check | Result | Evidence class |
| --- | --- | --- |
| Full Node suite | 277 total, 275 pass, 0 fail, 2 intentional database skips | `VERIFIED_LOCAL_THIS_LANE` |
| Evidence validator at lane start | 20 of 20 pass, zero errors, claimed state `BLOCKED` | `VERIFIED_LOCAL_THIS_LANE` |
| Evidence validator after root regeneration | 20 of 20 pass, zero errors, claimed state `BLOCKED` | `VERIFIED_LOCAL_THIS_LANE` |
| Base disposable PostgreSQL | 13 of 13 pass | `VERIFIED_LOCAL_PRIOR_INTEGRATED_EVIDENCE` |
| 1008A runtime PostgreSQL | 1 of 1 pass | `VERIFIED_LOCAL_PRIOR_INTEGRATED_EVIDENCE` |
| Darwin product write scope | Zero product files changed | `VERIFIED_LOCAL_THIS_LANE` |
| Final candidate-code fingerprint | `cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26` | `VERIFIED_LOCAL_THIS_LANE` |
| Preview query plans | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Authenticated staging browser | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Staging load and ingress behavior | Not run | `NOT_RUN_EXTERNAL_BLOCKER` |
| Production behavior | Not run | `PROHIBITED_NO_CLAIM` |

Darwin did not repeat the disposable PostgreSQL runs because they were already established on the integrated candidate and this lane made no executable change. The concurrent edits were limited to preview integration artifacts; the full Node suite was rerun after them and remained green.

## Verified Static Findings

### Pagination Completeness

Evidence class: `VERIFIED_LOCAL_STATIC`

The server bounds generic resource pages to 200 rows and returns `next_cursor`. The browser helper always requests a maximum of 200 and never consumes that cursor. Screens that join multiple collections can therefore become incomplete beyond the first page. This is both a scale concern and a behavioral completeness concern.

### Query And Index Shape

Evidence class: `VERIFIED_LOCAL_STATIC`, runtime impact `UNKNOWN`

The reviewer queue query is caller-bound and ordered, but it is unbounded. Its filter starts with `reviewer_actor_id` while the available queue index starts with `state`. The query must be measured in preview before an index or contract change is justified.

Release membership is correctly keyed by `release_id` and ordered by `position`; its primary and unique constraints support that access pattern. No issue is claimed for that query.

### Browser Request Fanout

Evidence class: `VERIFIED_LOCAL_STATIC`

Eighteen template functions were inspected. The maximum generic collection fanout for one render is five parallel requests. Source, transcript, editorial, physician, and release views perform client-side joins over those pages. Requests are parallel rather than serial, which avoids a simple waterfall, but repeated full-page reads increase with corpus size.

### Assets

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`

The interface uses three same-origin static files and no third-party font, image, framework, or runtime dependency. Total raw transfer is 139,559 bytes. Offline gzip level 9 is 30,711 bytes. The local server applies `no-store` to both API and static responses and does not compress or emit validators. Actual ingress behavior remains unknown.

### Maintainability And Duplication

Evidence class: `VERIFIED_LOCAL_STATIC_HEURISTIC`

The largest modules are the browser application, evidence validator, and platform service. A normalized seven-line scan reported 21 overlapping repeated windows across 18 files. Manual collapse identified four meaningful clusters, not 21 independent defects. No debug statements, TODO markers, external dependencies, or non-ASCII source text were found in the inspected source, public, and test paths.

## Reproducible Commands

Run from the application directory:

```bash
/usr/bin/time -lp node --test --test-reporter=dot tests/*.test.mjs
node --test --test-reporter=tap tests/*.test.mjs | tail -24
/usr/bin/time -lp npm run validate
```

Run from the worktree root:

```bash
{ find i1q-question-platform/src i1q-question-platform/public i1q-question-platform/tests i1q-question-platform/db -type f -print; printf '%s\n' i1q-question-platform/openapi.json .github/workflows/i1q-1008a-preview.yml; } | LC_ALL=C sort | while IFS= read -r f; do shasum -a 256 "$f"; done | shasum -a 256
rg -n 'listResource\(|next_cursor|cursor|limit' i1q-question-platform/public/app.js i1q-question-platform/src/server.mjs i1q-question-platform/src/store.mjs
rg -n -i 'reviewer_actor_id|review_assignments_queue|ORDER BY priority|LIMIT' i1q-question-platform/src/postgres-repository.mjs i1q-question-platform/db/migrations/*.sql
```

The loopback and repository benchmark method, samples, percentiles, and environment are recorded in `performance_before_after.json` so results are not confused with staging evidence.

## Blockers And Residual Risk

Evidence class: `EXTERNAL_BLOCKER`

- Preview datastore authority and connection are absent.
- Canonical authenticated runtime integration is not deployed.
- Staging URL, ingress, monitoring, and representative data are absent.
- The security verifier retains a veto for all I1Q-1008A release states.

The local executable candidate remains suitable for continued integration work. It is not certified for staging or production, and no performance SLO has been proven.

============================================================
FILE: agents/darwin/refactor_plan.md
============================================================
# I1Q-1008A Darwin Refactor Plan

## Scope And Verdict

- Ticket: `I1Q-1008A`
- Candidate HEAD: `81273add2c0fe350d330902d229683662896a1b1`
- Final local candidate-code fingerprint: `cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26`
- Evidence class: `VERIFIED_LOCAL_STATIC` and `VERIFIED_LOCAL_SYNTHETIC`
- Product changes applied by Darwin: none
- Staging or production performance claim: none

The candidate's executable tests are locally correct and it is intentionally blocked from staging. No refactor was applied because the highest-value changes depend on preview query plans, the canonical runtime adapter, or a security decision about caching. Refactoring those paths before their integration evidence exists would increase risk without proving a production benefit. A concurrent authorized update changed preview artifacts during this lane; root regenerated the evidence estate afterward, and final validation passes 20 of 20 with zero errors and claimed state `BLOCKED`. Darwin did not modify that evidence estate.

## Ranked Proposals

### P1: Make Collection Pagination Complete In The Browser

Evidence class: `VERIFIED_LOCAL_STATIC`

`public/app.js` requests a maximum of 200 records through `listResource()` and does not consume `next_cursor`. Several screens then join whole collections in the browser. The source screen requests four collections, while editorial, physician, and release screens each request five. A collection larger than 200 can therefore produce incomplete selection, joins, review queues, and release views even though the API reports another page.

Proposed default:

1. Preserve the existing generic cursor contract.
2. Add bounded, query-specific server reads for source detail, assigned review work, and release preparation.
3. Add explicit browser paging where a full queue is expected.
4. Test 199, 200, 201, and multi-page cases, including an exact target that appears after page one.
5. Keep source, answer, and assignment authorization at the server boundary.

Gate before implementation: canonical datastore adapter and RLS-backed integration tests must exist. Do not solve this by exposing unrestricted collections.

### P1: Certify And Bound The Reviewer Queue Query

Evidence class: `VERIFIED_LOCAL_STATIC`, production impact `UNKNOWN`

`PostgresTransaction.listMyReviewAssignments()` filters by `reviewer_actor_id` and `state`, orders by priority and time, and has no limit or cursor. The current index is led by `state, review_type, priority, due_at`, not `reviewer_actor_id`. This may scan and sort more rows as the reviewer population grows.

Proposed default:

1. Run `EXPLAIN (ANALYZE, BUFFERS)` against representative synthetic preview volumes.
2. Add cursor and limit arguments to the repository contract if the queue can exceed one page.
3. If the plan confirms the risk, evaluate an index beginning with `reviewer_actor_id, state`, followed by the stable order fields.
4. Preserve forced RLS and caller-bound identity in every plan test.

Gate before migration: preview database authority, representative synthetic data, query-plan evidence, rollback review, and the normal forward-only migration route.

### P2: Measure Static Asset Delivery At The Real Ingress

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`, staging impact `UNKNOWN`

The three static assets total 139,559 raw bytes. Offline gzip level 9 produces 30,711 bytes. The local Node server returns `Cache-Control: no-store`, no `Content-Encoding`, no `ETag`, and no `Last-Modified` header. This is conservative and correct for sensitive API responses, but it also prevents reuse of unchanged JavaScript and CSS.

Proposed default:

1. Measure actual compression and cache behavior through the authorized staging ingress.
2. Keep HTML and API data `no-store` until security approves any narrower rule.
3. Consider private revalidation for static JavaScript and CSS only after content fingerprinting or ETag support exists.
4. Do not add a bundler solely for size. The current dependency-free delivery is a useful safety property.

### P2: Remove Small Drift-Prone Duplications

Evidence class: `VERIFIED_LOCAL_STATIC`

The normalized seven-line window scan found overlapping repetitions that collapse into four useful refactor candidates:

- Supabase user and role-profile request setup repeats timeout, URL configuration, key checks, headers, redirect policy, and error translation.
- Generic `list()` and `get()` repeat protected-resource role checks.
- Editorial and medical review submission repeat the immutable revision identity envelope.
- Closed-world object checks and canonical JSON normalization have similar implementations in separate modules.

Proposed default:

Extract only the first three after focused parity tests. Keep evidence-validator canonicalization independent unless a formal shared hashing contract proves that coupling is desirable. Independent validation code can be intentional defense in depth.

### P3: Split Large Modules Only After Runtime Closure

Evidence class: `VERIFIED_LOCAL_STATIC`

The largest maintainability surfaces are `public/app.js` at 2,192 lines, `src/validate-evidence.mjs` at 2,108 lines, and `src/platform.mjs` at 1,555 lines. They are test-covered and currently dependency-free.

Proposed default:

- Split browser screens by workflow while preserving one shared state and API boundary.
- Split platform policy, review, and release services behind unchanged public methods.
- Leave the evidence validator intact during staging certification unless a verified defect requires a change.

This is maintainability work, not a release blocker.

### P3: Keep MemoryRepository Optimization Out Of Production Scope

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`

`MemoryRepository.list()` filters and sorts the full collection for every page. At 20,000 synthetic candidates, the local p95 was 1.132 ms for page one and 0.960 ms for a cursor near 80 percent. This is locally fast, but the algorithm remains `O(n log n)` and is suitable for tests and the synthetic demo, not evidence for a production datastore.

Proposed default: retain it as a simple deterministic fixture repository. Optimize only if authority later assigns it a persistent or high-volume role.

## Explicit Non-Proposals

- Do not redesign Architecture 1002.1.
- Do not weaken answer, source, identity, RLS, or sealed-pack boundaries for speed.
- Do not add dependencies or a frontend build chain during staging closure without a concrete requirement.
- Do not add an index from static inspection alone.
- Do not claim loopback latency as staging or production capacity.

## Reproducible Read-Only Commands

Run from `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform`:

```bash
node --test --test-reporter=tap tests/*.test.mjs | tail -24
npm run validate
find src public -type f -print0 | xargs -0 wc -lc
for f in public/*; do printf '%s raw=%s gzip9=%s\n' "$f" "$(wc -c < "$f")" "$(gzip -c -9 "$f" | wc -c)"; done
rg -n 'listResource\(|next_cursor|cursor|limit' public/app.js src/server.mjs src/store.mjs
rg -n -i 'reviewer_actor_id|review_assignments_queue|ORDER BY priority|LIMIT' src/postgres-repository.mjs db/migrations/*.sql
```

The exact measured values are recorded in `performance_before_after.json`.

============================================================
FILE: agents/darwin/refactors_completed.md
============================================================
# I1Q-1008A Darwin Refactors Completed

## Result

No product refactor was applied.

Evidence class: `VERIFIED_LOCAL_SCOPE`

Darwin was authorized to write only inside the Darwin handoff directory. Product code, migrations, workflows, evidence, protected systems, and other agent files were inspected read-only and left unchanged.

## Work Completed

- Reproduced the full local Node test result: 277 tests, 275 passed, 0 failed, 2 intentionally skipped database tests.
- Reproduced evidence validation at lane start: 20 of 20 files passed with claimed state `BLOCKED`.
- Rechecked after a concurrent candidate update and root evidence regeneration: executable tests still passed and evidence validation passed 20 of 20 with zero errors and claimed state `BLOCKED`.
- Measured local synthetic HTTP latency for health, dashboard, one resource page, and the static JavaScript asset.
- Measured in-memory candidate creation and pagination at 5,000 and 20,000 rows.
- Measured static asset raw and offline gzip sizes.
- Inspected generic browser pagination and request fanout.
- Inspected PostgreSQL repository queries and matching migration indexes.
- Ran a normalized seven-line duplication heuristic over 18 source and public files.
- Ranked safe future refactors and documented their evidence gates.

## Why No Refactor Was Applied

Evidence class: `VERIFIED_LOCAL_DECISION`

The candidate was already behaviorally green. The two highest-value findings require information that does not exist locally:

- reviewer queue changes require preview query plans and representative volume;
- static delivery changes require the real authenticated ingress and a security-approved cache policy.

The remaining proposals are maintainability improvements with lower release value than preserving the frozen, tested candidate. Applying them in this lane would have violated the assigned write scope.

## Before And After

- Final candidate-code fingerprint: `cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26`
- Darwin product delta: zero files, zero lines
- Concurrent worktree delta: preview target, preview workflow, and preview workflow test changed outside Darwin's scope while this lane was active
- Expected performance delta: zero
- Behavioral delta: none

The after benchmark is marked `NOT_RUN_NO_REFACTOR_APPLIED` rather than presenting a second run as an optimization result. Byte identity is claimed only for Darwin's write scope, not for the worktree timeline, because another authorized worker updated integration artifacts concurrently.

## Blockers

Evidence class: `EXTERNAL_BLOCKER`

- No authorized preview target is configured.
- No canonical staging identity adapter is running end to end.
- No staging URL or ingress exists for browser, cache, compression, or load measurement.
- No representative preview data exists for `EXPLAIN (ANALYZE, BUFFERS)`.
- The security verifier retains a release veto for States A through D.

These blockers prevent staging and production performance claims. They do not invalidate the local static analysis.

## Files Written By Darwin

Exactly four files were written in the assigned directory:

1. `refactor_plan.md`
2. `refactors_completed.md`
3. `performance_before_after.json`
4. `behavioral_parity_report.md`

============================================================
FILE: agents/herschel/datastore_authority_map.md
============================================================
# I1Q-1008A Datastore Authority Map

## Verdict

`TARGET PROJECT AND SCHEMA RESOLVED; RUNTIME CONTRACT CANDIDATE OBSERVED; PREVIEW ROUTE, OWNERSHIP, AND LIVE WIRING MISSING`

DR-006 and MR-078B route I1Q to an additive `i1q` schema in RANKLISTIQ. The 1007X base migration is well-formed and intentionally contains no runtime grants. During this discovery, a concurrent untracked 1008A migration and compensation candidate appeared that define `i1q_runtime`, `i1q.resolve_current_identity()`, four additional disabled flags, and a forward compensation. They are in-flight source, not registered authority or applied state. No canonical project-pinned migration directory, preview target, GitHub workflow, migration-history proof, named database owner, runtime connection, preview apply, rollback, or reapply exists.

This report is read-only discovery. No Supabase access, SQL execution, migration application, role change, production read, environment read, or datastore write occurred.

## Authority Stack

| Priority | Authority | Exact path | Datastore ruling |
| --- | --- | --- | --- |
| Mission-specific | DR-006 | `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md` | Additive `i1q` schema in RANKLISTIQ; preview or staging first; forward-only; forced RLS; deny by default; canonical GitHub route. |
| Data routing | MR-078B | `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md` | RANKLISTIQ owns STAT and question data. Root `supabase/migrations/` targets Growth Engine. |
| Migration process | MR-078A | `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md` | Fourteen-digit UTC names, strict history alignment, backup, diff review, transaction wrapping, no destructive history repair. |
| Execution safety | MR-079 | `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` | Project pin before commands; no history rewrite; no unsafe service-role or RLS behavior. |
| Shared system protection | Critical Systems Contract and Manifest | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`; `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` | Pin by project, schema, table, RPC, role, and RLS expectation. |

For I1Q, DR-006 and MR-079 are stricter than MR-078A's historical repair discussion. No migration-history repair or direct `schema_migrations` mutation is permitted.

## Project Map

| Provider project | Project ref | Named domains | I1Q authority |
| --- | --- | --- | --- |
| RANKLISTIQ, `missionmed-ranklistiq` | `fglyvdykwgbuivikqoah` | Arena, STAT, Supabase Auth, question data, telemetry, USCE `command_center.usce_*` | `AUTHORIZED TARGET`: additive `i1q` schema only. |
| Growth Engine | `plgndqcplokwiuimwhzh` | HQ CRM, media, and contract-listed drill registry data | `DO NOT TARGET`: root migration directory is assigned here and documented as history-desynchronized. |
| Scheduler Staging | `avpdetdkpwmqqxtvomix` | Scheduler staging | `OUT OF SCOPE`: no I1Q authority. |

The schema name `command_center` exists in more than one project. It cannot be used as a project selector.

## Current I1Q Candidate

| Property | Observed value |
| --- | --- |
| Migration | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql` |
| SHA-256 | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |
| Target declaration | RANKLISTIQ, additive `i1q` schema, offline candidate only |
| Tables | 52 |
| Dependencies | PostgreSQL 15 or later, `auth.uid()`, `pgcrypto`, future approved unprivileged runtime role |
| Transaction | Wrapped in `BEGIN` and `COMMIT` |
| RLS | Enabled and forced on all 52 tables |
| Public access | Revoked from `PUBLIC`; `anon` and `authenticated` revoked when present |
| Runtime grants | Intentionally absent |
| Actor | `i1q.current_actor_id()` returns `auth.uid()` UUID |
| Role authority | `i1q.actor_role_memberships`, keyed by `auth.uid()` |
| Feature flags | Six seeded false |
| Apply evidence | Disposable PostgreSQL passed 13 of 13 in 1007X; preview/staging/production apply count is zero |

The migration's own schema comment states that runtime grants are absent pending a canonical unprivileged adapter role and reviewed auth bridge. This is a deliberate safety boundary, not an incomplete test accident.

### Concurrent 1008A Runtime Candidates

These files appeared as untracked concurrent work after the initial HERSCHEL snapshot. HERSCHEL read them without executing or modifying them.

| Property | Observed in-flight value |
| --- | --- |
| Additive migration | `i1q-question-platform/db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql` |
| Migration SHA-256 at reconciliation | `413a921577c581334601321a58a6119621ca26294748cf07b3de1e5cc60df7c4` |
| Forward compensation | `i1q-question-platform/db/rollback/20260715193845_i1q_1008a_compensating_disable.sql` |
| Compensation SHA-256 at reconciliation | `ac7f5c9885259bf9aa5d2c112114d77af755e65f093407d4418c54ca93f09fe9` |
| Forward reapply | `i1q-question-platform/db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql` |
| Reapply SHA-256 at reconciliation | `e633dfcc2fcfbe9bb965f9507457231d4968952dbfcd80007420d969de01d88d` |
| Runtime role candidate | `i1q_runtime`, `NOLOGIN`, `NOBYPASSRLS`, no schema ownership, no table grants |
| Current grant candidate | Schema usage and execute on `i1q.resolve_current_identity()` to `i1q_runtime`; role membership granted to `authenticated` |
| Identity function | Reads only `auth.uid()`, app-owned memberships, and reviewer credential state; returns `i1q.identity.v1` |
| Additional flags | Transcript batch extraction, physician approval, public access, and automated release publication, all inserted false |
| Compensation behavior | Revokes `i1q_runtime` from `authenticated` and invokes the existing data-preserving disable function |
| Operational state | Migration, compensation, and reapply are untracked and unapplied; no canonical workflow, target-side role evidence, rollback run, or reapply run exists |

`REVIEW BLOCKER`: granting `i1q_runtime` membership to the shared `authenticated` role is narrow while that role has only schema usage and identity-function execution. Any later table, authoring, or answer-key privilege on `i1q_runtime` would become broadly inheritable by authenticated clients unless the ownership model explicitly prevents it. The candidate must not be treated as authorization for broader grants.

### Compensation Candidate

| Property | Observed value |
| --- | --- |
| File | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql` |
| SHA-256 | `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a` |
| Behavior | Disables all six I1Q flags while preserving data and history |
| Status | Designed and validated locally; never executed on an authorized preview or staging target |

## Current Application Wiring

`OBSERVED SOURCE`:

- `i1q-question-platform/src/postgres-repository.mjs` defines a transaction-scoped repository contract.
- It requires a dedicated client, begins a transaction, sets isolation, checks `i1q.current_actor_id()`, commits or rolls back, and releases the client.
- It does not establish a Supabase JWT claim, database actor context, connection provider, or runtime role.
- `i1q-question-platform/src/server.mjs` does not instantiate this repository.
- The local application still uses the in-memory platform unless supplied with another platform object.
- `i1q-question-platform/package.json` has no PostgreSQL driver dependency.

`OBSERVED IN-FLIGHT SOURCE`: the concurrent identity adapter validates a RANKLISTIQ bearer token and accepts a supplied database-backed role-profile resolver. The concurrent migration exposes a current-identity function under the candidate runtime role. No composition root connects either candidate to `PostgresRepository`, and no operational client, target, or database grants for application data operations exist.

Therefore a datastore contract exists, but no operational datastore adapter exists.

## MR-078A Compliance And Missing Pieces

| Requirement | Current state | Evidence or impact |
| --- | --- | --- |
| Correct 14-digit timestamp | `OBSERVED PASS` | `20260715122434` |
| Ticketed descriptor | `OBSERVED PASS` | `i1q_1007x_question_platform` |
| Required header and transaction | `OBSERVED PASS` | Migration header plus `BEGIN` and `COMMIT` |
| Forward-only additive design | `OBSERVED PASS` | Creates new schemas and objects; no production mutation occurred |
| Target project pin | `AUTHORITY PASS` | RANKLISTIQ `fglyvdykwgbuivikqoah` |
| Canonical migration directory | `MISSING` | App-local candidate is not registered as project migration history. |
| Project-pinned CLI configuration | `MISSING` | No `supabase/config.toml`, project ref file, branch binding, or equivalent tracked configuration. |
| Preview project or branch | `MISSING` | No authorized preview or staging database identity was found. |
| GitHub preview workflow | `MISSING` | Source branch contains no `.github/workflows/`; GitHub's active workflows contain no I1Q or MR-078A workflow. |
| Current migration history | `MISSING` | No Supabase access was performed and no authorized static history export exists. |
| Backup identity | `MISSING` | No preview baseline or backup record. |
| Migration owner role | `MISSING` | No exact role or owner registration. |
| Unprivileged runtime role | `IN-FLIGHT CANDIDATE` | Untracked 1008A SQL defines `i1q_runtime` and a narrow identity RPC grant; it is not registered or applied, and it has no application data privileges. |
| Read-only operational auditor | `MISSING` | No exact role or grants. |
| Schema owner | `MISSING` | No target-side ownership evidence. |
| Apply verification | `MISSING` | Zero preview, staging, or production applies. |
| Rollback and reapply | `MISSING` | Local compensation proof is not operational rollback proof. |

## Root Migration Directory Is Not An I1Q Route

Path: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/supabase/migrations/`

MR-078B assigns this directory to Growth Engine. It also contains historical STAT, duel, avatar, telemetry, and USCE migrations associated with RANKLISTIQ. The authority document records Growth Engine migration history as desynchronized. This collision makes the directory unsafe for I1Q by convenience.

`DO NOT TOUCH`: do not copy the I1Q migration into this directory, infer a project from existing SQL content, run `db push`, repair history, or use Growth Engine as a preview substitute.

## Required Database Roles

| Role | Required authority | Observed implementation | Missing evidence |
| --- | --- | --- | --- |
| Migration owner | Applies versioned migration; owns schema as approved | None registered | Role name, owner, login path, workflow binding, target-side privileges |
| I1Q runtime role | No ownership, no bypass RLS, only approved operations | In-flight `i1q_runtime` is `NOLOGIN` and `NOBYPASSRLS`; only identity-function execution is proposed | Authority ratification, target-side existence, inheritance review, data-operation grants, connection binding, claim propagation, pool tests |
| Operational auditor | Read-only, no answer key or raw source unless explicitly authorized | None | Role name, views/functions, deny tests |
| Review identities | Enforced by `auth.uid()`, memberships, assignments, and RLS | Schema functions and policies exist | Canonical JWT/actor propagation and real role fixtures |
| Browser role | No service role; no broad direct authoring access | Built-in `anon` and `authenticated` explicitly revoked from `i1q` | Exact browser/API boundary for staging |

The exact owner of the RANKLISTIQ migration route is not named in inspected authority. Brian owns the product and Root alone may apply the migration in this ticket, but a datastore owner or workflow owner still must register the target and roles.

## Identity And Database Contract Gap

The database resolves actors through `auth.uid()`. In Supabase, that requires trusted request JWT claims or an equivalent provider-supported context. The current repository only checks the resulting value. It does not establish it.

`MISSING AUTHORITY AND OPERATIONS`: the in-flight candidate proposes verified RANKLISTIQ bearer identity plus `auth.uid()`-grounded role lookup. No approved composition proves how a dedicated I1Q server binds that identity to every PostgreSQL transaction without caller spoofing, pooled-connection leakage, or broad inherited privileges.

The design must not solve this by:

- trusting an actor UUID or role array from client JSON or headers;
- setting caller-controlled GUC values;
- embedding a service-role token in the browser;
- granting broad access to `authenticated`;
- using email as the authorization key;
- connecting the in-memory app directly to production.

Root and Lorentz must align the identity resolver, runtime role, connection pool, `auth.uid()` semantics, RLS, and audit actor on one versioned contract.

## Provider, Project, And Workflow Pins

| Pin | Current result |
| --- | --- |
| Datastore provider | `RESOLVED`: Supabase/PostgreSQL |
| Production project | `RESOLVED`: RANKLISTIQ `fglyvdykwgbuivikqoah` |
| Schema | `RESOLVED`: additive `i1q` |
| Preview project or branch | `MISSING` |
| Migration source directory | `MISSING` as canonical project history; app-local candidate only |
| CLI project binding | `MISSING` |
| GitHub workflow | `MISSING` |
| GitHub environment | `MISSING` |
| Migration owner role | `MISSING` |
| Runtime role | `IN-FLIGHT CANDIDATE`; not registered, applied, or connected |
| Auditor role | `MISSING` |
| Backup destination and identity | `MISSING` |
| Monitoring destination | `MISSING` |

## Safe Integration Path

1. Root obtains a named RANKLISTIQ datastore owner and records the exact preview or staging target identity without exposing credentials.
2. Register a dedicated I1Q migration source path and project-pinned GitHub workflow. Do not reuse root Growth Engine history.
3. Review the in-flight `i1q_runtime` design, especially its membership grant to shared `authenticated`, then register separate migration-owner, unprivileged runtime, and operational-auditor roles with explicit ownership, grants, inheritance, and deny rules.
4. Freeze the exact migration and compensation hashes in the workflow and release evidence.
5. Before apply, capture migration history, schema inventory, role inventory, grants, ownership, backup identity, and drift.
6. Apply only to the authorized preview target. Prove 52 tables, indexes, constraints, forced RLS, policies, no broad grants, no answer/source access, audit immutability, and legal transitions.
7. Execute the complete identity and role matrix against the real target, including pool reuse, forged actor, revoked actor, unauthorized student, and direct table access.
8. Execute forward compensation, prove the exact prior behavior boundary, then reapply and rerun the full matrix.
9. Wire the dedicated I1Q service to the unprivileged role through the approved identity context. Remove the in-memory repository from non-demo staging.
10. Run Arena, STAT, USCE, auth, and shared RANKLISTIQ regressions before any staging verdict.

## Exact Blockers Returned To Root

| Blocker | Impact | Required owner action |
| --- | --- | --- |
| No MR-078A I1Q workflow | Migration cannot be applied canonically. | Datastore and deployment owners register a project-pinned preview workflow. |
| No preview target | No real RLS, rollback, or reapply proof. | Datastore owner registers an authorized preview or staging database. |
| Runtime role candidate is unregistered and has no data-operation grants | Application cannot access the schema; future broad grants could unintentionally reach all shared authenticated clients. | Datastore owner and Security review inheritance, register the role, and prove least privilege on preview. |
| No actor propagation contract | `auth.uid()` cannot be trusted from the dedicated service. | Identity and datastore owners bind one versioned contract. |
| No PostgreSQL application wiring | Current service remains in-memory. | Root implements after authority and role closure. |
| Root migration directory collision | Wrong-project or history damage risk. | Keep I1Q isolated; register its own path. |
| No operational rollback proof | State B cannot pass. | Execute compensation and reapply on the authorized target. |

## Protected No-Touch Boundary

HERSCHEL did not access Supabase, inspect credentials, run SQL, apply or create a migration, alter roles, modify migration history, change flags, or edit any datastore or application file.

============================================================
FILE: agents/herschel/dependent_consumer_matrix.md
============================================================
# I1Q-1008A Dependent Consumer Matrix

## Verdict

`DEPENDENCIES MAPPED; NO DEPENDENT PRODUCT CERTIFIED FOR I1Q`

No protected consumer was changed by HERSCHEL. Current route reachability or unchanged files do not count as regression certification. Shared identity, RANKLISTIQ, deployment, and runtime-source changes can affect multiple products, so every before, after, rollback, and reapply baseline must use the exact I1Q commit and reconciled consumer source.

## Consumer Matrix

| Consumer | Owner and authority | Shared dependency with I1Q | Current I1Q coupling | Impact of I1Q integration | Safe integration path | Current verdict |
| --- | --- | --- | --- | --- | --- | --- |
| MissionMed HQ | HQ/Auth owner; Critical Systems Contract and Manifest | Canonical WordPress session exchange, encrypted session, Supabase bootstrap, CORS, CSRF, logout | Required dependency; an untracked I1Q bearer-adapter candidate exists locally but is not an HQ route or deployed integration | Shared auth change can affect every HQ consumer | Narrow versioned I1Q assertion or introspection after expiry, configured-secret, CORS, replay, revocation, and outage repair | `BLOCKED FOR I1Q`; live health 200 but auth defects remain |
| WordPress auth relay | WordPress/HQ owner; MR-078B and DR-006 | Person identity, signed handoff, first-party proxy, cookies, final route | No I1Q route | Handoff or proxy change can affect Arena, STAT, Daily, USCE, and future I1Q | Reuse observed chain; add only an owner-approved audience/final route; do not widen roles | `ACTIVE SHARED DEPENDENCY`; I1Q route missing |
| RANKLISTIQ | Arena/STAT data owner not explicitly named; DR-006, MR-078B, Critical Manifest | Supabase Auth UUID, Arena, STAT, USCE, future `i1q` schema | Authorized target; no I1Q apply | Wrong project, grants, or role context could affect existing consumers | Isolated additive schema, project-pinned preview workflow, unprivileged role, forced RLS, rollback and reapply | `TARGET AUTHORIZED, ROUTE MISSING` |
| Arena | Arena owner; Critical Manifest and MR-078B | HQ auth, RANKLISTIQ, STAT and Daily/Drills routes | No I1Q consumer flag; future indirect consumer | Shared auth or RANKLISTIQ changes can break entry, profiles, avatars, routes, or games | Do not edit Arena; release only through downstream owner-certified adapter | `ACTIVE, SOURCE AUTHORITY UNRESOLVED` |
| STAT | STAT owner; STAT Canon, MR-078B, DR-006 | HQ auth, RANKLISTIQ, dataset projection, question metadata, sealed duels | `stat_adapter_enabled = false` | Dataset or auth changes can affect sealed packs, choice order, answer secrecy, old attempts, and telemetry | Publish a new immutable server-side dataset version with exact nine-field projection; preserve active v4 and server-only answer map | `FLAG OFF, NOT I1Q-CERTIFIED` |
| Drills | Drills/MMVS owner; DR-006 and current Drills contract | WordPress wrapper, MMVS registry, playback, nodes, optional transcript, Daily return | `drills_adapter_enabled = false` | Registry or source-contract changes can break playback and source availability | Read-only sidecar keyed by stable video ID; never alter ingestion | `FLAG OFF, OWNER CERTIFICATION MISSING` |
| Daily Rounds | Daily plus Drills/Arena integration; exact human owner not found | HQ auth, MMVS registry, RANKLISTIQ control, Drills launch | No active I1Q channel | Changes can break active filtering, selected-drill payload, launch, or return | Reuse Drills sidecar only after Daily owner approves its stricter five-field contract | `ACTIVE, NO I1Q CHANNEL` |
| USCE admin | USCE owner; Critical Systems Manifest | HQ auth relay, Railway, RANKLISTIQ `command_center.usce_*` | No I1Q feature coupling, but shared auth and project coupling | HQ auth or RANKLISTIQ role changes can break protected admin reads | Include relay, unauthenticated denial, authenticated read, CORS, RPC, and rollback tests | `PROTECTED DEPENDENCY, NOT TESTED HERE` |
| Matrix | Brian/Matrix owner; Matrix Runtime Lock | WordPress identity and shared Kinsta estate | No I1Q consumer | WordPress or global auth changes can affect dashboard entry and app-mode routes | No adapter in 1008A; run current guard and all locked journeys after shared change | `UNTOUCHED, NOT REGRESSION-TESTED` |
| Growth Engine | HQ/Growth owner; MR-078A and MR-078B | HQ CRM/media and contract-listed drill data | Not the I1Q target | Using its migration directory could damage desynchronized history or wrong data plane | Read-only existing APIs only; never route I1Q SQL here | `NO I1Q WRITES` |
| MMVS drill API | Drills/MMVS owner; DR-006 read-only authority | Current Drills and Daily source registry | Source metadata only; extraction is out of 1008A scope | Mutation or schema assumptions could break Drills and Daily | GET-only contract and no registry mutation | `READ-ONLY DEPENDENCY` |
| R2/CDN | Root plus product owners | Arena, STAT, Drills, Daily runtime delivery; future I1Q static assets if registered | No I1Q app route | Wrong deploy can overwrite runtime-only behavior | Reconcile four live hashes first; register any I1Q asset separately | `PROTECTED, SOURCE DRIFT OPEN` |
| Legacy v4 and attempt joins | STAT owner | Current question IDs, dataset versions, attempts, metadata | Read-only future compatibility | Rewriting or joining on question ID alone can corrupt history | Composite `dataset_version + question_id`; no v4 mutation | `IMMUTABLE, HISTORICAL JOIN PROOF MISSING` |
| TournaMed and future Arena modes | Respective future owners | Future release artifacts only | Contract-only, no active channel | Premature consumer activation could bypass review and release gates | Separate owner approval and manifest entry per channel | `NO ACTIVE I1Q COUPLING` |

## Shared Change Impact Matrix

| Proposed change class | Directly affected systems | Required owner and regression scope |
| --- | --- | --- |
| HQ session or auth route | HQ, WordPress, Arena, STAT, Daily, USCE, future I1Q | HQ/Auth owner; valid, expired, revoked, logout, CORS, CSRF, replay, outage, browser journeys |
| WordPress handoff or proxy | WordPress, HQ, Arena, STAT, Daily, USCE, Matrix entry, future I1Q | WordPress/HQ owner; host allowlists, cookies, redirect, proxy, login, logout, failure behavior |
| RANKLISTIQ project, role, grant, or auth change | Arena, STAT, USCE, Supabase Auth users, future I1Q | Datastore owner; migration history, role matrix, RLS, RPC signatures, auth bootstrap, consumer tests |
| Additive `i1q` migration only | I1Q plus shared project capacity and role namespace | Datastore owner and Root; object collision, grants, forced RLS, query plan, rollback, no shared-schema drift |
| Arena/STAT/Drills/Daily tracked source deploy | Corresponding runtime and linked routes | Product owner plus Root; reconcile current live bytes first |
| I1Q dedicated service only | I1Q, HQ auth adapter, RANKLISTIQ `i1q`, monitoring | I1Q, HQ/Auth, Datastore, Deployment owners; strongest isolation if no shared runtime mutation |
| Feature-flag activation | I1Q and selected consumer | Root plus consumer owner; exact release hash, security, rollback, monitoring, independent review |

## Current Protected Baselines

| System | Latest reliable evidence | What remains missing |
| --- | --- | --- |
| HQ | Live health HTTP 200; live hostile-origin credentialed CORS reflection reproduced | Authenticated session, expiry denial, restart, revocation, logout, safe CORS, source parity |
| WordPress | Existing handoff/proxy source and prior unauthenticated route reachability | Authenticated end-to-end I1Q route, replay, expiry, logout, staging route |
| Arena | Live CDN hash `7bb0ad1c...`; wrapper reachable in read-only probe; 1007X runtime markers passed | Authoritative source, authenticated journey, after/rollback tests |
| STAT | Live CDN hash `77303e63...`; 1007X runtime markers passed | Authoritative source, sealed-pack and answer secrecy regression, old attempt joins |
| Drills | Live CDN hash `c480c014...`; 1007X runtime markers passed | Authoritative source, registry, launch, playback, source availability, return journey |
| Daily | Live CDN hash `409a89d0...`; 1007X runtime markers passed | Authoritative source, five-field contract, launch and return journey |
| Matrix | Current lock manifest updated 2026-07-15 and owned by Brian | Guard preflight and app-mode browser journeys on the exact candidate |
| RANKLISTIQ | Canonical project pin known | Preview target, migration history, real I1Q objects, roles, RLS and rollback |
| USCE | Critical Manifest route and project pins | Shared-auth and datastore after-change smoke |

No protected product is marked `PASS` from these baselines.

## Minimum Dependent Regression Set

### MissionMed OS

- BOOT resolution and current mission routing;
- MissionMed OS clean and current state;
- DR-006 and product registration still indexed.

### WordPress And HQ

- valid login and handoff;
- invalid, expired, malformed, and replayed handoff;
- session expiry and revocation;
- fixed-origin CORS and hostile-origin denial;
- CSRF, fixation, bootstrap replay, and logout;
- HQ health and protected-route failure behavior;
- no token, cookie, secret, answer, or source content in logs.

### Arena

- authenticated entry;
- RANKLISTIQ project pin;
- profile and avatar hydration;
- routes to STAT, Drills, and Daily;
- no service-role or frontend sign-up path;
- browser console and network clean;
- rollback to preserved current runtime.

### STAT

- exact frozen nine-column dataset projection;
- exact seven-field pack authority resolution before consumer activation;
- choice order and content-hash parity;
- no answer or explanation before finalization;
- `answer_map` server-only and participant-gated;
- current v4 and historical attempt joins unchanged;
- composite question metadata behavior;
- Arena entry and rollback.

### Drills And Daily

- registry GET shape and stable IDs;
- playback and nodes requirements;
- explicit transcript and VTT availability;
- Daily's required five fields;
- selected-drill payload and query launch;
- Drills return to Daily and Arena;
- no source registry mutation;
- rollback to preserved current runtime.

### RANKLISTIQ And USCE

- project, schema, table, RPC, and role pins;
- migration history unchanged outside reviewed I1Q objects;
- auth bootstrap still provisions the same UUID identity;
- USCE admin relay and protected reads;
- no broad grant or RLS regression;
- rollback and reapply proof.

### Matrix

- Matrix runtime guard preflight on the exact worktree;
- dashboard, calendar, scheduler, file vault, messages, and StoryForge routes;
- required app-mode classes and Return to Matrix Dashboard;
- no duplicate auth or module mount;
- no stale runtime warning.

## Feature Flag Boundary

The current I1Q deployment manifest records all six flags false:

```text
internal_platform_enabled = false
internal_review_enabled = false
student_content_enabled = false
student_release_enabled = false
stat_adapter_enabled = false
drills_adapter_enabled = false
```

No consumer test may assume a flag is active. No consumer activation is part of HERSCHEL's authority.

## Owner Handoffs

| Owner | Required handoff before State C |
| --- | --- |
| Authority maintainer | Resolve missing `MM-AUTH-ARCH-001` status without inventing it. |
| HQ/Auth owner | Repair shared auth findings and review the in-flight versioned I1Q adapter behavior against shared authority. |
| Datastore owner | Register RANKLISTIQ preview, workflow, roles, backup, and rollback. |
| Deployment owner | Register dedicated I1Q provider, service, hosts, health, monitoring, and rollback. |
| Arena owner | Reconcile live source hash and run authenticated before/after tests. |
| STAT owner | Reconcile live source and contract collisions; certify sealed-pack and history invariants. |
| Drills owner | Reconcile runtime and ingestion ownership; certify sidecar contract. |
| Daily owner | Name the owner, reconcile source, and certify strict launch contract. |
| USCE owner | Run shared auth and RANKLISTIQ regression. |
| Matrix owner | Run lock guard and required app-mode journeys after any shared identity change. |

## Protected No-Touch Boundary

No consumer source, provider, route, datastore, migration, auth system, workflow, runtime object, feature flag, student data, or production configuration was modified or certified by this lane.

============================================================
FILE: agents/herschel/deployment_topology.md
============================================================
# I1Q-1008A Deployment Topology

## Verdict

`EXISTING SHARED TOPOLOGY OBSERVED; NO I1Q STAGING OR PRODUCTION ROUTE REGISTERED`

MissionMed currently has protected WordPress, Railway, Supabase, R2/CDN, and Matrix deployment surfaces. None is registered as an I1Q service route. The repository's root Railway definition starts MissionMed HQ, not I1Q. The HTML deploy route promotes Arena, STAT, Drills, and Daily assets only. No I1Q GitHub workflow, service, host, health URL, environment, monitoring target, or rollback selector exists.

## Current Provider Topology

```text
GitHub repository: brinyu13/missionmed-hq
  |
  +-> Railway production service: MissionMed HQ
  |     start: node missionmed-hq/server.mjs
  |     health: https://missionmed-hq-production.up.railway.app/health
  |     auth: /api/auth/*
  |
  +-> WordPress/Kinsta first-party site
  |     wrappers: /arena, /stat, /drills, /daily, Matrix routes
  |     auth proxy: /api/auth/* -> Railway HQ
  |
  +-> Cloudflare R2/CDN protected HTML
  |     html-system/STAGING/{arena,stat,drills,daily}.html
  |     html-system/LIVE/{arena,stat,drills,daily}.html
  |
  +-> Supabase RANKLISTIQ
        auth and data plane for Arena, STAT, USCE, future i1q schema

I1Q local source: i1q-question-platform/
  -> no registered provider
  -> no staging host
  -> no production host
  -> untracked identity-adapter candidate, no startup/provider wiring
  -> no database connection
```

## Existing Runtime Owners

| Surface | Provider | Runtime source or artifact | Control evidence | I1Q use |
| --- | --- | --- | --- | --- |
| MissionMed HQ | Railway | `missionmed-hq/server.mjs` | `railway.json`; Critical Systems Manifest | Protected dependency only. Root deploy config cannot launch I1Q. |
| WordPress auth and wrappers | WordPress/Kinsta | `wp-content/mu-plugins/*.php` and Matrix plugin assets | Critical Systems Contract; Matrix Runtime Lock | Protected dependency. No I1Q wrapper registered. |
| Arena, STAT, Drills, Daily | Cloudflare R2/CDN | `html-system/STAGING/*` and `html-system/LIVE/*` | `_SYSTEM/DEPLOY_MANIFEST.json`; `_SYSTEM/deploy.sh` | Existing consumers only. Not an I1Q app route. |
| RANKLISTIQ | Supabase | Project `fglyvdykwgbuivikqoah` | MR-078B; DR-006; Critical Manifest | Authorized future `i1q` target, not applied. |
| I1Q local app | Local Node | `i1q-question-platform/src/server.mjs`; untracked `src/identity-adapter.mjs` | Local package and concurrent in-flight source only | Synthetic localhost candidate; no application composition root, provider binding, or authority ratification. |

The live HQ health URL returned HTTP 200 on 2026-07-15. This proves reachability only. It does not prove a safe I1Q auth contract or source parity.

## HQ Railway Route

Tracked deployment definition:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/railway.json`

```text
builder: NIXPACKS
start command: node missionmed-hq/server.mjs
restart policy: ON_FAILURE, maximum 10 retries
```

The Critical Systems Manifest pins:

- runtime owner `railway_missionmed_hq`;
- environment `production`;
- known-good Git commit `3f0c27aac55dbf82748b3eaba360006d4041b539`;
- known-good Railway deployment `27280193-c85b-49de-8b03-58e28ba0c9f3`.

Current tracked `missionmed-hq/server.mjs` SHA-256 is `870e6065fe8f19849d1dfc6484478d66b2ac6d74ee9e1db4fcda9be89b3a2db8`, and the source differs from the known-good commit. Current production source parity was not established by this lane.

`MISSING`: exact Railway project ID, service ID, source branch, automatic deployment trigger, environment binding, build ID, current deployment commit, and rollback selector are not represented in inspected repository files.

`PROTECTED`: deploying the repository root as I1Q would start or redeploy MissionMed HQ. It is not a safe I1Q path.

## WordPress Route Topology

| First-party path | Source | Upstream |
| --- | --- | --- |
| `/api/auth/*` | `wp-content/mu-plugins/missionmed-hq-proxy.php` | Hardcoded production HQ Railway origin |
| WordPress handoff | `wp-content/mu-plugins/missionmed-hq-auth-handoff.php` | HQ `/api/auth/session` |
| `/arena` | `wp-content/mu-plugins/arena-route-proxy.php` | CDN Arena runtime |
| `/stat` | `wp-content/mu-plugins/stat-route-proxy.php` | CDN STAT runtime |
| `/drills`, `/daily` | `wp-content/mu-plugins/drills-route-proxy.php` | CDN Drills or Daily runtime |
| Matrix routes | Matrix plugin and locked assets | Kinsta production runtime |

No `question-platform`, `i1q`, or I1Q route was found in the WordPress proxy sources, MissionMed HQ routes, LIVE assets, Deploy Manifest, or Critical Systems Manifest.

The current handoff allowlist permits the production HQ Railway host as a return host and WordPress hosts as final targets. It does not permit an independent I1Q staging host.

## R2/CDN HTML Promotion

Files:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/_SYSTEM/DEPLOY_MANIFEST.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/_SYSTEM/deploy.sh`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/VALIDATION/validate_deploy.sh`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/VALIDATION/validate_runtime.sh`

Observed sequence:

```text
tracked LIVE source
  -> local validation
  -> clean deploy-scope check
  -> HEAD equals upstream Git ref
  -> local rollback snapshot
  -> authenticated R2 upload to STAGING
  -> STAGING runtime validation
  -> R2 server-side copy to LIVE
  -> cache purge or cache-busted fallback
  -> LIVE runtime validation and wrapper probes
```

The manifest contains only Arena, STAT, Drills, and Daily mappings. This is a local protected deploy script with a Git synchronization gate. It is not an I1Q GitHub Actions workflow, and it must not be extended or executed by this ticket lane.

## GitHub Workflow Inventory

Source branch `i1q-statquestions-1008a` contains no `.github/workflows/` directory. The source remote branch `origin/i1q-question-platform-ultra-1007x-ma` also contains none.

A read-only GitHub API query on 2026-07-15 reported these active repository workflows:

| Workflow | Path | I1Q relevance |
| --- | --- | --- |
| D9 Matrix source validation | `.github/workflows/d9-matrix-source-validation.yml` | Matrix only |
| V1 Study Schedule 8010C integration seam | `.github/workflows/v1-study-schedule-8010c.yml` | Scheduler only |
| V1 Study Schedule 8010D persistence kernel | `.github/workflows/v1-study-schedule-8010d.yml` | Scheduler only |
| V1 Study Schedule 8010E Week contract | `.github/workflows/v1-study-schedule-8010e.yml` | Scheduler only |
| V1 Study Schedule containment | `.github/workflows/v1-study-schedule-containment.yml` | Scheduler only |
| Dependabot Updates | Dynamic GitHub workflow | Dependency automation only |

`MISSING`: no I1Q, Question Platform, MR-078A, RANKLISTIQ preview, I1Q staging, I1Q rollback, or I1Q monitoring workflow is active.

## I1Q Deployment Registration Gaps

| Required pin | Current state |
| --- | --- |
| Provider | `MISSING`; do not assume Railway merely because HQ uses it. |
| Service or project ID | `MISSING` |
| Build root | `MISSING`; expected candidate is `i1q-question-platform/`, not repository root. |
| Start command | Local package has `node src/server.mjs`; no provider registration. |
| Source branch and commit policy | `MISSING` |
| Staging hostname | `MISSING` |
| Staging health URL | `MISSING` |
| Production hostname | `MISSING` and not authorized by this ticket |
| WordPress wrapper or direct-host decision | `MISSING` |
| Auth issuer, audience, and callback | `MISSING` |
| Allowed origins | `MISSING`; current HQ runtime reflects hostile origins. |
| RANKLISTIQ preview binding | `MISSING` |
| Unprivileged database role | `MISSING` |
| Secret-store binding | `MISSING`; values were not inspected. |
| Monitoring destination | `MISSING` |
| Rollback artifact selector | `MISSING` |
| Critical Systems Manifest entry | `MISSING` |
| Deployment Manifest entry | `MISSING` |

The I1Q evidence manifest truthfully reports `BLOCKED_NOT_DEPLOYED`, no deployment URLs, no canonical route, and all six flags false.

## Safe Integration Topology

The following is a proposed sequence, not a provider decision:

```text
Reviewed I1Q commit
  -> dedicated GitHub CI for the exact commit and build root
  -> project-pinned RANKLISTIQ preview migration job
  -> real RLS, compensation, and reapply proof
  -> dedicated authenticated I1Q staging service
  -> canonical narrow HQ identity assertion or introspection
  -> I1Q-owned role lookup and unprivileged RANKLISTIQ connection
  -> authenticated staging tests and dependent consumer tests
  -> registered monitoring and rollback
```

`PROPOSED SAFE PATH` rules:

1. Deployment owner selects and records a dedicated provider, service, build root, source branch, environment, hostname, health route, and rollback selector.
2. Do not reuse root `railway.json`, overload HQ, mount I1Q into protected HQ by convenience, or use the HTML CDN as an application server.
3. Register the I1Q route in the Critical Systems Manifest with owner, runtime owner, source of truth, route checks, auth audience, datastore pin, browser journey, monitoring, and rollback.
4. Root chooses either a first-party WordPress wrapper or a separately allowlisted authenticated host. Both require explicit handoff, CORS, cookie, CSRF, and final-target evidence.
5. Register a dedicated GitHub workflow that checks out the exact SHA, validates it, applies only the project-pinned preview migration, deploys the same artifact, and records build and rollback identities.
6. Keep internal platform, internal review, student, STAT, Drills, and publication flags false during infrastructure certification.
7. Only Root may trigger preview migration, deployment, rollback, or reapplication.

## Ownership And Blockers

| Boundary | Current owner | Required action |
| --- | --- | --- |
| I1Q product and release | Brian; Root executes | Approve exact service and route registration. |
| HQ Railway | HQ/Auth owner under Critical Systems | Repair auth defects and provide narrow adapter behavior. |
| WordPress/Kinsta | WordPress/HQ owner | Register final route and handoff behavior if selected. |
| RANKLISTIQ | Datastore owner not named; Root has ticket execution authority | Register preview target, roles, and workflow. |
| I1Q deployment provider | `MISSING OWNER BINDING` | Name provider owner and service binding. |
| R2/CDN consumers | Root plus Arena, STAT, Drills, and Daily owners | Reconcile source drift before any consumer integration. |
| Matrix | Brian and Matrix Runtime Lock | No I1Q route change without separate Matrix authority. |

## Protected No-Touch Boundary

No workflow, provider, deployment, route, manifest, cache, R2/CDN object, Railway service, WordPress file, database, feature flag, or protected runtime was changed or triggered.

============================================================
FILE: agents/herschel/identity_authority_map.md
============================================================
# I1Q-1008A Identity Authority Map

## Verdict

`MAPPED, BUT CANONICAL I1Q IDENTITY RESOLUTION IS NOT YET COMPLETE`

The observed MissionMed identity chain is WordPress identity -> signed WordPress handoff -> MissionMed HQ session on Railway -> RANKLISTIQ Supabase Auth bootstrap. DR-006 authorizes a dedicated additive I1Q adapter that reuses this chain. A concurrent, untracked `i1q.identity.v1` implementation candidate and synthetic fixture set appeared during this discovery, but no application startup wires it, no authority record ratifies it, and no authenticated I1Q staging identity has been exercised. The authority document named `MM-AUTH-ARCH-001` is missing.

This report is read-only discovery. No secret or environment value, student record, raw transcript, production database, protected source, feature flag, or runtime configuration was changed.

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `AUTHORITY` | A current canonical record establishes the rule. |
| `OBSERVED SOURCE` | Current tracked source directly establishes the behavior. |
| `OBSERVED IN-FLIGHT SOURCE` | Concurrent untracked or modified worktree source exists, but is not committed, ratified, deployed, or runtime authority. |
| `OBSERVED RUNTIME` | A read-only request directly established current runtime behavior. |
| `MISSING` | Required evidence or implementation was searched for and not found. |
| `PROPOSED SAFE PATH` | Recommendation only, not current authority. |
| `PROTECTED` | Root and the named system owner must control any change. |

Discovery snapshot: 2026-07-15. Source HEAD: `81273add2c0fe350d330902d229683662896a1b1`.

Working-tree reconciliation: concurrent changes were read after the initial snapshot. They were not made, modified, staged, or certified by HERSCHEL.

## Authority Chain

| Layer | State | Authority or evidence | Ruling |
| --- | --- | --- | --- |
| I1Q mission authority | `AUTHORITY` | `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md` | Dedicated authenticated internal app; reuse canonical MissionMed auth and session; no parallel identity system. |
| Product boundary | `AUTHORITY` | `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md` | WordPress, HQ, Railway, RANKLISTIQ, Matrix, Arena, STAT, and Drills are protected dependencies. |
| Identity source of truth | `AUTHORITY` | `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`, MR-078B | WordPress owns identity fields; Railway owns HQ session state; Supabase Auth owns Arena and STAT authentication state. |
| Runtime owner | `AUTHORITY` and `OBSERVED SOURCE` | Critical Systems Contract and Manifest; `railway.json` | Railway starts `node missionmed-hq/server.mjs`. `app/api/**` is not current production authority. |
| Global auth architecture | `MISSING` | MR-078B and MR-079 both cite `08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md` | No file named `MM-AUTH-ARCH-001.md` exists under `/Users/brianb/MissionMed`. Runtime behavior does not fill this authority gap. |
| I1Q role authority | `AUTHORITY` | DR-006 plus the I1Q schema boundary | I1Q roles and assignments are app-owned. WordPress roles must not be treated as I1Q roles. |
| Medical authority | `AUTHORITY` | DR-006 | Medical governance is unassigned. A physician placeholder cannot approve medical content. |
| I1Q adapter candidate | `OBSERVED IN-FLIGHT SOURCE` | `i1q-question-platform/src/identity-adapter.mjs`, `tests/identity-adapter.test.mjs`, `fixtures/auth/i1q_authenticated_test_identities.json`, plus concurrent edits to `src/auth.mjs` and `src/server.mjs` | Defines a candidate contract and synthetic tests only. It is not wired by an application composition root or deployment route and is not authority. |

## Missing MM-AUTH-ARCH-001

`MISSING AUTHORITY: MM-AUTH-ARCH-001`

MR-078B names the expected path as:

`08_AI_SYSTEM/MissionMed_AI_Brain/MM-AUTH-ARCH-001.md`

MR-079 also depends on it. A filename search under `/Users/brianb/MissionMed` returned no match. This missing document means the following cannot be claimed as globally canonical from inspected authority:

- cross-service session assertion format and version;
- issuer and audience rules for a dedicated I1Q service;
- stable canonical actor identifier semantics;
- revocation and logout propagation semantics;
- server-to-server introspection rules;
- token rotation and session-secret ownership;
- the authoritative mapping between WordPress ID and Supabase UUID;
- whether a new app may consume the HQ cookie directly or only a narrow assertion.

DR-006 still permits a dedicated mission-specific I1Q adapter that follows the observed chain and does not weaken shared auth. That mission-specific permission is not a substitute for the missing global architecture record.

## Observed Runtime Chain

```text
Browser
  -> WordPress authenticated account
  -> wp-admin/admin-post.php?action=mmac_hq_auth_redirect
  -> 60-second HMAC-signed handoff
  -> MissionMed HQ /api/auth/session on Railway
  -> encrypted HQ cookie and bearer session
  -> /api/auth/bootstrap
  -> RANKLISTIQ Supabase Auth session
  -> auth.uid() for RANKLISTIQ RLS
```

### WordPress Handoff

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/wp-content/mu-plugins/missionmed-hq-auth-handoff.php`

`OBSERVED SOURCE` fields in the signed handoff:

| Field | Type or meaning |
| --- | --- |
| `wp_user_id` | Integer WordPress user ID |
| `email` | WordPress email |
| `username` | WordPress login |
| `display_name` | WordPress display name |
| `roles` | WordPress role strings |
| `iat` | Issued-at Unix seconds |
| `exp` | Expiry, 60 seconds after issue |
| `nonce` | Generated UUID string |

The handoff signs a base64url payload with HMAC SHA-256. Allowed return hosts are the production HQ Railway host and WordPress host. Allowed final hosts are WordPress hosts only. A dedicated I1Q staging hostname is not currently allowlisted.

### WordPress First-Party Proxy

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/wp-content/mu-plugins/missionmed-hq-proxy.php`

`OBSERVED SOURCE`: WordPress intercepts `/api/auth/*`, forwards method, body, cookies, and non-hop-by-hop headers to `https://missionmed-hq-production.up.railway.app`, then relays status, response headers, `Set-Cookie`, and response body. There is no I1Q-specific route or staging target.

### MissionMed HQ Identity And Session

Source: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/missionmed-hq/server.mjs`

| Route | Observed purpose | I1Q status |
| --- | --- | --- |
| `GET /api/auth/start` | Builds WordPress handoff redirect | Existing shared route; no I1Q final route registered. |
| `GET /api/auth/session` | Exchanges a handoff or reads current encrypted session; may bootstrap Supabase | Protected; current expiry handling is unsafe. |
| `POST /api/auth/validate-wp` | Resolves WordPress cookie or assertion and returns canonical identity fields | Protected; not registered for I1Q use. |
| `POST /api/auth/exchange` | Creates encrypted HQ session and cookie | Existing shared consumer route. |
| `POST /api/auth/bootstrap` | Ensures or resolves Supabase Auth user and returns Supabase session tokens | Existing Arena and STAT route; not an I1Q resolver. |
| `POST /api/auth/logout` | Checks CSRF for an existing session and clears cookie | Shared route; no I1Q journey executed. |

`toCanonicalIdentity()` currently returns `sub = wp:<wordpress_user_id>`, `wp_user_id`, email, WordPress roles, source, and issued time. It does not include the Supabase UUID.

The HQ session stores the WordPress integer as `session.user.id`. After successful Supabase bootstrap it also stores `session.supabaseUserId`. The response field `dbocUserId` falls back from `supabaseUserId` to the WordPress integer, so its type and identity domain are not stable before bootstrap.

### Supabase UUID Mapping

`OBSERVED SOURCE` behavior:

1. HQ derives a bootstrap credential from WordPress ID and email.
2. HQ looks up or creates a Supabase Auth user by email through an admin API.
3. HQ writes `wp_user_id` and `subject = wp:<id>` into Supabase user metadata.
4. HQ signs in the user and stores the returned Supabase `user.id` UUID in the HQ session.
5. RANKLISTIQ user tables use `auth.uid()` UUIDs.

The tracked legacy RPC `public.resolve_supabase_user_uuid(text, text)` in `supabase/migrations/20260422123000_avatar_locker_identity_stat.sql` searches `auth.users` metadata by WordPress ID, then falls back to email. It is granted to `anon` and `authenticated`. Because I1Q explicitly forbids email-only authorization and requires a versioned trusted resolver, this RPC is evidence of an existing mapping helper, not canonical I1Q identity authority.

`player_profiles.player_id`, avatar ownership, and duel ownership are keyed to the Supabase Auth UUID through `auth.uid()`.

## I1Q Actor And Role Boundary

Current I1Q role vocabulary:

```text
platform_admin
content_operator
author
editorial_reviewer
physician_reviewer
release_manager
privacy_officer
incident_owner
read_only
system
```

The final 1007X migration candidate stores `actor_role_memberships.actor_id` as UUID and defines `i1q.current_actor_id()` as `auth.uid()`. Therefore the current datastore candidate treats the Supabase Auth UUID as the database actor identity.

The I1Q HTTP server accepts a resolver-supplied `actor.id` string and roles and remains fail-closed in non-demo mode when no resolver is injected. The concurrent untracked `identity-adapter.mjs` candidate defines `i1q.identity.v1`, pins issuer configuration to RANKLISTIQ, requires audience `authenticated`, verifies the bearer against `/auth/v1/user`, uses the verified Supabase UUID for `actor.id` and `canonical_actor_id`, and obtains I1Q roles from a supplied role-profile resolver. Concurrent `auth.mjs` and `server.mjs` edits normalize and expose this shape. No tracked startup or provider composition injects the adapter, supplies the role-profile resolver or audit sink, or deploys it. The candidate therefore reduces implementation uncertainty but does not resolve authority or operations.

`MISSING`: no authoritative contract currently decides whether `canonical_actor_id` is identical to the Supabase UUID or is a separate identifier with an explicit mapping. The observed SQL strongly favors UUID identity, while 1007X prose also discussed `wp:<id>` as a stable actor label. Root and Lorentz must resolve this explicitly.

`PROPOSED SAFE DEFAULT FOR ROOT DECISION`: use the verified Supabase Auth UUID as `canonical_actor_id` for I1Q authorization and RLS, retain `wordpress_user_id` and `wp:<id>` only as source identifiers, and reject any email-only or caller-provided mapping. This is a proposal, not current authority.

I1Q roles must come from active `i1q.actor_role_memberships`, governance slots, and exact review assignments. They must not come from WordPress role strings, display names, email domains, request headers, or client JSON.

## Runtime Security Findings

| ID | State | Finding | Impact | Owner |
| --- | --- | --- | --- | --- |
| `ID-AUTH-01` | `OBSERVED SOURCE` | `readEncryptedSession()` logs a warning for missing, invalid, or expired `expiresAt` and still returns the payload. | Expired or malformed encrypted sessions can remain accepted. | HQ/Auth owner and Root |
| `ID-AUTH-02` | `OBSERVED SOURCE` | `SESSION_SECRET` always falls back to random bytes, while startup and exchange checks test the fallback rather than `CONFIGURED_SESSION_SECRET`. | Missing configuration can appear healthy and sessions rotate across restarts. | HQ/Auth owner and Root |
| `ID-AUTH-03` | `OBSERVED SOURCE` and `OBSERVED RUNTIME` | `buildCorsHeaders()` reflects the request Origin when no fixed origin is configured and allows credentials. A read-only request on 2026-07-15 with `Origin: https://herschel-invalid.example` received that same `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`. | Current production auth permits credentialed CORS reflection for an arbitrary origin. This blocks I1Q staging reliance on shared HQ auth. | HQ/Auth owner and Security |
| `ID-AUTH-04` | `OBSERVED SOURCE` | WordPress issues a nonce but no nonce-consumption store is visible in the HQ parser. | One-time replay protection is unproven. | WordPress/HQ Auth owner |
| `ID-AUTH-05` | `OBSERVED IN-FLIGHT SOURCE` and `MISSING` | An untracked candidate now supplies issuer, audience, contract version, bearer verification, app-role callback, failure codes, and synthetic personas. It has no ratification, committed source identity, application wiring, operational role-profile implementation, durable audit sink, staging identity, or deployment evidence. | The candidate is reviewable, but State A identity authority still cannot pass. | Root and Lorentz |
| `ID-AUTH-06` | `MISSING` | Critical Systems Manifest omits `/api/auth/validate-wp`, `/api/auth/logout`, the WordPress handoff/proxy files, and every I1Q route. | Protected auth coverage and rollback are incomplete. | Root and Critical Systems owner |
| `ID-AUTH-07` | `OBSERVED SOURCE` | WordPress handoff final targets are restricted to WordPress hosts. | A dedicated direct staging host cannot currently complete the observed handoff. | WordPress/HQ owner and Deployment owner |

The live HQ health route returned HTTP 200 on 2026-07-15. Health reachability does not clear the auth findings above.

## Resolved Versus Missing Authority

| Question | Result |
| --- | --- |
| Who owns canonical person identity? | `RESOLVED`: WordPress. |
| Who owns current shared session runtime? | `RESOLVED`: MissionMed HQ on Railway. |
| Which Supabase project owns Arena and STAT identity? | `RESOLVED`: RANKLISTIQ `fglyvdykwgbuivikqoah`. |
| May I1Q create a parallel login or identity store? | `RESOLVED`: no. |
| May I1Q own app roles and assignments? | `RESOLVED`: yes, additively in `i1q`. |
| Is physician authority inferable from WordPress role or title? | `RESOLVED`: no. |
| What is the global canonical auth architecture? | `MISSING`: `MM-AUTH-ARCH-001` is absent. |
| What exact assertion or introspection contract may I1Q consume? | `MISSING AUTHORITY`; an in-flight bearer-contract candidate exists. |
| What is the canonical actor ID type? | `MISSING`; observed SQL uses Supabase UUID. |
| Is shared HQ auth safe for staging today? | `NO`: expiry, configured-secret, CORS, and replay proof remain unresolved. |
| Are authenticated role fixtures available? | `IN-FLIGHT ONLY`: one untracked synthetic fixture registry exists and has not been staged or certified. |

## Safe Integration Path

1. `PROTECTED`: Authority maintainer files `MM-AUTH-ARCH-001` at the cited canonical path, or explicitly records that DR-006's versioned mission adapter governs I1Q while the global document remains missing. Do not pretend the document exists.
2. `PROTECTED`: HQ/Auth owner repairs fail-open expiry, configured-secret checks, and credentialed CORS through the Critical Systems process. Prove nonce replay disposition, logout, restart, revocation, and outage behavior.
3. Root and Lorentz review, reconcile, and explicitly ratify or reject the in-flight `i1q.identity.v1` candidate. The resulting versioned contract must cover issuer, audience, canonical actor semantics, Supabase UUID, WordPress ID, permitted email handling, expiry, validation time, active/revoked state, credential state, and failure codes.
4. Use a dedicated I1Q server adapter. Do not copy HQ encryption logic, reuse its secret in a second service, widen WordPress roles, accept client roles, or expose service-role credentials.
5. Resolve I1Q roles and exact assignments from app-owned database rows after canonical identity validation.
6. Bind database authorization to the same verified Supabase UUID and prove no cross-session, pooled-connection, actor-substitution, or email-fallback path exists.
7. Review and certify the in-flight synthetic fixtures for administrator, editorial reviewer, physician placeholder, privacy reviewer, release manager, auditor, unauthorized student, unauthenticated visitor, revoked identity, and expired session. The physician placeholder remains non-approving.
8. Run the full auth attack matrix and dependent WordPress, HQ, Arena, STAT, Daily, USCE, and logout regressions before staging certification.

## Exact Blockers Returned To Root

| Blocker | Required owner action |
| --- | --- |
| Missing `MM-AUTH-ARCH-001` | Authority maintainer must file it or explicitly govern the mission-specific substitute without inventing global policy. |
| Shared HQ expiry defect | HQ/Auth owner must fail closed and regress all consumers. |
| Shared HQ configured-secret defect | HQ/Auth owner must test the configured value, hard fail in production, and prove restart persistence without exposing values. |
| Live hostile-origin CORS reflection | HQ/Auth owner must register a fixed allowlist and deny hostile origins. |
| No canonical actor authority | Root and Lorentz must decide and version the WordPress ID, Supabase UUID, and canonical actor relationship; the in-flight candidate's choice is not authority by itself. |
| Candidate resolver and fixtures are not operational | Root must review, authorize, commit through the owning lane, wire, and stage the dedicated adapter, role-profile resolver, audit sink, and fixture registry. |
| No I1Q route registration | Deployment owner must register route, audience, return target, origin, health, owner, and rollback before auth integration. |

## Protected No-Touch Boundary

HERSCHEL made no change to `missionmed-hq/server.mjs`, WordPress mu-plugins, Railway, Supabase, auth users, environment configuration, Critical Systems records, Matrix, consumer runtimes, I1Q feature flags, or production data.

============================================================
FILE: agents/herschel/protected_runtime_reconciliation.md
============================================================
# I1Q-1008A Protected Runtime Reconciliation

## Verdict

`FOUR LIVE RUNTIMES RECONFIRMED; CURRENT DEPLOYED SOURCE COMMITS REMAIN UNKNOWN`

Arena, STAT, Drills, and Daily live CDN hashes were re-read on 2026-07-15 and match the 1007X runtime evidence. All four differ from tracked `LIVE/` files. None of the four live hashes appears in the path history or any same-named Git blob reachable from current local refs. The current deployed source commit cannot be identified from repository evidence.

No runtime bytes were written to Git or retained by this lane. No upload, cache purge, object mutation, wrapper change, or deployment occurred.

## Runtime Truth Rule

The Critical Systems Contract establishes this order for deploy readiness:

1. production runtime behavior;
2. approved manifest pin;
3. committed source;
4. uncommitted source;
5. prose.

The current live bytes are therefore runtime truth, but they are not automatically approved source or a safe rollback artifact. The mismatch blocks use of tracked files as deployment baselines.

## Current Hash Reconciliation

| Surface | Tracked source | Tracked SHA-256 | Live object and URL | Live SHA-256 | Current source commit |
| --- | --- | --- | --- | --- | --- |
| Arena | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/arena.html` | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `html-system/LIVE/arena.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | `UNKNOWN` |
| STAT | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/stat.html` | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `html-system/LIVE/stat.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` | `UNKNOWN` |
| Drills | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/drills.html` | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `html-system/LIVE/drills.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` | `UNKNOWN` |
| Daily | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/LIVE/daily.html` | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `html-system/LIVE/daily.html`, `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` | `UNKNOWN` |

The direct live reads reproduced every 1007X deployed hash exactly.

## Size And Diff Evidence From 1007X

| Surface | Tracked bytes | Live bytes | Tracked lines | Live lines | Diff additions | Diff deletions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arena | 765,627 | 975,417 | 19,594 | 25,151 | 9,827 | 4,270 |
| STAT | 344,178 | 466,902 | 10,110 | 13,148 | 3,368 | 330 |
| Drills | 432,092 | 474,965 | 10,539 | 11,437 | 1,032 | 134 |
| Daily | 150,069 | 167,700 | 3,619 | 3,935 | 427 | 111 |

These are material differences, not line-ending noise.

## Git Provenance Search

For each live hash, read-only Git searches checked:

- every commit in that `LIVE/<surface>.html` path history across local refs;
- every reachable Git blob whose path ends with the same filename.

Results:

| Surface | Path-history hash match | Same-named blob match | Latest tracked source change |
| --- | --- | --- | --- |
| Arena | None | None | `fa83922ef20f8af288540487e33e3c25d4807a79`, 2026-06-16, `MM-LAUNCH-SEV1: launch readiness fixes and validation` |
| STAT | None | None | `f4a07e06f8e37cfd1e2c6537c39fa3628d5b2053`, 2026-04-27, `(E8)-STAT+Async-codex-high-500-b - apply and deploy human async STAT duel contract repair` |
| Drills | None | None | `909b3133c108965b23eb333c54673ea7427d6b40`, 2026-04-27, `MR-CDN-PREFIX-NORMALIZATION-031 - normalize runtime asset references to LIVE CDN` |
| Daily | None | None | `909b3133c108965b23eb333c54673ea7427d6b40`, 2026-04-27, same message |

The latest tracked source change is not proof of current deployment. Even STAT's commit message mentions deployment, but that commit's tracked bytes do not match the current live hash.

## Manifest Coverage

| Surface | Critical Systems Manifest state | Reconciliation consequence |
| --- | --- | --- |
| Arena | Manifest-approved live SHA-256 is `19a519f583439056af56bcf513f2fb26f872369c458ac958093bde48d9acb12a`; current live is `7bb0...`. The approved hash also has no same-named reachable blob match. | Three-way divergence exists among manifest, tracked source, and runtime. Deploy is stop-the-line until owner reconciliation. |
| STAT | No approved asset hash entry in Critical Systems Manifest. `_SYSTEM/DEPLOY_MANIFEST.json` maps the object key only. | Owner, approved source hash, browser expectation, and rollback artifact need registration. |
| Drills | No approved asset hash entry in Critical Systems Manifest. Deploy Manifest maps the object key only. | Same gap. |
| Daily | No approved asset hash entry in Critical Systems Manifest. Deploy Manifest maps the object key only. | Same gap; named human owner is also unclear. |

The Critical Systems known-good commit `3f0c27aac55dbf82748b3eaba360006d4041b539` contains Arena SHA-256 `1657c2ab29af86836262fdd27b92402f738c202e6d96f75b3ec440bf16ca12be`, which matches neither the manifest-approved Arena hash nor current live bytes.

## Ownership And Drift Classification

| Surface | Authority owner | Operational owner evidence | Drift classification |
| --- | --- | --- | --- |
| Arena | Arena owner; Brian/Root for protected deploy | Critical Manifest names Arena; R2/CDN deploy is Root-controlled | `UNKNOWN`, not safe to call expected or accidental |
| STAT | STAT owner; Brian/Root for protected deploy | STAT Canon and DR-006 | `UNKNOWN` |
| Drills | Drills/MMVS ingestion owner; Brian/Root for protected deploy | Exact named human owner not found | `UNKNOWN` |
| Daily | Daily with Drills/Arena integration ownership | Exact named human owner not found | `UNKNOWN` |

No current owner attestation ties any live hash to a commit, build, source archive, deployment event, or rollback artifact.

## Runtime Dependencies And Impact

| Surface | Current dependencies visible in runtime evidence | Risk of deploying tracked file |
| --- | --- | --- |
| Arena | WordPress wrapper, HQ exchange/bootstrap, RANKLISTIQ, routes to STAT and Daily/Drills | Could remove runtime-only auth, profile, routing, or mode behavior. |
| STAT | WordPress wrapper, HQ exchange/bootstrap, RANKLISTIQ duels, sealed packs, answer-map secrecy, historical joins | Could regress sealed-pack behavior, current UI, auth, or active duel compatibility. |
| Drills | WordPress wrapper, MMVS registry, playback, nodes, transcript availability, Daily return | Could regress source normalization, selected-drill launch, playback, or return navigation. |
| Daily | WordPress wrapper, MMVS registry, RANKLISTIQ drill control, Drills launch | Could regress active filtering, selected-drill payload, launch, or Arena return. |

I1Q consumer flags are off. The source mismatch does not prove a present I1Q regression, but it prevents a trustworthy before-and-after baseline for later integration.

## Safe Reconciliation Path

1. Each product owner confirms responsibility for the exact live URL and object key.
2. Root captures the current live bytes into an access-controlled rollback archive through the canonical protected process. HERSCHEL did not retain them.
3. Deployment owner obtains R2 object metadata, Cloudflare deployment evidence, GitHub deployment evidence, and activity-log evidence for each current hash without exposing credentials.
4. Search authoritative external source archives and owner worktrees for the exact live SHA-256. Current local Git refs do not contain it under a matching filename.
5. If no source exists, recover live bytes into a quarantined reconciliation branch without replacing tracked `LIVE/` files.
6. Perform semantic and security diffs against both tracked and live variants. Identify auth, bootstrap, routing, data pin, answer/source isolation, and accessibility differences.
7. Product owner classifies drift as expected or accidental and selects the authoritative source. Runtime truth alone does not decide which source should be promoted next.
8. Register exact source commit or immutable external artifact, live hash, rollback hash, owner, runtime owner, browser expectations, and rollback path in the controlling manifest.
9. Rerun static validation, live marker checks, authenticated browser journeys, answer/source isolation, dependent-product tests, rollback, and post-rollback checks on the reconciled baseline.
10. Only a later owner-authorized deployment may change live bytes. I1Q-1008A must not deploy these runtimes.

## Formal Reconciliation Records Required

Each owner record must include:

- surface and owner;
- tracked path and SHA-256;
- live URL, object key, SHA-256, byte count, and observation time;
- manifest-approved hash, if any;
- authoritative source commit or immutable artifact;
- deployment event or build identifier;
- drift classification and rationale;
- auth, routing, boot, Supabase, and consumer dependencies;
- preserved rollback artifact and hash;
- static, runtime, browser, security, and rollback evidence;
- owner approval and expiry or supersession rule.

## Current Blockers

| Blocker | Impact |
| --- | --- |
| No live hash maps to reachable same-named Git source | Current deployed source cannot be rebuilt from known repository evidence. |
| No current deployment event or build ID | Last deployment cannot be attributed. |
| Arena manifest hash differs from both source and runtime | Manifest cannot authorize deploy readiness. |
| STAT, Drills, and Daily lack critical asset hash entries | Protected registration and rollback are incomplete. |
| Drills and Daily named human ownership is unclear | Required attestation cannot be routed precisely. |
| No authenticated before baseline | Later I1Q dependent-system regression cannot be certified yet. |

## Protected No-Touch Boundary

No CDN/R2 object, cache, deploy script, LIVE file, WordPress wrapper, feature flag, manifest, protected consumer, or rollback artifact was modified.

============================================================
FILE: agents/lorentz/identity_resolver_contract.md
============================================================
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

============================================================
FILE: agents/lorentz/migration_contract.md
============================================================
# I1Q Preview Migration Contract

Contract ID: `I1Q-MIGRATION-v1`

Status: `STATIC CANDIDATE VERIFIED, PREVIEW AUTHORITY OPEN`

## Purpose

This contract defines the evidence required before Root may apply the I1Q schema to an authorized RANKLISTIQ preview or staging database. Lorentz does not apply, copy, rename, repair, or deploy a migration.

## Fixed Candidate

| Field | Observed value |
| --- | --- |
| Source file | `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql` |
| SHA-256 | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |
| Target declared in file | RANKLISTIQ, additive schema `i1q` |
| Tables | 52 |
| Transaction wrapper | present |
| Forced RLS | all candidate tables |
| Default feature flags | all six false |
| Runtime grants | deliberately absent |
| Current status | offline app-owned candidate |
| Preview or staging apply count | 0 |

The candidate is not yet a canonical Supabase migration. Its timestamp must be compared with actual target history before any filing or application. It must not be copied by hand into a shared migration directory.

## Observed In-Flight Follow-On Set

The shared worktree contains three additional 1008A SQL candidates:

| Candidate | Observed purpose | Current treatment |
| --- | --- | --- |
| `20260715193625_i1q_1008a_identity_runtime_contract.sql` | add a locked-off identity RPC and `i1q_runtime` capability role | `OBSERVED IN-FLIGHT`, unratified and unapplied |
| `20260715193845_i1q_1008a_compensating_disable.sql` | revoke the runtime capability and preserve schema, data, and history | `OBSERVED IN-FLIGHT`, unratified and unexecuted |
| `20260715193955_i1q_1008a_runtime_reapply.sql` | restore only the runtime identity capability while flags remain false | `OBSERVED IN-FLIGHT`, unratified and unexecuted |

These files do not replace the fixed 1007X base candidate or become canonical because they exist. Their timestamps, hashes, dependency order, capability-role design, `SECURITY DEFINER` ownership, search path, grant graph, and idempotence must pass M0 through M4 as one ordered set before any preview apply. The current fail-closed preview-target manifest remains unassigned and does not authorize an environment.

## Authority Constraints

- MR-078A controls naming, ordering, history integrity, transaction wrapping, pre-deploy checks, post-apply checks, and repair prohibitions.
- MR-078B selects RANKLISTIQ for STAT and I1Q question data and forbids project confusion.
- DR-006 authorizes an additive `i1q` schema, preview or staging first, forced RLS, deny by default, and forward-only compensation.
- MR-079 forbids migration repair, history editing, production reset, RLS bypass, and unapproved protected-system deployment.
- I1Q-1008A does not authorize a production database migration.

## Closed Migration Manifest

The apply candidate manifest contains exactly:

```text
schema_version
ticket
authority_ids
environment
project_id
project_name
preview_target_id
project_config_path
migration_directory
migration_filename
migration_sha256
latest_remote_version
history_before_sha256
schema_before_sha256
backup_id
rollback_contract_id
runtime_role_manifest_sha256
expected_object_inventory_sha256
feature_flag_defaults
requested_by
approved_by
prepared_at
```

Validation rules:

- `schema_version` is `i1q.migration-manifest.v1`.
- `ticket` is `I1Q-1008A` for the execution evidence even though the frozen source candidate was authored under I1Q-1007X.
- `authority_ids` is exactly the applicable set including `DR-006`, `MR-078A`, `MR-078B`, and `MR-079`.
- `environment` is `preview` or `staging`.
- `project_id` and `project_name` identify RANKLISTIQ exactly.
- `preview_target_id`, `project_config_path`, `migration_directory`, `latest_remote_version`, `backup_id`, and `approved_by` must be owner-provided, not inferred.
- the candidate timestamp is exactly 14 UTC digits, unique, later than remote history, and at least 60 seconds after the latest existing version
- all SHA-256 fields are lowercase 64-character hex
- all six feature flags are present exactly once and false
- unknown keys fail validation

## Gate Sequence

### Gate M0: Source Integrity

Required proof:

- branch and source commit match the 1008A baseline
- migration file hash matches the fixed candidate
- file remains unmodified after independent validation
- dependency `auth.uid()` and `pgcrypto` are present in the exact target environment
- target is PostgreSQL 15 or later

Failure result: `MIGRATION_SOURCE_INTEGRITY_FAILED`.

### Gate M1: Canonical Route

Required proof:

- RANKLISTIQ owner identifies the project-pinned CLI configuration
- canonical migration directory is identified
- preview target ID is explicit
- canonical GitHub workflow is identified
- workflow identity and migration-owner role are identified
- no production target is selected

Current result: `OPEN`.

Failure result: `MIGRATION_ROUTE_NOT_AUTHORIZED`.

### Gate M2: History And Ordering

Required proof:

- read-only migration list captured
- every remote applied version has its matching canonical file
- no canonical file expected to be applied is missing remotely
- no reverted entry exists
- no duplicate or malformed timestamp exists
- new timestamp is strictly ordered and at least 60 seconds later
- history backup hash recorded before any action

Any mismatch stops. No repair loop is permitted.

### Gate M3: Diff And Dependency Review

Required proof:

- project-pinned diff contains only the expected additive `i1q` objects
- no object outside `i1q` changes except an explicitly ratified runtime capability role and approved dependency grants
- no existing STAT, Arena, Drills, Daily Rounds, Matrix, auth, `dataset_questions`, or migration-history object changes
- expected object inventory independently hashed
- runtime role manifest is exact and reviewed

### Gate M4: Backup And Rollback Readiness

Required proof:

- preview backup identity exists and restoration authority is known
- schema and migration-history checksums are recorded
- forward compensation hash matches `rollback_contract.md`
- application rollback artifact is identified separately
- operator and monitor contacts are assigned
- rollback acceptance semantics are resolved by Root

The current compensation preserves schema and data. It is not proof that schema can return to an absent pre-I1Q state.

### Gate M5: Preview Apply

Root alone may invoke the canonical workflow after M0 through M4 pass. The workflow must apply one reviewed migration in strict order without force, repair, reset, or manual SQL.

Required captured result:

- workflow run ID and immutable commit
- environment and non-secret database fingerprint
- applied version and filename
- migration-history checksum after apply
- schema checksum after apply
- exact object inventory after apply
- feature-flag values
- runtime grant inventory
- start, finish, and duration

### Gate M6: Post-Apply Validation

Required proof:

- migration list contains the exact applied version
- project-pinned diff has no unexpected drift
- all 52 tables exist
- every candidate table has RLS enabled and forced
- `PUBLIC` and `anon` have no I1Q privileges
- `authenticated` has no I1Q privilege unless Root ratifies the capability-role model, in which case its complete effective privilege is exactly schema `USAGE` plus `EXECUTE` on the self-profile RPC and no table or other function access
- feature flags remain false
- unprivileged runtime role has only the exact approved grants
- anonymous, role, assignment, answer, source, audit, and feature-flag attacks fail closed
- no dependent project object or data changed

Static or disposable local proof cannot satisfy M5 or M6.

## Migration Repair Rules

- No agent may use `migration repair` under this contract.
- No actor may edit `supabase_migrations.schema_migrations` directly.
- No applied migration may be renamed, edited, deleted, squashed, or backdated.
- Any unexpected history, target, object, or diff state is an immediate stop and owner escalation.
- A correction after application is a new forward migration with its own authority and evidence.

## Environment Validation

The selected environment passes only when:

- it is non-production
- project identity is RANKLISTIQ, not Growth Engine or Scheduler Staging
- the target branch is dedicated or otherwise explicitly approved for I1Q
- the migration workflow is project-pinned and GitHub-controlled
- secrets are referenced by presence and owner only, never value
- database role is not service role, owner, superuser, or RLS bypass
- source, branch, workflow, migration, role manifest, and rollback artifacts are immutable and checksummed
- no current consumer or student flag is enabled

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy | Effect |
| --- | --- | --- | --- |
| `MIG-OPEN-01` | Canonical RANKLISTIQ migration directory | Owner supplies a project-pinned I1Q path rather than copying into Growth Engine migrations. | Blocks filing and apply. |
| `MIG-OPEN-02` | Preview branch or database target | Dedicated RANKLISTIQ preview branch with synthetic data. | Blocks M1. |
| `MIG-OPEN-03` | GitHub workflow and migration identity | MR-078A-compliant project-pinned workflow using migration-owner credentials. | Blocks M1. |
| `MIG-OPEN-04` | Current remote migration history | Capture read-only through canonical workflow. | Blocks timestamp and sync proof. |
| `MIG-OPEN-05` | Runtime role manifest | Ratify `runtime_role_contract.md` and exact signatures. | Blocks M3 and M6. |
| `MIG-OPEN-06` | Rollback acceptance conflict | Treat forward behavior compensation as authoritative unless Root obtains a new ruling that permits schema removal. | Blocks rollback certification. |
| `MIG-OPEN-07` | In-flight 1008A follow-on set | Review and ratify or reject the ordered identity, compensation, and reapply candidates as a single bounded change. | Blocks follow-on filing and apply. |

## Current Verdict

`STATIC_CANDIDATE_ACCEPTABLE_FOR_OWNER_REVIEW`

`PREVIEW_APPLY_NOT_AUTHORIZED_OR_EXECUTED`

============================================================
FILE: agents/lorentz/rls_actor_contract.md
============================================================
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

============================================================
FILE: agents/lorentz/rollback_contract.md
============================================================
# I1Q Rollback Contract

Contract ID: `I1Q-ROLLBACK-v1`

Status: `FORWARD COMPENSATION VERIFIED LOCALLY, PREVIEW EXECUTION OPEN`

## Fixed Compensation Candidate

| Field | Observed value |
| --- | --- |
| File | `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql` |
| SHA-256 | `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a` |
| Compensation ID | `20260715122435` |
| Behavior | disables all six I1Q feature flags |
| Data behavior | preserves all rows and immutable history |
| Repeat behavior | one compensation record and one audit event per compensation ID |
| Destructive SQL | none observed |
| Preview or staging execution count | 0 |

## Authority Ruling

DR-006 requires a reviewed forward compensating migration, preservation of audit, source hashes, immutable revisions, and release evidence, and no migration-history rewrite. MR-078A prohibits false history repair. Production rollback is outside Lorentz scope and I1Q-1008A production migration is prohibited.

## Important Acceptance Conflict

The 1008A ticket also asks rollback verification to show that the schema returns to the exact prior state with no I1Q objects. The authorized candidate does not do that. It disables behavior while retaining the additive schema and all data.

`OPEN`: Root must resolve which rollback acceptance statement governs State B evidence.

`PROPOSED DEFAULT`: follow DR-006 and treat rollback as behavior disable plus application artifact rollback, with schema and history preserved. Do not invent a destructive schema-removal migration.

Until Root records that interpretation, no execution may be labeled a complete rollback rehearsal for State B.

## Observed In-Flight 1008A Compensation Set

`OBSERVED IN-FLIGHT`: the shared worktree now contains a follow-on compensation that revokes `i1q_runtime` from Supabase `authenticated`, records the compensation, and preserves the schema and data. A paired reapply candidate restores only that role membership and keeps every I1Q feature flag false.

`OPEN`: neither file is owner-ratified, canonical, applied, or rehearsed. The files do not resolve the exact-prior-schema conflict, and restoring the identity capability is not the same as restoring application behavior.

## Rollback Layers

These layers are separate and require separate evidence:

| Layer | Action | Authority |
| --- | --- | --- |
| Traffic | stop new I1Q requests or keep internal flags off | deployment owner and Root |
| Application | restore last known-good authenticated I1Q artifact through canonical GitHub deployment | deployment owner and Root |
| Database behavior | apply the fixed forward compensation through the canonical migration workflow | RANKLISTIQ owner and Root |
| Data | preserve all I1Q tables, immutable revisions, review evidence, audit chains, hashes, and migration history | DR-006 |
| Consumers | keep student, STAT, and Drills flags false | DR-006 and product passport |

A database compensation does not prove application rollback. An application rollback does not prove database compensation.

## Preconditions

Every precondition must pass before preview execution:

- exact non-production target and database fingerprint recorded
- primary migration and compensation are present in canonical history with matching hashes
- backup or restore point identity recorded
- before-state schema, grants, policies, row counts, feature flags, audit head, and migration history checksummed
- current app artifact and last known-good app artifact identified by immutable digest
- rollback operator and incident owner assigned
- monitoring and stop criteria active
- no protected dependent system mutation is part of the run
- acceptance conflict above resolved by Root
- no secret value enters evidence

## Forward Compensation Execution

Root invokes only the canonical GitHub migration workflow. The compensation runs with migration or rollback operator authority and no application actor UUID.

The runtime role cannot execute `i1q.disable_i1q_behavior`.

Any target mismatch, unexpected history, changed checksum, non-null user actor, duplicate unexpected record, SQL error, or unrelated drift stops the operation.

## Post-Compensation Proof

Required results:

- all six I1Q feature flags are false
- one `compensation_records` row exists for compensation ID `20260715122435`
- one authoritative `i1q_behavior_compensated` audit event exists for that ID
- every I1Q table still exists when forward-preserving semantics are used
- immutable row counts and content hashes are unchanged
- audit chain continuity is unchanged except the one expected event
- migration history is append-only and includes the compensation version
- `PUBLIC`, `anon`, and `authenticated` remain denied
- runtime role privileges are no broader
- application health reflects disabled behavior without leaking internals
- dependent STAT, Arena, Drills, Daily Rounds, Matrix, HQ, and WordPress behavior is unchanged or honestly untested

Applying the same compensation again must keep flags false and must not create a second compensation row or audit event for the same ID.

## Reapplication And Recovery

The fixed 1007X primary migration is idempotent, but reapplying it after compensation does not enable feature flags because existing flag rows are preserved. Therefore reapplying the primary file alone is not functional recovery.

The in-flight 1008A reapply candidate supplies a source-level path for restoring only the proposed authenticated identity capability. It deliberately leaves all feature flags false. It is not yet an authorized forward re-enable mechanism and cannot establish full application recovery.

`OPEN`: no authority-ratified forward recovery mechanism exists.

`PROPOSED DEFAULT`: recovery requires all of the following, each separately approved:

1. deploy the corrected application artifact through GitHub
2. rerun migration, RLS, auth, security, and dependent-system gates
3. create a new forward migration or authority-approved control action for only the internal flags that may be enabled
4. keep student, STAT, and Drills consumer flags false
5. record a new audit and release decision

No operator updates feature flags manually in production or preview SQL.

## Closed Rollback Manifest

The future execution manifest contains exactly:

```text
schema_version
ticket
environment
project_id
preview_target_id
database_fingerprint
primary_migration_version
primary_migration_sha256
compensation_version
compensation_sha256
before_state_sha256
backup_id
application_before_digest
application_rollback_digest
workflow_run_id
operator
started_at
finished_at
result
flags_after
schema_after_sha256
history_after_sha256
audit_event_id
compensation_record_id
dependent_checks
recovery_authority
evidence_sha256
```

Rules:

- `schema_version` is `i1q.rollback-manifest.v1`.
- `environment` is `preview` or `staging`.
- `result` is one of `passed`, `failed`, or `aborted`.
- `flags_after` contains all six exact flag names and every value is false.
- `dependent_checks` uses only `passed`, `failed`, `blocked`, or `not_run`, each with an evidence reference.
- `recovery_authority` is null until a forward re-enable path is ratified.
- unknown keys fail validation.
- secrets, tokens, cookies, raw student data, raw source material, and answers are forbidden.

## Failure Handling

- Do not retry a failed migration command without root-cause analysis.
- Do not edit or repair migration history.
- Do not drop schema, tables, columns, policies, or functions.
- Do not delete compensation or audit rows.
- Do not force push, use manual production SQL, or use an ad hoc provider command.
- If the compensation partially applies, stop traffic and escalate under MR-078A. Do not loop.
- If the application artifact rollback fails, keep database behavior disabled and report the environment unavailable.

## Open Authority Gaps

| ID | OPEN gap | Proposed default, not policy |
| --- | --- | --- |
| `RB-OPEN-01` | Preview target and canonical workflow | RANKLISTIQ owner provides both. |
| `RB-OPEN-02` | Rollback acceptance conflict | Behavior-disable and history-preserving compensation governs under DR-006. |
| `RB-OPEN-03` | Last known-good staging artifact | First successful staging release records an immutable artifact digest before canary. |
| `RB-OPEN-04` | Forward re-enable mechanism | New reviewed migration or authority-approved flag service, never manual SQL. |
| `RB-OPEN-05` | Monitoring and operator runbook | Register alerts, owner, stop criteria, and evidence capture before rehearsal. |
| `RB-OPEN-06` | In-flight runtime reapply candidate | Ratify or reject it with the runtime-role model; treat it only as identity-capability recovery while flags remain false. |

## Current Verdict

`STATIC_COMPENSATION_ACCEPTABLE_FOR_OWNER_REVIEW`

`PREVIEW_ROLLBACK_NOT_EXECUTED`

`FUNCTIONAL_REENABLE_PATH_OPEN`

`IN_FLIGHT_RUNTIME_REAPPLY_NOT_RATIFIED`

============================================================
FILE: agents/lorentz/runtime_role_contract.md
============================================================
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

============================================================
FILE: agents/red_team/independent_red_team.md
============================================================
# I1Q-1008A Independent Red Team

**Decision:** `VETO`

**Highest achieved state:** `LOCAL BLOCKED ENGINEERING CANDIDATE`

No I1Q-1008A State A, B, C, or D is achieved or certified. Certification commit `efaae9401a5bc659c8b0cc34b8736de05c958fb7` is immutable and contains synchronized, truthful evidence for product implementation `fd7ddcd7688a0fc89cc4fc1320806220221046ae`, but the implementation remains unwired, unapplied to an authorized preview target, and undeployed. Red Team does not authorize migration, preview application, staging deployment, feature enablement, production activity, or student use.

## Review Boundary

- Reviewed branch: `i1q-statquestions-1008a`
- Exact certification commit: `efaae9401a5bc659c8b0cc34b8736de05c958fb7`
- Candidate tree: `f221add141b97ed33702c0437b84158d3ae66334`
- Product implementation commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`
- Execution boundary: tests and validation ran from an isolated `git archive` of the certification commit; branch HEAD was clean.
- Review time: 2026-07-16 UTC
- External boundary: no preview or staging target exists. No localhost result is treated as preview, staging, deployment, hosted RLS, or runtime proof.
- Independent exact-commit execution: `npm test` returned 287 total, 285 pass, 0 fail, and 2 database-target skips. `node --test tests/ui.test.mjs` returned 19/19. `npm run validate` returned `PASS`, 20/20 files, zero errors, claimed state `BLOCKED`.
- Repaired local UI controls: responsive root/table containment, pagination reflow, cursor exhaustion through 50,000 rows with fail-closed overlap/snapshot/cap handling, and deliberately selected exact-revision release assembly all pass their exact-commit regressions.
- Database boundary: the supplied fresh disposable PostgreSQL results (13/13 base and 1/1 runtime) were inspected but not independently rerun because no independent disposable database URL was provisioned. The two database lanes skipped in the independent default run.
- Protected boundary: all 20 protected baseline hashes were independently rechecked and unchanged. Protected files were read only.

This verdict is bound only to commit `efaae9401a5bc659c8b0cc34b8736de05c958fb7`, tree `f221add141b97ed33702c0437b84158d3ae66334`.

**Active finding count:** 13 total: 2 Critical, 6 High, 5 Medium. Prior High finding RT-004 is closed and excluded from active counts.

## State Verdict

| State | Red Team verdict | Disproof |
| --- | --- | --- |
| State A | `VETO / NOT ACHIEVED` | The identity contract is an unratified candidate, the executable server does not wire it, canonical users and lifecycle attacks are absent, and shared HQ auth has unresolved protected defects. |
| State B | `VETO / NOT ACHIEVED` | No authorized preview exists; no hosted RLS/grant attack run, apply, backup restoration, compensation, reapply, or required MR-078A diff proof exists. |
| State C | `VETO / NOT ACHIEVED` | No authenticated non-localhost I1Q service, deployment identity, smoke run, accessibility run, monitoring, rollback exercise, performance run, or burn-in exists. |
| State D | `VETO / OUT OF SCOPE AND BLOCKED` | Production and student release remain prohibited; prerequisite states are absent. |

## Findings

### RT-1008A-001 - Critical - No concrete canonical persistent runtime adapter exists

**Classification:** `LOCAL SAFETY PASS BOUNDED BY EXTERNAL IMPLEMENTATION BLOCKER`

The committed source closes the unsafe default path. `npm start` now enters `src/runtime.mjs`, requires authorized staging mode, an explicit bind, and a hash-pinned module under `runtime-adapters/`; it rejects `MemoryRepository`, synthetic platforms, missing persistent platform methods, and missing identity/static/logout/readiness/finalization/review-content resolvers. Server routes now await asynchronous platform methods, and direct `src/server.mjs` execution refuses non-demo startup. The runtime-composition regressions pass.

No `runtime-adapters/` directory or concrete adapter module exists. `PostgresRepository` still supplies only a transaction boundary rather than the complete platform surface, and no canonical identity, persistent workflow, readiness, finalization, or review-content implementation can be loaded. Thus the source now fails closed correctly, but it still cannot start an authenticated staging application.

**Readiness claim disproved:** a source-complete API and adapter candidate is not a deployable authenticated service.

**Achieved-state verdict:** blocks States A through C.

**Repairability:** `REPAIRABLE, MIXED LOCAL/EXTERNAL`. Implement and owner-ratify the hash-pinned canonical adapter, complete persistent platform surface, and all required resolvers, then prove the exact committed composition on a non-localhost target.

**Rerun trigger:** a committed production entrypoint and datastore adapter exist and an authenticated staging smoke proves persistence across restart.

### RT-1008A-002 - Critical - No preview, staging deployment, or external operation exists

**Classification:** `EXTERNAL EVIDENCE BLOCKER`

`deployment/preview-target.json` remains unassigned, no approval record or target secrets exist, and the preview workflow has never run. Root deployment, monitoring, rollback, and smoke records explicitly report `NOT DEPLOYED`, `DESIGN ONLY`, or `NOT RUN`. There is no authenticated non-localhost I1Q URL and no deployed commit or artifact identity.

**Readiness claim disproved:** local source and disposable-database checks cannot establish State B or C.

**Achieved-state verdict:** blocks States B through D and prevents external validation of State A integration.

**Repairability:** `REQUIRES EXTERNAL OWNER ACTION`. Assign an authorized synthetic-only preview, commit and approve exact target/candidate records, configure the protected GitHub environment, execute the workflow phases, deploy the application, and retain immutable evidence.

**Rerun trigger:** exact preview and staging targets, URLs, commits, approvals, workflow run IDs, and artifact hashes are available.

### RT-1008A-003 - Medium - Static MR-078A workflow controls pass, but authorization and execution are absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL GATES`

The latest workflow correctly separates secret-free validation, scopes secrets by step, pins actions, binds candidate artifacts and remote history, separates operation stages, performs post-operation RLS/grant/flag checks, uploads only after successful redaction, validates UTC/no-future timestamps and 60-second gaps, checks required headers, captures pre-action `supabase db diff`, and requires a zero-content post-action diff. The updated static workflow regressions pass. The earlier missing-diff/timestamp source finding is closed.

No target, approval record, protected-environment configuration, workflow run, generated diff, human diff review, backup/restore evidence, or run artifact exists. Exact approval provenance and MR-078A operation evidence therefore remain external facts that source inspection cannot grant.

The committed approval JSON is byte-bound, but its `approved_by` value is only data copied between two candidate-authored files. Authentic approver provenance therefore depends on external branch protection, CODEOWNERS/signature policy, and protected-environment reviewers, none of which is evidenced here.

**Readiness claim disproved:** static workflow hardening is not MR-078A execution readiness or authorization provenance.

**Achieved-state verdict:** blocks State B and every higher state.

**Repairability:** `REQUIRES EXTERNAL AUTHORITY AND EXECUTION`. Configure the owner-controlled protected environment, assign the synthetic target, run validation, review the exact diff, bind approval, and only then run an authorized operation.

**Rerun trigger:** workflow source includes all MR-078A checks, approval provenance is owner-controlled, static workflow tests pass, and a first authorized `validate` run produces reviewable artifacts before any apply.

### RT-1008A-004 - Closed - Evidence synchronization and claimed-state integrity

**Classification:** `LOCAL PASS`

The certification packet repairs the stale checksums and test inventory, incorporates the machine-readable agent evidence, and consistently records the operational boundary. Independent exact-commit validation passes 20/20 files with zero errors and claimed state `BLOCKED`; `deployment_manifest.json` says `BLOCKED_NOT_DEPLOYED` and `BELOW_LEVEL_1`. No unsupported achieved-state claim was found.

**Prior claim reassessed:** the stale/incomplete evidence finding is disproved by the synchronized certification packet.

**Achieved-state verdict:** `CLOSED`; does not block certification by itself and does not establish State A, B, or C.

**Repairability:** `CLOSED LOCAL`.

**Rerun trigger:** reopen if any candidate/evidence byte changes, validation fails, inventory becomes incomplete, or a state above `BLOCKED` is claimed without external proof.

### RT-1008A-005 - High - Canonical identity and shared-auth safety are not closed

**Classification:** `MIXED LOCAL, PROTECTED DEPENDENCY, AND EXTERNAL`

The new identity adapter has substantial synthetic tests and now requires an explicit audit sink; audit-sink outage fails closed with 503. The runtime root requires all canonical resolvers. Those local repairs are accepted. A concrete canonical adapter, role-profile implementation, durable audit implementation, staging identity, and owner-ratified contract still do not exist.

Read-only inspection of protected HQ source independently reproduced these gates: `missionmed-hq/server.mjs:81-83` uses a random session-secret fallback; `readEncryptedSession()` at lines 1026-1037 warns on malformed or expired expiry and returns the payload; `buildCorsHeaders()` at lines 3058-3070 reflects request origin when no fixed allowlist is configured while allowing credentials. On 2026-07-16 UTC, a public read-only request to `/api/auth/session` with `Origin: https://red-team-invalid.example` returned that origin and `Access-Control-Allow-Credentials: true`. WordPress creates a handoff nonce, but one-time consumption remains unproved.

**Readiness claim disproved:** synthetic adapter tests do not establish a canonical, revocable, replay-safe, auditable authentication lifecycle.

**Achieved-state verdict:** blocks State A and all dependent states.

**Repairability:** `REQUIRES PROTECTED OWNER AND EXTERNAL VALIDATION`. Resolve through the Critical Systems process, ratify the I1Q identity contract, wire the adapter, and run login, invalid login, expiry, replay, revocation, role removal, logout, restart, outage, and hostile-origin tests.

**Rerun trigger:** protected auth fixes and decision records are present, runtime/source parity is proved, and the full canonical-user attack matrix passes on staging.

### RT-1008A-006 - High - RLS and grants are locally promising but target fidelity is absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL BLOCKER`

The migration creates non-login, non-inheriting, non-bypass capability roles, force-RLS remains asserted, direct table grants are denied, the browser receives only the caller-scoped identity RPC capability, application runtime remains deny-all, and feature flags remain off. No local broad-grant bypass was found.

That is not a functional or hosted grant model. Exact application grants and the transaction actor binder are intentionally absent. The runtime test creates its own `authenticated` and `anon` roles and its own `auth.uid()` stub (`tests/postgres-runtime-1008a.test.mjs:52-65`), so it does not prove actual hosted role attributes, PostgREST schema exposure, connection-pool actor isolation, or target ownership/default privileges. No hosted owner/non-owner/bypass matrix ran.

**Readiness claim disproved:** disposable PostgreSQL proof is not State B hosted RLS certification.

**Achieved-state verdict:** local deny-by-default contract only; State B not achieved.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Ratify exact grants and actor binding, test real target roles and pool behavior, and execute the complete attack matrix against the authorized preview.

**Rerun trigger:** app-runtime grants and binder are committed and approved, followed by fresh hosted RLS/grant tests for anonymous, authenticated, unauthorized, reviewer, admin, owner, and pooled-session substitution cases.

### RT-1008A-007 - High - Answer/source isolation has no production authorization path

**Classification:** `LOCAL CONTRACT GAP WITH EXTERNAL PROOF MISSING`

Unit tests cover pre-answer denial and synthetic finalization cases, and no local direct-answer bypass was found. But finalization and review-content authorization are only injectable resolver slots in `createQuestionPlatformServer`; the executable entrypoint injects neither. There is no production proof that accepted assignment, server-side finalization, phase transition, and source-content release are derived from authoritative persisted state. No sealed-pack or cross-user answer/source attack ran on a deployed system.

**Readiness claim disproved:** local policy functions do not prove deployed answer or source isolation.

**Achieved-state verdict:** blocks States A through C for answer-bearing workflows.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Implement authoritative persisted resolvers and execute pre-answer, post-answer, reviewer-assignment, cross-user, replay, stale-session, direct-URL, cache, export, and rollback attacks.

**Rerun trigger:** production resolver composition is committed and the staging isolation matrix passes with captured request/response and audit evidence.

### RT-1008A-008 - Medium - Pagination completeness is repaired locally, but persistent-stack performance is unproved

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL PERFORMANCE BLOCKER`

The latest `public/app.js:382-429` drains cursor pages, rejects invalid totals, total changes, overlapping IDs, cursor loops, incomplete results, and results above 50,000 rows. The new 250-row UI regression passes, so the prior silent first-page truncation finding is closed on current local bytes.

The implementation still serially loads complete resource sets into browser memory for many joins and filters. The 10,000-row load result exercises only the in-memory repository, while the 250-row UI test uses a mocked transport; neither is a database, network, browser-rendering, concurrency, or staging SLO result.

**Readiness claim disproved:** local microbenchmarks do not prove complete or performant operator workflows at corpus scale.

**Achieved-state verdict:** local pagination completeness passes; State C performance readiness remains blocked.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`, with local optimization if thresholds fail. Run scale tests against the persistent staging stack and move expensive joins/filters server-side if the browser path misses approved thresholds.

**Rerun trigger:** authenticated staging load tests meet approved latency, memory, error, concurrency, and completeness thresholds at representative corpus sizes.

### RT-1008A-009 - High - Compensation and reapply are not an operational rollback

**Classification:** `LOCAL SAFETY SCRIPT WITH EXTERNAL EXECUTION BLOCKER`

The local compensation script is conservative: it revokes capability, preserves records, and keeps behavior flags off. The reapply restores only the reviewed identity-profile capability; it intentionally leaves application runtime deny-all and flags disabled. It therefore does not restore a functional service once real application grants and actor binding exist. No preview backup restore, compensation, reapply, data-integrity comparison, or application smoke has run, and the rollback acceptance interpretation remains unresolved in the closure packet.

**Readiness claim disproved:** idempotent disposable execution is not an operational rollback/recovery rehearsal.

**Achieved-state verdict:** blocks States B and C.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Ratify the rollback objective, extend reapply to the approved functional contract without auto-enabling behavior, then execute backup restore, compensate, reapply, schema/data diff, and app smoke on preview.

**Rerun trigger:** signed rollback criteria and complete target evidence for apply, compensation, restore, reapply, and post-recovery smoke are available.

### RT-1008A-010 - High - Fail-closed monitoring contracts exist, but monitoring operation is absent

**Classification:** `LOCAL IMPLEMENTATION GAP WITH EXTERNAL BLOCKER`

The local source now requires an audit function, fails closed on audit outage, requires a readiness resolver, and requires the runtime descriptor to claim durable audit. Those are useful contracts, not an implementation: no concrete runtime adapter, durable transport, metrics, tracing, alert routing, on-call ownership, dashboards, or tested runbook exists. The monitoring packet remains `DESIGN ONLY`; no staging logs, alert delivery, synthetic checks, burn-in, or rollback trigger has been observed.

**Readiness claim disproved:** a monitoring plan is not operating evidence.

**Achieved-state verdict:** blocks State C.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Implement durable telemetry and readiness, define SLOs and redaction, assign responders, and exercise alerts and runbooks on staging.

**Rerun trigger:** immutable staging telemetry demonstrates request, auth, DB, isolation, error, latency, saturation, and rollback signals with a successful alert drill.

### RT-1008A-011 - High - Protected dependent-system source and runtime are unreconciled

**Classification:** `PROTECTED DEPENDENCY AND EXTERNAL RUNTIME BLOCKER`

The 20 protected local hashes remain unchanged, which proves this candidate did not alter them. It does not prove compatibility or deployment parity. Independent read-only hashing on 2026-07-16 reproduced different local-versus-CDN bytes for all four shared consumers:

| Consumer | Local SHA-256 | Public CDN SHA-256 |
| --- | --- | --- |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` |

Which copy is authoritative remains an owner decision. No authenticated I1Q launch/return, answer secrecy, source availability, backward-compatibility, or rollback journey exists against those consumers.

**Readiness claim disproved:** unchanged protected source is not dependent-system safety.

**Achieved-state verdict:** blocks State C integration.

**Repairability:** `REQUIRES PROTECTED OWNERS`. Reconcile authority, record the chosen bytes, and run before/after/rollback contract journeys without changing protected files outside the Critical Systems process.

**Rerun trigger:** owner-approved source/runtime reconciliation and dependent consumer regression evidence are present.

### RT-1008A-012 - Medium - OpenAPI security shape is repaired, but deployed conformance is absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL CONFORMANCE BLOCKER`

The latest `openapi.json` replaces the placeholder OIDC URL with an explicit HTTP bearer JWT scheme describing the closed `i1q.identity.v1` contract, and the API test asserts that exact shape together with the current route surface. The earlier placeholder source finding is closed. There is still no standards-validator output, generated-client compatibility run, deployed base URL, concrete canonical adapter, or end-to-end conformance test against a persistent staging composition.

**Readiness claim disproved:** path coverage and JSON shape are not a deployment-valid API contract.

**Achieved-state verdict:** local API shape passes; State C conformance remains blocked.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`, with local correction if conformance fails. Run a standards validator and client compatibility suite, then compare authenticated staging responses with the exact spec.

**Rerun trigger:** the final OpenAPI document validates with real identity metadata and staging conformance passes.

### RT-1008A-013 - Medium - Local UI repairs pass, but accessibility certification remains not run

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL HUMAN-VALIDATION BLOCKER`

The latest bytes repair the challenged local defects. `public/styles.css` now contains page-root horizontal overflow, keeps table scrolling inside `.table-wrap`, prevents pagination controls from shrinking, and preserves wrapping mobile actor/environment context. `public/app.js` renders the full source, record, privacy, revision, comparison, and release hashes without title-only disclosure. Independent execution of `node --test tests/ui.test.mjs` passes 19/19, including the requested accessibility regressions, cursor draining, and distinct expired/revoked/provider-outage recovery states.

These are local source and JSDOM/static regression results, not a human accessibility certification. No authenticated staging run covers keyboard-only use, focus order, screen reader behavior, 200%/400% zoom, reflow, contrast, touch targets, error recovery, multiple browsers, or representative reviewer workflows. The pre-repair UX packet is now stale for current-byte defect status and must not be used to negate the repairs or to claim a current pass.

**Readiness claim disproved:** repaired source and passing local regressions do not establish WCAG 2.2 AA or operational usability on a nonexistent staging service.

**Achieved-state verdict:** blocks State C accessibility and UI readiness.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`. Preserve the repaired bytes, regenerate synchronized evidence, complete the current human protocol on authenticated staging, and remediate any newly observed failures.

**Rerun trigger:** authenticated staging passes the documented human/AT/browser matrix with retained evidence and zero unresolved release blockers.

### RT-1008A-014 - Medium - Authority routing is locally permitted but not closure-ready

**Classification:** `AUTHORITY/EXTERNAL OWNER BLOCKER`

MMOS authority was current and DR-006 validly permits additive local I1Q work against RANKLISTIQ under the fail-closed boundaries. No authority conflict or protected-path mutation was found. However, the canonical global identity architecture record remains missing, the I1Q identity candidate is not ratified, and mission routing still identifies the earlier I1Q-1006/1007X work rather than this immutable 1008A candidate. Medical governance remains unassigned for any student-facing state.

**Readiness claim disproved:** authorization to build locally is not authorization to claim integration, staging, production, or student release.

**Achieved-state verdict:** local internal candidate only; all release states remain blocked.

**Repairability:** `REQUIRES AUTHORITY OWNERS`. File or explicitly supersede missing authority, ratify the versioned identity/grant/rollback contracts, and route this exact immutable candidate through canonical mission records.

**Rerun trigger:** authority records resolve identity, target, grants, rollback semantics, owners, and candidate routing without conflict.

## Domain Challenge Matrix

| Domain challenged | Classification | Independent result |
| --- | --- | --- |
| Authority | Local plus owner-external | DR-006 permits local work; no achieved-state authority exists. |
| Source integrity | Local pass | Commit `efaae94` is immutable, clean at review, and exact-commit tests/validation reproduce. |
| Identity | Local pass plus external | Adapter and durable-audit failure tests pass; canonical adapter, lifecycle, ratification, wiring, and users are absent. |
| Authentication | Protected plus external | Protected expiry/secret/CORS/replay gates block reliance on shared auth. |
| RLS/grants | Local plus external | Deny-by-default local contract passes; hosted roles, actor binding, app grants, and attacks are absent. |
| API contracts | Local plus external | Path and bearer-JWT shape tests pass; standards, client, and deployed conformance do not. |
| Answer/source isolation | Local plus external | Unit policy tests pass; production resolvers and deployed attacks do not exist. |
| Migration workflow | Local pass plus external | Diff/timestamp/header gates pass locally; target authorization, diff review, approval provenance, and every workflow phase remain not run. |
| Rollback/reapply | Local plus external | Conservative local scripts exist; no operational recovery or functional reapply proof exists. |
| Deployment | External | No I1Q preview or staging deployment exists. |
| Accessibility/UI | Local pass plus external | Current repairs and UI regressions pass; human/AT/browser staging certification remains not run. |
| Performance | Local pass plus external | Cursor completeness is repaired and locally tested; persistent-stack latency, memory, concurrency, and SLO evidence remain absent. |
| Dependent systems | Protected plus external | Protected files are unchanged, but local/CDN drift and journey safety are unresolved. |
| Monitoring | Local contract plus external | Audit/readiness fail-closed contracts exist; no concrete durable telemetry, alert, runbook, or burn-in evidence. |
| Evidence integrity | Local pass | Validator passes 20/20 with zero errors and truthful claimed state `BLOCKED`; RT-004 is closed. |

## Reproduction Commands

For exact reproduction, export commit `efaae9401a5bc659c8b0cc34b8736de05c958fb7` to a clean temporary directory, make the worktree's existing `node_modules` available read-only, and run without setting secrets.

```sh
npm test --prefix i1q-question-platform
npm run validate --prefix i1q-question-platform
git status --short
rg -n "createQuestionPlatformServer|new QuestionPlatform|127.0.0.1" i1q-question-platform/src/server.mjs
rg -n "repository = new MemoryRepository" i1q-question-platform/src/platform.mjs
rg -n "supabase db diff|supabase db push|migration list" .github/workflows/i1q-1008a-preview.yml
rg -n "limit=200|next_cursor|listResource" i1q-question-platform/public/app.js
rg -n "MissionMedInternalSession|bearerFormat|securitySchemes" i1q-question-platform/openapi.json
rg -n "CONFIGURED_SESSION_SECRET|readEncryptedSession|buildCorsHeaders" missionmed-hq/server.mjs
shasum -a 256 LIVE/arena.html LIVE/stat.html LIVE/drills.html LIVE/daily.html
```

Read-only dependent-runtime checks used by this review:

```sh
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html | shasum -a 256
curl -sS -D - -o /dev/null -H 'Origin: https://red-team-invalid.example' \
  https://missionmed-hq-production.up.railway.app/api/auth/session
```

These public dependency observations do not constitute I1Q preview or staging proof.

## Explicit Rerun Gate

Red Team will rerun only after all of the following are true:

1. Identity, app grants, actor binding, rollback semantics, target, and approver authority are ratified.
2. Protected shared-auth findings are fixed through the Critical Systems process and runtime parity is proved.
3. The production composition uses canonical identity and a persistent datastore with durable audit and readiness.
4. The workflow first passes an authorized validation run against the exact approved target.
5. A synthetic-only preview executes apply, hosted RLS attacks, backup restore, compensation, reapply, and post-action drift checks.
6. An authenticated non-localhost staging deployment passes API, answer/source isolation, dependent-system, accessibility, performance, monitoring, alert, restart, and rollback tests.
7. Security and Release withdraw their vetoes on the exact same candidate and evidence hashes.

Until then, Red Team veto remains in force.

============================================================
FILE: agents/red_team/red_team_release_verdict.md
============================================================
# I1Q-1008A Red Team Release Verdict

## Verdict

**RED TEAM VETO**

**Highest achieved state:** `LOCAL BLOCKED ENGINEERING CANDIDATE`

No State A, B, C, or D is achieved. No migration, preview operation, staging deployment, feature enablement, production action, or student release is authorized by this review.

The exact reviewed certification candidate is immutable commit `efaae9401a5bc659c8b0cc34b8736de05c958fb7` (tree `f221add141b97ed33702c0437b84158d3ae66334`) on branch `i1q-statquestions-1008a`. It certifies unchanged product implementation `fd7ddcd7688a0fc89cc4fc1320806220221046ae`. Checks ran from an isolated export and branch HEAD was clean.

**Active findings:** 13 total: 2 Critical, 6 High, 5 Medium. RT-004 is closed.

## Exact-Commit Results

| Check | Classification | Independent result |
| --- | --- | --- |
| Full Node suite | Local | 287 total, 285 pass, 0 fail, 2 disposable-DB skips |
| UI regression suite | Local | 19/19 pass |
| Evidence validator | Local | `PASS`: 20/20 files, 0 errors, truthful claimed state `BLOCKED` |
| Base PostgreSQL | Supplied local evidence | 13/13 reported; not independently rerun without a disposable DB URL |
| 1008A runtime PostgreSQL | Supplied local evidence | 1/1 reported; not independently rerun without a disposable DB URL |
| Protected baselines | Local read-only | 20/20 hashes unchanged |
| Preview workflow | External | `NOT_RUN`; target unassigned |
| Preview apply/RLS/rollback/reapply | External | `NOT_RUN` |
| Authenticated I1Q staging | External | Does not exist; `NOT_RUN` |

The committed workflow, accessibility, pagination, audit, and runtime-root repairs are accepted as local facts. MR-078A diff/timestamp/header gates, guarded cursor draining, repaired UI disclosures/reflow, fail-closed audit, async server routing, and a hash-pinned runtime loader all pass local regressions. They do not create a canonical runtime adapter, authorized target, executed workflow, human/AT result, persistent-stack result, preview, or staging deployment.

## State Decision

| State | Decision | Controlling reason |
| --- | --- | --- |
| State A | `VETO` | Identity is unratified and unwired; canonical lifecycle attacks are absent; protected shared-auth defects remain unresolved. |
| State B | `VETO` | No authorized preview exists; hosted grants/RLS, backup restore, compensation, reapply, and MR-078A diff evidence are absent. |
| State C | `VETO` | No authenticated non-localhost service, persistent production composition, accessibility run, performance run, monitoring, rollback, or burn-in exists. |
| State D | `VETO / OUT OF SCOPE` | Production and student release remain prohibited and prerequisite states are absent. |

## Veto Grounds

1. The runtime root now fails closed and rejects MemoryRepository, but no concrete hash-pinned canonical adapter or complete persistent platform implementation exists, so authenticated staging still cannot start.
2. The preview/staging/deployment estate is nonexistent. Static workflow source cannot substitute for a run.
3. The workflow now captures pre/post diffs and validates timestamps/headers, but no target, approval record, environment configuration, generated diff review, workflow run, or artifact exists.
4. Protected shared auth still has source-level expiry, secret-fallback, CORS, replay, and lifecycle gates. Hostile-origin credentialed CORS reflection was independently reproduced on the public HQ session route.
5. Local RLS is deny-by-default, but exact application grants, actor binding, hosted role defaults, pool isolation, and the preview attack matrix do not exist.
6. Answer/source isolation has no deployed authoritative finalization or assignment resolver and no staging attack evidence.
7. Cursor completeness is repaired locally, but serial full-resource loading has no persistent-database, real-network, browser-memory, concurrency, or staging SLO proof.
8. Compensation/reapply is a conservative local capability sequence, not an executed backup restore or functional service recovery.
9. Monitoring remains design-only, dependent consumer source/runtime bytes remain unreconciled, and no staging journey or rollback proof exists.
10. OpenAPI bearer-JWT security shape now passes locally, but no standards/client validation or deployment conformance run exists.
11. Local UI repairs pass, but human/AT/browser accessibility and operational usability remain externally untested.

## Closed Finding

RT-004 is closed. The synchronized packet passes the evidence validator with no stale or incomplete inventory and makes no unsupported achieved-state claim. This closes evidence integrity only; it does not supply any missing external execution.

## Repairability

- `LOCAL`: a concrete canonical runtime adapter and operational telemetry implementation remain. Evidence synchronization, workflow controls, responsive containment, cursor exhaustion, exact revision selection, fail-closed audit, and the runtime loader are repaired.
- `PROTECTED`: HQ/WordPress auth and dependent-consumer reconciliation require owner action and Critical Systems decision records.
- `EXTERNAL`: target assignment, approval provenance, backup/restore, workflow execution, hosted RLS, deployment, monitoring, accessibility, performance, and rollback evidence require real authorized environments.

## Explicit Rerun Triggers

Red Team rerun requires all of the following on one exact immutable candidate:

1. Ratified identity, grant, actor-binding, rollback, target, and approver authority.
2. Protected auth fixes with source/runtime parity and a passing canonical lifecycle attack suite.
3. A production composition using canonical identity, persistent storage, authoritative answer/source resolvers, durable audit, and readiness.
4. A successful authorized MR-078A validation phase.
5. Preview apply, hosted RLS/grant attacks, backup restore, compensation, reapply, and post-action drift proof.
6. Authenticated non-localhost staging API, isolation, dependent-system, accessibility, performance, monitoring, alert, restart, and rollback results.
7. Security and Release withdrawal of veto for the identical commit, workflow, target, and evidence hashes.

Until every trigger is satisfied, Red Team veto remains in force.

============================================================
FILE: agents/release_reliability/monitoring_plan.md
============================================================
# I1Q-1008A Monitoring Plan

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `DESIGN ONLY - EXTERNAL MONITORING NOT_RUN`

Staging telemetry collection, dashboard validation, alert delivery, synthetic monitoring, provider binding, and incident rehearsal are all `NOT_RUN`.

The hardened preview workflow now has a passing local evidence-control baseline: source validation is secret-free, preview secrets are step-scoped, exact candidate and approval artifacts are hash-bound, complete prehistory is digest-bound, and evidence upload runs only after explicit redaction succeeds. This protects future run artifacts but does not constitute telemetry, alert delivery, backup monitoring, restore observation, or hosted operational evidence.

For the exact product candidate above, the corrected local estate reports 285 of 287 full-suite tests passed with 0 failures and 2 intentional database-target skips, UI tests passed 19 of 19, focused migration/workflow tests passed 9 of 9, and evidence validation passed 20 of 20 with claimed state `BLOCKED`. The local UX matrix completed 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells with zero root overflow; its simulated score is 8.21 against a 6.8 floor and its release decision remains `BLOCK`. These are local product signals, not deployed monitoring evidence.

## Monitoring Principles

1. Monitor the dedicated I1Q service and target only. Do not infer I1Q health from MissionMed HQ or another protected service.
2. Separate liveness from readiness. An unconfigured auth or datastore adapter is alive but not ready.
3. Use aggregate, privacy-safe events and bounded labels.
4. Never log or export tokens, cookies, credentials, connection values, request bodies, email addresses, answers, explanations, raw transcripts, source locations, student data, patient data, or protected review content.
5. Hash or replace actor, session, assignment, revision, and request identifiers with short-lived correlation IDs when correlation is necessary.
6. Every deploy, migration, compensation, reapplication, configuration change, and feature-control change emits a safe immutable marker.
7. Monitoring failure is a release failure, not an invitation to deploy blind.

## Required Signals

### Service And Deployment

- process liveness;
- dependency-aware readiness;
- exact safe build and deployment provenance;
- restart, crash-loop, and rollback markers;
- request volume, status class, route class, latency, and timeout counts;
- frontend exception count and affected synthetic journey;
- memory, CPU, open handles, and event-loop delay;
- deployment age and last successful synthetic journey.

### Authentication And Request Integrity

- successful synthetic sign-in and session validation;
- failure counts by bounded reason class: missing, expired, revoked, malformed, wrong audience, wrong project, provider unavailable, and wrong role;
- refresh, logout, and old-session rejection;
- trusted-origin acceptance and hostile-origin denial;
- CSRF rejection;
- identity-provider latency and outage;
- role-profile resolver latency, outage, and mismatch;
- any canonical actor mismatch.

### Datastore And Authorization

- connection acquisition, transaction, commit, rollback, and pool timeout counts;
- active and waiting connections relative to the approved pool limit;
- query latency and error class by allowlisted operation name;
- actor binder failure and post-transaction context-clear failure;
- RLS and permission denials by bounded policy class;
- direct-grant, role-membership, ownership, or effective-privilege drift;
- schema and migration-history drift;
- feature-control checksum drift;
- backup success and restore-test currency.

### Safety And Integrity

- answer-bearing access attempts before an allowed purpose;
- restricted-source access attempts outside an allowed purpose;
- wrong-actor and cross-assignment denials;
- audit append failures, sequence gaps, and chain verification failures;
- immutable-record mutation attempts;
- stale-write rejections and duplicate-idempotency outcomes;
- release-gate denials and any attempted student or consumer activation;
- evidence redaction and artifact-inventory failures.

## Proposed Staging Service Levels

These thresholds become binding only after provider and owner ratification. They are deliberately conservative for synthetic-only staging.

| Signal | Target | Alert |
| --- | --- | --- |
| Liveness | Successful probe every minute | Page after 3 consecutive failures |
| Readiness | Successful probe every minute while released | Page after 2 consecutive failures |
| Authenticated synthetic journey | Complete at least every 5 minutes | Page after 2 consecutive failures |
| Request success | At least 99.5% for expected non-attack traffic over 30 minutes | Urgent at below target; page for repeated 5xx |
| Server errors | No sustained 5xx sequence | Page on 5 consecutive 5xx or more than 2% over 5 minutes |
| API latency | p95 at or below 1 second and p99 at or below 2 seconds after warm-up | Urgent for 15 minutes above target |
| Identity provider latency | p95 at or below 1 second | Urgent for 10 minutes above target |
| Pool utilization | Below 80% of approved maximum | Urgent for 10 minutes above target; page at exhaustion |
| Frontend exceptions | Below 1% of synthetic workflow runs | Urgent for 15 minutes above target |
| Migration or schema drift | Zero | Immediate page on any detection |
| Role or grant drift | Zero | Immediate page on any detection |
| Protected feature-control drift | Zero | Immediate page on any detection |
| Actor-context leakage | Zero | Immediate page and rollback |
| Answer or restricted-source anomaly | Zero | Immediate page, containment, and rollback |
| Audit append or chain failure | Zero | Immediate page and traffic containment |
| Evidence redaction failure | Zero uploaded artifacts | Immediate stop; no upload |
| Backup and restore currency | Within the owner-approved window | Urgent when stale or failed |

Attack-test traffic must be tagged by safe test-run identifier so expected denials do not pollute operational error budgets. An unexpected success in an attack test is always an immediate page.

## Dashboards

### Release Health

- build and deployment provenance;
- liveness, readiness, uptime, restart count, and last synthetic journey;
- request rate, 4xx, 5xx, latency, and frontend exceptions;
- current release window and rollback readiness.

### Identity And Security

- auth success and bounded failure classes;
- logout and old-session rejection;
- origin and CSRF denials;
- wrong-actor, cross-assignment, answer, and source denials;
- security alert status and acknowledgment.

### Datastore And Integrity

- migration version and drift checksum;
- schema, role, grant, RLS, and feature-control checksums;
- pool, transaction, query, and rollback health;
- audit append and chain status;
- backup and restore-test currency.

No dashboard contains a raw payload or stable personal identifier.

## Alert Routing And Ownership

| Severity | Examples | Route and response |
| --- | --- | --- |
| Critical | Auth bypass, actor leakage, answer/source exposure, audit failure, migration/role drift, protected control enabled, secret exposure, rollback failure | Page incident owner, security, database owner, rollback operator, and release manager immediately; contain traffic |
| High | Repeated 5xx, readiness failure, provider outage, pool exhaustion, failed authenticated journey | Page deployment owner and Release and Reliability; acknowledge within 10 minutes |
| Medium | Sustained latency, elevated expected denials, frontend exception spike, stale backup evidence | Open urgent ticket and acknowledge within 30 minutes |
| Informational | Deploy marker, successful backup, daily role inventory, successful smoke | Daily release review |

Alert destinations and contact values belong only in the provider's protected configuration. This document records roles, not destinations.

## Burn-In And Release Observation

- Start the observation window only after the exact final artifact and configuration are deployed.
- Reset the 24-hour staging burn-in after any deployment, migration, compensation, reapplication, or configuration change.
- Run the authenticated synthetic journey every five minutes.
- Run role/grant, migration, schema, RLS, and feature-control drift checks at least every fifteen minutes.
- Review dashboards at deployment, 15 minutes, 1 hour, 4 hours, and burn-in completion.
- Require no Critical alert, no unresolved High alert, and no unexplained monitor gap.
- Archive a redacted, checksummed summary bound to the exact release evidence window.

## Required Runbooks

Before monitoring certification, execute and time each runbook with synthetic fixtures:

1. authentication outage and revocation;
2. identity-provider or role-profile mismatch;
3. datastore outage and pool exhaustion;
4. broken or partial migration;
5. role, grant, RLS, or feature-control drift;
6. forward compensation and reapplication;
7. failed application deployment and artifact rollback;
8. leaked credential or secret-bearing log;
9. suspicious answer or restricted-source access;
10. audit append or chain anomaly;
11. unavailable staging host;
12. monitoring or alert-delivery outage.

Each exercise records safe timestamps, roles, detection time, acknowledgment time, containment time, recovery time, evidence digest, and follow-up owner. No prohibited payload enters the record.

## Monitoring Certification Gate

Pass only when:

- every required signal is emitted from the exact staging artifact;
- all dashboards and alert routes are operational;
- redaction tests prove prohibited values cannot enter logs or artifacts;
- every Critical and High alert is triggered and acknowledged in a synthetic exercise;
- rollback and reapplication markers correlate with canonical workflow runs;
- the 24-hour burn-in completes without a Critical or unresolved High alert;
- Security and Release and Reliability independently sign the evidence.

## Current Verdict

`MONITORING: NOT OPERATIONAL / BLOCKING STAGING CERTIFICATION`

============================================================
FILE: agents/release_reliability/preview_certification.md
============================================================
# I1Q-1008A Preview Certification

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Observed: 2026-07-15

Status: `NOT CERTIFIED`

Scope: nonproduction preview only. This document does not authorize a migration, deployment, environment change, feature-flag change, or external-service action.

## Evidence Classification

| Class | Meaning | Current result |
| --- | --- | --- |
| Static source inspection | Files and contracts inspected in the worktree | Completed |
| Local Node proof | Tests executed without an external target | Completed: 285 of 287 passed, 0 failed, 2 intentional database-target skips |
| Local UI proof | UI contract suite | Completed: 19 of 19 passed |
| Local UX proof | Browser matrix and simulation | Completed locally; release decision remains `BLOCK` |
| Agent-reported disposable PostgreSQL proof | Prior isolated database runs using synthetic fixtures | Reported pass; not rerun by this agent |
| Real preview proof | Canonical workflow against an authorized nonproduction target | `NOT_RUN` |
| Real staging proof | Deployed authenticated service on a non-localhost target | `NOT_RUN` |

Local or disposable proof must never be relabeled as preview or staging proof.

## Candidate Inspected

- Product commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`
- Base migration: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Identity and role migration: `i1q-question-platform/db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql`
- Forward compensation: `i1q-question-platform/db/rollback/20260715193845_i1q_1008a_compensating_disable.sql`
- Controlled reapplication: `i1q-question-platform/db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql`
- Target contract: `i1q-question-platform/deployment/preview-target.json`
- Workflow candidate: `.github/workflows/i1q-1008a-preview.yml`

The target contract is deliberately unassigned, synthetic-only, and production-denied. No target identity, host, database, backup, restore test, approval, or workflow run is present.

## Corrected Local Evidence Snapshot

- Full suite: 287 total, 285 passed, 0 failed, 2 intentional database-target skips.
- UI suite: 19 of 19 passed.
- Focused migration/workflow suite: 9 of 9 passed.
- Evidence validator: 20 of 20 files, 0 errors, claimed state `BLOCKED`.
- Local UX browser matrix: 187 workflow cells, 176 state cells, 68 mobile cells, and 66 width-equivalent reflow cells, with zero root overflow.
- Local UX simulation: 8.21 against a 6.8 floor; release decision `BLOCK`.

The corrected product and evidence estate is pinned to the commit above. It does not convert local checks into preview certification.

## Current Static Strengths

- The workflow is manual, uses a protected environment gate, serializes migration operations, and pins third-party actions by commit.
- A separate `validate-source` job installs dependencies, runs the complete Node suite, and runs evidence validation without preview secrets.
- Preview secrets are scoped only to the individual steps that require them.
- The workflow validates target type, nonproduction denial, synthetic-only use, secret presence, and target-to-connection consistency before a database operation.
- An authorized target must bind the exact operation, Git commit, four SQL hashes, workflow hash, expected complete remote-history hash, and a separately committed closed approval record.
- Preflight hashes the approval record's exact bytes, validates its closed content, recomputes every candidate artifact hash, and rejects any mismatch.
- Preflight hashes the complete remote migration-history bytes and compares them with the approved expected digest.
- Write operations require backup and restore evidence references.
- Operation-history gates require apply, compensation, and reapplication to occur in the intended order and reject collapsed later stages.
- Target tests are phase-safe for either a wholly unassigned target or a fully populated authorized target.
- Evidence upload occurs only when the explicit redaction step outcome is successful.
- The migration set is forward-only and transaction-wrapped.
- All I1Q tables in the base candidate are expected to have enabled and forced RLS.
- The identity-profile role and application-runtime role are separate, unprivileged, and non-login.
- The latest identity migration rejects enabled pre-existing safety flags and checks the complete role membership, ownership, and direct-privilege graph against an allowlist.
- The application-runtime role remains browser-inaccessible and deny-all.
- Compensation preserves schema, data, immutable evidence, audit history, and migration history.
- Reapplication restores only the caller-scoped identity capability and requires every feature flag to remain off.

These are candidate properties, not environment evidence.

## Remaining Certification Gaps

The locally actionable RR-02 controls above are repaired and pass static tests. Preview certification remains blocked by unavailable environment evidence:

1. The target contract is still `UNASSIGNED`; no committed approval record, protected target configuration, or canonical workflow run exists.
2. MR-078A requires a project-pinned schema diff. The workflow has a dry run and schema fingerprints, but no real target diff has been captured, reviewed, or approved.
3. Post-operation checks have not executed the complete hosted RLS, persona, answer-isolation, restricted-source, actor-switching, and pooled-session attack suites.
4. Backup and restore fields are fail-closed contract requirements only. Actual provider backup verification, restore authority, restore execution, and independent restore observation are `NOT_RUN`.
5. No remote validate, apply, compensate, or reapply artifact exists, and no disabled state has been observed on a real target.

Any one of these `NOT_RUN` evidence classes prevents preview certification.

## Canonical Gate Sequence

All gates are fail-closed. Evidence records contain identifiers and digests only, never secret or environment values.

### P0 - Authority And Candidate Freeze

Pass only when:

- Root freezes a clean commit containing the exact application, workflow, target contract, SQL set, tests, and runbooks.
- No active Git operation or unreviewed worktree delta exists.
- The database owner, deployment owner, security verifier, and rollback operator are named by role.
- An approval record binds the exact target class, exact commit, exact SQL hashes, workflow hash, synthetic-only restriction, and expiration window.
- The workflow recomputes and verifies that approval record before any connection.
- Security, UX/accessibility, and independent red-team vetoes are cleared for the exact frozen candidate.

Required evidence: immutable commit, closed artifact manifest, independent checksum result, approval-record digest, and signed role approvals.

### P1 - Nonproduction Target And Restore Readiness

Pass only when:

- The owner identifies a dedicated nonproduction target in the protected target contract.
- The target cannot resolve to any production project, host, database, branch, or data source.
- Only synthetic, non-clinical, non-student fixtures are allowed.
- A provider backup exists, is recent enough for the run window, and has a tested restore reference.
- The restore test was executed against a disposable restore target and independently observed.
- The protected workflow environment has reviewers and exact branch or commit restrictions.
- Required secret presence is confirmed by owner and version reference only.

Required evidence: approved target contract, backup identity, restore test identity, target fingerprint digest, and environment-protection review.

### P2 - Secret-Free Build And Static Safety

Pass only when a secret-free job proves:

- dependency installation is reproducible;
- the full Node suite has zero failures and no unexplained skips;
- workflow and target contract tests match the authorized-target phase;
- migration filenames, ordering, headers, wrappers, dependency chain, and hashes are exact;
- no destructive SQL, history mutation, broad grant, RLS bypass, or feature enablement exists;
- the evidence validator reports zero errors against the frozen candidate.

Required evidence: test artifact, test inventory, build digest, migration manifest, and zero-error evidence-validator result.

### P3 - Read-Only Target Preflight

Pass only when the canonical workflow, before any write, captures and validates:

- target fingerprint and nonproduction denial;
- database version and required dependencies;
- complete migration history with no missing, extra, malformed, duplicate, out-of-order, or reverted version;
- exact local-to-remote history reconciliation;
- schema and grants before-state fingerprints;
- all feature flags false;
- exact role absence or exact approved pre-existing role graph;
- project-pinned dry run and schema diff containing only approved additive changes;
- backup and restore evidence still valid.

Any mismatch stops the run. No repair, reset, force, manual SQL, or retry loop is permitted.

### P4 - Preview Apply

Root alone dispatches the canonical workflow after P0 through P3 pass. The migration owner performs only the reviewed forward operation. Release and Reliability observes; it does not hold migration credentials or approve its own evidence.

Required evidence:

- immutable run and attempt identifiers;
- exact commit and artifact digests;
- start and finish timestamps;
- migration list and history before and after;
- dry-run and approved diff digests;
- schema, policy, grant, role, and feature-flag fingerprints;
- redaction result followed by upload only on redaction success;
- closed artifact inventory and independent checksum verification.

### P5 - Hosted Post-Apply Certification

Pass only when the exact target proves:

- every expected table exists and every I1Q table has enabled and forced RLS;
- built-in browser roles have no direct I1Q table access;
- the identity-profile role has only the caller-scoped identity function capability;
- the application-runtime role has no member, ownership, schema, table, sequence, function, or grant-option capability;
- anonymous, missing, revoked, expired, wrong-role, cross-actor, and cross-assignment requests fail closed;
- answer-bearing and restricted-source direct reads fail closed;
- the identity RPC returns only the current actor's database-owned profile;
- actor context does not cross pooled sessions;
- all feature flags remain false;
- audit append and chain checks pass;
- no object outside the approved additive boundary changed.

### P6 - Compensation And Reapplication Rehearsal

Use separate workflow runs and evidence windows:

1. Apply and certify the enabled identity-capability state.
2. Compensate and certify the disabled state while preserving data and history.
3. Reapply and certify only the identity capability while every feature flag remains false.

The disabled state must be observed and signed before reapplication starts. A second rollback after reapplication requires a new reviewed forward compensation version; the already-applied compensation version cannot be reused as a new migration event.

### P7 - Preview Verdict

Certification requires all P0 through P6 evidence, zero unresolved Critical or High findings, independent security and database review, a zero-error evidence packet, and a release/reliability signature bound to the exact run set.

## Current Verdict

`PREVIEW CERTIFICATION: BLOCKED`

The preview target remains unassigned. Canonical preview validation/apply, project-pinned schema diff review, hosted RLS attacks, actual backup/restore execution, compensation, and reapplication are all `NOT_RUN`. The hardened static controls and corrected local evidence pass their stated gates, but the candidate may continue through local engineering review only.

============================================================
FILE: agents/release_reliability/reapplication_results.md
============================================================
# I1Q-1008A Reapplication Results

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `EXTERNAL REAPPLICATION NOT_RUN`

This document defines the evidence required to restore the caller-scoped identity capability after a successful forward compensation. It does not restore full application behavior and does not enable a feature control.

## Candidate Behavior

The current reapplication candidate is intentionally narrow:

- requires both the identity migration and first-cycle compensation in append-only history;
- requires the identity-profile and application-runtime roles to remain unprivileged;
- requires the caller-scoped identity function and role-contract assertion to exist;
- refuses to run while any I1Q feature control is enabled;
- restores only schema usage and exact execution of the caller-scoped identity function to the identity-profile capability;
- restores only the approved authenticated-to-identity-profile membership;
- leaves the application-runtime role deny-all and browser-inaccessible;
- records one schema version and one idempotent audit event;
- preserves data and history.

It does not wire the application, create an actor binder, grant server runtime access, enable internal workflows, or authorize staging traffic.

## Evidence Boundary

Existing root and Avicenna reports state that the candidate reapplied successfully and idempotently in disposable local PostgreSQL while all controls remained off. This agent inspected those reports but did not execute a migration.

The preview target remains unassigned. Canonical hosted compensation observation, reapplication, staging deployment, and post-reapplication smoke are all `NOT_RUN`.

The hardened workflow now statically binds reapplication to the exact operation, commit, four SQL hashes, workflow hash, expected complete remote-history digest, and exact committed approval record. Its prehistory gate requires the base, identity, and compensation versions, rejects an existing reapplication version, and its after-state gate proves the intended phase. Secret-free validation and success-only evidence upload are separated from step-scoped preview secrets.

These are passing local controls, not reapplication results.

For the exact candidate above, the corrected local estate passes 285 of 287 full-suite tests with 0 failures and 2 intentional database-target skips, 19 of 19 UI tests, 9 of 9 focused migration/workflow tests, and 20 of 20 evidence-validator files with claimed state `BLOCKED`. The local UX matrix also reports zero root overflow across 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells. None of these checks executes or certifies hosted reapplication.

## Reapplication Entry Gates

All gates must pass:

1. The original rollback trigger has an identified, repaired, reviewed, and independently verified root cause.
2. `rollback_execution.md` records a successful real compensation and signed disabled state.
3. The exact target, commit, SQL hashes, workflow hash, application artifact, and approval record are frozen.
4. Remote history contains the base migration, identity migration, and compensation exactly once, and does not contain the reapplication version.
5. No unexpected migration, schema, policy, ownership, membership, grant, feature-control, data, or audit drift exists.
6. Every I1Q feature control is false.
7. Both capability roles pass the exact global role-contract allowlist.
8. The provider backup and tested restore reference remain valid.
9. Security approves the repaired candidate and exact reapplication window.
10. Monitoring and rollback roles are active.
11. A new forward compensation version is prepared and reviewed if a second rollback may be required after reapplication.

The current workflow's static history gates reject `reapply` on a fresh target. Certification still requires the first two operations to have completed in separate prior runs and the compensated state to have been independently observed before reapplication.

## Canonical Reapplication Procedure

### A0 - Freeze And Verify Compensated State

- Keep staging traffic contained.
- Capture the compensated migration history, schema, role graph, all-off control inventory, immutable data summaries, audit head, and deployment artifact.
- Compare them with the signed rollback result.
- Confirm the reapplication version is absent and the expected compensation version is present.
- Confirm the repaired application artifact is immutable and has passed secret-free CI.

Any mismatch stops the run.

### A1 - Dry Run And Diff

- Use the canonical protected workflow against the exact nonproduction target.
- Revalidate the target approval, backup, restore test, secret presence, and production denial.
- Produce a dry run and project-pinned diff.
- Require the diff to contain only the reviewed reapplication effects.
- Bind the result to exact commit and SQL hashes.

No apply follows an unexpected or unreviewed diff.

### A2 - Forward Reapplication

- Root dispatches the separate reapplication operation.
- Migration owner executes it through the canonical workflow.
- Release and Reliability observes but does not hold credentials.
- Upload evidence only after redaction succeeds.

No manual SQL, repair, reset, force, destructive reversal, or retry loop is allowed.

### A3 - Immediate Assertions

Pass only when:

- reapplication version appears exactly once in append-only history;
- the expected reapplication audit event appears exactly once;
- authenticated inherits only the identity-profile capability;
- identity-profile has only schema usage and exact execution on the caller-scoped identity function;
- application-runtime remains deny-all, unowned, unassigned, and browser-inaccessible;
- no other role membership, ownership, grant, or grant option exists for either capability role;
- every I1Q feature control remains false;
- every table remains present with enabled and forced RLS;
- immutable data summaries and audit continuity match expected append-only changes;
- no object outside the approved boundary changed.

### A4 - Hosted Identity And Isolation Tests

Run against the exact hosted target:

- authorized current actor receives only its own active database-owned profile;
- roleless, revoked, expired, anonymous, malformed, and wrong-project identities fail closed;
- caller-provided actor, email, WordPress identifier, or role cannot authorize;
- direct table, answer, restricted-source, audit, and feature-control access remains denied;
- actor context cannot cross sequential or concurrent pooled requests;
- application-runtime cannot be reached from a browser identity.

### A5 - Application Redeploy And Smoke

Only after A0 through A4 pass:

- deploy the repaired immutable application artifact through the canonical route;
- verify truthful liveness and readiness;
- run the complete required subset of the staging smoke matrix;
- hold a new monitored burn-in window;
- obtain fresh Security, UX/accessibility, database, red-team, and Release and Reliability verdicts.

Reapplication alone never reopens traffic.

## Expected Versus Actual

| Assertion | Expected | Actual hosted result |
| --- | --- | --- |
| Prior compensated state observed | Signed and exact | `NOT_RUN` |
| Dry run and approved diff | Reapplication only | `NOT_RUN` |
| Reapplication history | Appended once | `NOT_RUN` |
| Identity capability | Restored narrowly | `NOT_RUN` |
| Application runtime | Deny-all | `NOT_RUN` |
| Feature controls | All false | `NOT_RUN` |
| Immutable data | Preserved | `NOT_RUN` |
| Audit | One expected append | `NOT_RUN` |
| Hosted identity attacks | All pass | `NOT_RUN` |
| Application smoke | All required rows pass | `NOT_RUN` |
| Burn-in | Complete | `NOT_RUN` |

## Repeat And Second-Rollback Rule

The candidate SQL may be idempotent in a disposable database, but a canonical migration version is append-only and applied once. After reapplication, a later rollback requires a newly timestamped, reviewed forward compensation that depends on the reapplication version. The prior compensation file must not be edited, renamed, replayed as new history, or represented as a second rollback.

## Current Result

`REAPPLICATION: NOT_RUN / BLOCKED`

The available local proof is useful engineering evidence only. It does not establish preview recovery, staging recovery, application readiness, or release clearance.

============================================================
FILE: agents/release_reliability/rollback_execution.md
============================================================
# I1Q-1008A Rollback Execution

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `EXTERNAL ROLLBACK NOT_RUN`

This is the canonical execution record and runbook for the first staging rollback rehearsal. It is not authorization to run it.

## Rollback Semantics

The authorized datastore rollback model is forward compensation, not destructive reversal.

Rollback has separate layers:

| Layer | Canonical action | Preserved state |
| --- | --- | --- |
| Traffic | Stop new I1Q staging traffic or keep the service unavailable | Evidence and logs |
| Application | Redeploy the immutable last-known-good I1Q artifact through the canonical GitHub route | Deployment history |
| Database capability | Apply a new forward compensation through the canonical migration workflow | Schema, data, audit, and migration history |
| Identity capability | Remove browser inheritance of the caller-scoped identity profile | Role objects and records |
| Application runtime | Keep the application-runtime role deny-all and unassigned | No runtime capability exists to retain |
| Feature controls | Prove every I1Q feature control false | Flag history and audit evidence |
| Consumers | Keep student, public, STAT, Drills, extraction, physician enablement, and publication closed | Protected consumer state |

The expected compensated state intentionally retains the additive `i1q` schema and immutable records. It must not be described as an exact return to a schema-absent state.

## Current Candidate

The current first-cycle compensation candidate:

- revokes the identity-profile capability from the built-in authenticated role;
- removes I1Q schema, table, sequence, and function privileges from both I1Q capability roles;
- validates the resulting closed role graph;
- invokes the data-preserving disable function;
- appends one compensation version while preserving history;
- performs no drop, truncate, deletion, history repair, or feature enablement.

Existing reports describe successful repeated execution against disposable local PostgreSQL. Hosted compensation, provider restore, application rollback, and staging smoke are all `NOT_RUN`.

The hardened workflow now statically binds compensation to its exact operation, commit, SQL and workflow hashes, expected prehistory digest, and closed committed approval record. Its history gates require the base and identity versions, reject an already-applied compensation or reapplication, and prevent a later stage from collapsing into the compensation run. Evidence upload is permitted only after redaction succeeds. Focused tests and YAML/JSON parsing pass.

These controls reduce execution risk but are not rollback evidence. Real target prehistory capture, project-pinned schema diff review, provider backup verification, restore exercise, compensation, and disabled-state observation are all `NOT_RUN`.

For the exact candidate above, the corrected local estate passes 285 of 287 full-suite tests with 0 failures and 2 intentional database-target skips, 19 of 19 UI tests, 9 of 9 focused migration/workflow tests, and 20 of 20 evidence-validator files with claimed state `BLOCKED`. The local UX matrix reports zero root overflow across all reported workflow, state, mobile, and width-equivalent reflow cells. These results validate local candidate behavior only; they are not rollback execution evidence.

## Trigger Conditions

The release manager declares rollback for any of these conditions:

- authentication or authorization bypass;
- answer-bearing or restricted-source exposure;
- wrong-actor, wrong-assignment, or pooled actor-context leakage;
- unexpected migration history, schema, policy, role, or grant drift;
- any protected feature control enabled unexpectedly;
- audit append or chain failure;
- sustained readiness, database, or deployment failure during the release window;
- secret or protected-data exposure in application or evidence logs;
- failed security, accessibility, or dependent-system gate;
- inability to identify the exact deployed artifact or target;
- release manager or incident owner stop decision.

Security exposure, audit failure, migration drift, and rollback uncertainty are immediate triggers. No error-budget wait applies.

## Preconditions

Do not begin until all items pass:

1. The exact staging target, commit, application artifact, migration history, schema fingerprint, role graph, feature-control state, and audit head are recorded by digest.
2. The current deployment and last-known-good deployment are immutable and independently verified.
3. The first-cycle compensation file and workflow are part of the exact approved commit.
4. The compensation version is not already applied.
5. The provider backup and tested restore reference remain valid.
6. The canonical workflow, target protections, monitoring, and alert routing are operational.
7. Root, database owner, deployment owner, rollback operator, incident owner, security verifier, and Release and Reliability are present.
8. No secret, token, cookie, connection value, answer, source content, student data, or patient data appears in the execution record.

If the compensation version is already in history, stop. After a reapplication, another rollback requires a new reviewed forward compensation version. Reusing an applied file is not a new rollback.

## Execution Procedure

### R0 - Declare And Contain

- Incident owner records the trigger and start time using safe identifiers only.
- Deployment owner removes or blocks staging traffic through the approved route.
- Root freezes deployment, migration, and feature-control changes.
- Monitoring owner captures the pre-rollback dashboard and alert state.
- Release and Reliability confirms the target and evidence window.

Stop if containment changes any protected shared route or production system.

### R1 - Capture Before State

Capture and independently checksum:

- deployed artifact and configuration-version identifiers;
- migration list and append-only history;
- schema, object, policy, role, membership, ownership, and effective-grant inventories;
- all feature-control values;
- immutable-table row counts and content-hash summaries;
- audit head and compensation record count;
- application readiness and synthetic session result;
- dependent-system baseline;
- provider backup and restore-test references.

Any mismatch with the approved release baseline stops execution. Do not repair or normalize it during rollback.

### R2 - Application Rollback

- Deployment owner selects the immutable last-known-good application artifact.
- Root dispatches the canonical application rollback workflow.
- The provider promotes the existing artifact without rebuilding.
- Verify artifact digest, process startup, liveness, readiness, and safe unavailable or disabled behavior.

If application rollback fails, keep traffic contained and proceed to database compensation only when the incident owner and database owner agree that it reduces risk.

### R3 - Forward Database Compensation

- Database owner confirms the exact target, prehistory, backup, and compensation version.
- Root dispatches the canonical compensation operation.
- Migration owner executes only that forward operation through the protected workflow.
- No manual SQL, force, reset, repair, destructive reversal, or retry loop is allowed.
- Release and Reliability observes the run and records immutable identifiers and digests.

If the command or post-check fails, stop. Do not rerun until root cause and partial state are known.

### R4 - Post-Compensation Assertions

All assertions are mandatory:

- compensation version appears exactly once in append-only history;
- the compensation record and expected audit event each exist exactly once;
- every feature control is false;
- the authenticated role no longer inherits the identity-profile capability;
- both I1Q capability roles have no ownership or unexpected direct/effective privilege;
- application-runtime remains deny-all and browser-inaccessible;
- every I1Q table remains present with enabled and forced RLS;
- immutable data counts and content hashes match the before state;
- audit continuity is preserved with only expected appended events;
- answer and restricted-source direct reads remain denied;
- application readiness reports disabled or unavailable behavior truthfully;
- no protected dependent system changed.

The schema fingerprint is expected to change only for approved append-only history, audit, compensation, and grant-state effects. A semantic comparison, not naive byte equality, is required.

### R5 - Restore Exercise

Provider restore proof is separate from forward compensation:

- restore the approved backup only to the authorized disposable restore target;
- verify target identity before restore;
- compare migration history, schema, immutable data summaries, role graph, and audit head to the recorded backup state;
- destroy or quarantine the disposable restore target through the provider owner process after evidence capture.

Do not restore over staging as part of a normal successful compensation rehearsal. A real staging restore requires a separate incident decision.

### R6 - Post-Rollback Smoke And Closure

- Run the disabled-state subset of SM-01 through SM-22 in `staging_smoke_results.md`.
- Confirm unauthenticated and authenticated requests cannot reach governed workflows.
- Confirm monitoring, alerts, redaction, and dependent checks are healthy.
- Keep traffic contained until Security, database owner, and Release and Reliability sign the result.
- Record whether reapplication is authorized, blocked, or not requested.

## Failure Handling

- Never edit or repair migration history.
- Never drop the schema or protected records.
- Never reuse an applied compensation version for a later rollback.
- Never weaken RLS, grants, auth, or feature controls to make rollback pass.
- Never retry an unknown or partially applied operation.
- Preserve the complete redacted failure evidence and escalate to the database owner and incident owner.
- If redaction fails, do not upload the rejected artifact.

## Required Execution Record

| Field | Current value |
| --- | --- |
| Target class | `NONE` |
| Trigger | `NONE` |
| Application artifact before | `NONE` |
| Last-known-good artifact | `NONE` |
| Workflow run | `NONE` |
| Compensation applied | `NO` |
| Provider restore exercised | `NO` |
| Disabled state observed | `NO` |
| Post-rollback smoke | `NOT_RUN` |
| Independent signoff | `NONE` |

## Current Result

`ROLLBACK EXECUTION: NOT_RUN / BLOCKED`

Only source inspection and agent-reported disposable local proof exist. No result in this file supports a real preview or staging rollback claim.

============================================================
FILE: agents/release_reliability/staging_deployment_plan.md
============================================================
# I1Q-1008A Staging Deployment Plan

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `PLAN ONLY - NOT AUTHORIZED - NOT DEPLOYED`

Scope: authenticated, nonproduction, synthetic-only staging. Production and all student or consumer release actions are outside this ticket.

## Current Deployment Readiness

For this exact candidate, external I1Q provider registration, service identity assignment, staging host registration, canonical deployment, rollback rehearsal, and operational monitoring are `NOT_RUN`. The preview target remains unassigned.

The current direct startup is not a staging composition root:

- it binds only to loopback;
- it injects no canonical identity, static-access, logout, review-content, or finalization adapter;
- it creates the synchronous in-memory platform by default;
- the asynchronous PostgreSQL repository is not composed into the live service;
- the application-runtime database role remains intentionally deny-all;
- no trusted actor binder or pool-clearing proof exists;
- a local dependency-aware readiness contract now exists, but no deployed provider has exercised it.

The root Railway definition serves protected MissionMed HQ, not I1Q. Existing WordPress, CDN, Matrix, Arena, STAT, Drills, and Daily deployment routes must not be reused or extended by convenience.

## Hardened Preview Baseline

The preview workflow's locally actionable reliability controls now pass static review:

- source install, full tests, and evidence validation run in a separate secret-free job;
- preview secrets are step-scoped;
- an authorized target is closed-world bound to the operation, commit, SQL set, workflow, expected remote-history digest, and exact committed approval-record bytes;
- full remote-history hashing and operation-specific before/after gates prevent phase collapse;
- phase-aware tests accept only wholly unassigned or fully authorized target states;
- evidence upload requires a successful explicit redaction outcome;
- full local tests pass 285 of 287 with 0 failures and 2 intentional database-target skips;
- UI tests pass 19 of 19, focused migration/workflow tests pass 9 of 9, and workflow YAML and target JSON parse;
- evidence validation passes 20 of 20 with 0 errors and claimed state `BLOCKED`;
- the local UX browser matrix passes 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells with zero root overflow;
- the local UX simulation scores 8.21 against a 6.8 floor while retaining a release decision of `BLOCK`.

This closes the prior static workflow findings. It does not assign a target, create a provider backup, execute a restore, produce a project-pinned schema diff, run hosted attacks, or deploy staging.

## Required Role Separation

| Role | Responsibility | Must not do |
| --- | --- | --- |
| Root supervisor | Freeze candidate, authorize phase transitions, dispatch canonical workflows | Self-certify independent security or release evidence |
| Database owner | Approve target, history, backup, restore, roles, grants, and actor binder | Deploy application or weaken RLS |
| Migration owner | Execute reviewed forward operations through the canonical workflow | Run application traffic or manual SQL |
| Deployment owner | Register service and deploy the immutable application artifact | Apply database migrations or change protected shared routes |
| Security verifier | Run deployed attack matrices and issue an independent verdict | Build or repair the evaluated candidate in the same session |
| UX/accessibility verifier | Run staging browser, assistive-technology, and human gates | Relabel simulation as human evidence |
| Rollback operator | Execute the approved application rollback and forward compensation | Rewrite history or improvise a destructive rollback |
| Release and Reliability | Observe gates, reconcile evidence, run smoke, and issue the staging verdict | Hold secrets, deploy, migrate, or approve its own missing evidence |
| Independent red team | Attempt to disprove the final state claim | Begin before the candidate and evidence packet are frozen |

Builder and verifier must remain independent.

## Entry Criteria

Do not begin staging deployment until all conditions pass:

1. `preview_certification.md` is signed `CERTIFIED` for the exact candidate and run set.
2. The application has an owner-approved production-style composition root for the dedicated staging service.
3. Canonical authentication covers entry, token acquisition, expiry, refresh, revocation, logout, old-tab denial, CORS, CSRF, and provider outage.
4. Protected shared-auth findings are fixed or disproved against the exact deployed owner source through the protected-system process.
5. The PostgreSQL adapter is composed end to end with an approved least-privilege login or assumer, transaction-local actor binder, exact grant manifest, and pool context clearing.
6. All required governed workflows are implemented against durable storage.
7. A dedicated provider, service, build root, source policy, non-localhost host, TLS route, health and readiness routes, rollback selector, and owner are registered.
8. A canonical GitHub application deployment workflow exists, is commit-pinned, and is distinct from the preview migration workflow.
9. The exact immutable application artifact is built without deployment secrets and promoted without rebuilding.
10. Monitoring, alert routing, log redaction, backup, incident, rollback, and reapplication runbooks are active.
11. The current evidence validator reports zero errors and the closed artifact inventory matches the exact commit.
12. Security and UX/accessibility have no unresolved Critical or High finding for the exact candidate.
13. Student, public, STAT, Drills, transcript extraction, physician enablement, and automated publication controls are proven off.

Any failure returns the candidate to engineering. It is not a partial staging pass.

## Canonical Deployment Phases

### D0 - Freeze And Change Window

- Root freezes one clean commit and one immutable build artifact.
- Record only non-secret identifiers: commit, artifact digest, workflow digest, preview certification, approvers, planned window, and rollback artifact.
- Confirm no active Git operation, worktree drift, migration drift, stale Matrix warning, or protected runtime change.
- Freeze unrelated changes for the deployment window.
- Open an incident channel and assign release, deployment, database, security, monitoring, and rollback roles.

Exit evidence: signed release manifest and role roster.

### D1 - Secret-Free Build And Verification

- Check out the exact approved commit.
- Install dependencies reproducibly with lifecycle scripts disabled unless independently approved.
- Run syntax, unit, API, identity, security, UI, accessibility-static, migration-static, workflow, and evidence tests.
- Build the dedicated I1Q artifact from the I1Q build root, not the repository root.
- Generate a software and file inventory and artifact digest.
- Scan the artifact for credentials, tokens, connection strings, protected answers, restricted source content, and production data.
- Sign or attest the artifact and store it in the canonical artifact registry.

Exit gate: zero failures, zero unexplained skips, zero evidence-validator errors, and a clean artifact scan.

### D2 - Dark Staging Registration

- Deployment owner registers the dedicated service through the approved provider route.
- Bind the exact artifact, dedicated staging host, TLS, runtime identity, datastore target, and monitoring destination in the protected provider configuration.
- Record configuration presence and version references only. Do not export values.
- Keep public, student, consumer, extraction, physician-enablement, and publication controls off.
- Do not register or modify WordPress, HQ, CDN, Matrix, Arena, STAT, Drills, or Daily routes in this phase.

Exit gate: service exists but receives no general traffic; artifact and configuration fingerprints match approval.

### D3 - Liveness, Readiness, And Dependency Checks

The service must expose separate semantics:

- Liveness proves only that the process can answer.
- Readiness fails unless identity, datastore, role profile, audit sink, feature-flag state, and required dependencies are healthy.

Verify:

- non-localhost TLS route and certificate;
- exact deployed commit and artifact digest in safe provenance output;
- no loopback-only binding;
- fail-closed startup when required protected configuration is absent;
- datastore connectivity through the approved runtime identity;
- all feature flags in the approved staging baseline;
- monitoring and deployment marker ingestion;
- no protected shared-system mutation.

Exit gate: liveness and readiness have distinct, correct results and no secret appears in response or logs.

### D4 - Authentication And Authorization Canary

Use only owner-provisioned synthetic identities. Run one authorized and one denial journey at a time.

- unauthenticated direct URL and static asset requests expose no protected interface or metadata;
- valid authorized identity reaches only its role-appropriate surface;
- expired, revoked, wrong-audience, wrong-role, anonymous, malformed, and missing sessions fail closed;
- logout invalidates the session and browser Back cannot reveal protected content;
- hostile origins fail CORS and CSRF checks;
- I1Q roles come only from database-owned membership rows;
- physician placeholder cannot establish medical authority;
- no browser identity can inherit the application-runtime database role.

Exit gate: the complete auth attack matrix passes and the security verifier signs the canary.

### D5 - Datastore And Workflow Canary

Run with synthetic data only:

- prove exact actor binding per transaction and actor clearing between pooled requests;
- run direct-grant, cross-actor, cross-assignment, answer, source, audit, and feature-flag denials;
- exercise every implemented governed workflow, including concurrency and idempotency;
- verify durable writes, immutable revision identity, audit continuity, and exact error behavior;
- verify the application uses PostgreSQL rather than in-memory state;
- confirm all dependent protected systems remain unchanged.

An internal-only test capability may be enabled only under a separate Root-approved flag record that identifies exact scope, window, owner, and automatic return to off. This packet does not grant that authority. Student and consumer controls never turn on.

Exit gate: complete smoke matrix passes, audit evidence is present, and every temporary internal-only control is returned to its approved terminal state.

### D6 - Security, UX, Accessibility, And Capacity Gates

- Run the deployed security attack matrices from trusted and hostile origins.
- Run all required workflows at the complete viewport matrix with long-content and failure fixtures.
- Run keyboard, screen-reader, zoom, reflow, text-spacing, forced-colors, and reduced-motion checks.
- Execute the approved human validation protocol only after its entry criteria pass.
- Run representative synthetic volume, concurrency, latency, restart, and connection-pool tests.
- Verify redacted logs, rate controls, alerts, dashboards, and on-call delivery.

Exit gate: no Critical or High finding, all specified thresholds pass, and independent verdicts bind to the exact artifact.

### D7 - Rollback And Reapplication Rehearsal

- Execute application rollback and database compensation as separate controlled actions.
- Observe and sign the disabled state.
- Verify data, immutable history, audit chain, migration history, and protected dependents are preserved.
- Reapply only after the defect is fixed and the reapplication entry gates pass.
- Re-run D3 through D6 at the required scope.

Exit gate: `rollback_execution.md` and `reapplication_results.md` contain real staging evidence and both are signed pass.

### D8 - Burn-In And Verdict

- Hold a monitored staging burn-in for at least 24 continuous hours after the last deployment, rollback, reapplication, or configuration change.
- Run a synthetic authenticated journey at least every five minutes during burn-in.
- Review deploy, auth, permission, database, audit, feature-flag, frontend, latency, and backup signals.
- Freeze the evidence window and obtain fresh Security, UX/accessibility, database, red-team, and Release and Reliability verdicts.

Exit gate: all evidence is complete, redacted, checksummed, independently verified, and bound to the exact staging artifact.

## Stop Conditions

Stop immediately for any target mismatch, unexpected migration history, schema drift, role-graph drift, enabled protected control, authentication bypass, answer or restricted-source exposure, audit failure, secret exposure, stale Matrix warning, provider ambiguity, missing rollback, redaction failure, unexplained test skip, or unexpected command output.

Do not retry a failed migration or deployment action until the exact cause is understood and the authorized owner issues a new run decision.

## Current Result

`STAGING DEPLOYMENT: NOT_RUN / BLOCKED BEFORE D0`

The product candidate and corrected local evidence estate are pinned and locally green within their stated boundaries. Preview is not certified: target assignment, canonical deploy, hosted security and accessibility verification, monitoring, rollback, and staging execution remain external `NOT_RUN` gates.

============================================================
FILE: agents/release_reliability/staging_release_verdict.md
============================================================
# I1Q-1008A Staging Release Verdict

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Verdict date: 2026-07-15

## Verdict

`BLOCK - NOT CERTIFIED FOR PREVIEW, STAGING, OR INTERNAL PRODUCTION`

Highest defensible result: `LOCAL ENGINEERING CANDIDATE WITH A TRUTHFUL BLOCKED EVIDENCE STATE`.

No I1Q-1008A State A, B, C, or D is certified by Release and Reliability. No migration, deployment, feature-control change, environment action, external-service action, or production action is authorized by this packet.

## Scope Examined

- MissionMed OS boot chain, current mission, product passport, DR-006, MR-078A, MR-078B, MR-079, and Critical Systems Contract
- exact product candidate `fd7ddcd7688a0fc89cc4fc1320806220221046ae`
- fail-closed preview target and workflow candidate
- base, identity, compensation, and reapplication SQL candidates
- database role separation and effective-privilege assertions
- application identity, request-integrity, server, repository, UI, and readiness contracts
- full and focused local tests
- current evidence-validator result
- root staging-closure reports
- Herschel, Lorentz, Security, UX/accessibility, and Avicenna reports
- Darwin and independent red-team external review status

## Evidence Summary

| Evidence | Result | Classification |
| --- | --- | --- |
| Full local Node suite | 287 total, 285 passed, 0 failed, 2 intentional database-target skips | Direct local synthetic proof |
| UI suite | 19 of 19 passed | Direct local UI proof |
| Focused migration/workflow suite | 9 of 9 passed | Direct local static proof |
| Workflow YAML and target JSON parse | Passed | Direct local syntax proof |
| Hardened preview controls | Secret-free validation, step-scoped secrets, exact approval/candidate/history binding, phase gates, and success-only upload present | Direct local static proof |
| Local UX browser matrix | 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells; zero root overflow | Direct local browser proof |
| Local UX simulation | 8.21 against a 6.8 floor; release decision `BLOCK` | Local simulated proof; not staging certification |
| Base disposable PostgreSQL rerun | 13 of 13 passed | Fresh root-reported disposable local proof |
| 1008A runtime PostgreSQL rerun | 1 of 1 passed | Fresh root-reported disposable local proof |
| Evidence validator | 20 of 20 files, 0 errors, claimed state `BLOCKED` | Direct local integrity proof |
| Preview target | Unassigned | Fail-closed source state |
| Preview workflow run | `NOT_RUN` | External preview gate |
| Provider backup and restore | `NOT_RUN`; authority not assigned | External recovery gate |
| Authenticated non-localhost staging deployment | `NOT_RUN` | External staging gate |
| Monitoring, rollback, reapplication, and burn-in | `NOT_RUN` | External operational gates |

The two skipped default-suite tests are exactly the database-target lanes. Their separate disposable reruns are useful local proof, but they are not hosted preview or staging proof.

## What The Candidate Gets Right Locally

- Identity is fail-closed, versioned, actor-bound, and rejects browser-supplied roles.
- Request writes enforce trusted-origin and session-bound integrity contracts.
- Static access, logout, and dependency-aware readiness now have local fail-closed interfaces.
- Stale draft writers are rejected using a client-observed precondition.
- The base database candidate is additive, deny-by-default, and forces RLS.
- The identity-profile capability and application-runtime role are separate.
- The latest migration checks role memberships, ownership, global direct privileges, and the exact allowlist before completing.
- Pre-existing enabled safety controls are rejected.
- Application runtime remains deny-all and browser-inaccessible.
- Compensation is forward-only and preserving.
- Reapplication restores only the identity profile while all controls remain off.
- The hardened preview workflow closes the prior local RR-02 findings for secret isolation, target and approval binding, candidate hashes, complete prehistory digest, phase safety, and redaction-gated upload.
- Evidence validation now succeeds only with the truthful claimed state `BLOCKED`.
- The UI suite passes 19 of 19, and the corrected local UX matrix reports zero root overflow across every reported workflow, state, mobile, and width-equivalent reflow cell.

These properties clear continued local engineering and owner review only.

## Blocking Findings

### RR-01 - No Authorized Preview Target

Severity: `RELEASE BLOCKER`

The target contract remains unassigned. There is no approved nonproduction target, migration history, target fingerprint, backup, restore test, protected workflow environment, secret authority, or preview run.

Closure evidence: P0 through P7 in `preview_certification.md` pass for one exact target and candidate.

### RR-02 - Static Workflow Hardening Passed; External Operations NOT_RUN

Severity: `STATIC CONTROL PASS / RELEASE EVIDENCE BLOCKER`

Root closed the locally actionable RR-02 findings. Source validation now runs in a separate secret-free job; preview secrets are step-scoped; an authorized target is bound to the exact operation, commit, four SQL hashes, workflow hash, expected complete remote-history hash, and exact bytes and closed content of a separately committed approval record. Preflight recomputes the complete history digest, phase-aware target tests support only wholly unassigned or fully authorized states, operation-specific history gates prevent collapse, and artifact upload requires a successful explicit redaction outcome.

Focused tests pass 9 of 9, workflow YAML and target JSON parse, and the evidence validator passes 20 of 20 with claimed state `BLOCKED`.

Remaining RR-02 evidence gaps are environment-backed:

- the target remains unassigned and no protected workflow run exists;
- no project-pinned schema diff has been captured, reviewed, or approved;
- no complete hosted RLS, persona, answer/source isolation, actor-switching, or pool-clearing attack suite has run;
- backup and restore fields have no actual provider backup, restore authority, or observed restore execution behind them;
- no validate, apply, compensate, reapply, redaction, or uploaded evidence artifact exists from a real target.

Closure evidence: assigned authorized target, actual backup and independently observed restore proof, approved schema diff, successful remote validate run, separate apply/compensate/reapply runs, hosted attack results, and redacted immutable run artifacts.

### RR-03 - Authenticated Datastore-Backed Staging Deployment NOT_RUN

Severity: `RELEASE BLOCKER`

No dedicated provider, service, deployment workflow, non-localhost host, TLS route, build identity, or rollback selector exists. Direct startup remains loopback and does not compose the canonical identity adapters or PostgreSQL repository. The application-runtime role and actor binder remain intentionally unavailable.

Closure evidence: all entry criteria and D0 through D8 in `staging_deployment_plan.md` pass.

### RR-04 - Protected Authentication Authority And Runtime Findings Remain Open

Severity: `HIGH PROTECTED-SYSTEM GATE`

Protected-owner attestation for the global auth authority and shared-runtime behavior is `NOT_RUN` for this release packet. Shared-auth expiry, configured signing, credentialed origin, handoff replay, route registration, refresh, revocation, and logout behavior require the protected owner process or exact runtime disproof. Local adapter tests cannot close shared-runtime findings.

Closure evidence: owner-ratified authority, protected-source repair or disproof, dependent-consumer regressions, and deployed I1Q auth attacks.

### RR-05 - Hosted Datastore And RLS Verification NOT_RUN

Severity: `RELEASE BLOCKER`

Disposable PostgreSQL passed, but hosted project defaults, migration history, auth claim propagation, custom-schema exposure, role graph, grant behavior, actor binding, pool clearing, backup, restore, compensation, and reapplication are untested.

Closure evidence: certified preview apply, full hosted attack matrix, observed compensation, observed disabled state, separate reapplication, and independent database signoff.

### RR-06 - Independent Vetoes Are Not Cleared

Severity: `RELEASE BLOCKER`

The filed Security verdict is `VETO`. The corrected UX local estate reports 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells with zero root overflow, plus a simulated score of 8.21 against a 6.8 floor; its release decision remains `BLOCK`. Darwin's local performance review and the Independent Red Team's local review are filed, while their hosted/external environment tests remain `NOT_RUN`.

Closure evidence: exact-candidate re-evaluations with no unresolved Critical or High finding, completed human protocol, and independent red-team clearance.

### RR-07 - Monitoring And Recovery Are Design Only

Severity: `RELEASE BLOCKER`

No telemetry sink, dashboard, alert route, synthetic monitor, on-call exercise, application rollback, hosted compensation, provider restore, reapplication, or burn-in exists.

Closure evidence: `monitoring_plan.md`, `rollback_execution.md`, and `reapplication_results.md` each contain real staging pass evidence.

### RR-08 - Candidate Pinned; External Release Artifacts NOT_RUN

Severity: `STATIC IDENTITY PASS / EXTERNAL EVIDENCE GATE`

The evaluated product candidate is pinned to commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae`, and the corrected evidence estate validates 20 of 20 with claimed state `BLOCKED`. A canonical staging build, deployment identity, and immutable external run-artifact set remain `NOT_RUN`.

Closure evidence: immutable staging build artifact, closed deployment manifest, external run artifacts, and independent checksum verification against the pinned commit.

## State Decision

| State | Decision | Reason |
| --- | --- | --- |
| State A | `NOT CERTIFIED` | Strong local identity and exact-candidate evidence exist, but canonical lifecycle, shared-auth closure, and fresh independent security clearance remain open. |
| State B | `NOT CERTIFIED` | No authorized preview apply, hosted RLS attacks, backup/restore, compensation, or reapplication exists. |
| State C | `NOT CERTIFIED` | No authenticated non-localhost staging service, smoke, monitoring, rollback, accessibility, or burn-in exists. |
| State D | `OUT OF SCOPE AND BLOCKED` | Production and student release are prohibited; prerequisite external states are `NOT_RUN`. |

## Authorized Next Scope

The candidate may:

- remain local;
- receive code, workflow, database, security, UX, and reliability review;
- repair local implementation and evidence defects;
- prepare owner decision records and protected environment registration.

The candidate may not:

- dispatch the current preview workflow;
- apply, compensate, reapply, or repair a hosted migration;
- deploy an application;
- change a feature control;
- alter a protected shared system;
- claim preview, staging, internal production, medical approval, student release, STAT activation, or Drills activation.

## Canonical Closure Order

1. Independently attest the exact pinned candidate and its closed evidence manifest.
2. Canonically register the hardened preview workflow and freeze its exact commit.
3. Assign the synthetic-only target, backup, restore test, roles, and protected workflow environment.
4. Certify preview apply, hosted RLS, compensation, observed disabled state, and separate reapplication.
5. Complete the authenticated PostgreSQL-backed application composition and protected auth closure.
6. Register and deploy the dedicated staging service through the canonical route.
7. Run the complete smoke, security, UX/accessibility, capacity, monitoring, rollback, and burn-in gates.
8. Obtain fresh independent Security, database, UX/accessibility, red-team, and Release and Reliability verdicts.

## Signoff

| Role | Current decision |
| --- | --- |
| Release and Reliability | `BLOCK` |
| Security | Filed `VETO`; fresh review required |
| UX/accessibility | Corrected local matrix and simulation filed; release decision remains `BLOCK` |
| Database owner | No hosted certification |
| Deployment owner | No staging deployment |
| Independent red team | Local report filed; external staging clearance `NOT_RUN` |
| Root release decision | Not supplied in this agent packet |

## Final Direction

Keep every feature control off. Preserve the candidate as local synthetic engineering work. Do not claim preview or staging until the unavailable external evidence exists and every canonical gate above passes.

============================================================
FILE: agents/release_reliability/staging_smoke_results.md
============================================================
# I1Q-1008A Staging Smoke Results

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Observed: 2026-07-15

Overall status: `EXTERNAL PREVIEW AND STAGING SMOKE NOT_RUN`

No migration, deployment, feature-flag change, provider action, external-service action, authenticated staging request, or production request was performed by this agent.

## Evidence Boundary

| Evidence | Target | Directly run by this agent | Release meaning |
| --- | --- | --- | --- |
| Full Node test suite | Local worktree | Yes | Local engineering signal only |
| Focused migration/workflow contract tests | Local worktree | Yes | Static candidate signal only |
| Evidence validator | Local worktree | Yes | Packet-integrity gate only |
| Base disposable PostgreSQL suite | Prior isolated synthetic database | No; inspected agent reports | Agent-reported local proof only |
| 1008A role/compensation/reapply PostgreSQL suite | Prior isolated synthetic database | No; inspected agent reports | Agent-reported local proof only |
| Authorized preview apply and RLS attacks | Real preview | No | External preview evidence `NOT_RUN` |
| Authenticated application smoke | Real staging | No | External staging evidence `NOT_RUN` |

## Direct Local Results

| Check | Result |
| --- | --- |
| Full local Node suite | `PASS`: 287 total, 285 passed, 0 failed, 2 intentional database-target skips |
| UI suite | `PASS`: 19 of 19 |
| Focused 1008A migration/workflow suite | `PASS`: 9 of 9, 0 failed, 0 skipped |
| Evidence validator | `PASS`: 20 of 20 files, 0 errors, claimed state `BLOCKED` |
| Preview workflow YAML parse | `PASS` |
| Preview target JSON parse | `PASS` |
| Git whitespace validation | `PASS`: no errors in the tracked worktree diff |
| Local UX browser matrix | `PASS`: 187 workflow, 176 state, 68 mobile, 66 width-equivalent reflow cells; zero root overflow |
| Local UX simulation | 8.21 against a 6.8 floor; release decision `BLOCK` |

The full suite's database lanes require explicit disposable database targets. A default-suite skip is not a preview pass and is not silently counted as one.

## Hardened Workflow Static Result

`PASS, LOCAL STATIC CONTROL ONLY`:

- secret-free source install, tests, and evidence validation are separated from the preview job;
- preview secrets are scoped by step;
- authorized target state binds exact operation, commit, four SQL files, workflow, expected remote-history digest, and exact committed approval-record bytes;
- complete history hashing and operation-stage gates are fail-closed;
- target tests support only wholly unassigned or fully authorized phases;
- artifact upload is conditional on successful explicit redaction.

The target remains unassigned. Preview apply, schema-diff review, hosted attacks, provider backup/restore execution, and staging smoke are all external `NOT_RUN` gates.

## Inspected Disposable Database Reports

Existing root and Avicenna reports state that earlier isolated synthetic PostgreSQL runs passed:

- base migration and attack estate: 13 of 13;
- 1008A role separation, compensation, and reapplication estate: 1 of 1;
- repeated SQL application preserved role boundaries, history, audit idempotence, and all-off feature flags.

Those runs used disposable local PostgreSQL, not an authorized hosted target. They did not prove provider defaults, Supabase auth claim propagation, project migration history, connection-pool actor clearing, backup restoration, or deployed application behavior. This agent did not rerun a migration because the assignment expressly prohibited migration execution.

## Smoke Matrix

| ID | Required smoke | Evidence required | Current result |
| --- | --- | --- | --- |
| SM-01 | Exact deployed commit and artifact | Canonical build and deployment identifiers | `NOT_RUN` |
| SM-02 | TLS route and non-localhost reachability | Registered staging host and certificate result | `NOT_RUN` |
| SM-03 | Liveness versus readiness | Separate route results with dependencies configured and removed | `NOT_RUN` |
| SM-04 | Unauthenticated shell and static denial | Browser and direct HTTP evidence with no protected leakage | `NOT_RUN` |
| SM-05 | Canonical authorized session | Synthetic authorized identity journey | `NOT_RUN` |
| SM-06 | Expired, revoked, malformed, anonymous, and wrong-role denial | Full deployed auth attack matrix | `NOT_RUN` |
| SM-07 | Refresh, logout, old-tab, and browser Back denial | Two-session browser journey | `NOT_RUN` |
| SM-08 | Trusted-origin and hostile-origin behavior | CORS and CSRF matrix | `NOT_RUN` |
| SM-09 | Database-owned role resolution | Hosted caller-scoped identity RPC evidence | `NOT_RUN` |
| SM-10 | Runtime role separation | Exact deployed role and effective-grant inventory | `NOT_RUN` |
| SM-11 | Actor binding and pool clearing | Sequential and concurrent actor-switch tests | `NOT_RUN` |
| SM-12 | Forced RLS on every I1Q table | Hosted catalog inventory and negative queries | `NOT_RUN` |
| SM-13 | Answer and restricted-source isolation | Direct and API attack evidence | `NOT_RUN` |
| SM-14 | All governed workflows | Durable synthetic end-to-end task matrix | `NOT_RUN` |
| SM-15 | Stale-write and idempotency behavior | Two-session and retry tests | `NOT_RUN` |
| SM-16 | Exact revision, release, and audit integrity | Immutable hash and audit-chain assertions | `NOT_RUN` |
| SM-17 | Feature-flag baseline | Closed flag inventory with protected controls off | `NOT_RUN` |
| SM-18 | Security headers, caches, and rate controls | Deployed response and edge evidence | `NOT_RUN` |
| SM-19 | Responsive and accessibility matrix | Automated, manual, assistive-technology, and human results | `NOT_RUN` |
| SM-20 | Performance and capacity | Synthetic load, latency, connection, restart, and recovery evidence | `NOT_RUN` |
| SM-21 | Monitoring and alert delivery | Dashboard, alert, acknowledgment, and redaction evidence | `NOT_RUN` |
| SM-22 | Dependent protected systems | Owner-approved regression evidence or explicit unchanged proof | `NOT_RUN` |
| SM-23 | Application rollback | Canonical staging rollback run and post-smoke | `NOT_RUN` |
| SM-24 | Database compensation | Separate hosted compensation run and disabled-state proof | `NOT_RUN` |
| SM-25 | Reapplication | Separate hosted reapply run and full post-smoke | `NOT_RUN` |

## Agent Verdicts Inspected

- Security's latest filed verdict is `VETO` and requires a fresh review after candidate freeze and hosted evidence.
- UX/accessibility's corrected local evidence covers 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells with zero root overflow; its 8.21 simulated score exceeds the 6.8 floor, while its release decision remains `BLOCK`.
- Avicenna reports major local repairs and local PostgreSQL proof, while retaining external and integration blockers.
- Herschel reports no canonical I1Q service, staging route, or provider registration.
- Lorentz defines candidate contracts but does not authorize a target, role binding, migration, or rollback.
- Darwin external review is `NOT_RUN`.
- Independent red-team review is `NOT_RUN`.

Any filed veto or block must be re-evaluated against the exact pinned candidate. Passing local repair evidence does not certify external staging behavior.

## Honest Result

`STAGING SMOKE: BLOCKED / NO STAGING TARGET`

The only direct passing evidence is local. The local evidence validator is a separate mandatory gate and its final result is recorded above. No preview or staging row in this document may be changed to `PASS` without an immutable external evidence reference for the exact deployed candidate.

============================================================
FILE: agents/security/answer_isolation_results.md
============================================================
# I1Q-1008A Answer And Source Isolation Results

## Verdict

**LOCAL SYNTHETIC PASS. STAGING NOT RUN. NO STAGING CLEARANCE.**

The evaluated design keeps answer-bearing records and restricted source references behind separate storage, purpose-scoped access, exact assignment checks, and closed-world API projections. Local application and PostgreSQL attacks passed. A concurrent identity-capability migration grants no table access and only one identity RPC, which preserves local structural isolation. There is no approved application runtime grant surface, preview apply, or deployed staging path, so this evidence cannot establish real-environment isolation.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

## Protected Material

This assessment treats the following as protected:

1. Correct answer selections and answer-key records.
2. Explanations and rationales when their presence would reveal the answer before finalization.
3. Restricted source references, object locations, private transcript references, and privacy-controlled excerpts.
4. Review payloads that deliberately include protected content for an authorized assigned reviewer.
5. Server-only STAT answer maps and post-finalization channel artifacts.

No raw source material was read during this assessment.

## Expected Isolation Boundaries

| Boundary | Required behavior |
| --- | --- |
| Storage | Answers and restricted source references reside outside generic item and source rows. |
| SQL grants | Generic runtime and managed roles cannot select protected tables directly. |
| RLS | Forced RLS denies direct access even if application authorization fails. |
| Purpose reader | A definer reader requires exact actor, role, accepted assignment, purpose, and immutable revision. |
| API projection | Generic list, detail, search, dashboard, and export responses omit protected fields. |
| Review API | Protected content appears only for the exact accepted review task and uses `no-store`. |
| Finalization | Answer-bearing context is derived on the server and bound to actor, session, release, channel, and feature flag. |
| Consumer artifact | Pre-answer Class A payload omits answers and explanations; answer map remains server-only. |
| Browser and edge | Protected responses are not cached, logged, stored, indexed, or exposed across origins. |
| Evidence | Tests identify exact commit and environment and never promote a local result to staging. |

## Local Results

| ID | Adversarial control | Result | Evidence and limit |
| --- | --- | --- | --- |
| ISO-L01 | Generic API item projection contains no answer fields | `SYNTHETIC PASS` | Local API and contract tests |
| ISO-L02 | Generic API source projection contains no restricted locations | `SYNTHETIC PASS` | Local sanitization tests |
| ISO-L03 | Review content requires accepted assignment for exact actor and role | `SYNTHETIC PASS` | Local protected-read tests |
| ISO-L04 | Review content is bound to exact immutable revision hash | `SYNTHETIC PASS` | Local stale-revision attacks |
| ISO-L05 | Wrong purpose cannot invoke protected reader | `SYNTHETIC PASS` | Local repository and PostgreSQL tests |
| ISO-L06 | Direct select from answer table is denied in modeled role matrix | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L07 | Direct select from restricted-reference table is denied in modeled role matrix | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L08 | Caller cannot smuggle answer or source fields through nested, encoded, case, or separator variants | `SYNTHETIC PASS` | Local Class D encoding matrix |
| ISO-L09 | Pre-finalization channel cannot receive answer-bearing payload | `SYNTHETIC PASS` | Local adapter and artifact tests |
| ISO-L10 | Finalization context cannot be caller-supplied | `SYNTHETIC PASS` | Local server-context tests |
| ISO-L11 | Audit rows are database-derived and immutable | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L12 | Public bundle contains no protected answer-map or source-location labels | `LOCAL STATIC PASS` | Token scan only, not dynamic browser proof |
| ISO-L13 | Evidence file checksums match current manifest | `LOCAL PASS` | Final independent validator passes 20 of 20 expected files with zero errors and claimed state `BLOCKED`; this is not deployed evidence binding |
| ISO-L14 | In-flight identity-capability role receives no answer, source, audit, or workflow table grant | `LOCAL STATIC AND APPLY PASS` | Disposable PostgreSQL only; role model remains unratified |

## Deployed Attack Matrix

Every row below requires an authenticated staging host, preview database, deployed edge, or operational telemetry. None was available.

| ID | Attack | Required result | Staging status |
| --- | --- | --- | --- |
| ISO-S01 | Anonymous API requests answer-bearing item fields | `401` or `403`, no protected fields, no existence oracle | `NOT RUN` |
| ISO-S02 | Authenticated low-privilege user enumerates item IDs | Only authorized generic fields, no answer or restricted source | `NOT RUN` |
| ISO-S03 | Reviewer requests another reviewer's protected assignment | Denied with no content or metadata leak | `NOT RUN` |
| ISO-S04 | Reviewer reuses an assignment against another revision | Denied as revision mismatch | `NOT RUN` |
| ISO-S05 | Reviewer changes role or purpose in request | Server ignores caller authority and denies | `NOT RUN` |
| ISO-S06 | User invokes answer-reader function directly | Database permission denied | `NOT RUN` |
| ISO-S07 | User selects answer or restricted-source table directly | Database permission denied and RLS denies | `NOT RUN` |
| ISO-S08 | Pooled connection changes from authorized reviewer to another actor | No residual actor, purpose, assignment, or row visibility | `NOT RUN` |
| ISO-S09 | Pre-finalization export or STAT pack is generated | No answer, explanation, rationale, or answer map | `NOT RUN` |
| ISO-S10 | Post-finalization request fabricates release or channel | Denied unless server-authorized exact context exists | `NOT RUN` |
| ISO-S11 | Client inspects HTML, JavaScript, source maps, network cache, or browser storage | No protected data outside authorized response memory | `NOT RUN` |
| ISO-S12 | Shared cache or CDN replays reviewer response | No caching; no cross-user response reuse | `NOT RUN` |
| ISO-S13 | Application or proxy error logs a protected payload | Redacted event only | `NOT RUN` |
| ISO-S14 | Access logs capture source location or query content | Sensitive values absent or irreversibly redacted | `NOT RUN` |
| ISO-S15 | Browser sends protected URL in a referrer | No referrer disclosure | `NOT RUN` |
| ISO-S16 | Hostile origin reads reviewer content with credentials | CORS blocks response and CSRF blocks mutation | `NOT RUN` |
| ISO-S17 | User follows a restricted source object location directly | Source system independently denies access | `NOT RUN` |
| ISO-S18 | Search index, monitoring payload, or analytics event receives protected content | Protected fields excluded | `NOT RUN` |
| ISO-S19 | Feature flag is omitted or malformed | Answer-bearing consumer remains disabled | `NOT RUN` |
| ISO-S20 | Deployment commit differs from evidence manifest | Release gate fails | `NOT RUN` |

## STAT Sealed-Pack Invariant

The reviewed local contract preserves the required split:

1. The server-safe pre-answer artifact is Class A and omits answers and explanations.
2. The frozen STAT `dataset_questions` projection remains a separate nine-column server dataset.
3. `answer_map` remains server-only and unavailable before finalization.
4. `question_metadata` identity uses composite `dataset_version` plus `question_id` semantics.
5. A consumer feature flag must be exact, server-owned, and false by default.

These are locally tested contract properties. They are not evidence that any deployed consumer currently enforces them.

## Residual Risks And Open Gates

1. The in-flight identity resolver passes synthetic tests but is uncommitted, unratified, unwired, and not aligned with the concurrent proposed closed bootstrap schema. Protected review authorization is not connected to an authoritative deployed identity.
2. The in-flight database role exposes only an identity RPC to the broad `authenticated` role. No approved application runtime principal or workflow grant surface exists, so direct-table isolation is not proven under real privileges.
3. The non-demo local shell now fails closed unless an explicit static-access adapter grants the request. The canonical edge and cookie composition, deployed static cache behavior, and source-map exposure remain untested.
4. Review content intentionally exposes answers to an authorized assigned reviewer. Cache, log, browser storage, and proxy isolation for that response are untested.
5. The finalization resolver is not wired to a real release datastore or canonical session.
6. No staging log, CDN, proxy, browser, source-object, or monitoring inspection has occurred.
7. No rate control has been demonstrated for high-volume enumeration of item or assignment IDs.
8. Local policy-test grants deliberately differ from production grants. The latest candidate now separates the browser-safe profile capability from a deny-all application role, but no approved application grants or preview catalog evidence exists.

## Isolation Exit Criteria

Security will clear answer and source isolation only after all deployed rows above pass against the exact staging commit and actual runtime role, with redacted evidence. A failure must keep all consumer and student-content flags off. No answer-bearing release may proceed on local evidence alone.

============================================================
FILE: agents/security/auth_attack_matrix.md
============================================================
# I1Q-1008A Authentication And Application Attack Matrix

## Verdict

**AUTHENTICATION CLEARANCE DENIED.** Local request guards and the in-flight identity adapter behave well under their synthetic tests. The proposed adapter and personas are uncommitted, unratified, unwired, and not contract-aligned with the concurrent Lorentz closed schema. Canonical identities, the complete session lifecycle, and an authenticated staging host remain absent. Every staging-only test remains `NOT RUN`.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

Evaluated in-flight adapter SHA-256: `b1e0dd4c0c7f3961328a58809b5d4e7405d9e8c3a07599a5fac5d5823f06b039`

## Interpretation

`PASS` below always includes its scope. A `LOCAL PASS` is not a staging pass. `SOURCE GAP` identifies a tracked-source condition that must be reproduced against the protected deployed commit before exploitability is claimed. `NOT RUN` never implies success.

## Identity, Session, And Access Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Anonymous client requests `/` | Authenticated internal app denies or redirects before serving its shell | `LOCAL PASS`: non-demo server returns `401` without an explicit static-access adapter | `NOT RUN` | Compose and verify the canonical gate across the full staging host |
| AUTH-02 | Anonymous client requests `/app.js` | Deny or redirect before serving internal assets | `LOCAL PASS`: non-demo server returns `401`; an explicit synthetic gate is required for `200` | `NOT RUN` | Verify assets, source maps, and edge cache behavior in staging |
| AUTH-03 | Anonymous client requests protected dashboard API | Return `401` with no protected data | `SYNTHETIC PASS`: returned `401` | `NOT RUN` | Repeat on staging |
| AUTH-04 | Valid canonical user signs in | Stable actor identity and authorized role are established | In-flight adapter `LOCAL PASS` with synthetic callbacks; no startup composition or canonical user | `NOT RUN` | State A blocker |
| AUTH-05 | Invalid credentials or failed identity provider login | No I1Q session or shell access | No integrated login fixture | `NOT RUN` | State A blocker |
| AUTH-06 | Direct protected API request without resolver context | Fail closed | `LOCAL PASS` in API tests | `NOT RUN` | Repeat on staging |
| AUTH-07 | Resolver returns `validated: false` | Fail closed | `LOCAL PASS` | `NOT RUN` | Repeat with canonical adapter |
| AUTH-08 | Resolver omits actor, session, role, freshness metadata, or identity envelope | Fail closed | `LOCAL PASS`: the server now requires the complete identity envelope and freshness inputs | `NOT RUN` | Repeat through the ratified canonical adapter |
| AUTH-09 | Expired I1Q resolver context | Return `401`; no refresh by trusting stale context | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| AUTH-10 | HQ session has absent, invalid, or expired expiry | Reject session before I1Q | `SOURCE GAP`: tracked HQ reader warns then returns payload | `NOT RUN` | High gate; fix or disprove in deployed runtime |
| AUTH-11 | Revoked I1Q resolver context | Return `401` | `LOCAL PASS` for injected `revoked` marker | `NOT RUN` | Authoritative provider revocation remains unproven |
| AUTH-12 | Provider session revoked while HQ cookie remains | Revalidation or bounded freshness rejects continued access | No end-to-end fixture | `NOT RUN` | State A blocker |
| AUTH-13 | Wrong token issuer | Reject before I1Q context creation | In-flight adapter `LOCAL PASS` | `NOT RUN` | Ratify issuer and repeat with canonical provider |
| AUTH-14 | Wrong token audience | Reject before I1Q context creation | In-flight adapter `LOCAL PASS` | `NOT RUN` | Ratify audience and repeat with canonical provider |
| AUTH-15 | Email-only identity is supplied | Reject; email is not canonical actor identity | In-flight adapter keys actor to verified UUID; no dedicated email-only vector | `NOT RUN` | Add an explicit negative fixture |
| AUTH-16 | Unknown external ID triggers generated actor UUID | Reject; never synthesize authority | In-flight adapter requires verified UUID equality; no generated fallback found | `NOT RUN` | Repeat with canonical binding |
| AUTH-17 | Disabled or deleted MissionMed user retains a session | Reject and terminate access | No canonical account-state fixture | `NOT RUN` | State A blocker |
| AUTH-18 | Caller submits a privileged role in token, body, or header | Ignore and use authoritative membership | In-flight adapter and route tests `LOCAL PASS` | `NOT RUN` | Repeat end to end |
| AUTH-19 | Resolver supplies an unknown role | Reject | `LOCAL PASS` | `NOT RUN` | Repeat end to end |
| AUTH-20 | Authoritative role is removed during active session | New requests lose permission within defined freshness bound | In-flight resolver queries a scoped role RPC per request; canonical revocation path absent | `NOT RUN` | State A blocker |
| AUTH-21 | Session ID is changed after authentication | Reject CSRF and session-bound operations | `LOCAL PASS` for session-bound CSRF | `NOT RUN` | Add fixation and rotation fixture |
| AUTH-22 | Attacker fixes a pre-login session | Rotate session at authentication boundary | No integrated login | `NOT RUN` | Required staging test |
| AUTH-23 | Signed WordPress handoff is replayed during validity window | Second exchange is rejected atomically | `SOURCE GAP`: nonce is emitted but no tracked HQ consumption found | `NOT RUN` | High gate |
| AUTH-24 | WordPress handoff is replayed after expiry | Reject | Source has age checking; no end-to-end test | `NOT RUN` | Required staging test |
| AUTH-25 | Handoff return target changes scheme or port on an allowed host | Accept only the canonical HTTPS origin and approved port | Tracked handoff validates host; full scheme and port behavior unproven | `NOT RUN` | Add redirect abuse tests |
| AUTH-26 | Signing configuration is missing at startup | Fail startup without serving traffic | `SOURCE GAP`: tracked HQ creates process-random fallback material | `NOT RUN` | Fail-closed configuration gate |
| AUTH-27 | HQ restarts with existing sessions | Intentional documented behavior; no silent identity drift | Runtime continuity untested | `NOT RUN` | Verify without exposing configuration |
| AUTH-28 | Canonical identity provider is unavailable | Fail closed, bounded error, no stale privilege escalation | In-flight callbacks fail closed locally; no integrated provider | `NOT RUN` | Required outage test |
| AUTH-29 | User invokes logout | Canonical session invalidated, cookie cleared, protected routes denied | `LOCAL CONTRACT AND UI PASS`: POST logout requires exact write integrity and an injected revocation adapter, returns `503` without one, and has no local-only fallback; the UI sends CSRF and clears in-memory state | `NOT RUN` | Wire and verify canonical provider and cookie revocation |
| AUTH-30 | Old browser tab operates after logout | API rejects; no cached protected response | `LOCAL SYNTHETIC PASS`: injected revocation causes the old bearer to fail on the next session request, and the initiating UI disables its workspace | `NOT RUN` | Repeat with real provider, cookie, browser cache, and a separate old tab |
| AUTH-31 | Injected resolver omits identity envelope or supplies wrong version, actor, active state, or revocation state | Server rejects before route execution | `SYNTHETIC PASS`: regression suite and independent wrong-version probe fail closed | `NOT RUN` | Repeat through canonical adapter |
| AUTH-32 | Adapter output is validated against the proposed closed bootstrap schema | Exact schema match with no unknown fields | `SOURCE GAP`: adapter adds top-level identity, issued time, and transport fields and supplies an empty CSRF value in bearer mode | `NOT RUN` | Reconcile and ratify one contract |
| AUTH-33 | Scoped role-profile RPC returns a mismatched identity contract version | Reject before role profile becomes authority | `LOCAL PASS`: source enforcement and independent negative probe return `identity_contract_version_mismatch` | `NOT RUN` | Add a committed regression and repeat against preview RPC |

## CSRF, Origin, CORS, And Browser Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| WEB-01 | Mutation omits CSRF token | Return `403`; no state change | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-02 | Mutation supplies wrong CSRF token | Return `403`; no state change | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-03 | Valid CSRF token from another session | Return `403` | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| WEB-04 | Mutation comes from untrusted Origin | Return `403`; no state change | `LOCAL PASS` in I1Q resolver model | `NOT RUN` | Canonical origin source remains unproven |
| WEB-05 | Origin header is absent on browser mutation | Apply documented fail-closed policy | Local tests cover expected mutation contract | `NOT RUN` | Verify proxy behavior |
| WEB-06 | Hostile origin sends credentialed request to HQ | No reflected allow-origin header and no readable response | `OBSERVED RUNTIME` by authority mapper: shared HQ reflected an untrusted Origin with credentials; Security did not repeat the request | `NOT RUN` for I1Q staging | Immediate protected-system High gate |
| WEB-07 | Preflight requests unexpected method or header | Deny or return constrained exact policy | No deployed route evidence | `NOT RUN` | Required staging test |
| WEB-08 | Cross-origin script reads protected I1Q API | Block through same-origin and exact CORS policy | No I1Q CORS headers in local server, which is same-origin by default | `NOT RUN` | Verify entire proxy chain |
| WEB-09 | I1Q is framed by another site | Deny framing | `LOCAL PASS`: CSP frame-ancestors and X-Frame-Options present | `NOT RUN` | Verify edge preserves headers |
| WEB-10 | Referrer leaks protected path or query | No referrer disclosure | `LOCAL PASS`: no-referrer policy present | `NOT RUN` | Verify edge preserves header |
| WEB-11 | Browser or proxy caches protected response | `no-store`, private behavior, no shared cache reuse | `LOCAL PASS` for I1Q API response headers | `NOT RUN` | CDN and proxy behavior required |
| WEB-12 | Browser loads page over HTTP | Redirect to HTTPS and enforce HSTS after deployment | Not applicable locally | `NOT RUN` | Staging deployment gate |
| WEB-13 | Inline or injected script executes | Restrictive CSP blocks unexpected sources | Local CSP is restrictive; no deployed browser probe | `NOT RUN` | Run browser CSP test |
| WEB-14 | Session endpoint returns trace identity or credential evidence unnecessary for browser workflows | Closed minimal browser-safe response | `LOCAL PASS`: exact runtime projection, closed OpenAPI schema, and independent negative probe expose only actor ID, roles, expiry, and CSRF token with `no-store` | `NOT RUN` | Repeat against deployed proxy and browser |

## Authorization, IDOR, Input, And Abuse Matrix

| ID | Adversarial case | Expected behavior | Local or source result | Staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| APP-01 | Reviewer requests another reviewer's assignment by ID | Deny and reveal no protected content | `LOCAL PASS` | `NOT RUN` | Repeat on staging and preview DB |
| APP-02 | Reviewer uses a valid assignment for a different item revision | Deny stale or mismatched revision | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| APP-03 | User changes actor, role, review status, or owner fields in body | Ignore or reject protected fields | `LOCAL PASS` for mass assignment | `NOT RUN` | Repeat on staging |
| APP-04 | User guesses sequential or leaked resource IDs | Enforce per-object authorization, not existence alone | `LOCAL PASS` for covered resource routes | `NOT RUN` | Expand deployed corpus matrix |
| APP-05 | Malformed JSON reaches mutation route | Bounded `400`, no stack or data disclosure | `LOCAL PASS` | `NOT RUN` | Repeat on staging |
| APP-06 | Path traversal targets files outside public root | Reject | `LOCAL PASS` | `NOT RUN` | Repeat through deployment proxy |
| APP-07 | Oversized request body | Reject before memory or log amplification | Limit behavior not established end to end | `NOT RUN` | Define and verify route limits |
| APP-08 | Repeated login or bootstrap attempts | Bounded rate and observable rejection | No I1Q-specific rate limiter found; edge controls unknown | `NOT RUN` | Staging blocker until owned control is documented |
| APP-09 | Repeated extraction, review, or export attempts | Per-actor and per-route limits; idempotency where required | No deployed limiter or queue evidence | `NOT RUN` | Required internal abuse control |
| APP-10 | Error path logs session, CSRF, answer, or source data | Redacted structured log only | No deployed log capture reviewed | `NOT RUN` | Required staging log test |
| APP-11 | Client stores bearer, session, or protected content in browser storage | No persistent protected material and a ratified token-handling model | In-flight adapter expects a browser bearer; no application composition or storage path exists | `NOT RUN` | Browser and storage inspection required |
| APP-12 | Feature flag is omitted, malformed, or partially true | Consumer path remains disabled | `LOCAL PASS`: exact false-by-default handling | `NOT RUN` | Verify deployed configuration without reading values |
| APP-13 | Student-facing consumer requests unreleased content | Deny and emit no artifact | Local adapter and artifact tests pass | `NOT RUN` | Must stay disabled in staging and production |
| APP-14 | Second draft writer submits a stale client-observed content hash | Return `409` and preserve the first writer's revision | `LOCAL PASS`: exact `If-Match` is required and a two-writer regression passes | `NOT RUN` | Repeat through staging datastore |
| APP-15 | Deployment readiness omits an adapter, backing service, migration, audit, or all-flags-off proof | Return not ready and block promotion | `LOCAL PASS`: readiness stays `503` until every explicit gate is true | `NOT RUN` | Bind to canonical deployment promotion and verify each failure mode |

## Local Evidence Summary

| Run | Result | Scope |
| --- | --- | --- |
| Full Node suite after in-flight delta | 277 discovered, 275 passed, 0 failed, 2 intentional PostgreSQL skips | Local source and synthetic fixtures; both skipped DB tests were separately run in disposable instances. One earlier run had a transient UI timeout that passed in isolation and on later full reruns. |
| Focused security suite after in-flight delta | 161 discovered, 159 passed, 0 failed, 2 intentional PostgreSQL skips | Local identity, adapters, route security, readiness, preview workflow, migration source, and repository; both DB tests were separately run |
| In-flight identity adapter suite | 26 discovered, 26 passed, 0 failed, 0 skipped | Synthetic callbacks, loopback API, and logout revocation only |
| Root-fix targeted suite | 64 discovered, 64 passed, 0 failed, 0 skipped | API, security regression, and identity adapter tests, including contract, concurrency, readiness, static gate, and logout repairs |
| Preview-workflow static contract suite | 3 discovered, 3 passed, 0 failed, 0 skipped | Manual and phase-safe operation gates, secret-free validation, step-scoped migration secrets, exact approval/operation/commit/four-SQL/workflow/full-history binding, backup and restore identifiers, post-operation role/RLS/flag checks, and upload only when `steps.redact.outcome == 'success'` |
| Independent browser-session shape probe | Exact closed response and `no-store` passed | No identity trace, WordPress identity, email, credential evidence, issued time, or transport was reflected |
| Independent role-profile contract-version probe | Mismatched version rejected | Returned `identity_contract_version_mismatch` before profile use |
| Current independent evidence validator | 20 of 20 expected files present and parsed, 0 errors, claimed state `BLOCKED`, `PASS` | Frozen local evidence estate only; no preview or staging environment is claimed |
| Local unauthenticated route probe | `/`, `/app.js`, and the protected dashboard returned `401`; health returned `200` | Loopback server only; deployed edge and cookie behavior remain untested |

## Required Authentication Exit Criteria

1. A versioned canonical identity contract names immutable actor ID, provider identity, issuer, audience, active status, session ID, issued time, expiry time, validation time, role source, and revocation semantics.
2. The dedicated I1Q adapter and server normalizer implement the same closed contract without email identity, generated IDs, caller roles, unknown fields, or stale fallback state.
3. Positive and negative fixtures pass for login, expiry, revocation, role removal, disabled user, wrong issuer, wrong audience, provider outage, logout, fixation, and replay.
4. The protected HQ expiry, signing-configuration, and nonce findings are fixed or disproved, and the observed credentialed CORS reflection is repaired and regressed across shared consumers.
5. The whole staging application, including shell and assets, requires authentication through a documented application or edge boundary.
6. Staging tests prove CSRF, Origin, CORS, cookies, headers, cache, logs, rate controls, and feature flags against a non-localhost HTTPS origin.

Until those criteria pass, Security vetoes State A and every higher state.

============================================================
FILE: agents/security/rls_attack_matrix.md
============================================================
# I1Q-1008A RLS And Database Attack Matrix

## Verdict

**PREVIEW AND STAGING RLS CLEARANCE DENIED.** The base migration has a strong forced-RLS design and passed a disposable local PostgreSQL 16.13 attack suite. The latest runtime migration now separates the browser-safe self-profile capability from a deny-all application runtime role, and its real disposable apply, reapply, compensation, and reapply test passes. No canonical preview database, ratified application grant manifest, actor binder, connection-pool identity wiring, or staging query path was available. All environment-specific rows are `NOT RUN`.

Evaluated migration source commit: `81273add2c0fe350d330902d229683662896a1b1`

Evaluated in-flight identity-capability migration SHA-256: `e78e0e08cc84da54ef87af5c5ef8e958a2f93b813a06472a797f3842583f36a0`

## Important Scope Boundary

The first disposable test database created test-only authentication plumbing and broad test privileges so base policy behavior could be exercised. A second clean disposable database applied the base migration and the in-flight identity-capability migration and inspected its catalog behavior. Those fixtures are useful adversarial evidence, but they do not prove a production runtime role is least privilege or that canonical Supabase identity reaches `auth.uid()` correctly. Both test databases were loopback-only, stopped after their runs, and removed.

## Migration And Role Matrix

| ID | Attack or verification | Expected control | Local synthetic or static result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| DB-01 | Apply base and identity-capability migrations to a clean database | Complete transactions, expected objects only | `SYNTHETIC PASS` | `NOT RUN` | Run through canonical preview pipeline |
| DB-02 | Reapply identity-capability migration | Deterministic safe result | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| DB-03 | Apply identity-capability compensation and reapply | Removes capability, preserves records, then restores only reviewed capability | `SYNTHETIC PASS` | `NOT RUN` | State B requires preview evidence |
| DB-04 | Inspect all application tables for RLS | Every table enables and forces RLS | `OBSERVED` and `SYNTHETIC PASS`: 52 tables | `NOT RUN` | Verify catalog in preview |
| DB-05 | Connect as anonymous role | No schema, table, sequence, or function access | Migration revokes broad access; local fixture passed its modeled checks | `NOT RUN` | Verify actual managed roles and inheritance |
| DB-06 | Connect as broad authenticated role | No direct authoring, answer, source, release, or audit access | Migration revokes broad access; local fixture passed modeled checks | `NOT RUN` | Verify actual managed role grants |
| DB-07 | Inspect proposed I1Q identity-profile capability role | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`, no ownership or table access, exact self-profile RPC only | `SYNTHETIC PASS` in static and real disposable tests | `NOT RUN` | Ratify and repeat in preview |
| DB-08 | Inspect proposed I1Q application runtime role | Separate `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` role with no browser membership and deny-all until exact grants are approved | `SYNTHETIC PASS` in static and real disposable tests | `NOT RUN` | Approve binder and workflow grants before use |
| DB-09 | Inspect object ownership | Runtime login cannot alter policies, functions, or tables | Candidate ownership model not applied to managed preview | `NOT RUN` | Required catalog evidence |
| DB-10 | Inspect default privileges | Future objects cannot inherit broad grants | Migration source is conservative; managed owner defaults unknown | `NOT RUN` | Required catalog evidence |
| DB-11 | Invoke definer function from an unapproved role | Permission denied | Modeled locally | `NOT RUN` | Verify actual grants |
| DB-12 | Manipulate function resolution through search path | Fixed safe search path prevents object substitution | Definer functions use fixed paths in source; local migration suite passed | `NOT RUN` | Verify owner and catalog definition |
| DB-13 | Broad `authenticated` role inherits I1Q capability | Only the caller-scoped self-profile RPC is reachable; no application runtime privilege is inherited | `SYNTHETIC PASS`: `authenticated` inherits `i1q_identity_profile_reader` only and is not a member of `i1q_app_runtime` | `NOT RUN` | Verify exact managed-role catalog in preview |
| DB-14 | Application server invokes workflow repository functions | Dedicated server principal has exact allowlisted function and read grants | In-flight migration grants identity RPC only; workflow surface remains absent | `NOT RUN` | High State B blocker |
| DB-15 | Preview workflow claims backup and post-apply security closure | Verified provider backup identity and restore path, fail-closed capture, exact authority and candidate binding, operation-history separation, post-operation catalog checks, approved schema comparison, and redacted evidence | `LOCAL STATIC PASS`: target is safely `UNASSIGNED`; workflow separates secret-free validation from step-scoped secrets and binds the closed approval record, operation, commit, four SQL hashes, workflow hash, and full remote-history hash. It requires backup and restore IDs, separate operation stages, role/RLS/grant/flag certification, and successful redaction inventory before upload | `NOT RUN` | Populate authority only after real backup and restore evidence exists, then execute and inspect every stage and schema comparison |
| DB-16 | A preexisting role receives unexpected membership, ownership, or direct privilege | Migration and reapply fail closed before accepting the role contract | `SYNTHETIC PASS`: catalog assertion and real disposable collision test reject unexpected direct privilege | `NOT RUN` | Repeat against managed preview catalog before and after apply |

## Identity Context And Pooling Matrix

| ID | Attack or verification | Expected control | Local synthetic or static result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| CTX-01 | Query without `auth.uid()` | Deny protected reads and writes | `SYNTHETIC PASS` | `NOT RUN` | Repeat using real managed auth context |
| CTX-02 | Supply caller-controlled application role setting | Ignored; role derives from membership table | `SYNTHETIC PASS` | `NOT RUN` | Repeat with runtime role |
| CTX-03 | Supply caller-controlled actor setting | Cannot replace canonical `auth.uid()` | Local test used a test-only actor setting to emulate `auth.uid()` | `NOT RUN` | Canonical provenance remains unproven |
| CTX-04 | Reuse pooled connection after actor A transaction | Actor A context is absent for actor B | Repository has no production pool wiring | `NOT RUN` | High blocker |
| CTX-05 | Set actor context outside a transaction | Rejected or reset before reuse | Not wired | `NOT RUN` | Require transaction-local setup |
| CTX-06 | Transaction errors after actor context is set | Rollback clears context and privileges | Not wired | `NOT RUN` | Required pool test |
| CTX-07 | Actor membership changes mid-session | Next authorized transaction uses current membership | In-flight identity RPC derives current memberships in design; local adapter calls it per request | `NOT RUN` | Verify freshness behavior |
| CTX-08 | Application supplies a different actor than canonical session | Database and server reject mismatch | Repository checks database actor but does not establish canonical context | `NOT RUN` | End-to-end identity blocker |

## Role, Assignment, And IDOR Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| RLS-01 | Unknown actor reads any protected row | Empty set or denial | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-02 | Read-only role mutates authoring data | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-03 | Author reads or mutates another author's restricted work | Denied unless explicitly authorized | `SYNTHETIC PASS` for covered policy paths | `NOT RUN` | Expand real role matrix |
| RLS-04 | Editor accesses unassigned protected review | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-05 | Physician reviewer accesses unassigned protected review | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-06 | Release manager skips physician, editorial, rights, or safety gates | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-07 | Privacy owner reads restricted source without accepted purpose assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-08 | Reviewer reads another actor's accepted assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-09 | Reviewer changes requested revision after accepting assignment | Exact revision binding blocks stale decision | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-10 | Reviewer self-approves a prohibited review stage | Separation rule denies action | `SYNTHETIC PASS` for modeled stages | `NOT RUN` | Verify every authoritative role combination |
| RLS-11 | Caller inserts membership granting self a privileged role | Denied to browser and runtime roles | Policy model passed locally; identity capability has no table write grant; application workflow grants absent | `NOT RUN` | Verify actual managed grants |
| RLS-12 | Caller updates review or release status directly | Denied except through approved transition functions | `SYNTHETIC PASS` | `NOT RUN` | Verify function-only grant surface |
| RLS-13 | Auditor role reads audit evidence | Exact authorized read path, no mutation | Auditor production contract and grants are unresolved | `NOT RUN` | Define before State B |

## Answer And Restricted Source Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| ISO-01 | Generic role selects `item_revision_answers` | No direct access | `SYNTHETIC PASS` | `NOT RUN` | Repeat as actual runtime role |
| ISO-02 | Generic role selects restricted source references | No direct access | `SYNTHETIC PASS` | `NOT RUN` | Repeat as actual runtime role |
| ISO-03 | Reviewer calls answer reader without assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-04 | Reviewer calls answer reader with wrong purpose | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-05 | Reviewer calls answer reader for stale revision | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-06 | Privacy reviewer calls restricted-source reader without accepted assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-07 | Protected reader returns extra columns | Closed-world response contains only approved fields | `SYNTHETIC PASS` in local repository and adapter suites | `NOT RUN` | Inspect real query and API response |
| ISO-08 | Attacker encodes protected field name to evade export checks | Encoded, case, separator, and nested variants rejected | `SYNTHETIC PASS` across Class D matrix | `NOT RUN` | Repeat exact deployed build |
| ISO-09 | Pre-finalization export obtains answer or explanation | Server refuses answer-bearing channel | `SYNTHETIC PASS` | `NOT RUN` | Repeat through staging consumer route |
| ISO-10 | Source object URL is returned in generic API | No restricted location or raw material emitted | `SYNTHETIC PASS` in local API shaping | `NOT RUN` | Verify logs, proxy, and browser too |

## Audit, Evidence, And Immutability Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | Caller inserts arbitrary actor, time, sequence, or prior hash | Database derives authoritative values | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-02 | Caller updates or deletes audit event | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-03 | Concurrent events fork audit chain | Row-locked head creates one ordered chain | Design observed and local suite passed | `NOT RUN` | Add preview concurrency test |
| AUD-04 | Caller inserts arbitrary audit event directly | Only approved functions can append | `SYNTHETIC PASS` in modeled grants | `NOT RUN` | Verify runtime grants |
| AUD-05 | Caller mutates immutable item revision | Denied; new revision required | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-06 | Approval remains valid after content changes | Exact revision hash prevents reuse | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-07 | Release manifest or evidence record is replaced | Hash and immutable identity reveal mismatch | `LOCAL PASS`: current validator passes 20 of 20 with zero errors and claimed state `BLOCKED` | `NOT RUN` | Bind the future deployed commit and database snapshot to a new environment-specific inventory |
| AUD-08 | Security event cannot be read by authorized auditor | Defined least-privilege audit view is available | No approved runtime grant or staging audit route | `NOT RUN` | Operational blocker |
| AUD-09 | Sensitive answer or source data enters audit payload | Payload schema rejects or redacts protected fields | Local application shaping helps; database payload policy not proven end to end | `NOT RUN` | Add explicit negative fixture and log inspection |

## Local PostgreSQL Runs

An isolated loopback PostgreSQL 16.13 instance executed the current `postgres-migration` suite:

| Metric | Result |
| --- | --- |
| Tests discovered | 13 |
| Passed | 13 |
| Failed | 0 |
| Skipped | 0 |
| Remote systems touched | 0 |
| Preview or staging evidence | None |

The temporary instance was stopped and removed after the run.

A second clean loopback PostgreSQL 16.13 instance ran the in-flight executable runtime test, which reported 1 test, 1 pass, 0 failures, and 0 skips. It applied the base and identity-capability migrations, reapplied the identity migration, compensated twice to prove idempotency, and reapplied through the dedicated forward reapply migration twice. Catalog inspection observed:

| Check | Local result |
| --- | --- |
| Identity-profile role login, inheritance, superuser, role creation, and RLS bypass | all false |
| Application runtime role login, inheritance, superuser, role creation, and RLS bypass | all false |
| `authenticated` membership in identity-profile role after apply | true |
| `authenticated` membership in application runtime role | false |
| `authenticated` execution of caller-scoped identity RPC after apply | true |
| Application runtime table and function grants | none |
| Unexpected direct privilege injected into identity role | migration reapply rejected fail closed |
| Enabled I1Q feature flags | 0 |
| Apply, reapply, compensate, reapply | pass |

These results support migration-candidate quality and close the local role-name conflation. Exact application grants, actor binding, and environment authority remain open. They are not preview or staging evidence.

## Required State B Evidence

1. Approved preview project identity and migration route.
2. Exact migration checksum and deployment commit.
3. Approved browser identity-capability role, separate application runtime principal, group memberships, and closed grant manifests, or an explicit authority ruling that safely replaces that separation.
4. Catalog proof for ownership, `NOBYPASSRLS`, forced RLS, policies, function security, search paths, and default privileges.
5. Full role matrix using actual anonymous, authenticated, runtime, and administrative roles.
6. Transaction-local actor-context tests through the real pool, including error, retry, and actor-switch cases.
7. Answer, source, audit, release, and IDOR attacks through both SQL and the application API.
8. Compensating migration, schema comparison, reapply, and data-preservation evidence through the canonical process.
9. Redacted logs proving denials are observable without leaking protected data.
10. Successful workflow redaction and inventory artifact, real provider backup identity, and executed restoration evidence. The static gate alone is insufficient.

Until all ten items pass in preview, Security vetoes State B and every higher state.

============================================================
FILE: agents/security/security_release_verdict.md
============================================================
# I1Q-1008A Security Release Verdict

## Verdict

**VERDICT: VETO**

**Highest security state achieved: NONE of I1Q-1008A States A through D.**

The evaluated snapshot has a strong local application and migration foundation, but it has not crossed the first 1008A environment gate. Concurrent work produced an in-flight identity adapter, synthetic role fixtures, and a split-role runtime migration. They pass local tests, including a fresh real disposable PostgreSQL run, but remain uncommitted, unratified, unwired, and unapplied. The adapter and proposed Lorentz contract still differ in closed payload shape. No canonical identity journey, preview RLS exercise, or authenticated non-localhost staging application exists. Security therefore does not clear registration of any achieved 1008A state.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

Verdict date: `2026-07-15`

## State Decision

| State | Decision | Security reason |
| --- | --- | --- |
| State A | `VETO` | An in-flight adapter and synthetic fixtures exist, but one contract is not ratified or enforced, the adapter is not wired, canonical identities are absent, and the full session lifecycle and end-to-end auth attacks have not run. The zero-error local evidence estate truthfully claims `BLOCKED`. |
| State B | `VETO` | The split-role migration passes locally, but exact application grants and actor binding remain unratified, and no canonical preview apply, transaction actor context, RLS attack run, compensation, or preview reapply evidence exists. |
| State C | `VETO` | No authenticated non-localhost staging URL, deployed commit, deployed headers, CORS, cache, logs, rate controls, monitoring, rollback, or staging answer-isolation evidence exists. |
| State D | `VETO` | States A through C are blocked, and no security evidence supports a student-facing release. |

The earlier I1Q-1007X qualified local State A claim is not an achieved I1Q-1008A state and must not be relabeled as one.

## What Security Clears Locally

These clearances apply only to the evaluated local candidate:

1. `LOCAL APPLICATION FOUNDATION: PASS WITH OPEN INTEGRATION GATES`
   The latest full Node rerun reported 277 tests, 275 passes, 0 failures, and 2 intentional database skips. Both skipped database targets were separately exercised in disposable local instances. One earlier run had a transient UI timeout that passed in isolation and on later full reruns.
2. `FOCUSED SECURITY REGRESSIONS: PASS WITH DATABASE SKIP`
   The expanded focused suite reported 161 tests, 159 passes, 0 failures, and 2 intentional database skips. Both database targets were separately exercised.
3. `LOCAL POSTGRESQL MIGRATION CANDIDATE: PASS`
   A disposable PostgreSQL 16.13 run passed 13 of 13 migration attacks, including apply, reapply, role denials, answer and source isolation, Class D encoding, audit immutability, compensation, and reapply.
4. `IN-FLIGHT IDENTITY ADAPTER: SYNTHETIC PASS`
   Its dedicated suite reported 26 tests, 26 passes, 0 failures, and 0 skips. This does not resolve contract authority or application wiring.
5. `IN-FLIGHT SPLIT-ROLE MIGRATION: SYNTHETIC PASS WITH ENVIRONMENT GATES OPEN`
   A fresh clean disposable PostgreSQL run applied, reapplied, compensated, and reapplied the migration with zero feature flags enabled. It confirmed exact browser membership in the self-profile capability and no browser membership or grants for the separate deny-all application runtime role.
6. `CURRENT EVIDENCE INTEGRITY: PASS FOR FROZEN LOCAL SNAPSHOT`
   The independent final validator passes 20 of 20 expected files with zero errors and claimed state `BLOCKED`. This closes local repository evidence integrity without claiming preview, staging, backup restoration, or deployment evidence.
7. `LOCAL SECRET AND PUBLIC-BUNDLE SCANS: PASS WITH LIMITED PATTERN SCOPE`
   High-confidence credential-literal and protected public-bundle token scans found zero matching files.
8. `ROOT LOCAL SECURITY REPAIRS: PASS`
   A 64-test targeted suite passes exact identity-contract enforcement, two-writer draft locking, deployment readiness, static-shell denial, and the fail-closed logout composition point. Wrong contract data fails as `authentication_required`; stale draft mutation returns `409` and preserves the first writer.
9. `MINIMAL BROWSER SESSION PROJECTION: LOCAL PASS`
   The route, closed OpenAPI schema, focused tests, and an independent synthetic probe expose only actor ID, roles, expiry, and CSRF token. Internal identity trace and credential evidence are absent, and the response is `no-store`.
10. `STATIC ACCESS AND LOGOUT CONTRACTS: LOCAL PASS`
   Non-demo static assets deny access without an explicit gate. Logout requires canonical revocation injection and exact mutation integrity, and a synthetic old bearer is rejected after revocation. The UI clears in-memory workspace state and enters a deterministic signed-out state. Real edge, cookie, provider, and old-tab behavior remain unverified.
11. `DEPLOYMENT READINESS CONTRACT: LOCAL PASS`
   Readiness fails closed unless all runtime adapters, datastore, migration, audit, and all-flags-off evidence are explicitly true. No canonical staging promotion has exercised this contract.
12. `PREVIEW WORKFLOW STATIC CONTRACT: LOCAL PASS`
   The 3-test workflow suite passes. It separates secret-free validation from step-scoped migration secrets and requires provider backup and restore identifiers, an exact closed approval-record digest and payload, exact operation and commit, four SQL hashes, workflow hash, expected full remote-history hash, phase-safe operation stages, and post-operation role/RLS/grant/flag checks. Upload requires `steps.redact.outcome == 'success'`. No target, provider restore, preview operation, hosted attack, or approved schema comparison exists.

None of these local clearances authorizes preview, staging, deployment, or feature-flag changes.

## Blocking Findings

| ID | Severity | Blocking condition |
| --- | --- | --- |
| SEC-1008A-01 | Release blocker | Preview and staging environments and their evidence do not exist. |
| SEC-1008A-02 | High integration gate | The in-flight adapter is not ratified, committed, wired, or canonical-user tested. The server now enforces its identity envelope, but the adapter payload still differs from the concurrent proposed Lorentz closed contract. |
| SEC-1008A-03 | High, conditional | Tracked HQ source appears to accept decoded sessions after detecting missing, invalid, or expired expiry metadata. Deployed applicability is unknown. |
| SEC-1008A-04 | High | The authority mapper independently observed the shared production HQ auth endpoint reflecting an untrusted Origin with credential support. Security did not repeat the production request. |
| SEC-1008A-05 | Medium, conditional | Tracked HQ source uses process-random session signing material instead of failing startup when canonical configuration is absent. |
| SEC-1008A-06 | High, conditional | A handoff nonce is emitted, but one-time nonce consumption was not found in tracked HQ source. Replay was not tested. |
| SEC-1008A-07 | High environment gate; local conflation closed | The latest split-role design passes locally. Application grants, actor binding, pool isolation, target authority, and preview RLS evidence remain absent. |
| SEC-1008A-08 | Medium external and abuse gate; local contracts closed | Static access, logout, and signed-out UI behavior pass locally. Canonical edge, cookie, provider, old-tab, and rate-control behavior remain unproven. |
| SEC-1008A-11 | High environment release gate; static contract closed | The fail-closed preview workflow has no assigned target. Its secret scoping, backup and restore references, exact approval and candidate binding, operation-history, post-operation catalog, and redaction controls pass static tests, but no provider backup restore, preview operation, hosted attack, approved schema comparison, or resulting evidence has run. |

Any open High finding blocks authenticated staging clearance. Conditional findings must be fixed or disproved against the exact protected deployed source. They cannot be dismissed because runtime configuration is unknown.

## Required Closure Sequence

1. **Pin authority and source.** Record the exact I1Q, HQ, WordPress handoff, proxy, migration, infrastructure, and manifest commits for the proposed staging build.
2. **Close protected auth findings.** Through the authorized protected-system process, fail closed on invalid expiry and missing signing configuration, repair the observed credentialed CORS reflection, and enforce one-time handoff exchange. Add regressions across shared consumers.
3. **Ratify and implement canonical identity integration.** Reconcile the in-flight adapter with one exact closed contract and use the DR-006-authorized dedicated I1Q adapter. Prohibit email-only identity, generated actor IDs, caller roles, and stale fallback context.
4. **Pass identity fixtures.** Cover valid and invalid login, issuer, audience, expiry, revocation, disabled actor, role removal, provider outage, fixation, replay, logout, and old-tab behavior.
5. **Ratify the split database principals.** Approve exact application grants and actor binding, then prove the application principal is not owner, superuser, `BYPASSRLS`, broadly inherited, or directly browser-accessible.
6. **Run preview closure.** Populate the fail-closed workflow with real provider backup and restore evidence, exact authority and candidate hashes, and expected remote history. Then execute each authorized operation through the canonical process, run the complete RLS and answer-isolation matrices, test actor switching through the real pool, compensate, compare, and reapply.
7. **Deploy authenticated staging.** Use the canonical pipeline and bind the deployment to the exact tested commit. Protect the entire internal application surface, including shell and static assets.
8. **Run deployed attacks.** Execute every `NOT RUN` row in the auth, RLS, and isolation artifacts over HTTPS from trusted and hostile browser origins.
9. **Verify operations.** Prove secure cookies, headers, CORS, caches, redacted logs, rate controls, monitoring, alerts, backup, rollback, and evidence-to-commit binding.
10. **Obtain independent verdicts.** Security, identity, database, deployment, evidence, and release agents must each issue environment-specific clearance with no unresolved Critical or High finding.
11. **Bind environment evidence.** Preserve the zero-error frozen local inventory, then create and independently verify a new exact inventory for the preview database snapshot and deployed staging commit.

## Protected-System Direction

1. Do not apply a migration or database grant from this security packet.
2. Do not modify protected HQ, WordPress, Supabase, deployment, or runtime files without the required decision record and owner route.
3. Do not read or place secret values in evidence files.
4. Do not use production data for security fixtures.
5. Do not enable any student, consumer, extraction, or publication feature flag.
6. Preserve the STAT sealed-pack boundary and keep `answer_map` server-only before finalization.

## Re-Evaluation Trigger

Re-run this security workstream when all of the following are supplied:

1. Canonical identity adapter commit and sanitized positive and negative fixtures.
2. Protected authentication-runtime commit with the conditional findings resolved or explicitly disproved.
3. Preview database apply record, actual runtime role and grant manifest, and redacted RLS evidence.
4. Authenticated non-localhost staging URL and exact deployed commit.
5. Authorized redacted access to staging headers, application logs, audit logs, monitoring, and rollback evidence.

## Confidence And Reservation

Confidence in the current veto: **99%**.

Reservation: **1%**, limited to the possibility that external protected runtime or staging evidence exists but was not present in this worktree or authorized evidence packet. Missing evidence cannot be treated as a pass.

**Final security direction: keep all feature flags off and do not declare an I1Q-1008A achieved state.**

============================================================
FILE: agents/security/threat_model.md
============================================================
# I1Q-1008A Security Threat Model

## Decision

**SECURITY VETO FOR I1Q-1008A STATES A THROUGH D AT THE EVALUATED SNAPSHOT.**

The local application, migration candidates, answer isolation controls, and frozen preview-workflow contract have strong synthetic evidence. Concurrent in-flight work added a proposed identity adapter, synthetic personas, an identity-capability migration, and a fail-closed preview workflow while this assessment was running. Security evaluated the final frozen local snapshot, but these candidates remain uncommitted, unratified, unwired, and unapplied. An independent final validator rerun passes all 20 expected evidence files with zero errors and claimed state `BLOCKED`. None of this establishes canonical identity integration, an actual provider backup restore, a real preview database security posture, or authenticated non-localhost staging behavior. No staging-only control is treated as passed.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

In-flight identity adapter SHA-256: `b1e0dd4c0c7f3961328a58809b5d4e7405d9e8c3a07599a5fac5d5823f06b039`

In-flight identity-capability migration SHA-256: `e78e0e08cc84da54ef87af5c5ef8e958a2f93b813a06472a797f3842583f36a0`

Evaluation date: `2026-07-15`

## Scope And Evidence Language

This review is limited to safe source inspection, read-only repository inspection, and local synthetic tests. It did not read secret values, raw transcripts, student data, or production records. It did not apply a remote migration, deploy, change feature flags, or mutate a protected system.

Evidence labels used throughout this packet:

| Label | Meaning |
| --- | --- |
| `OBSERVED` | Directly established from the evaluated tracked source or a supplied authority record. |
| `SYNTHETIC PASS` | Demonstrated in an isolated local test fixture. This is not staging evidence. |
| `SYNTHETIC FAIL` | A local test demonstrated behavior contrary to the expected control. |
| `NOT RUN` | The test requires preview, staging, canonical credentials, or deployed infrastructure and was not authorized or available here. |
| `UNKNOWN` | Available evidence cannot establish the state. |
| `CONDITIONAL` | The source pattern is risky only when the named runtime condition is true. Runtime applicability remains unverified. |

## Authority And Inputs Reviewed

The review followed MissionMed OS boot routing and examined the applicable mission record, product passport, authority index, DR-006, MR-078A, MR-078B, MR-079, the Critical Systems Contract and manifest, the Matrix runtime lock records, and the STAT canon. It also examined the I1Q-1008A ticket, baseline, execution plan, agent charter, ownership matrix, I1Q application source, tests, migrations and compensating migrations, evidence manifests, prior I1Q-1007X security reports, and the tracked MissionMed HQ and WordPress authentication handoff sources. A final delta review covered the concurrent Lorentz contracts, Herschel authority map, proposed identity adapter and fixtures, and proposed identity-capability migration.

The tracked authentication source may differ from protected deployed runtime. Source-only observations below must be reproduced against the authorized deployed commit before they are classified as deployed vulnerabilities. SEC-1008A-04 is different: an authorized authority mapper supplied a same-day read-only runtime observation, which Security consumed but did not independently repeat.

## Security Objectives

1. Only a canonical, active MissionMed identity may enter the internal application.
2. Session authenticity, freshness, revocation, issuer, audience, and logout must be enforced end to end.
3. Application roles must come from authoritative server-side role membership, not request claims, email addresses, or caller-controlled context.
4. Every object read or mutation must enforce role, assignment, purpose, actor, session, and immutable revision identity where applicable.
5. Answers, explanations, restricted sources, and source excerpts must remain unavailable before the authorized review or finalization boundary.
6. Database grants and forced RLS must fail closed even if application authorization is bypassed.
7. Audit and evidence chains must be append-only, attributable, ordered, and tamper-evident.
8. Deployment configuration must preserve same-origin behavior, secure headers, private caching, safe logs, and bounded request rates.
9. Consumer artifacts must preserve STAT sealed-pack invariants and keep student-content feature flags off until all release gates are satisfied.

## Assets

| Asset | Required property | Principal threats |
| --- | --- | --- |
| Canonical actor identity | Authentic, active, stable, non-ambiguous | Identity substitution, email fallback, UUID synthesis, stale identity |
| Session and handoff state | Signed, scoped, fresh, revocable, one-time where required | Replay, fixation, expiry bypass, cross-audience use |
| Roles and assignments | Server-derived and deny by default | Claim spoofing, stale membership, privilege escalation |
| Item revisions and answer records | Immutable identity and strict separation | Pre-finalization disclosure, IDOR, cache leakage |
| Restricted source records | Purpose-scoped access with privacy controls | Raw source disclosure, object URL leakage, overbroad reviewer access |
| Review and release decisions | Exact revision binding and separation of duties | Stale approval, self-review, skipped gate, forged status |
| Audit ledger | Complete, ordered, immutable, actor-attributed | Deletion, rewrite, caller-supplied identity or timestamp |
| Feature flags and channel exports | Fail closed and release-bound | Accidental publication, mixed-manifest inconsistency |
| Deployment configuration | Private, bounded, observable, reproducible | CORS abuse, missing headers, rate abuse, sensitive logs |
| Evidence manifests | Complete and tamper-evident | Stale evidence, checksum substitution, state overclaim |

## Trust Boundaries

1. **Browser to WordPress handoff.** The browser initiates authentication and receives a short-lived handoff artifact. Redirect validation, one-time use, and browser exposure matter here.
2. **WordPress handoff to MissionMed HQ.** HQ must independently validate signature, issuer, audience, timestamp, nonce, and return target before creating a session.
3. **HQ to canonical identity provider.** The identity adapter must prove actor continuity, active status, provider session state, and revocation.
4. **HQ or identity resolver to I1Q.** I1Q currently trusts an injected resolver result marked validated. The production resolver and its complete contract are not present in this snapshot.
5. **I1Q server to PostgreSQL.** Actor context and runtime role must be established safely on each transaction and cleared across pooled connections.
6. **PostgreSQL role to RLS and definer functions.** Forced RLS, grants, function ownership, fixed search paths, and purpose-scoped readers form the database backstop.
7. **I1Q server to browser.** API shaping, cache controls, CSP, framing, CORS, CSRF, errors, and logs must not expose protected fields.
8. **Export builder to STAT and other consumers.** Class A artifacts must omit answers and explanations. Answer maps remain server-only until finalization.
9. **Repository evidence to Mission Control.** Hashes and test claims must identify the exact source and environment evaluated.

## Threat Actors

| Actor | Capability |
| --- | --- |
| Unauthenticated internet client | Sends arbitrary requests, origins, paths, headers, and payloads. |
| Authenticated low-privilege user | Reuses a valid session while probing IDs, roles, assignments, and hidden fields. |
| Reviewer with a valid assignment | Attempts cross-item reads, stale-revision decisions, answer export, or source overreach. |
| Compromised browser or cross-site origin | Attempts CSRF, token replay, storage extraction, clickjacking, and credentialed CORS requests. |
| Misconfigured runtime role | Has unintended table, sequence, or function privileges or can bypass RLS. |
| Faulty internal adapter | Emits answer-bearing content into a pre-finalization channel or weakens identity context. |
| Privileged operator error | Deploys the wrong commit, enables a flag, skips a migration gate, or exposes sensitive logs. |
| Evidence manipulator | Replaces test output or a manifest while preserving a misleading state claim. |

## Adversarial Attack Trees

### Identity And Session Compromise

Goal: enter I1Q as another actor or retain access after authority expires.

1. Forge or replay the WordPress-to-HQ handoff.
2. Reuse a handoff nonce within its validity window.
3. Supply a session with absent or expired expiry metadata.
4. Exploit missing issuer or audience validation between HQ and I1Q.
5. Preserve a session after provider revocation, role removal, logout, or account disablement.
6. Cause secret misconfiguration to produce inconsistent session validation.
7. Abuse credentialed CORS to read or mutate with a victim browser.

### Role Escalation And IDOR

Goal: act outside an authoritative role or assignment.

1. Submit a caller-controlled role, actor ID, or email identity.
2. Reuse a valid object ID from another assignment.
3. Change an item revision between review and decision.
4. Invoke a finalization route with a fabricated release or channel.
5. Reuse a pooled database connection carrying another actor's context.
6. Call a purpose-scoped reader with a mismatched purpose or assignment.

### Answer And Source Disclosure

Goal: obtain answers, explanations, or restricted source material before authorization.

1. Query a generic API route and request hidden fields.
2. Guess answer-table or source-record identifiers.
3. Call a definer function directly under a broad runtime grant.
4. Inspect browser bundles, HTML, storage, errors, logs, caches, or proxy responses.
5. Obtain a Class C or answer-map artifact before finalization.
6. Follow a source object URL or transcript reference without purpose authorization.

### Database Boundary Failure

Goal: bypass application controls through grants, RLS, or function ownership.

1. Connect as a role that owns tables or has `BYPASSRLS`.
2. Inherit broad privileges through group membership or default privileges.
3. Spoof actor or role context through caller-controlled settings.
4. Exploit an unsafe definer function search path or mutable owner.
5. Insert, update, or delete immutable revisions, approvals, or audit rows.
6. Skip a release gate through direct table writes.

### Deployment, Logs, And Evidence Failure

Goal: turn a locally secure design into an unsafe deployed system or conceal the result.

1. Expose the static application shell without an edge authentication gate.
2. Omit HSTS, CSP, private cache controls, or secure cookie attributes at the proxy.
3. Reflect arbitrary credentialed origins or accept cross-site mutation requests.
4. Permit unbounded login, extraction, review, or export requests.
5. Log session material, CSRF tokens, answers, source URLs, or request bodies.
6. Deploy a commit that differs from the tested evidence manifest.
7. Report a local synthetic result as a staging pass.

## Findings

| ID | Gate severity | Evidence | Finding | Required closure |
| --- | --- | --- | --- | --- |
| SEC-1008A-01 | Release blocker | `OBSERVED` | There is no authorized preview apply record, authenticated staging URL, staging deployment commit, or staging security result. | Complete canonical preview and staging gates and rerun the matrices against the exact deployed commit. |
| SEC-1008A-02 | High integration gate | In-flight adapter and boundary tests `SYNTHETIC PASS`; authority and integration `OPEN` | A proposed adapter and ten synthetic personas now exist, and its 26 identity tests pass locally. The server boundary requires the identity envelope, exact contract version, canonical actor equality, active identity, and non-revoked identity. The scoped role-profile resolver also rejects a mismatched identity contract version in source and an independent negative probe. The candidate is still uncommitted, unratified, not composed into application startup, and not exercised with canonical users. Its payload also differs from the concurrent proposed Lorentz closed schema. | Reconcile and ratify one exact contract, wire the adapter and role resolver, and pass authoritative positive and negative fixtures. |
| SEC-1008A-03 | High, conditional | `OBSERVED` in tracked HQ source; deployed applicability `UNKNOWN` | The tracked HQ session reader warns when expiry metadata is missing, invalid, or expired and then returns the decoded session payload. | Make expiry mandatory and fail closed, add regression tests, and verify the deployed protected runtime commit. |
| SEC-1008A-04 | High | `OBSERVED` in tracked HQ source and independently reported as `OBSERVED RUNTIME` by the authority mapper | The shared production HQ auth endpoint reflected an untrusted request Origin while allowing credentials during a read-only 2026-07-15 observation. Security did not repeat the production request. | Route a protected-system repair immediately, require an explicit exact allowlist, fail closed when unset, and run shared-consumer and hostile-origin regressions. |
| SEC-1008A-05 | Medium, conditional | `OBSERVED` in tracked HQ source; deployed applicability `UNKNOWN` | Session signing configuration falls back to process-random material when canonical configuration is absent. This can make session continuity and incident behavior non-deterministic instead of failing startup. | Fail startup when canonical signing configuration is absent and test restart continuity without exposing configuration values. |
| SEC-1008A-06 | High, conditional | `OBSERVED` across tracked handoff and HQ source; exploit test `NOT RUN` | The handoff contains a nonce, but the tracked HQ parser does not consume or persist it as one-time state. A signed handoff appears replayable during its short validity window. | Add atomic nonce consumption or an equivalent one-time exchange and verify bootstrap replay rejection in staging. |
| SEC-1008A-07 | High environment gate; local conflation closed | Latest migration and real disposable PostgreSQL test `SYNTHETIC PASS`; authority and preview `OPEN` | The latest migration cleanly separates `i1q_identity_profile_reader` from deny-all `i1q_app_runtime`. Both are `NOLOGIN`, `NOINHERIT`, and `NOBYPASSRLS`; only the exact self-profile RPC capability is inherited by `authenticated`; the app role has no browser membership or grants. Apply, reapply, compensation, and reapply pass locally. Target authority, application grants, actor binding, pool isolation, and preview RLS remain absent. | Ratify the split-role manifest, approve exact workflow grants and actor binder, and execute the full preview RLS matrix. |
| SEC-1008A-08 | Medium external and abuse gate; local contracts closed | Static, logout, and UI tests `SYNTHETIC PASS`; staging `NOT RUN` | Non-demo HTML and JavaScript now return `401` unless an explicit static-access adapter is injected with the identity resolver. Logout requires exact mutation integrity and an injected canonical revocation adapter, fails `503` when absent, and a synthetic revocation makes the old bearer fail on its next session request. The local UI sends the CSRF-bound request, clears in-memory workspace state, disables controls, and focuses a signed-out state. Canonical edge and cookie enforcement, provider revocation, real old-tab behavior, deployed headers, logs, and rate controls remain unproven. | Compose both adapters with canonical auth, define rate controls, and verify cookies, edge behavior, provider logout, old tabs, headers, logs, caches, and limits in staging. |
| SEC-1008A-09 | Closed locally only | `SYNTHETIC PASS` | Local API, artifact, and PostgreSQL tests preserve answer and restricted-source isolation, including encoding variants and audit immutability. | Repeat against preview and deployed staging roles. Do not promote this local result to staging clearance. |
| SEC-1008A-10 | Closed locally; staging verification remains | Source, OpenAPI, focused tests, and independent probe `SYNTHETIC PASS`; staging `NOT RUN` | `/api/v1/session` now emits exactly `actor` with `id` and `roles`, plus `session` with `expires_at` and `csrf_token`. Identity trace, WordPress identity, email, credential evidence, issued time, and transport are not reflected. The OpenAPI schema is closed at all three object levels, and the response is `no-store`. | Repeat exact-shape, cache, proxy, and browser inspection against the deployed staging route. |
| SEC-1008A-11 | High environment release gate; static contract closed | Workflow source and 3-test suite `LOCAL STATIC PASS`; preview `NOT RUN` | The current target is correctly `UNASSIGNED`, so the workflow cannot run. It separates secret-free source validation from step-scoped migration secrets. Before a non-validation operation it requires provider backup ID and creation date, restore runbook and test IDs, exact closed approval-record digest and payload binding, exact operation and commit, four SQL hashes, workflow hash, and expected full remote-history hash. Phase-safe tests and separate apply, compensate, and reapply history gates pass locally. The workflow verifies post-operation role, forced-RLS, grant, membership, and feature-flag state, and uploads only when `steps.redact.outcome == 'success'`. These are fail-closed static controls. No target, provider backup, restoration, remote operation, hosted attack, post-operation catalog check, approved schema diff, or redacted workflow artifact exists. | Keep the target unassigned until the required authority and provider evidence exist, then execute each operation separately through the canonical preview route and independently inspect its redacted evidence and schema comparison. |
| SEC-1008A-12 | Closed locally; deployment binding remains | Current independent validator `PASS` | The independent final validator passes 20 of 20 expected files with zero errors and claimed state `BLOCKED`. This closes repository evidence integrity for the frozen local snapshot only. It does not bind a preview database, hosted application, backup restoration, or deployed commit because none exists. | Preserve the frozen inventory and require a new exact evidence-to-commit and database-snapshot binding after preview and staging execution. |

## Existing Defensive Strengths

The following controls are supported by local evidence:

1. I1Q mutation routes require a session-bound CSRF token and a trusted exact origin.
2. Generic resource responses remove answer-bearing and restricted-source fields.
3. Protected review reads require an accepted assignment, actor, role, purpose, and exact revision hash.
4. Finalization context is server-derived and bound to actor, session, release, and channel.
5. Consumer feature flags are exact and false by default.
6. All 52 migration tables enable and force RLS.
7. Database roles derive from server-side memberships and not a caller-supplied role setting.
8. Answers and restricted references use separate tables and purpose-scoped readers.
9. Audit sequence, actor, timestamp, prior hash, and event hash are database-generated and audit rows are immutable.
10. The local Class D matrix rejects encoded attempts to smuggle protected fields.
11. The in-flight identity adapter locally rejects wrong issuer, wrong audience, anonymous identity, expiry, browser role claims, user mismatch, inactive identity, and empty app roles.
12. The in-flight identity-capability migration locally applies, reapplies, compensates, and reapplies with all feature flags off.
13. The frozen preview workflow pins third-party actions, limits repository permissions to read, serializes migration runs, separates secret-free validation from step-scoped secrets, binds the closed approval record plus exact operation, commit, four SQL hashes, workflow hash, and full remote-history hash, requires backup and restore identifiers, checks each operation stage, certifies roles, RLS, grants, and flags after operations, and gates artifact upload on successful redaction and inventory. It remains fail closed while its target is unassigned.
14. Draft mutation now requires the client-observed SHA-256 through `If-Match`; a local two-writer regression returns `409` to the stale writer and preserves the accepted edit.
15. The browser session route now emits only the closed minimal actor and session projection, and an independent synthetic probe confirmed that internal identity trace and credential evidence are absent.
16. Non-demo static HTML and JavaScript now fail closed unless an explicit static-access adapter grants the request; local demo remains loopback-only.
17. Logout now has a fail-closed canonical revocation composition point, and a synthetic old-bearer regression passes after injected revocation.
18. The local logout UI clears in-memory workspace state, disables controls, and focuses a deterministic signed-out state without persisting protected browser data.
19. The readiness route fails closed unless identity, static access, logout, datastore, migration, audit, and all-flags-off gates are explicitly satisfied.

These strengths are candidates for preview verification, not proof of deployed operation. The frozen local evidence inventory now validates with zero errors and an explicit `BLOCKED` state.

## Security Gate To Remove The Veto

1. Pin the exact MissionMed HQ, WordPress handoff, proxy, I1Q, migration, and infrastructure commits that staging will run.
2. Close or disprove SEC-1008A-03 through SEC-1008A-06 in the protected authentication runtime with regression tests.
3. Reconcile the proposed identity payloads, enforce one ratified closed contract, wire the canonical I1Q adapter, and pass issuer, audience, expiry, revocation, role, identity continuity, outage, logout, and replay fixtures.
4. Ratify the locally passing split-role design, then approve the exact application workflow grants and transaction-local actor binder.
5. Populate and ratify the fail-closed preview contract with a real provider backup identity, tested restore references, exact authority and candidate hashes, and the expected remote-history hash. Then apply through the canonical preview pipeline, run the RLS matrix as actual runtime and adversarial roles, compensate, reapply, and compare schema state.
6. Deploy the exact tested commit to an authenticated non-localhost staging host.
7. Run all staging rows in `auth_attack_matrix.md`, `rls_attack_matrix.md`, and `answer_isolation_results.md` and capture redacted evidence.
8. Verify secure headers, cookies, CORS, caches, logs, rate limits, monitoring, rollback, and backup restoration evidence.
9. Keep every student-content and consumer release feature flag off until independent security and governance gates clear.
10. Preserve the frozen zero-error local inventory, then generate and independently verify a new evidence-to-commit and database-snapshot binding after preview and staging execution.

Until every High gate is closed with environment-specific evidence, Security does not clear an achieved 1008A state.

============================================================
FILE: agents/ux_accessibility/accessibility_audit.md
============================================================
# I1Q-1008A Accessibility Audit

## Status

`SIMULATED LOCAL AUDIT. WCAG 2.2 AA CONFORMANCE NOT PROVEN.`

Candidate commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

This audit used exact-commit source, deterministic tests, and the Codex in-app browser. It did not use authenticated staging, real identities, Safari, Firefox, Edge, standalone Chrome, a screen reader, magnification software, switch control, voice control, or human participants.

## Candidate Fingerprints

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |

## Verdict

The exact local candidate has no observed critical or high accessibility defect in the tested synthetic matrix. The prior page-root reflow failure is closed locally. Structure, focus destinations, status roles, target geometry, component contrast, identifier wrapping, mobile context, pagination, and independent table scrolling are strong in the tested browser.

`ACCESSIBILITY RELEASE VERDICT: BLOCK`

This remains blocked because WCAG conformance requires the complete product and supported environments. Actual 200 and 400 percent zoom, text-spacing overrides, forced colors, full keyboard task completion, assistive technology, cross-browser behavior, authenticated staging states, and human validation have not been executed.

## Evidence Executed

- 287 local tests: 285 passed, 0 failed, 2 expected database skips.
- Focused UI suite: 19 of 19 passed.
- 17 workflows by 11 viewports: 187 cells.
- 16 states by 11 viewports: 176 cells.
- Mobile context: 68 phone workflow cells.
- Width-equivalent reflow simulation: 34 workflow and 32 state cells at 640 and 320 CSS pixels.
- Zero root-overflow, non-table escape, clipped-control, H1, duplicate-ID, broken-ARIA, state-role, state-focus, or busy-state failures.
- Zero visible targets below the WCAG 2.2 AA 24 by 24 minimum. Refresh measured 44 by 44 in every workflow cell.
- Zero pagination clipping, title-only hash disclosure, or incomplete exact physician hash presentation.
- Browser console warnings or errors: zero.

All scores and local pass statements in this packet are `SIMULATED`.

## Confirmed Local Strengths

### Structure and names

The shell has a skip link, complementary navigation, one main landmark, one H1, named live regions, named controls, fieldsets, labels, definitions, and named table regions at `public/index.html:11-88`. The 17-screen semantic scan found zero unnamed visible controls, unnamed regions, heading skips, or broken references.

### Focus and errors

All 17 workflow transitions focused `#screen-title`. All 176 deterministic state cells focused their labelled H2 and ended with `aria-busy="false"`. Initial authentication failure and distinct expired, revoked, and identity-provider outage states are defined at `public/app.js:521-560`. Full natural keyboard task completion remains external.

### Status messages

Polite and assertive live regions are defined at `public/index.html:72-88`. Every deterministic state used `role="status"` or `role="alert"` and exposed at least one recovery action. Screen-reader announcement timing and verbosity remain untested.

### Target geometry and focus visibility

No visible target measured below 24 by 24. Refresh remained 44 by 44 in all 187 workflow cells. Focus and forced-color rules are explicit in `public/styles.css`. Native checkbox visuals were evaluated through their associated labels and spacing, not treated as standalone 44-pixel controls.

### Component contrast

`--control-border: #7b8580` yields approximately 3.81:1 against white. Tested text, focus, status, sidebar, and mobile-menu pairs meet their applicable local thresholds.

### Reflow and tables

`.table-wrap` is now a positioned, bounded, independently scrolling region at `public/styles.css:516-525`. Corpus inventory, Extraction runs, Search and filters, and Audit trail all measured root width equal to viewport at 320 and 768. Their table scroll widths remained larger than their client widths. A direct touchpad-style gesture moved the Inventory table to `scrollLeft=300` while `window.scrollX` stayed zero.

### Exact identifiers

Full exact hashes wrap without `title` dependence. Physician review displayed a 64-character SHA-256 at 320 pixels with no root overflow from `public/app.js:1423-1427`. The regression assertions are at `tests/ui.test.mjs:462-468`.

### Mobile context

Actor and environment context were visible in all 68 phone workflow cells. The environment label computes to wrapping flex with 4-pixel row and 8-pixel column gaps from `public/styles.css:155-161`. The expanded 17-item workflow menu had no horizontal clip at 320, 375, 390, or 430.

## Repair Retest Results

| Prior finding | Current result | Acceptance evidence |
| --- | --- | --- |
| `A11Y-P0-001` page-root table overflow | `CLOSED LOCALLY` | Root width equaled viewport in all 187 workflow and 176 state cells; all eight targeted table-route checks preserved their internal scroller. |
| `A11Y-P1-002` inconsistent exact identity | `CLOSED LOCALLY` | Signed Physician decision now shows the full 64-character hash and wraps at 320. |
| `A11Y-P1-003` compact mobile environment text | `CLOSED LOCALLY` | Explicit 4 by 8 pixel wrapping gap is present and rendered at all four phone widths. |

## Open Findings

### A11Y-GATE-001: External accessibility evidence is absent

Severity: `RELEASE GATE`

No local scan proves VoiceOver, NVDA, JAWS, browser magnification, switch control, voice control, supported-browser rendering, text-spacing overrides, forced colors, or human usability.

Acceptance tests:

1. Execute `human_validation_protocol.md` against one exact authenticated staging build.
2. Complete every safety-critical workflow with keyboard and assigned assistive technology.
3. Repeat at native 200 percent zoom and 400 percent reflow, not only width-equivalent viewports.
4. Record exact browser, operating system, assistive technology, viewport, build, and synthetic fixture.

### A11Y-P1-002: Incomplete workflows prevent end-to-end accessibility certification

Severity: `HIGH PRODUCT GAP`

Validation-result inspection and incident creation are missing. Candidate disposition, privacy decision, rights resolution, distractor verdict, and assignment management remain read only or partial. A screen that does not exist cannot be certified for keyboard, error, focus, announcement, or assistive-technology behavior.

Acceptance tests:

1. Implement each governed workflow with semantic controls, explicit consequence, deterministic focus, and non-leaking recovery.
2. Add loading, empty, blocked, unauthorized, validation, conflict, and service-failure states.
3. Execute each path for the authorized and denied synthetic roles.
4. Re-run semantic, keyboard, AT, and responsive matrices against the exact immutable build.

### A11Y-P2-003: Role and navigation comprehension remains unproven

Severity: `MEDIUM`

All actors receive the same 17 navigation buttons at `public/index.html:28-45`. This is visually stable but can add cognitive and focus burden for novice or role-limited users.

Acceptance tests:

1. Present only authorized and relevant work without using client visibility as authority.
2. Preserve a predictable order and a route to broader read-only context where allowed.
3. Validate task start and navigation comprehension with novice, keyboard, and screen-reader participants.

## Contrast Results

| Pair | Approximate ratio | Local result |
| --- | ---: | --- |
| Ink `#18211d` on white | 16.48:1 | Pass |
| Muted `#5d6862` on white | 5.80:1 | Pass |
| Control border `#7b8580` on white | 3.81:1 | Pass for component boundary |
| Focus `#0c6fc2` on white | 5.16:1 | Pass |
| Sidebar focus `#9dccff` on `#202825` | 8.99:1 | Pass |
| Mobile menu border `#708078` on `#202825` | 3.63:1 | Pass |
| Green text on green soft | 6.44:1 | Pass |
| Blue text on blue soft | 5.99:1 | Pass |
| Amber text on amber soft | 5.51:1 | Pass |
| Red text on red soft | 6.35:1 | Pass |

Disabled controls were not used to establish a required contrast pass.

## WCAG 2.2 AA Evidence Map

| Criterion | Exact local evidence | Verdict |
| --- | --- | --- |
| 1.3.1 Info and Relationships | Landmarks, headings, labels, tables, fieldsets, and definitions are structural | Strong local evidence |
| 1.3.2 Meaningful Sequence | Logical source order in all 17 screens | Local pass |
| 1.4.1 Use of Color | Status text accompanies color and dots | Local pass |
| 1.4.3 Contrast Minimum | Tested text pairs pass | Local pass, cross-browser open |
| 1.4.10 Reflow | Zero root failures in 187 workflow cells and width-equivalent checks | Local pass, native zoom open |
| 1.4.11 Non-text Contrast | Control, focus, and status boundaries pass locally | Local pass |
| 1.4.12 Text Spacing | Required override was not executed | Unknown |
| 2.1.1 Keyboard | Native controls and deterministic focus exist | Partial, full task completion open |
| 2.1.2 No Keyboard Trap | No trap observed in pointer-driven local matrix | Partial, full keyboard run open |
| 2.4.1 Bypass Blocks | Skip link targets `#workspace` | Source verified, real keyboard run open |
| 2.4.3 Focus Order | Workflow and state focus destinations pass | Local pass |
| 2.4.7 Focus Visible | High-contrast focus rule exists | Local pass |
| 2.4.11 Focus Not Obscured | No tested focus destination was obscured | Local pass, external run open |
| 2.5.8 Target Size Minimum | No visible target below 24 by 24 | Local pass |
| 3.2.3 Consistent Navigation | Stable labels and order across screens | Local pass |
| 3.3.1 Error Identification | Deterministic error states identify the condition | Local pass for fixtures |
| 3.3.2 Labels or Instructions | Form controls are labelled | Local pass |
| 3.3.7 Redundant Entry | Not fully applicable to incomplete workflows | Unknown |
| 3.3.8 Accessible Authentication | Canonical authentication was not exercised | Unknown and release blocking |
| 4.1.2 Name, Role, Value | No unnamed visible control in semantic scan | Strong local evidence |
| 4.1.3 Status Messages | Live regions and status roles exist | Local pass, AT announcement quality open |

## Accessibility Conclusion

`LOCAL SYNTHETIC MATRIX: PASS`

`WCAG 2.2 AA CERTIFICATION: NOT PROVEN`

`RELEASE: BLOCK`

The current exact commit closes every locally actionable accessibility repair from the preceding audit. External and product-completeness gates remain mandatory.

============================================================
FILE: agents/ux_accessibility/human_validation_protocol.md
============================================================
# I1Q-1008A Human Validation Protocol

## Status

`PROTOCOL ONLY. NOT EXECUTED.`

Local candidate reference: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

The current 8.21 score and every score in the local packet are `SIMULATED`. This protocol is the path to human evidence. It must be executed against one exact authenticated staging build after the product entry criteria pass.

## Local Evidence Available To The Study Owner

- 287 tests with 285 pass, 0 fail, and 2 expected database skips.
- 19 of 19 focused UI tests.
- 187 workflow viewport cells with zero root-overflow or visible-control failures.
- 176 state viewport cells with zero rendering, role, focus, busy, overflow, clipping, or ARIA failures.
- 68 mobile-context cells with zero missing actor or environment context.
- 34 workflow and 32 state width-equivalent reflow cells with zero observed failures.
- Requested root, pagination, mobile-context, exact-hash, and mobile-spacing repairs closed locally.

This evidence does not prove authenticated staging, real identity behavior, assistive technology, supported browsers, actual zoom, or human usability.

## Purpose

Determine whether authorized internal users can complete the full I1Q workflow safely, efficiently, and accessibly. Measure task completion, consequential-error prevention, recovery, role comprehension, source and evidence comprehension, responsive behavior, keyboard behavior, and assistive-technology behavior.

## Entry Criteria

All criteria are mandatory:

1. Record the exact staging URL, immutable build commit, deployment run, database target, and evidence window. Commit `fd7ddcd` is local candidate evidence, not deployment proof.
2. Canonical entry, expiry, revocation, reauthentication, provider outage, logout, and browser Back behavior pass independent staging tests.
3. Role resolution, purpose-scoped reads, assignment gates, exact revision identity, and atomic stale-write rejection pass security tests.
4. All twenty required client tasks are implemented and available to their authorized synthetic roles.
5. The 187 workflow viewport cells and 176 state viewport cells remain free of page-root overflow, clipping, overlap, and target failure on the exact staging build.
6. Automated accessibility, full keyboard, native 200 and 400 percent zoom, text spacing, forced colors, and contrast checks have no critical or high defect.
7. Only synthetic non-clinical fixtures are loaded. Raw transcripts, patient information, student data, secrets, credentials, production records, and real answer content are prohibited.
8. Student, public, STAT, Drills, extraction, physician-enablement, and automated-publication flags remain false.
9. The privacy owner approves fixtures, logging, screenshots, and recording.
10. No test path can create a real medical approval or student-facing release.

Failure of an entry criterion returns the study to engineering. It is not a participant failure.

## Evidence Header

Record once per test round:

| Field | Required value |
| --- | --- |
| Evidence class | `HUMAN` after execution, never `SIMULATED` |
| Staging build | Exact approved commit and deployment run |
| Test window | Start and end with time zone |
| Browser | Product and exact version |
| Operating system | Product and exact version |
| Assistive technology | Product, version, and configuration |
| Viewport or zoom | Exact dimensions or magnification |
| Fixture | Immutable synthetic fixture ID and hash |
| Role fixture | Synthetic role name only |
| Participant | Anonymous study code only |
| Facilitator | Internal study owner |
| Recording | Approved yes or no with privacy decision |
| Deviations | Every departure from protocol |

Do not record credentials, tokens, private source text, answer keys, raw transcripts, student identifiers, participant medical information, or environment values.

## Participants

Recruit at least 12 people. No participant may count as more than two primary personas.

| Persona | Minimum | Required emphasis |
| --- | ---: | --- |
| Physician reviewer | 2 | Assignment, evidence, source boundary, conflict, decision safety |
| Medical educator | 2 | Authoring, distractors, concurrency, recovery |
| Editorial reviewer | 2 | Queue, assignment, rubric, immutable decision |
| Assessment scientist | 1 | Distractor quality, validation evidence, comparison |
| Privacy officer | 1 | Privacy classes, rights, restricted-source boundary |
| Release manager | 1 | Exact revision selection, gates, validation, blocked release |
| Novice operator | 2 | Orientation, terminology, task start, recovery |
| Power operator | 2 | Search, filters, repeated work, keyboard efficiency |
| Assistive-technology user | 4 | Keyboard plus screen reader, magnification, switch, or voice |
| Incident responder | 1 | Incident creation, containment, audit linkage |

A physician reviewer evaluates workflow usability only. Participation does not establish credential verification, medical governance, medical approval, or release eligibility.

## Access Configurations

Cover every configuration at least once and repeat safety-critical tasks in the first four:

1. macOS Safari with VoiceOver.
2. iOS Safari with VoiceOver at 390 pixels.
3. Windows Firefox with NVDA.
4. Windows Edge or Chrome with JAWS.
5. Keyboard only without a pointer.
6. Native browser zoom at 200 percent and reflow at 400 percent.
7. WCAG 1.4.12 text-spacing overrides.
8. Reduced-motion preference.
9. High-contrast or forced-colors mode.
10. Switch control or voice control for representative workflows.

Exercise 320 by 568, 375 by 667, 390 by 844, 430 by 932, 768 by 1024, 1024 by 768, 1280 by 720, 1366 by 768, 1440 by 900, 1728 by 1117, and 1920 by 1080. Every workflow must run at one narrow and one desktop viewport.

## Required Workflow Tasks

Use synthetic identifiers and neutral placeholder content. Do not teach the exact click sequence.

| # | Task | Primary role | Pass evidence |
| ---: | --- | --- | --- |
| 1 | Enter through canonical authentication and recover from expiry | Any authorized role | Safe return, correct identity, one announcement, deterministic focus |
| 2 | Interpret the role dashboard and identify the next due task | Every primary role | Correct task and blocker without unavailable destinations |
| 3 | Find a candidate using queue filters and search | Content operator | Correct candidate with stable context |
| 4 | Inspect a candidate and choose an allowed disposition | Content operator | Role-gated assignment, quarantine, or rejection |
| 5 | Verify source identity and lineage without opening raw source | Privacy officer | Correct source, hash, linkage, and restriction |
| 6 | Interpret privacy status and record a permitted decision | Privacy officer | Classes, owner, consequence, and audit are clear |
| 7 | Interpret rights status and resolve allowed use | Privacy officer | Allowed and prohibited uses are distinguished |
| 8 | Create and save a complete draft question | Medical educator | Correct answer, three distractors, rationales, explanation, and exact save |
| 9 | Edit distractor quality and record a verdict | Assessment scientist | Each wrong option retains its own misconception context |
| 10 | Review an evidence claim and locate authority, currency, and anchor | Editorial reviewer | Evidence identity and limits are explained correctly |
| 11 | Create, accept, reassign, and decline an editorial assignment | Editorial reviewer | Exact actor, revision, conflict, and audit are clear |
| 12 | Attempt physician assignment with valid and invalid prerequisites | Physician reviewer | Missing credential or governance fails closed |
| 13 | Create an immutable review event after confirmation | Editorial and physician reviewers | Decision, role, revision, and consequence are verified |
| 14 | Compare two exact revisions of one item | Reviewer | Pair and protected fields are correct for purpose |
| 15 | Assemble a release from one deliberately selected revision | Release manager | Wrong revision cannot enter membership |
| 16 | Inspect validation results and trace artifact and validator | Assessment scientist | Status, timestamp, validator, hash, and evidence are understood |
| 17 | Create and contain a synthetic incident | Incident responder | Severity, owner, containment, and audit linkage are clear |
| 18 | Trace a state change through the audit trail | Auditor or read-only role | Sequence, actor, object, and hash meaning are correct |
| 19 | Log out and test browser Back | Any authorized role | Session closes and protected content cannot reappear |
| 20 | Recover from wrong-role, unauthorized-record, and revoked states | Affected roles | No leakage and one safe next action |

## Concurrency And Error Tasks

1. Load one draft in two sessions, save in one, and attempt the stale save in the other.
2. Preserve the stale editor's volatile input and explicitly compare, reapply, or discard it.
3. Switch the correct option after entering distractor rationales.
4. Attempt cross-item comparison and wrong-revision release selection.
5. Submit a review after assignment revocation or exact-hash change.
6. Trigger timeout, offline, 401, 403, 409, 422, 429, and 5xx states.
7. Refresh during a pending mutation and verify exactly-once behavior.
8. Request an unauthorized direct URL and inspect page, history, announcements, and cache.

Every rejected mutation must leave prior server state unchanged and provide a recoverable, non-leaking explanation.

## State Matrix

Exercise each state through a natural staging condition, not only a fixture selector:

- Loading.
- Empty.
- Blocked.
- Unauthorized.
- Expired session.
- Revoked session.
- Wrong role.
- Provider outage.
- Partial source.
- Privacy blocked.
- Rights blocked.
- Expired evidence.
- Review conflict.
- Stale edit.
- Concurrent edit.
- Extraction queued, running, failed, and resumable.
- Validation warning and failure.
- Corrupted artifact.
- Feature disabled.

Each state must name what happened, what did not change, the responsible owner, and one safe next action.

## Accessibility Procedure

For every assigned task, record:

- Complete keyboard operability with visible focus and no trap.
- Logical focus order and restoration after menus, dialogs, errors, and refresh.
- Correct accessible name, role, value, state, and relationship.
- Heading and landmark navigation that communicates workflow and state.
- One useful announcement per asynchronous change.
- No reliance on color, hover, pointer precision, `title`, or visual position alone.
- Reflow without page-root horizontal movement at 320 CSS pixels.
- Text and controls at native 200 percent and content at 400 percent.
- Component and focus contrast consistent with WCAG 2.2 AA.
- Target size and spacing consistent with criterion 2.5.8.
- Accessible tables, overflow regions, forms, errors, confirmations, and identifiers.
- Reduced-motion, text-spacing, and forced-colors behavior.

An accessibility barrier to a safety-critical task is critical severity.

## Measures

| Measure | Method |
| --- | --- |
| Completion | Success, assisted success, failure, or safety stop |
| Critical error | Wrong item, wrong revision, unauthorized exposure, unsafe approval, lost work, or duplicate write |
| Noncritical error | Recoverable navigation, terminology, or input mistake |
| Time on task | Start at task statement and stop at verified outcome |
| Assistance | Count and classify prompts |
| Recovery | Safe restoration without data loss |
| SEQ | Single Ease Question, 1 through 7 |
| Confidence | 1 through 5 confidence in item, role, state, and consequence |
| Comprehension | Explain source, evidence, gate, and immutable identity |
| Accessibility defect | WCAG criterion, technology, severity, and reproduction |
| Trust concern | Uncertainty about identity, environment, authority, source, or consequence |

## Exit Thresholds

All thresholds are mandatory. An average cannot hide a safety failure.

1. Safety-critical workflow completion: 100 percent unassisted after normal orientation.
2. Other workflow completion: at least 90 percent unassisted.
3. Critical errors, disclosures, wrong-item decisions, wrong-revision releases, and lost writes: zero.
4. Median SEQ: at least 5.5 of 7 for every persona and safety-critical workflow.
5. Median consequence confidence: at least 4 of 5.
6. Keyboard completion: 100 percent across all twenty workflows.
7. Screen-reader completion: 100 percent for safety-critical tasks and at least 90 percent overall.
8. Accessibility defects: zero critical or high and no unresolved WCAG 2.2 AA failure.
9. Responsive completion: no clipped or root-overflowing status, control, identity, source, or evidence content.
10. Independent post-repair score: at least 9.0 aggregate with no category below 8.5.

## Stop Conditions

Stop immediately if:

- Protected answer, restricted source, identity, or fixture credential appears outside its permitted purpose.
- A stale or wrong-role action succeeds.
- A participant can approve, release, or mutate the wrong item or revision.
- The test touches production or a non-synthetic record.
- A raw transcript, student record, patient identifier, secret, token, or environment value appears.
- A participant experiences a critical accessibility barrier or asks to withdraw.
- Logging or recording captures prohibited content.

Notify the approved privacy owner or incident owner through the approved process without copying prohibited payloads.

## Finding And Retest Rules

Every finding must include workflow, persona, role, viewport, browser, assistive technology, safe fixture ID, expected result, actual result, severity, WCAG criterion where applicable, and sanitized evidence.

After repair:

1. Re-run the exact failed task and configuration.
2. Re-run the adjacent role and authorization boundary.
3. Re-run keyboard and narrow-viewport versions.
4. Re-run stale-write or immutable-identity assertions when a mutation changed.
5. Obtain independent participant confirmation for every critical or high finding.

## Interpretation

Passing this protocol supports only an internal usability and accessibility gate. It does not establish medical approval, public rights clearance, student publication authorization, production deployment, or State C. Root must combine human evidence with canonical identity, datastore, RLS, security, deployment, monitoring, rollback, privacy, and governance evidence.

============================================================
FILE: agents/ux_accessibility/responsive_audit.md
============================================================
# I1Q-1008A Responsive Audit

## Status

`SIMULATED LOCAL REAL-BROWSER EVIDENCE`

Exact candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

`LOCAL RESPONSIVE MATRIX: PASS`

`RESPONSIVE CERTIFICATION: NOT PROVEN`

The local matrix is clean, including the repaired table routes. Certification remains open for actual browser zoom, supported browsers, real devices, authenticated staging content, assistive technology, and human validation.

## Source Fingerprints

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |

## Matrix Scope

- Workflows: 17.
- Viewports: 11.
- Workflow cells: 187.
- Deterministic states: 16.
- State cells: 176.
- Phone context cells: 68.
- Width-equivalent reflow cells: 34 workflow and 32 state.
- Visual spot checks: 320 by 844 and 1440 by 900.
- Browser console warnings or errors: 0.

## Viewport Results

| Viewport | Workflow cells | Root overflow | Outside non-table content | Clipped controls | AA target failures | Independent table cells |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 320 by 568 | 17 | 0 | 0 | 0 | 0 | 8 |
| 375 by 667 | 17 | 0 | 0 | 0 | 0 | 8 |
| 390 by 844 | 17 | 0 | 0 | 0 | 0 | 7 |
| 430 by 932 | 17 | 0 | 0 | 0 | 0 | 7 |
| 768 by 1024 | 17 | 0 | 0 | 0 | 0 | 6 |
| 1024 by 768 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1280 by 720 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1366 by 768 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1440 by 900 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1728 by 1117 | 17 | 0 | 0 | 0 | 0 | 0 |
| 1920 by 1080 | 17 | 0 | 0 | 0 | 0 | 0 |

Every viewport also had zero H1/title, duplicate-ID, broken-ARIA, refresh-geometry, and Search pagination failures.

## State Matrix

Each of the 16 deterministic states ran at all 11 viewports. Across 176 cells there were zero failures for:

- Expected state rendering.
- Alert or status role.
- Labelled H2.
- Focus on the state H2.
- `aria-busy="false"` completion.
- Root overflow.
- Visible control clipping.
- WCAG 2.2 AA target minimum.
- Duplicate IDs or broken ARIA references.
- Missing recovery action.

This is fixture evidence only. It does not replace natural staging failures.

## Root Overflow Repair

The repair adds `position: relative` to `.table-wrap` at `public/styles.css:516-525`. This makes the wrapper the containing block for absolute `.sr-only` table headers while preserving its independent `overflow-x: auto` scroller.

All targeted routes measured exact root containment:

| Workflow | Width | Viewport / document / body | Table client / scroll | Result |
| --- | ---: | ---: | ---: | --- |
| Corpus inventory | 320 | 320 / 320 / 320 | 256 / 644 | Pass |
| Extraction runs | 320 | 320 / 320 / 320 | 256 / 764 | Pass |
| Search and filters | 320 | 320 / 320 / 320 | 256 / 597 | Pass |
| Audit trail | 320 | 320 / 320 / 320 | 256 / 628 | Pass |
| Corpus inventory | 768 | 768 / 768 / 768 | 444 / 644 | Pass |
| Extraction runs | 768 | 768 / 768 / 768 | 444 / 764 | Pass |
| Search and filters | 768 | 768 / 768 / 768 | 444 / 597 | Pass |
| Audit trail | 768 | 768 / 768 / 768 | 444 / 628 | Pass |

A direct 320-pixel gesture outside the table left `window.scrollX=0`. After moving to the Inventory table, a horizontal gesture produced `table.scrollLeft=300` while root scroll remained zero. The data remains reachable through the intended scroller.

`ROOT OVERFLOW: CLOSED LOCALLY`

## Pagination

Search pagination passed all 11 viewports. Previous measured 82 by 44 and Next measured 56 by 44 at every width. Neither clipped or shrank. Reflow rules are at `public/styles.css:672-689`.

`PAGINATION CLIPPING: CLOSED LOCALLY`

## Mobile Context And Menu

At 320, 375, 390, and 430 pixels:

- Actor identity was visible before workflow content in all 68 workflow cells.
- Environment context was visible in all 68 workflow cells.
- Workflow toggle measured 102 by 44.
- Expanded navigation exposed all 17 items.
- Expanded navigation had zero horizontal clips.
- Root width equaled viewport width while expanded.
- Environment metadata used wrapping flex with 4-pixel row and 8-pixel column gaps.

`MOBILE CONTEXT: CLOSED LOCALLY`

## Identifier Presentation

No `.hash-text` depended on `title`. Full exact revision hashes wrapped without root overflow. Physician review showed the full 64-character SHA-256 at 320 pixels from `public/app.js:1423-1427`.

`TITLE-ONLY OR ABBREVIATED EXACT HASH: CLOSED LOCALLY`

## Width-Equivalent Reflow

The available browser surface did not expose native page zoom. The audit therefore ran a clearly labelled width-equivalent simulation:

| Simulation | CSS width | Workflow cells | State cells | Root, clipping, focus, or ARIA failures |
| --- | ---: | ---: | ---: | ---: |
| 200 percent width equivalent from 1280 | 640 | 17 | 16 | 0 |
| 400 percent width equivalent from 1280 | 320 | 17 | 16 | 0 |

This supports the repaired layout but does not prove WCAG zoom behavior. Native 200 and 400 percent browser zoom must be tested in supported browsers with text resizing, focus, and assistive technology active.

## Visual Inspection

At 320 by 844, the brand, workflow toggle, environment, H1, scenario selector, actor, 44-pixel refresh control, release status, selected context, and first dashboard metric were coherent without horizontal movement or overlap.

At 1440 by 900, the fixed operational hierarchy, sidebar, status, context, dashboard metrics, governance list, and guardrails remained aligned without incoherent overlap.

## Remaining External Gaps

1. Authenticated staging content and real synthetic role states.
2. Native 200 and 400 percent zoom.
3. Safari, Firefox, Edge, standalone Chrome, and real devices.
4. VoiceOver, NVDA, JAWS, magnification, switch, and voice control.
5. Text-spacing overrides, forced colors, and high-contrast modes.
6. Human task completion and comprehension.
7. Large persistent datasets that may change row, identifier, and error lengths.

## Responsive Conclusion

The narrow root-overflow repair works in the complete assigned local matrix. Root overflow, pagination clipping, mobile context, and exact-hash presentation are all closed locally. External certification remains pending.

============================================================
FILE: agents/ux_accessibility/ux_release_verdict.md
============================================================
# I1Q-1008A UX And Accessibility Release Verdict

## Verdict

`BLOCK`

`EVIDENCE CLASS: SIMULATED LOCAL AND STATIC ONLY`

The exact candidate passes the complete assigned local responsive, state, and semantic matrices. It is suitable for continued engineering and synthetic internal review. It is not cleared by this lane for authenticated staging certification, internal production, a responsive certification claim, or a WCAG 2.2 AA claim.

## Exact Candidate

Commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `src/platform.mjs` | `7cef0f9132822bb918df5f8be02d4a5a9ed4d057389ad79abde7f545638512ba` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |
| `tests/api.test.mjs` | `855905f3566d91abb18d023a1411ba80f01d34194ff6ba2c781f923d6a00ff16` |

## Score Verdict

All scores are `SIMULATED`.

| Measure | Immediate predecessor `483b0f7` | Exact candidate `fd7ddcd` | Target | Result |
| --- | ---: | ---: | ---: | --- |
| Aggregate | 8.04 | 8.21 | At least 9.0 | Fail |
| Minimum category | 6.8 task speed | 6.8 task speed | At least 8.5 | Fail |

The 0.17-point increase reflects observed table containment, full physician attestation identity, and mobile environment-spacing repairs. It does not credit external evidence.

## Exact Local Evidence

- `npm test`: 287 total, 285 passed, 0 failed, 2 expected database skips.
- Focused UI suite: 19 of 19 passed.
- Workflow matrix: 17 workflows by 11 viewports, 187 cells.
- State matrix: 16 states by 11 viewports, 176 cells.
- Mobile context matrix: 17 workflows by 4 phone viewports, 68 cells.
- Width-equivalent reflow simulation: 34 workflow and 32 state cells.
- Root horizontal overflow: 0 cells.
- Non-table outside content and clipped visible controls: 0 cells.
- State rendering, role, focus, busy, root, clipping, and ARIA failures: 0 cells.
- Semantic scan: zero H1, main, navigation, naming, region, heading, focus, or busy failures.
- Refresh geometry: 44 by 44 in all 187 workflow cells.
- Pagination: zero clipping or shrink failures in all 11 Search viewports.
- Mobile actor and environment context: zero missing cells.
- Title-only or abbreviated exact hash presentation: zero failures.
- Browser console: zero warnings or errors.

All browser evidence used the local synthetic demo. The 640 and 320 CSS-pixel reflow checks are width-equivalent simulations, not native browser zoom.

## Requested Repair Verdicts

| Finding | Exact-commit verdict | Basis |
| --- | --- | --- |
| Root overflow | `CLOSED LOCALLY` | Zero failures across 187 workflow and 176 state cells. All eight 320 and 768 table-route checks kept root width equal to viewport and retained wider independent table scrollers. |
| Pagination clipping | `CLOSED LOCALLY` | Previous and Next remained fully visible and 44 pixels high in all 11 Search viewports. |
| Mobile context | `CLOSED LOCALLY` | Actor and environment context were present in all 68 phone workflow cells; expanded menu had zero horizontal clips. |
| Title-only hash disclosure | `CLOSED LOCALLY` | No `.hash-text[title]`; exact hashes wrap visibly. |
| Physician attestation hash | `CLOSED LOCALLY` | Full 64-character SHA-256 rendered at 320 pixels. |
| Mobile environment spacing | `CLOSED LOCALLY` | Computed wrapping gap was 4 pixels vertically and 8 pixels horizontally at every phone width. |

## Safety-Positive Findings

- Static access and readiness fail closed.
- Student and consumer release controls remain visibly off.
- Protected answer and rationale content remains purpose scoped.
- Draft, comparison, and release operations bind exact immutable identity.
- Correct-option distractor-only controls clear, disable, and stop being required.
- Expired, revoked, outage, generic unauthorized, and signed-out states are distinct and focused.
- Cursor reads fail closed on overlap, snapshot drift, cursor loops, incompleteness, and more than 50000 rows.
- Source detail exposes lineage, rights, privacy, and availability without raw source.
- Audit UI distinguishes sequence-link continuity from cryptographic release proof.
- Wide tables now stay inside named independent scrollers without moving the page root.

## Blocking Findings

### 1. The governed workflow contract is incomplete

Candidate disposition, privacy decision, rights resolution, distractor verdict, assignment creation and reassignment, validation-result inspection, and incident creation remain missing or read only.

### 2. Role-specific UX is incomplete

All actors receive the same 17 navigation destinations. Client role labels are descriptive and do not establish authority.

### 3. Scale and durable recovery remain unproven

Cursor draining removes silent truncation but can aggregate up to 50000 rows in browser memory. Server-side search, request cancellation, deep links, saved views, return-to-queue state, protected compare-and-reapply, and immutable-decision confirmation remain open.

### 4. Canonical authenticated staging has not run

No canonical entry, real synthetic role fixture, expiry, revocation, reauthentication, logout invalidation, browser Back, persistent adapter, RLS denial, or staging write journey was executed by this lane.

### 5. External accessibility and human evidence is absent

No VoiceOver, NVDA, JAWS, full real keyboard task matrix, magnification, switch, voice, native 200 or 400 percent zoom, text-spacing, forced-colors, cross-browser, real-device, or human participant run exists.

### 6. Score thresholds are not met

The SIMULATED aggregate is 8.21, below 9.0. Task speed is 6.8, below the 8.5 category floor. A clean responsive matrix cannot offset missing workflows and scale evidence.

## Clearance Conditions

1. Complete all twenty workflows against one exact authenticated staging build.
2. Run positive and adversarial real synthetic role fixtures.
3. Prove bounded 1000, 10000, and 50000-row task performance and recovery.
4. Complete supported-browser, native zoom, text-spacing, forced-colors, keyboard, and assistive-technology testing.
5. Pass `human_validation_protocol.md` with zero critical or high finding.
6. Reach an independent 9.0 aggregate with no category below 8.5.
7. Keep student and consumer flags false throughout validation.

## Final Statement

`LOCAL RESPONSIVE REPAIR RETEST: PASS`

`UX AND ACCESSIBILITY RELEASE: BLOCKED`

Commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae` closes all requested local responsive and exact-identity findings. Product-completeness and external-certification gates still prevent a production claim.

============================================================
FILE: agents/ux_accessibility/ux_repairs.md
============================================================
# I1Q-1008A UX Repair Register

## Status

`SIMULATED RECOMMENDATIONS AND LOCAL RETEST RESULTS`

Exact candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

This document recommends repairs only. This agent did not edit product code, deploy, change flags, or use production data.

## Score Movement

| Measure | Immediate predecessor `483b0f7` | Current `fd7ddcd` | Target |
| --- | ---: | ---: | ---: |
| SIMULATED aggregate | 8.04 | 8.21 | At least 9.0 |
| Minimum category | 6.8 task speed | 6.8 task speed | At least 8.5 |

The current score increase is limited to observed local improvements. It does not credit unexecuted staging, identity, assistive-technology, cross-browser, or human work.

## Closed Local Repairs

### UX-CLOSED-001: Contain table overflow at the independent scroller

Status: `CLOSED LOCALLY`

Repair evidence:

- `.table-wrap` now has `position: relative`, bounded width, and independent horizontal overflow at `public/styles.css:516-525`.
- Regression assertions are at `tests/ui.test.mjs:437-448`.
- Root width equaled viewport in all 187 workflow and 176 state cells.
- Corpus inventory, Extraction runs, Search and filters, and Audit trail passed at both 320 and 768 while retaining wider table scroll widths.
- Direct 320-pixel gesture evidence kept `window.scrollX=0` and moved the Inventory table to `scrollLeft=300`.

Retest still required externally:

1. Native 200 and 400 percent browser zoom.
2. Keyboard and screen-reader operation of every named table region.
3. Supported browsers and real touch devices.

### UX-CLOSED-002: Show the full Physician attestation hash

Status: `CLOSED LOCALLY`

Repair evidence:

- The signed-decision field uses the full `revision.content_hash` at `public/app.js:1423-1427`.
- The browser rendered a 64-character SHA-256 at 320 pixels with no `title` and no root overflow.
- Regression assertion is at `tests/ui.test.mjs:462-468`.

### UX-CLOSED-003: Add mobile environment spacing

Status: `CLOSED LOCALLY`

Repair evidence:

- Wrapping flex and explicit 4-pixel row by 8-pixel column gaps are at `public/styles.css:155-161`.
- Computed values matched at 320, 375, 390, and 430.
- Actor and environment context remained present in all 68 phone workflow cells.

### UX-CLOSED-004: Preserve pagination, mobile context, target geometry, and full visible hashes

Status: `CLOSED LOCALLY`

Repair evidence:

- Pagination rules are at `public/styles.css:672-689`; all 11 Search viewports showed 44-pixel-high Previous and Next controls without clipping.
- Mobile layout is at `public/styles.css:963-1008`; the expanded 17-item menu had zero horizontal clips at all four phone widths.
- Refresh remained 44 by 44 in all 187 workflow cells.
- No `.hash-text[title]` or incomplete exact Physician hash remained.

## Open Product Repairs

### UX-P0-001: Complete the governed workflow contract

Priority: `P0 RELEASE BLOCKER`

Evidence:

- Candidate disposition remains disabled or read only at `public/app.js:1006-1028`.
- Privacy decision remains disabled in `public/app.js:794-846`.
- Rights resolution has no dedicated governed client command.
- Distractor verdict is disabled at `public/app.js:1146`.
- Editorial assignment creation, reassignment, and decline are absent from `public/app.js:1250-1344`.
- Validation-result inspection has no client workflow.
- Incident creation remains disabled at `public/app.js:1667-1681`.

Repair recommendation:

Implement the smallest complete, role-gated client journeys for candidate disposition, privacy decision, rights resolution, distractor verdict, assignment management, validation-result inspection, and incident creation. Each consequential command must show exact object and revision identity, consequence, authority, and fail-closed recovery.

Acceptance tests:

1. Authorized synthetic role can complete each journey against a persistent staging adapter.
2. Wrong role, wrong assignment, stale revision, missing evidence, and feature-disabled cases fail closed without leakage.
3. Loading, empty, blocked, error, conflict, and success states have deterministic focus and status announcements.
4. Every immutable event requires explicit confirmation of actor, object, revision hash, verdict, and consequence.
5. Re-run all 17 screen, 20 task, viewport, keyboard, and AT matrices.

### UX-P0-002: Prove canonical authenticated staging behavior

Priority: `P0 RELEASE GATE`

Evidence:

The local demo identifies `Local synthetic reviewer` and uses deterministic local fixtures. No canonical entry, real synthetic identity, role resolution, expiry, revocation, outage, reauthentication, logout invalidation, browser Back, RLS denial, or persistent write was exercised by this lane.

Acceptance tests:

1. Pin one immutable staging build, deployment run, database target, and fixture hash.
2. Run positive and denial personas for every role through canonical authentication.
3. Verify protected content disappears after logout, expiry, revocation, and browser Back.
4. Verify client labels never grant authority and server-side role resolution controls every protected action.
5. Keep all student and consumer flags off.

### UX-P1-003: Make dashboard and navigation role relevant

Priority: `P1`

Evidence:

Every actor receives the same 17 destinations at `public/index.html:28-45`. The dashboard at `public/app.js:626-681` summarizes the estate but does not prioritize a role-specific due queue.

Repair recommendation:

Use authoritative server capabilities to present a role-relevant start view, due work, and blockers. Keep authorization server-side. Do not imply that hidden navigation is a security control.

Acceptance tests:

1. Each persona sees its permitted next work and clear owner/blocker language.
2. Denied routes still fail closed by direct URL or API access.
3. Navigation order remains stable and keyboard efficient.
4. Novice and power users identify the next task without facilitator help.

### UX-P1-004: Bound large-result UX and preserve work context

Priority: `P1`

Evidence:

`listResource` drains pages and fails closed at 50000 rows at `public/app.js:382-424`. The 250-row regression at `tests/ui.test.mjs:470-508` closes silent truncation but not task performance. The browser still aggregates the full result.

Repair recommendation:

Add server-side filtering, sorting, query pagination, cancellation, stable deep links, return-to-queue state, saved views, and bounded bulk operations. Display result completeness and snapshot-change recovery.

Acceptance tests:

1. Complete representative find, review, return, and repeat tasks at 1000, 10000, and 50000 rows.
2. Meet agreed latency, memory, cancellation, and recovery budgets.
3. Preserve selected record and filter context after detail, error, refresh, and Back.
4. Detect snapshot drift without duplicating, omitting, or silently replacing rows.

### UX-P1-005: Add protected stale-edit recovery and immutable-decision confirmation

Priority: `P1`

Evidence:

Exact `If-Match` and stale rejection protect writes, but the local stale state does not provide a protected compare-and-reapply journey. Editorial and physician decisions do not provide a final confirmation that repeats exact identity and consequence.

Repair recommendation:

Preserve volatile edits in memory, fetch the current purpose-scoped revision, and offer Compare, Reapply, or Discard without automatic merge. Add an accessible confirmation for immutable review events.

Acceptance tests:

1. Two sessions create a real 409 against synthetic staging data.
2. The stale editor retains unsaved input without browser storage.
3. Compare shows only authorized protected fields and exact old/new hashes.
4. Reapply creates a fresh draft and never overwrites the newer revision.
5. Immutable review confirmation names actor, assignment, exact hash, verdict, and consequence.

### UX-P1-006: Execute external accessibility and human validation

Priority: `P1 RELEASE GATE`

Evidence:

The local matrix did not use VoiceOver, NVDA, JAWS, magnification, switch, voice, native 200 or 400 percent zoom, text-spacing overrides, forced colors, supported-browser combinations, real devices, or human participants.

Acceptance tests:

1. Execute `human_validation_protocol.md` against the exact staging build.
2. Achieve 100 percent keyboard completion for all twenty tasks.
3. Achieve 100 percent AT completion for safety-critical tasks and at least 90 percent overall.
4. Record zero critical or high accessibility defect.
5. Obtain an independent SIMULATED score of at least 9.0 with no category below 8.5 before replacing it with human results.

## Recommended Order

1. Complete governed client workflows.
2. Integrate and verify canonical authenticated staging with synthetic roles.
3. Add scale, context preservation, and stale-edit recovery.
4. Run supported-browser, zoom, keyboard, and assistive-technology validation.
5. Run human validation and rescore independently.

The locally actionable responsive findings requested for this retest are closed. None of the remaining recommendations should be credited as complete until its acceptance evidence exists.

============================================================
FILE: agents/ux_accessibility/workflow_audit.md
============================================================
# I1Q-1008A Workflow Audit

## Status

`SIMULATED LOCAL AND STATIC EVIDENCE ONLY`

Refreshed on 2026-07-15 against exact candidate commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae`. No authenticated staging session, real identity, real role fixture, assistive technology, production record, raw transcript, student data, or human participant was used.

## Audited Candidate

Candidate state: `IMMUTABLE PRODUCT COMMIT`

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `src/platform.mjs` | `7cef0f9132822bb918df5f8be02d4a5a9ed4d057389ad79abde7f545638512ba` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |
| `tests/api.test.mjs` | `855905f3566d91abb18d023a1411ba80f01d34194ff6ba2c781f923d6a00ff16` |

## Executive Verdict

The exact candidate closes the prior page-root overflow, duplicate physician-hash, and mobile environment-spacing findings. The full 17 by 11 workflow matrix and 16 by 11 state matrix are locally clean for root overflow, visible clipping, WCAG 2.2 AA target minimums, heading count, duplicate IDs, and broken ARIA references.

Current simulated aggregate: `8.21 / 10`. Minimum category: `6.8 / 10` for task speed. The target of 9.0 aggregate and 8.5 minimum category is not met.

`WORKFLOW RELEASE VERDICT: BLOCK`

The remaining blockers are incomplete governed workflows, non-role-specific navigation, unproven durable scale and recovery, canonical authenticated staging, real synthetic identity and role fixtures, cross-browser execution, assistive-technology execution, and human validation.

## Evidence Executed

- `npm test`: 287 total, 285 passed, 0 failed, 2 expected disposable-database skips.
- `node --test tests/ui.test.mjs`: 19 of 19 passed.
- Local real-browser workflow matrix: 17 workflows by 11 viewports, 187 cells.
- Local real-browser state matrix: 16 states by 11 viewports, 176 cells.
- Mobile context submatrix: 17 workflows by 4 phone viewports, 68 cells.
- Width-equivalent reflow simulation: 34 workflow cells and 32 state cells at 640 and 320 CSS pixels.
- Semantic scan: 17 workflows with zero H1, main landmark, navigation landmark, unnamed visible control, unnamed region, heading-level, focus, or busy-state failures.
- Browser console: zero warnings or errors during the exact-byte run.
- Visual spot checks: 320 by 844 and 1440 by 900 with no incoherent overlap.
- Direct 320-pixel Inventory gestures: page root stayed at `scrollX=0`; the independent table moved to `scrollLeft=300`.

All browser evidence used the local synthetic demo. The width-equivalent checks are `SIMULATED` and are not native browser zoom evidence.

## Matrix Results

| Check | Result |
| --- | ---: |
| Workflow cells | 187 |
| Root-overflow failures | 0 |
| Visible content outside its permitted scroller | 0 |
| Clipped visible controls | 0 |
| Targets below the WCAG 2.2 AA 24-pixel minimum | 0 |
| H1 or workflow-title failures | 0 |
| Duplicate-ID cells | 0 |
| Broken-ARIA-reference cells | 0 |
| Refresh controls below 44 by 44 | 0 |
| Search pagination clipping or target failures | 0 |
| Title-bearing hash fields | 0 |
| Abbreviated exact physician hashes | 0 |
| Independent scrolling table cells | 40 |
| State cells | 176 |
| State rendering, role, focus, busy, clipping, or ARIA failures | 0 |
| Mobile workflow context cells | 68 |
| Missing mobile actor or environment context | 0 |

At both 320 and 768 pixels, Corpus inventory, Extraction runs, Search and filters, and Audit trail measured document and body width exactly equal to viewport width. Their table scrollers retained wider content:

| Workflow | 320 client / scroll | 768 client / scroll |
| --- | ---: | ---: |
| Corpus inventory | 256 / 644 | 444 / 644 |
| Extraction runs | 256 / 764 | 444 / 764 |
| Search and filters | 256 / 597 | 444 / 597 |
| Audit trail | 256 / 628 | 444 / 628 |

## Requested Repair Disposition

| Finding | Exact-commit verdict | Evidence |
| --- | --- | --- |
| Root/page horizontal overflow | `CLOSED LOCALLY` | Zero failures in 187 workflow and 176 state cells. `.table-wrap` is now the containing block at `public/styles.css:516-525`. All eight targeted 320 and 768 checks preserved independent table overflow without root movement. |
| Pagination clipping or shrinking | `CLOSED LOCALLY` | Previous and Next measured 82 by 44 and 56 by 44, respectively, with no clipping in all 11 Search viewports. Rules are at `public/styles.css:672-689`. |
| Mobile actor and environment context | `CLOSED LOCALLY` | Actor and environment context were present in all 68 phone workflow cells. The expanded 17-item menu had zero horizontal clips at 320, 375, 390, and 430. |
| Title-only or abbreviated exact hash | `CLOSED LOCALLY` | Zero `.hash-text[title]` instances. Physician review displayed a complete 64-character SHA-256 at 320 pixels from `public/app.js:1423-1427`. |
| Mobile environment spacing | `CLOSED LOCALLY` | Computed layout was wrapping flex with 4-pixel row gap and 8-pixel column gap at all four phone widths from `public/styles.css:155-161`. |

## Required Workflow Matrix

| # | Required workflow | Current local result | Evidence and remaining gap |
| ---: | --- | --- | --- |
| 1 | Authenticated entry | `PARTIAL, FAIL-CLOSED CONTRACT` | Static access, readiness, session, and distinct auth failures exist in `src/server.mjs:285-372` and `public/app.js:521-560`. Canonical staging entry was not exercised. |
| 2 | Role-specific dashboard | `PARTIAL` | Dashboard renders at `public/app.js:626-681`, but every actor receives the same navigation at `public/index.html:28-45`. |
| 3 | Candidate queue | `LOCAL PASS, EMPTY FIXTURE` | Candidate triage renders at `public/app.js:998-1047`. The demo fixture has zero candidates. |
| 4 | Candidate details and disposition | `PARTIAL, READ ONLY` | Detail selection exists, while assignment, quarantine, and rejection remain disabled at `public/app.js:1006-1028`. |
| 5 | Source status without raw source | `LOCAL PASS` | Identity, lineage, rights, privacy, and restricted-source boundaries render at `public/app.js:729-792`. |
| 6 | Privacy status and decision | `PARTIAL, READ ONLY` | Class results render at `public/app.js:794-846`; the decision command remains disabled. |
| 7 | Rights status and resolution | `PARTIAL, READ ONLY` | Rights status is visible in Source detail, but no governed resolution workflow exists. |
| 8 | Question authoring | `LOCAL PASS` | Correct-option clearing and exact `If-Match` save are implemented at `public/app.js:343-356`, `1049-1105`, and `1910`. A real-browser check at 390 pixels selected A and confirmed all three A-only distractor fields were empty, disabled, and not required while B, C, and D remained enabled and required. |
| 9 | Distractor editing and verdict | `PARTIAL, READ ONLY` | Review rows render at `public/app.js:1108-1151`; verdict recording is disabled at `public/app.js:1146`. |
| 10 | Evidence claim review | `PARTIAL, READ ONLY` | Claim wording, authority, expiry, and status render at `public/app.js:1153-1194`; no governed claim-review mutation exists. |
| 11 | Editorial assignment | `PARTIAL` | Seeded exact assignments can be accepted and reviewed at `public/app.js:1250-1344`; creation, reassignment, decline, and queue work remain absent. |
| 12 | Physician assignment | `CORRECTLY BLOCKED, INCOMPLETE` | Role, credential, governance, evidence, and exact-hash gates render at `public/app.js:1346-1450`. No real credentialed identity journey was run. |
| 13 | Review event creation | `PARTIAL` | Editorial and medical decisions exist, but there is no final immutable-decision confirmation step. |
| 14 | Revision comparison | `LOCAL PASS` | One item and an exact same-item pair are enforced at `public/app.js:1452-1553`; protected differences remain omitted. |
| 15 | Release assembly | `LOCAL PASS, GATED` | Deliberate exact revision selection is at `public/app.js:1598-1665`; submission rechecks the selection at `public/app.js:2069-2078`. |
| 16 | Validation results | `MISSING CLIENT WORKFLOW` | The server accepts validation, but the client lacks validation list, detail, artifact hash, validator, and inspection tasks. |
| 17 | Incident creation | `MISSING` | Incident records are read only and creation remains disabled at `public/app.js:1667-1681`. |
| 18 | Audit trail | `LOCAL PASS` | Filters, sequence links, actor, object, and integrity disclaimer render at `public/app.js:1683-1740`. Persistence and scale were not exercised in a browser. |
| 19 | Logout | `LOCAL CONTRACT PASS` | Server composition is at `src/server.mjs:382-392`; client clearing and signed-out focus are at `public/app.js:574-624` and `2204-2218`. Canonical revocation and browser Back remain open. |
| 20 | Unauthorized, expired, revoked, and outage states | `LOCAL CONTRACT PASS, STAGING OPEN` | Distinct focused states are at `public/app.js:521-560`; natural staging conditions were not run. |

## State And Role Coverage

All 17 current screens rendered at all 11 viewports. All deterministic states rendered at all 11 viewports: `loading`, `empty`, `blocked`, `unauthorized`, `error`, `partial-source`, `privacy-blocked`, `rights-blocked`, `expired-evidence`, `review-conflict`, `stale-edit`, `concurrent-edit`, `extraction-queued`, `extraction-running`, `extraction-failed`, and `extraction-resumable`.

Every state cell ended with `aria-busy="false"`, used an alert or status role, focused its labelled H2, and exposed at least one recovery action. This proves deterministic local rendering only.

| Persona | Local strength | Remaining gap |
| --- | --- | --- |
| Physician reviewer | Explicit credential, assignment, evidence, conflict, governance, and full exact-hash gates | No canonical credentialed identity or real assignment queue |
| Medical educator | Correct-option safety and stale-write prevention | No protected compare-and-reapply recovery |
| Editorial reviewer | Purpose-scoped content and exact assignment gates | No role dashboard, reassignment, decline, or immutable confirmation |
| Assessment scientist | Clear distractor and evidence criteria | No distractor verdict or validation-results workflow |
| Privacy officer | Complete privacy-class and source-boundary presentation | No privacy or rights decision workflow |
| Release manager | Deliberate exact revision selection and visible gates | No validation-results journey or staging release evidence |
| Novice operator | Stable labels, focus, and recovery copy | Seventeen destinations remain visible without role guidance |
| Power operator | Cursor draining removes silent 200-row truncation | No server-side search, saved views, deep links, cancellation, or bulk work |
| Assistive-technology user | Strong native semantics and deterministic focus | No real AT, magnification, voice, switch, or full keyboard task validation |
| Incident responder | Read-only incident and audit context | No incident creation or containment action |

Client role labels are descriptive only and must never be treated as authority.

## Source, Evidence, And Scale

Source lineage remains exact and raw source stays absent from the generic shell. Transcript availability is explicit. Claims expose authority, expiry, and status. Full exact hashes wrap at 320 pixels without title reliance.

Resource reads drain cursor pages with snapshot, duplicate, loop, completeness, and 50,000-row fail-closed checks at `public/app.js:382-424`. A 250-row regression passes at `tests/ui.test.mjs:470-508`. This closes silent 200-row truncation. It does not prove usable performance at 1,000, 10,000, or 50,000 rows because the client still aggregates all returned rows in memory and lacks server-side query, request cancellation, safe deep links, and durable return-to-queue state.

## Workflow Verdict

`BLOCK FOR AUTHENTICATED STAGING AND HUMAN CERTIFICATION`

The candidate is locally coherent and the requested responsive repairs are closed. Product workflow completeness and external validation still prevent release certification.

============================================================
FILE: I1Q_1008A_ACCESSIBILITY.md
============================================================
# I1Q-1008A Accessibility

## Verdict

`PASS LOCAL AUTOMATED AND BROWSER HEURISTICS`

`WCAG 2.2 AA CONFORMANCE NOT PROVEN`

`AUTHENTICATED STAGING ACCESSIBILITY: NOT RUN`

The verdict is bound to product commit `fd7ddcd7688a0fc89cc4fc1320806220221046ae` and local synthetic content only.

## Evidence

- Full Node estate: 287 total, 285 pass, zero fail, two intentional database-target skips.
- Focused UI suite: 19 of 19 pass.
- Workflow matrix: 17 workflows by 11 viewports, 187 cells.
- State matrix: 16 states by 11 viewports, 176 cells.
- Mobile context matrix: 68 cells.
- Width-equivalent reflow: 34 workflow and 32 state cells.
- Root overflow, non-table outside content, clipped controls, pagination clipping, and targets below 24 pixels: zero.
- Duplicate IDs, broken ARIA references, unnamed controls or regions, heading skips, and focus failures: zero.
- Refresh control: 44 by 44 in all 187 workflow cells.
- Browser console warnings or errors: zero.
- Full immutable hashes are visible and wrap without title-only disclosure.

The local audit found strong landmarks, labels, headings, live regions, focus destinations, status messages, target geometry, component contrast, reduced-motion rules, and forced-color rules. The table containment repair preserves named independent keyboard and touch scroll regions without moving the page root.

## External Gate

No VoiceOver, NVDA, JAWS, magnification, switch, voice control, full keyboard task matrix, native 200 or 400 percent zoom, text-spacing override, supported-browser matrix, real device, authenticated staging, or human participant run exists.

The 640 and 320 CSS-pixel checks are explicitly width-equivalent reflow simulations. They are not native zoom proof.

The complete execution protocol is preserved in `agents/ux_accessibility/human_validation_protocol.md`. Until it is run against one exact authenticated staging build, no WCAG conformance or production-accessibility claim is authorized.

============================================================
FILE: I1Q_1008A_AGENT_CHARTERS.md
============================================================
# I1Q-1008A Agent Charters

## Shared Rules

- Agents work in disjoint directories and do not alter root reports.
- Agents must preserve edits by other workers.
- Agents may not apply migrations, deploy, push, change feature flags, edit MissionMed OS, or mutate protected systems.
- Agents must never read or emit secret values, environment values, credentials, raw transcripts, or student data.
- Evidence must distinguish observed fact, inference, missing evidence, and external blocker.

## Herschel

Owns `agents/herschel/`. Maps identity authority, datastore authority, deployment topology, protected runtime reconciliation, and dependent consumers before shared modification.

## Lorentz

Owns `agents/lorentz/`. Specifies the I1Q identity resolver, auth bootstrap, runtime database role, migration, RLS actor, rollback, and contract test vectors. It may propose application changes but does not edit product code.

## Security

Owns `agents/security/`. Builds the threat model and attack matrices for identity, auth, RLS, grants, answer/source isolation, deployment, headers, logs, and evidence integrity. It has veto authority over staging certification.

## UX And Accessibility

Owns `agents/ux_accessibility/`. Audits the current app, responsive matrix, keyboard and WCAG behavior, workflow clarity, simulated scores, and the human validation protocol. It must label simulations and cannot claim real human validation.

## Avicenna

Owns `agents/avicenna/`. Reproduces failures, records root causes, proposes the smallest safe corrections, and verifies regressions. It begins after Wave 1 findings exist.

## Darwin

Owns `agents/darwin/`. Optimizes only after correctness is established and must preserve behavioral parity.

## Release Reliability

Owns `agents/release_reliability/`. Defines and, when authorized by Root, observes preview, deployment, smoke, rollback, reapplication, monitoring, and operational runbook evidence.

## Independent Red Team

Owns `agents/red_team/`. Starts only after the integrated candidate exists. It independently attempts to disprove every achieved-state claim and has release veto authority.

============================================================
FILE: I1Q_1008A_AGENT_OWNERSHIP_MATRIX.md
============================================================
# I1Q-1008A Agent Ownership Matrix

## Root-Only Authority

Root Supervisor alone may edit root reports, product code, I1Q migrations, MissionMed OS authority, shared auth contracts, deployment definitions, feature-flag workflows, or integration manifests. Root alone may apply a preview migration, execute rollback or reapplication, deploy staging, push, or declare a state.

## Disjoint Agent Paths

| Owner | Exclusive write scope | Initial status |
| --- | --- | --- |
| Herschel | `agents/herschel/**` | Wave 1 assigned |
| Lorentz | `agents/lorentz/**` | Wave 1 assigned |
| Security | `agents/security/**` | Wave 1 assigned |
| UX and Accessibility | `agents/ux_accessibility/**` | Wave 1 assigned |
| Avicenna | `agents/avicenna/**` | Wave 2 pending |
| Darwin | `agents/darwin/**` | Correctness gate pending |
| Release Reliability | `agents/release_reliability/**` | Infrastructure gate pending |
| Independent Red Team | `agents/red_team/**` | Integrated-candidate gate pending |

## Root Paths

Root owns the 29 required `I1Q_1008A_*.md` reports, `i1q-question-platform/**`, any new I1Q-specific workflow or migration candidate, and final combined-handoff generation.

## Protected No-Touch Paths For Agents

- `/Users/brianb/MissionMed_OS/**`
- `/Users/brianb/MissionMed/_SYSTEM/**`
- `missionmed-hq/**`
- `wp-content/mu-plugins/**`
- `LIVE/**`
- production, preview, and staging databases
- GitHub workflows and deployment providers
- feature flags and secrets

Agents may inspect these paths read-only only where their charter requires it. Any proposed change is returned to Root with impact, tests, rollback, and authority evidence.

## Collision Rule

One writer owns each path at a time. Root does not edit an agent-owned report while that agent is active. Agents do not edit files outside their assigned directory.

============================================================
FILE: I1Q_1008A_AUTH_TESTS.md
============================================================
# I1Q-1008A Auth Tests

## Local Result

`PASS, LOCAL SYNTHETIC ONLY`

The final immutable product candidate at commit `fd7ddcd` passed the full Node estate with 287 tests, 285 passes, zero failures, and two intentional database-target skips. The focused browser UI regression suite passed 19 of 19 tests.

Covered locally:

- correct issuer, audience, subject, session, expiry, and remote user binding
- wrong issuer and audience
- service-role and anonymous-token rejection
- expired and future-issued tokens
- malformed and missing bearer
- provider and role-profile outage
- actor mismatch, revoked profile, and missing role
- forged browser role rejection
- mandatory `i1q.identity.v1` contract version
- mandatory canonical actor equality
- expired credential evidence
- physician placeholder remains unverified
- trusted-origin and bearer enforcement on writes
- CSRF rejection for missing, wrong, and hostile-origin requests
- fail-closed non-demo static access
- fail-closed readiness composition
- canonical logout composition and synthetic old-bearer rejection
- safe public errors and token-free failure audit events
- answer and restricted-source route isolation
- feature-gated internal and review routes

## Fixture Estate

The nonmedical fixture file contains platform administrator, editorial reviewer, unverified physician placeholder, privacy reviewer, release manager, read-only auditor, unauthorized student, unauthenticated visitor, revoked user, and expired session personas.

These UUIDs and identities are deterministic local fixtures. They are not MissionMed accounts, database grants, or medical credentials.

## Not Run

- canonical WordPress login to I1Q
- HQ handoff replay and nonce consumption
- real RANKLISTIQ role membership
- refresh and rotation
- real provider logout, global revocation, and old-tab denial
- canonical staging CORS and cookie behavior
- authenticated direct URL and browser journeys

No unrun item is reported as pass.

## Evidence Boundary

The synthetic fixtures prove the local adapter and server boundary behavior. They are not authenticated MissionMed users and do not close the canonical identity lifecycle. State A remains unachieved until the owner-ratified identity profile is composed with real nonproduction identities and its end-to-end attacks pass.

============================================================
FILE: I1Q_1008A_BASELINE.md
============================================================
# I1Q-1008A Baseline

## Ticket And Risk

- Ticket: `I1Q-1008A`
- Mission: `I1Q-1006`
- Product: MissionMed Question Platform
- Risk: `HIGH`
- Track: local protected integration
- Primary target: `AUTHENTICATED_STAGING_LIVE`
- Production migration and production deployment: prohibited by this ticket

## Source Integrity

| Check | Verified result |
| --- | --- |
| Worktree | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A` |
| Branch | `i1q-statquestions-1008a` |
| Source ref | `origin/i1q-question-platform-ultra-1007x-ma` |
| Source commit | `81273add2c0fe350d330902d229683662896a1b1` |
| Frozen engineering ancestor | `ba17e22` |
| Initial status | clean |
| Active Git lock | none |
| 1007X combined SHA-256 | `8fdc2acc486cbd220eaac573e766693e06084b70b4338709092e9bbd53b48a73` |

The required `I1Q_1007X_COMBINED_HANDOFF.md`, `I1Q_1006_COMBINED_HANDOFF.md`, and `_SYSTEM/STAT_CANON_SPEC.md` are tracked at the source commit. The prompt-referenced 1005 Foundation and 1004C Architecture Amendment handoffs are not tracked at the source commit. Read-only copies exist as pre-existing untracked material in the 1000 worktree and must not be silently adopted as release evidence.

## MissionMed OS

| Check | Verified result |
| --- | --- |
| MissionMed OS branch | `main` |
| MissionMed OS HEAD | `0e47d39d79edd9891896eb41e65183e855573cc1` |
| `origin/main` | same commit |
| Status | clean |
| Mission | `I1Q-1006`, active |
| Product registration | active internal build, student release blocked |
| Decision | DR-006 effective |

`CURRENT.md` was generated on 2026-07-15 and lists I1Q-1006 active with no MissionMed OS blocker. The mission record still points to the 1000 source worktree and 1007X branch. Brian's I1Q-1008A order explicitly creates this disposable continuation worktree; canonical mission routing must be updated before filing a production or staging-complete claim if authority requires the new branch to become the mission home.

## Authority Read

The following authorities were loaded before writes:

- MissionMed OS `BOOT.md`, `CURRENT.md`, mission record, product passport, authority index, and DR-006
- MR-079 Codex Execution Guardrails
- MR-078A Supabase Migration Protocol
- MR-078B Data Flow Contract
- Critical Systems Contract
- Matrix Runtime Lock Protocol
- STAT Canon Spec

`MM-AUTH-ARCH-001.md` is referenced by MR-078A, MR-078B, and MR-079 but is absent from its canonical path. This blocks any claim that a new identity contract is a completed canonical global auth architecture. DR-006 authorizes a dedicated additive I1Q adapter using the observed MissionMed identity chain without shared-auth weakening.

## Current Product Baseline

- The local application candidate exists and exposes 17 synthetic internal workflows.
- The additive I1Q PostgreSQL candidate contains 52 tables.
- The disposable PostgreSQL suite previously passed 13 of 13 and must be reproduced in this worktree.
- No preview or staging migration has been applied by I1Q-1008A.
- No authenticated staging URL has been established.
- No production URL is authorized for this ticket.
- The six existing I1Q feature flags are seeded false.
- Student release, STAT consumer, Drills consumer, transcript extraction, public access, and automated publication remain closed.

## Protected Baseline Hashes

| Protected input | SHA-256 |
| --- | --- |
| MissionMed OS `BOOT.md` | `59427f152e76c44ee0099d85d9974b7b9fd385614a1ca53628456da0cb65786d` |
| MissionMed OS `CURRENT.md` | `26534508f8cb6e1f3c7e3c5c58f319976c3e3fd1c49990697847cf6f559dd809` |
| MissionMed OS `missions.json` | `010a09de0595cd3c6d6245cd5936df34e32db21fbfb108d951f9ce425479f674` |
| MissionMed OS `authority_index.json` | `89d665d28ec722487e65dab48dcbf2664e9949ac4fa9bc6c595b9aed9d45a12d` |
| DR-006 | `8126c24b1d8f2b36439aad13d82e63b3f0cc5b3666abe29eb2f794ee5e068dae` |
| MR-079 | `c9968defe0fd55a6f8857cd05b1fc38f86bc7b6eb90c1486c90d5e106b0855ab` |
| MR-078B | `7aee8a4b282b1067b0979b8c7fdab536b719e0759101aa3a1dba3d438234879d` |
| MR-078A | `d86f6b869507e64a064aebb781aca448663a3ab245f03000aede22971b364d79` |
| Critical Systems Contract | `3d9074bf3ba663ae8c5c43f8ef565364098ab8fc238cc0308475bdceb75f1585` |
| Critical Systems Manifest | `c924788a9d433137609861b30a8ff572ddabfbdbdec44d90f703409c6f0d81c9` |
| Matrix Runtime Lock Protocol | `52552ac452aff1db7bb23cccf8a0d219802475c7813b71a72f729798592d1a3a` |
| Matrix Runtime Lock Manifest | `a357d5650e8523350d2842771cf2fd9080e117c72293d93d31dffb73f9bf396f` |
| STAT Canon Spec | `9b6956ea68ad7f51e64f4cf618ba4f1d332eefe6e546c5a22abda82d6d3590dc` |
| `missionmed-hq/server.mjs` | `870e6065fe8f19849d1dfc6484478d66b2ac6d74ee9e1db4fcda9be89b3a2db8` |
| WordPress auth handoff | `e1a68de6de4c4909598d7b2adc3da540d67c858a240d51c607b8d65d2199c9cf` |
| WordPress HQ proxy | `ac01316fe6d0877410054874e7caa69900be641cb799c4aadace40481e44b229` |
| Tracked Arena runtime | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` |
| Tracked STAT runtime | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` |
| Tracked Drills runtime | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` |
| Tracked Daily runtime | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` |
| I1Q 1007X migration candidate | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |

## Baseline Ruling

No shared auth file, protected runtime, migration history, database, deployment, secret, environment value, feature flag, or production system has been modified. Identity and datastore discovery may proceed. Shared-system and database writes remain gated on exact authority, target, backup, rollback, and dependency evidence.

============================================================
FILE: I1Q_1008A_DATASTORE_AUTHORITY.md
============================================================
# I1Q-1008A Datastore Authority

## Project And Schema

`VERIFIED`: I1Q belongs in additive schema `i1q` under the RANKLISTIQ data-flow authority. Production project mutation is prohibited for this ticket.

`OPEN`: the nonproduction project or branch and its migration owner are unassigned.

## Principal Separation

The local candidate now separates these database concepts:

| Principal | Local candidate | Browser reachable | Current grants |
| --- | --- | --- | --- |
| Migration owner | External and unassigned | No | Migration workflow only, once approved |
| `i1q_identity_profile_reader` | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` | Inherited by `authenticated` | Schema usage and exact execute on caller-scoped `resolve_current_identity()` only |
| `i1q_app_runtime` | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` | No | Deny all pending exact target and actor-binder authority |
| Operational auditor | Contract only | No | Unassigned |
| Rollback operator | Workflow authority only | No | Unassigned |

The name split prevents future application grants from becoming transitively available to every authenticated browser user.

## Actor Context

The identity-profile RPC uses `auth.uid()` and returns only the current actor's active membership and credential status. It does not accept actor, role, email, WordPress ID, or request headers as arguments.

`OPEN HIGH`: a dedicated server connection actor binder and exact `i1q_app_runtime` grant manifest are not owner-approved. The current `PostgresRepository` is partial and is not wired into the synchronous application service. This blocks real datastore integration.

## Authority Verdict

The additive migration and role contracts are locally reproducible but unapplied. Datastore authority is not closed for State B.

============================================================
FILE: I1Q_1008A_DEPENDENT_SYSTEMS.md
============================================================
# I1Q-1008A Dependent Systems

## Change Boundary

No shared auth, WordPress, Matrix, Arena, STAT, Drills, Daily Rounds, Railway, production Supabase, CDN, R2, or LIVE source was changed. The I1Q work is additive in its isolated branch.

## Regression Status

| System | Result | Reason |
| --- | --- | --- |
| MissionMed OS boot | Local authority read passed | OS was clean and current; no OS write |
| Matrix login and routes | Not run authenticated | No credentials; no shared change |
| Arena login and entry | Not run authenticated | No credentials; protected source drift remains |
| Current STAT entry | Not run authenticated | No credentials; no STAT change |
| STAT sealed pack and answer map | Local contract tests passed | No live retrieval; server-only invariant retained |
| Drills registry | Not run against live registry | No Drills change |
| Daily Rounds registry | Not run against live registry | No Daily change |
| WordPress relay and logout | Not run authenticated | No credentials; protected auth findings open |
| Shared Railway health | Read-only evidence only | No deployment or config change |
| Supabase RPC signatures | Local migration tests passed | No authorized preview target |

No dependent product is marked certified. Unavailable credentials are reported as blocked, not pass.

============================================================
FILE: I1Q_1008A_EXECUTION_PLAN.md
============================================================
# I1Q-1008A Execution Plan

## Objective

Close the authority and infrastructure gap between the verified local candidate and a genuinely authenticated staging system, without touching production or enabling student and consumer releases.

## Gate Sequence

1. Freeze source integrity, authority, protected hashes, agent ownership, and feature-flag baseline.
2. Map the observed canonical identity chain, datastore authority, deployment topology, and protected runtime drift.
3. Specify and implement an additive I1Q identity adapter with closed role fixtures and adversarial tests.
4. Resolve the exact RANKLISTIQ preview target, project-pinned migration path, runtime role, migration role, and auditor role.
5. Reproduce static and disposable PostgreSQL proofs before any external database action.
6. Apply only to an explicitly authorized preview or staging target after the complete MR-078A checklist passes.
7. Verify schema, grants, forced RLS, role matrix, negative attacks, migration history, and drift.
8. Execute preserving rollback on preview, prove the prior checksum, reapply, and reproduce the post-application proof.
9. Integrate the existing app with canonical identity and unprivileged datastore access using synthetic content only.
10. Deploy through the canonical GitHub staging route only if the provider, workflow, secrets, rollback, and target are authoritative.
11. Run staging security, accessibility, responsive, UI/UX, performance, dependent-system, and monitoring gates.
12. Run a fresh independent red team, repair actionable findings, rerun, then build the exact combined handoff.

## Stop Conditions

- Missing canonical credentials or authorized preview target
- Missing canonical staging provider or GitHub deployment workflow
- Authority conflict that cannot be resolved from Brian, DR-006, and active contracts
- Active Git operation
- Stale Matrix runtime warning
- Unexpected migration or schema state
- Critical or high unresolved security finding
- No viable rollback
- Any need to expose a secret or environment value in files, logs, screenshots, or handoffs

## State Claims

- State A requires a canonical identity contract and authenticated role fixtures with a passing attack suite.
- State B requires actual preview application, real RLS proof, executed rollback, and successful reapplication.
- State C requires an authenticated non-localhost staging URL and every stated staging gate.
- State D is a certification plan only. Production deployment is outside this ticket.

No lower-scope local proof may be used to claim a higher state.

============================================================
FILE: I1Q_1008A_IDENTITY_AUTHORITY.md
============================================================
# I1Q-1008A Identity Authority

## Root Ruling

`VERIFIED`: DR-006 authorizes an additive I1Q identity adapter and prohibits weakening or replacing shared MissionMed authentication.

`ROOT IMPLEMENTATION DECISION`: `i1q.identity.v1` is the only identity contract accepted by the I1Q server candidate. This decision is scoped to I1Q and does not recreate the missing global `MM-AUTH-ARCH-001` authority.

The selected candidate profile is:

1. The browser presents a current RANKLISTIQ Supabase bearer obtained through the existing MissionMed identity chain.
2. I1Q pins the RANKLISTIQ issuer and project.
3. Supabase Auth `/auth/v1/user` verifies the bearer remotely.
4. The lowercase verified Supabase UUID is both `canonical_actor_id` and `supabase_user_id`.
5. `wordpress_user_id` and email are optional trace data only. Neither can authorize a request.
6. I1Q roles come only from active `i1q.actor_role_memberships` rows returned by the caller-scoped database RPC.
7. A physician reviewer role is not medical approval authority. Credential, assignment, conflict, evidence, governance, and exact-revision gates remain separate.

## Prohibitions

- No email-only authorization.
- No WordPress role conversion into I1Q roles.
- No request-supplied actor or role.
- No derived or random UUID fallback.
- No localStorage identity authority.
- No service-role key in browser code.
- No shared HQ, WordPress, Arena, Matrix, STAT, or Drills auth mutation in this ticket.

## Open Authority

`OPEN`: `MM-AUTH-ARCH-001.md` is absent from the canonical path referenced by MR-078A, MR-078B, and MR-079.

`OPEN`: the exact token-acquisition, refresh, one-time handoff, global logout, and durable revocation journey has not been owner-ratified for an I1Q staging host.

`OPEN HIGH`: tracked HQ source appears to tolerate invalid session-expiry metadata, use a process-random signing fallback, and omit proved one-time nonce consumption. Herschel also observed credentialed arbitrary-origin CORS reflection on the live HQ endpoint. I1Q did not modify these protected systems.

These open items block authenticated staging. They do not invalidate the local fail-closed adapter tests.

============================================================
FILE: I1Q_1008A_IDENTITY_CONTRACT.md
============================================================
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

============================================================
FILE: I1Q_1008A_MIGRATION_PREVIEW.md
============================================================
# I1Q-1008A Migration Preview

## Candidate Files

- base migration: `20260715122434_i1q_1007x_question_platform.sql`
- identity and role migration: `20260715193625_i1q_1008a_identity_runtime_contract.sql`
- forward compensation: `20260715193845_i1q_1008a_compensating_disable.sql`
- controlled reapply: `20260715193955_i1q_1008a_runtime_reapply.sql`
- target manifest: `i1q-question-platform/deployment/preview-target.json`
- manual workflow: `.github/workflows/i1q-1008a-preview.yml`

## Local Validation

`PASS`:

- valid JSON target manifest
- valid YAML workflow
- secret-free source test and evidence-validation job
- step-scoped preview secrets
- timestamped migration names and transaction wrappers
- duplicate-object and idempotency checks
- destructive-statement scan
- forced-RLS and role/grant checks
- production-target denial
- backup and restore evidence gate
- exact operation, commit, SQL, workflow, approval-record, and remote-history binding
- separate apply, compensation, and reapplication history gates
- post-operation role, RLS, and feature-flag checks
- artifact redaction and inventory gate that must succeed before upload
- 9 of 9 focused migration/workflow contract tests

## External Status

`NOT RUN`: no workflow dispatch, project link, dry run, provider backup or restore verification, approved schema diff, migration apply, schema checksum, hosted attack suite, or remote evidence artifact exists because the manifest is intentionally `UNASSIGNED`.

The schema-only before snapshot is explicitly a fingerprint, not a database backup. A provider backup identity and tested restore reference are mandatory before any write operation.

============================================================
FILE: I1Q_1008A_MONITORING.md
============================================================
# I1Q-1008A Monitoring

## Required Staging Signals

The future staging deployment must emit aggregate, privacy-safe signals for:

- app and API health
- auth success, failure class, expiry, and revocation
- permission and RLS denials
- database connection and query errors
- migration version and drift
- audit append and chain failures
- suspicious answer and restricted-source access
- deployment, restart, and rollback events
- frontend exceptions
- latency, error rate, memory, connection use, and uptime

No token, cookie, email, answer, explanation, raw transcript, source URL, patient data, student data, or request body may enter logs.

## Alert Defaults

Proposed defaults, pending provider authority:

- immediate page: auth bypass, answer/source access anomaly, audit failure, migration drift, repeated 5xx, or rollback failure
- urgent ticket: elevated permission denials, provider outage, p95 latency regression, or frontend error spike
- daily review: role changes, deployment summary, backup status, and feature-flag checksum

## Runbooks Required

- auth outage and revocation
- datastore outage
- broken or partial migration
- forward compensation and reapply
- failed deployment
- leaked credential
- suspicious answer or source access
- audit-chain anomaly
- unavailable staging

## Current Status

`DESIGN ONLY`: no staging telemetry source, provider integration, dashboard, alert route, log sink, or tested runbook exists. Monitoring is not operational.

============================================================
FILE: I1Q_1008A_MR078A_AUTHORITY.md
============================================================
# I1Q-1008A MR-078A Authority

## Loaded Authority

The exact local Supabase Migration Protocol, Data Flow Contract, Codex Execution Guardrails, DR-006, and I1Q passport were read before migration work.

MR-078A requires a versioned forward migration, exact target, migration-history backup, review, rollback or compensation, verification, and activity evidence. MR-078B pins I1Q to an additive `i1q` schema in the approved RANKLISTIQ data-flow authority. It does not authorize a production migration in I1Q-1008A.

## Target Ruling

`VERIFIED`: the known RANKLISTIQ production project ref is `fglyvdykwgbuivikqoah`.

`VERIFIED`: no authorized preview project ref, database host, database name, provider backup identity, tested restore reference, GitHub `i1q-preview` environment, or required preview secret inventory was found.

`ROOT RULING`: the committed preview target manifest remains `UNASSIGNED` and explicitly forbids both known production project refs. Apply, compensate, and reapply must fail before connection until a separate nonproduction target, backup, restore evidence, and approval hash are committed.

## Workflow Ruling

No pre-existing I1Q or global preview workflow was found. The new I1Q-only workflow is the narrowest additive candidate:

- manual dispatch only
- exact authorization phrase
- GitHub environment gate
- commit-pinned actions and Supabase CLI
- project, host, database, and production-denial checks
- backup and restore evidence required before writes
- dry run before selected operation
- post-operation RLS, role, grant, and flag checks
- evidence redaction and checksummed artifact inventory

It is a fail-closed workflow candidate. It has not run and is not canonical until the target owner approves its exact environment and route.

============================================================
FILE: I1Q_1008A_OPEN_HUMAN_ACTIONS.md
============================================================
# I1Q-1008A Open Human Actions

1. Auth owner: publish or identify the canonical `MM-AUTH-ARCH-001` record.
2. Auth owner: select the I1Q bearer or HQ assertion profile and close expiry, CORS, nonce replay, refresh, logout, and revocation findings.
3. RANKLISTIQ owner: authorize a named nonproduction project or branch with exact project ref, host, database name, migration owner, and synthetic-only rule.
4. RANKLISTIQ owner: create and identify a provider backup, tested restore, and rollback operator.
5. Database owner: approve the `i1q_app_runtime` physical binding, actor binder, exact grants, auditor role, and connection-pool isolation proof.
6. GitHub owner: create the protected `i1q-preview` environment and required secrets after target approval.
7. Deployment owner: register the canonical authenticated staging provider, workflow, host, health route, rollback identity, and monitoring destinations.
8. Identity owner: provision synthetic non-student test accounts for each role and denial persona.
9. Protected runtime owners: reconcile the four tracked-versus-deployed runtime drifts under separate decision records.
10. Accessibility coordinator: execute the human validation protocol with real participants and assistive technology after staging exists.

No medical governance lead, physician approval, real transcript work, or student release action is requested by I1Q-1008A.

============================================================
FILE: I1Q_1008A_PATH_INDEX.md
============================================================
# I1Q-1008A Path Index

## Primary Packet

- Combined handoff: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_COMBINED_HANDOFF.md`
- Supervisor report: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_REPORT.md`
- Staging certification: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_STAGING_CERTIFICATION.md`
- Root Red Team verdict: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_RED_TEAM.md`
- External blockers: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_TRUE_EXTERNAL_BLOCKERS.md`
- Human actions: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_OPEN_HUMAN_ACTIONS.md`

## Authority And Baseline

- MissionMed OS boot authority: `/Users/brianb/MissionMed_OS/BOOT.md`
- Current mission routing: `/Users/brianb/MissionMed_OS/CURRENT.md`
- I1Q passport: `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- I1Q decision: `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- MR-078A: `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md`
- MR-078B: `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- MR-079: `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- Critical Systems Contract: `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- STAT canon: `_SYSTEM/STAT_CANON_SPEC.md`
- Baseline record: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/I1Q_1008A_BASELINE.md`

`MM-AUTH-ARCH-001.md` was referenced by authority records but was not present at its canonical path. That absence remains an external authority blocker.

## Product Candidate

- Production composition root: `i1q-question-platform/src/runtime.mjs`
- HTTP server: `i1q-question-platform/src/server.mjs`
- Identity adapter: `i1q-question-platform/src/identity-adapter.mjs`
- Identity and request normalization: `i1q-question-platform/src/auth.mjs`
- Shared contracts: `i1q-question-platform/src/contracts.mjs`
- Platform workflows: `i1q-question-platform/src/platform.mjs`
- PostgreSQL boundary: `i1q-question-platform/src/postgres-repository.mjs`
- Evidence validator: `i1q-question-platform/src/validate-evidence.mjs`
- API contract: `i1q-question-platform/openapi.json`
- Browser application: `i1q-question-platform/public/index.html`
- Browser controller: `i1q-question-platform/public/app.js`
- Browser styles: `i1q-question-platform/public/styles.css`
- Synthetic identity fixtures: `i1q-question-platform/fixtures/auth/i1q_authenticated_test_identities.json`

There is intentionally no `i1q-question-platform/runtime-adapters/` implementation. The staging composition root rejects startup until an owner-approved, hash-pinned persistent adapter exists.

## Datastore And Preview

- Base additive migration: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Identity and runtime-role migration: `i1q-question-platform/db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql`
- Forward compensation: `i1q-question-platform/db/rollback/20260715193845_i1q_1008a_compensating_disable.sql`
- Controlled reapply: `i1q-question-platform/db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql`
- Preview target manifest: `i1q-question-platform/deployment/preview-target.json`
- Manual preview workflow: `.github/workflows/i1q-1008a-preview.yml`

The preview target remains `UNASSIGNED`. These files were validated locally and on disposable PostgreSQL only. They were not applied to Supabase, preview, staging, or production.

## Test And Evidence

- Test estate: `i1q-question-platform/tests/`
- Application evidence: `i1q-question-platform/evidence/`
- Mirrored handoff evidence: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/evidence/`
- Evidence generator: `i1q-question-platform/scripts/generate_evidence.mjs`
- Combined handoff builder: `i1q-question-platform/scripts/build_combined_handoff.mjs`
- Combined validation: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/evidence/combined_handoff_validation.json`

## Specialist Reports

- Authority and dependencies: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/herschel/`
- Contracts: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/lorentz/`
- Security: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/security/`
- Diagnostics: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/avicenna/`
- Performance: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/darwin/`
- Release and reliability: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/release_reliability/`
- UX and accessibility: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/ux_accessibility/`
- Independent Red Team: `_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008A_STAGING_CLOSURE/agents/red_team/`

## Protected Read-Only References

- MissionMed OS: `/Users/brianb/MissionMed_OS/`
- Matrix, Arena, STAT, Drills, and Daily protected runtime paths are enumerated with hashes in `I1Q_1008A_BASELINE.md` and the Herschel reconciliation report.
- MissionMed HQ and WordPress auth paths are enumerated in the Herschel identity authority map.

No protected runtime, MissionMed OS authority record, shared auth file, production datastore, CDN object, or deployment target was modified by I1Q-1008A.

============================================================
FILE: I1Q_1008A_PERFORMANCE.md
============================================================
# I1Q-1008A Performance

## Verdict

`LOCAL SYNTHETIC BASELINE RECORDED; STAGING PERFORMANCE NOT CERTIFIED`

Darwin ran after correctness was established and made no product refactor. No performance SLO, hosted query plan, authenticated ingress result, or production claim is inferred from loopback measurements.

## Local Measurements

| Measure | Result | Evidence class |
| --- | ---: | --- |
| Full Node suite | 287 total, 285 pass, 0 fail, 2 DB skips | Local synthetic |
| Public assets raw | 139,559 bytes | Local static |
| Public assets gzip level 9 | 30,711 bytes | Offline estimate |
| `/api/health` p95, 300 samples | 0.276 ms | Single-process loopback |
| dashboard p95, 300 samples | 0.230 ms | Single-process loopback |
| inventory first page p95, 300 samples | 0.135 ms | Single-process loopback |
| `app.js` p95, 100 samples | 0.463 ms | Single-process loopback |
| 5,000 synthetic creates with audit | 54.527 ms | MemoryRepository |
| 20,000 synthetic creates with audit | 200.977 ms | MemoryRepository |
| 20,000-row first page p95 | 1.132 ms | MemoryRepository |

The exact environment, sample method, percentiles, memory figures, asset sizes, and candidate fingerprint are preserved in `agents/darwin/performance_before_after.json`.

## Static Findings

1. Darwin found that the browser originally stopped at the first 200-row page. Commit `483b0f7` closed that correctness defect: the client drains bounded cursor pages, rejects changing snapshots, cursor loops, overlapping IDs, invalid totals, incomplete responses, and results above 50,000 rows. A 250-row regression passes locally. Commit `fd7ddcd` then contained visually hidden table headers within each independent scroller, closing the measured page-root overflow without removing table access.
2. Several review and authoring screens still join complete collections in the browser. Correctness is locally preserved, but this is not a viable hosted high-cardinality query plan.
3. The reviewer queue query is caller-bound but unbounded, and its observed predicate order does not align with the current leading index column. A preview `EXPLAIN` is required before changing the index or query contract.
4. Static assets are small and dependency-free, but the local server uses `no-store` without compression or validators. Actual ingress behavior is unknown.
5. The largest maintainability surfaces are the browser application, evidence validator, and platform service. Four repeated-code clusters are candidates for later behavior-preserving extraction.

## Refactor Ruling

No optimization was applied because the useful changes require a representative datastore, authoritative pagination UX, and measured query plans. Changing contracts from local microbenchmarks would be premature.

Recommended order after staging authority exists:

1. Replace full client-side collection joins with server-filtered cursor workflows and explicit page controls before representative hosted scale testing.
2. Measure reviewer, assignment, audit, and release queries at 1,000, 10,000, and 50,000 synthetic rows.
3. Tune indexes only from captured plans and latency distributions.
4. Verify compression, cache policy, validators, and authenticated asset behavior at ingress.
5. Run concurrent edit, auth refresh, database interruption, restart, retry, and connection-pool tests.

## External Blockers

- no authorized preview datastore;
- no representative hosted corpus;
- no canonical identity integration;
- no staging URL or ingress;
- no database query plans, slow-query telemetry, connection metrics, or operational load evidence.

The local candidate remains suitable for continued engineering. It is not performance-certified for preview, staging, internal production, or student use.

============================================================
FILE: I1Q_1008A_PROTECTED_RUNTIME_RECONCILIATION.md
============================================================
# I1Q-1008A Protected Runtime Reconciliation

## Scope

This phase was read-only. No Matrix, Arena, STAT, Drills, Daily Rounds, WordPress, HQ, CDN, R2, or LIVE file was modified or deployed.

## Finding

Herschel confirmed four tracked protected runtime files differ from deployed CDN bytes:

- Arena
- current STAT
- Drills
- Daily Rounds

The deployed bytes and tracked bytes were preserved. Reachable same-name Git history did not establish a trustworthy source commit for the deployed bytes. The Critical Systems Manifest already notes source drift for at least one protected surface.

## Reconciliation Requirement

For each runtime, the owner must create a separate decision record containing tracked hash, deployed hash, cache-busted hash where applicable, deployment identity, current owner, boot/auth/route dependencies, expected or accidental drift ruling, preserved copies, and a guarded reconciliation and rollback path.

I1Q must consume deployed contracts only after that owner record identifies the authoritative source. I1Q-1008A does not repair or deploy any protected runtime.

## Matrix Lock

The Matrix runtime lock remains authoritative. I1Q did not edit a Matrix asset, so no stale override or guarded deploy was requested.

## Final Integrity Check

The complete baseline hash set was recalculated after the final local product repair. All MissionMed OS, MR-078A, MR-078B, MR-079, Critical Systems, Matrix lock, STAT canon, HQ, WordPress, Arena, STAT, Drills, Daily, and base I1Q migration hashes remained byte-for-byte equal to `I1Q_1008A_BASELINE.md`.

MissionMed OS remained clean on `main` at `0e47d39d79edd9891896eb41e65183e855573cc1`, equal to `origin/main`.

============================================================
FILE: I1Q_1008A_RED_TEAM.md
============================================================
# I1Q-1008A Independent Red Team

## Verdict

`VETO`

Highest achieved I1Q-1008A state: `NONE`

Highest honest engineering description: `LOCAL BLOCKED ENGINEERING CANDIDATE`

The independent review found no basis for State A, B, C, or D. It authorizes no migration, preview operation, staging deployment, feature enablement, production action, or student release.

## Reviewed Candidate

- Certification commit: `efaae9401a5bc659c8b0cc34b8736de05c958fb7`
- Certification tree: `f221add141b97ed33702c0437b84158d3ae66334`
- Product implementation commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`
- Branch: `i1q-statquestions-1008a`
- Reproduction boundary: isolated exact-commit export with no secrets or external target

## Independent Results

| Check | Result |
| --- | --- |
| Full Node estate | 287 total, 285 pass, zero fail, two disposable-database skips |
| Focused UI suite | 19 of 19 pass |
| Evidence validator | 20 of 20 files, zero errors, claimed state `BLOCKED` |
| Protected baseline hashes | 20 of 20 match, zero modified |
| Preview or staging runtime | Not run because no authorized environment exists |

The previous evidence-integrity finding `RT-1008A-004` is closed. The synchronized packet validates, inventories the candidate correctly, and makes no unsupported achieved-state claim.

## Active Findings

Active total: `13`

- Critical: `2`
- High: `6`
- Medium: `5`

The two Critical findings are:

1. No concrete owner-ratified, hash-pinned, persistent canonical runtime adapter exists.
2. No authorized preview target, staging deployment, or external operation exists.

The remaining findings cover absent MR-078A execution, unresolved protected shared-auth safety and lifecycle authority, unproved hosted RLS and grants, undeployed answer and source authorization, persistent-stack performance, operational rollback, live monitoring, protected runtime reconciliation, deployed OpenAPI conformance, accessibility certification, and incomplete authority closure.

## State Ruling

| State | Red Team result | Reason |
| --- | --- | --- |
| A | Veto, not achieved | Canonical identity is unratified and unwired; real lifecycle attacks are absent |
| B | Veto, not achieved | No authorized preview apply, hosted RLS, backup restore, compensation, or reapply |
| C | Veto, not achieved | No authenticated non-localhost persistent service or external certification |
| D | Veto, out of scope and blocked | State C is absent and production remains prohibited |

## Isolation Boundary

- Answer isolation: local synthetic pass; persistent staging not run.
- Restricted-source isolation: local synthetic pass; no source corpus connected; staging not run.
- Evidence integrity: exact-commit local pass.
- Accessibility and usability: local automated and simulated evidence only; external conformance not run.

## Required Rerun Trigger

Red Team may rerun only after one exact candidate includes owner-ratified identity and datastore authority, the complete persistent adapter and actor binding, protected auth closure with runtime parity, an authorized successful MR-078A validation and preview sequence, hosted RLS and rollback evidence, authenticated staging, monitoring, accessibility and performance evidence, and fresh Security and Release clearance.

The complete adversarial record is preserved under `agents/red_team/`.

============================================================
FILE: I1Q_1008A_REPORT.md
============================================================
# I1Q-1008A Root Supervisor Report

## Result

`BLOCKED EXTERNAL AFTER LOCAL COMPLETION`

Highest achieved success state: `NONE`

Highest honest description: `LOCAL BLOCKED ENGINEERING CANDIDATE`

Live operational deployment completion: `0 percent`. There is no preview apply, authenticated staging URL, production URL, deployed datastore, monitoring integration, or external rollback proof.

Independently executable local work: `COMPLETE`. Authority mapping, implementation, local tests, disposable PostgreSQL proof, workflow hardening, responsive repair, evidence generation, protected-file verification, and specialist reviews were completed without production or protected writes.

## Exact Candidate

- Worktree: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A`
- Branch: `i1q-statquestions-1008a`
- Verified source: `81273add2c0fe350d330902d229683662896a1b1`
- Final product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`
- Red Team reviewed certification candidate: `efaae9401a5bc659c8b0cc34b8736de05c958fb7`
- Identity contract: `i1q.identity.v1`
- Datastore target: `UNASSIGNED`
- Staging URL: none
- Production deployment: none and not authorized

## Work Completed

1. Verified source ancestry, MissionMed OS boot state, registration, authority, feature flags, Git safety, and protected hashes.
2. Implemented the strict RANKLISTIQ-bound I1Q identity adapter, token-free failure audit, closed session projection, origin and CSRF controls, logout composition, and fail-closed non-demo access.
3. Added a staging-only runtime composition root that refuses memory, synthetic, incomplete, unpinned, or noncanonical adapters.
4. Added separated identity-capability and application-runtime roles, forward compensation, controlled reapply, and a fail-closed manual MR-078A preview workflow.
5. Hardened exact revision, answer, source, stale-write, finalization, and role boundaries.
6. Repaired cursor completeness, authoring rules, revision comparison, release selection, session-state UX, logout clearing, full hash visibility, mobile context, pagination, and page-root table containment.
7. Regenerated a truthful machine evidence estate with claimed state `BLOCKED`.
8. Preserved all protected systems and reconciled tracked-versus-deployed runtime drift read only.

## Validation

| Check | Result |
| --- | --- |
| Full Node estate | 287 total, 285 pass, zero fail, two intentional DB-target skips |
| Focused UI | 19 of 19 pass |
| Focused 1008A migration and workflow | 9 of 9 pass |
| Base disposable PostgreSQL | 13 of 13 pass |
| Runtime-role, compensation, reapply PostgreSQL | 1 of 1 pass |
| Evidence validator | 20 of 20 files, zero errors, claimed state `BLOCKED` |
| Independent Red Team | Veto, 13 active findings: 2 Critical, 6 High, 5 Medium; prior stale-evidence finding closed |
| Root dependency audit | Zero production dependency vulnerabilities |
| JSON and YAML syntax | Pass |
| Protected baseline hashes | All unchanged |
| MissionMed OS | Clean `main`, HEAD equals `origin/main` |

The two default test skips are the same database lanes separately executed against fresh disposable local PostgreSQL. They are not hosted Supabase or preview proof.

## UI And Accessibility

- 187 workflow viewport cells: local pass.
- 176 deterministic-state viewport cells: local pass.
- 68 mobile-context cells: local pass.
- 66 width-equivalent reflow cells: local pass.
- Root overflow, visible clipping, focus, naming, heading, ARIA, and console failures: zero.
- Simulated score: 8.04 immediate predecessor, 8.21 final.
- Minimum simulated category: task speed, 6.8.
- Required 9.0 aggregate and 8.5 floor: not met.
- Native zoom, supported-browser, assistive-technology, authenticated-staging, real-device, and human validation: not run.

## State Ruling

| State | Result | Blocking fact |
| --- | --- | --- |
| A, identity authority resolved | Not achieved | No owner-ratified canonical lifecycle or real authenticated role attacks |
| B, preview datastore certified | Not achieved | No authorized target, apply, hosted RLS, rollback, or reapply |
| C, authenticated staging live | Not achieved | No provider, URL, persistent adapter, deployment, monitoring, or external certification |
| D, internal production candidate | Not achieved and outside deployment scope | State C absent; production not authorized |

## Protected Systems

No MissionMed OS authority record, shared authentication file, WordPress proxy, Matrix runtime, Arena runtime, STAT runtime, Drills runtime, Daily Rounds runtime, production datastore, Railway service, R2 or CDN object, feature flag, student data, transcript source, or secret was changed.

All I1Q student-content, student-release, STAT-adapter, Drills-adapter, transcript-extraction, physician-approval, public-access, and automated-publication controls remain off.

## External Blockers

1. Canonical `MM-AUTH-ARCH-001` and the owner-ratified I1Q acquisition, refresh, revocation, replay, logout, and role-removal lifecycle are absent.
2. No authorized synthetic-only preview or staging datastore, exact project identity, credentials, backup identity, or tested restore exists.
3. No approved application actor binder, complete persistent adapter, functional runtime grants, or pool-isolation proof exists.
4. No canonical protected GitHub environment, staging provider, deployment workflow, host, health route, rollback selector, or monitoring destination exists.
5. Protected HQ auth findings and four tracked-versus-deployed runtime drifts require their separate protected-owner processes.
6. Human and assistive-technology validation requires an authenticated deployed system and participants.

## Exact Next Action

The authority owners must first publish or identify the canonical identity record and authorize one named synthetic-only RANKLISTIQ preview target with backup and tested restore evidence. The database owner must then approve the actor binder and exact application grants. Only after those records are committed should the protected `i1q-preview` environment be configured and the workflow's `validate` operation run. No apply operation should occur until that validation artifact and schema diff receive the required independent approval.

============================================================
FILE: I1Q_1008A_RESPONSIVE.md
============================================================
# I1Q-1008A Responsive

## Verdict

`LOCAL RESPONSIVE MATRIX: PASS`

`RESPONSIVE CERTIFICATION: NOT PROVEN`

Exact product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`.

## Viewports

The 17-workflow matrix passed at:

- 320 by 568
- 375 by 667
- 390 by 844
- 430 by 932
- 768 by 1024
- 1024 by 768
- 1280 by 720
- 1366 by 768
- 1440 by 900
- 1728 by 1117
- 1920 by 1080

All 187 workflow cells and all 176 deterministic-state cells had zero page-root overflow, non-table outside content, clipped controls, target-size failures, duplicate IDs, broken ARIA references, refresh-geometry failures, or pagination failures.

## Repaired Table Boundary

The exact root-overflow cause was an absolute visually hidden table header whose containing block escaped the independent table scroller. `.table-wrap` now establishes the positioning context while retaining `overflow-x: auto`.

The four previously failing workflows passed at both 320 and 768 pixels:

| Workflow | 320 root | 768 root | Table scrolling |
| --- | --- | --- | --- |
| Corpus inventory | 320 of 320 | 768 of 768 | Preserved |
| Extraction runs | 320 of 320 | 768 of 768 | Preserved |
| Search and filters | 320 of 320 | 768 of 768 | Preserved |
| Audit trail | 320 of 320 | 768 of 768 | Preserved |

A direct gesture outside the table left root scroll at zero. A gesture inside the Inventory table moved its scroll position to 300 while root scroll remained zero.

## Other Closed Findings

- Pagination labels remained visible and controls remained 44 pixels high at every viewport.
- Actor and environment context remained visible in all 68 phone workflow cells.
- The expanded phone workflow menu exposed all 17 destinations with zero horizontal clipping.
- Exact revision hashes rendered all 64 characters and wrapped at 320 pixels.
- Mobile environment metadata retained explicit 4-pixel row and 8-pixel column gaps.
- Width-equivalent 200 and 400 percent reflow simulations passed 66 cells with zero failures.

## External Gate

Native zoom, Safari, Firefox, Edge, standalone Chrome, real devices, assistive technology, authenticated staging content, large persistent datasets, and human validation remain untested. The local matrix closes the measured source defect; it does not establish cross-browser or production certification.

============================================================
FILE: I1Q_1008A_RLS_CERTIFICATION.md
============================================================
# I1Q-1008A RLS Certification

## Disposable PostgreSQL Proof

`PASS, LOCAL DISPOSABLE TARGET`:

- original migration and attack estate: 13 of 13
- identity-capability, role-separation, compensation, and reapply estate: 1 of 1
- PostgreSQL: local disposable instance, no MissionMed data

The tests exercise forced RLS, direct table denial, answer and restricted-source denial, role and assignment boundaries, immutable audit behavior, legal transitions, compensation, and idempotent reapply.

The repaired role test proves:

- both I1Q roles are `NOLOGIN`, `NOINHERIT`, and `NOBYPASSRLS`
- neither role owns schema `i1q`
- neither role has direct table privileges
- `authenticated` can inherit only the identity-profile capability
- `authenticated` cannot inherit `i1q_app_runtime`
- the app runtime remains deny all
- all feature flags remain false

## Certification Boundary

`NOT CERTIFIED FOR PREVIEW OR STAGING`: the tests ran against disposable PostgreSQL, not an authorized Supabase preview. Real project defaults, migration history, auth claim propagation, pool reuse, grants, and every canonical role journey remain untested.

State B is not achieved.

============================================================
FILE: I1Q_1008A_ROLLBACK_AND_REAPPLY.md
============================================================
# I1Q-1008A Rollback And Reapply

## Mechanism

The rollback is a forward compensation. It never drops schema objects or deletes history. It:

1. requires the base identity migration and both separated roles
2. revokes `i1q_identity_profile_reader` from `authenticated`
3. invokes the existing data-preserving disable function
4. records one compensation and one schema version
5. leaves `i1q_app_runtime` deny all

The reapply requires compensation history, safe role attributes, the identity RPC, and every feature flag off. It restores only identity-profile capability membership and records one idempotent audit event.

## Local Execution Result

`PASS`: on a clean disposable PostgreSQL instance, base and 1008A migrations applied twice, compensation ran twice, and reapply ran twice. History remained present, compensation and reapply audit records were idempotent, no feature flag turned on, and browser reachability never extended to `i1q_app_runtime`.

## External Status

`NOT RUN`: no authorized preview baseline, provider backup, remote compensation, exact prior-state checksum, restore, or remote reapply exists. Local execution does not satisfy the ticket's real preview rollback gate.

============================================================
FILE: I1Q_1008A_STAGING_CERTIFICATION.md
============================================================
# I1Q-1008A Staging Certification

## Verdict

`NOT CERTIFIED`

Highest achieved I1Q-1008A state: `NONE`

Highest honest engineering description: `LOCAL BLOCKED ENGINEERING CANDIDATE`

The final local product candidate is additive, fail closed, tested, and suitable for continued integration work. It is not an authenticated staging application. No State A, B, C, or D claim is authorized.

## Gate Matrix

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| Source integrity | Pass | Required source and ancestry verified; scoped commits preserved |
| MissionMed OS boot | Pass read-only | OS clean and current at the recorded baseline; no OS write |
| I1Q registration | Active | Mission and product registration exist under DR-006 |
| Identity adapter | Pass local candidate | `i1q.identity.v1` rejects untrusted identity and role input |
| Canonical identity lifecycle | Blocked | No owner-ratified acquisition, refresh, revocation, logout, replay, or real test-user journey |
| Auth fixture estate | Pass synthetic | Ten deterministic nonmedical personas; no MissionMed account or medical authority claim |
| MR-078A workflow source | Pass local static | Manual project-pinned candidate is fail closed; target and approval provenance absent |
| Preview datastore | Not run | Target manifest remains `UNASSIGNED` |
| Migration apply | Not run externally | Zero preview, staging, or production applies |
| Forced RLS and grants | Pass local disposable only | Hosted roles, schema exposure, actor pooling, and target defaults untested |
| Compensation and reapply | Pass local disposable only | No provider backup, restore, remote compensation, or remote reapply |
| Persistent runtime adapter | Blocked | No approved hash-pinned adapter, actor binder, or functional grant manifest |
| Authenticated staging app | Not deployed | No provider, URL, health URL, build ID, deployed commit, or rollback identity |
| Answer isolation | Pass local synthetic only | No persistent finalization or deployed cross-user attack evidence |
| Restricted-source isolation | Pass local synthetic only | No source content connected and no deployed attack evidence |
| Accessibility and responsive | Local browser rerun recorded separately | No authenticated staging, assistive technology, cross-browser, or human conformance proof |
| UI and UX threshold | Not met | Simulated score remains below 9.0 or has a category below 8.5 |
| Performance | Local baseline only | No persistent stack, ingress, query plan, concurrency, or hosted SLO evidence |
| Monitoring | Design only | No telemetry backend, alert route, dashboard, burn-in, or runbook drill |
| Dependent systems | Protected files unchanged | Authenticated Matrix, Arena, STAT, Drills, Daily, and WordPress journeys blocked or not run |
| Protected runtime parity | Unresolved | Four tracked protected runtimes differ from deployed CDN bytes |
| Independent Red Team | Veto | Exact-commit rerun passed local reproduction, closed stale evidence, and retained 13 active findings |

## Local Candidate Strengths

- `npm start` refuses memory, synthetic, incomplete, unpinned, or noncanonical staging composition.
- Identity failure audit is mandatory and fails closed if its durable boundary is unavailable.
- The server awaits persistent adapter operations and requires identity, static-access, logout, readiness, finalization, and review-content resolvers.
- The database candidate separates migration ownership, caller-scoped identity capability, and deny-all application runtime capability.
- Preview operations require exact target, commit, SQL, workflow, approval, history, backup, restore, diff, postcondition, and redaction gates.
- Browser workflows preserve exact revision identity, stale-write protection, answer/source boundaries, pagination completeness, session distinctions, and independent table scrolling.
- All I1Q student, consumer, extraction, approval, public-access, and publication flags remain off.

## Certification Boundary

Local tests cannot substitute for the owner and environment facts required by the ticket. State A requires the canonical identity lifecycle and real authenticated role attacks. State B requires an authorized preview apply, hosted RLS attacks, rollback, and reapply. State C requires a deployed authenticated non-localhost service with real persistence, security, accessibility, monitoring, rollback, and Red Team clearance.

None of those external conditions exists in the available authority or environment. The correct result is `BLOCKED EXTERNAL` after completion of every independent local repair and artifact.

============================================================
FILE: I1Q_1008A_STAGING_DEPLOYMENT.md
============================================================
# I1Q-1008A Staging Deployment

## Discovery

`VERIFIED`: the repository had no I1Q staging application workflow, no Supabase project config, and no I1Q staging URL. The connected GitHub repository exposed only existing production-oriented environments and no approved `i1q-preview` environment.

`VERIFIED`: presence-only environment checks found no I1Q preview database, Supabase, staging host, or deployment credentials in the current shell. No value was read or recorded.

## Candidate Workflow

The only new GitHub workflow is a manual preview migration gate. It is not an application deployment workflow and cannot run while the target manifest is unassigned.

## Deployment Status

- staging provider: `UNASSIGNED`
- staging URL: `NONE`
- health URL: `NONE`
- build ID: `NONE`
- deployed commit: `NONE`
- configuration checksum: `NONE`
- rollback identity: `NONE`

No Railway command, manual upload, direct SQL, production migration, feature-flag change, or deployment occurred.

`VERDICT: NOT DEPLOYED`

============================================================
FILE: I1Q_1008A_STAGING_INTEGRATION.md
============================================================
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

============================================================
FILE: I1Q_1008A_STAGING_SECURITY.md
============================================================
# I1Q-1008A Staging Security

## Verdict

`VETO: NO I1Q-1008A SUCCESS STATE IS SECURITY-CERTIFIED`

The local candidate has strong fail-closed controls, but no authorized preview database, canonical authenticated I1Q journey, or non-localhost staging runtime exists. Local synthetic proof cannot satisfy the ticket's preview or staging attack gates.

The final independent Red Team review reproduced certification commit `efaae9401a5bc659c8b0cc34b8736de05c958fb7`, closed the prior stale-evidence finding, and retained its veto with 13 active findings: 2 Critical, 6 High, and 5 Medium.

## Verified Local Controls

- The final immutable product candidate at commit `fd7ddcd` passes 287 tests with 285 passes, zero failures, and two intentional database-target skips.
- Fresh disposable PostgreSQL runs pass 13 of 13 base attacks and 1 of 1 1008A runtime-role, compensation, and reapplication proof.
- The evidence validator passes all 20 expected files with zero errors and reports `BLOCKED`.
- Identity resolution pins the RANKLISTIQ Supabase project, rejects privileged keys, validates bearer claims remotely, and resolves I1Q memberships only through the caller-scoped database RPC.
- Browser or token role claims never create application authority.
- Identity failures are public-detail-free and emit token-free audit events.
- The browser session projection is closed to actor ID, roles, expiry, and request-verification state.
- Mutations require session-bound request integrity and exact trusted origin.
- Non-demo static content denies access without an explicit access adapter.
- Logout fails closed without the canonical revocation adapter; the local UI clears in-memory state after successful revocation.
- Readiness fails unless identity, static access, logout, datastore, migration, audit, and all-flags-off gates are explicitly true.
- Stale draft writes require an exact client-observed SHA-256 and fail without overwriting the accepted write.
- Public bundle scans found no answer map, restricted-source location, service credential, or raw-source field.
- The 1008A role migration rejects role-name collisions with unexpected ownership, membership, ACL, or direct privilege.
- `i1q_identity_profile_reader` has only caller-scoped identity capability; `i1q_app_runtime` remains deny-all and browser-inaccessible pending an authorized actor binder and grant manifest.
- The browser drains validated cursor pages, rejects changing snapshots and overlapping IDs, and passes a 250-row regression instead of silently stopping at the first 200 rows.
- Table scroll regions establish their own positioning context so visually hidden table headers cannot expand the page root. Direct browser checks passed the formerly failing table workflows at 320 and 768 pixels while preserving independent table scrolling.

## Preview Workflow Security

The unrun preview workflow is fail-closed and requires:

- a separate secret-free source validation job;
- step-scoped preview secrets;
- one exact authorized operation;
- exact candidate commit and SQL/workflow hashes;
- an exact separately committed approval record and digest;
- an approved complete remote migration-history hash;
- provider backup and tested-restore references;
- production project and host denial;
- separate apply, compensation, and reapplication history stages;
- post-operation role, forced-RLS, direct-grant, and all-flags-off checks;
- evidence upload only after the redaction step succeeds.

These controls are static candidates. They do not prove an actual backup, restore, hosted attack suite, project-pinned schema diff, or preview execution.

## Open High Gates

- The protected HQ auth chain has unresolved expiry, configured-signing, credentialed-origin, and nonce-replay findings that require the protected owner process or exact runtime disproof.
- The direct bearer candidate and Lorentz's proposed HQ assertion contract are not one owner-ratified closed identity profile.
- No canonical test users, refresh path, durable revocation path, old-tab proof, or registered staging origin exists.
- No application actor binder, exact workflow grants, pool-clearing proof, or hosted RLS matrix exists.
- No deployed HTTPS headers, CORS, cache, rate control, log-redaction, monitoring, or rollback evidence exists.

## Isolation Verdicts

- Answer isolation: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Explanation isolation before finalization: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Restricted-source isolation: `PASS LOCAL SYNTHETIC; STAGING NOT RUN`.
- Raw transcript leakage: `NO TRANSCRIPTS CONNECTED; STAGING NOT RUN`.
- Audit immutability: `PASS LOCAL AND DISPOSABLE DATABASE; HOSTED NOT RUN`.

All feature flags remain off. No preview, staging, production, auth, database, or protected-system write was performed.

============================================================
FILE: I1Q_1008A_TRUE_EXTERNAL_BLOCKERS.md
============================================================
# I1Q-1008A True External Blockers

## Blockers

1. No explicitly authorized preview or staging datastore exists.
2. No preview database credentials or project-pinned secret inventory is available.
3. No canonical authenticated I1Q staging provider, GitHub environment, host, or deployment workflow exists.
4. No canonical staging identities or complete token acquisition, refresh, revocation, and logout journey exists.
5. Protected shared HQ auth findings require the shared-system owner process.
6. No provider backup identity and tested restore reference exists.
7. No approved application runtime actor binder or exact grant manifest exists.
8. Real human accessibility validation cannot occur without a deployed authenticated system and participants.

## Consequences

- preview apply: blocked
- real RLS certification: blocked
- preview compensation and reapply: blocked
- authenticated staging deployment: blocked
- staging security and accessibility certification: blocked
- monitoring activation: blocked
- State A, B, C, and D: blocked because the owner-ratified canonical identity lifecycle required by State A is also absent

All independent local implementation, disposable database validation, test repair, workflow hardening, documentation, and red-team work continues despite these blockers.

============================================================
FILE: I1Q_1008A_UI_UX.md
============================================================
# I1Q-1008A UI And UX

## Verdict

`SIMULATED SCORE GATE: FAIL`

`LOCAL RESPONSIVE REPAIR RETEST: PASS`

`UX RELEASE: BLOCKED`

All scores are simulated and bound to local synthetic evidence.

| Measure | Immediate predecessor `483b0f7` | Final candidate `fd7ddcd` | Target | Result |
| --- | ---: | ---: | ---: | --- |
| Aggregate | 8.04 | 8.21 | At least 9.0 | Fail |
| Minimum category | 6.8 task speed | 6.8 task speed | At least 8.5 | Fail |

The earlier 1007X packet reported a historical 5.87 baseline before its repair set. The 8.04 value above is the immediate, freshly measured predecessor for the final 1008A responsive repair.

## Final Simulated Categories

| Category | Score |
| --- | ---: |
| Visual hierarchy | 8.6 |
| Workflow clarity | 8.2 |
| Cognitive load | 7.2 |
| Discoverability | 7.7 |
| Task speed | 6.8 |
| Evidence visibility | 8.5 |
| Source traceability | 8.3 |
| Error prevention | 8.6 |
| Error recovery | 8.1 |
| Consistency | 8.6 |
| Responsive behavior | 8.7 |
| Accessibility | 8.4 |
| Trust | 8.6 |
| Visual quality | 8.6 |

## Closed Local Findings

- cursor-complete reads with bounded fail-closed validation
- exact client-observed `If-Match` draft updates
- correct-option distractor clearing and disablement
- same-item revision comparison
- deliberately selected exact release revision
- distinct expired, revoked, provider-outage, unauthorized, and signed-out states
- logout memory clearing
- visible full immutable hashes
- page-root table containment with independent table scrolling
- mobile actor and environment context
- pagination wrapping and stable target geometry

## Remaining Product Gaps

- Candidate disposition, privacy decision, rights resolution, distractor verdict, assignment creation and reassignment, validation inspection, and incident creation remain missing or read only.
- Every local actor sees the same 17 top-level destinations; role-specific starts and guided queues are absent.
- Browser aggregation remains bounded at 50,000 rows but lacks server-side search, cancellation, saved views, deep links, bulk operations, and power shortcuts.
- Protected compare-and-reapply, return-to-queue state, and immutable-decision confirmation remain incomplete.
- Canonical authenticated staging, persistent storage, real synthetic roles, and end-to-end recovery were not available.

## External Validation

The required human, assistive-technology, native-zoom, supported-browser, real-device, and authenticated-staging protocol was not run. The final 8.21 score and clean responsive matrix are useful engineering evidence, not a production usability claim.
