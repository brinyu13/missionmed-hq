# MX-MISSIONACCOUNTS-5301P Production Completion

**Result:** PARTIAL — isolated production foundation complete; protected Matrix and provider activation blocked by authority/runtime gates
**Date:** 2026-09-06
**Branch:** `codex/mx-missionaccounts-5301p-production`
**Latest implementation commit:** `f65e8bbcfedbf00715fe992fbd2a6f7faec0032d`
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
- a corrected production authentication gate that is actually injected at the canonical attributed `<body>` seam, hides only after an authenticated role-scoped bootstrap, and remains opaque with the real access failure when authentication cannot complete;
- production-only truthfulness hardening that replaces inherited prototype labels, hides browser-reset/export affordances, blocks simulated reset behavior, replaces simulated attendance reporting with an authenticated server-backed review path, and replaces the simulated card/authorization path with authenticated server-backed payment controls while preserving the approved visual hierarchy and admin/student lens;
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
- a Stripe-hosted Payment Element browser flow using current `confirmSetup` semantics, explicit future-use consent, a Test-Mode-only public-key gate, narrowly allowlisted Stripe CSP origins, no raw card inputs, and signed-webhook-authoritative on-file status; administrators cannot enter a student's payment method;
- a separate student-only automatic-billing authorization dialog that renders the approved server terms version, records the explicit one-$25-day consent through the idempotent server transaction, and supports independent revocation without deleting history;
- direct authenticated student deep links are captured before the scrubbed shell's empty render and restored only after role-scoped hydration; students with no attendance receive a safe Billing empty state instead of a renderer failure;
- student-owned attendance issue reporting that self-binds the authenticated student, validates bounded report and route context, deduplicates retries, writes a private open-review record plus immutable audit event, queues one Matrix-admin notification, and never edits attendance or billing; the production dialog now closes after success and cannot reopen during the authoritative refetch;
- an admin/founder-only attendance-report queue with separate open work and review history, immutable student submission fields, idempotent resolve/dismiss decisions, mandatory response notes, one student notification, and explicit proof that review does not mutate source attendance, interpreted attendance, billing decisions, invoices, or charges;
- student-owned, two-phase payment-method removal that revokes automatic-billing consent before Stripe detachment, blocks new charges while removal is pending, restores the method with consent still revoked after provider failure, deduplicates retries, and never exposes the private Stripe method reference to the browser;
- server-authoritative $25 attendance-day charge preparation that requires a current approved basis, verified identity, billable day, on-file method, active consent, remaining approved amount, explicit failed-charge retries, and a unique charge per day; only a matching signed Stripe PaymentIntent webhook can mark it succeeded or failed;
- a bounded 24–48-hour automatic-charge worker that asserts Stripe Test Mode before any database claim, atomically reserves eligible days with `SKIP LOCKED`, safely reclaims stale pre-provider work with the same Stripe idempotency key, records missed windows and provider failures in a private integration-exception queue, notifies student and admin on submission failure, and never automatically retries a failed charge;
- a fail-closed charge-receipt invariant: every manual or automatic day charge requires a normalized verified student email, passes it to Stripe as `receipt_email`, records an actionable private exception when an automatic dispatch lacks it, and is backed by a database trigger so a direct pending-charge insert cannot bypass the requirement;
- a default-off Zoom source-ingestion port with an injected provider boundary, worker-authenticated bounded-window endpoint, normalized meeting/participant evidence, digest-bound idempotent persistence, successful/failed sync custody, and private integration exceptions; it creates no identity decisions, attendance interpretations, billing decisions, or charges;
- an admin-only Zoom health surface backed by sanitized server bootstrap state: feature/provider readiness, latest successful/failed run, persisted session/source-row controls, scheduler truth, and integration-exception count; student payloads receive none of this telemetry;
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
- `public/missionaccounts-stripe.js`
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
- `supabase/migrations/20260906095512_automatic_charge_dispatch.sql`
- `supabase/migrations/20260906100746_zoom_ingestion_port.sql`
- `supabase/migrations/20260906105212_student_attendance_issue_report.sql`
- `supabase/migrations/20260906110611_attendance_issue_review_resolution.sql`
- `supabase/migrations/20260906112331_require_receipt_email_for_day_charges.sql`
- `tests/billing-engine.test.mjs`
- `tests/exam-engine.test.mjs`
- `tests/mandatory-vectors.test.mjs`
- `tests/stripe.test.mjs`
- `tests/server.test.mjs`
- `tests/zoom-provider.test.mjs`
- `tests/notification-gateway.test.mjs`
- `tests/auth.test.mjs`
- `tests/runtime-security.test.mjs`
- `tests/canonical-adapter.test.mjs`
- `evidence/source-validation.json`

## Migration status

- Created: `missionaccounts/supabase/migrations/20260906062212_missionaccounts_initial_schema.sql` (3,813 lines) plus additive `20260906095512_automatic_charge_dispatch.sql`, `20260906100746_zoom_ingestion_port.sql`, `20260906105212_student_attendance_issue_report.sql`, `20260906110611_attendance_issue_review_resolution.sql`, and `20260906112331_require_receipt_email_for_day_charges.sql`.
- Applied locally: PASS in a disposable PostgreSQL 16 cluster; all six migrations applied in order. The charge RPC rejected a missing receipt address before financial mutation, returned the normalized verified address after contact restoration, and the pending-charge trigger enforced the same invariant below the application layer. The automatic worker carried the address through its claim without exposing it to the browser. The Zoom RPC persisted one normalized session and participant source row idempotently, recorded a failed-sync exception, and created zero attendance events, identity decisions, or charges. The attendance-report RPC persisted one student-owned issue, one audit event, and one admin notification while suppressing a retry and rejecting a mismatched student identity. The review RPC resolved it once, suppressed the retry, inserted one review audit and one student notification, rejected student review authority, preserved immutable submission fields, and left attendance/billing counts unchanged. No persistent local database was created.
- Historical import rehearsal: PASS in a separate disposable PostgreSQL 16 cluster. It imported 419 sessions, 5,498 raw source rows, 3,941 reconciled events, and 3,264 attendance days; retained 74 ceiling candidates and 60 identity-review holds; and created zero billing decisions, invoices, charges, verified ceilings, Matrix identities, or enabled flags. The private SQL bundle was deleted with the disposable cluster.
- Applied to staging/production: NO — target database and migration authority are not registered.
- Schema is additive and all capability flags seed disabled.

## Verification

- `npm test`: PASS — 131/131, including all prior vectors plus Stripe receipt-email validation/normalization, worker/manual charge propagation, the database receipt invariant, Test-Mode-only Stripe browser configuration, Payment Element confirmation semantics, explicit future-use consent, raw-card-field exclusion, exact Stripe CSP allowlists, authenticated student deep-link hydration, self-bound attendance-report submission, and admin-only attendance-report review.
- `npm run test:postgres`: PASS — all six migrations applied in order to disposable PostgreSQL 16, including the receipt-email rejection/normalization/trigger controls, idempotent source-only Zoom ingestion and failed-sync exception custody with zero downstream identity, attendance, billing, or charge mutations, private attendance-issue custody, duplicate suppression, audit/outbox insertion, cross-student rejection, immutable submission fields, and admin-only idempotent review.
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
  - once-per-tab opening skip and explicit `#/...?...replay=1` replay: PASS.
  - Admin command home: PASS.
  - dark theme: PASS.
  - student lens and same-day one-$25-day labels: PASS.
  - authenticated production gate release / failed-auth opaque gate: PASS.
  - Zoom health disconnected and seeded-success states: PASS; no hard-coded connectivity claim.
  - 390 px viewport: PASS; document and main `scrollWidth` equal the 390 px viewport.
  - Secure payment setup: PASS with deterministic Stripe.js/API test doubles; Payment Element mounted, `confirmSetup` completed, zero MissionMed card fields rendered, and the UI remained pending until signed webhook truth.
  - Student automatic-billing authorization: PASS; approved terms version posted only after explicit checkbox consent.
  - Payment-method removal: PASS; authenticated DELETE issued only after the destructive-action confirmation.
  - Direct `#/me/billing` production deep link: PASS before and after authoritative refetch; empty student records no longer fail hydration.
  - Attendance issue reporting: PASS at desktop and 390 px; authenticated POST succeeded, the dialog closed, the `?report=1` intent normalized to `#/me` before refetch, the confirmation toast remained visible, and `scrollWidth` equaled `clientWidth` at 390 px. The QA server used only its in-memory notification outbox; no external provider was called.
  - Attendance report admin queue: PASS at 1440 px; one local student report appeared under Open reports, Dr J resolved it with a mandatory response, the same page refetched to zero open items, and the record appeared under a separate Review history. Student queue/review access returned 403, and no external provider was called.

Local browser evidence (gitignored because repository policy excludes PNGs):

- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_zoom-health-admin.png` — SHA-256 `90d7e20d167a8e5bc4b168b78c55c8712a86ea3a5476f90519888eed978eaa8f`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_zoom-health-mobile-playwright.png` — SHA-256 `60656ce16960cafcea4ccc2a46376b32fc2be06faa59894f7c219f77fc8521ae`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_zoom-health-success-dark.png` — SHA-256 `82593645cd6beea3fdf3a1cc6e35c05a5722e1c6e7fa62c268eebe21f865a530`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_auth-failure-gate.png` — SHA-256 `123b0917f04a6be9602e7ae3f4cdbde06dc2ab53078e134a2097be437d588130`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_stripe-payment-element-test-mode.png` — SHA-256 `bfdf257c06e968eabc0bb5e6c4a9b7a0da83282620cb5cbf500a6d1e7148f640`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_billing-authorization-mobile.png` — SHA-256 `90139e71a6e7017eae42c899cc252522986c2694affdf0bf071f085e7bd6e0fd`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_attendance-issue-report-mobile.png` — SHA-256 `3edebb178a115e5479717d10a6b12b72a6611a4b82beacd4d54a9aebb7c26da4`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_attendance-issue-report-success-mobile.png` — SHA-256 `e338ef83a19fdf0bf4a90f9905eddb5d7cf054ddce09be9898c0d6ef2a7b26fd`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_attendance-issue-admin-queue.png` — SHA-256 `e4205683d3526b2897e2f4cda38600abb65c3ddfcdd199c434c87ab049107975`.
- `missionaccounts/evidence/screenshots/MX-MISSIONACCOUNTS-5301P_attendance-issue-admin-resolved.png` — SHA-256 `265022bd822a33737eb738762ff10b6e1194ee5f714ccd3db52bb31a8c4baf7d`.

## Production services touched

None. No Railway project/service, PostgreSQL database, Supabase project, Kinsta/WordPress file, Cloudflare object, Matrix runtime asset, Stripe object, webhook, customer, PaymentMethod, PaymentIntent, invoice, email, notification, Zoom setting, Zoom report, or production student row was created or changed.

## Environment/config changes

None outside the isolated worktree. Local preview used `PORT=4179`, `MISSIONACCOUNTS_AUTH_MODE=local`, and—only for attendance-report QA—`MISSIONACCOUNTS_ATTENDANCE_CORRECTIONS=1`; local auth fails closed under `NODE_ENV=production`, and the production feature flag remains off. The candidate recognizes `MISSIONACCOUNTS_STRIPE_PUBLISHABLE_KEY` only when automatic billing is enabled, `MISSIONACCOUNTS_STRIPE_MODE=test`, and the value is a `pk_test_` key; otherwise public setup configuration remains disabled and no key is returned. Stripe requests use the account-default API version unless a provider-verified value is explicitly supplied through `MISSIONACCOUNTS_STRIPE_API_VERSION`; no fabricated future version is sent.

## Matrix route registration and production URL

- Matrix route registered: NO.
- Production URL: expected `/missionaccounts/`, currently not activated.
- Local preview: `http://127.0.0.1:4179/missionaccounts/#/home?replay=1` — restored and rendering on 2026-09-06; the obsolete port 4178 is not the current preview.

## Zoom integration status

The provider port, source-only persistence boundary, and admin-only dynamic health surface are implemented and fail closed while disconnected. The UI says the scheduler is not registered and never infers connectivity from a feature flag alone. No Zoom credential, concrete client, API call, schedule, setting change, or production exception queue was activated. Full ingestion remains behind `zoom_sync=false`; any future activation still requires an authorized provider client and registered production target.

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
