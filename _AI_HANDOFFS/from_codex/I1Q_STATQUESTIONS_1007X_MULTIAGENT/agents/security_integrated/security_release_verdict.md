# I1Q-1007X Integrated Security Release Verdict

## Verdict

`BLOCK`

Security does not clear staging, authenticated internal production, State C, any consumer enablement, or student publication. The highest security statement supported is `LOCAL_SYNTHETIC_MECHANICS_ONLY`.

## Current Scope

Reviewed commit: `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`, plus the current uncommitted review-workflow delta with `platform.mjs` SHA-256 `121f4ac1ed0a13a6044b6c4e1370d76c6c7bf44afa8e2e1add9346ae190a828a`.

Reviewed offline datastore hashes:

- Migration: `9ccf9b29b402fb271e449be26d6b11deb496e834d3b7caa7ec875ba582749ca8`
- Compensation: `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a`
- Repository: `f4c5f6e3acffc0925c9c36a027471f5d02ec6606ea65ca7e48abfb701f7edee3`

No protected or production state was accessed or changed.

## Evidence

- Current focused integrated suite: 112 passed, 6 failed, 1 skipped out of 119.
- Prior committed full local suite before the current review-workflow delta: 194 passed, 0 failed, 1 skipped out of 195. This is not current green proof.
- Dependency audit: 0 vulnerabilities.
- Relevant secret-pattern scan: no findings.
- Independent synthetic attack probe: three release claims disproved.

## Findings

Release-blocking findings:

1. Unassigned read-only users can read unapproved revision and source metadata through generic memory-backed routes.
2. Internal platform and review flags do not gate the HTTP service.
3. STAT and Drills consumer flags do not gate artifact delivery.
4. The SQL answer reader does not revoke assignment-based answer access when the required role or medical credential ceases to be current.
5. SQL channel artifact creation does not bind the policy to channel, phase, data class, or Class A payload rules.
6. SQL publication checks only one of the two student flags.
7. The HTTP service is not wired to a canonical identity resolver or the RLS repository.
8. The migration, RLS, compensation, rollback, and reapply suite has not run against PostgreSQL.
9. No canonical unprivileged runtime role, grant manifest, migration route, staging URL, browser run, monitor, or rollback rehearsal exists.
10. Release validation accepts arbitrary caller-named checks rather than the complete official leak-test evidence.
11. Expired rights can remain release eligible, and shared metadata RLS is broader than the binding role sketch.
12. Compensation audit idempotence is not concurrency safe and several architecture-immutable record classes lack immutable triggers.
13. The current uncommitted open-assignment repair leaves six focused review tests failing.

Positive but insufficient findings:

- Expired, revoked, stale, missing, and outage identity contexts fail closed in local tests.
- CSRF and trusted-Origin mutation checks pass locally.
- Local demo is blocked in production and behind forwarded ambiguity.
- Self-review, reviewer impersonation, assignment swaps, and exact revision hash swaps are rejected in covered paths.
- Generic responses are answer-free and post-answer access requires trusted server finalization.
- The offline SQL uses `auth.uid()`, database-owned role membership, forced RLS, deny-by-default grants, immutable records, and preserving compensation.

## Changes

This specialist made no product, test, migration, evidence, flag, Git, provider, or production change. Exactly seven reports were created under `agents/security_integrated/`.

## Tests

The current focused run is red. Five platform review cases and one security review-swap case fail because assignments now begin open and are not accepted by the existing tests. The sole skipped case is also the only test that could exercise apply, reapply, role attacks, compensation, and reapply on PostgreSQL. Both conditions must be resolved before any RLS or rollback clearance.

## Risks And Blockers

The current safe 401 default is not an internal production application. Conversely, injecting an identity resolver into the current memory-backed service would expose the reproduced IDOR and flag bypasses. Neither state satisfies State C.

## Confidence

`97 percent` confidence in the BLOCK verdict. Reservation remains for behavior that could only be measured on the unavailable canonical database, identity, and staging routes.

## Paths

The complete evidence and repair paths are enumerated in `threat_model.md`, `auth_test_matrix.md`, `rls_test_matrix.md`, `security_attack_results.json`, `answer_isolation_report.md`, and `security_repairs.md` in this directory.

## Root Handoff

Root must preserve State A truthfulness, keep all flags off, implement every P1 repair, run the non-skipped database and browser matrices, and request a fresh independent security review on the exact commit proposed for staging. Security veto remains in force until then.
