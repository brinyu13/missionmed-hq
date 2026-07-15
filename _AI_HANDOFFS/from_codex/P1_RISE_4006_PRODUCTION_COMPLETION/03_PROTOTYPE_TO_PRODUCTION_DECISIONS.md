# P1 RISE 4006 - Prototype-to-Production Decisions

**Decision scope:** Convert the 4004 product concept into a truthful, maintainable production system without altering protected MissionMed products prematurely.

## Decision Summary

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D-001 | Preserve 4004 as an immutable provenance input | Final | It is the latest implementation artifact and has a known SHA-256. It must not be edited in place. |
| D-002 | Do not deploy the 4004 single-file monolith | Final | Inline handlers, broad `innerHTML`, global state, embedded data, and demo overlays fail maintainability, CSP, provenance, auth, and persistence requirements. |
| D-003 | Preserve the CAM-derived visual language and desktop information architecture | Final | 4005 scored desktop UI 9.1 and desktop UX 9.0. Product structure is not the release problem. |
| D-004 | Rebuild production as a modular shell, typed API, versioned registry release, and durable evidence model | Final | Separates presentation, data, policy, integrations, and auditability. |
| D-005 | Target the human-facing route `https://missionmedinstitute.com/rise/` | Proposed pending registration | This is the natural MissionMed member route. It does not currently exist and cannot be created until runtime ownership and rollback are registered. |
| D-006 | Prefer a scoped RISE deployment unit over adding more behavior directly to the drifted shared HQ runtime | Blueprint implemented; activation pending authority | `rise/package.json`, its lockfile, Dockerfile, Railway config, and a machine-readable deployment contract isolate the RISE entrypoint and required production pins. No service was provisioned. |
| D-007 | Serve only a versioned static frontend shell from Cloudflare/R2 | Proposed pending authority | Matches existing MissionMed static-product delivery while keeping data, auth, and private integrations server-side. |
| D-008 | Use a dedicated RISE Supabase project or explicitly approved isolated RISE database owner | External decision required | No current project owns RISE. Reusing RankListIQ or Growth Engine without authority would expand blast radius and violate migration governance. |
| D-009 | Use immutable ACGME/FREIDA-derived program and program-specialty keys | Final | Ordinal `RISE_ID` values are not stable across refreshes. |
| D-010 | Treat 6,346 as raw source observations; after authorization, validate 6,345 active memberships, 6,139 normalized unique programs, 206 combined memberships, and 1 quarantined duplicate before activation | Final, reconciled by structural inspection and synthetic importer contracts | Combined programs are intentionally repeated; one whitespace-corrupted stale observation is not a separate program. Denominators must be explicit everywhere. |
| D-011 | Add field-level evidence and release manifests | Final | Row-level blanket verification cannot support production trust claims. |
| D-012 | Quarantine all synthetic named people and demo intelligence at build time | Final | Named representative alumni and unversioned MissionMed claims cannot appear production-real. |
| D-013 | Reserve a positive hard-requirements category for zero conflicts and zero unknown hard criteria | Final | The prototype currently misclassifies 328 programs with unknown hard criteria as meeting requirements. |
| D-014 | Keep preferences and historical composition out of eligibility logic | Final | Geography, fellowship interest, ACTN relationship, and IMG composition are contextual signals, not proof of eligibility. |
| D-015 | Consume Matrix through a least-privilege projection; do not edit the Matrix runtime | Final boundary / external contract required | Matrix is the canonical profile owner and is under an active runtime lock. |
| D-016 | Consume ACTN read-only; never copy relationship records into RISE | Final boundary / external contract required | ACTN remains canonical and is not production live. |
| D-017 | Re-enter CAM only through a separately reviewed versioned handoff | Final boundary / external contract required | CAM deliberately removed synthetic RISE sync from production scope. |
| D-018 | Exclude Local Community Signals until a versioned public-data pipeline exists | Final | The prototype has no ACS table, vintage, geography, denominator, or true margin-of-error lineage. |
| D-019 | Exclude fellowship ranks and pilot claims until sourced | Final | Prototype fellowship content is demo-only. |
| D-020 | Replace simulated queue actions with durable audited actions or visibly disabled controls | Final | A production control must be real, permissioned, persistent, and retry-safe. |
| D-021 | Apply all 4005 mobile and accessibility corrections before feature expansion | Final | Mobile UI/UX and accessibility independently block freeze. |
| D-022 | Do not deploy while the critical gate, source lineage, migration history, or rollback gates fail | Final | The production charter and Critical Systems Contract prohibit force-deploying through failed gates. |

## Production Experience to Preserve

The following concepts survive into production, subject to real data and contracts:

- Command Home with registry health and work priorities.
- Explorer with national-scale search, typed filters, stable sorting, and pagination/virtualization.
- Program Profile with identity, requirements, source evidence, and missing-data states.
- Matrix criteria panel with explicit consent and removable criteria.
- Explainable match categories and criterion-level reasons.
- Approximate distance sorting with source/method disclosure.
- Compare for two to four program-specialty records.
- Fellowship, ACTN, community, Interview Pack, CAM, and operator surfaces only when their canonical owners provide approved contracts.
- CAM visual language: restrained dark operations UI, cyan system signals, gold action/intelligence accents, dense evidence-aware information hierarchy.

## Prototype Behavior Removed from Production

| Prototype behavior | Decision |
|---|---|
| Ten named representative alumni | Remove from production builds and test fixture scans |
| Synthetic A. Adeyemi Matrix profile | Test/demo fixture only, never production default |
| MissionMed fit scores and readiness rings | Remove until a versioned scoring policy, author, inputs, explanation, and validation exist |
| "Pilot verified" labels | Remove unless backed by a real verification workflow and evidence receipt |
| Fellowship ranks and "pathway" demos | Remove from production |
| Local Community Signal demos | Remove from production |
| Queue simulation and transient "Ask Brian" state | Replace with disabled state until durable APIs exist |
| In-memory CAM launch | Remove; no handoff until CAM contract passes |
| "6,346 programs" | Replace with `6,346 raw observations`, `6,345 active specialty memberships`, and `6,139 unique programs`; expose the 1 quarantined duplicate in operator status |
| "52 states" | Replace with `52 jurisdictions` or explicitly list included territories |
| "verified 2026-07-09" | Replace with snapshot retrieval language unless field verification exists |
| "96% of current residents are IMGs" | Replace with the exact source field, reporting period, denominator, and retrieval date; otherwise mark reporting period unavailable |
| "Meets Published Requirements" with unknown hard criteria | Prohibited |
| Unescaped dynamic `innerHTML` and inline event handlers | Replace with escaped rendering and CSP-compatible event binding |

## Matching Language Decision

Production categories must avoid eligibility guarantees.

| Category | Definition | Allowed wording |
|---|---|---|
| `PUBLISHED_CRITERIA_ALIGNED` | All evaluated hard criteria are met; none conflict; none are unknown | "Aligned with all evaluated published criteria" |
| `PUBLISHED_CRITERIA_INCOMPLETE` | At least one required hard criterion cannot be evaluated | "Published criteria incomplete" |
| `PUBLISHED_CONFLICT` | At least one sourced hard criterion conflicts | "Published conflict found" |
| `CONTEXTUAL_MATCH` | Context/preferences align but hard criteria are incomplete | "Contextual match; eligibility not established" |
| `INSUFFICIENT_EVIDENCE` | Too little current evidence to classify | "Insufficient published evidence" |

The word `eligible` is not produced by the matching engine. RISE presents evidence and interpretation, not application guarantees.

## Proposed Production Lane

The safest topology, subject to explicit registration, is:

```text
missionmedinstitute.com/rise/
  -> WordPress member wrapper and signed audience=rise handoff
  -> versioned Cloudflare/R2 shell
  -> scoped RISE API service in the existing Railway project
  -> isolated RISE Postgres/Supabase owner

RISE API
  -> immutable registry release and field evidence
  -> server-side Matrix profile projection
  -> versioned matching policy
  -> ACTN read adapter when ACTN is production ready
  -> CAM handoff adapter when CAM re-entry contract is approved
```

This lane uses established MissionMed infrastructure while avoiding direct feature growth inside the already drifted `missionmed-hq` process. It still requires protected WordPress/auth registration, a database owner, and production service approval.

## Why Other Lanes Were Rejected

| Lane | Decision | Reason |
|---|---|---|
| Ship the 4004 HTML directly to CDN | Rejected | Public demo data, no auth, no API, no durable state, no CSP safety, no rollback contract |
| Add RISE directly to Matrix App Mode | Rejected | Matrix runtime is locked and RISE ownership is separate; would increase blast radius |
| Add all RISE APIs into the current shared HQ server immediately | Rejected for this release phase | Source lineage is divergent, the live Dockerfile is absent, protected files are dirty, and rollback is not reproducible |
| Store production data only in Google Sheets | Rejected | No RLS, typed joins, transactionality, durable evidence model, versioned policy, or production API semantics |
| Reuse CAM's synthetic RISE adapter | Rejected | CAM production explicitly removed it and marks sync false |
| Duplicate ACTN relationships into RISE | Rejected | Violates ACTN canonical ownership and privacy boundaries |

## External Decisions Required Before Protected Implementation

1. Approve the scoped production lane: WordPress wrapper + CDN shell + dedicated Railway RISE service.
2. Approve and provision the exact RISE database owner, preferably an isolated Supabase project.
3. Register RISE in MissionMed OS and the Critical Systems Manifest with runtime owner, source of truth, routes/assets, dependencies, browser journey, and rollback.
4. Approve a least-privilege Matrix profile projection without modifying locked Matrix browser assets.
5. Approve CAM's versioned RISE re-entry contract after CAM ownership review.
6. Confirm whether ACTN production readiness is a release dependency or whether the entire RISE release must wait for ACTN.
7. Reconcile the Git/runtime lineage that produced the current Railway Docker deployment and establish a redeployable rollback artifact.

These are architecture, privacy, and production-ownership decisions. They cannot be silently selected by modifying protected systems.

## Decision Verdict

`CORE_PRODUCT_DIRECTION_FROZEN_PRODUCTION_LANE_PENDING_AUTHORITY`
