# MX-MISSIONACCOUNTS-5301P Production Completion

**Result:** PARTIAL — isolated production foundation complete; protected Matrix and provider activation blocked by authority/runtime gates
**Date:** 2026-09-06
**Branch:** `codex/mx-missionaccounts-5301p-production`
**Implementation commits:** `9d580e3f0d22068355ed86f2bd66a4610e8cea46`, `44de639b12f9d00707c8e43a8a62015941a0140e`, `ef72709aabcf1768c2b8116cb796907899ffc263`, `b402c5326abe0a4668166d4637ea91b97a11d691`, `8412990629be7900412fe251e575cfabf655f87d`, `3608a7397e7aad16b2074fa027aa80b6b956bafb`, `d009476c8793e60d4f5f0e9aeefc3a549a839a5d`
**Remote:** `origin/codex/mx-missionaccounts-5301p-production`

## Outcome

MissionAccounts now has a real isolated application foundation rather than another design artifact:

- exact 5300A canon build with hash verification;
- private-browser-artifact handling so historical student data is not committed;
- server-authoritative billing-day, source-normalization, exam/grace/reminder, stale-approval, and charge-eligibility engines;
- additive PostgreSQL schema candidate with immutable source custody, versioned interpretations, append-only corrections/audit, RLS, sanitized payment metadata, Stripe event inbox, notification outbox, feature flags, and Zoom sync boundary;
- Matrix RS256/JWKS authentication boundary with audience, issuer, expiry, and trusted `app_metadata.roles` enforcement;
- Stripe Test-Mode-only SetupIntent and one-day PaymentIntent adapters, exact raw-body webhook verification, retry-safe provider-inbox deduplication, secret-rotation signature support, and stable idempotency keys;
- feature-gated student exam-plan submission with authenticated self-resolution, a transactional/idempotent PostgreSQL RPC, immutable transition and audit rows, prior-plan supersession, and notification outbox insertion;
- feature-gated Dr J/admin comp-day override with mandatory reason, idempotent PostgreSQL transaction, joined-date custody, prospective lock preservation by default, explicit retroactive-release handling, and append-only change/audit evidence;
- feature-gated Dr J/admin exam decisions with the canonical transition matrix, exact local-date grace opening/closure, third-Wednesday reminder scheduling/cancellation, student notification outbox entries, idempotent retries, and preserved audit rows for rejected transitions;
- feature-gated billing approval that derives totals only from current server-side attendance days, rejects unresolved identities and historical cap candidates, enforces verified ceilings, supersedes old decisions, and creates only unsent draft invoices;
- feature-gated append-only attendance corrections that preserve source rows, support reversible add/remove and step interpretation, stale affected approvals, and void only unsent stale invoices;
- local HTTP application route and health/session/admin boundaries;
- all 17 ticket-mandated vectors represented in the automated suite.

No production system or provider was changed.

## Canon and source custody

- 5300A canonical prototype SHA-256: `3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8` — PASS.
- 5000B reconciled ledger SHA-256: `6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108` — PASS.
- 5000B identity graph SHA-256: `c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee` — PASS.
- The generated 831,032-byte UI artifact is gitignored because the canon embeds historical student information.
- The committed source-validation receipt contains only hashes and aggregate controls, never names, aliases, meeting IDs, or emails.

## Historical controls

| Control | Result |
|---|---:|
| Preserved attendance events | 3,941 |
| Human-cycle rows | 498 |
| Cycle 1 events / unique days / reduction / amount | 1,295 / 1,072 / 223 / $25,425 |
| Cycle 2 events / unique days / reduction / amount | 1,390 / 1,141 / 249 / $26,575 |
| Cycle 3 events / unique days / reduction / amount | 1,256 / 1,051 / 205 / $25,075 |
| Unique-day total before adjudicated historical caps | $77,075 |

The $77,075 control is an estimate oracle, not a collectible total. Twenty-three source rows could rise above a historical source amount if no verified ceiling is attached. They remain `candidate` / `needs_review`; the implementation never invents cap eligibility.

## Exact files changed

All implementation files are under `missionaccounts/`:

- `.gitignore`, `README.md`, `package.json`
- `scripts/materialize-canon.mjs`
- `scripts/validate-source.mjs`
- `scripts/test-postgres-migration.sh`
- `public/missionaccounts-runtime.js`
- `src/server.mjs`
- `src/http/body.mjs`
- `src/security/auth.mjs`
- `src/storage/supabase-rest.mjs`
- `src/payments/stripe.mjs`
- `src/domain/billing-engine.mjs`
- `src/domain/charge-engine.mjs`
- `src/domain/exam-engine.mjs`
- `src/domain/source-normalizer.mjs`
- `src/domain/zoom-provider.mjs`
- `supabase/migrations/20260906062212_missionaccounts_initial_schema.sql`
- `tests/billing-engine.test.mjs`
- `tests/exam-engine.test.mjs`
- `tests/mandatory-vectors.test.mjs`
- `tests/stripe.test.mjs`
- `tests/server.test.mjs`
- `evidence/source-validation.json`

## Migration status

- Created: `missionaccounts/supabase/migrations/20260906062212_missionaccounts_initial_schema.sql` (1,472 lines).
- Applied locally: PASS in a disposable PostgreSQL 16 cluster; schema parse/application plus billing authority, immutable correction flow, exam/grace/reminder effects, and comp-override retry controls passed. No persistent local database was created.
- Applied to staging/production: NO — target database and migration authority are not registered.
- Schema is additive and all capability flags seed disabled.

## Verification

- `npm test`: PASS — 55/55, including V01–V17 plus raw-body webhook, rotated-signature, duplicate-delivery, API-version, authorization, feature gates, billing approval/cap custody, append-only corrections, exam/grace/reminder effects, and comp overrides.
- `npm run test:postgres`: PASS — complete migration applied to disposable PostgreSQL 16; unresolved cap approval was rejected, verified cap produced $300, correction staled approval and voided its draft, retries deduplicated, invalid exam transitions were audited, and grace/reminder effects passed.
- `npm run validate:source`: PASS — all aggregate historical controls above.
- `npm run build:canon`: PASS — exact approved SHA verified and UI materialized.
- Node syntax checks across source/scripts/public/tests: PASS.
- `git diff --check`: PASS.
- Local API:
  - `/api/health`: 200; route, auto-billing, and Zoom flags false.
  - student `/api/session`: 200.
  - student access to `/api/admin/health`: 403.
  - local admin fixture to `/api/admin/health`: 200.
- Browser:
  - StoryForge-family opening: PASS.
  - Admin command home: PASS.
  - dark theme: PASS.
  - student lens and same-day one-$25-day labels: PASS.

## Production services touched

None. No Railway project/service, PostgreSQL database, Supabase project, Kinsta/WordPress file, Cloudflare object, Matrix runtime asset, Stripe object, webhook, customer, PaymentMethod, PaymentIntent, invoice, email, notification, Zoom setting, Zoom report, or production student row was created or changed.

## Environment/config changes

None outside the isolated worktree. Local preview used `PORT=4179` and `MISSIONACCOUNTS_AUTH_MODE=local`; local auth fails closed under `NODE_ENV=production`. Stripe requests now use the account-default API version unless a provider-verified value is explicitly supplied through `MISSIONACCOUNTS_STRIPE_API_VERSION`; no fabricated future version is sent.

## Matrix route registration and production URL

- Matrix route registered: NO.
- Production URL: expected `/missionaccounts/`, currently not activated.
- Local preview: `http://127.0.0.1:4179/missionaccounts/?replay=1` while the local process is running.

## Zoom integration status

The provider boundary exists and fails closed as `not_connected`. No Zoom credential, API call, scheduled sync, or production exception queue was activated. Full ingestion remains behind `zoom_sync=false`.

## Blocking evidence

1. `MX-MISSIONACCOUNTS-5301P` is absent from current `missions.json`, `products_index.json`, `authority_index.json`, `CURRENT.md`, and the boot mission profiles.
2. Mission-specific boot validation fails as unknown mission.
3. The protected Matrix runtime preflight produced the mandated stale-source warning and found production-origin hash drift for the shell, CSS, PHP loader, Calendar, and StoryForge assets.
4. No MissionAccounts Railway/PostgreSQL/Stripe/notification production target identity is registered.
5. Historical full-cycle eligibility evidence is incomplete; source tier labels are candidates, not authorization to collect.
6. Final automatic-billing terms and live-charge activation remain unapproved.

Because of those facts, protected Matrix edits, database application, live Stripe work, historical import, production deployment, and production smoke tests were not performed.

## Required next authority

- Register the MissionAccounts product, passport, mission, Founder decision, MR-079 amendment, authority routes, mission boot profile, and receipt from a fresh OS worktree.
- Scope exact isolated Railway/database identities, historical-data custody, Matrix SSO/route files, eligible Dr J/admin/student pilot identities, Stripe Test Mode, notifications, and rollback.
- Reconcile and re-lock the drifted Matrix production origin before any shared Matrix edit.
- Approve which 5000B `$300` source candidates are legitimate historical ceilings.
- Approve final automatic-billing terms before any live automatic charge.

## Rollback

Local candidate rollback is deletion/reversion of the isolated branch only; it has no production effect. A production rollback cannot be authored truthfully until exact provider targets exist. The intended release must be feature-off first, use additive migrations, create fresh database and Kinsta preimages, use immutable release directories/current pointers, and rehearse route/database/provider rollback before activation.

## Founder action still required

Production cannot safely continue without the authority/target and Matrix-lock resolutions listed above. The isolated build can continue to receive local hardening, but no production mutation should be attempted from this state.
