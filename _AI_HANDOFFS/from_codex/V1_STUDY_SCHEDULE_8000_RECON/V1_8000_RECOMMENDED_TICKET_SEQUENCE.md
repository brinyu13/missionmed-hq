# V1 Study Schedule — Recommended Ticket Sequence

## Program sequence

| Ticket | Objective | Exit gate |
|---|---|---|
| `V1-STUDY-SCHEDULE-8010` | Implement and wire the complete product with default-off rollout and phase-aware runtime modes using phases A–J | All intended features on Plan-owned data; contracts, CI, staging-development package, fallback reader/rollback, and explicit learner-principal test proof; no production deploy |
| `V1-STUDY-SCHEDULE-8020` | Iterative independent UI/UX, accessibility, responsive, and performance quality loop | Every board lens >=9/10, median >=9, no P0/P1; every fix reruns affected 8010 gates |
| `V1-STUDY-SCHEDULE-8030` | Integrated stress and release-candidate validation | Freeze one immutable RC digest; concurrency, migration, load, security, cross-app, and its exact rollback package green |
| `V1-STUDY-SCHEDULE-8040` | Controlled production deployment | Deploy the exact frozen 8030 digest; gated cohorts complete; authenticated production E2E and rollback evidence |
| `V1-STUDY-SCHEDULE-8050` | Post-launch validation and closeout | SLO window healthy; defects closed/owned; final combined handoff |

No `V1-8001` reconciliation amendment is needed. No new D9 tickets are permitted.

## Internal V1-8010 commit/run boundaries

| Boundary | Scope | Must remain true |
|---|---|---|
| 8010A | Authority/baseline freeze | Exact 14 decisions, source freeze, and non-mutating production observation; mutation characterization only with local fixtures/isolated staging |
| 8010B | Legacy safety containment | Tests first; no visual change |
| 8010C | Disabled seams | Flag off; no schema/learner behavior |
| 8010D | Plan persistence | Transaction/isolation proof, unique constraints, migration lock, failure injection, atomic cutover watermark; additive and staging-only |
| 8010E | First Week vertical slice | Explicit test learner in staging; administrators remain audit-only; D9-300 visible |
| 8010F | Mission/Day/Focus/closeout | Planned and actual separated |
| 8010G | Recovery/reserve | Conservation and learner control |
| 8010H | Complete temporal/mentor product | All approved requirements implemented |
| 8010I | Staging-development package | Immutable, tested, staged, rollback-reader capable; not the RC and no production deploy |
| 8010J | Implementation closeout | Audit review plus explicit learner-principal staging evidence; V1-8020 handoff |

## Why this is the shortest safe chain

Splitting every feature into micro-tickets would create authority and integration
drift. Combining implementation, quality, stress, deploy, and post-launch into
one run would erase independent gates. Five substantial MegaRuns preserve the
founder's requested program shape while the 8010 boundaries keep high-risk
schema, access, UI, and rollout work independently revertible.

Production deployment and cohort ramp are exclusively
`V1-STUDY-SCHEDULE-8040` work after V1-8020 quality and V1-8030
release-candidate gates pass.

## Readiness wording

`V1-8010 READY: NO` for schema or application implementation.

`V1-8010A READY: YES` for authority lock and characterization immediately after
this handoff is accepted, limited to decisions, source freeze, non-mutating
production observation, and local/isolated-staging characterization. The ticket
must stop at its decision gates rather than guess.

`V1-8020 READY: NO`; `V1-8030 READY: NO`; `V1-8040 READY: NO` until their
predecessor gates pass.
