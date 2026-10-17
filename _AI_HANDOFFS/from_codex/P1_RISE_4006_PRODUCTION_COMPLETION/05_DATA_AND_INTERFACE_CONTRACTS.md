# P1 RISE 4006 Data And Interface Contracts

## Contract Status

The following contracts are implemented in the isolated `rise/` foundation or frozen as proposed production boundaries. They do not yet exist as live MissionMed routes.

## Canonical Identity

| Entity | Identity | Notes |
|---|---|---|
| Program | `rise_prg_<opaque uuid>` | Bootstrapped from normalized FREIDA/ACGME ID; persisted mapping owns future continuity |
| Program specialty | `rise_ps_<opaque uuid>` | Program plus exact designation; combined pathways remain exact designations |
| Specialty | `rise_sp_<opaque uuid>` | Stable label identity |
| Browse membership | `rise_bm_<opaque uuid>` | Program-specialty projection into a browse tab |
| Evidence claim | `rise_claim_<opaque uuid>` | Subject, field, value state, source, locator, period, and parser version |
| Source document | `rise_src_<opaque uuid>` | Immutable source snapshot per program |
| Registry snapshot | `rise_snapshot_<opaque uuid>` | Source artifact content hash |

`RISE-IM-0001`-style ordinal values are retained only in the legacy alias file. NRMP codes belong to cycle-specific match tracks, not program identity.

## Corrected Count Semantics

| Metric | Value | Meaning |
|---|---:|---|
| Raw source observations | 6,346 | All specialty-tab rows in the July 9 workbook |
| Active browse memberships | 6,345 | Raw rows minus one reviewed stale malformed duplicate |
| Unique programs | 6,139 | Normalized program identities |
| Program-specialty designations | 6,139 | One exact designation per current source program ID |
| Additional combined memberships | 206 | Active memberships beyond unique programs |
| Exact specialty designations | 57 | Distinct exact source labels |
| Internal Medicine browse memberships | 828 | Exact plus related combined pathways |
| Exact Internal Medicine programs | 695 | Categorical IM designations only |

## Evidence Claim

Every populated imported value is represented with:

- subject ID
- exact field name
- `known` or `unknown` knowledge state; conflicts and quarantine are separate publication/evidence states
- raw source value
- authority and assertion class
- source document ID and source URL
- stable staging locator
- reporting period, artifact retrieval date, source-update date, survey-received date, and MissionMed verification metadata as separate concepts
- parser version and content SHA-256
- publication and matchability policy

A missing claim means `unknown/not_collected`. An absent visa token does not become `false`. `IMG Friendly Indicators`, `Program Status`, inferred type flags, and MissionMed intelligence fields are quarantined from production truth semantics.

## Source Rights

- FREIDA claims are labeled `program_reported` and date-scoped.
- Residency Explorer is not a required source in the pinned dataset configuration, and no real registry release was generated.
- Current AAMC terms prohibit using Residency Explorer material to create or supplement a database/product absent written authorization.
- The importer fails closed if Residency Explorer material appears without a current reviewed authorization record.

## Proposed API

| Method and route | Purpose |
|---|---|
| `POST /api/rise/v1/session/exchange` | Redeem one-time HQ code |
| `GET /api/rise/v1/session` | Current RISE role/capability |
| `GET /api/rise/v1/health` | Service liveness, no sensitive data |
| `GET /api/rise/v1/status` | Active release, source dates, coverage, quarantine |
| `GET /api/rise/v1/programs` | Bounded search/filter/sort pagination |
| `GET /api/rise/v1/program-specialties/{id}` | Evidence-labeled profile |
| `GET /api/rise/v1/program-specialties/{id}/evidence` | Claim/source detail |
| `POST /api/rise/v1/matches:evaluate` | Explainable rule evaluation |
| `POST /api/rise/v1/handoffs/{target}` | One-time ACTN/CAM/StoryForge handoff |

List requests require a bounded page size and stable sort. Responses include `registryReleaseId`, query normalization, total memberships, unique-program denominator, and next cursor. Combined pathways appear for a component specialty only when `includeCombined=true` and are labeled `RELATED_COMBINED`.

## Matching Contract

Criterion outcomes: `SATISFIED`, `CONTRADICTED`, `UNKNOWN`, `SOURCE_CONFLICT`, `CONDITIONAL`, `NOT_APPLICABLE`.

Aggregate outcomes: `NO_PUBLISHED_CONFLICT_OR_UNKNOWN_FOUND`, `PUBLISHED_REQUIREMENT_CONFLICT`, `CONDITIONAL_REVIEW`, `REQUIREMENTS_INCOMPLETE`, `NOT_EVALUATED`.

Any hard unknown or source conflict prevents the no-conflict/no-unknown result. That result is deliberately not named “meets,” “qualifies,” or “eligible.” Preferences, IMG composition, location, research, fellowship evidence, and ACTN presence are contextual only. Disabled criteria are auditable and immediately recalculated.

## Distance Contract

Distance carries origin basis, destination basis, method, coordinate dataset/version, and precision. ZIP-centroid Haversine output is labeled `Approximately N straight-line miles`; it is never described as drive distance or commute. Missing coordinates return unknown.

## Matrix Contract

Matrix remains applicant-profile authority. A later Matrix-owned server endpoint returns only an explicit, consented `candidate_profile.v1` field projection. RISE stores projection version/digest and consent receipt, not a hidden full-profile copy. No query-string or localStorage transport is permitted.

## Private Persistence Contract

The proposed `rise_app` schema stores only hash-bound authorization-code redemption, sessions and CSRF tokens, consent receipts, encrypted/versioned Matrix projections, release-bound saves and comparisons, auditable match assessments, five-minute single-use handoff grants, and operator queue records. The proposed `rise_audit` schema stores append-only audit events and backup/restore checkpoints. All ten app tables force RLS and intentionally have no policies or runtime grants; owner-approved subject/role policies are a staging prerequisite. Audit and recovery records reject updates and deletes. Browser-direct database access remains prohibited.

## ACTN Contract

RISE consumes a role-filtered aggregate keyed by immutable program ID: counts, eligibility state, freshness, and an ACTN deep link. Named alumni/contact data remains in ACTN. RISE never name-matches spreadsheet text to people.

## CAM Contract

CAM redemption uses a one-time, subject-bound context with at most five minutes TTL, atomic consume-once replay storage, and the current immutable registry release. The allowlist includes immutable program/program-specialty IDs, claim IDs, bounded criterion outcomes, question IDs, assessment ID, and consented StoryForge reference IDs. Injected resolvers must validate the program/program-specialty pair and every reference before replay consumption. HTML, demo/synthetic content, all geography/address/coordinate fields, immigration documents, exam identifiers, named alumni, arbitrary nested fields, and full story text are rejected.

## Fellowship Contract

Relationships distinguish same sponsor, same institution, same health system, affiliated site, and external placement. Rates require a complete named cohort, denominator, years, and identity-resolution method. Otherwise RISE may report only the number of observed placements in reviewed public sources.
