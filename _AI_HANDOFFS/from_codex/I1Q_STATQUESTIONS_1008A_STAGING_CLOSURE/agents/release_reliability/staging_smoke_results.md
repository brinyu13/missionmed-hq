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
