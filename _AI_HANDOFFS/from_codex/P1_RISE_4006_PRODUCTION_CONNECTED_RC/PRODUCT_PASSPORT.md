# P1-RISE-4006 Product Passport

## Status

**PROPOSED - NOT RATIFIED IN MISSIONMED OS**

This passport is a review candidate. It does not create runtime authority.

| Field | Proposed value |
| --- | --- |
| Product | MissionMed RISE |
| Full name | Residency Intelligence and Strategy Engine |
| Ticket | P1-RISE-4006 |
| Intended route | `https://missionmedinstitute.com/rise/` |
| Current route | 404, unprovisioned |
| Runtime | Isolated Node.js service under `rise/` |
| Review build | `rise_web_8d2c636a88b7` |
| Review commit | `7c415489bdfacf596778d54eb07b050f5c8e94b9` |
| Data classification | Synthetic test fixture only |
| Activation status | Offline shadow only |
| Production owner | UNKNOWN - Founder decision required |
| Data controller | UNKNOWN - Founder decision required |
| Runtime owner | UNKNOWN - Founder decision required |
| Database owner | UNKNOWN - Founder decision required |
| Privacy owner | UNKNOWN - Founder decision required |

## Purpose

RISE is intended to provide evidence-aware residency program exploration, comparison, profile-assisted review, source transparency, and tightly scoped handoffs into MissionMed-owned systems. It must never represent missing evidence or statistical context as eligibility, qualification, interview likelihood, ranking, or Match prediction.

## Current Capabilities

- Search, filter, paginate, and inspect immutable program-specialty records.
- Preserve exact and combined specialty identity.
- Display field-level known and unknown states with source metadata.
- Compare up to four programs with compact provenance labels.
- Preserve browser history, deep links, focus, loading, empty, error, and stale-selection recovery.
- Expose truthful disabled states for unavailable integrations and operator actions.
- Enforce production auth, CSRF, release, artifact, source-rights, rate-abuse, and audit prerequisites before startup or data access.

## Unavailable Production Capabilities

- Authorized real registry publication or refresh.
- Student Matrix profile loading and criterion disable or restore.
- Production matching explanations and distance sorting from authorized profile geography.
- ACTN relationship reads.
- CAM handoff redemption.
- StoryForge recommendation reads.
- Operator queue persistence.
- Mentor/admin production journeys.
- Production analytics, alerting, staging acceptance, and live acceptance.

These controls are unavailable, not cosmetically hidden. Their contracts are owner-gated and fail closed.

## System Boundaries

| Dependency | Canonical owner | RISE posture |
| --- | --- | --- |
| HQ identity | MissionMed HQ | Cookie-only introspection adapter; learner audience activation pending |
| Registry source | Source owners plus RISE governance | Written authorization and validation receipts required |
| Matrix profile | Matrix | Consent-bound projection contract; inactive |
| ACTN | ACTN | Reference-only read contract; inactive |
| CAM | CAM | Short-lived resolver-backed handoff contract; inactive |
| StoryForge | StoryForge | Reference-only context contract; inactive |
| WordPress and edge | Website and Cloudflare owners | Same-origin route contract; unprovisioned |
| Database | Dedicated RISE owner | Proposed migrations only; no production database touched |

## Proposed Reliability Budget

- Public health endpoint available without registry disclosure.
- Signed-out shell loads without protected data.
- Production data APIs fail closed when auth, artifact, activation, source-rights, or abuse dependencies fail.
- Raw first-party shell plus selected Lucide bundle at or below 150 KB.
- Synthetic 6,500-program search p95 below 500 ms on the local in-process reference harness.
- No applicant profile values, upstream tokens, email addresses, raw subject IDs, or private relationship content in logs.

These are candidate budgets. Production SLOs require an approved deployment and telemetry baseline.

## Release Class

Risk class: **HIGH** because the eventual product handles applicant profile data, residency evidence, cross-product references, authentication, and potentially consequential guidance.

Release gate: **NO-GO** until the ownership, data-rights, runtime, database, staging, security, and Founder approvals in `OPEN_LIMITATIONS.md` are closed.
