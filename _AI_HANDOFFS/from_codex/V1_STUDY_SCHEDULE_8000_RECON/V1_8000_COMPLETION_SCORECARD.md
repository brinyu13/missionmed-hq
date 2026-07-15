# V1 Study Schedule — Completion Scorecard

Scores measure evidence available at the recovered source base plus the dated
read-only public observations. Prototype/design maturity is separated from
production implementation; prototype tests/renders receive zero production
testing, QA, mobile, accessibility, or performance credit.

## Dimension scores

| Dimension | Score | Reproducible denominator | Excluded unknowns | Confidence |
|---|---:|---|---|---|
| Product definition | 86% | 36 of 42 requirement rows are explicitly marked `V` in the requirements reconstruction; six are production-safety inferences marked `I` | Six inferred production requirements | High |
| UX specification | 88% | 37 of 42 rows have detailed interaction/decision behavior; the five excluded rows are listed below | Real failure/sync/mentor-operations validation | High |
| Visual design | 82% | 41 of 50 mapped prototype guidance cells (10 expert lenses × five viewport/state classes), listed below | Independent production board and remaining narrow/error/dense states | Medium |
| Frontend production implementation | 5% | 1 of 20 core capability groups has partial source implementation: legacy daily block manipulation | No authenticated runtime credit | High |
| Backend production implementation | 5% | 1 of 20 service groups has source implementation: unsafe legacy Calendar adapter/REST | No live table/backend or safety credit | High |
| Persistence/data | 0% | 0 of 10 gates: selected store, applied schema, live rows, atomicity, revision, idempotency, migration, backup, restore, ownership | Source schema definition | High |
| Integrations | 0% | 0 of 10 intended adapters has a production contract test | Source Calendar coupling | High |
| Mentor/admin capability | 0% | 0 of 10 privacy/ghost/audit flows production-verified | Prototype behavior | High |
| Mobile/responsive behavior | 0% | 0 of 10 production device/view gates exercised | Prototype rendering | High |
| Accessibility | 0% | 0 of 10 production WCAG/assistive-task gates exercised | Prototype claims/static markup | High |
| Automated testing | 0% | 0 of 10 production Study layers present | Syntax checks, unrelated tests, prototype suites | High |
| Manual visual QA | 0% | 0 of 10 authenticated production state/device groups reviewed | Local prototype render | High |
| Performance | 0% | 0 of 10 production/staging bundle/API/interaction/data-size budgets measured | Prototype reports | High |
| Observability | 0% | 0 of 8 V1 event/SLO/dashboard/alert/privacy gates present | Generic logs | High |
| Security boundary readiness | 0% | 0 of 10 V1 entitlement/ownership/role/privacy/threat gates complete | Anonymous 401 and defects discovered | High |
| Staging readiness | 0% | 0 of 10 environment/data/migration/E2E gates evidenced | No assumed environment | High |
| Deployment readiness | 0% | 0 of 10 package/manifest/canary/production gates evidenced | D9 source recovery | High |
| Rollback readiness | 0% | 0 of 10 V1 code/data/continuity rollback gates rehearsed | D9 source-only rollback package | High |

## Reproducible prototype-score mappings

Product-definition coverage is the literal count of the requirements ledger:
36 rows marked `V` and six rows marked `I`. UX specification excludes exactly
five outcome/release-only rows from detailed interaction credit: Medical unit
targets, Access/authorization, Analytics/observability, Retention/history, and
Deployment/rollback. The other 37 rows contain interaction or decision behavior.

Visual guidance uses `1` only when the D9-300/350/360 corpus supplies usable
rendered or specification guidance for that lens/class; `0` marks a material
gap found by this review.

| Lens | Desktop | Tablet | Mobile | Empty/error/loading states | Dense/long horizon | Row total |
|---|---:|---:|---:|---:|---:|---:|
| Medical-student workflow | 1 | 1 | 1 | 0 | 1 | 4 |
| Overloaded learner | 1 | 1 | 1 | 1 | 1 | 5 |
| Power user | 1 | 1 | 0 | 1 | 1 | 4 |
| Mentor/privacy | 1 | 1 | 0 | 1 | 0 | 3 |
| Cognitive load/HCI | 1 | 1 | 1 | 1 | 1 | 5 |
| CAM visual fidelity | 1 | 1 | 1 | 1 | 1 | 5 |
| Accessibility guidance | 1 | 1 | 0 | 1 | 0 | 3 |
| Mobile/touch guidance | 1 | 1 | 0 | 1 | 0 | 3 |
| Performance/motion guidance | 1 | 1 | 1 | 1 | 0 | 4 |
| Trust/motivation | 1 | 1 | 1 | 1 | 1 | 5 |
| **Column/overall total** | **10** | **10** | **6** | **9** | **6** | **41 / 50** |

## Overall production readiness: 7%

Overall readiness is reported primarily as **2 of 30 evidence gates passed**.
The 7% figure is a compact equal-weight indicator, not a calibrated launch
probability and not an assertion that the gates have equal operational impact.

| Gate | State | Gate | State |
|---|---|---|---|
| 1 Product identity/authority | PASS | 16 Mobile production evidence | FAIL |
| 2 Canonical source provenance | PASS | 17 Accessibility production evidence | FAIL |
| 3 Complete Mission execution | FAIL | 18 Production automated tests | FAIL |
| 4 Complete Day/Week execution | FAIL | 19 Authenticated manual QA | FAIL |
| 5 Month/Journey/Review | FAIL | 20 Performance budgets | FAIL |
| 6 Focus/closeout/streak | FAIL | 21 Observability/SLOs | FAIL |
| 7 Reserve/recovery | FAIL | 22 Representative staging | FAIL |
| 8 Mentor/privacy | FAIL | 23 Migration rehearsal | FAIL |
| 9 Authoritative Plan store | FAIL | 24 Backup/restore proof | FAIL |
| 10 Applied schema/live data | FAIL | 25 Phase-aware rollback proof | FAIL |
| 11 Safe versioned API | FAIL | 26 Immutable release package | FAIL |
| 12 Identity/context decision | FAIL | 27 Runtime manifest/guard | FAIL |
| 13 Entitlement/action auth | FAIL | 28 RC stress/security | FAIL |
| 14 One-writer containment | FAIL | 29 Controlled production deploy | FAIL |
| 15 Tested integrations | FAIL | 30 Authenticated production E2E | FAIL |

Calculation: `2 / 30 × 100 = 6.67%`, rounded to **7%**. High confidence applies
to the pass/fail evidence classification and count, not to equal weighting as a
meaningful production forecast.

## Prototype and legacy UI/UX treatment

The rendered prototype baseline remains a supervisor diagnostic mean of
7.75/10, not an independent board result. The legacy production implementation
is **not scoreable as interaction UX** because no authenticated route was
exercised. Static source inspection places a ceiling below 4/10 but awards no
release credit.

## Interpretation

V1 is close to an implementation-ready definition, not close to production.
Recovered source and product authority eliminate guessing; nearly every
production, data, access, quality, and release gate remains open.
