# MX-MISSIONACCOUNTS-5401R — Live Reopening and Stripe Activation Report

Updated 2026-09-09 at 15:27 UTC / 11:27 EDT. This is a standalone status and continuation handoff for the orchestrating ChatGPT thread. It records production evidence from the current run. It is not an independent MX-MISSIONACCOUNTS-5402A certification.

## Executive verdict

| Gate | Current status |
|---|---|
| MissionAccounts engineering | **DEPLOYED / STARTUP PRIVACY REGRESSION REPAIRED** |
| Matrix public route | **OPEN / no-store / Kinsta bypass** |
| Kinsta private cache exclusion | **PROVIDER CONFIRMED / LIVE PROBES PASS** |
| Cross-principal cache matrix | **PRIOR FULL SEQUENCE PASS / FINAL POST-FIX REPLAY PENDING** |
| Real Founder | **PASS** |
| Real Dr J | **PASS** |
| Real Student A | **PASS** |
| Real Student B | **PASS** |
| Stripe LIVE account | **VERIFIED / PAYMENTS ACTIVE / EXTERNAL BANK ACCOUNT TASK PAST DUE** |
| Dedicated LIVE restricted key | **BOUND / AUTHENTICATED** |
| Dedicated LIVE webhook | **PASS / ENABLED / EXACT TEN EVENTS** |
| LIVE payment-method setup | **PASS / REPLACEMENT LIVE METHOD ON FILE** |
| Dr J manual Stripe collection | **PASS — EXACT 3×$1 LIVE MISSIONACCOUNTS CANARY SUCCEEDED** |
| In-app one-student charge | **PASS — EXPLICIT APPROVED-BALANCE WORKFLOW LIVE; CONFIRMATION REQUIRED** |
| Broad automatic billing | **OFF** |
| Hosted invoices | **OFF** |
| Zoom / notifications | **PAUSED / OFF** |
| Live money moved | **YES — $3.00 AUTHORIZED IN-APP CANARY; PRIOR SEPARATE $1.00 DASHBOARD PAYMENT EXCLUDED** |
| Six persisted workflows | **PENDING** |
| Responsive acceptance | **PENDING** |
| Independent 5402A | **PENDING** |

MissionAccounts previously passed the real browser privacy sequence using the same canonical route in this order: anonymous, Founder, genuine Dr J, genuine Student A, logout to anonymous, genuine Student B, and Founder again. A later repeat-visit test exposed the default Dr J shell briefly before Antonio's authenticated bootstrap completed. The route was immediately re-contained, the reveal path was repaired and deployed, and the exact Antonio repeat-visit path now shows only the guarded opening state followed by Antonio's student-only billing view. The route is open with live no-store/cache-bypass probes passing. The full principal sequence should be replayed once more on the repaired build before final P0 closure.

Genuine student Antonio Patterson completed the LIVE Stripe Payment Element. The original method involved in the accessibility incident was locked and removed end to end. Antonio then saved a replacement LIVE Visa ending `7734` in Chrome and closed the hosted panel before automated inspection. The signed replacement `setup_intent.succeeded` webhook was received and processed; MissionAccounts stores only Stripe references and masked metadata. Founder authorization promoted Antonio's existing verified Matrix-linked record from unresolved device evidence to a real student while preserving attendance and payment custody.

The genuine Dr J workflow then set June, July, and August to exact approved custom balances of $1.00 and used the new in-app **Charge $1** confirmation flow. Exactly three MissionAccounts-originated LIVE PaymentIntents succeeded in the Founder-confirmed ExamPrep Stripe account, one per cycle. All three signed `payment_intent.succeeded` webhooks were processed, all three MissionAccounts invoices became paid, and all three started/succeeded audit pairs are present. Automatic billing, scheduled charging, hosted invoices, Zoom, and notifications remain off. The earlier manually created Dashboard PaymentIntent remains classified as ignored external/unowned evidence and is excluded from this three-charge authorization.
## Exact source and deployment identity

- Product worktree: `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R`
- Branch: `codex/mx-missionaccounts-5401r`
- Current pushed implementation HEAD: `0c4994f3ade9286954931a416b6d5e8a0a2db328`
- Authority repository pushed HEAD: `46a977704bcd5615f397ffb9357a82fca57021a8`
- Railway project: `244bf2d1-1eca-4b97-95ab-95a565a8b4d0`
- Railway production service: `857cdc07-2482-4cc0-a2a1-70b38f65542b`
- Railway direct origin: `https://missionaccounts-production-production.up.railway.app`
- Current successful production deployment: `2d882de5-771f-473a-843d-0b886070cf06`
- Railway root directory: `missionaccounts`
- Resume binding SHA-256: `d5b77640c2deaec0656dfcef89aed89f3ecefaec889d482bbc309fab6694d4e1`

Pushed implementation commits:

- `1a5cae4cf8f99f9f44db782998e329b615720a2a` — deployed access, route, storage, and launch repairs.
- `c72fbcf85fa317b0e38d46771e3092dcf1730423` — removed generic WordPress-admin access.
- `a8d3903579cf6ca16d88ed15e74a4c67026eb508` — enabled and forced service-table RLS.
- `e65a6be0bbbaed96db195a5da1687a83eed353d8` — separated payment-method setup from automatic billing.
- `9c050449d37bae193e451e36e2713c987fa03b42` — added the verified-account Dr J Stripe Customer link.
- `b51146c46d1e3dfd8870c39c021f5e036ed3ed2b` — kept the browser token exchange on the cache-excluded, nonce-protected admin AJAX action.
- `1b4ce5ff` — kept the student shell visible after authoritative student bootstrap.
- `8aaaa5fd893363917926b60f3840bc56d89bf12e` — kept every role shell hidden until authenticated role bootstrap authoritatively selects the correct lens.
- `f9b1ebfa2192b444f6fb21b26e87bdce187e1beb` — aligned five student-write authorization guards with the authenticated verified-student identity used by the server.
- `b36c1c544244fd46e1d9811282e996add356331f` — added the Founder-authorized, custody-preserving Antonio person-promotion migration and mandatory vector.
- `8c5d0d86ae95b14705cc069b268dba3052701291` — disambiguated the PL/pgSQL promotion variable after the first rollback-only provider rehearsal found a name collision.
- `0c4994f3ade9286954931a416b6d5e8a0a2db328` — added the explicit, server-authoritative LIVE manual cycle charge, signed-webhook finality, per-cycle idempotency, confirmation UI, private RLS table, and mandatory tests.

Validation at the current source:

- Full Node suite: **184/184 PASS**
- Focused mandatory-vector suite: **43/43 PASS**
- Focused runtime-security suite: **15/15 PASS** on the deployed client privacy repair
- Source validation: **PASS**
- PHP lint: **PASS**
- Git worktree and upstream: **clean / synchronized**

## Kinsta provider confirmation

Kinsta Support agent Gerson confirmed in writing that unconditional custom Nginx cache exclusions are installed for:

- `/missionaccounts*`
- `/wp-json/missionmed/v1/missionaccounts/token*`
- `/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap*`

The substantive provider confirmation states that the exclusions:

- apply across Kinsta origin/full-page/Nginx, Edge, and CDN;
- cover the bare root, trailing slash, every MissionAccounts descendant, the token route, the exact bootstrap action, and bootstrap query ordering;
- prevent both authenticated and denied responses on these routes from being cached;
- leave unrelated site caching unchanged.

Provider-enforced source-IP-only admission is unavailable across Edge/CDN and is not a release blocker.

**KINSTA SUPPORT: CONFIRMED**

**PRIVATE CACHE EXCLUSION: PROVIDER CONFIRMED**

## Contained cache probes

The route-open toggle was absent during these probes.

| Target | Method / status | X-Kinsta-Cache | CF-Cache-Status | Cache-Control | CDN-Cache-Control | Surrogate-Control | Vary |
|---|---|---|---|---|---|---|---|
| `/missionaccounts/` | GET `503` | `BYPASS` | `DYNAMIC` | `no-store, private` | `no-store` | `no-store` | `Authorization, Cookie` |
| `/missionaccounts/api/session` | GET `503` | `BYPASS` | `DYNAMIC` | `no-store, private` | `no-store` | `no-store` | `Authorization, Cookie` |
| REST token | POST `403` | header omitted on denied POST | `DYNAMIC` | `no-store, private` | `no-store` | `no-store` | `Accept-Encoding, Authorization, Cookie` |
| REST token | GET `404` | `BYPASS` | `DYNAMIC` | `no-store, private` | `no-store` | `no-store` | `Accept-Encoding, Authorization, Cookie, Origin` |
| Bootstrap AJAX | GET `401` | `BYPASS` | `DYNAMIC` | `no-cache, must-revalidate, max-age=0, no-store, private` | `no-store` | `no-store` | `Authorization, Cookie` |

No response returned `public`, `s-maxage`, a Kinsta `HIT`, a Cloudflare cache hit, or a shared private payload.

**CONTAINED CACHE PROBES: PASS**

## Real cross-principal Matrix acceptance

Every row used the canonical `https://missionmedinstitute.com/missionaccounts/` route in the same Chrome profile with explicit logout/account changes between principals. Cold and warm requests were exercised. Browser identity, rendered lens, server scope, payload size, prior-principal absence, and private no-store behavior were checked.

| Order | Principal | Browser result | Server/private result | Cross-principal result |
|---|---|---|---|---|
| 1 | Anonymous | Public shell only | Bootstrap denied `401`; no private payload | PASS |
| 2 | Founder | Admin lens, admin navigation, 203-person search, expected cycle totals | `role=founder`, `scope=admin`, 267 students, 100 sessions, six admin payload sections | PASS |
| 3 | Dr J | Genuine `kristinj` session; Billing and June Cycle screens loaded | `role=missionaccounts_admin`, `scope=admin`, 267 students, 100 sessions | PASS |
| 4 | Student A | Own dashboard and billing screen; no admin routes | `role=student`, `scope=student`, exactly one student, zero admin payload sections | PASS |
| 5 | Logout / anonymous | Account dashboard removed; login form returned | Bootstrap GET and POST denied `401` with no-store | PASS |
| 6 | Student B | Own dashboard and billing screen; no admin routes | `role=student`, `scope=student`, exactly one student, zero admin payload sections | PASS |
| 7 | Founder again | Returned to admin lens; no stale student lens; warm reload passed | `role=founder`, `scope=admin`, 267 students, 100 sessions, six admin payload sections | PASS |

Additional negative witness: a genuine WordPress member without a MissionAccounts product mapping or allowlist entry received “MissionAccounts is not enabled for this account.” No private data or admin controls rendered, and the route was re-contained immediately.

Student A did not receive Student B data. Student B did not receive Student A data anywhere in the DOM. Neither student received admin payload sections or admin routes. Logout did not retain the prior student’s account state. The final Founder session did not retain a student lens.

Open-route canonical probes, cold and warm, returned:

- status `200`;
- `X-Kinsta-Cache: BYPASS`;
- `CF-Cache-Status: DYNAMIC`;
- `Cache-Control: no-store, private`;
- `CDN-Cache-Control: no-store`;
- `Surrogate-Control: no-store`;
- `Vary: Accept-Encoding, Authorization, Cookie`.

**CROSS-PRINCIPAL CACHE MATRIX: PRIOR FULL SEQUENCE PASS; FINAL POST-FIX REPLAY PENDING**

**MATRIX ROUTE: OPEN**

## 2026-09-09 Kinsta/PHP incident and recovery

The 120-second `504 Gateway Time-out` was a site-wide dynamic WordPress/PHP incident, not a MissionAccounts-only reverse-proxy loop. Kinsta PHP-FPM had exhausted its four-worker limit. Railway remained healthy. Restarting PHP restored dynamic WordPress service. A short post-restart burst of upstream timeouts ended at 02:31:27 UTC; no later timeout was observed during the recovery run.

Containment was proven before reopening: repeated MissionAccounts external requests returned fast generic `503` responses with `X-Kinsta-Cache: BYPASS`, `CF-Cache-Status: DYNAMIC`, `Cache-Control: no-store, private`, `CDN-Cache-Control: no-store`, and `Surrogate-Control: no-store`. No private payload was returned.

After the startup-shell repair and deployment, repeated open-route probes returned `200` in approximately 0.8 to 1.2 seconds with the same non-shared cache controls. A fresh probe at 09:28 UTC returned:

- canonical route: `200`, 1.20 seconds, Kinsta `BYPASS`, Cloudflare `DYNAMIC`;
- gateway health: `200`, 0.97 seconds, Kinsta `BYPASS`, Cloudflare `DYNAMIC`;
- both: `no-store, private`, CDN `no-store`, surrogate `no-store`, `Vary: Accept-Encoding, Authorization, Cookie`.

**INCIDENT SCOPE: SITE-WIDE DYNAMIC WORDPRESS/PHP**

**ROOT CAUSE: PHP-FPM WORKER EXHAUSTION (`pm.max_children=4`)**

**504: RESOLVED**

**RAILWAY: HEALTHY**

**KINSTA/WP: HEALTHY**

**MISSIONACCOUNTS ROUTE: OPEN / CONTROLLED**

## Startup privacy regression repair

The deployed shell contained a default Dr J render. On a repeat visit, `sessionStorage` caused the opening experience to dismiss before authenticated bootstrap completed, removing `body.is-booting` and briefly exposing the default admin lens to Antonio. No prior student's payload was observed, but exposing admin presentation to a student was treated as a P0 privacy failure.

The repaired shell may reveal only when production runtime state is `authenticated-readonly`. The runtime sets that state only after a valid bootstrap exists, then calls the guarded reveal method. In Antonio's genuine browser session, the exact repeat-visit path showed only “Opening your authorized MissionAccounts workspace…” until bootstrap, followed by Antonio's student-only billing view. No Dr J controls, admin navigation, prior-principal data, or anonymous private payload appeared.

Deployed Railway artifact identity:

- shell SHA-256: `22492b1e197b969ecc673e526a5a4d5b0c45523196ae2db17f0d4e793224e4be`;
- runtime SHA-256: `d62d2dde3bff7faef6b6ee2428b265f781e436b86e3a4a98210db577b0ea802a`;
- Railway deployment: `4970df44-4156-4ff2-b2f1-1cba548886c9`, `SUCCESS`.

## Student-write identity guard repair

The first real payment-method removal attempt failed with `payment_method_removal_forbidden`. The server had already resolved Antonio from the verified `missionaccounts.student.id` carried in the authenticated bootstrap identity, but five database functions still compared that actor identifier to the legacy `matrix_user_ref` field. Production readback showed this was systemic across the 218 verified students: zero had `matrix_user_ref = id`; 153 had no legacy reference and 65 had a different reference.

The bounded migration changed only the five obsolete student self-write predicates while preserving the function bodies, `security invoker`, and service-role-only execution grants:

- `api_submit_exam_plan`
- `api_transition_exam_plan`
- `api_withdraw_exam_plan`
- `api_prepare_payment_method_removal`
- `api_submit_attendance_issue`

Source migration: `missionaccounts/supabase/migrations/20260909095640_align_student_write_identity_guards.sql`

Production migration record: `20260909100451`

Production verification passed for all five function definitions, obsolete guards were absent, the current removal guard was present, `anon` and `authenticated` remained denied, and `service_role` remained allowed. Supabase security and performance advisors returned no targeted finding for these functions. Antonio then completed the real Chrome removal flow successfully.

## Founder-authorized Antonio real-student promotion

Before repair, the single verified Matrix-linked Antonio record carried one active `relationship_state='device'` alias. The canonical adapter therefore rendered him only under **Unidentified attendees**, even though his Matrix identity, email, attendance, Stripe Customer, and replacement PaymentMethod were already present.

The bounded production migration:

- preserved the old device alias as superseded evidence;
- added one active verified person alias for the same student;
- created one `identity.student_promoted` audit event with the Founder authorization;
- did not change the student row, Matrix identity, attendance, Stripe Customer, PaymentMethod, billing consent, billing decisions, invoices, or charges.

Source migration: `missionaccounts/supabase/migrations/20260909105200_promote_antonio_real_student.sql`

Production migration: `promote_antonio_real_student`

Acceptance readback:

- exact target records: `1`;
- active verified promotion aliases: `1`;
- active device aliases: `0`;
- person projections: `1`;
- attendance days: `18`;
- payment status: `on_file`;
- approved billing decisions before canary: `0`;
- charge rows before canary: `0`.

The genuine Dr J directory changed from 203 people with Antonio under unresolved Zoom devices to 204 people with **Antonio Patterson** in the A-section. His profile shows the combined Zoom name, email, 12 June days, 5 July days, 1 August day, all three starting estimates, and the masked replacement method.

## Current deployed WordPress identity

| File | SHA-256 |
|---|---|
| `missionmed-missionaccounts-route.php` | `045088fb125635032c3f82ea78fbc08f8a9ca7830da1c6007959a02556eb3bbe` |
| active route-open toggle | `62e8870b4dc6395f910b28cc20e34b1ae73fee3c086e10abbfa0553d0bc60ff5` |
| `missionmed-missionaccounts-sso.php` | `af08b97a26b015cbc6858f5fc09411103d26dca15a177164150a0deeb655e0c6` |
| MissionAccounts `matrix-launch.js` | `82dc5874c46d90e31b4a1cd1d39483482a6360dc02cbfc40c42888d15be26df8` |

No shared Matrix source file was changed during the reopening matrix.

## Stripe LIVE provider state

Founder-confirmed account:

- business: `MissionMed Institute ExamPrep`
- account: `acct_1TWHdrPqYqVwqSi5`
- charges enabled: yes
- payouts enabled by current account API/status: yes
- provider account task: **Past due — provide an external bank account to continue using Stripe**

Dedicated restricted LIVE key:

- dashboard name: `MissionAccounts LIVE Production`
- non-secret key object ID: `mk_1UDUxXPqYqVwqSi5tp5FUtVt`
- masked suffix: `...dLgm`
- runtime key class: `rk_live`
- live `/v1/account` authentication after the final deployment: **PASS**
- returned account matches the exact configured account: **PASS**
- permissions: Account Read; Customers Write; Setup Intents Write; Payment Methods Write; Payment Intents Write; Invoices Write; Billable Items Write

The broad existing `sk_live` credential is not the MissionAccounts runtime key.

Dedicated LIVE webhook:

- endpoint ID: `we_1UDTYKPqYqVwqSi5SzGK5J3C`
- URL: `https://missionaccounts-production-production.up.railway.app/api/webhooks/stripe`
- status: **enabled**
- signature witness: **PASS**
- old WordPress commerce webhook secret was not reused

Exact event subscription:

- `setup_intent.succeeded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.finalized`
- `invoice.sent`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.overdue`
- `invoice.voided`
- `invoice.finalization_failed`

No Stripe provider credential or webhook secret entered chat, shell output, source, Git, reports, screenshots, or logs. The separate card-field accessibility incident is recorded below.

## Live runtime controls

The current Railway deployment `2d882de5-771f-473a-843d-0b886070cf06` runs the image built from source commit `0c4994f3ade9286954931a416b6d5e8a0a2db328` and has this verified state:

| Variable/control | State |
|---|---|
| Stripe account | exact confirmed production account |
| Stripe mode | `live` |
| restricted secret key | configured, `rk_live` |
| publishable key | configured, `pk_live` |
| dedicated webhook secret | configured |
| `MISSIONACCOUNTS_STRIPE_LIVE_MUTATIONS` | `1` |
| `MISSIONACCOUNTS_PAYMENT_METHOD_SETUP` | `1` |
| `MISSIONACCOUNTS_MANUAL_CHARGES` | `1` |
| `MISSIONACCOUNTS_AUTO_BILLING` | `0` |
| `MISSIONACCOUNTS_HOSTED_INVOICES` | `0` |
| `MISSIONACCOUNTS_ZOOM_SYNC` | `0` |
| `MISSIONACCOUNTS_NOTIFICATIONS` | `0` |

Runtime verification:

- `/api/health`: `200`, healthy, `no-store, private`, manual charges enabled, automatic billing disabled;
- `/api/config`: `200`, provider `stripe`, setup enabled, mode `live`, publishable key class `pk_live`, `no-store, private`;
- live Stripe account request: `200`, exact account match, charges and payouts enabled.

Broad automatic billing remains off. The only new charges are the three explicit $1.00 Antonio cycle canaries documented below; no automatic-billing consent or dispatch was created.

## Antonio 3×$1 LIVE MissionAccounts canary — PASS

ANTONIO TEST STUDENT: VERIFIED
LIVE STRIPE ACCOUNT: `acct_1TWHdrPqYqVwqSi5`
SAVED CARD LAST4: `•••• 7734`

### Custom balances

June: **$1.00**
July: **$1.00**
August: **$1.00**

JUNE LIVE CHARGE: **PASS**
JUNE PAYMENTINTENT: `pi_3UDnDSPqYqVwqSi52FAmthFX`
JUNE WEBHOOK: **PASS** — `evt_3UDnDSPqYqVwqSi52Q2zm80h`, signature verified, processed
JUNE PAID STATE: **PASS**

JULY LIVE CHARGE: **PASS**
JULY PAYMENTINTENT: `pi_3UDnFmPqYqVwqSi51S4wLH9G`
JULY WEBHOOK: **PASS** — `evt_3UDnFmPqYqVwqSi51k1U7OR1`, signature verified, processed
JULY PAID STATE: **PASS**

AUGUST LIVE CHARGE: **PASS**
AUGUST PAYMENTINTENT: `pi_3UDnIhPqYqVwqSi52ASROIKU`
AUGUST WEBHOOK: **PASS** — `evt_3UDnIhPqYqVwqSi52iRxB5ra`, signature verified, processed
AUGUST PAID STATE: **PASS**

TOTAL AUTHORIZED: **$3.00**
TOTAL ACTUALLY CHARGED: **$3.00 under this authorization**
SUCCESSFUL CHARGES: **3 / 3**
DUPLICATE CHARGES: **0**

BROAD AUTOMATIC BILLING: **OFF**
SCHEDULED AUTO-CHARGE: **OFF**
FOURTH CHARGE AUTHORIZED: **NO**

DR J CAN CHARGE FROM MISSIONACCOUNTS TODAY: **YES**
DR J CHARGE WORKFLOW: **PASS**
IDEMPOTENCY: **PASS**
AUDIT/HISTORY: **PASS**

Production database readback proves three rows, three distinct PaymentIntents, one row for each authorized cycle, a total of 300 cents, three paid invoices, three signed and processed success webhooks, three started audit events, and three succeeded audit events. The private manual-charge table has forced RLS and grants only the service role. There are zero MissionAccounts automatic day-charge rows for Antonio, zero active automatic dispatches globally, and zero manual-cycle charges for any other student. Stripe Dashboard independently showed **Succeeded**, $1.00, Antonio Patterson, the ExamPrep account, the expected card mask, and the exact MissionAccounts metadata for the canaries.

The prior manually created PaymentIntent `pi_3UDjQ8PqYqVwqSi505IVZ6ZH` remains a separate signed event in `ignored` state because it lacked MissionAccounts ownership metadata. It is not included in the $3.00 total above.

The in-app path now enforces: genuine Dr J role; linked verified student; current approved collectible decision; draft/ready matching invoice; current saved Stripe Customer and PaymentMethod; exact card-mask recheck; server-derived amount; explicit confirmation; stable decision-scoped idempotency; signed webhook finality; paid invoice persistence; and private audit history. A successful or pending cycle cannot be submitted as another active manual charge. Failed charges remain visible and require a new deliberate decision; no automatic retry path was enabled.

### Execution-governance note

The three custom-balance writes were made in the genuine Dr J browser under explicit Founder authorization and produced the expected server audit records, but they were submitted without a concurrently held Engineering OS coordination lease. Each live charge was initiated only after a scoped Lease V2 grant; those 30-second leases expired during the external Stripe/webhook readback, and the coordination database confirms zero active leases. This did not create a payment, privacy, or data-consistency anomaly, but it is a process variance for the independent 5402A reviewer to evaluate.

## Remaining work for full AAA and functional deployment

### 1. Final post-fix cross-principal replay — blocking P0 closure

Replay the canonical route with anonymous, Founder, genuine Dr J, genuine Student A, logout/anonymous, genuine Student B, and Founder again on source `0c4994f3`. The prior full sequence passed, the repaired Antonio repeat-visit path passed, and the current Dr J canary session remained private and role-correct. This final replay qualifies the exact deployed client across all principals.

### 2. Six persisted workflow acceptance — blocking

Complete genuine browser UI → API → database → reload → audit/undo evidence for contact update, attendance correction/reversal, billing decision/reversal, identity adjudication, exam-plan lifecycle, comp-day change, and the student-report/Dr J-review pair. Do not replace genuine sessions with synthetic or API-only tests.

### 3. Responsive and interaction acceptance — blocking

Repeat key role flows at approximately 1440px, 1024px, and 390px. Verify Matrix discovery, deep links, logout, keyboard use, focus, dialogs, overflow, errors, and recovery.

### 4. Matrix left-menu discoverability — P1

The missing MissionAccounts entry in the student Matrix left rail remains confirmed. Direct canonical navigation works. Repair the canonical StoryForge-family navigation seam and prove entitled students and Dr J see the entry while non-entitled users do not.

### 5. Stripe account status task — operational follow-up

Stripe shows a past-due **Provide an external account** task. The Founder must enter bank information directly in Stripe. Do not place bank information in chat, source, logs, screenshots, or automation. This does not invalidate the three succeeded card charges, but it affects payout readiness.

### 6. Independent audit — final AAA gate

Hand off the exact current source, production evidence, remaining browser matrix, responsive results, and this governance variance to independent `MX-MISSIONACCOUNTS-5402A`. This task does not self-certify AAA.

## No further money authorization

The exact three-charge authorization is exhausted. Do not perform a fourth LIVE charge, retry a successful cycle, charge another student, or enable automatic/scheduled/bulk charging without new explicit Founder authorization. The explicit Dr J per-student approved-balance button may remain enabled; broad automatic billing remains off.

## Rollback custody

- Recontainment source remains on Kinsta as `missionmed-missionaccounts-route-open.php.disabled-5401r`.
- Active route-open toggle is present and hash-verified.
- Current SSO preimage: `/www/theresidencyacademy_209/private/MX-MISSIONACCOUNTS-5401R-b51146c-sso-preimage.php`
- Earlier route preimage: `/www/theresidencyacademy_209/private/MX-MISSIONACCOUNTS-5401R-48e4283-route-preimage.php`
- Zoom/data repair receipt: `44f24da2-b69e-4a20-af39-ec9d87a393d0`

To recontain, remove only the active route-open toggle under an exact Lease V2 write set, then verify repeated `503`, `no-store, private`, Kinsta `BYPASS`, and Cloudflare `DYNAMIC` responses. Do not run `wp cache flush`; it segfaulted during this run. Do not restore the earlier unsafe route or delete applied migrations, raw Zoom evidence, or private audit history.
