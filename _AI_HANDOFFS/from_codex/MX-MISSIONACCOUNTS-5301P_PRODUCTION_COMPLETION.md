# MX-MISSIONACCOUNTS-5301P Production Completion

**Result:** PARTIAL — isolated production foundation complete; protected Matrix and provider activation blocked by authority/runtime gates
**Date:** 2026-09-06
**Branch:** `codex/mx-missionaccounts-5301p-production`
**Latest implementation commit:** `ecc0e4f3fdc8274e43f233c7a0845cecb0335bf7`
**Remote:** `origin/codex/mx-missionaccounts-5301p-production`

## Outcome

MissionAccounts now has a real isolated application foundation rather than another design artifact:

- exact 5300A canon build with hash verification;
- private-browser-artifact handling so historical student data is not committed;
- server-authoritative billing-day, source-normalization, exam/grace/reminder, stale-approval, and charge-eligibility engines;
- additive PostgreSQL schema candidate with immutable source custody, versioned interpretations, append-only corrections/audit, RLS, sanitized payment metadata, Stripe event inbox, notification outbox, feature flags, and Zoom sync boundary;
- current StoryForge-family WordPress SSO boundary with an in-memory browser token, product-isolated HS256 issuer/audience/secret, strict signed eligibility and one-role enforcement, expiry/activation checks, algorithm-confusion defense, and retained RS256/JWKS verification only when an HS256 product secret is not configured;
- a default-off, exact-user-allowlisted WordPress SSO candidate plus a separately default-off, targetless, bounded same-origin gateway candidate; neither is installed in production;
- a tracked scrubbed production shell that preserves the Founder-approved visual canon without embedding the 271-student/3,941-event historical payload or using browser local storage for business state;
- mounted `/missionaccounts/api/*` support, a safe public runtime configuration endpoint, and authenticated role-scoped UI bootstraps that expose only the student’s own account to student sessions while reserving roster, cycles, identity clusters, and operational health for Dr J/admin/founder sessions;
- a canonical authenticated read adapter that paginates PostgREST reads, projects immutable attendance evidence, keeps both same-day class events while deriving one $25 day, omits Zoom meeting references from student scope, and hydrates the approved UI only from server-authoritative UUID-mapped records;
- a production action bus for the currently backed billing-decision, cycle-policy, comp-day, exam-plan/result, and append-only attendance-correction controls; each accepted action refetches the complete authorized bootstrap before rerendering, and unsupported production controls fail visibly without optimistic browser state;
- an isolated Docker/Railway package whose copy allowlist excludes the private Founder preview, source manifest, historical import, and environment files; production startup fails closed without both explicit database target variables;
- Stripe Test-Mode-only SetupIntent and one-day PaymentIntent adapters, exact raw-body webhook verification, retry-safe provider-inbox deduplication, secret-rotation signature support, and stable idempotency keys;
- feature-gated student exam-plan submission with authenticated self-resolution, a transactional/idempotent PostgreSQL RPC, immutable transition and audit rows, prior-plan supersession, and notification outbox insertion;
- feature-gated Dr J/admin comp-day override with mandatory reason, idempotent PostgreSQL transaction, joined-date custody, prospective lock preservation by default, explicit retroactive-release handling, and append-only change/audit evidence;
- auditable Matrix-account linkage with a unique no-relink contract, private Matrix reference handling, idempotent change custody, and exact post-2026-09-05 five-comp-day defaulting while established historical students remain at zero;
- explicit Dr J historical-ceiling adjudication that can verify or reject only preserved candidates, writes a superseding exact-$300 row, stales unsent approvals, voids only draft/ready invoices, and leaves all 74 source candidates unresolved until a human decision;
- feature-gated Dr J/admin exam decisions with the canonical transition matrix, exact local-date grace opening/closure, third-Wednesday reminder scheduling/cancellation, student notification outbox entries, idempotent retries, and preserved audit rows for rejected transitions;
- exam-plan replacement now closes any prior open grace window on the server-supplied Eastern local date, cancels the prior reminder, recomputes attendance when grace changed, and remains idempotent even when replacement happens before the old exam date;
- Dr J/admin exam entry and date editing now use the same server-authoritative submission transaction as student plans, preserve actor role and suggested replacement dates, route the resulting notice to the correct audience, and reject forged direct-RPC roles;
- student exam-plan withdrawal is ownership-checked, idempotent, audit-preserving, closes grace without rebilling protected days, cancels pending reminders before delivery, retains the withdrawn plan as history, and removes it only from the active-plan projection;
- accepted transitions across superseded and withdrawn plans now hydrate the canon's complete exam history with actor, action, date, result, and note context while rejected attempts remain in the immutable server audit rather than the student-facing timeline;
- a versioned 13–15-day cycle-policy gate (`cap`, `per`, or reopened `pending`) that is admin-only, reason-required, idempotent, audited, RLS-protected, reflected in approval basis, and stales/voids only affected-cycle unsent decisions/invoices;
- feature-gated billing approval that derives totals only from current server-side attendance days, rejects unresolved identities and historical cap candidates, enforces verified ceilings, supersedes old decisions, and creates only unsent draft invoices;
- feature-gated append-only attendance corrections that preserve source rows, support reversible add/remove and step interpretation, stale affected approvals, and void only unsent stale invoices;
- a transactional attendance recomputation authority that versions persisted day rows after attendance corrections, comp changes, and accepted exam/grace transitions; stales prior approvals and voids only draft/ready invoices before any re-approval can occur;
- strictly append-only correction reversals: a new correction references the prior record, the prior evidence row remains immutable, and both the JavaScript engine and PostgreSQL authority derive the effective chain without destructive edits;
- versioned automatic-billing terms and student-only consent/revocation transactions that require an approved terms version plus an on-file payment method, preserve superseded consent history, audit accepted/rejected attempts, and remain feature-off;
- secure Stripe payment setup with one stable private customer binding, Test-Mode-only SetupIntent creation, exact signed-event binding, sanitized card metadata, idempotent webhook completion, and no MissionMed raw-card fields;
- student-owned, two-phase payment-method removal that revokes automatic-billing consent before Stripe detachment, blocks new charges while removal is pending, restores the method with consent still revoked after provider failure, deduplicates retries, and never exposes the private Stripe method reference to the browser;
- server-authoritative $25 attendance-day charge preparation that requires a current approved basis, verified identity, billable day, on-file method, active consent, remaining approved amount, explicit failed-charge retries, and a unique charge per day; only a matching signed Stripe PaymentIntent webhook can mark it succeeded or failed;
- student-owned Passed submission that resolves the current plan from the authenticated identity and is independently ownership-checked inside PostgreSQL;
- role-protected, server-derived admin home, cycle, student-directory, and student-detail projections;
- retry-safe notification outbox claiming/acknowledgement with `SKIP LOCKED`, bounded batches, a five-attempt ceiling, exponential delay, provider idempotency, separate worker authentication, and a disabled-by-default HTTPS provider adapter;
- immutable student-contact custody plus an independently default-off admin endpoint that validates email/phone changes, requires a reason, audits each change, and demotes unsent ready invoices when their recipient email is removed;
- server-authoritative invoice readiness with admin-only idempotent transitions, current-approved-decision/basis/amount/email checks, immutable audit evidence, and protection against modifying sent/paid/void invoices;
- production action-bus wiring for contact and invoice-readiness decisions, with accepted mutations followed by a complete authenticated refetch; the canonical adapter now translates persisted one-charge-per-calendar-day decision bases into the exact Founder UI basis shape without falsely marking every hydrated approval stale;
- a complete third-Wednesday reminder dispatch loop: due reminders are selected in bounded `SKIP LOCKED` batches, linked one-to-one to retry-safe outbox entries, routed with an explicit student/admin audience, suppressed when cancelled, marked sent only after provider acknowledgement, and left untouched when transport configuration is absent;
- custody-verified historical importer that checks the authoritative ledger, identity graph, source manifest, and raw Zoom file hashes before creating a private mode-0600 SQL bundle; imports are idempotently keyed, transactional, fully control-counted, and keep all financial and product feature flags off;
- persisted identity-review topology reconstructed from the authoritative graph as 27 open clusters covering 60 review-held student identities, with a role-protected server projection for the administrative review queue and no automatic merge decisions;
- local HTTP application route and health/session/admin boundaries;
- all 17 ticket-mandated vectors represented in the automated suite.

No production system or provider was changed.

## Canon and source custody

- 5300A canonical prototype SHA-256: `3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8` — PASS.
- 5000B reconciled ledger SHA-256: `6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108` — PASS.
- 5000B identity graph SHA-256: `c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee` — PASS.
- Zoom source manifest SHA-256: `5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60` — PASS; recorded as its own immutable source artifact before the three manifest-pinned CSVs.
- The generated 831,032-byte UI artifact is gitignored because the canon embeds historical student information.
- The committed source-validation receipt contains only hashes and aggregate controls, never names, aliases, meeting IDs, or emails.

## Historical controls

| Control | Result |
|---|---:|
| Preserved attendance events | 3,941 |
| Preserved Zoom meeting instances / confirmed Drills sessions | 419 / 100 |
| Preserved raw Zoom attendance rows | 5,498 |
| Reconciled identities / identity-review holds | 271 / 60 |
| Open identity-review clusters / members | 27 / 60 |
| Exact-linked events / unlinked events | 3,937 / 4 |
| Human-cycle rows | 498 |
| Cycle 1 events / unique days / reduction / amount | 1,295 / 1,072 / 223 / $25,425 |
| Cycle 2 events / unique days / reduction / amount | 1,390 / 1,141 / 249 / $26,575 |
| Cycle 3 events / unique days / reduction / amount | 1,256 / 1,051 / 205 / $25,075 |
| Unique-day total before adjudicated historical caps | $77,075 |
| Historical `16+ / $300` source-tier candidates / verified | 74 / 0 |

The $77,075 control is an estimate oracle, not a collectible total. All 74 human-cycle rows carrying the historical `16+ / $300` tier are preserved as review-only candidates; none is automatically verified. The earlier count of 23 described only the narrower subset whose recalculated unique-day amount could rise above its source amount, not the complete candidate population. The implementation never invents cap eligibility.

## Exact files changed

All implementation files are under `missionaccounts/`:

- `.gitignore`, `README.md`, `package.json`
- `scripts/materialize-canon.mjs`
- `scripts/validate-source.mjs`
- `scripts/build-historical-import.mjs`
- `scripts/test-postgres-migration.sh`
- `scripts/test-historical-import.sh`
- `public/missionaccounts-runtime.js`
- `public/missionaccounts-canonical-adapter.js`
- `public/missionaccounts-auth.js`
- `public/index.production.html`
- `Dockerfile`, `.dockerignore`, `railway.json`
- `wordpress/missionmed-missionaccounts-sso/missionmed-missionaccounts-sso.php`
- `wordpress/missionmed-missionaccounts-sso/assets/matrix-launch.js`
- `infra/wordpress/missionmed-missionaccounts-route.php`
- `src/server.mjs`
- `src/http/body.mjs`
- `src/security/auth.mjs`
- `src/storage/supabase-rest.mjs`
- `src/payments/stripe.mjs`
- `src/notifications/notification-gateway.mjs`
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
- `tests/notification-gateway.test.mjs`
- `tests/auth.test.mjs`
- `tests/runtime-security.test.mjs`
- `tests/canonical-adapter.test.mjs`
- `evidence/source-validation.json`

## Migration status

- Created: `missionaccounts/supabase/migrations/20260906062212_missionaccounts_initial_schema.sql` (3,805 lines).
- Applied locally: PASS in a disposable PostgreSQL 16 cluster; schema parse/application plus billing authority, append-only correction/reversal flow, mutation-triggered attendance recomputation, exam entry/edit/suggested-date/withdrawal/history custody, grace/reminder effects, contact custody, invoice readiness, due-reminder enqueue/cancellation/sent-state linkage, comp-override controls, Stripe SetupIntent completion, and billing-consent authorization/revocation passed. No persistent local database was created.
- Historical import rehearsal: PASS in a separate disposable PostgreSQL 16 cluster. It imported 419 sessions, 5,498 raw source rows, 3,941 reconciled events, and 3,264 attendance days; retained 74 ceiling candidates and 60 identity-review holds; and created zero billing decisions, invoices, charges, verified ceilings, Matrix identities, or enabled flags. The private SQL bundle was deleted with the disposable cluster.
- Applied to staging/production: NO — target database and migration authority are not registered.
- Schema is additive and all capability flags seed disabled.

## Verification

- `npm test`: PASS — 106/106, including V01–V17 plus product-scoped SSO signature/claim/role enforcement, paginated role-scoped canonical reads, same-day evidence preservation with one-day pricing, private Zoom-reference boundaries, authenticated production hydration, persisted-basis normalization, refresh-after-save contact/readiness action routing, student/admin UI-bootstrap isolation, private-preview exclusion from production packaging, default-off WordPress bridge/gateway contracts, raw-body webhook, rotated-signature, duplicate-delivery, API-version, authorization, feature gates, account linkage/default comp, historical-ceiling adjudication, billing approval/cap custody, audited 13–15-day cycle policy, append-only correction reversals, persisted attendance recomputation, admin exam entry/edit and suggested dates, idempotent student withdrawal, accepted exam-history hydration, exam-plan replacement/grace closure, exam/grace/reminder effects, exactly-once third-Wednesday dispatch, cancellation-before-provider, transport-disabled fail-closed behavior, student and admin Passed ownership, comp overrides, admin/identity projections, payment setup/removal, consent/revocation, signed one-charge-per-day dispatch, and notification-worker retry controls.
- `npm run test:postgres`: PASS — complete migration applied to disposable PostgreSQL 16; unresolved cap approval was rejected, verified cap produced $300, correction staled approval and voided its draft, an immutable appended reversal restored attendance, comp/correction/grace mutations regenerated current day rows before re-approval, contact removal demoted ready invoices, invoice readiness enforced current truth, student Passed ownership was enforced, third-Wednesday reminders stayed dormant before their due date, enqueued exactly once when due, routed to the student, became sent only after acknowledgement, and cancelled before delivery when a result was recorded; Stripe payment metadata was bound only through a signed SetupIntent event, consent required both approved terms and an on-file method, payment removal revoked consent before two-phase provider completion, parallel day-charge dispatch was rejected, and only the bound signed PaymentIntent webhook marked the unique $25 charge succeeded.
- `npm run test:historical-import`: PASS — all custody hashes, privacy permissions, source/control totals, per-cycle totals, review holds, and zero-financial-mutation boundaries passed in disposable PostgreSQL 16.
- `npm run validate:source`: PASS — all aggregate historical controls above.
- `npm run build:canon`: PASS — exact approved SHA verified and UI materialized.
- Node syntax checks across source/scripts/public/tests: PASS.
- `git diff --check`: PASS.
- Local Docker image build: NOT RUN — the Docker CLI is present but its OrbStack daemon is stopped. Static packaging tests prove the private preview is outside the image copy allowlist; the image itself still requires a daemon-backed build before release.
- Local API:
  - `/api/health`: 200; route, auto-billing, and Zoom flags false.
  - student `/api/session`: 200.
  - student mounted `/missionaccounts/api/ui/bootstrap`: 200 with own-account scope and no admin-only fields.
  - admin mounted `/missionaccounts/api/ui/bootstrap`: 200 with server-derived admin projections.
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
- Local preview: `http://127.0.0.1:4179/missionaccounts/?replay=1` — restored and visibly rendering in Chrome on 2026-09-06; the obsolete port 4178 is not the current preview.

## Zoom integration status

The provider boundary exists and fails closed as `not_connected`. No Zoom credential, API call, scheduled sync, or production exception queue was activated. Full ingestion remains behind `zoom_sync=false`.

## Blocking evidence

1. `MX-MISSIONACCOUNTS-5301P` is absent from current `missions.json`, `products_index.json`, `authority_index.json`, `CURRENT.md`, and the boot mission profiles.
2. Mission-specific boot validation fails as unknown mission.
3. The protected Matrix runtime preflight produced the mandated stale-source warning and found production-origin hash drift for the shell, CSS, PHP loader, Calendar, and StoryForge assets.
4. No MissionAccounts Railway/PostgreSQL/Stripe/notification production target identity is registered.
5. Historical full-cycle eligibility evidence is incomplete; source tier labels are candidates, not authorization to collect.
6. No verified Matrix notification transport endpoint/credential is registered; the outbox provider remains disabled.
7. Final automatic-billing terms and live-charge activation remain unapproved.

Because of those facts, protected Matrix edits, production database application, live Stripe work, production historical import, production deployment, and production smoke tests were not performed. The historical import was rehearsed only in an automatically deleted local PostgreSQL cluster.

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
