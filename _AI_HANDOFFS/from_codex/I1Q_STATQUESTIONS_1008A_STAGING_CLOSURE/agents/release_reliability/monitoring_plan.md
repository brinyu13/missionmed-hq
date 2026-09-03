# I1Q-1008A Monitoring Plan

Owner: Release and Reliability

Product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

Status: `DESIGN ONLY - EXTERNAL MONITORING NOT_RUN`

Staging telemetry collection, dashboard validation, alert delivery, synthetic monitoring, provider binding, and incident rehearsal are all `NOT_RUN`.

The hardened preview workflow now has a passing local evidence-control baseline: source validation is secret-free, preview secrets are step-scoped, exact candidate and approval artifacts are hash-bound, complete prehistory is digest-bound, and evidence upload runs only after explicit redaction succeeds. This protects future run artifacts but does not constitute telemetry, alert delivery, backup monitoring, restore observation, or hosted operational evidence.

For the exact product candidate above, the corrected local estate reports 285 of 287 full-suite tests passed with 0 failures and 2 intentional database-target skips, UI tests passed 19 of 19, focused migration/workflow tests passed 9 of 9, and evidence validation passed 20 of 20 with claimed state `BLOCKED`. The local UX matrix completed 187 workflow, 176 state, 68 mobile, and 66 width-equivalent reflow cells with zero root overflow; its simulated score is 8.21 against a 6.8 floor and its release decision remains `BLOCK`. These are local product signals, not deployed monitoring evidence.

## Monitoring Principles

1. Monitor the dedicated I1Q service and target only. Do not infer I1Q health from MissionMed HQ or another protected service.
2. Separate liveness from readiness. An unconfigured auth or datastore adapter is alive but not ready.
3. Use aggregate, privacy-safe events and bounded labels.
4. Never log or export tokens, cookies, credentials, connection values, request bodies, email addresses, answers, explanations, raw transcripts, source locations, student data, patient data, or protected review content.
5. Hash or replace actor, session, assignment, revision, and request identifiers with short-lived correlation IDs when correlation is necessary.
6. Every deploy, migration, compensation, reapplication, configuration change, and feature-control change emits a safe immutable marker.
7. Monitoring failure is a release failure, not an invitation to deploy blind.

## Required Signals

### Service And Deployment

- process liveness;
- dependency-aware readiness;
- exact safe build and deployment provenance;
- restart, crash-loop, and rollback markers;
- request volume, status class, route class, latency, and timeout counts;
- frontend exception count and affected synthetic journey;
- memory, CPU, open handles, and event-loop delay;
- deployment age and last successful synthetic journey.

### Authentication And Request Integrity

- successful synthetic sign-in and session validation;
- failure counts by bounded reason class: missing, expired, revoked, malformed, wrong audience, wrong project, provider unavailable, and wrong role;
- refresh, logout, and old-session rejection;
- trusted-origin acceptance and hostile-origin denial;
- CSRF rejection;
- identity-provider latency and outage;
- role-profile resolver latency, outage, and mismatch;
- any canonical actor mismatch.

### Datastore And Authorization

- connection acquisition, transaction, commit, rollback, and pool timeout counts;
- active and waiting connections relative to the approved pool limit;
- query latency and error class by allowlisted operation name;
- actor binder failure and post-transaction context-clear failure;
- RLS and permission denials by bounded policy class;
- direct-grant, role-membership, ownership, or effective-privilege drift;
- schema and migration-history drift;
- feature-control checksum drift;
- backup success and restore-test currency.

### Safety And Integrity

- answer-bearing access attempts before an allowed purpose;
- restricted-source access attempts outside an allowed purpose;
- wrong-actor and cross-assignment denials;
- audit append failures, sequence gaps, and chain verification failures;
- immutable-record mutation attempts;
- stale-write rejections and duplicate-idempotency outcomes;
- release-gate denials and any attempted student or consumer activation;
- evidence redaction and artifact-inventory failures.

## Proposed Staging Service Levels

These thresholds become binding only after provider and owner ratification. They are deliberately conservative for synthetic-only staging.

| Signal | Target | Alert |
| --- | --- | --- |
| Liveness | Successful probe every minute | Page after 3 consecutive failures |
| Readiness | Successful probe every minute while released | Page after 2 consecutive failures |
| Authenticated synthetic journey | Complete at least every 5 minutes | Page after 2 consecutive failures |
| Request success | At least 99.5% for expected non-attack traffic over 30 minutes | Urgent at below target; page for repeated 5xx |
| Server errors | No sustained 5xx sequence | Page on 5 consecutive 5xx or more than 2% over 5 minutes |
| API latency | p95 at or below 1 second and p99 at or below 2 seconds after warm-up | Urgent for 15 minutes above target |
| Identity provider latency | p95 at or below 1 second | Urgent for 10 minutes above target |
| Pool utilization | Below 80% of approved maximum | Urgent for 10 minutes above target; page at exhaustion |
| Frontend exceptions | Below 1% of synthetic workflow runs | Urgent for 15 minutes above target |
| Migration or schema drift | Zero | Immediate page on any detection |
| Role or grant drift | Zero | Immediate page on any detection |
| Protected feature-control drift | Zero | Immediate page on any detection |
| Actor-context leakage | Zero | Immediate page and rollback |
| Answer or restricted-source anomaly | Zero | Immediate page, containment, and rollback |
| Audit append or chain failure | Zero | Immediate page and traffic containment |
| Evidence redaction failure | Zero uploaded artifacts | Immediate stop; no upload |
| Backup and restore currency | Within the owner-approved window | Urgent when stale or failed |

Attack-test traffic must be tagged by safe test-run identifier so expected denials do not pollute operational error budgets. An unexpected success in an attack test is always an immediate page.

## Dashboards

### Release Health

- build and deployment provenance;
- liveness, readiness, uptime, restart count, and last synthetic journey;
- request rate, 4xx, 5xx, latency, and frontend exceptions;
- current release window and rollback readiness.

### Identity And Security

- auth success and bounded failure classes;
- logout and old-session rejection;
- origin and CSRF denials;
- wrong-actor, cross-assignment, answer, and source denials;
- security alert status and acknowledgment.

### Datastore And Integrity

- migration version and drift checksum;
- schema, role, grant, RLS, and feature-control checksums;
- pool, transaction, query, and rollback health;
- audit append and chain status;
- backup and restore-test currency.

No dashboard contains a raw payload or stable personal identifier.

## Alert Routing And Ownership

| Severity | Examples | Route and response |
| --- | --- | --- |
| Critical | Auth bypass, actor leakage, answer/source exposure, audit failure, migration/role drift, protected control enabled, secret exposure, rollback failure | Page incident owner, security, database owner, rollback operator, and release manager immediately; contain traffic |
| High | Repeated 5xx, readiness failure, provider outage, pool exhaustion, failed authenticated journey | Page deployment owner and Release and Reliability; acknowledge within 10 minutes |
| Medium | Sustained latency, elevated expected denials, frontend exception spike, stale backup evidence | Open urgent ticket and acknowledge within 30 minutes |
| Informational | Deploy marker, successful backup, daily role inventory, successful smoke | Daily release review |

Alert destinations and contact values belong only in the provider's protected configuration. This document records roles, not destinations.

## Burn-In And Release Observation

- Start the observation window only after the exact final artifact and configuration are deployed.
- Reset the 24-hour staging burn-in after any deployment, migration, compensation, reapplication, or configuration change.
- Run the authenticated synthetic journey every five minutes.
- Run role/grant, migration, schema, RLS, and feature-control drift checks at least every fifteen minutes.
- Review dashboards at deployment, 15 minutes, 1 hour, 4 hours, and burn-in completion.
- Require no Critical alert, no unresolved High alert, and no unexplained monitor gap.
- Archive a redacted, checksummed summary bound to the exact release evidence window.

## Required Runbooks

Before monitoring certification, execute and time each runbook with synthetic fixtures:

1. authentication outage and revocation;
2. identity-provider or role-profile mismatch;
3. datastore outage and pool exhaustion;
4. broken or partial migration;
5. role, grant, RLS, or feature-control drift;
6. forward compensation and reapplication;
7. failed application deployment and artifact rollback;
8. leaked credential or secret-bearing log;
9. suspicious answer or restricted-source access;
10. audit append or chain anomaly;
11. unavailable staging host;
12. monitoring or alert-delivery outage.

Each exercise records safe timestamps, roles, detection time, acknowledgment time, containment time, recovery time, evidence digest, and follow-up owner. No prohibited payload enters the record.

## Monitoring Certification Gate

Pass only when:

- every required signal is emitted from the exact staging artifact;
- all dashboards and alert routes are operational;
- redaction tests prove prohibited values cannot enter logs or artifacts;
- every Critical and High alert is triggered and acknowledged in a synthetic exercise;
- rollback and reapplication markers correlate with canonical workflow runs;
- the 24-hour burn-in completes without a Critical or unresolved High alert;
- Security and Release and Reliability independently sign the evidence.

## Current Verdict

`MONITORING: NOT OPERATIONAL / BLOCKING STAGING CERTIFICATION`
