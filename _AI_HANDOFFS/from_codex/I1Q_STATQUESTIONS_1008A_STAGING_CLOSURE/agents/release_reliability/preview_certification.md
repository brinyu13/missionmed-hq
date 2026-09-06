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
