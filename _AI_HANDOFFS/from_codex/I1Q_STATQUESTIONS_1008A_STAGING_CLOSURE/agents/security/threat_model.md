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
