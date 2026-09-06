# P1-RISE-4006 Implementation Report

## Candidate

- Commit: `f99e126399508d2630e9b2a17b8671d87cff1ca2`
- Branch: `codex/p1-rise-4006-production`
- Web build: `rise_web_8d2c636a88b7`
- Scope: isolated `rise/` package only
- Deployment: not performed

## Runtime Hardening

- Added a concrete HQ authentication adapter that introspects the exact `rise` audience, accepts only the named session cookie, rejects browser bearer tokens, validates persistence and expiry, derives an opaque session ID, and withholds email and upstream access tokens.
- Enforced issuer, audience, validation recency, 12-hour maximum expiry, revocation, bounded roles and capabilities, and CSRF on all state-changing methods.
- Added a concrete HTTPS shared-abuse adapter with a dedicated service credential, timeout, global pre-auth scope, HMAC subject scope, and fail-closed behavior.
- Replaced raw subject logging with truncated HMAC-SHA256 audit identifiers and required an audit key in production.
- Added structured JSON logs, deployment identity, request IDs, and a capability-gated operator metrics endpoint.
- Kept the static shell public for a clear signed-out state while every registry and operator API remains protected.

## Artifact and Release Controls

- Added `tools/prepare-runtime.mjs` and `tools/start-production.mjs` to fetch release artifacts from the configured same-origin HTTPS host into a fresh temporary directory.
- Required authenticated downloads, bounded payload sizes, exact SHA-256 values, manifest binding, release binding, and cleanup on failure before server startup.
- Added an activation-receipt schema binding release, index, manifest, actor, decision, and validation status.
- Required production activation, a source-controlled registry, a current exact authorization set, and an independently verified activation receipt.
- Expanded `deployment-contract.v1.json` and added `route-contract.v1.json` for exact environment, adapter, service-root, same-origin, route, and edge approval requirements.
- Pinned the multiarch Node 22 Alpine base digest in the Dockerfile. The image built locally without warnings, reproduced `rise_web_8d2c636a88b7`, runs as `node`, and keeps both adapter module paths in runtime configuration rather than image metadata.
- Removed npm and all runtime `node_modules` from the final image. The Lucide development fallback now resolves only when the production-built vendor bundle is absent.
- Generated a 20-package SPDX SBOM for the 58,181,739-byte local arm64 image. Trivy 0.72.0, run from pinned scanner image digest `sha256:cffe3f5161a47a6823fbd23d985795b3ed72a4c806da4c4df16266c02accdd6f`, reported zero vulnerabilities at every severity across Alpine and Node packages.

## Database Hardening

Added proposed migration 003, which:

- creates separate governance and validator roles;
- stores source-authorization and release-validation receipts;
- prevents production activation without matching current evidence and at least one source document;
- makes release identity, authorization lineage, and evidence immutable;
- binds a session to the complete redeemed authorization identity;
- makes authorization-code redemptions immutable;
- serializes an HMAC audit chain with predecessor and monotonic-time enforcement;
- limits registry readers to seven active, non-quarantine views.

All migrations remain proposed. No production or shared database was touched. A reusable synthetic PostgreSQL rehearsal fixture now proves promotion, rollback, least privilege, composite identity, and audit-chain behavior in a disposable cluster.

## Integration Contracts

- Matrix projection contract: consent, purpose, release, expiry, data minimization, and unknown-preserving semantics.
- ACTN contract: reference-only context with no copied relationship content or write authority.
- CAM contract: existing short-lived, subject- and release-bound resolver semantics retained and reinforced.
- StoryForge contract: reference-only recommendations with no copied canonical stories.
- Integration registry: every dependency remains explicitly owner-gated and disabled.

## Product and UX Repairs

- Corrected the field-completeness denominator so the UI reflects the exact selected field inventory.
- Exposed previously omitted FREIDA, faculty, categorical-position, PGY4, research, board, housing, parking, childcare, score, and graduation-gap fields without inventing values.
- Added an exact designation filter alongside component-specialty browsing.
- Preserved Explorer filters and context when returning from a profile.
- Added result announcements, explicit alert semantics, stale compare recovery, compact comparison provenance, and stable action placement.
- Removed comparison overload caused by repeating full provenance blocks in every cell.
- Added an explicit signed-out access view and optional same-origin HQ login link.
- Preserved conspicuous synthetic and current-availability notices on every data view.

## Performance Repair

The production build now generates a selected official Lucide bundle instead of shipping the entire icon catalog. The vendor asset fell from roughly 404 KB to 5,680 bytes. The complete raw web artifact is 102,752 bytes and approximately 24,949 bytes gzip-compressed.

## Test Expansion

Core coverage grew from 71 to 89 tests. Browser coverage grew from 26 to 34 tests. New coverage includes adapters, CSRF, issuer and revocation drift, activation receipts, production artifact bootstrap, exact designations, cross-product contracts, HMAC privacy, stale compare recovery, signed-out state, production bundle budget, Founder screenshots, and effective 125/150/200 percent zoom viewports.

## Explicit Non-Changes

No production deploy, database migration, route creation, Cloudflare rule, WordPress change, Railway service, MissionMed OS registration, shared HQ auth change, Matrix write, ACTN write, CAM activation, StoryForge activation, or source ingestion occurred.
