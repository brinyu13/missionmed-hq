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
