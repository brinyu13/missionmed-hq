# I1Q-1007X Lorentz and Security Release Verdict

## Verdict

`SECURITY VETO: NO-GO FOR MIGRATION, STAGING, INTERNAL PRODUCTION, OR CONSUMER ACTIVATION`

Date: 2026-07-15

Candidate commit audited: `0d6f78f2a2036731ec592398ce5fd845beb54333`

## Authority Status

The MissionMed OS authority blockers in the initial audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now address mission registration, product ownership, protected integration authority, RANKLISTIQ routing, read-only source access, composite identity, explicit Drills availability, staging, rollback ownership, and the canonical GitHub route.

That recovery changes the authority verdict from unresolved to authorized-with-gates. It does not change the application verdict. All confirmed P0/P1 findings remain current until repaired and independently retested.

## Passing Baseline Evidence

- Exact frozen nine-field STAT projection passes locally.
- Frozen STAT pack hash vector passes locally.
- Candidate code contains no live `answer_map` query.
- Existing local suite passes 30 of 30 tests.
- Candidate SQL defaults all feature flags off and makes no client grants.
- No migration, deployment, source mutation, student-data access, or flag change occurred in this audit.

## P0 Release Blockers

1. `read_only` can retrieve answer-bearing Item Revisions.
2. Caller-controlled phase text unlocks post-answer debrief without finalization or participant proof.
3. Leak validation misses `answer_map` and `is_correct` and is not closed-world.
4. Generic writes permit rights/privacy/evidence/source eligibility forgery.
5. Admin can fabricate/impersonate a physician reviewer and approve on the wrong assignment type.
6. One admin can self-assign governance and publish without independent validation, medical attestation, or Brian ratification evidence.

## P1 Release Blockers

1. RLS identity and roles are caller-asserted; policies are broad and not assignment-scoped.
2. Canonical auth, role mapping, CSRF, expiry, revocation, logout, fixation, outage, and connection-pool isolation are unproved.
3. Privacy aggregate can pass at zero recall, required privacy classes are incomplete, and raw text survives downstream normalization.
4. Candidate migration violates MR-078A promotion requirements and has never run in Postgres.
5. Application records are not proven compatible with SQL and no transactional database repository exists.
6. Rollback is not coupled to the running app or release re-promotion, can break audit continuity, and has no reapply proof.
7. Projected IDs can shift or collide, release membership omits exact tuples, and old-attempt joins are unproved.
8. Drills artifact is not compatible with current Drills/Daily consumers and lacks explicit source availability and gates.
9. Full dependency, secret, injection, rate, log, error, and deployed-artifact attacks remain incomplete.

## Permitted Next Work

- Root may assign bounded implementation repairs listed in `security_repairs.md`.
- Agents may add synthetic regression tests and prepare a new canonical migration for Root review.
- Authorized read-only source inventory and privacy-safe candidate engineering may continue within DR-006, provided no raw source crosses the restricted boundary.
- Consumer and student flags remain OFF.

## Prohibited Until Re-Certification

- Applying any candidate migration.
- Deploying preview, staging, canary, or internal production application code.
- Exposing the current API to an authenticated audience.
- Enabling internal review, student content, STAT consumer, or Drills consumer flags.
- Claiming RLS, rollback, old-attempt, sealed-pack, Drills, privacy, or canonical-auth proof.

## Re-Certification Gate

A fixed commit must contain all P0 repairs, all P1 implementations, new negative tests, canonical auth integration, preview migration and RLS evidence, rollback/reapply proof, composite historical joins, STAT sealed-pack regression, Drills/Daily contract evidence, privacy thresholds, dependency/security scans, and dependent-product smokes. A fresh independent red team must verify that exact commit.

## Handoff to Root Supervisor

Preserve the exact STAT projection and hash primitive. Treat the current delivery, authorization, datastore, source, and release layers as unsafe. Assign the repair register without overlapping ownership, keep every flag off, and do not enter staging until this veto is replaced by a fresh written approval against one fixed commit.
