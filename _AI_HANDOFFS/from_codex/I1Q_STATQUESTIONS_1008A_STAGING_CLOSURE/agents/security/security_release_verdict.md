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
