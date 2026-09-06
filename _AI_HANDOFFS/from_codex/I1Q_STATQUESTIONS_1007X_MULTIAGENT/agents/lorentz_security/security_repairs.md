# I1Q-1007X Security Repair Register

Status: OPEN PROPOSALS, NO FIXES IMPLEMENTED

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 address the snapshot-time MissionMed OS authority blockers encountered during root recovery. They do not accept or repair any finding below. Student, STAT, and Drills flags remain OFF.

## Repair Queue

| ID | Severity | Required change | Proposed implementation owner | Acceptance evidence |
| --- | --- | --- | --- | --- |
| SEC-001 | P0 | Remove generic answer-bearing Item Revision reads; introduce answer-free DTO/view and purpose-scoped answer endpoints | Internal App + Security | Read-only/IDOR negatives, answer-read audit |
| SEC-002 | P0 | Remove caller phase authorization; verify finalization and participant server-side | Adapter + Security | Active/pending/void/nonparticipant failures; finalized participant pass |
| SEC-003 | P0 | Replace generic writes for rights, privacy, evidence, source, and governance with dedicated schema-validated owner workflows | Internal App + Architecture/Data | Mass-assignment suite and immutable authority records |
| SEC-004 | P0 | Bind review actor, reviewer, assignment type, role, credential, state, and exact hash atomically | Internal App + Security | Impersonation/type/self-review/stale-hash negatives |
| SEC-005 | P0 | Enforce independent release authority chain and evidence; make Brian ratification explicit | Internal App + Architecture/Data | Single-actor publish fails; missing evidence fails; governance-unassigned fails |
| SEC-006 | P1 | Replace caller-set GUC trust with canonical transaction-local context and assignment-scoped forced RLS | Architecture/Data + Security | Full preview RLS matrix, pool-isolation and forged-context attacks |
| SEC-007 | P1 | Implement canonical auth adapter, role mapping, CSRF/origin, expiry, revocation, logout, fixation, and outage behavior | Auth/Security under Root protected gate | Auth matrix and dependent auth regressions |
| SEC-008 | P1 | Remove raw text from downstream objects; add full privacy classes and numeric threshold enforcement | Privacy/Rights + Internal App | Zero-recall failure, raw/log/error leak tests, benchmark thresholds |
| SEC-009 | P1 | Persist opaque composite projected mappings and exact release membership; reject duplicates | Adapter + Architecture/Data | Reorder stability, duplicate rejection, historical join suite |
| SEC-010 | P1 | Replace rollback script with authoritative flag coupling, prior-release re-promotion, continuous audit, and reapply proof | Release/Reliability + Architecture/Data | Preview rollback/reapply and audit-chain verification |
| SEC-011 | P1 | Generate a new MR-078A canonical migration and transactional database repository; align application/SQL types | Architecture/Data | Migration list/diff/lint, schema contract, SQL integration tests |
| SEC-012 | P0 | Implement closed-world channel validator with aliases, values, correlation, class D, logs/errors/caches | Adapter + Security | LT-1 through LT-6 plus adversarial vectors |
| SEC-013 | P1 | Make demo mode a build/startup-time prohibited condition in any deploy artifact and remove proxy trust ambiguity | Internal App + Release/Reliability | Deployed manifest scan and proxy tests |
| SEC-014 | P1 | Implement versioned Drills adapter with explicit playback/nodes/transcript/VTT availability, lineage, rights, privacy, and hashes | Adapter + Privacy/Rights | Drills/Daily contract suite and read-only proof |
| SEC-015 | P1 | Complete dependency, secret, injection, XSS, SSRF, rate-limit, log, error, and deployed-artifact attack suites | Security + Release/Reliability | Machine-readable clean reports against fixed commit |

## Repair Constraints

- Do not change the exact nine-field STAT projection.
- Do not change the seven-field sealed-pack contract, choice ordering, scoring, or historical attempts.
- Do not modify Drills ingestion ownership.
- Do not mutate frozen v4 rows or migration history.
- Do not weaken shared HQ, WordPress, Railway, Arena, Matrix, or Supabase auth.
- Do not use manual production SQL, `railway up`, force push, ad hoc uploads, or direct runtime replacement.
- Do not assign or infer a medical-governance lead or physician credential.
- Do not expose raw source text or secrets in test evidence.
- Do not enable internal, student, STAT, or Drills flags during repair development.

## Recommended Order

1. SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, and SEC-012.
2. SEC-007 and protected auth regression.
3. SEC-006, SEC-009, and SEC-011 in an authorized preview migration.
4. SEC-008 and privacy/source benchmark gates.
5. SEC-014 adapter implementation with consumer flags off.
6. SEC-010 rollback and reapply.
7. SEC-013 and SEC-015 deploy-artifact and full attack convergence.
8. Fresh independent red-team review of one fixed commit.

## Completion Rule

A repair is complete only when its code, direct regression, negative attacks, dependent-product tests, and machine-readable evidence are present on the same fixed commit. Passing the original 30 tests is necessary but not sufficient.
