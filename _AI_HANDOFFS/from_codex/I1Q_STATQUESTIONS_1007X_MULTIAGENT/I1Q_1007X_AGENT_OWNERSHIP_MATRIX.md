# I1Q-1007X Agent Ownership Matrix

## Ownership Rules

- One writer per path at a time.
- Shared authority and deployment files are root-only.
- Agents may inspect outside their write scope only when authorized and privacy-safe.
- Existing changes by other workers must be preserved.
- No subagent may apply migrations, deploy, merge, or alter feature flags.

## Current Assignments

| Owner | Write scope | Read scope | Status |
| --- | --- | --- | --- |
| Root Supervisor | All root reports; MissionMed OS registration and decision; integration commits; migration/deploy manifests | All authorized project and authority inputs | FINAL INTEGRATION COMPLETE |
| Ecosystem Mapper | `agents/ecosystem_mapper/` only | Shared consumers and contracts, read-only | COMPLETE |
| Privacy and Rights | `agents/privacy_rights/` only | Authorized corpus metadata and privacy-safe samples | COMPLETE, PRIVACY VETO RETAINED |
| Medical Knowledge | `agents/medical_content/` only | Architecture, schemas, review requirements, privacy-safe fixtures | COMPLETE, NO MEDICAL APPROVAL |
| Assessment Science | `agents/assessment_science/` only | Schemas, validators, privacy-safe fixtures | COMPLETE, RELEASE VETO RETAINED |
| Architecture and Data | `agents/datastore_contracts/` only | `i1q-question-platform/`, migrations, export contracts | COMPLETE |
| Auth and Security | `agents/lorentz_security/` and `agents/security_integrated/` | Auth, RLS, migrations, dependency and deployment surfaces | COMPLETE, ACTIONABLE LOCAL DEFECTS REPAIRED |
| Internal App | Root-integrated application paths | `i1q-question-platform/` | LOCAL SYNTHETIC BUILD COMPLETE |
| UX and Accessibility | `agents/ux_accessibility/` and `agents/ux_current/` | UI, tests, evidence and screenshots | COMPLETE, RELEASE VETO RETAINED |
| Corpus and Extraction | Root-integrated reports only | Authorized registries and corpus, read-only | INVENTORY COMPLETE, EXTRACTION BLOCKED |
| Adapter | Root-integrated adapter paths | STAT and Drills contracts, read-only | LOCAL CONTRACTS COMPLETE, FLAGS OFF |
| Release and Reliability | `agents/release_reliability/` only | CI, staging, monitoring, backup and rollback evidence | COMPLETE, DEPLOYMENT BLOCKED |
| Darwin | `agents/darwin/` only | Current integrated code and tests | COMPLETE, LOCAL PARITY PASS, EXTERNAL RELEASE BLOCKED |
| Independent Red Team | `agents/independent_red_team/` only | Initial audit, iterative reruns, failed `65bb52c`, and exact final `ba17e22` candidate | COMPLETE, IRT-009 AND IRT-010 CLOSED LOCALLY, STATE C VETO RETAINED |
| Final Exact Red-Team Verifier | `agents/red_team/` only | Historical counterexamples through IRT-009-H4 and exact pushed checkpoint `ba17e22` | COMPLETE, STATE A CLEAR QUALIFIED ONLY, STATES B C D VETOED |

## Repair Wave 1 Assignments

These scopes apply after the baseline audit commits and are intentionally disjoint.

| Owner | Exclusive application write scope | Test scope | Prohibited overlap |
| --- | --- | --- | --- |
| Adapter and Identity Implementer | `i1q-question-platform/src/contracts.mjs`, `i1q-question-platform/src/exports.mjs`, `i1q-question-platform/src/adapters/**` | new `i1q-question-platform/tests/adapters-security.test.mjs` | auth, server, platform, privacy, pipeline, store, SQL, UI |
| Auth and Release Security Implementer | `i1q-question-platform/src/auth.mjs`, `i1q-question-platform/src/server.mjs`, `i1q-question-platform/src/platform.mjs` | new `i1q-question-platform/tests/security-regressions.test.mjs` | contracts, exports, adapters, privacy, pipeline, store, SQL, UI |
| Privacy Normalization Implementer | `i1q-question-platform/src/privacy.mjs`, `i1q-question-platform/src/pipeline.mjs` | new `i1q-question-platform/tests/privacy-regressions.test.mjs` | contracts, exports, adapters, auth, server, platform, store, SQL, UI |
| Evidence Validator Implementer | new `i1q-question-platform/src/validate-evidence.mjs` and new validator-only fixtures | new `i1q-question-platform/tests/evidence-validator.test.mjs` | existing evidence generator, app modules, SQL, UI |

Every implementer must run the existing 30-test suite plus its direct tests. No implementer may alter existing test files to make a failure disappear. Cross-scope integration and any necessary conflict repair belong to the root supervisor after all workers return.

## Root-Only Paths and Actions

- `/Users/brianb/MissionMed_OS/**`
- Shared MissionMed HQ auth and bootstrap files
- Shared runtime, global grants, and environment configuration
- Production and staging migration application
- GitHub branch merge and deployment actions
- Feature-flag changes
- Production monitoring and rollback actions
- Final combined handoff generation
- State A, B, C, or D claims

## Historical Untracked Material

The pre-existing untracked handoff directories visible at baseline have no agent owner in this run. They must not be staged, modified, deleted, or used as release evidence unless the root explicitly inventories and adopts an individual artifact.
