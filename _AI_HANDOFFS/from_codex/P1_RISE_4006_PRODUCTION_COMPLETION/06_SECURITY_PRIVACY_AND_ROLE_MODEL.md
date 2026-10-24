# P1 RISE 4006 Security, Privacy, And Role Model

## Current Verdict

The isolated foundation passes its local source-policy, payload-safety, service-isolation, and proposed-schema contracts. Production security is not certifiable because no RISE runtime, identity relay, deployed database, approved RLS policy, route, staging environment, or immutable production rollback artifact exists. No production secrets or applicant data were created or logged.

## Roles

| Role | Registry | Applicant profile | Match | Operator | Integrations |
|---|---|---|---|---|---|
| Public | None | None | None | None | None |
| Authenticated member without capability | None | Own session metadata only | None | None | None |
| RISE student | Read evidence-labeled registry | Own consented projection | Own assessments/saves | None | Own CAM handoff |
| Mentor | Read registry | Only explicitly shared student context | Shared review only | None | No implicit ACTN people access |
| RISE operator | Read registry and source status | No applicant profile by default | Aggregate diagnostics | Refresh/quarantine workflow | Adapter status only |
| RISE admin | Scoped configuration/audit | Exceptional audited support access | Ruleset/release administration | Release/rollback | Feature-flag control |
| Service importer | Registry write to inactive release | None | None | Import audit only | None |

WordPress capability, RISE session role, API authorization, and database policy must all agree. UI visibility is not authorization.

## Authentication

- Identity remains in WordPress/HQ.
- HQ code is single-use, `aud=rise`, at most 60 seconds, and contains no profile fields.
- RISE session uses a distinct secret and secure HttpOnly cookie.
- CSRF protection is required for state-changing routes.
- Session fixation, replay, wrong-audience, wrong-role, expiry, logout, and concurrent-session tests are release gates.
- Browser-to-Supabase access is prohibited for production RISE.

### Candidate Enforcement

- `local-preview` is rejected in production and may bind only to a loopback address.
- Hosted execution requires `RISE_AUTH_MODE=injected` and an approved host adapter module.
- Browser-supplied `Authorization: Bearer` credentials are rejected; identity must come from the trusted host boundary.
- The injected session must carry `aud=rise`, a subject, and explicit capabilities.
- Every non-health request requires `rise:read` or `rise:admin`; operator routes additionally require `rise:operator` or `rise:admin`.
- Production index loading requires a separately pinned pre-read manifest plus `RISE_INDEX_SHA256`; source-controlled bytes are not read until the manifest's release and current authorization set pass expiry, revocation, and exact-set checks.
- Production web loading requires `RISE_ASSET_MANIFEST_SHA256`, verifies the build ID and every asset hash, and serves authenticated assets with revalidation rather than a mutable long-lived cache.
- Production requires an injected shared durable abuse controller that runs before authentication and again against the opaque authenticated subject. The bounded process-local implementation is test/preview only; audit identity is a short SHA-256 digest.
- Profile and evidence responses use `Cache-Control: no-store`.

These controls are unit/contract tested. The proposed app tables are forced-RLS with no policies or runtime grants and therefore fail closed. This is not a substitute for the missing WordPress/HQ code exchange, production cookie session, CSRF implementation, owner-approved RLS policies, production telemetry, or authenticated staging tests.

## Data Classification

| Class | Examples | Handling |
|---|---|---|
| Public sourced | Program names, locations, published descriptions | Evidence/source/date labels; cache by release |
| Derived non-sensitive | Stable IDs, browse memberships, coverage metrics | Versioned and auditable |
| Applicant private | Matrix projection, criteria, saves, notes | User-scoped, minimized, encrypted, private/no-store |
| ACTN restricted | Person identity, contact, relationship | Remains in ACTN; aggregate adapter only |
| StoryForge restricted | Story text/audio/transcript | Remains in StoryForge; reference/grant only |
| Administrative | Import logs, quarantine, release actions | Operator/admin scoped and audited |
| Secrets | Service keys, session secrets, adapter credentials | Environment/secret store only; never R2, Git, reports, or browser |

## Privacy Rules

1. Matrix projection is opt-in, field-allowlisted, purpose-limited, and revocable.
2. Raw applicant ZIP, visa history, exam identifiers, and immigration documents do not enter CAM by default.
3. ACTN named-person data is not copied into RISE.
4. Applicant-specific logs use opaque subject and request IDs.
5. Profile retention and deletion periods require explicit owner approval before launch.
6. No demo applicant, alumni, fellowship, queue, CAM, or community data may appear as production truth.

## Source And Evidence Safety

- Residency Explorer import is denied without written AAMC authorization.
- FREIDA import is denied without written AMA authorization that covers database/product use.
- Each authorization record must hash the source-owner grant and itself match the exact governance pin; the actual grant bytes must match that embedded hash. The record carries effective/expiry dates, a MissionMed review decision, and supports runtime revocation.
- Workbook export is blocked before source bytes are read; inspection metadata is bound to the authorization hashes and deterministic table-content hash.
- Retrieval, source update, survey receipt, reporting period, and human review are separate fields.
- Missing values remain unknown.
- Staging-derived `No` for absent J-1/H-1B tokens is not treated as an explicit negative.
- Real source-controlled data cannot be imported, indexed, or served while `sourceRightsApproved` is false.
- Synthetic fixtures are environment-labeled and are the only records used in browser and stress tests.
- Matching and integration endpoints fail closed; unsupported eligibility conclusions cannot be generated by the candidate.
- CAM payloads require subject/release/program/program-specialty binding, injected resolvers, strict bounded fields, and atomic single-use replay consumption; geography/address and arbitrary nested applicant data are rejected.

## Threat Controls

| Threat | Required control |
|---|---|
| Auth code replay | Single-use `jti`, atomic redemption, 60-second expiry |
| Cross-product token reuse | Strict audience and issuer validation |
| IDOR | User/role authorization on every profile, save, assessment, and handoff |
| CSV/formula/HTML injection | Structured parsers, output encoding, CAM HTML rejection |
| Source poisoning | Content hashes, immutable snapshots, count/invariant gates, quarantine |
| Silent source drift | Release comparison, collision fail-closed, explicit resolution records |
| Prompt/demo leakage | Synthetic assertion rejection and environment labeling |
| SSRF through URLs | No server fetch from untrusted client URLs; source allowlist |
| Secret exposure | Secret store, redaction scans, no client service key |
| Excessive data export | Bounded pagination, rate limits, audit, no raw registry dump route |

## Database Policy Requirements

The proposed dedicated `rise` schema uses separate NOLOGIN reader, importer, and release-manager roles. The browser receives no service key. Registry writes are importer-only while a release is offline or staging; row locks serialize inserts against activation, and activation/history use a narrowly granted security-definer function. The proposed `rise_app` plane stores only hashed session/code/CSRF identifiers, consent receipts, encrypted Matrix projections, user-scoped saves/comparisons/assessments, five-minute handoff grants, and operator queue records. Its ten tables have `ENABLE` and `FORCE ROW LEVEL SECURITY` with no policies or grants. `rise_audit` rejects updates/deletes to audit and recovery rows. Production schema changes still require owner-approved policies, a clean migration history, backup, staging test, and restore rehearsal.

## Security Gates Still Required

- accountable owner and data controller
- source-use approval
- threat model review
- session/CSRF/authorization tests
- RLS or equivalent policy tests
- production rate-limit/bulk-export policy and telemetry review
- secret scan and deployment configuration review
- staging penetration pass
- authenticated live-browser journeys

Current release decision: `NO-GO` for staging or production provisioning until authority and runtime prerequisites exist.
