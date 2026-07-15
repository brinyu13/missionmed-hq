# I1Q-1007X Monitoring Plan

Date: 2026-07-15

Status: `DESIGN REQUIRED. TARGET AND ALERT ROUTE NOT PROVEN.`

## Scope Completed

Defined the minimum future monitoring evidence for preview, staging, rollback, and internal production without naming an unproven provider, host, URL, account, channel, or environment value. No monitor was configured or queried.

## Evidence Inspected

DR-006, the Question Platform passport, 1006 health and deployment evidence, current deployment map, ecosystem graph, auth map, security and privacy verdicts, protected runtime comparison, and application health behavior.

## Findings

No I1Q monitoring destination, probe identity, alert route, runbook, retention decision, staging baseline, threshold set, or alert-delivery proof is present. The local synthetic health artifact is not operational monitoring evidence.

## Required Monitoring Signals

| Domain | Required signal | Fail-closed action |
| --- | --- | --- |
| Availability | Health response, service identity, version, commit, artifact hash | Stop promotion or invoke rollback |
| Authentication | Success, unauthenticated denial, expired and revoked denial, logout denial, adapter outage | Disable I1Q and page auth owner |
| Authorization | Wrong-role, cross-assignment, IDOR, CSRF, hostile-origin denial | Disable I1Q and invoke security incident |
| Datastore | Migration version, schema identity, connection errors, RLS denials, pool-context isolation | Stop promotion; compensate only through GitHub |
| Answer isolation | Pre-answer answer-alias and answer-value probes | Immediate disable and security incident |
| Source isolation | Raw transcript, private reference, student, patient, and third-party leak probes | Immediate disable and privacy incident |
| Audit integrity | Chain continuity, rejected update/delete, release evidence identity | Stop writes and investigate |
| Feature flags | Exact state of all six flags | Any unexpected true value blocks release |
| Queues | Depth, oldest age, retry, dead-letter, duplicate, checkpoint progress | Pause extraction and investigate |
| Performance | Request latency, error count, database latency, queue throughput | Thresholds must be based on staging evidence |
| Dependencies | Canonical auth, RANKLISTIQ, Matrix, Arena, STAT, Drills, Daily, WordPress, HQ | Stop promotion on failed owner baseline |
| Drift | Deployed artifact hash, workflow SHA, migration hash, protected consumer hash | Stop promotion and preserve runtime truth |

## Required Alert Evidence

- Named monitoring owner and incident owner.
- Registered monitor destination and authenticated probe identity.
- No secrets or source content in labels, payloads, logs, or screenshots.
- Alert rules versioned with the deployment workflow.
- One synthetic alert delivered and acknowledged in staging.
- One rollback-trigger alert delivered during the staging drill.
- Runbook links recorded in the release manifest.
- Retention and access rules approved for auth, source, answer, and audit telemetry.

Rate and latency thresholds are intentionally not invented. Root must derive and approve them from representative staging observations. Binary invariants, including health failure, hash drift, answer leakage, source leakage, audit break, and any unexpected enabled flag, are immediate failures.

## All-Flags-Off Check

The required current state is:

- `internal_platform_enabled = false`
- `internal_review_enabled = false`
- `student_content_enabled = false`
- `student_release_enabled = false`
- `stat_adapter_enabled = false`
- `drills_adapter_enabled = false`

No runtime target was queried, so runtime flag state is not claimed. No flag was changed.

## What Was Not Run

No monitor creation, health polling of an I1Q staging or production service, alert delivery, log query, dashboard query, telemetry join, paging test, incident drill, or rollback observation was run.

## Changes Proposed Or Made

Made only this plan. Proposed owner registration of monitoring as part of the canonical GitHub workflow before staging.

## Tests Performed

The current local health evidence is a 1006 synthetic demo result and does not prove monitoring. Current local tests and evidence validation fail. No deployed monitoring test was performed.

## Risks

Without a destination and alert route, deployment could fail silently. Logging raw source, answer, session, or credential material would create a separate privacy or security incident.

## Blockers

No canonical host, monitoring target, probe identity, alert destination, retention decision, runbook, thresholds, or delivery proof exists.

## Confidence

High, `0.97`, that these are the minimum monitoring domains. Confidence is `0.00` that monitoring is operational.

## Exact Paths

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/health_check_results.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/evidence/deployment_manifest.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/ecosystem_dependency_graph.md`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ecosystem_mapper/auth_and_bootstrap_map.md`

## Root Handoff

Root must treat monitoring as blocked, assign an owner, register the real target through the protected workflow, prove alert delivery in staging, and attach the result before requesting release certification.
