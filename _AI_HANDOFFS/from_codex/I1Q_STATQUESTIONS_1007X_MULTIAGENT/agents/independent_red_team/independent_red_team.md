# I1Q-1007X Independent Red Team

Ticket: `I1Q-1007X-MA`
Agent: `Agent 11, fresh-context Independent Red Team`
Initial audited engineering checkpoint: `6ac62c5a0503981680f161fe5119d5e5e2fa031a`
First post-repair checkpoint: `aebc98795f28fdfc2b130e118be762a30f536259`
Final post-repair checkpoint: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Final iterative-isolation checkpoint: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Final SQL case-folding checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Date: `2026-07-15`
State C verdict: `RELEASE VETO`
State A verdict: `SUPPORTED WITH EVIDENCE QUALIFICATION`

The initial audit and every prior rerun below are preserved. The current disposition is in `Final SQL Case-Folding Rerun: 2026-07-15`.

State C is not cleared. The latest checkpoint has strong local contract proof, but it is not an authenticated internal production system. Canonical auth, the unprivileged runtime role and grants, HTTP-to-Postgres wiring, staging, browser and accessibility proof, monitoring, operational rollback, and protected-consumer certification do not exist. The original Class D projection, reviewer-content defect, and IRT-009 SQL encoding bypass are now closed in local exact-checkpoint scope. No external or operational clearance follows.

State A is supported as a dated, aggregate, point-in-time corpus inventory attestation. The reported 97 registry rows, 97 transcript JSON references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals are internally consistent with the current reports. The exact 97-source and zero-candidate totals cannot be independently recomputed from a retained aggregate row manifest because the generator hard-codes the totals and digests.

## 1. Scope Completed

Completed a fresh-context, read-only review of MissionMed OS boot and current-state authority, the Question Platform passport, DR-006, architecture 1002.1 and amendment 1004C, Git history and diff through exact checkpoint `6ac62c5`, application and UI source, OpenAPI, primary SQL migration, compensating migration, repository adapter, tests, evidence validator, all current evidence files, root reports, and specialist reports for security, datastore, privacy, medical content, assessment science, UX, accessibility, release reliability, and ecosystem dependencies.

No production system, protected runtime, secret, configured environment value, source object, raw transcript, student data, Stream, R2, CDN object, Supabase, Railway, WordPress, or external datastore was accessed. No deployment, flag change, provider mutation, Git commit, or push was performed.

## 2. Evidence Inspected

Primary authority:

- `/Users/brianb/MissionMed_OS/BOOT.md`
- `/Users/brianb/MissionMed_OS/CURRENT.md`
- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`

Binding architecture:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_REVISED_ENTITY_AND_RELATIONSHIP_MODEL.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_fable/I1Q_STATQUESTIONS_1004C_ARCHITECTURE_AMENDMENT/I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md`

Engineering and evidence:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

Root and specialist evidence included the corpus, privacy, auth, RLS, security, datastore, rollback, monitoring, staging, production, smoke, protected-system, dependent-product, UI, accessibility, pilot, batch, blockers, and human-action reports under `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

## 3. Findings

### Evidence Classification

| Classification | Determination |
| --- | --- |
| Verified current fact | Git HEAD is exactly `6ac62c5a0503981680f161fe5119d5e5e2fa031a`. |
| Verified current fact | Package tests pass `205`, fail `0`, and intentionally skip `1` environment-gated PostgreSQL case. |
| Verified current fact | A fresh disposable PostgreSQL 16 run passes `12`, fails `0`, and skips `0`; it covers apply, exact reapply, role attacks, compensation twice, retained history, and reapply. |
| Verified current fact | Evidence validation passes `20/20` and claims only `STATE_A`; root `npm audit` reports `0` vulnerabilities. |
| Verified current fact | The committed evidence declares no deployment URL and all six flags false. This is file evidence, not a runtime query. |
| Verified current fact | No canonical identity resolver, runtime grant manifest, HTTP-to-Postgres wiring, staging URL, production URL, browser evidence, monitoring target, or operational rollback proof exists in the inspected checkpoint and packet. |
| Verified current fact | The generated Class C `stat_post_answer_debrief` contains the key `misconception_id`, which binding architecture classifies as Class D. |
| Verified current fact | Generic revision reads strip answer and rationale data for every role, while the UI has no purpose-scoped answer endpoint. Review screens can submit verdicts without displaying the required protected content. |
| Verified current fact | Repository evidence contains no real transcript, nodes, VTT, or real-candidate artifact. The only transcript fixture found is explicitly synthetic. |
| Point-in-time report | A 2026-07-15 read-only production inventory reports 97 registry rows, 97 transcript JSON responses, 97 nodes responses, 0 local VTT files, and 97 privacy-blocked sources. |
| Point-in-time report | Current root and specialist reports state 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. |
| Point-in-time report | Protected-runtime comparison reports four tracked-to-deployed hash divergences and no authenticated consumer smoke. This Red Team did not repeat that protected-runtime access. |
| Inference | State A is the highest supportable classification because authority exists, a detailed aggregate inventory report exists, all higher-state gates remain closed, and no real extraction or candidate artifacts exist. |
| Inference | No current student leak is occurring through I1Q because no I1Q deployment exists and all consumer and student flags are recorded off. This does not clear the release code. |
| Unverified claim | The external corpus still contains exactly 97 rows at the time this report is read. No current production query was permitted. |
| Unverified claim | A real runtime would preserve auth, RLS, answer isolation, source isolation, session revocation, and pool transaction isolation. |
| Unverified claim | The repaired UI meets the required score, WCAG 2.2 AA, responsive behavior, or human usability gates. |
| Unverified claim | Protected consumers have no regression, operational rollback is safe, monitoring works, or no answer or source leak exists in a future deployed runtime. |

### IRT-001: State C integration and operations do not exist

Severity: `CRITICAL`
Disposition: `STATE C RELEASE VETO`

Evidence:

- The migration labels itself an offline app-owned candidate and records unresolved auth, grants, preview, staging, and canonical migration routing at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:4-11`.
- The server accepts an injected resolver but the executable start path supplies none and starts in auth-required mode at `i1q-question-platform/src/server.mjs:132-170` and `i1q-question-platform/src/server.mjs:383-390`.
- The deployment record is `BLOCKED_NOT_DEPLOYED`, has no URL, records all flags false, and lists the missing auth, runtime role, staging, browser, and rollback gates at `i1q-question-platform/evidence/deployment_manifest.json:3-22`.
- Monitoring is a plan with no target or alert route. Rollback evidence is `DESIGNED_NOT_EXECUTED`.

Reproduction:

```sh
git rev-parse HEAD
nl -ba i1q-question-platform/src/server.mjs | sed -n '132,170p;383,390p'
nl -ba i1q-question-platform/evidence/deployment_manifest.json
```

Exact remediation:

1. Obtain the owner-approved canonical MissionMed identity resolver, including fresh session validation, revocation, logout, CSRF, trusted origins, role derivation, timeout, and outage behavior.
2. Add a reviewed least-privilege runtime grant migration for a named non-owner, non-superuser, non-`BYPASSRLS` role.
3. Wire the HTTP service to `PostgresRepository` with one dedicated transaction connection per actor context. Remove `MemoryRepository` from every non-synthetic start path.
4. Register the exact GitHub preview, staging, internal-production, rollback, and monitoring workflows and destinations.
5. Execute auth, RLS, pool-reuse, browser, accessibility, rollback, reapply, monitoring, and protected-consumer tests on one immutable commit.
6. For State C, prove `internal_platform_enabled=true` and `internal_review_enabled=true` while the four student and consumer flags remain false.

### IRT-002: Class D metadata leaks into the Class C student debrief

Severity: `HIGH`
Disposition: `BLOCK CONSUMER OR STUDENT RELEASE`; material release-validator defect

Evidence:

- Binding architecture says Class D never appears in a student artifact, classifies misconception IDs as D, and makes LT-5 a blocking test at `I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md:12-15`, `:31-37`, and `:68-74`.
- `projectStatDebrief` emits `misconception_id` in the Class C debrief at `i1q-question-platform/src/exports.mjs:72-86`.
- `buildReleaseArtifacts` labels that payload `stat_post_answer_debrief`, Class C at `i1q-question-platform/src/exports.mjs:119-146`.
- Release validation verifies caller-supplied official check labels and artifact metadata hashes, but does not execute LT-5 against the exact payload at `i1q-question-platform/src/exports.mjs:183-223` and `i1q-question-platform/src/platform.mjs:1109-1156`.

Reproduction:

```sh
cd i1q-question-platform
node --input-type=module -e "import { projectStatDebrief } from './src/exports.mjs'; const row={dataset_version:'d',question_id:'q',answer:'A',explanation:'x'}; const revision={answer:'A',correct_answer_rationale:'x',choices:[{key:'A'},{key:'B',why_tempting:'x',why_wrong:'x',misconception_id:'internal_tag'}]}; console.log(JSON.stringify(Object.keys(projectStatDebrief(row,revision).distractor_rationales[0]).sort()));"
```

Observed key set: `["choice_key","misconception_id","why_tempting","why_wrong"]`.

Exact remediation:

1. Remove `misconception_id` and every Class D field from the student debrief projection. Keep only permitted rationale prose.
2. Define a closed-world field policy for every Class C student channel, not only Class A.
3. Execute LT-1 through LT-6 against the exact serialized payloads before validation can be recorded.
4. Bind each test result, validator version, artifact hash, and immutable payload hash into validation evidence. Do not accept status labels as proof of execution.
5. Add a regression that fails whenever `misconception_id`, item IDs, claim IDs, reviewer IDs, source IDs, or psychometrics appear in any student-channel artifact.

### IRT-003: Assigned reviewers cannot inspect the answer and rationale content they attest

Severity: `HIGH`
Disposition: `STATE C INTERNAL REVIEW BLOCKER`

Evidence:

- Binding RBAC requires assigned editorial and physician reviewers to read Class B for their item, and UX-1 requires stem, choices, rationales, claims, source anchors, events, and flags in one screen at `I1Q_1004C_CHANNEL_SECURITY_AND_ANSWER_ISOLATION.md:61-64`, `:76-85`, and `I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md:84-97`.
- Generic `item_revisions` sanitization strips choice rationale fields and recursively removes answer fields for every actor at `i1q-question-platform/src/platform.mjs:716-750`.
- SQL and the repository provide a purpose-scoped audited answer reader at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:1671-1768` and `i1q-question-platform/src/postgres-repository.mjs:116-126`.
- The HTTP route table exposes no answer-reader endpoint at `i1q-question-platform/src/server.mjs:294-370`.
- Distractor review explicitly reports that the answer key is withheld and no route exists at `i1q-question-platform/public/app.js:958-992`. Editorial and physician screens show rubrics and verdict controls but no answer, explanation, correct rationale, or distractor rationales at `i1q-question-platform/public/app.js:1060-1223`.

Reproduction:

```sh
rg -n "readItemRevisionAnswers|revision-answers|answer-access" i1q-question-platform/src/server.mjs i1q-question-platform/public/app.js i1q-question-platform/openapi.json
nl -ba i1q-question-platform/src/platform.mjs | sed -n '716,750p'
nl -ba i1q-question-platform/public/app.js | sed -n '958,992p;1060,1223p'
```

Exact remediation:

1. Add a purpose-scoped endpoint backed only by `PostgresRepository.readItemRevisionAnswers`.
2. Require an accepted assignment, active exact role, current credential for medical review, exact immutable revision hash, CSRF and origin validation, and a canonical identity context.
3. Audit every successful and denied protected-answer access without logging payload values.
4. Render stem, choices, answer, explanation, rationales, current claims, source anchors, flags, and prior review events in the required one-screen review view.
5. Prevent protected content from entering browser persistence, analytics, errors, logs, or generic resource caches.
6. Add negative tests for unassigned, open, completed, revoked-role, expired-credential, wrong-purpose, wrong-hash, and read-only actors.

### IRT-004: State A counts are internally consistent but not independently reproducible

Severity: `HIGH` evidence-integrity gap
Disposition: `STATE A SUPPORTED WITH QUALIFICATION`

Evidence:

- The generator hard-codes the two inventory digests and all 97-source totals at `i1q-question-platform/scripts/generate_evidence.mjs:170-209`. It hard-codes zero real candidates and approvals at `:220-228`.
- The validator checks that real-inventory digests look like hashes and that the classification and totals object exist, but it cannot recompute either digest or count at `i1q-question-platform/src/validate-evidence.mjs:1871-1877`.
- State A validation only requires `REAL_CORPUS_INVENTORIED` at `i1q-question-platform/src/validate-evidence.mjs:1906-1910`.
- The detailed point-in-time inventory attests 97 rows and 97 successful transcript and nodes probes at `I1Q_1007X_CORPUS_INVENTORY.md:13-56`, while also confirming 0 working transcripts and all 97 blocked at `:101-124`.

Reproduction:

```sh
nl -ba i1q-question-platform/scripts/generate_evidence.mjs | sed -n '170,228p'
nl -ba i1q-question-platform/src/validate-evidence.mjs | sed -n '1871,1910p'
rg -l "d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1" .
```

Exact remediation:

1. Retain a privacy-safe aggregate manifest with one opaque, non-reversible source identity per authorized registry row.
2. For each row, retain only source digest, transcript status and digest, nodes status and digest, VTT status, speaker-evidence class, privacy status, extraction status, and probe timestamp. Retain no title, URL, path, speaker string, or source text.
3. Derive every count and aggregate digest from that manifest during evidence generation.
4. Make the validator recompute row counts, duplicate counts, status totals, and Merkle or canonical manifest digests.
5. Derive candidate and approval totals from an equivalent aggregate-only candidate-state manifest or a signed datastore query result. Do not use literals as release evidence.

### IRT-005: RLS is strong offline but unproven for the intended runtime

Severity: `HIGH`
Disposition: `RLS CLEARANCE WITHHELD FOR STATE C`

Evidence:

- Local PostgreSQL proof passed all 12 tests, including denial, active-role and credential checks, policy binding, compensation, and reapply.
- The migration derives identity from `auth.uid()` and current database memberships at `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:934-980`.
- It revokes PUBLIC and built-in client access and explicitly says runtime grants are absent at `:3231-3255`.
- The default server constructs `QuestionPlatform`, whose default repository is `MemoryRepository`, at `i1q-question-platform/src/server.mjs:148` and `i1q-question-platform/src/platform.mjs:371-376`.

Reproduction:

```sh
rg -n "new QuestionPlatform|PostgresRepository|MemoryRepository" i1q-question-platform/src/server.mjs i1q-question-platform/src/platform.mjs
nl -ba i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql | sed -n '3231,3255p'
```

Exact remediation:

1. Create the approved least-privilege runtime role and exact grants through the canonical migration workflow.
2. Prove the role is not owner, superuser, or `BYPASSRLS`, and cannot call compensation, audit append, unrestricted answer, or raw-source functions.
3. Wire the repository and test pooled connection reuse, transaction-local `auth.uid()`, logout and revocation, cross-user and cross-assignment denial, concurrent writes, and query plans in preview and staging.
4. Repeat the 12-test matrix using the exact deployed migration bytes and runtime role.

### IRT-006: No-leak claims are local only

Severity: `HIGH`
Disposition: `NO GLOBAL ANSWER-LEAK OR SOURCE-LEAK CLEARANCE`

Evidence:

- The local suite proves closed-world Class A pre-answer behavior and trusted post-answer finalization mechanics.
- Evidence validation reports no source-content leak in the 20 checked files, and repository inspection found no real transcript or real candidate artifact.
- The Class D debrief finding disproves complete student-channel leak enforcement.
- No canonical auth session, deployed browser network trace, production log scan, runtime artifact scan, cache test, or monitor probe exists.

Reproduction:

```sh
npm test
npm run validate
find i1q-question-platform -type f \( -iname '*.vtt' -o -iname '*transcript*.json' -o -iname '*nodes*.json' \) -print
```

Exact remediation:

1. Fix IRT-002 and IRT-003.
2. On authenticated staging, capture and scan response bodies, headers, browser storage, service logs, error traces, telemetry, generated artifacts, and cache paths for Class B, Class D, restricted-source, student, patient, and private-reference fields and values.
3. Run every role and phase, including failed auth, failed review, finalization, release validation, rollback, and reapply.
4. Store only privacy-safe test metadata, hashes, and counts as evidence, then obtain fresh independent clearance.

### IRT-007: Rollback, monitoring, and protected-consumer safety are not operationally proven

Severity: `HIGH`
Disposition: `STATE C OPERATIONS BLOCKER`

Evidence:

- The compensating migration is preserving and idempotent locally at `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql:1-20`.
- The evidence record still says `DESIGNED_NOT_EXECUTED` at `i1q-question-platform/evidence/rollback_manifest.json:3-14`.
- The protected comparison reports four tracked-to-deployed hash divergences and says the tracked files cannot be deployment or rollback truth at `I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md:21-53`.
- The dependent-product report explicitly distinguishes unchanged from tested green at `I1Q_1007X_DEPENDENT_PRODUCTS.md:19-25`.
- No monitor destination, probe, alert delivery, runbook execution, or alert-to-rollback drill exists.

Reproduction:

```sh
nl -ba i1q-question-platform/evidence/rollback_manifest.json
nl -ba _AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md | sed -n '21,76p'
```

Exact remediation:

1. Reconcile each protected deployed hash to an owner-approved source and preserve the deployed bytes as rollback artifacts.
2. Execute the canonical staging migration, app deploy, compensation, prior-artifact redeploy, post-rollback auth and RLS checks, protected-consumer checks, and exact reapply.
3. Record operator, commit, artifact and migration hashes, timings, backup identity, feature states, and test results.
4. Configure privacy-safe health, auth, RLS, answer/source leak, audit-chain, flag, dependency, and hash-drift monitors.
5. Prove one alert delivery and one alert-triggered staging rollback before State C review.

### IRT-008: UI, accessibility, and required UX score are not proven

Severity: `HIGH`
Disposition: `STATE C UX AND ACCESSIBILITY BLOCKER`

Evidence:

- Browser evidence is `BLOCKED_NOT_RUN`, with zero viewport checks and zero screenshots at `i1q-question-platform/evidence/browser_results.json:3-27`.
- Accessibility evidence is `BLOCKED_NOT_RUN` and explicitly excludes browser, assistive technology, zoom, reflow, and human validation at `i1q-question-platform/evidence/accessibility_results.json:3-17`.
- The current scorecard preserves only a pre-repair simulated baseline, with category scores below the required floor and no post-repair rescore at `i1q-question-platform/evidence/ux_scorecard.json:3-20` and its final disclaimer.
- Binding architecture makes UX-1 through UX-10 and WCAG 2.2 AA release gates at `I1Q_1004C_REVIEW_OPERATIONS_AND_GOVERNANCE.md:84-102`.

Reproduction:

```sh
nl -ba i1q-question-platform/evidence/browser_results.json
nl -ba i1q-question-platform/evidence/accessibility_results.json
nl -ba i1q-question-platform/evidence/ux_scorecard.json | sed -n '1,45p'
```

Exact remediation:

1. Fix the protected reviewer-content workflow in IRT-003 and every currently open critical or high UX issue.
2. Run authenticated browser journeys for all 17 workflows and required failure states at 320, 390, 760, 768, 1024, 1280, 1440, and 1920 CSS pixels.
3. Run complete keyboard, VoiceOver, NVDA or equivalent, accessibility-tree, 200 percent zoom, 400 percent reflow, text-spacing, target-size, contrast, focus, and live-region tests.
4. Execute the human validation protocol with required personas.
5. Obtain a fresh independent score of at least `9.0` aggregate and at least `8.5` in every category on the exact State C candidate.

## 4. Changes Proposed Or Made

Made only the three report files owned by Agent 11. No application, migration, rollback, test, evidence, root report, specialist report, authority, protected file, feature flag, runtime, or Git state was changed.

Proposed changes are the exact remediation steps in IRT-001 through IRT-008. No remediation was implemented because this agent has report-only ownership.

## 5. Tests Performed

| Test | Result |
| --- | --- |
| `npm test` in `i1q-question-platform` | PASS: 205 pass, 0 fail, 1 intentional PostgreSQL skip |
| Fresh PostgreSQL 16 cluster plus `node --test tests/postgres-migration.test.mjs` | PASS: 12 pass, 0 fail, 0 skip |
| `npm run validate` | PASS: 20/20 files, 0 errors, claimed State A |
| Root `npm audit --omit=dev --audit-level=low` | PASS: 0 vulnerabilities |
| Synthetic key-only Class C debrief probe | FAIL contract: emitted `misconception_id` |
| Authenticated browser, accessibility, staging, production, monitoring, protected consumer, and operational rollback tests | NOT RUN |

The PostgreSQL cluster was created under `/tmp`, used only for the local disposable proof, stopped, and removed. No configured database URL or external datastore was used.

## 6. Risks

- Enabling internal review before the canonical auth and datastore wiring exists could either fail closed or expose memory-backed behavior that is not protected by SQL RLS.
- Reviewers can currently attest medical and editorial criteria without seeing the answer and rationale material.
- A future student debrief would expose an internal misconception identifier unless the projection and LT-5 execution are fixed.
- Literals and unattached digests can make evidence internally green while preventing independent count reproduction.
- Static compensation can be mistaken for operational rollback.
- Unchanged protected products can be mistaken for regression-tested products.
- Source and answer isolation can regress in browser, logs, telemetry, caches, and runtime integration even when local object tests pass.

## 7. Blockers

State C blockers are IRT-001, IRT-003, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-002 blocks every consumer or student release. IRT-004 prevents unqualified independent certification of the exact corpus and candidate totals.

All six flags must remain off. No staging, internal production, consumer activation, student activation, or medical approval is authorized by this report.

## 8. Confidence

Confidence in the State C veto: `0.995`.

Confidence that State A is the highest supportable point-in-time state: `0.90`.

Confidence in the exact 97-source external count as independently reproducible: `0.55`. The detailed reports are credible and mutually consistent, but the retained evidence does not permit row-level aggregate recomputation.

Confidence in the repository-level zero real-candidate count: `0.98`. Confidence in an external datastore count is `0.00` because no canonical datastore exists or was queried.

Confidence in a global no-answer-leak, no-source-leak, RLS, auth, rollback, monitoring, regression, UI, or accessibility clearance is `0.00` until the missing runtime evidence exists.

## 9. Exact File Paths

Owned outputs:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

Primary engineering evidence paths are listed in Section 2 and in each finding. The root handoff is `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/`.

## 10. Handoff To Root Supervisor

Root Supervisor must retain a State C release veto and describe State A as supported only by a dated aggregate inventory attestation. Do not convert local SQL, local auth mechanics, a green evidence validator, or all-flags-off file evidence into staging or production certification.

Before a fresh independent review, Root must close IRT-001 through IRT-008 on one immutable commit, preserve all six flags off during engineering, provide a recomputable privacy-safe count manifest, run exact Class C and LT-5 validation, make assigned review content actually reviewable, and attach canonical staging, auth, RLS, browser, accessibility, rollback, monitoring, and protected-consumer evidence.

## Post-Repair Rerun: 2026-07-15

Audit target: `aebc98795f28fdfc2b130e118be762a30f536259`
Branch: `i1q-question-platform-ultra-1007x-ma`
Repair lineage: `b9bb26a` application repair, `9eadd0e` generated repaired-candidate evidence, `aebc987` aggregate-evidence qualification contract
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`

The exact pushed target was read from Git objects. During the audit, the shared worktree advanced to local commit `6dc408fcf432b727e0d7bee20c5eef83ea479bf3`, one commit ahead of origin. That later commit changes generated evidence only and is outside this verdict. Repair source and tests in the worktree were byte-identical to `aebc987`, proven by `git diff --exit-code` before execution. No later evidence was credited to `aebc987`.

### 1. Scope Completed

Extended the independent audit through exact pushed commit `aebc987`. Re-inspected all 11 `b9bb26a` repair files, all three `aebc987` contract files, the 20 committed evidence records, exact Git-object checksums, inventory and candidate evidence, State C deployment evidence, Class C projection and validation, purpose-scoped reviewer access, UI review rendering, auth and feature gates, and focused and package tests. Reproduced the initial IRT-002 and IRT-003 conditions against current code and challenged IRT-004's machine-readable qualification.

No production, staging, provider, source object, raw transcript, student data, secret, configured environment value, external datastore, or protected runtime was accessed. No deployment, flag, migration, application, evidence, authority, root report, or shared file was mutated.

### 2. Evidence Inspected

Exact repair and qualification changes:

- `b9bb26a`: `i1q-question-platform/openapi.json`, `public/app.js`, `public/styles.css`, `src/exports.mjs`, `src/platform.mjs`, `src/server.mjs`, `tests/api.test.mjs`, `tests/exports-class-c.test.mjs`, `tests/platform.test.mjs`, `tests/security-regressions.test.mjs`, and `tests/ui.test.mjs`.
- `9eadd0e`: all 20 generated evidence records and `artifact_checksums.json`.
- `aebc987`: `scripts/generate_evidence.mjs`, `src/validate-evidence.mjs`, and `tests/evidence-validator.test.mjs`.

High-signal code and evidence locations:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:47` defines the closed-world Class C keys; `:81` validates types and keys; `:153` copies rationale strings; `:193` applies only that validator; `:264` hashes caller-supplied LT check labels and artifact metadata.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:926` implements exact-assignment review content authorization; `:1184` records release validation from check IDs and statuses.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/server.mjs:136` validates a closed-world review-content adapter response; `:215` requires an identity-bound resolver; `:298` gates review routes; `:399` serves the purpose-scoped endpoint and fails closed without an adapter.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/public/app.js:1068` renders protected answer and rationale content; `:1143` and `:1235` block editorial and physician verdicts until that content is available.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/scripts/generate_evidence.mjs:170` declares the intended `POINT_IN_TIME_AGGREGATE` qualification.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/validate-evidence.mjs:569` defines the qualification schema; `:1879` accepts either a qualified point-in-time declaration or three self-asserted recomputable values.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/evidence-validator.test.mjs:638` covers missing point-in-time qualification and contradictory booleans, but does not require or recompute a row manifest.
- Exact `aebc987:i1q-question-platform/evidence/inventory_report.json` lacks `evidence_scope`, `row_manifest_retained`, `independently_recomputable_from_git`, and `qualification`.
- Exact `aebc987:i1q-question-platform/evidence/artifact_checksums.json` contains 44 entries, of which 3 are stale.
- Exact `aebc987:i1q-question-platform/evidence/deployment_manifest.json` says `BLOCKED_NOT_DEPLOYED`, has 0 deployment URLs, claims only `STATE_A`, and records all 6 flags false.

The primary authority, architecture, SQL, compensating migration, auth and RLS boundaries, root reports, specialist reports, and external-evidence limitations listed in the initial audit remain applicable. No repair commit adds canonical auth, runtime role grants, HTTP-to-Postgres composition, staging, browser or human validation, monitoring, operational rollback, or protected-consumer certification.

### 3. Findings

#### Initial Versus Current Status

| ID | Initial status | Current status at `aebc987` | Basis |
| --- | --- | --- | --- |
| IRT-001 | Open, Critical | `OPEN` | No external integration or operational evidence was added. State C remains vetoed. |
| IRT-002 | Open, High | `PARTIALLY RESOLVED, OVERALL OPEN` | The direct `misconception_id` key was removed, but Class D identifier values in permitted prose still pass and ship. See IRT-009. |
| IRT-003 | Open, High | `RESOLVED IN LOCAL APPLICATION SCOPE` | Exact-assignment answer and rationale access now exists, is fail-closed, and has positive and negative tests. Runtime integration remains unverified under IRT-001 and IRT-005. |
| IRT-004 | Open, High | `OPEN, QUALIFICATION CONTRACT INCOMPLETE` | The intended point-in-time declaration is machine-readable in generator code, but absent from exact committed evidence. No row manifest exists, and recomputable mode is not bound to one. |
| IRT-005 | Open, High | `OPEN` | Local RLS proof remains local; no canonical runtime identity, grants, pool composition, preview, or staging proof exists. |
| IRT-006 | Open, High | `OPEN` | Local answer controls improved, but IRT-009 defeats complete Class D value isolation and no runtime scan exists. |
| IRT-007 | Open, High | `OPEN` | Rollback remains designed but not operationally executed; monitoring and protected-consumer proof remain absent. |
| IRT-008 | Open, High | `OPEN` | UI code improved, but browser, screen-reader, human, responsive, and score gates remain not run. |
| IRT-009 | Not present | `NEW OPEN, HIGH` | Class D identifier values can be serialized through allowed Class C prose fields. |
| IRT-010 | Not present | `NEW OPEN, HIGH` | Exact `aebc987` evidence is internally stale and does not satisfy its own new inventory schema. |

#### IRT-002 Current Disposition

The initial direct-field defect is fixed. `projectStatDebrief` now emits only `choice_key`, `why_tempting`, and `why_wrong`, and the validator rejects unknown keys at both levels. IRT-002 is not fully resolved because the binding rule is about Class D information appearing in a student artifact, not only Class D key names. The validator accepts arbitrary nonempty strings and never compares them with actual internal identifiers.

#### IRT-003 Current Disposition

IRT-003 is resolved in the local application scope. `readAssignedReviewContent` requires read and write authorization, exact editorial or medical purpose, an accepted assignment, matching revision, actor, review type, role, hash, workflow state, conflict clearance, and current physician credential where applicable. The HTTP endpoint requires the internal platform and review flags, fails closed with `503` when no canonical resolver exists, validates a closed-world response, and sends `Cache-Control: no-store`. The UI disables verdicts unless protected content is loaded and does not use `localStorage` or `sessionStorage`. Focused tests cover successful editorial access, wrong actor, wrong purpose, open assignment, feature gates, missing adapter, malformed adapter output, exact answer content, and browser-persistence absence.

This local closure does not prove the absent canonical resolver, Postgres wiring, deployed auth, runtime RLS, or staging behavior. Those remain separate State C blockers.

#### IRT-004 Current Disposition

The repair correctly introduces an explicit point-in-time vocabulary in generator and validator code. For the intended current branch, the truthful values are `POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, and `independently_recomputable_from_git=false` with a nonempty qualification.

Two defects keep IRT-004 open:

1. Exact `aebc987` evidence was generated at `9eadd0e` before the schema change. Its committed `inventory_report.json` has none of the four required qualification fields.
2. The alternative `RECOMPUTABLE_AGGREGATE_MANIFEST` branch checks only the enum and two booleans. The schema has no manifest path, manifest hash, schema version, row count, privacy allowlist, or recomputation output. Exact-tree search found no privacy-safe row manifest. A declaration can therefore claim recomputability without evidence.

The 97-source and zero-candidate figures remain point-in-time aggregate reports. They are not promoted to independently recomputable facts.

#### IRT-009: Class D Values Bypass Class C Validation

Severity: `HIGH`
Disposition: `OPEN, BLOCK CONSUMER OR STUDENT RELEASE`

Evidence:

- `src/exports.mjs:109-110` requires only nonempty rationale strings.
- `src/exports.mjs:159-166` copies those strings verbatim into the Class C artifact.
- `src/exports.mjs:193-197` performs only the closed-world key and type validation.
- `tests/exports-class-c.test.mjs` injects a nested object into prose and proves a type failure. It does not inject valid string values equal to item, revision, source, claim, reviewer, misconception, or psychometric identifiers.
- A full `buildReleaseArtifacts` probe succeeded with `why_wrong` equal to the revision's internal `source_ids[0]`; the exact Class D value appeared in the serialized student artifact and the validator returned `[]`.
- `releaseValidationEvidenceHash` and `recordReleaseValidation` bind artifact metadata and caller-supplied LT IDs and statuses. They do not execute LT-5 against serialized values.

Exact minimal reproduction:

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform
node --input-type=module - <<'NODE'
import { projectStatDebrief, validateClassCStatDebriefArtifact } from './src/exports.mjs';
const revision = {
  answer: 'A',
  correct_answer_rationale: 'Synthetic permitted rationale.',
  choices: [
    { key: 'A' },
    { key: 'B', why_tempting: 'Synthetic lure B.', why_wrong: 'internal_source_123', misconception_id: 'miscon_b' },
    { key: 'C', why_tempting: 'Synthetic lure C.', why_wrong: 'Synthetic mismatch C.', misconception_id: 'miscon_c' },
    { key: 'D', why_tempting: 'Synthetic lure D.', why_wrong: 'Synthetic mismatch D.', misconception_id: 'miscon_d' },
  ],
};
const row = { dataset_version: 'synthetic_v1', question_id: 'SYNTHETIC-Q', answer: 'A', explanation: 'Synthetic explanation.' };
const payload = [projectStatDebrief(row, revision)];
console.log(JSON.stringify({
  misconception_key_present: Object.hasOwn(payload[0].distractor_rationales[0], 'misconception_id'),
  class_d_identifier_value_present: JSON.stringify(payload).includes('internal_source_123'),
  validator_findings: validateClassCStatDebriefArtifact(payload),
}));
NODE
```

Observed: `{"misconception_key_present":false,"class_d_identifier_value_present":true,"validator_findings":[]}`. A second probe through complete `buildReleaseArtifacts` observed `{"build_succeeded":true,"class_d_identifier_value_present":true,"validator_findings":[]}`.

Exact remediation:

1. Before hashing or release validation, derive the set of Class D values from each internal revision, including item and revision IDs, source and claim IDs, reviewer IDs, misconception IDs, and psychometric identifiers.
2. Canonically normalize and scan every string in the exact serialized Class C artifact against that set. Reject matches and encoded structured-field markers.
3. Execute LT-5 on the exact serialized payload and bind validator version, findings, execution result, artifact hash, and immutable payload hash into release-validation evidence.
4. Add negative tests for every identifier family in `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`. Use valid strings, not only wrong-typed nested objects.

#### IRT-010: Exact Pushed Evidence Estate Is Stale

Severity: `HIGH`
Disposition: `OPEN, EXACT-COMMIT EVIDENCE CLEARANCE BLOCKED`

Exact Git-object comparison checked all 44 paths in `aebc987:i1q-question-platform/evidence/artifact_checksums.json`. Three entries do not match the same commit:

- Index 13: `i1q-question-platform/scripts/generate_evidence.mjs`
- Index 27: `i1q-question-platform/src/validate-evidence.mjs`
- Index 30: `i1q-question-platform/tests/evidence-validator.test.mjs`

The same exact commit's `inventory_report.json` lacks fields that its cross-file validator contract requires for real inventory. Consequently, a `20/20` validator result from `9eadd0e` or a later unpushed regeneration is not evidence that exact `aebc987` passes.

Exact checksum reproduction:

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000
node --input-type=module - <<'NODE'
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const commit = 'aebc98795f28fdfc2b130e118be762a30f536259';
const show = (path) => execFileSync('git', ['show', `${commit}:${path}`]);
const manifest = JSON.parse(show('i1q-question-platform/evidence/artifact_checksums.json').toString('utf8'));
const entries = manifest.artifacts ?? manifest.files ?? manifest.entries ?? manifest;
const stale = [];
for (let index = 0; index < entries.length; index += 1) {
  const entry = entries[index];
  const path = entry.path ?? entry.file ?? entry.artifact;
  const expected = entry.sha256 ?? entry.checksum ?? entry.hash;
  const actual = createHash('sha256').update(show(path)).digest('hex');
  if (expected !== actual) stale.push({ index, path });
}
console.log(JSON.stringify({ commit, checked: entries.length, stale_count: stale.length, stale }, null, 2));
NODE
```

Observed: `44` checked, `3` stale. The missing qualification fields were independently read with `git show aebc987:i1q-question-platform/evidence/inventory_report.json`. Applying the exact `aebc987` cross-file predicate to that Git blob returned `point_in_time_contract_satisfied=false`, `recomputable_contract_satisfied=false`, and `e_real_inventory_qualification_would_be_issued=true`.

Exact remediation:

1. From a clean immutable candidate containing the final generator, validator, tests, and intended point-in-time qualification, regenerate all evidence through the canonical generator.
2. Ensure `inventory_report.json` explicitly records point-in-time aggregate scope, false row-manifest retention, false Git recomputability, and a nonempty qualification. Do not claim recomputability without an actual privacy-safe manifest.
3. Recompute all 44 or more checksum entries after every source and test change, and verify every path, byte count, and SHA-256 against that same commit.
4. Run the package, focused, disposable PostgreSQL, dependency, and exact `npm run validate` gates from the clean candidate. Commit and push code and evidence as one new immutable checkpoint, then request another independent rerun.

### 4. Changes Proposed Or Made

Made changes only to the three Agent 11 report outputs. No application, test, SQL, evidence, root, authority, or shared file was edited. Proposed remediation is recorded under IRT-004, IRT-009, and IRT-010 and the unchanged initial findings.

### 5. Tests Performed

Commands and results:

```sh
git diff --exit-code aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform/openapi.json i1q-question-platform/public/app.js i1q-question-platform/public/styles.css i1q-question-platform/src/exports.mjs i1q-question-platform/src/platform.mjs i1q-question-platform/src/server.mjs i1q-question-platform/src/validate-evidence.mjs i1q-question-platform/scripts/generate_evidence.mjs i1q-question-platform/tests/api.test.mjs i1q-question-platform/tests/exports-class-c.test.mjs i1q-question-platform/tests/platform.test.mjs i1q-question-platform/tests/security-regressions.test.mjs i1q-question-platform/tests/ui.test.mjs i1q-question-platform/tests/evidence-validator.test.mjs
```

Result: pass with no diff. This pins executed source and tests to `aebc987` despite shared HEAD movement.

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform
node --test tests/exports-class-c.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/ui.test.mjs tests/api.test.mjs
node --test tests/evidence-validator.test.mjs
npm test
```

Results: focused repair suite `61` pass, `0` fail, `0` skip; evidence-validator suite `30` pass, `0` fail, `0` skip; full package `215` pass, `0` fail, `1` intentionally gated PostgreSQL skip out of `216` tests.

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000
npm audit --omit=dev --audit-level=low
git diff --check 6ac62c5a0503981680f161fe5119d5e5e2fa031a..aebc98795f28fdfc2b130e118be762a30f536259
git ls-tree -r --name-only aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform | rg -i 'row.*manifest|manifest.*row|inventory.*rows|candidate.*rows|aggregate.*manifest'
git grep -n -E 'row_manifest|RECOMPUTABLE_AGGREGATE_MANIFEST|independently_recomputable' aebc98795f28fdfc2b130e118be762a30f536259 -- i1q-question-platform
```

Results: dependency audit `0 vulnerabilities`; diff check passed; row-manifest path search returned no matches; all recomputability references are declarations, schema booleans, predicate checks, or tests, with no manifest artifact or binding.

The initial independent disposable PostgreSQL result remains `12` pass, `0` fail, `0` skip. It was not repeated because no SQL, repository, grant, RLS, or compensation file changed from that audited proof through `aebc987`. No external, browser, staging, production, monitoring, protected-consumer, or operational rollback test was run.

An exact-checkout `npm run validate` was not run because the shared worktree had advanced and this agent was forbidden to materialize or replace files outside the three report outputs. Read-only exact Git-object checks independently establish three `E_ARTIFACT_STALE` conditions and the `E_REAL_INVENTORY_QUALIFICATION` condition at `aebc987`. A later-worktree validation result is not substituted for the target commit.

### 6. Risks

- A valid student debrief can disclose an internal Class D identifier through permitted teaching prose.
- Test wording claims identifiers hidden in prose are rejected, while the test covers a wrong-typed object and misses valid identifier strings.
- The exact pushed evidence packet can be mistaken for a green 20 of 20 estate even though three checksums are stale and required qualification fields are absent.
- A future evidence record can self-assert recomputable-manifest mode without naming, hashing, or recomputing any manifest.
- Local review-content success can be mistaken for deployed auth, RLS, and repository safety.
- All initial runtime, rollback, monitoring, protected-consumer, UI, accessibility, and human-validation risks remain.

### 7. Blockers

State C remains vetoed by IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008. IRT-003 is locally resolved but supplies no missing external evidence. IRT-009 blocks every consumer or student release. IRT-004 prevents unqualified count certification. IRT-010 blocks exact-commit evidence clearance.

All six flags must remain off. No State C, consumer, student, staging, internal-production, medical-approval, or evidence-integrity clearance is issued.

### 8. Confidence

Confidence in State C veto: `0.998`.
Confidence that IRT-003 is resolved in local application scope: `0.98`.
Confidence that IRT-002 remains open through IRT-009: `0.995`.
Confidence that exact `aebc987` evidence is stale: `1.00`.
Confidence that State A is the highest supportable point-in-time state: `0.92`.
Confidence that exact 97-source and zero-candidate totals are independently recomputable: `0.00` absent a retained manifest.
Confidence in global auth, RLS, no-leak, rollback, monitoring, regression, UX, or accessibility clearance: `0.00`.

### 9. Exact File Paths

Owned outputs:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

Exact engineering paths and line references are listed in Section 2 and each current finding. Every exact-commit assertion in this rerun is anchored to Git object `aebc98795f28fdfc2b130e118be762a30f536259`.

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED WITH POINT-IN-TIME AGGREGATE QUALIFICATION`. Record IRT-003 as locally resolved. Record IRT-002 as only partially resolved and still open through IRT-009. Do not claim exact `aebc987` evidence validation passed, because the committed estate has 3 stale checksums and omits its newly required inventory qualification fields.

Root should require a new immutable pushed checkpoint that closes the Class D value scan, binds LT-5 execution to exact artifacts, regenerates the evidence estate after the final contract code, and truthfully declares point-in-time aggregate scope. State C must also receive the unchanged canonical auth, runtime grants and Postgres composition, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence before another clearance review.

## Final Post-Repair Rerun: 2026-07-15

Audit target: `2d28d0b271b637f68358fd4aae414aa2f708c63f`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact `HEAD` and exact `origin/i1q-question-platform-ultra-1007x-ma` when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

### 1. Scope Completed

Inspected exact Git objects and the complete repair lineage from `aebc987` through `78e194e`, `7faf05a`, `8e3f96b`, `4a14ad8`, and `2d28d0b`. Re-reviewed JavaScript Class C value isolation, platform release-linked identifier collection, SQL release-artifact value isolation, ordering before hashing and insertion, exact evidence checksums, inventory qualification, frozen STAT projection, opaque public question identity, and local reviewer access. Ran focused tests, the full package suite, evidence validation, root dependency audit, an independent JavaScript adversarial matrix, and exact Git-object evidence checks.

No product, migration, test, evidence, root, authority, deployment, flag, external datastore, or protected system was changed. A fresh disposable PostgreSQL execution was attempted but could not start because `/tmp` repeatedly returned `no space left on device`. The package therefore retained its intentional PostgreSQL skip.

### 2. Evidence Inspected

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs:62` through `:161` normalizes and scans Class D markers and values; `:183` applies the scan; `:289` hashes artifacts; `:301` validates before hashing; `:308` builds releases.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/platform.mjs:1157` collects release-linked review, psychometric, source, rights, privacy, and claim records before artifact construction; `:1194` inserts only after construction returns.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866` normalizes SQL security text; `:2945` gathers actual release-linked item, revision, source, claim, reviewer, misconception, and psychometric identifiers; `:3016` scans values; `:3068` validates artifacts; `:3187` hashes only after the checks; `:3188` and `:3212` insert metadata and payload afterward.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/exports-class-c.test.mjs:215` through `:385` covers direct values, supported encodings, markers, public question identity, all four prose fields, and linked reviewer identifiers.
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/tests/postgres-migration.test.mjs:202` and `:312` contain static SQL assertions and the environment-gated disposable PostgreSQL proof.
- Exact `2d28d0b:i1q-question-platform/evidence/artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `test_results.json`.

All authority, architecture, external integration, auth, RLS, rollback, monitoring, protected-consumer, browser, UX, and accessibility evidence from the preserved audits remains applicable.

### 3. Findings

#### Current Dispositions

| ID | Final status at `2d28d0b` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | No canonical State C integration or operational evidence was added. |
| IRT-002 | `PARTIALLY RESOLVED, OVERALL OPEN` | Direct Class D keys and direct values are blocked, but IRT-009 retains an encoded-value bypass. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Purpose-scoped exact-assignment review content remains available and fail-closed in focused tests. No runtime certification follows. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Exact evidence now declares `POINT_IN_TIME_AGGREGATE`, no retained row manifest, and no Git recomputability. Unqualified count certification remains blocked. |
| IRT-005 | `OPEN` | Runtime auth, role, grants, repository composition, and RLS remain unproven externally. |
| IRT-006 | `OPEN` | IRT-009 prevents complete local leak clearance, and no deployed global scan exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer proof remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and score gates remain absent. |
| IRT-009 | `OPEN, HIGH` | Double URL encoding bypasses JavaScript Class D value and marker isolation before hashing. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git-object bytes and hashes, and required inventory qualification fields exist. |

#### IRT-009 Final Disposition

The repair materially improves isolation. An independent matrix injected actual release-linked item, revision, source, claim, reviewer, misconception, and psychometric identifier values into `explanation`, `correct_answer_rationale`, `why_tempting`, and `why_wrong`.

- Direct matrix: `28/28` denied.
- Encoded identifier matrix: `172/196` denied.
- Encoded marker matrix: `20/24` denied.
- Bypasses: `28`, consisting of double URL-encoded separators for item, revision, source, claim, reviewer, and misconception values across all four prose fields, plus double URL-encoded `source_id` markers across all four fields.
- A targeted source-value bypass returned `build_succeeded=true`, retained the encoded value in the Class C payload, and produced both a 64-character artifact hash and a 64-character manifest hash.
- Psychometric double-encoding cases were denied because the marker expression separately detects the psychometric term.
- The opaque public composite question ID was preserved.
- The STAT server projection remained exactly nine columns in frozen order: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.

The cause is one-pass JavaScript percent decoding at `src/exports.mjs:72` through `:84`. `%255F` becomes `%5F` but is not decoded again before comparison. Existing tests cover `%5F`, Unicode escapes, HTML entities, zero-width characters, Base64, and Base64URL, but not iterative URL encoding.

Exact remediation:

1. Decode security text repeatedly until stable with a strict maximum depth and length bound, applying Unicode normalization and zero-width removal at every step.
2. Generate and compare bounded recursive encoding variants for every release-linked Class D value and marker.
3. Add double and triple URL-encoding tests for all seven identifier families in all four prose fields in JavaScript and disposable PostgreSQL.
4. Prove rejection occurs before JavaScript artifact hashing and before SQL metadata or payload insertion, and assert that denied IDs leave no artifact row.

SQL inspection confirms direct checks and supported decoding occur before hash and insertion. Fresh independent execution of the changed SQL was not completed because local storage prevented creation of the disposable cluster. No SQL runtime clearance is claimed.

#### IRT-010 Final Disposition

IRT-010 is closed for exact `2d28d0b`:

- Declared checksum records: `44`.
- Exact Git-object records checked: `44`.
- Matching bytes and SHA-256 records: `44`.
- Stale or missing records: `0`.
- `inventory_report.json` contains `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a nonempty dated qualification.

This closes exact-checkpoint evidence staleness only. It does not clear State C or make aggregate counts independently recomputable.

#### IRT-004 Final Qualification

Exact evidence reports 97 authorized sources, 97 registry rows, 97 transcript references, 97 nodes references, 0 VTT references, 97 privacy-blocked sources, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. These remain dated point-in-time aggregate reports. Exact-tree search found no privacy-safe row manifest. State A remains supportable only with that qualification, and no State B, C, or D claim is supported.

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team report outputs. No other path was edited. Proposed changes are limited to iterative encoding normalization and tests for IRT-009, plus the unchanged external evidence required for State C.

### 5. Tests Performed

```sh
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/platform.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
git ls-tree -r --name-only 2d28d0b271b637f68358fd4aae414aa2f708c63f -- i1q-question-platform
```

Results:

- Focused suite: `84` pass, `0` fail, `0` skip.
- Full package: `223` pass, `0` fail, `1` intentionally gated PostgreSQL skip, `224` total.
- Evidence validator: `20/20` present and parsed, `0` errors, claimed state `STATE_A`.
- Root dependency audit: `0 vulnerabilities`.
- Exact checksum comparison: `44/44` match, `0` stale.
- Independent JavaScript matrix: `248` total identifier and marker attempts, `220` denied, `28` bypassed.
- Targeted bypass: payload, artifact hash, and manifest hash created.
- Fresh disposable PostgreSQL: not run; two creation attempts failed with `no space left on device` before a cluster started.

### 6. Risks

- Iteratively encoded Class D values can enter a JavaScript-built student debrief and be hashed as release material.
- Existing green tests can be mistaken for complete encoding coverage.
- Changed SQL has static and committed test coverage but lacks this rerun's fresh disposable execution.
- Point-in-time counts can still be misstated as independently recomputable if the qualification is omitted in downstream summaries.
- Every preserved external State C risk remains.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified corpus and candidate count certification. The missing fresh PostgreSQL execution prevents independent runtime closure of the changed SQL. IRT-010 is no longer a blocker.

All six flags must remain off. No State B, C, or D clearance is issued.

### 8. Confidence

State C veto: `0.999`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 remains open in JavaScript: `1.00`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Exact corpus and candidate recomputability: `0.00`.
Independent runtime confidence for the changed SQL in this rerun: `0.00` because the disposable cluster did not start.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 open and IRT-010 closed at exact `2d28d0b`. Keep IRT-004's explicit non-recomputability qualification. Do not claim State B, C, D, global leak safety, SQL runtime clearance, or consumer release.

Request another independent rerun only after iterative encoding is rejected in JavaScript and SQL, the changed SQL passes a fresh disposable PostgreSQL matrix, evidence is regenerated on the same immutable checkpoint, and all preserved external State C evidence exists.

## Final Iterative-Isolation Rerun: 2026-07-15

Audit target: `65bb52c4bd14d6d20145e666e3b95b6109dfef83`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact local `HEAD` and exact tracked origin when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`
IRT-009: `OPEN, HIGH`
IRT-010: `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Inspected exact Git objects at `65bb52c`, the repair lineage from `2d28d0b`, JavaScript and PostgreSQL Class D canonicalization, all seven release-linked identifier families, all four permitted Class C prose fields, validation order, hashing and insertion order, the public composite question ID, frozen STAT projection, migration and compensation tests, all 44 checksum records, inventory qualification, candidate evidence, evidence validation, package tests, dependency audit, and a fresh disposable PostgreSQL 16 execution.

Ran independent adversarial matrices without accessing production, source content, credentials, environment values, students, Stream, R2, CDN objects, Supabase, Railway, WordPress, or any protected system. No product, migration, test, evidence, authority, root report, shared file, deployment, feature flag, commit, or remote branch was changed.

### 2. Evidence Inspected

- Exact Git object `65bb52c:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337,340-381`.
- Exact Git object `65bb52c:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2866-2955,3001-3146,3237-3254,3267-3293`.
- Exact Git object `65bb52c:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact Git object `65bb52c:i1q-question-platform/tests/postgres-migration.test.mjs:568-713,816-980`.
- Exact Git objects under `65bb52c:i1q-question-platform/evidence/`, especially `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, and `health_check_results.json`.
- The preserved authority, architecture, auth, RLS, rollback, monitoring, protected-consumer, privacy, UI, UX, and accessibility evidence listed in the initial audit and prior reruns.

### 3. Findings

#### Current Dispositions

| ID | Status at `65bb52c` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | Canonical integration and operational State C evidence remain absent. |
| IRT-002 | `PARTIALLY RESOLVED, OVERALL OPEN` | Direct Class D projection is repaired, but IRT-009 remains a release-path counterexample. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Focused and full tests retain exact-assignment protected review content and fail-closed controls. No external runtime certification follows. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Evidence declares a dated point-in-time aggregate and explicitly declares no retained row manifest or Git recomputability. |
| IRT-005 | `OPEN` | Canonical runtime auth, grants, repository composition, and staging RLS proof remain absent. |
| IRT-006 | `OPEN` | The PostgreSQL IRT-009 counterexample prevents local no-leak clearance, and no deployed global proof exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer certification remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and required UX-score proof remain absent. |
| IRT-009 | `OPEN, HIGH` | PostgreSQL accepts full printable-ASCII double and triple URL encoding of an actual mixed-case release-linked source identifier. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git objects and inventory qualification is present. |

#### IRT-009: PostgreSQL Full-ASCII Mixed-Case Bypass

JavaScript passed the independent cross-product. Seven actual synthetic release-linked identifier families were injected into four permitted prose fields under seven variants: direct, Base64, Base64URL, separator-only URL depth 2 and 3, and full printable-ASCII URL depth 2 and 3. Result: `196/196` rejected with `422`. Depth 9 and `65,537` bytes failed closed. A clean payload retained the opaque public question ID and the exact frozen nine-field STAT projection.

PostgreSQL did not pass the same policy. A direct scanner matrix checked `49` family and variant pairs. It detected `47` and missed `2`: full printable-ASCII depth 2 and depth 3 for the actual mixed-case source fixture. The scalar scan is field-independent. Dynamic artifact creation across four fields and both depths used eight disposable releases and persisted `8` artifact rows and `8` payload rows. Therefore rejection did not occur before hashing or insertion, and the required zero-row result failed.

The root cause is exact and local. `normalize_security_text` lowercases at migration line `2916`, then lines `2917-2929` decode printable ASCII. Encoded uppercase bytes are restored after the only lowercase operation. The function returns that mixed-case result at line `2954`. `contains_release_class_d_identifier` compares it with the lowercase direct identifier at line `3120`, so the direct variant is missed. JavaScript lowercases after iterative decoding and is not affected.

Severity is `HIGH`. Consumer and student release remain vetoed. The existing unique `(release_id, channel)` constraint masked the first expanded probe because a safe debrief already existed, but a fresh release proved real metadata and payload persistence. This is not a theoretical or test-only mismatch.

Exact remediation:

1. Apply case folding after every SQL decode pass and again after the final decode, before residual-encoding checks and comparisons.
2. Preserve canonical mixed-case variants for Base64 and Base64URL while using the fully decoded and case-folded value for direct comparison.
3. Add actual mixed-case fixtures for all seven families, not only source, and inject every required variant into all four prose fields.
4. Assert `42501` for leak denials, `54000` for depth and size limits, and zero matching rows in both `channel_artifacts` and `channel_artifact_payloads`.
5. Regenerate evidence and all checksums only after the repair and rerun on a new immutable checkpoint.

#### IRT-010: Exact Evidence Integrity

IRT-010 remains closed for exact `65bb52c`. The independent script loaded `artifact_checksums.json` from the Git object, loaded each of its 44 paths from the same Git object, and recomputed bytes and SHA-256. Result: `44/44` matched and `0` were stale or missing.

This is evidence-integrity closure only. It does not cure IRT-009, prove the aggregate inventory, or clear State C.

#### IRT-004: Point-In-Time Aggregate Only

Exact inventory evidence declares `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a dated qualification that no privacy-safe row manifest was retained. It reports 97 registry rows, 97 transcript references, 97 nodes references, 0 working-redacted sources, and 0 extraction-ready sources. The point-in-time corpus packet reports 0 VTT matches and all 97 real sources privacy-blocked. Candidate evidence reports 0 real candidates and 0 physician approvals.

These are point-in-time reports, not independently recomputable current facts. No State B, C, or D claim is supported.

#### Evidence Classification

| Classification | Current statement |
| --- | --- |
| Verified current fact | `HEAD` and tracked origin resolved to exact `65bb52c4bd14d6d20145e666e3b95b6109dfef83`. |
| Verified current fact | JavaScript denied `196/196` requested identifier, field, and encoding combinations and failed closed at depth 9 and 65,537 bytes. |
| Verified current fact | PostgreSQL scanner missed 2 of 49 family and variant pairs, and eight dynamic field and depth probes persisted 8 artifacts and 8 payloads. |
| Verified current fact | Focused tests passed 88, package tests passed 227 with 0 failures and 1 gated skip, fresh PostgreSQL passed 13, evidence validation passed 20/20 as State A, and root audit found 0 vulnerabilities. |
| Verified current fact | All 44 checksum records match exact Git-object bytes and hashes. |
| Verified current fact | Deployment evidence has 0 URLs and all 6 feature flags false. |
| Point-in-time report | The dated corpus packet reports the 97-source aggregate and privacy blocks. |
| Point-in-time report | Candidate evidence reports 0 real candidates and 0 physician approvals. |
| Inference | State A remains the highest supportable state only with the dated aggregate qualification. |
| Unverified claim | The external estate still has exactly those corpus and candidate totals now. |
| Unverified claim | Runtime auth, RLS, rollback, monitoring, protected consumers, browser UX, accessibility, or a deployed no-leak boundary works. |

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team reports. Proposed the SQL normalization and regression-test remediation above. No product, evidence, shared, authority, root, Git, or protected-system mutation was made.

### 5. Tests Performed

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Additional exact local commands were memory-only `node --input-type=module` and `psql -X -v ON_ERROR_STOP=1` heredocs. The JavaScript heredoc used 7 families, 4 fields, and 7 variants. The PostgreSQL heredocs created fresh local clusters with `initdb -U postgres -A trust --no-locale -E UTF8`, ran the committed suite, queried all 49 family and variant pairs, and created eight isolated releases for the failing field and depth cross-product.

Results:

- Focused suite: `88` pass, `0` fail, `0` skip.
- Full package: `228` total, `227` pass, `0` fail, `1` intentionally gated PostgreSQL skip.
- Evidence validator: `20/20` files, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh disposable PostgreSQL 16: `13` pass, `0` fail, `0` skip.
- Committed PostgreSQL iterative probes: `56` separator identifiers, `56` full-ASCII identifiers, `8` separator markers, `8` full-ASCII markers, plus depth and size fail-closed probes.
- Independent JavaScript matrix: `196/196` rejected; depth and size bounds passed; opaque ID and 9 fields passed.
- Independent PostgreSQL scanner matrix: `47/49` detected, `2/49` bypassed.
- Independent PostgreSQL persistence matrix: `8` attempted bypasses, `8` artifact rows persisted, `8` payload rows persisted across `8` disposable releases.
- Exact Git-object checksums: `44/44` match, `0` stale.

Two harness setup attempts failed before the relevant test body: the first `initdb` used the OS account instead of `postgres`, and one multi-release seed reused a unique manifest hash. Both disposable clusters were removed by traps, corrected, and rerun successfully. They are not product findings.

### 6. Risks

- A mixed-case internal identifier can be encoded into Class C prose and persisted by PostgreSQL.
- The green 13-test PostgreSQL suite omits the failing mixed-case full-ASCII cross-product and can be mistaken for complete IRT-009 closure.
- Evidence can be internally checksum-correct while documenting a release-blocking implementation defect.
- Aggregate corpus and candidate counts may be overstated as recomputable or current.
- All preserved external State C risks remain.

### 7. Blockers

IRT-009 blocks consumer and student release. IRT-001, IRT-005, IRT-006, IRT-007, and IRT-008 continue to veto State C. IRT-004 blocks unqualified corpus and candidate count certification. IRT-010 is closed only for exact-checkpoint evidence integrity.

All six flags must remain off. No State B, C, or D clearance, global leak clearance, or PostgreSQL Class D isolation clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 open at exact `65bb52c`: `1.00`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Independent corpus and candidate recomputability: `0.00`.
PostgreSQL no-leak clearance: `0.00` because persistence was reproduced.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. Mark IRT-009 `OPEN, HIGH` and IRT-010 `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY` at `65bb52c`. Preserve IRT-004's explicit non-recomputability qualification and IRT-003's local-only closure.

Do not claim State B, C, D, consumer release, student release, global no-leak safety, or PostgreSQL Class D isolation. Require a new pushed immutable checkpoint that case-folds after SQL decoding, adds the exact mixed-case all-family and all-field matrix, proves zero persistence, regenerates matching evidence, and then undergoes another independent rerun. The unchanged canonical auth, runtime grants, staging, browser, accessibility, rollback, monitoring, and protected-consumer evidence is still required before any State C review.

## Final SQL Case-Folding Rerun: 2026-07-15

Audit target: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Branch: `i1q-question-platform-ultra-1007x-ma`
Target relationship: exact local `HEAD` and exact tracked origin when inspected
Current State C verdict: `RELEASE VETO`
Current State A verdict: `SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`
IRT-009: `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE`
IRT-010: `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`

### 1. Scope Completed

Inspected exact Git objects at `ba17e22`, the two-commit repair lineage from `65bb52c` through `e9e807c`, SQL normalization and Class D scanning order, the expanded mixed-case relational fixture, all seven release-linked identifier families, all four Class C prose fields, all seven required variants, encoded markers, bounded depth and size behavior, SQLSTATE assertions, zero-row assertions, JavaScript construction, the frozen STAT projection, the opaque public question ID, package and focused tests, fresh disposable PostgreSQL 16, all 44 evidence checksums, inventory qualification, candidate counts, deployment blockers, evidence validation, and root dependency audit.

No production, protected runtime, source content, transcript, student data, secret, configured environment value, Stream, R2, CDN object, Supabase, Railway, WordPress, or external datastore was accessed. No product, migration, test, evidence, root, authority, shared, deployment, flag, Git, or remote mutation was made.

### 2. Evidence Inspected

- Exact Git object `ba17e22:i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql:2896-2955,3073-3147,3238-3294`.
- Exact Git object `ba17e22:i1q-question-platform/tests/postgres-migration.test.mjs:398-563,609-753,884-1064`.
- Exact Git object `ba17e22:i1q-question-platform/tests/migration-1007x.test.mjs:238-300`.
- Exact Git object `ba17e22:i1q-question-platform/src/exports.mjs:64-65,74-105,129-138,173-193,268-281,321-337`.
- Exact Git object `ba17e22:i1q-question-platform/tests/exports-class-c.test.mjs:301-463`.
- Exact Git objects under `ba17e22:i1q-question-platform/evidence/`, especially `artifact_checksums.json`, `inventory_report.json`, `candidate_counts.json`, `deployment_manifest.json`, `test_results.json`, and `migration_validation.json`.
- All preserved authority, architecture, auth, RLS, rollback, monitoring, protected-consumer, privacy, UI, UX, and accessibility evidence from the prior sections.

### 3. Findings

#### Current Dispositions

| ID | Status at `ba17e22` | Basis |
| --- | --- | --- |
| IRT-001 | `OPEN, CRITICAL` | Canonical integration and operational State C evidence remain absent. |
| IRT-002 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Closed-world Class C projection and release-linked value scanning now pass the requested local matrices. |
| IRT-003 | `RESOLVED IN LOCAL APPLICATION SCOPE` | Exact-assignment review content remains available under focused and full tests. External runtime behavior is unverified. |
| IRT-004 | `TRUTHFULLY QUALIFIED, NOT RECOMPUTABLE` | Evidence remains a dated point-in-time aggregate with no retained privacy-safe row manifest. |
| IRT-005 | `OPEN` | Canonical runtime auth, grants, repository composition, and staging RLS proof remain absent. |
| IRT-006 | `OPEN, EXTERNAL SCOPE` | No local counterexample remains in the requested matrix, but no deployed global answer or source leak proof exists. |
| IRT-007 | `OPEN` | Operational rollback, monitoring, and protected-consumer certification remain absent. |
| IRT-008 | `OPEN` | Browser, assistive-technology, human, responsive, and required UX-score proof remain absent. |
| IRT-009 | `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE` | JavaScript and fresh PostgreSQL independently reject the complete requested matrix before hashing or insertion. |
| IRT-010 | `CLOSED` | All 44 exact checkpoint checksum records match Git objects and inventory qualification is present. |

#### IRT-009 Closure

The `65bb52c` finding is preserved immediately above and remains historically valid for that checkpoint. At `ba17e22`, migration line `2928` applies lowercase folding after every URL decode pass, and line `2949` applies lowercase folding after final NFKC normalization. The scalar leak checks remain at lines `3238-3254`, before hashing at line `3268`, artifact insertion at line `3269`, and payload insertion at line `3293`.

The expanded disposable fixture links actual mixed-case values for item, revision, source, claim, reviewer, misconception, and psychometric families into the tested release. Its committed matrix asserts `28` direct, `28` Base64, `28` Base64URL, `56` separator-encoded, and `56` full printable-ASCII identifier denials. Total identifier probes: `196`. It also asserts `16` encoded-marker denials, depth 9 and 65,537-byte `54000` failures, `42501` for all leak denials, and zero matching artifact and payload rows.

Independent JavaScript replay result: `196/196` identifier combinations denied, depth and size bounds passed, the opaque public question ID remained valid, and the STAT projection retained exactly nine frozen fields.

Independent PostgreSQL replay used separate temporary helpers and probe IDs after a fresh apply, exact reapply, role attack, compensation, and reapply run. Result: `196/196` identifier denials across 7 families, 4 fields, and 7 variants; `16/16` marker denials; `2/2` limit probes returned `54000`; `0` artifact rows and `0` payload rows persisted. Any scanner fall-through would have produced an uncaught uniqueness or insertion error instead of the required `42501`, so the result establishes pre-hash and pre-insert rejection for the tested matrix.

No new actionable local high-severity defect was found in the repair delta. IRT-009 is closed only for the exact local code and tested encoding contract. It is not a global deployed no-leak certification.

#### IRT-010 Closure

The exact Git-object replay loaded each of the 44 records from `artifact_checksums.json`, then independently loaded and hashed the named object at `ba17e22`. Result: `44/44` byte and SHA-256 matches, `0` stale, and `0` missing. IRT-010 remains closed for exact-checkpoint evidence integrity only.

#### IRT-004 Qualification

Exact evidence declares `evidence_scope=POINT_IN_TIME_AGGREGATE`, `row_manifest_retained=false`, `independently_recomputable_from_git=false`, and a dated statement that no privacy-safe row manifest was retained. Exact-tree search found no row manifest.

The evidence reports 97 registry rows, 97 transcript references, 97 nodes references, 0 local VTT files, 0 working-redacted sources, 0 extraction-ready sources, 0 real candidates, and 0 physician approvals. The 97 privacy-blocked total follows from the dated 97-source inventory and its `all_sources_privacy_blocked` status. These are point-in-time reports, not independently recomputable current facts. No State B, C, or D claim is supported.

#### Evidence Classification

| Classification | Current statement |
| --- | --- |
| Verified current fact | `HEAD`, tracked origin, and the audit target resolve to exact `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`. |
| Verified current fact | JavaScript denied `196/196` requested identifier combinations and preserved the opaque ID and frozen nine-field STAT shape. |
| Verified current fact | Independent PostgreSQL denied `196/196` identifiers and `16/16` markers, returned `54000` for both limits, and persisted zero probe rows. |
| Verified current fact | Focused tests passed 88, package tests passed 227 with 0 failures and 1 gated skip, fresh PostgreSQL passed 13, validator passed 20/20 as State A, and root audit found 0 vulnerabilities. |
| Verified current fact | All 44 exact checksum records match Git objects. |
| Verified current fact | Deployment evidence has 0 URLs, a null canonical route, and all 6 feature flags false. |
| Point-in-time report | The dated corpus packet reports the 97-source aggregate, no working redactions, and no extraction-ready sources. |
| Point-in-time report | Candidate evidence reports 0 real candidates and 0 physician approvals. |
| Inference | State A remains the highest supportable state only with the dated aggregate qualification. |
| Unverified claim | The external estate still has exactly the reported corpus and candidate totals now. |
| Unverified claim | Runtime auth, RLS, rollback, monitoring, protected consumers, browser UX, accessibility, or a deployed no-leak boundary works. |

### 4. Changes Proposed Or Made

Changed only the three Independent Red Team report outputs. No product or shared change is proposed for IRT-009 at this checkpoint. The unchanged external evidence must still be supplied before any State C review.

### 5. Tests Performed

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse origin/i1q-question-platform-ultra-1007x-ma
git diff --check 65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4
node --test tests/exports-class-c.test.mjs tests/migration-1007x.test.mjs tests/security-regressions.test.mjs tests/api.test.mjs tests/platform.test.mjs tests/ui.test.mjs
npm test
npm run validate
npm audit --omit=dev --audit-level=low
I1Q_POSTGRES_TEST_URL="<disposable-local-database-url>" node --test tests/postgres-migration.test.mjs
```

Fresh PostgreSQL clusters were created with `initdb -D "$BASE/data" -U postgres -A trust --no-locale -E UTF8`, started with `pg_ctl`, and removed by shell traps. The independent SQL cross-product was executed through `psql -X -v ON_ERROR_STOP=1` as a memory-only heredoc. The checksum replay used `git show ba17e22:<path>` and Node SHA-256 for all 44 records.

Results:

- Focused suite: `88` pass, `0` fail, `0` skip.
- Full package: `228` total, `227` pass, `0` fail, `1` intentionally gated PostgreSQL skip.
- Evidence validator: `20/20` files, `0` errors, claimed `STATE_A`.
- Root audit: `0 vulnerabilities`.
- Fresh disposable PostgreSQL 16: `13` pass, `0` fail, `0` skip.
- Independent JavaScript matrix: `196/196` identifier denials; both bounds passed; opaque ID and 9 fields passed.
- Independent PostgreSQL matrix: `196/196` identifier denials, `16/16` marker denials, `2/2` fail-closed limits, `0` persisted artifacts, `0` persisted payloads.
- Exact Git-object checksums: `44/44` match, `0` stale.
- Exact-tree row-manifest search: `0` matches.
- Repair diff check: pass.

### 6. Risks

- Local closure can be overstated as deployed or global no-leak clearance.
- The encoding defense is bounded to its explicit eight-pass, 64 KiB contract; inputs beyond the bounds fail closed rather than receive release clearance.
- Aggregate corpus and candidate counts can still be misstated as recomputable or current.
- Exact evidence integrity does not supply canonical auth, RLS composition, staging, rollback, monitoring, protected-consumer, browser, accessibility, or human evidence.
- All preserved external State C risks remain.

### 7. Blockers

IRT-009 and IRT-010 are closed at exact `ba17e22`. State C remains vetoed by IRT-001, IRT-005, IRT-006 in external scope, IRT-007, and IRT-008. IRT-004 continues to block unqualified corpus and candidate count certification.

All six flags must remain off. No State B, C, or D clearance, production release, consumer release, student release, or global deployed no-leak clearance is issued.

### 8. Confidence

State C veto: `1.00`.
State A as the highest supportable dated point-in-time state: `0.95`.
IRT-009 local exact-checkpoint closure: `0.995`.
IRT-010 exact-checkpoint closure: `1.00`.
IRT-003 local application closure: `0.98`.
Independent corpus and candidate recomputability: `0.00`.
Global deployed no-leak clearance: `0.00` absent a deployed runtime.

### 9. Exact File Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/independent_red_team.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/red_team_findings.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/independent_red_team/release_veto_or_clearance.md`

### 10. Handoff To Root Supervisor

Carry `STATE C RELEASE VETO` and `STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`. At exact `ba17e22`, mark IRT-009 `CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE` and IRT-010 `CLOSED FOR EXACT-CHECKPOINT EVIDENCE INTEGRITY`. Preserve the full `65bb52c` IRT-009 finding as historical audit evidence, IRT-004's non-recomputability qualification, and IRT-003's local-only closure.

Do not claim State B, C, D, production release, consumer release, student release, or global deployed leak safety. State C still requires canonical auth, exact runtime grants and Postgres composition, preview and staging, browser and accessibility evidence, human validation, operational rollback, monitoring, and protected-consumer certification on one immutable checkpoint.
