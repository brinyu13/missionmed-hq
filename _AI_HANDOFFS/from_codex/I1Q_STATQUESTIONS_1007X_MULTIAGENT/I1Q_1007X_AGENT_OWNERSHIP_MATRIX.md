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
| Root Supervisor | All root reports; MissionMed OS registration and decision; integration commits; migration/deploy manifests | All authorized project and authority inputs | ACTIVE |
| Ecosystem Mapper | `agents/ecosystem_mapper/` only | Shared consumers and contracts, read-only | PENDING REMAP AFTER AUTHORITY MERGE |
| Privacy and Rights | `agents/privacy_rights/` only | Authorized corpus metadata and privacy-safe samples | INITIAL READ-ONLY AUDIT COMPLETE, DURABLE REPORT PENDING |
| Medical Knowledge | `agents/medical_knowledge/` only | Architecture, schemas, review requirements, privacy-safe fixtures | PENDING |
| Assessment Science | `agents/assessment_science/` only | Schemas, validators, privacy-safe fixtures | PENDING |
| Architecture and Data | `agents/architecture_data/` only | `i1q-question-platform/`, migrations, export contracts | INITIAL READ-ONLY AUDIT IN FLIGHT |
| Auth and Security | `agents/auth_security/` only | Auth, RLS, migrations, dependency and deployment surfaces | INITIAL READ-ONLY AUDIT IN FLIGHT |
| Internal App | Assigned application paths only after root opens a wave | `i1q-question-platform/` | NOT STARTED |
| UX and Accessibility | `agents/ux_accessibility/` only | UI, tests, evidence and screenshots | INITIAL READ-ONLY AUDIT COMPLETE, RELEASE VETO RECORDED |
| Corpus and Extraction | Assigned extraction paths only after inventory gate | Authorized registries and corpus, read-only | NOT STARTED |
| Adapter | Assigned adapter paths only after mapping | STAT and Drills contracts, read-only | NOT STARTED |
| Release and Reliability | `agents/release_reliability/` only | CI, staging, monitoring, backup and rollback evidence | NOT STARTED |
| Independent Red Team | `agents/red_team/` only | Fixed final candidate and all evidence | NOT STARTED |

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
