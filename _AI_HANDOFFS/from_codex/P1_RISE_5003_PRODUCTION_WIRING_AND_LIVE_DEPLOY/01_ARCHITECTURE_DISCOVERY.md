# 01 — Architecture Discovery

Ticket: `P1-RISE-5003-PRODUCTION-WIRING-AND-LIVE-DEPLOY`

Discovery date: 2026-08-27/28 America/New_York

## Decision

The safest production target is an isolated RISE web/API service with a dedicated PostgreSQL data plane, a same-origin `/rise/` route, and server-side adapters to MissionMed-owned identity, profile, entitlement, File Vault, RankList IQ, ACTN, CAM, and research services. The Fable 5002 shell is the frontend contract. The older P1-RISE-4006 service is an engineering donor only; its historical UI is rejected.

No provider deployment or shared-runtime mutation is authorized in this mission state. The current MissionMed OS registries do not contain a P1-RISE-5003 mission route, RISE product passport, or authority-index entry. The intended public route currently resolves to the MissionMed WordPress 404 page.

## As-Found Topology

```text
Browser at missionmedinstitute.com
  |
  +-- WordPress login/session and same-origin wrappers
  |     +-- /api/auth/* -> MissionMed HQ on Railway
  |     +-- Matrix app-mode shell and File Vault V2
  |
  +-- /rise/ -> 404 as of this audit

MissionMed HQ on Railway
  +-- runtime owner: missionmed-hq/server.mjs
  +-- /api/auth/session and /api/auth/exchange
  +-- current protected business APIs
  +-- no registered RISE API or RISE audience contract

RISE data/research, currently disconnected
  +-- Google Sheet residency registry and SOAP columns
  +-- frozen research corpora and source ledgers on disk
  +-- local launchd + Python + SQLite Parallel factory
  +-- raw -> normalized -> ingest_staging
  +-- no unattended canonical writer and no student API

Older RISE service candidate, branch only
  +-- isolated Node service under rise/
  +-- proposed PostgreSQL schemas and release controls
  +-- fail-closed HQ auth adapter
  +-- synthetic local browser fixture
  +-- never deployed; intended /rise/ remains 404
```

## Current Runtime and Integration Findings

| Area | Current verified state | Production consequence |
|---|---|---|
| MissionMed frontend/runtime | The active shared Railway entrypoint is `node missionmed-hq/server.mjs`. `app/api/**` is not the active Railway runtime. | RISE must not be wired by editing the inactive Next.js lookalike. Shared HQ changes require a protected-runtime route. |
| WordPress auth | WordPress proxies `/api/auth/*` to Railway. HQ issues an encrypted `mmhq_session`, exposes `/api/auth/session`, and enforces CSRF on mutations. | Reuse this session flow. Do not create a second login or browser Supabase signup. HQ must explicitly ratify a RISE audience/claim contract before live use. |
| RISE route | `https://missionmedinstitute.com/rise/` renders the WordPress page-not-found surface. No RISE route exists in the protected manifest. | Live deployment is blocked until a same-origin route, runtime owner, smoke expectation, and rollback entry are registered. |
| Matrix identity/profile | Matrix is a protected app-mode shell. No current RISE-readable Matrix applicant-profile read/write service or versioned field contract was found. | Profile remains canonical in Matrix. RISE must fail closed to read-only/disabled profile seams until the owner supplies the contract; no duplicate profile table may be activated. |
| File Vault | File Vault V2 is a WordPress/Matrix application with cookie + REST nonce authentication, owner isolation, private R2 storage, and protected REST routes. Its student rollout still remained `internal` in the inspected J1-1014 closure. | RISE may show the locked/disabled CV seam. It must not call private File Vault routes until a scoped service contract and eligible student browser acceptance exist. |
| Entitlements | Current default-branch evidence does not prove the 5001 assumption that `user_entitlements` and `membership_feature_flags` are the active canonical RISE contract. File Vault currently resolves access through the server-owned `MMED_Access_Gate`. | Tier names/mappings cannot be invented. Premium endpoints must fail closed to universal depth until the membership owner supplies an exact feature-key mapping. |
| Supabase | The protected manifest pins RANKLISTIQ project `fglyvdykwgbuivikqoah` for existing `command_center` objects. No RISE schema/project is registered. | No shared Supabase mutation is allowed. If Supabase is later selected, exposed tables need both least-privilege grants and RLS; secret/service-role keys remain server-only. |
| Older RISE service | Branch `codex/p1-rise-4006-production` contains a source-independent, isolated service candidate, proposed PostgreSQL migrations, authentication/abuse/source-rights adapters, immutable artifact verification, and tests. It never had real data, a live route, or deployment authority. | Reuse its isolated security/release mechanics as a donor. Replace its UI with a faithful production adaptation of Fable 5002. |
| Canonical program identity | The 4102 registry reports 6,346 specialty rows, 6,345 active specialty memberships, 6,139 normalized unique program identifiers, 828 active unique IM ACGME IDs, and 821 canonical FM rows. One IM row is quarantined. | Identity imports must deduplicate by ACGME ID, preserve exact specialty/track, retain RISE aliases, and quarantine ambiguity. The corpus cannot be published until source-rights pins are approved. |
| SOAP 2026 | The canonical sheet write/readback recorded 883 `YES`, 4,024 `NO`, and 1,439 `UNKNOWN` across 6,346 specialty rows; 925 source rows mapped 883 and left 42 unmapped. | SOAP is structured historical evidence. The student UI may show positive participation with year/position type, but must never convert it to a safety or friendliness claim. |
| Deep research | The IM correction found 135 frozen-deep, 1 validated complete, 126 partial, 566 foundational-only, and 1 identity-review row across 829 IM rows. | Coverage must be progressive. “Unknown” and “research pending” are correct launch states; completeness claims must use the canonical denominator. |
| Parallel factory | A real local launchd/Python/SQLite factory exists. It persists run IDs and raw/normalized results and stages candidates. It does not ingest into canonical RISE. Ticket 007's output directory is empty, so no validated cost-aware router exists. | Preserve the proven Ultra interface and budget-pause controls. Do not connect paid submission from the app until preview/confirm, caps, credentials, and provider authority exist. |
| Parallel auto-ingest | Current staging separates safe candidates from leadership/roster/fellowship/conflict review, but there is no unattended canonical writer. | New research does not yet auto-hydrate RISE. A production ingest service must add deterministic validation, review states, corpus-version bumping, and transactional readback. |
| RankList IQ | No current callable RISE/RankList service contract was found. RankList is a separate product owner. | Keep the Fable Rank List seam locked/disabled. Do not recreate ranking inside RISE. |
| ACTN, CAM, LOI, Match Bridge | Older RISE contracts are owner-gated and disabled. Current production activation was not found. | Preserve doors and handoff affordances only with honest unavailable/locked state until each owner approves a versioned contract. |

## Selected Implementation Boundary

The implementation path is a new isolated `rise/` package in this worktree:

1. Preserve the Fable 5002 DOM, route model, visual tokens, and interaction hierarchy as the rendered shell.
2. Add a data adapter boundary so the same components render loading, real, unknown, conflicting, and disabled states without embedding medical facts in frontend code.
3. Reuse the older RISE candidate's fail-closed session, source-rights, artifact-integrity, observability, and proposed-database mechanics only where they do not alter the UI contract.
4. Keep all provider-specific adapters disabled by default and reject production startup unless the full authority/configuration set is present.
5. Keep demo fixtures under test-only paths. Production mode must refuse them.
6. Treat the current Google Sheet and local research factory as import sources, not a live browser data plane.

## Proposed Production Flow

```text
WordPress authenticated browser
  -> same-origin /rise/
  -> isolated RISE service
       -> HQ session introspection (identity + CSRF)
       -> Matrix profile adapter (owner contract required)
       -> entitlement adapter (owner mapping required)
       -> dedicated RISE PostgreSQL
            programs + assertions + sources + conflicts + coverage
            residents + people + fellowships + outcomes + SOAP
            my_programs + fit_cache + campaigns + tasks + reviews

Parallel factory
  -> raw immutable result
  -> normalized result
  -> deterministic QA
  -> safe auto-ingest OR human review
  -> canonical RISE PostgreSQL transaction
  -> corpus_version increment
  -> frontend reads updated data without redeploy
```

## Non-Negotiable Security Rules

- No secret, service-role, Parallel, artifact-store, or provider key in browser code.
- No demo/synthetic registry in production.
- No student response may include non-published/non-approved assertions.
- Student-owned state is authorized server-side and partitioned by canonical user identity.
- Paid research requires bounded scope, cost preview, explicit confirmation, and cap enforcement.
- Conflicting evidence is additive and reviewable; never overwritten blindly.
- Roster/fellow names remain blocked without the program-level public-professional privacy decision.
- Source-rights revocation must fail closed at startup and during authenticated reads.
- Production route, service, database, auth audience, membership mapping, and rollback must be registered before deployment.

## Authority Blockers

The following are external/provider blockers, not implementation guesses:

1. No P1-RISE-5003 MissionMed OS authority route or RISE product passport.
2. No approved `/rise/` protected-route manifest entry or live Railway service.
3. No approved RISE HQ audience/introspection response.
4. No Matrix profile read/write contract.
5. No canonical RISE entitlement feature mapping.
6. No dedicated RISE database owner/project, backup, RLS policy, or restore receipt.
7. No pinned source-owner authorization set for the full registry corpus.
8. No production artifact origin, source-rights controller, abuse controller, secrets, or activation receipt.
9. No provider-authorized Parallel admin submission adapter; ticket 007 is incomplete/empty.
10. No authenticated student/admin staging acceptance surface.

These blockers prevent a truthful live deployment. They do not block worktree-local implementation, tests, schemas, fixture-free production gates, or handoff preparation.

## Evidence Anchors

- Current remote default branch: `origin/main` at `4c86e85c186c01561ded81e1927842cd2ce0e5fc` during discovery.
- Assigned baseline/rollback: `4d1a8f5950668eed35a619f9a17aca7553c8308c`.
- UI-lock checkpoint: `f738f58003859b6d21fae1d12f5b48f79bc7166f`.
- Older isolated RISE branch: `codex/p1-rise-4006-production`, current inspected commit `2d0fc6b986ab1cc010e521c54b7b42ec916c1e32`.
- Fable 5002 HTML SHA-256: `1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987`.
- Production-safe local implementation checkpoint: `52f85f8b8764c993a114bb07880c1f51b94d0b3b`.
- Current offline candidate build: `rise_web_b025eb60a364`.
- Current Supabase guidance reviewed: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing your data](https://supabase.com/docs/guides/database/secure-data), and [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations).
