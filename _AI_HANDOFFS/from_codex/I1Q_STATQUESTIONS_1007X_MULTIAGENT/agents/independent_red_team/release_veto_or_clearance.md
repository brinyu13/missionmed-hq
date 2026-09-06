# I1Q-1007X Release Veto Or Clearance

Ticket: `I1Q-1007X-MA`
Initial audited checkpoint: `6ac62c5a0503981680f161fe5119d5e5e2fa031a`
First post-repair checkpoint: `aebc98795f28fdfc2b130e118be762a30f536259`
Final post-repair checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Final iterative-isolation checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Final SQL case-folding checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`

The initial release decision and every prior rerun below are preserved. The current decision is in `Final SQL Case-Folding Rerun: 2026-07-15`.

## Verdict

`STATE C RELEASE VETO`

`STATE A SUPPORTED WITH EVIDENCE QUALIFICATION`

The local engineering checkpoint is green and materially useful, but it is not State C. No canonical auth adapter, runtime role or grant manifest, HTTP-to-Postgres wiring, staging or production URL, browser or accessibility proof, monitoring target, operational rollback, or protected-consumer certification exists. All six flags must remain off.

State A is supported as a dated aggregate inventory attestation. The reported 97 authorized sources, 97 transcript JSON references, 97 nodes references, 0 VTT references, 97 privacy blocks, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals are mutually consistent. Exact totals are not independently recomputable from retained row-level aggregate evidence because the generator stores literals and unattached digests.

## 1. Scope Completed

Independently inspected authority, architecture, exact Git checkpoint and history, application and UI code, SQL and compensation, repository adapter, tests, evidence, root and specialist reports, auth, RLS, privacy, answer isolation, source isolation, release artifacts, rollback, monitoring, protected consumers, corpus counts, candidate counts, UX, and accessibility.

No protected, production, provider, secret, source-content, transcript, student-data, or external datastore access occurred. No deployment, flag, Git, application, migration, or shared-file mutation occurred.

## 2. Evidence Inspected

Inspected the Question Platform passport, DR-006, MissionMed critical contracts, architecture 1002.1 and 1004C, all source and evidence under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/`, and root and specialist reports under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

Key evidence paths:

- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

## 3. Findings

| ID | Severity | Finding | Release effect |
| --- | --- | --- | --- |
| IRT-001 | Critical | Canonical State C integration and operations do not exist | State C veto |
| IRT-002 | High | Class D `misconception_id` is emitted in the Class C student debrief | Consumer and student release veto |
| IRT-003 | High | Assigned reviewers cannot retrieve answer and rationale content | State C internal-review blocker |
| IRT-004 | High | Corpus and candidate counts are literals backed by point-in-time reports, not a recomputable aggregate manifest | State A qualification |
| IRT-005 | High | RLS passes locally but no canonical runtime role, grants, repository wiring, pool proof, preview, or staging proof exists | State C RLS clearance withheld |
| IRT-006 | High | No-answer-leak and no-source-leak evidence is local only | No global leak clearance |
| IRT-007 | High | Rollback, monitoring, and protected-consumer regression safety are not operationally proven | State C operations blocker |
| IRT-008 | High | Browser, accessibility, human validation, and required UX score are not proven | State C UX blocker |

Verified current facts include the exact HEAD, green local tests, offline PostgreSQL proof, all-flags-off file evidence, missing runtime integration, the Class D projection, and the blind review workflow. The 97-source and zero-candidate statements are point-in-time reports. State A is an inference supported by those reports and the absence of higher-state evidence. Runtime auth, RLS, no-leak, rollback, monitoring, regression, UI, and accessibility claims remain unverified.

## 4. Changes Proposed Or Made

Made only the three Agent 11 report files. Proposed exact remediation in `independent_red_team.md` and `red_team_findings.json`. No product or shared artifact was changed.

## 5. Tests Performed

- `npm test`: 205 pass, 0 fail, 1 intentional PostgreSQL skip.
- Fresh disposable PostgreSQL 16 migration proof: 12 pass, 0 fail, 0 skip.
- `npm run validate`: 20/20 pass, claimed State A.
- Root `npm audit --omit=dev --audit-level=low`: 0 vulnerabilities.
- Key-only Class C debrief probe: reproduced `misconception_id` in the student payload.
- Browser, accessibility, staging, production, monitoring, protected-consumer, and operational rollback tests: not run.

## 6. Risks

Primary risks are invalid State C certification, reviewer attestation without protected review content, Class D student metadata exposure, evidence counts that cannot be independently recomputed, runtime auth or RLS drift, silent failures without monitoring, untested rollback, and protected-runtime regression from unresolved source hashes.

## 7. Blockers

State C remains blocked until IRT-001, IRT-003, IRT-005, IRT-006, IRT-007, and IRT-008 are closed on one immutable checkpoint. Consumer or student release remains blocked until IRT-002 is closed and exact LT-1 through LT-6 execution is proven. Unqualified count certification remains blocked until IRT-004 is closed.

## 8. Confidence

State C veto confidence: `0.995`.

State A as the highest supportable point-in-time state: `0.90`.

Exact 97-source count independently reproducible from retained evidence: `0.55`.

Runtime no-leak, auth, RLS, rollback, monitoring, regression, UX, and accessibility clearance: `0.00`.

## 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

## 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH EVIDENCE QUALIFICATION` into the root verdict. Keep every flag off. Do not claim global no answer leak, no source leak, RLS safety, auth safety, rollback safety, no regression, WCAG conformance, a passing UX score, or independently reproduced corpus and candidate counts.

Request a new independent Red Team only after all eight findings are remediated and the exact immutable candidate has canonical staging, runtime, browser, accessibility, rollback, monitoring, protected-consumer, and recomputable aggregate evidence.

## Post-Repair Rerun: 2026-07-15

Audited pushed Git object: `aebc98795f28fdfc2b130e118be762a30f536259`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`

The shared worktree later advanced to local `6dc408f`, but this verdict credits only exact `aebc987` Git objects. All application and test files executed were proven byte-identical to the audit target.

### 1. Scope Completed

Re-inspected the `b9bb26a` application repairs, `9eadd0e` generated evidence, and `aebc987` aggregate-evidence contract. Independently reran IRT-002 and IRT-003 probes, reviewed IRT-004's schema and cross-file checks, compared all committed checksums to exact Git blobs, reran focused and full local tests, and searched for a retained privacy-safe row manifest and new local high-severity defects.

No external or protected system was accessed or mutated. No application, migration, evidence, authority, root, specialist, Git, deployment, or flag change was made.

### 2. Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:47`, `:81`, `:153`, `:193`, and `:264`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:926` and `:1184`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs:136`, `:215`, `:298`, and `:399`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js:1068`, `:1143`, and `:1235`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/scripts/generate_evidence.mjs:170`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/validate-evidence.mjs:569` and `:1879`
- Exact `aebc987` evidence files `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `artifact_checksums.json`, `browser_results.json`, `accessibility_results.json`, `rollback_manifest.json`, `test_results.json`, and `ux_scorecard.json`
- Initial authority, architecture, SQL, rollback, RLS, auth, root, and specialist evidence listed above and in `independent_red_team.md`

### 3. Findings

| ID | Current status | Release effect |
| --- | --- | --- |
| IRT-001 | Open, unchanged | State C veto |
| IRT-002 | Partially resolved, overall open | Direct key fixed; consumer and student veto remains through IRT-009 |
| IRT-003 | Resolved in local application scope | Original local review-content blocker closed; runtime remains unverified under other findings |
| IRT-004 | Open | Point-in-time vocabulary added, but exact evidence lacks it and no bound row manifest exists |
| IRT-005 | Open, unchanged | Runtime auth and RLS clearance withheld |
| IRT-006 | Open | No global leak clearance; IRT-009 is a local counterexample |
| IRT-007 | Open, unchanged | Operational release blocker |
| IRT-008 | Open, unchanged | UX and accessibility clearance withheld |
| IRT-009 | New High, open | A Class D identifier value passes through permitted Class C prose |
| IRT-010 | New High, open | Exact `aebc987` has 3 stale checksum entries and omits required qualification fields |

IRT-002 reproduction returned `{"misconception_key_present":false,"class_d_identifier_value_present":true,"validator_findings":[]}`. A complete `buildReleaseArtifacts` probe also succeeded with the internal source ID in `why_wrong`.

IRT-003 repair tests prove accepted exact-assignment reviewers receive answer and rationale content, while wrong purpose, actor, assignment state, hash, role, credential, feature flag, or adapter state fails closed. The UI blocks verdicts if content is unavailable and stores none in browser storage.

IRT-004 inspection found no privacy-safe row manifest. Exact `aebc987` inventory evidence lacks `evidence_scope`, `row_manifest_retained`, `independently_recomputable_from_git`, and `qualification`. The validator's recomputable branch checks only an enum and two booleans and does not name, hash, load, or recompute a manifest.

Exact checksum comparison checked `44` entries and found `3` stale: `scripts/generate_evidence.mjs`, `src/validate-evidence.mjs`, and `tests/evidence-validator.test.mjs`.

Verified current facts are the exact code behavior, local test results, exact committed evidence contents, no manifest path in the exact tree, 3 stale checksum entries, 0 deployment URLs, and all 6 file-recorded flags false. The 97-source and zero-candidate totals are point-in-time reports. State A is an inference supported by those reports and the absence of any higher-state evidence. Runtime auth, RLS, no-leak, rollback, monitoring, regression, UI, and accessibility claims remain unverified.

### 4. Changes Proposed Or Made

Changed only the three Agent 11 reports. Proposed remediation:

1. Scan exact serialized Class C strings against every Class D value from the internal revision and bind real LT-5 execution to artifact hashes.
2. Keep IRT-004 explicitly point-in-time unless a privacy-safe manifest with path, hash, schema, allowlist, row count, and independently recomputed totals exists.
3. Regenerate all evidence after final code, verify all checksums against one clean immutable commit, and rerun independent review.
4. Supply the unchanged external State C evidence before any State C clearance request.

### 5. Tests Performed

```sh
node --test tests/exports-class-c.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/ui.test.mjs tests/api.test.mjs
node --test tests/evidence-validator.test.mjs
npm test
npm audit --omit=dev --audit-level=low
git diff --check 6ac62c5a0503981680f161fe5119d5e5e2fa031a..aebc98795f28fdfc2b130e118be762a30f536259
git ls-tree -r --name-only aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform | rg -i 'row.*manifest|manifest.*row|inventory.*rows|candidate.*rows|aggregate.*manifest'
```

Results: focused `61` pass and `0` fail; evidence validator `30` pass and `0` fail; package `215` pass, `0` fail, `1` gated PostgreSQL skip; audit `0 vulnerabilities`; diff check pass; row-manifest search no match. Exact Git-object checksum probe: `44` checked and `3` stale. Exact Class D value probe: leak reproduced.

Initial disposable PostgreSQL proof remains historical at `12` pass, `0` fail, `0` skip; SQL did not change. No external, browser, staging, production, monitoring, protected-consumer, or operational rollback test was run.

An exact-checkout `npm run validate` was not run because the shared worktree had advanced and this agent could not materialize or replace files outside the three report outputs. Exact Git-object checks establish three `E_ARTIFACT_STALE` conditions and `E_REAL_INVENTORY_QUALIFICATION` at `aebc987`; no later-worktree result is credited.

### 6. Risks

Current risks are Class D value disclosure through student prose, overstated leak-test coverage, a stale exact-commit evidence packet, self-asserted recomputability without a manifest, and mistaken promotion of local review and SQL mechanics into runtime certification. All initial external and operational risks remain.

### 7. Blockers

State C remains blocked by IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-009 blocks consumer and student release. IRT-004 blocks unqualified count certification. IRT-010 blocks exact-commit evidence clearance. All six flags must remain off.

### 8. Confidence

State C veto: `0.998`.
IRT-003 local resolution: `0.98`.
IRT-002 overall remains open: `0.995`.
Exact `aebc987` evidence staleness: `1.00`.
State A as highest supportable point-in-time state: `0.92`.
Independent recomputability of exact corpus and candidate totals: `0.00` without a retained manifest.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`. Mark IRT-003 locally resolved, IRT-002 partially resolved but open, IRT-004 open, IRT-009 open, and IRT-010 open. Do not report exact `aebc987` as evidence-validator green. Request another independent review only after one new pushed immutable checkpoint contains the final code and regenerated matching evidence, and only consider State C after all missing external integration and operational proof exists.

## Final Post-Repair Rerun: 2026-07-15

Audited pushed checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

### 1. Scope Completed

Independently inspected exact Git objects, JavaScript and SQL Class D isolation, release-linked identifier families, validation ordering, frozen STAT projection, public question identity, reviewer access, all 44 checksum records, inventory qualification, evidence validation, and current tests. No non-report path or protected system was changed.

### 2. Evidence Inspected

Key paths are `src/exports.mjs:62-161,183-218,289-344`, `src/platform.mjs:1157-1206`, migration `20260715122434_i1q_1007x_question_platform.sql:2866-3213`, `tests/exports-class-c.test.mjs:215-385`, `tests/postgres-migration.test.mjs:202,312`, and exact `2d28d0b` evidence under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/`.

### 3. Findings

| Finding | Final disposition |
| --- | --- |
| IRT-009 | `OPEN, HIGH`. Direct isolation passes, but double URL-encoded Class D values and markers bypass JavaScript before artifact and manifest hashing. |
| IRT-010 | `CLOSED`. All `44/44` checksum entries match exact Git-object bytes and hashes; qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest exists. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical integration and operational evidence remain absent. |

IRT-009 matrix results: `28/28` direct identifier and field combinations denied, `172/196` encoded identifier combinations denied, and `20/24` encoded marker combinations denied. The `28` bypasses are double URL-encoded cases. A targeted bypass remained in the Class C payload and produced both artifact and manifest hashes. The opaque public composite question ID remained valid, and the frozen nine-column STAT projection remained exact.

SQL source places value and marker checks before hashing and insertion and gathers all seven requested release-linked identifier families. A fresh independent PostgreSQL run was not completed because local storage prevented disposable-cluster creation. No SQL runtime clearance is claimed.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. Exact remediation is bounded iterative decoding until stable, double and triple encoding tests for every family and field in JavaScript and PostgreSQL, and proof that denied payloads leave no hash or inserted artifact.

### 5. Tests Performed

- Focused: `84` pass, `0` fail, `0` skip.
- Full package: `223` pass, `0` fail, `1` gated PostgreSQL skip, `224` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Exact checksum comparison: `44/44`, `0` stale.
- Independent JavaScript matrix: `248` attempts, `220` denied, `28` bypasses.
- Disposable PostgreSQL: not run because `/tmp` returned `no space left on device` before startup.

Commands included `node --test` on the six focused files, `npm test`, `npm run validate`, `npm audit --omit=dev --audit-level=low`, exact `git show` checksum comparison, exact-tree manifest search, and a memory-only `buildReleaseArtifacts` encoding matrix.

### 6. Risks

Iteratively encoded internal identifiers can be hashed into JavaScript release artifacts. Green committed tests omit this encoding depth. Changed SQL lacks a fresh independent runtime execution. Point-in-time counts may be overstated downstream. All external State C risks remain.

### 7. Blockers

IRT-009 blocks student and consumer release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 veto State C. IRT-004 blocks unqualified count certification. IRT-010 is closed. All six flags must remain off, and no State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `0.999`.
State A point-in-time support: `0.95`.
IRT-009 open: `1.00`.
IRT-010 closed: `1.00`.
IRT-003 locally resolved: `0.98`.
Independent count recomputability: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry State C veto and State A only as a dated point-in-time aggregate. Mark IRT-009 open, IRT-010 closed, IRT-004 explicitly non-recomputable, and IRT-003 locally resolved only. Do not claim State B, C, D, consumer release, global leak safety, or SQL runtime clearance.

## Final Iterative-Isolation Rerun: 2026-07-15

Audited pushed checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

`IRT-009 OPEN, HIGH`

`IRT-010 CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Independently inspected exact Git objects, repair history, JavaScript and PostgreSQL Class D normalization and isolation, all seven identifier families, all four Class C prose fields, required encodings, validation order, hash and insert order, bounded depth and size behavior, zero-row expectations, frozen STAT projection, public question identity, all 44 checksum records, inventory qualification, validator, package tests, root audit, and fresh disposable PostgreSQL 16 behavior.

No product, evidence, authority, root, shared, external, production, protected-system, deployment, flag, commit, or push mutation occurred.

### 2. Evidence Inspected

- `65bb52c:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- `65bb52c:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866-2955,3001-3146,3237-3293`.
- `65bb52c:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- `65bb52c:i1q-question-platform/tests/postgres-migration.test.mjs:568-713,816-980`.
- Exact evidence objects `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `health_check_results.json`.
- All preserved external integration, auth, RLS, rollback, monitoring, consumer, browser, UX, and accessibility evidence.

### 3. Findings

| Finding | Current disposition |
| --- | --- |
| IRT-009 | `OPEN, HIGH`. JavaScript passes the requested matrix. PostgreSQL permits mixed-case source identifiers under full printable-ASCII double and triple URL encoding. |
| IRT-010 | `CLOSED`. All `44/44` checksum records match exact Git objects and inventory qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest was retained. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical auth, runtime grants and composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence remain absent. |

JavaScript denied `196/196` combinations: 7 release-linked identifier families, 4 prose fields, and 7 direct or encoding variants. It also failed closed at URL depth 9 and 65,537 bytes. The opaque public question ID remained valid and the STAT projection remained exactly nine fields.

PostgreSQL's direct scanner detected `47/49` family and variant pairs. It missed full printable-ASCII depth 2 and depth 3 for the actual mixed-case release-linked source fixture. Eight dynamic probes across both depths and all four fields persisted `8` artifact rows and `8` payload rows in `8` fresh disposable releases. Checks therefore did not run successfully before hashing and insertion. The required zero-persistence assertion fails.

Root cause: SQL lowercases before iterative URL decoding at migration line `2916`. Printable-ASCII decoding at lines `2917-2929` restores uppercase bytes after that case fold, and the value is returned without another lower operation. Direct comparison at line `3120` then misses the lowercase release identifier.

Exact remediation:

1. Case-fold after every SQL decode pass and immediately before comparison.
2. Add mixed-case actual identifiers for all seven families and every required variant and prose field.
3. Assert `42501` leak denials, `54000` depth and size denials, and zero artifact and payload rows.
4. Regenerate the evidence packet and checksums after the code and test repair.

IRT-010 remains closed only for exact evidence integrity. State A remains a dated report: 97 registry rows, 97 transcript references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. Exact evidence explicitly says `POINT_IN_TIME_AGGREGATE`, no row manifest, and no independent Git recomputability.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. No other path was edited. Proposed only the IRT-009 SQL and regression-test repair plus the unchanged external State C evidence requirements.

### 5. Tests Performed

```sh
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Results:

- Exact `HEAD` and tracked origin: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`.
- Focused: `88` pass, `0` fail, `0` skip.
- Package: `227` pass, `0` fail, `1` gated skip, `228` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh PostgreSQL: `13` pass, `0` fail, `0` skip.
- JavaScript adversarial matrix: `196/196` denied, bounds passed, opaque ID valid, 9 fields exact.
- PostgreSQL scanner matrix: `47/49` detected, `2/49` bypassed.
- PostgreSQL persistence matrix: `8/8` bypasses persisted artifacts and payloads.
- Exact checksum comparison: `44/44`, `0` stale.

The additional independent matrices were executed as memory-only `node --input-type=module` and `psql -X -v ON_ERROR_STOP=1` heredocs against fresh disposable clusters. No repository fixture or test was altered.

### 6. Risks

- PostgreSQL can persist an encoded mixed-case Class D identifier in student-facing Class C prose.
- The green committed PostgreSQL suite does not cover the failing mixed-case full-ASCII cross-product.
- Checksum-perfect evidence may be misread as release clearance.
- Point-in-time aggregate counts may be misreported as recomputable or current.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 veto State C. IRT-004 blocks unqualified count certification. IRT-010 is not a current evidence-integrity blocker.

All six flags must remain off. No State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A point-in-time support: `0.95`.
IRT-009 open: `1.00`.
IRT-010 closed: `1.00`.
IRT-003 local closure: `0.98`.
Independent count recomputability: `0.00`.
PostgreSQL Class D isolation clearance: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. At exact `65bb52c`, mark IRT-009 open and IRT-010 closed. Preserve IRT-004's non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, consumer release, student release, global no-leak safety, or PostgreSQL isolation. Require a new pushed immutable repair checkpoint, zero-persistence proof for the exact matrix, regenerated checksum-matching evidence, and another independent rerun. State C additionally requires every unchanged external integration and operational artifact.

## Final SQL Case-Folding Rerun: 2026-07-15

Audited pushed checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Branch: `i1q-question-platform-ultra-1007x-ma`

`STATE C RELEASE VETO`

`STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

`IRT-009 CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`

`IRT-010 CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Independently inspected exact Git objects, the SQL case-folding repair, mixed-case relational fixtures for all seven identifier families, all required field and encoding variants, marker and limit probes, SQLSTATE and zero-row assertions, validation order, JavaScript release construction, frozen STAT projection, public question identity, all 44 checksums, inventory qualification, package and focused tests, validator, root audit, and fresh disposable PostgreSQL 16 behavior.

Only the three Independent Red Team reports were changed. No product, test, evidence, authority, root, shared, external, protected, deployment, flag, Git, or remote mutation occurred.

### 2. Evidence Inspected

- `ba17e22:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2896-2955,3073-3147,3238-3294`.
- `ba17e22:i1q-question-platform/tests/postgres-migration.test.mjs:398-563,609-753,884-1064`.
- `ba17e22:i1q-question-platform/tests/migration-1007x.test.mjs:238-300`.
- `ba17e22:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- `ba17e22:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact evidence objects `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `test_results.json`, and `migration_validation.json`.
- All prior external integration, auth, RLS, rollback, monitoring, consumer, browser, UX, and accessibility evidence.

### 3. Findings

| Finding | Current disposition |
| --- | --- |
| IRT-009 | `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`. JavaScript and fresh PostgreSQL independently deny the complete requested matrix before hashing or insertion. |
| IRT-010 | `CLOSED`. All `44/44` checksum records match exact Git objects and inventory qualification fields exist. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE`. No privacy-safe row manifest was retained. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE`. External runtime behavior remains unverified. |
| State C blockers | `OPEN`. Canonical auth, runtime grants and composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence remain absent. |

The full `65bb52c` mixed-case SQL finding remains preserved above. At `ba17e22`, SQL lowercases after every URL decode pass and after final normalization. Independent JavaScript denied `196/196` identifier probes. Independent PostgreSQL denied `196/196` identifiers plus `16/16` markers, returned `54000` for depth 9 and 65,537-byte limits, and persisted `0` artifact and `0` payload rows. All leak denials used `42501`. The opaque public question ID remained valid and the STAT projection remained exactly nine frozen fields.

The Class D checks occur at migration lines `3238-3254`, before hashing at `3268`, artifact insertion at `3269`, and payload insertion at `3293`. Any bypass in the independent harness would have surfaced as an uncaught uniqueness or insertion error, so the observed `42501` results establish rejection before those operations for the tested contract.

IRT-010 remains closed with `44/44` exact Git-object matches and `0` stale records. State A remains only a dated report: 97 registry rows, 97 transcript references, 97 nodes references, 0 local VTT files, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. Exact evidence explicitly declares `POINT_IN_TIME_AGGREGATE`, no retained row manifest, and no independent Git recomputability.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. No further local IRT-009 change is proposed at this checkpoint. All external State C evidence remains required.

### 5. Tests Performed

```sh
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
git diff --check 65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Results:

- Exact `HEAD` and tracked origin: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`.
- Focused: `88` pass, `0` fail, `0` skip.
- Package: `227` pass, `0` fail, `1` gated skip, `228` total.
- Evidence validator: `20/20`, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh PostgreSQL: `13` pass, `0` fail, `0` skip.
- JavaScript matrix: `196/196` denied, limits passed, opaque ID valid, 9 fields exact.
- Independent PostgreSQL matrix: `196/196` identifiers and `16/16` markers denied, `2/2` limits fail closed, `0` persisted artifacts, `0` persisted payloads.
- Exact checksum replay: `44/44`, `0` stale.
- Exact-tree row-manifest search: `0` matches.

Fresh clusters used `initdb -U postgres -A trust --no-locale -E UTF8`, `pg_ctl`, and automatic cleanup traps. Independent JavaScript and SQL matrices were memory-only heredocs and did not alter repository files.

### 6. Risks

- Local exact-checkpoint closure may be overstated as deployed no-leak certification.
- The normalization contract is intentionally bounded; over-depth and over-size inputs fail closed.
- Point-in-time aggregate counts may be misreported as independently recomputable or current.
- Checksum-perfect evidence does not prove external integration or operations.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 and IRT-010 are closed at `ba17e22`. IRT-001, IRT-005, IRT-006 in external scope, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified count certification.

All six flags must remain off. No State B, C, or D clearance, production release, consumer release, student release, or global deployed leak clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A point-in-time support: `0.95`.
IRT-009 local exact-checkpoint closure: `0.995`.
IRT-010 closure: `1.00`.
IRT-003 local closure: `0.98`.
Independent count recomputability: `0.00`.
Global deployed no-leak clearance: `0.00`.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 and IRT-010 closed at exact `ba17e22`, while preserving the `65bb52c` finding and all earlier history. Preserve IRT-004's non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, production release, consumer release, student release, or global deployed no-leak safety. State C still requires canonical auth, runtime grants and Postgres composition, preview and staging, browser and accessibility proof, human validation, operational rollback, monitoring, and protected-consumer certification on one immutable checkpoint.
