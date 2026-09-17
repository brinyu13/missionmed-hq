# I1Q-1007X Deployment Plan

Date: 2026-07-15

Status: `FUTURE PLAN ONLY. NOT AUTHORIZED FOR EXECUTION.`

## Scope Completed

Defined the exact future GitHub-controlled promotion sequence allowed by DR-006 without inventing a host, provider state, workflow name, project reference, credential, environment value, or URL. No deployment or Git action was performed.

## Evidence Inspected

DR-006, the Question Platform passport, MR-078A, MR-078B, MR-079, the Critical Systems Contract, the 1006 staging and canary section, the 1007X deployment route map, protected comparison, collision register, current migration candidates, rollback design, application package, and evidence manifests.

## Findings

No current route meets DR-006. The repository has no auditable I1Q GitHub workflow, dedicated runtime binding, canonical host, approved identity resolver, project-pinned RANKLISTIQ promotion path, monitoring target, or rollback selector. The worktree is not a clean green release candidate.

## Required Preconditions And Evidence

1. Root freezes one clean reviewed release commit after every local test and the evidence validator pass.
2. The I1Q owner registers a dedicated build context and internal destination. The root HQ start command must not be reused accidentally.
3. The auth owner supplies a canonical identity-resolver contract and clears shared HQ expiry, configured-secret, CORS, revocation, CSRF, and outage gates.
4. The Data owner supplies the exact RANKLISTIQ project and migration route through a protected GitHub workflow. No project value belongs in this report.
5. The migration set includes a correctly named forward migration and any reviewed forward compensating migration. Every byte is tracked and reviewable.
6. Preview evidence proves migration history alignment, backup, apply, lint, diff, RLS, transaction-local identity, pool isolation, audit immutability, and repeatability.
7. Protected owners reconcile the four deployed CDN hashes to authoritative source commits and preserve rollback artifacts.
8. Staging proves authenticated workflows, negative auth, answer and source isolation, privacy, accessibility, performance, dependent products, rollback, reapply, and monitoring.
9. A fresh independent red team clears the exact commit and artifacts.
10. Root records final approval. Student, STAT, Drills, internal platform, and internal review flags remain off in this blocked cycle.

## Exact Future Canonical GitHub Sequence

The sequence below is exact. Workflow file names, GitHub environment names, service identifiers, provider project identifiers, hostnames, and URLs must be supplied and approved by their owners before step 1 can execute.

1. Open a pull request containing only the frozen I1Q release commit, canonical workflow registration, service registration, migration files, monitoring declaration, rollback declaration, tests, and evidence schema changes.
2. GitHub CI checks out the exact pull-request SHA and records it.
3. CI verifies clean dependency resolution, source and artifact checksums, secret-pattern absence, migration naming and history rules, unit tests, security regressions, privacy regressions, adapter tests, UI tests, accessibility checks, and evidence validation.
4. A protected GitHub preview job records the approved RANKLISTIQ target identity without exposing values, captures migration history and backup evidence, and applies only the reviewed forward migration.
5. The preview job runs schema, forced-RLS, role, assignment, IDOR, GUC-spoof, pooled-context, audit, immutability, answer-isolation, source-isolation, and query-plan tests.
6. The preview job executes the reviewed forward compensation, verifies every flag is false and protected records remain intact, reapplies the intended migration sequence, and reruns the preview tests.
7. After required review approval, merge the pull request without force push or history rewrite.
8. A protected GitHub staging promotion uses the same build artifact and commit SHA, applies the already-reviewed migration sequence, deploys the dedicated I1Q service, and records artifact checksums.
9. Staging runs authenticated end-to-end role journeys, failure states, browser and accessibility checks, answer and source leak attacks, audit verification, and dependent-product smokes.
10. Staging executes application rollback plus forward database compensation when required, verifies health and dependent products, reapplies the exact intended artifact and migration chain, and reruns all staging checks.
11. A fresh independent release review signs the exact staging commit, migration hashes, artifact hashes, rollback evidence, monitoring evidence, and smoke results.
12. A separately approved protected GitHub production promotion captures backups and rollback identities, applies the reviewed forward migration, and promotes the same staging-certified artifact.
13. Production checksum, health, canonical auth, roles, answer isolation, source isolation, audit, and dependent-product smokes run with all flags false.
14. Monitoring delivery is proven. Any failure invokes the rollback plan. No cache change is permitted unless the registered workflow documents and verifies it.
15. Root files the deploy manifest. State C and any flag enablement require a later explicit verdict, not this plan.

## What Was Not Run

No pull request, GitHub workflow, preview job, staging promotion, production promotion, backup, migration, deploy, smoke, rollback, reapply, monitor, cache action, or flag action was run. No deployment URL exists in inspected evidence.

## Changes Proposed Or Made

Made only this plan. Proposed future owner registration and the sequence above. No workflow or runtime file was created.

## Tests Performed

Local test execution failed at 134 of 144 passing. The focused set failed at 107 of 114 passing. Evidence validation failed with 13 errors. These failures stop the sequence before GitHub CI.

## Risks

The current repository lacks a workflow and dedicated service binding. Root Railway configuration starts HQ, and protected consumer source hashes diverge from runtime. A guessed route could redeploy a protected service or use the wrong datastore.

## Blockers

No canonical host, workflow, auth resolver, RANKLISTIQ route, monitoring destination, rollback selector, or clean green release commit is proven.

## Confidence

High, `0.98`, that the sequence conforms to the inspected authority. Confidence is `0.00` that any unspecified external binding currently exists.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/deployment_route_map.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/railway.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/package.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`

## Root Handoff

Root's exact operator action now is `HOLD`. Do not create or trigger a deployment. Obtain owner-supplied route records, freeze a green commit, and begin the future sequence only through the registered GitHub workflow.
