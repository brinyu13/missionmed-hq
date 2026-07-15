# V1-8010A Decision 06 — Identity and Context

**Status:** ACCEPTED

## Decision

WordPress user ID is the authenticated actor key and learner-owner key. V1 Plan
UUID is the stable product aggregate identifier. Program, course, cohort,
runway/exam, chronotype, targets, and mentor assignment remain facts owned by
their existing systems.

V1 may store a versioned, server-derived context snapshot plus provenance for
replanning and historical explanation. Context is descriptive; it is never a
client-selected ownership partition or an authorization grant. Unknown context
must degrade safely without changing the learner owner.

Mentor and administrator actors remain distinct principals and cannot
impersonate learners. Every command records actor and learner owner separately.

## Verification

Required tests cover two learners, one mentor with and without assignment, an
administrator, stale context, changed course membership, and non-enumerating
foreign-object denial.
