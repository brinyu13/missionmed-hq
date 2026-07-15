# P1 RISE 4006 - Requirements Traceability

**Status:** Reconciled against 4004, recovered 4005, canonical registry, repository reality, and live infrastructure.

**Legend:** `REQUIRED` = production requirement; `GATED` = blocked by an external owner/contract; `IMPLEMENTED OFFLINE` = implemented and tested only in the isolated candidate; `PARTIAL OFFLINE` = some acceptance behavior is implemented but the production contract is incomplete; `DEMO-ONLY` = allowed only in test/demo; `PROHIBITED` = must not ship; `ABSENT` = no implementation exists.

## Source Authority

| Code | Source |
|---|---|
| `P4004` | `P1_RISE_4004_FINAL_UX_FREEZE_CANDIDATE.html`, SHA-256 `6348f34b...13d185` |
| `A4005` | Recovered 4005 independent audit, scorecard, fixes, JSON, and 26 screenshots |
| `REG` | Canonical MissionMed RISE Google Sheet, 6,346 raw specialty rows; reconciled inspection has 6,345 active memberships / 6,139 unique programs / 1 quarantined duplicate; no authorized production release |
| `MATRIX` | WordPress `mmed/v1/profile/me` ownership and locked Matrix runtime |
| `ACTN` | ACTN local foundation and read-model contracts; not production live |
| `CAM` | CAM 4004 scope closure and current CAM production contracts |
| `AUTH` | WordPress-to-Railway signed handoff and HQ session contract |
| `CRIT` | Critical Systems Contract and Manifest |
| `CHARTER` | P1-RISE-4006 production completion charter |

## Capability Matrix

States distinguish local candidate behavior from production availability. No `IMPLEMENTED OFFLINE` or `PARTIAL OFFLINE` row is a live-production claim.

| ID | User capability | Source | Production component | Data authority | Required endpoint or boundary | Required test evidence | Evidence class | State |
|---|---|---|---|---|---|---|---|---|
| RQ-001 | Logged-out users receive a truthful access state | `CHARTER`, `AUTH` | WordPress `/rise/` wrapper and RISE access screen | WordPress identity | Signed `aud=rise` handoff or approved equivalent | Logged-out redirect, invalid/expired token, open-redirect tests | System fact | GATED / PARTIAL OFFLINE |
| RQ-002 | Authorized student opens RISE | `CHARTER`, `AUTH` | RISE shell | WordPress entitlement and HQ session | `GET /api/rise/v1/session` | Student sign-in/sign-out and unauthorized 401/403 journeys | User-provided/system fact | GATED / PARTIAL OFFLINE |
| RQ-003 | Mentor/admin receives role-appropriate controls | `CHARTER` | Role-aware navigation and queue | WordPress roles plus explicit RISE policy | Session projection with explicit capabilities | Role matrix and IDOR tests | System fact | GATED / PARTIAL OFFLINE |
| RQ-004 | Command Home shows trustworthy registry status | `P4004`, `A4005` | Command Home | Registry release manifest | `GET /api/rise/v1/status` | Count denominators, freshness, stale/error tests | Derived from release manifest | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-005 | Counts distinguish raw observations, active memberships, and unique programs | `REG`, `A4005` | Registry summary | Program and program-specialty tables | Status response includes raw, active, quarantined, combined, and unique counts | Assert 6,346 / 6,345 / 1 / 206 / 6,139 plus specialty denominators | Source-reported plus derived | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-006 | Explorer searches program name, institution, city, state, specialty, and IDs | `P4004`, `CHARTER` | Explorer/search service | Canonical registry release | `GET /api/rise/v1/programs?q=` | Unicode, punctuation, duplicate name, empty, and large-result tests | Source-reported | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-007 | Filters cover specialty, state, region, type, visa, evidence, and status | `CHARTER` | Explorer filters | Typed registry fields | Query parameters with allowlisted enums | Combination, malformed, unknown, and URL manipulation tests | Source-reported/derived | REQUIRED / PARTIAL OFFLINE: status filter absent |
| RQ-008 | Results paginate or virtualize at national scale | `CHARTER` | Result list | Registry read model | Bounded page contract | 6,500-record synthetic concurrency, boundary, and stable-order tests | System behavior | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-009 | Program profile preserves program-specialty identity | `P4004`, `REG` | Program Profile | Immutable program and program-specialty IDs | `GET /api/rise/v1/program-specialties/{id}` | Deep link, combined specialty, duplicate-name, missing-record tests | Source-reported | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-010 | Every displayed field has source, reporting period, and retrieval context | `A4005`, `REG` | Evidence drawer and field labels | Field-evidence store | Program-specialty response carries field evidence | Field provenance, stale, conflict, and missing-period tests | Source-reported/derived/verified | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-011 | Missing data is visibly unknown, never negative proof | `A4005`, `CHARTER` | Shared evidence renderer | Field evidence status | Typed `unknown_reason` contract | Missing field, parser gap, source unavailable, and not-applicable tests | Unknown | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-012 | Student consents before applying Matrix profile | `CHARTER`, `MATRIX` | Matrix criteria panel | Matrix-owned profile projection | `POST /api/rise/v1/matrix-profile:apply` or equivalent consent receipt | Consent, revoke, incomplete profile, and unauthorized tests | User-provided | GATED |
| RQ-013 | RISE consumes only a least-privilege Matrix projection | `MATRIX`, `CRIT` | Matrix adapter | `mmed/v1/profile/me` owner | Approved server-side projection; no browser token leakage | Field allowlist and cross-student leakage tests | User-provided | GATED |
| RQ-014 | Each criterion can be disabled and restored | `P4004`, `CHARTER` | Criteria chips | Evaluation policy version | Client state plus reproducible evaluation request | Toggle each criterion, toggle all, reload/share privacy tests | Evaluation state | REQUIRED / ABSENT |
| RQ-015 | Matching distinguishes hard criteria, context, preference, and non-evaluable | `CHARTER`, `A4005` | Matching engine | Profile projection, program evidence, policy version | `POST /api/rise/v1/matches:evaluate` | Truth table per operator and evidence status | Derived interpretation | REQUIRED / PARTIAL OFFLINE: fail-closed engine contract only; no current claims/UI |
| RQ-016 | "Meets" requires zero unknown hard criteria | `A4005` | Matching categorizer | Typed requirement evidence | Evaluation result includes met/conflict/unknown counts | Regression for the 328 formerly misclassified rows | Derived interpretation | REQUIRED / ABSENT |
| RQ-017 | Why This Matches explains every result without eligibility claims | `P4004`, `CHARTER` | Match explanation panel | Evaluation trace | Evaluation response carries criterion-level reasons | Snapshot and adversarial wording tests | Derived interpretation | REQUIRED / ABSENT |
| RQ-018 | Approximate distance is sortable and honestly labeled | `P4004`, `A4005` | Explorer sort and profile geography | Versioned geographic dataset | Distance response includes method, dataset, and precision | Monotonic sort, missing ZIP, territory, and accuracy tests | Derived | REQUIRED / PARTIAL OFFLINE: calculation contract only; no approved geography/UI |
| RQ-019 | Compare supports two to four program-specialty records | `P4004`, `CHARTER` | Compare | Registry read model and match results | Batched read/evaluation contract | 2-4 cap, duplicate, removed item, unknown-field tests | Mixed, per-field | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-020 | Fellowship pathway appears only with sourced program data | `P4004`, `CHARTER` | Fellowship tab/state | Approved fellowship source pipeline | Program fellowship read model | No-data, stale, source conflict, and non-pilot tests | Source-reported/unknown | GATED |
| RQ-021 | Prototype fellowship rankings remain quarantined | `P4004`, `A4005` | Demo fixture only | Synthetic fixture | No production endpoint | Build assertion that demo fixture is absent from production bundle | Demo | PROHIBITED |
| RQ-022 | ACTN relationships are read-only and role-safe | `CHARTER`, `ACTN` | ACTN adapter | ACTN canonical owner | Versioned read API keyed by immutable program ID | Unauthorized, student privacy, zero-write, and stale mapping tests | ACTN-reported | GATED |
| RQ-023 | Synthetic named alumni never enter production | `P4004`, `A4005` | Build quarantine | Synthetic fixture | No production endpoint | Production bundle/data scan for names and fixture IDs | Demo | PROHIBITED |
| RQ-024 | Local Community Signals render only from a legitimate source pipeline | `P4004`, `A4005`, `CHARTER` | Community tab/state | Versioned ACS or other approved dataset | Geography, vintage, denominator, and margin-of-error contract | Source vintage, geography, MOE, missing-data tests | Source-reported/derived | GATED |
| RQ-025 | Interview pack state is truthful | `P4004`, `CHARTER` | Interview Pack | RISE-curated, versioned pack store | Pack read endpoint with author, review, status, and evidence links | Draft/published/stale/permission/error tests | MissionMed interpretation | GATED |
| RQ-026 | CAM handoff contains only supported, authorized facts | `CHARTER`, `CAM` | CAM adapter | Published pack and approved applicant projection | Versioned handoff with `program_id`, `pack_id`, `question_ids`, `interviewer_id`, evidence metadata | Schema, auth, unavailable, retry, idempotency, deletion-linkage tests | Mixed, explicitly typed | GATED |
| RQ-027 | CAM cannot flatten inference into fact | `A4005`, `CAM` | CAM payload validator | Evidence store | Every value carries evidence class/confidence/source | Reject untyped/demo/stale payloads | Validation behavior | GATED |
| RQ-028 | Operator queue actions are real or disabled | `P4004`, `CHARTER` | Operator Queue | Durable task/audit store | Queue read/write endpoints with role and audit receipt | Persistence, retry, concurrency, role, and disabled-action tests | System fact | GATED / TRUTHFULLY DISABLED OFFLINE |
| RQ-029 | Browser history and deep links work | `P4004`, `A4005` | Router | Route contract | WordPress/HQ rewrite plus client router | Direct load, back/forward, reload, invalid ID tests | System behavior | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-030 | Loading, empty, stale, permission, and error states are complete | `CHARTER` | Shared state components | API status contract | Typed problem responses and retry hints | Slow, timeout, 401, 403, 404, 409, 429, 500 tests | System behavior | REQUIRED / PARTIAL OFFLINE |
| RQ-031 | Mobile widths 390 and 430 are fully usable | `A4005` | Responsive shell/cards | N/A | N/A | Pixel/overflow/touch journeys at 390 and 430 | UI behavior | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-032 | Keyboard and modal semantics pass | `A4005` | Focus manager, dialogs, semantic controls | N/A | N/A | Focus trap, inert, restoration, Space/Enter, skip link, tablist tests | Accessibility behavior | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-033 | Zoom, reduced motion, and readable microcopy pass | `CHARTER`, `A4005` | Design system | N/A | N/A | 125/150/200% zoom, reduced-motion, contrast, text reflow tests | Accessibility behavior | REQUIRED / PARTIAL OFFLINE |
| RQ-034 | No applicant data reaches URLs, logs, or unauthorized analytics | `CHARTER`, `CRIT` | Privacy filter and telemetry | Profile projection | Structured log allowlist | Log, URL, referrer, analytics, cache, and error leakage tests | Privacy control | GATED / PARTIAL OFFLINE |
| RQ-035 | Registry refresh is versioned, idempotent, and rollback-safe | `REG`, `CHARTER` | ETL and release manifest | Google Sheet export plus approved sources | Import job, validation report, atomic release activation | Re-run, partial failure, duplicate, delete quarantine, rollback tests | System behavior | GATED / PARTIAL OFFLINE |
| RQ-036 | Program identity is immutable across refreshes | `A4005`, `REG` | Identity resolver | ACGME/FREIDA identifiers | Program and program-specialty key contract | Reorder/rebuild/combined-specialty stability tests | Derived identity | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-037 | Production exposes health, build, sync, and freshness without PII | `CHARTER`, `CRIT` | Health/observability | Release and deployment manifests | `GET /api/rise/v1/health` | Degraded dependency, stale sync, build ID, no-secret tests | System fact | REQUIRED / IMPLEMENTED OFFLINE |
| RQ-038 | RISE has a scoped deployment and rollback path | `CRIT`, `CHARTER` | Release tooling | Git, CDN, Railway, DB backups | Registered manifest entries and scoped deploy command | Hash, smoke, restore, migration rollback tests | System fact | GATED |
| RQ-039 | Existing MissionMed products remain unchanged | `CRIT`, `CHARTER` | Ecosystem gates | Existing production | Critical gate plus authenticated journeys | Arena, USCE, Matrix, CAM, WordPress, cookie, and route regression | System fact | GATED |
| RQ-040 | Production contains no demo data or dead controls | `CHARTER`, `A4005` | Build validation | Production artifact and APIs | Release scan and capability manifest | Fixture/name scan, disabled-control audit, endpoint/action parity | System fact | REQUIRED / PARTIAL OFFLINE |

## Prototype Classification

| Prototype behavior | Classification | Production disposition |
|---|---|---|
| CAM-derived visual language | REQUIRED | Preserve design tokens and hierarchy without copying synthetic data behavior |
| National registry browsing | REQUIRED | Rebuild on stable IDs and typed provenance |
| Synthetic Matrix profile | DEMO-ONLY | Explicit test fixture only; excluded from production builds |
| Match scores/readiness rings | UNSUPPORTED AS-IS | Replace with versioned, explainable evaluations or omit |
| "Meets Published Requirements" current logic | PROHIBITED | Replace; unknown hard criteria cannot pass |
| Approximate ZIP-centroid distance | REQUIRED WITH CORRECTION | Add dataset/version/method/precision |
| Named representative alumni | PROHIBITED | Quarantine completely |
| ACTN cards and "Ask Brian" state | GATED | Disabled until canonical ACTN contract exists |
| Fellowship pilot rankings | DEMO-ONLY | Excluded from production |
| Local Community Signal demos | DEMO-ONLY | Excluded until sourced pipeline exists |
| Queue simulation | DEMO-ONLY | Replace with durable audited actions or disabled state |
| Interview pack simulation | GATED | Requires authored/versioned pack ownership |
| In-memory CAM payload | PROHIBITED | Must match the reviewed CAM production contract |
| 4004 hash router | UNSUPPORTED AS-IS | Replace with route-aware production mounting and deep-link tests |
| Inline event handlers and broad `innerHTML` | PROHIBITED | Replace with CSP-compatible rendering and escaped content |

## Acceptance Coverage Gap

The isolated candidate now implements and tests the read-only status, search, filtering, bounded pagination, program profile, field evidence, missing-data semantics, comparison, browser-history, responsive, keyboard, health, and stable-identity foundations. It also fails closed for unapproved source data and truthfully disables unimplemented integrations. An isolated service/package contract and proposed forced-RLS app/audit schema now exist and pass local PostgreSQL rehearsal. The product contract remains incomplete: Matrix projection and consent behavior, criterion toggling, explainable matching, fellowship, ACTN, CAM, interview packs, durable operator actions, production identity, approved RLS policies, staging, and live deployment remain absent or gated.

## Traceability Verdict

`REQUIREMENTS_RECONCILED_ISOLATED_FOUNDATION_VERIFIED_PRODUCTION_BLOCKED`
