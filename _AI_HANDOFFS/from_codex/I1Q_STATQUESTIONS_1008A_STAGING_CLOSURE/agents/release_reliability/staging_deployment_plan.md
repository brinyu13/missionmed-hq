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
