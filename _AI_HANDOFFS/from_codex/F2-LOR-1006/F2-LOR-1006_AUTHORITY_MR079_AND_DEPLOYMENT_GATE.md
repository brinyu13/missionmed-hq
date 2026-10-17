# F2-LOR-1006 Authority, MR-079, and Deployment Gate

**Ticket risk:** LOW for inspection; MEDIUM for bounded documentation creation; HIGH for any future product/data/provider/release mutation
**This run:** documentation only; no product, provider, database, or production operation

## 1. Repository and control-plane preflight

| Item | Verified state |
|---|---|
| Product repository | `/Users/brianb/MissionMed_worktrees/F2-LOR-1005`; remote `https://github.com/brinyu13/missionmed-hq.git` |
| Worktree/branch | `/Users/brianb/MissionMed_worktrees/F2-LOR-1005`; `codex/f2-lor-1005-production-beta` |
| HEAD | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` |
| Initial status | Clean; branch tracked `origin/main`; no relevant untracked files |
| MissionMed OS local | `/Users/brianb/MissionMed_OS`, `main` at `eab44e3057832304227f02c02ea3005762974839`; behind current remote and carrying unrelated untracked directories |
| MissionMed OS remote | `origin/main` `a7d456838de20c2144d116e7af8ca74306c33c78`, generated current state 2026-08-04; D1 route present, no F2-LOR route |
| F2 mission/passport/decision | MISSING — NOT VERIFIED in current remote `missions.json`, `products_index.json`, `authority_index.json`, `CURRENT.md`, passports, or decisions |
| Revision 3 control-plane filing | F2-LOR-1006 prompt is controlling for this packet; current OS record found only D1-scoped adoption that expressly is not global |

The local OS worktree was not edited: it is behind the remote, its generated `CURRENT.md` is stale, it contains unrelated untracked work, and no F2 route authorizes a control-plane write.

## 2. F2-LOR-1005 stop evidence preserved

F2-LOR-1005 correctly stopped before implementation because the current authority chain lacked:

- an active F2 mission route;
- an application charter/passport and canonical ID;
- an application-specific Founder decision record;
- a reconciled privacy/access/data contract;
- an F2-scoped MR-079 command/path/provider amendment;
- deployment target, provider, data estate, migration ledger, backup, rollback, and release owners.

No F2-LOR-1005 product-code edits, database changes, WordPress changes, production implementation, deployment, production access, backup, rollback, canary, or activation were found or claimed. F2-LOR-1006 does not erase or reinterpret that stop.

## 3. MR-079 reconciliation

MR-079 is literal: commands not on its whitelist are not implicitly allowed, unexpected output stops work, protected files are no-touch, and product/data/provider mutations require explicit target and validation. The F2-LOR-1006 Founder prompt adds bounded authority to inspect and create these documentation artifacts. It does not add product, Git-publication, provider, data, or production authority.

| Future operation | Current classification | Additional authority / conditions | Evidence required |
|---|---|---|---|
| Read/search files and Git state | AUTHORIZED for this ticket | Use MR-079 read-only commands; stop on unexpected risk | Paths, command/output summary, source classification |
| Create this ticket's documentation files | CONDITIONALLY AUTHORIZED | Exact F2-LOR-1006 scope; handoff path only; no protected authority mutation | Final diff, file manifest, secret scan, source-preservation check |
| Edit product source | PROHIBITED in this ticket | Registered mission, charter, sole writer, protected-source boundary, F2 MR-079 amendment | Prestate, scoped diff, build/test receipts |
| Build | FOUNDER/MR-079 AUTHORIZATION REQUIRED | Exact package manager/scripts/path; deterministic dependency policy | Tool versions, clean build log, artifact hashes |
| Run tests | FOUNDER/MR-079 AUTHORIZATION REQUIRED | Exact test commands and synthetic-data policy | Unit/integration/E2E counts and logs |
| Browser testing | FOUNDER/MR-079 AUTHORIZATION REQUIRED | Exact localhost/runtime and browser actions; no real data | Viewports, screenshots only if needed, console/network evidence |
| Create migrations | PROHIBITED now; conditional later | Selected estate/ledger; new files only; MR-078A preflight; exact mission amendment | Migration list/diff/lint, headers, timestamp, invariant analysis |
| Use local databases | AUTHORIZATION REQUIRED | Exact local-only target and synthetic data; no production clone unless separately approved | Target proof, dataset manifest, teardown/retention plan |
| Inspect staging | AUTHORIZATION REQUIRED | Exact environment/account/provider and read-only command classes | Target identity, feature state, sanitized results |
| Inspect production | PROHIBITED in this ticket | Explicit production observation mission, exact paths/providers/commands, privacy handling | Current route receipt, sanitized observations, no writes |
| Access providers | PROHIBITED in this ticket | Exact provider/project/service/account, permitted actions, owner/MFA as required | Account/target receipt without secrets |
| Access secrets | PROHIBITED for Codex output/files | Account owner supplies/injects through approved vault; never reveal values | Presence/configuration proof only, redacted |
| Create backups | PROHIBITED in this ticket | Exact target, backup mechanism, owner, scope, retention, readability test | Backup ID/time/scope/size/readability/RTO |
| Restore/rollback test | PROHIBITED in this ticket | Isolated target, executable procedure, mutation authority, stop conditions | Restore ID, timings, pre/post hashes and health |
| Commit | NOT CURRENTLY AUTHORIZED | F2 MR-079 amendment must include `git add`/`git commit`, allowed paths, branch, message/evidence rules | Pre/post status and commit ID |
| Push | NOT CURRENTLY AUTHORIZED | Exact remote/branch, sole pusher, no force, remote baseline | Push receipt and remote commit |
| Open PR | NOT CURRENTLY AUTHORIZED | Repository route, reviewers, branch, evidence packet | PR URL, base/head, checks |
| Deploy | PROHIBITED | Mission decision, provider/route authority, feature-off sequence, restore points, sealed gates | Exact revisions, provider IDs, route/data/cache receipts |
| Canary | PROHIBITED | Cohort/consent decision, feature flag, health thresholds, rollback trigger | Exact cohort count/identity rule, monitoring and rollback proof |
| Activate users | PROHIBITED | Explicit Founder go decision after canary gates | Entitlement query/allowlist, negative access, activation receipt |
| Verify production | PROHIBITED in this ticket | Exact post-deploy probe authority and protected-data constraints | Artifact identity, auth/privacy/health/rollback readiness |
| Write evidence | CONDITIONALLY AUTHORIZED | Documentation/evidence paths only under active mission; sanitize protected data | Hashes, paths, command/test manifest |
| Seal release | NOT AUTHORIZED | Registrar/evidence owner, exact release identity, complete gate set | Signed/sealed manifest, decisions, unresolved limits |

Account-owner/MFA participation is expected for provider OAuth/client creation, production consoles, secret configuration, backup/restore controls, and any provider action whose session cannot be safely delegated. Production approval is separately required even after technical credentials exist.

## 4. Deployment-gate audit

**Score:** **7/30 applicable gates PASS**. Seven are PARTIAL, fifteen FAIL, and one is UNKNOWN — MUST VERIFY. This is a pre-admission product package, not a release candidate.

| # | Gate | Status | Evidence / gap |
|---:|---|---|---|
| 1 | Canonical repository | PASS | `brinyu13/missionmed-hq`; local remote verified |
| 2 | Accepted source baseline | PASS | F2-LOR-1003 prototype/hash and F2-LOR-1004 specification/hashes identified |
| 3 | Clean authoritative worktree | PASS | Documentation worktree clean at preflight; no implementation authority implied |
| 4 | Product owner | PARTIAL | Founder approved product; no signed charter owner set |
| 5 | Protected visual authority | PASS | F2-LOR-1003 source and byte-identical duplicate verified |
| 6 | Functional completeness | PARTIAL | Prototype behavior and prior 72 assertions; no production implementation |
| 7 | Deterministic build | UNKNOWN — MUST VERIFY | Self-contained HTML is not a production build pipeline |
| 8 | Local runtime | PARTIAL | Prototype can run locally; no platform runtime |
| 9 | Critical browser journeys | PARTIAL | Prior 48/48 + 24/24 accepted; must be rerun against implementation |
| 10 | Application-owned data model | FAIL | Requirements exist; estate/schema/ledger/implementation absent |
| 11 | API boundary | FAIL | Contracts specified only; no registered APIs or owner signatures |
| 12 | Identity | FAIL | Platform contract/claims/subject mapping absent |
| 13 | Entitlement | FAIL | Exact current-360/LearnDash or successor fields and revocation absent |
| 14 | Authorization | FAIL | Role requirements exist; no server enforcement or negative tests |
| 15 | Privacy | PARTIAL | Candidate matrix complete; Founder ratification and implementation absent |
| 16 | Ownership | PARTIAL | One-owner ledger produced; platform/external owners not contractually accepted |
| 17 | RLS | FAIL | Required invariant; estate, policies, claims, and tests absent |
| 18 | Provider dependencies | FAIL | No approved provider/project/service/account routes |
| 19 | Environment requirements | FAIL | Dev/staging/prod separation and secret injection unverified |
| 20 | Migrations | FAIL | No selected ledger, migration files, preflight, or application |
| 21 | Backup | FAIL | No target-specific backup owner, ID, readability, or restore proof |
| 22 | Rollback | FAIL | Product kill-switch requirement only; no executable per-layer rollback |
| 23 | Health | FAIL | Metrics proposed; no runtime, dashboards, alerts, or SLO evidence |
| 24 | Limitations | PASS | Prototype/demo/simulated/local/planned/unavailable states explicitly documented |
| 25 | Acceptance criteria | PASS | F2-LOR-1004 gates and this packet criteria are explicit |
| 26 | Release checklist | PARTIAL | Requirements exist; no target-specific completed checklist |
| 27 | Combined handoff | PASS | F2-LOR-1006 self-contained combined handoff created and validated |
| 28 | Production implementation | FAIL | Deliberately not performed |
| 29 | Canary readiness | FAIL | No implementation, cohort authority, environment, health, or rollback proof |
| 30 | Intended-user activation readiness | FAIL | No current mission, entitlement contract, canary evidence, or go decision |

## 5. Shortest safe path

| Stage | Work | May begin now? | Exit gate |
|---:|---|---|---|
| 1. Authority closure | Founder answers the isolated decisions; Registrar files Revision 3/F2 adoption, charter/passport, owner acceptances, mission, product/authority indexes, generated current state, and F2 MR-079 amendment | YES, as a governance ticket | Current routed F2 authority and exact source hashes |
| 2. Implementation preparation | Create exact implementation worktree/branch; inspect canonical Matrix repo/stack; pin package/test/browser commands; define contracts and acceptance matrix | Only after Stage 1 | Repository evidence and approved implementation plan |
| 3. Product implementation | Faithful port of frozen prototype; no redesign; feature-off; synthetic fixtures only | After Stage 2 | Scoped source diff and deterministic build |
| 4. Local verification | Unit, integration, permission, accessibility, responsive, and 72-journey regression suites | After implementation | Green reproducible receipts; no secrets/real patient data |
| 5. Platform adapters | Matrix/identity, Timeline, StoryForge, profile/File Vault, optional email/notifications/AI through filed contracts | After each owner contract | Contract/version/failure/revocation tests |
| 6. Data/auth verification | Additive migrations in selected estate; RLS/role/consent/revocation/waiver negative tests | After estate + migration authority | Migration integrity and structural-denial evidence |
| 7. Document verification | Genuine DOCX/PDF generation, confidentiality marks, Word/Preview/Adobe validation, export audit | After render service selection | Artifact hashes and visual/opening tests |
| 8. Staging/canary preparation | Deploy feature-off to exact staging; health, privacy, security, performance, accessibility, kill switch | After local gates | Staging gate receipt and Founder AI quality sign-off |
| 9. Backup/rollback proof | Fresh per-layer backup, readable restore evidence, isolated rollback rehearsal | Before production mutation | Approved restore IDs, timings, health restoration |
| 10. Production canary | Feature-off production install; shared-platform regressions; then exact small allowlist | After explicit production authority | Canary health/privacy/negative-access receipt |
| 11. Intended-user activation | Enable ratified cohort only after bounded observation and go/no-go | After canary | Founder release decision, entitlement/denial proof |
| 12. Evidence closure | Seal exact source/build/runtime/data/provider/test/rollback/limitations packet; update passport/current state | After terminal outcome | Registrar-sealed truthful terminal record |

Immediate safe work is limited to authority closure and non-mutating planning. Product source work begins only after Stage 1. Provider/data/production work waits for its specific later gates.

## 6. Required future F2 MR-079 amendment

The amendment must be F2-only and must name:

- exact worktree, branch, protected source paths, output/evidence paths, sole writer, committer, pusher, and rollback executor;
- exact allowed read/edit/build/test/browser/git commands;
- exact migration commands and selected ledger, with MR-078A invariant checks;
- exact provider/project/service/route/environment operations, including which require account owner/MFA;
- secret handling by presence/identity only, never values;
- backup/restore/rollback commands and targets;
- staging, production, canary, activation, verification, evidence, and sealing command classes;
- prohibited systems, unrelated paths/users, force/history rewrites, direct WordPress DB access, direct cross-app DB reads, broad cache/DNS/provider changes, and destructive migration actions;
- stop conditions and terminal outcomes.

The D1 DR-018 and StoryForge DR-011–014 records are useful structural precedents, but their scopes cannot authorize F2 operations.

## 7. Deliberately not performed

No product edit, build, test rerun, browser automation, database/local database, migration, staging/production inspection, provider/secret access, backup, rollback, Git stage/commit/push/PR, deployment, canary, activation, production verification, or release sealing was performed.
