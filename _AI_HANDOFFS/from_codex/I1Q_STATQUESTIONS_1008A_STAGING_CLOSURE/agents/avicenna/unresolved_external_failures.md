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
