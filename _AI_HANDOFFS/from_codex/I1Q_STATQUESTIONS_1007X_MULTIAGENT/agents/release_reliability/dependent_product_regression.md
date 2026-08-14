# I1Q-1007X Dependent Product Regression

Date: 2026-07-15

Verdict: `BASELINE INCOMPLETE. NO DEPENDENT PRODUCT CERTIFIED.`

## Scope Completed

Assembled the protected dependent-product baseline, preserved the four runtime hash divergences, identified owner actions, and separated unchanged-by-I1Q from tested-green. No protected product was modified or exercised by this agent.

## Evidence Inspected

Protected consumer matrix, ecosystem graph, auth map, deployment map, collision register, protected system comparison, STAT and Drills adapter reports, DR-006, Critical Systems Contract, Matrix Runtime Lock, and current I1Q tests.

## Findings

No dependent product has a complete before, after, rollback, and reapply certification for I1Q. Existing routes were not modified by this agent, but unchanged is not equivalent to tested green. The four protected source-to-CDN hash divergences prevent tracked runtime files from serving as authoritative baselines.

## Protected Baseline

| Product | Current evidence | Regression verdict | Required owner action |
| --- | --- | --- | --- |
| Matrix | No Matrix path touched; no current workflow smoke | UNCHANGED, NOT TESTED | Matrix owner runs guard preflight and required App Mode journeys on the certified commit |
| Arena | Runtime markers reachable; tracked and deployed hashes differ | ACTIVE, SOURCE AUTHORITY UNRESOLVED | Arena owner identifies deployed source commit, registers hash, preserves rollback bytes, and runs authenticated browser smoke |
| STAT | Runtime markers reachable; tracked and deployed hashes differ; I1Q flag off | ACTIVE, NOT I1Q-CERTIFIED | STAT owner resolves source hash and canon collisions, then runs sealed-pack, answer secrecy, choice order, old-attempt, and Arena-entry tests |
| Drills | Runtime markers reachable; tracked and deployed hashes differ; I1Q flag off | ACTIVE, NOT I1Q-CERTIFIED | Drills owner resolves source and ingestion authority, then runs registry, launch, return, source-availability, and no-mutation tests |
| Daily Rounds | Runtime markers reachable; tracked and deployed hashes differ | ACTIVE, NOT I1Q-CERTIFIED | Daily owner certifies the five-field contract, Drills launch and return, and current source hash |
| WordPress auth | Wrapper and unauthenticated endpoint reachable; authenticated flow not run | ACTIVE, AUTH BASELINE INCOMPLETE | WordPress and HQ owners run login, handoff, replay, expiry, logout, proxy, and failure tests |
| MissionMed HQ | Source risks and manifest drift remain; no I1Q integration | PROTECTED, NOT CERTIFIED | HQ/Auth owner resolves expiry, configured-secret, CORS, manifest, and rollback gates through the Critical Systems process |
| RANKLISTIQ | Authorized target; no I1Q migration or RLS execution | NOT TESTED | Data owner supplies project-pinned workflow and executes preview RLS, migration, rollback, reapply, Arena, and STAT tests |

## Four Protected Hash Divergences

| Surface | Tracked SHA-256 | Deployed SHA-256 |
| --- | --- | --- |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` |

Runtime truth wins. The tracked files are not a valid rollback baseline until each owner reconciles the deployed artifact to authoritative source.

## Required Before-And-After Evidence

Each owner must record a pre-deploy baseline on the exact protected runtime, rerun it after staging deployment, after staging rollback, after reapply, after production promotion, and after any production rollback. Results must name the I1Q commit, artifact hashes, migration hashes, consumer source hash, and test outcomes.

## Changes Proposed Or Made

Made only this regression report. Proposed owner actions above. No dependent source, route, cache, datastore, workflow, or flag was changed.

## What Was Not Run

No authenticated dependent-product journey, browser workflow, Matrix guard, RLS test, sealed-pack regression, old-attempt join, Drills launch, Daily return, WordPress login, HQ auth flow, protected rollback, or post-rollback check was run by this agent.

## Tests Performed

No dependent-product test was performed by this agent. The Root protected comparison previously performed static validation and read-only route and marker checks, but authenticated workflows, browser journeys, answer isolation, source parity, rollback, and post-rollback tests were not run.

## Risks

Calling unchanged products green would conceal missing regression evidence. Deploying tracked protected bytes could overwrite newer runtime-only behavior. Shared auth or datastore changes could affect all consumers.

## Blockers

Four source hash divergences, missing named owners for some boundaries, auth defects, no fixed I1Q commit, no staging route, no rollback execution, and no post-change baseline.

## Confidence

High, `0.99`, in the reported hash divergence and incomplete certification. No claim is made about current runtime behavior beyond the recorded Root comparison.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_PROTECTED_SYSTEM_COMPARISON.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/protected_consumers_matrix.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/collision_risk_register.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`

## Root Handoff

Root must keep every consumer flag off, obtain owner-certified source hashes and baselines, and require the complete before, after, rollback, and reapply matrix before any dependent-product green claim.
