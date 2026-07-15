# 17 Operations, Observability, and Outcome Measurement

RESULT: `OPERATING_MODEL_AND_NON_MISLEADING_METRICS_DEFINED`

## Operational ownership

Each queue stage has one role owner, an age/SLO, escalation path, runbook, and kill switch. Pipeline Operations remains outside the mentor’s normal Meeting view. The cockpit shows aggregates and opaque IDs; raw transcripts, private notes, identity values, paths, and credentials are excluded.

Required queues: source discovery/quarantine, incomplete pair, consent, identity conflict, import, analysis, evidence failure, mentor review, publication review/dispute, failed/dead-letter, correction/revocation, and retention action.

## Job policy

- Lease/heartbeat with safe expiry and single-owner processing.
- Exponential backoff with jitter, provider `Retry-After`, attempt budgets by failure class, and dead-letter review.
- Idempotency and unique projection identities make replay safe.
- Non-retryable privacy/identity/policy failures never auto-retry.
- Reconciliation compares source, job, proposal, canonical, publication, and audit counts without reading sensitive bodies.
- Queue aging alerts the owning role; a student/mentor is not blamed for system delay.

## Initial service objectives

These are staging targets requiring baselines, not current claims:

| SLO/guardrail | Target |
| --- | --- |
| Core mentor reads | 99.9% monthly availability; Today p95 <2s |
| Durable command acceptance | 99.99%; acknowledgement p95 <1s; durable result p95 <5s |
| Acknowledged command loss | Objective 0; RPO 0 is earned only after durable-acknowledgement plus backup/WAL restore proof |
| Projection freshness after command | 99% <60s |
| Audit completeness | 100% mutations, approval, publication, identity override, export, sensitive read |
| Evidence quote eligibility | 100% exact stable-span match before review |
| Retry duplication | 0 canonical duplicates |
| Ready pair to analysis terminal state | p95 <30m when enabled, human review excluded |
| Routine human review | 95% triaged within one business day |
| Critical privacy/identity conflict | owner alerted/triaged within one hour |
| Correction/withdrawal | every active-content read beginning after commit denied; only a separately authorized content-free exact-student tombstone may remain; connected invalidation p95 <60s; no claim of erasing offline/exported copies |
| Cross-student isolation | 100% denial in server/RLS/browser suite |
| Recovery | Initial RTO objective 60m; exact RPO declared only after measured restore exercise |

## Cockpit

- Queue counts, oldest age, owner, SLO burn, throughput, latency, retry/dead-letter by safe error class.
- Dependency health and freshness for database, provider, adapters, object store, worker—not merely configured/not configured.
- Prompt/model/version distribution, token/cost budget, evidence-match rate, mentor edit/reject rate, stale/superseded outputs.
- Advising-policy version/expiry, prohibited-input rejection, alternatives/uncertainty completeness, and differential safety evaluation under approved governance.
- Identity evidence age, conflicts, overrides, correction rate, assignment expiry.
- Publication drafts, aged approvals, disputes, corrections, withdrawals, propagation SLO.
- Audit completeness, denied access, sensitive-read volume, export, environment/mode mismatch.
- Mentor workload, review workload, alert usefulness, student response and countermetrics.

## Degradation and incident behavior

| Condition | Operating response |
| --- | --- |
| AI unavailable | Manual mentor loop remains; queue analysis; no stale proposal promoted. |
| Webex unavailable | Stop discovery/download; existing approved objects remain readable; show age. |
| Database read degraded | Cached read only if policy permits, prominently stale; commands disabled/queued truthfully. |
| Database write failure | No saved claim; retain scoped draft; idempotent retry. |
| Source disappears | Preserve tombstone/provenance; mark affected claims stale; no silent delete. |
| Prompt/model regression | Disable new runs, rollback active version, revoke run proposals, reassess descendants. |
| Assignment expires | Revoke the former mentor's reads/writes/retries/new-publication and clear that mentor's cache; route ownership. Existing exact-student publication entitlement follows its separate lifecycle. |
| Mentor absence | Reassign queue/work under explicit authority; never infer delegation. |
| Student inactivity | Surface unacknowledged plan as neutral follow-up; no shame/risk inference. |
| Privacy/identity incident | Kill relevant plane, withdraw projection, preserve evidence, incident workflow and human notification policy. |

Error-budget policy is owned before launch: SLO breach freezes feature expansion, invokes the linked runbook, identifies affected data/users, and requires recovery/review evidence before re-enable. Baseline measurement in staging may revise latency/queue targets through a decision record; safety guardrails cannot be relaxed to meet availability.

## Outcome model

### Mentor effectiveness

- Standardized one-minute brief success: correct who/why/next within 60 seconds.
- Active prep time and post-session closure time, excluding idle.
- Mentor promises completed on time and mentor service debt.
- Follow-up latency and open-loop aging with blocker exclusions.
- Alert usefulness: acted, validly deferred, false positive.
- AI proposal accept/edit/reject and review time; high acceptance is not inherently good.

### Student benefit

- Published actions acknowledged or clarified.
- Completion of eligible acknowledged tasks; blocked/cancelled/disputed/external dependency excluded.
- Student blocker-to-mentor response time.
- Evidence-backed milestone transitions.
- Correction/dispute resolution time.
- Student-reported clarity, usefulness, psychological safety, and workload.
- Balance of mentor-owned and student-owned commitment closure.

### Intelligence and operational quality

- Exact span match, sampled factual precision, unsupported-claim rejection, edit distance, calibration by claim class.
- Identity false-positive/false-negative sampled review and correction.
- Pipeline terminal success, idempotency, queue age, retry/dead-letter, partial-state recovery.
- Publication/private-isolation and audit completeness.

### Countermetrics

Documentation time added, review burden, alert fatigue, disputes/distress, disparate error/escalation rates, sensitive-context usage, work shifted wrongly to students, and metric gaming through extra sessions/notes/task churn.

## Metric contract

Every metric publishes name, purpose, owner, event source, numerator, denominator, exclusions, time window/timezone, freshness, data coverage, privacy class, and confidence. Blocked/cancelled/disputed work is not failure. Mentor service delay is not student risk. Environment/fixture data never enters live outcome dashboards.

Match outcomes, application completeness, interview milestones, and submission timing may be described longitudinally. MMC must not claim a guaranteed match, individual match probability, ranking, or causal improvement without a separately approved study. Aggregate subgroup analysis requires privacy/fairness governance and cannot create a student leaderboard.

## Review cadence

Daily: queue/SLO/privacy exceptions. Weekly: false alerts, dead letters, evidence failures, identity conflicts, mentor load. Monthly: prompt/model quality, corrections, outcome/countermetrics, retention, access/audit sampling. Before every model/prompt/source release: fixed evaluation suite, adversarial fixtures, rollback exercise, and decision record. Before production: incident simulation and on-call/ownership proof.
