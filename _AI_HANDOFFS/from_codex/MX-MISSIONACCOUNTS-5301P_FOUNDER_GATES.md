# MX-MISSIONACCOUNTS-5301P Founder Gates

**Prepared:** 2026-09-06

**Purpose:** smallest approval-ready path from the locally verified candidate to an isolated, zero-data, feature-off production deployment.

**Current production effect:** none.

## Decision summary

MissionAccounts can be deployed before Stripe, Zoom, notifications, historical adjudication, and the Matrix route are activated. It cannot be deployed truthfully yet because the mission is not registered and no isolated application/database targets are identified.

The intended first deployment is deliberately dormant:

- one new isolated MissionAccounts application service;
- one new isolated Supabase/PostgreSQL project compatible with the current PostgREST adapter;
- schema and RLS only;
- no historical data;
- no public Matrix route;
- no worker or schedule;
- all capability flags false;
- no Stripe, Zoom, notification, invoice, charge, refund, or student-account action.

The currently linked Railway target is **not eligible**. It is the shared `missionmed-hq-fix005` production project, service `ivprep-profile-b-worker`. No unscoped `railway up` may be run from this checkout.

## Gate register

| Gate | Class | Blocks app deployment? | Blocks capability | Exact human action | Work that can continue while waiting |
|---|---|---:|---|---|---|
| H1 — authority registration | Hard pre-deployment | YES | Any production deployment | Approve the exact nine-path MissionMed OS registration transaction below, from a fresh clean canonical checkout, with collision-free DR allocation | Local tests, review, and packaging only |
| H2 — isolated app target | Hard pre-deployment | YES | Application deployment | Create or designate one new MissionAccounts Railway project/service and provide its immutable project/service/environment IDs and region/domain decision | Container remains deploy-ready locally |
| H3 — isolated database target | Hard pre-deployment | YES | Schema/RLS and application startup | Create or designate one isolated Supabase project and provide its immutable project ref/API URL through the approved secret channel; authorize schema-only migration | Migration remains rehearsed locally |
| H4 — dormant release approval | Hard pre-deployment | YES | First production release | Approve one exact committed source revision and container digest for a zero-data, feature-off deploy after H1–H3 readback | All local evidence can be finalized |
| A1 — Matrix route/runtime lock | Activation blocker | NO | Public `/missionaccounts/` route and production SSO | Reconcile current Matrix runtime drift, approve the exact shared routing/SSO paths, and authorize a bounded shared lease | Isolated app may remain dark and healthy |
| A2 — historical import | Activation blocker | NO | Historical account visibility | Authorize import of the hash-pinned bundle after isolated DB verification | Schema-only service may stay live |
| A3 — Stripe account and terms | Activation blocker | NO | Payment setup and automatic billing | Identify immutable Stripe Test account, approve the exact terms/version hash, and separately approve any Test-mode pilot; live charging remains a later decision | App remains readable with payment activation pending |
| A4 — Zoom S2S | Activation blocker | NO | Automatic attendance ingestion | Identify the authorized account/app/scopes and approve scheduler cadence | Existing preserved attendance remains source authority; UI says disconnected |
| A5 — notification transport | Activation blocker | NO | Email/notification delivery | Bind an approved product-scoped transport and sender; approve worker credentials | Durable outbox remains pending and visible |
| A6 — recurring jobs | Activation blocker | NO | Charge, reminder, notification, Zoom workers | Register exact schedules and worker identities after their provider gates | No jobs run |
| D1 — identity review | Data-adjudication hold | NO | Affected historical balances only | Dr J adjudicates inside the review queue after launch | 107 human-cycle rows remain non-collectible |
| D2 — historical ceiling review | Data-adjudication hold | NO | Affected historical balances only | Dr J verifies or rejects the preserved `$300` candidate for each held account-cycle | 69 human-cycle rows remain non-collectible |
| D3 — source linkage | Data-adjudication hold | NO | Two account-cycle balances only | Resolve four preserved events to exact raw source evidence or leave held | Two human-cycle rows remain non-collectible |
| P1 — production AAA witness | Post-deployment AAA | NO | General activation confidence | Run role-specific, provider-native auth/RLS/BOLA/readback and responsive/accessibility smoke against the isolated URL | No financial or provider activation is required |

## H1 — exact authority registration package

The canonical pattern is the nine-path `MX-APPT-5003G` registration process, with the isolated StoryForge-family topology and staged activation pattern from `HB-360A-002`.

Prepare the transaction only in a fresh, clean MissionMed OS checkout after fetching canonical `origin/main`. At the observed canonical head, the next decision numbers were DR-198 and DR-199; those identifiers are provisional and must be reallocated if the remote advances.

Exact paths:

1. `CURRENT.md`
2. `missions.json`
3. `products_index.json`
4. `authority_index.json`
5. `registry/boot_dependency_manifest.json`
6. `decisions/DR-198_mx_missionaccounts_5301p_feature_off_production_authority.md`
7. `decisions/DR-199_mx_missionaccounts_5301p_bounded_mr_079_execution_amendment.md`
8. `PRODUCT_PASSPORTS/missionaccounts.md`
9. `handoffs/from_codex/MX_MISSIONACCOUNTS_5301P_AUTHORITY_REGISTRATION/MX_MISSIONACCOUNTS_5301P_AUTHORITY_REGISTRATION_RECEIPT.md`

Required before/after effects:

| Path | Before | Proposed after |
|---|---|---|
| `missions.json` | No `MX-MISSIONACCOUNTS-5301P` mission | One active mission record bound to the exact worktree, branch, 5300A canon contract/hash, two new decisions, product passport, completion report, and receipt |
| `products_index.json` | No MissionAccounts product | Add `MissionAccounts` with status `protected_feature_off_deployment_authorized_pending_isolated_targets_runtime_lock_financial_decisions_and_activation`; preserve `source_product_count: 21`; append it to the additive-products note |
| `authority_index.json` | No 5301P authority routes | Add the feature-off production decision and bounded MR-079 execution decision entries |
| `registry/boot_dependency_manifest.json` | Mission-specific BOOT returns unknown profile | Add a 5301P profile resolving the new decisions, passport, receipt, 5300A canon hash, completion report, Matrix runtime protocol/manifest, and prerequisite DR-061/062/135/136 |
| `CURRENT.md` | No active 5301P line; generated product count 30 | Regenerate through `tools/mmos_status.py`; add the active mission line; generated product count becomes 31 |
| two decision files | Absent | Authorize only bounded source hardening and a later isolated, zero-data, feature-off deploy; prohibit shared Railway reuse, route/provider/data activation, and live finance |
| product passport | Absent | Record ownership, data boundaries, isolated targets, flags, rollback, protected Matrix seam, and activation gates |
| receipt | Absent | Record exact hashes, validators, leases, push/readback, and zero product/provider mutation during registration |

Registration markers:

- `FEATURE_OFF_ZERO_DATA`
- `ISOLATED_RAILWAY_APPLICATION`
- `ISOLATED_SUPABASE_POSTGRESQL`
- `NO_SHARED_HQ_RAILWAY_REUSE`
- `NO_HISTORICAL_IMPORT_AT_DEPLOY`
- `MATRIX_RUNTIME_LOCK_REQUIRED_BEFORE_ROUTE`
- `NO_LIVE_CHARGE_WITHOUT_FOUNDER_D2_D7`
- `INDEPENDENT_FINANCIAL_SECURITY_VERIFICATION`

Lease boundaries:

- Use `REGISTRY:MISSIONMED-OS` for the registration transaction.
- Use exact `PATH:<digest>` leases for later MissionAccounts-owned files.
- Use one exact `SHARED:ROUTING` or `SHARED:MATRIX-SHELL` lease only when the Matrix seam is approved and current runtime-lock proof passes.
- Do not invent `PRODUCT:MISSIONACCOUNTS`; the finite Lease V2 map does not contain it.
- `GLOBAL` is prohibited.

Canonical process:

1. Use `tools/mission_registry_registrar.py` from a fresh clean authority checkout.
2. Fetch/fast-forward canonical `main` and allocate collision-free DR numbers.
3. Acquire the registry lease and file only the nine paths.
4. Regenerate `CURRENT.md` with explicit `MMOS_ROOT` and `MISSIONMED_ROOT`.
5. Validate universal BOOT, mission BOOT, JSON, OS lint, state-feed tests, exact-path scope, unrelated-byte preservation, and secret scan.
6. Push normally, never force.
7. Verify fresh detached `origin/main` byte equality and release the lease.

Rollback: before push, abandon only the isolated registration checkout. After push, use a new bounded governance decision/transaction; never rewrite canonical history.

Consequence of approval: governance registration may proceed; it does **not** itself deploy or activate anything.

Consequence of non-approval: local candidate and evidence remain preserved, but no production deployment is authorized.

### Copy-ready H1 approval

> I authorize a governance-only registration of MX-MISSIONACCOUNTS-5301P through the exact nine-path MissionMed OS package in `MX-MISSIONACCOUNTS-5301P_FOUNDER_GATES.md`. Allocate the next two collision-free DR identifiers from freshly fetched canonical main. The first decision may authorize continued bounded hardening and, only after all named hard pre-deployment gates pass, creation and deployment of exactly one new isolated MissionAccounts Railway application and one new isolated MissionAccounts Supabase/PostgreSQL target with every capability flag off, no historical data, no public Matrix route, and no Stripe, notification, Zoom, invoice, charge, refund, or worker action. The second decision may authorize only the corresponding MR-079 operations under REGISTRY for filing, exact PATH leases for MissionAccounts-owned files, and later exact SHARED routing or Matrix-shell leases after runtime-lock proof; GLOBAL and reuse of the currently linked `missionmed-hq-fix005` Railway project are prohibited. This approval does not authorize historical import, Matrix runtime override, Kinsta/WordPress activation, provider credentials, live billing, or student activation. Registration itself changes no product or provider.

## H2/H3 — exact target requirements

The application target is currently **unknown**, not merely missing credentials. The local Railway CLI is linked to an unrelated shared service and cannot be used.

The database target is currently **unknown**. The application uses Supabase/PostgREST through `MISSIONACCOUNTS_SUPABASE_URL` and a private service key. Registered generic Railway PostgreSQL targets are not drop-in compatible.

Founder/provider administrator must return:

```text
MISSIONACCOUNTS_RAILWAY_PROJECT_ID=<immutable id>
MISSIONACCOUNTS_RAILWAY_SERVICE_ID=<immutable id>
MISSIONACCOUNTS_RAILWAY_ENVIRONMENT_ID=<immutable id>
MISSIONACCOUNTS_REGION=<approved region>
MISSIONACCOUNTS_PUBLIC_DOMAIN=<reserved or NONE for dormant deploy>
MISSIONACCOUNTS_SUPABASE_PROJECT_REF=<immutable ref>
MISSIONACCOUNTS_SUPABASE_API_URL=<non-secret target identity>
SECRETS_GRANTED_THROUGH_APPROVED_CHANNEL=YES|NO
```

Do not place service keys, JWT secrets, Stripe secrets, Zoom secrets, or notification credentials in this file, chat, source control, or shell output.

## H4 — dormant deploy authorization

H4 can be issued only after the source commit and container digest are recorded in the completion report and H1–H3 pass. The authorization must name both hashes and confirm:

```text
MISSIONACCOUNTS_ROUTE_ENABLED=0
MISSIONACCOUNTS_BILLING_DECISIONS=0
MISSIONACCOUNTS_ATTENDANCE_CORRECTIONS=0
MISSIONACCOUNTS_IDENTITY_REVIEW=0
MISSIONACCOUNTS_EXAM_PLANS=0
MISSIONACCOUNTS_COMP_DAYS=0
MISSIONACCOUNTS_AUTO_BILLING=0
MISSIONACCOUNTS_NOTIFICATIONS=0
MISSIONACCOUNTS_ZOOM_SYNC=0
HISTORICAL_IMPORT=NO
PUBLIC_MATRIX_ROUTE=NO
WORKERS_AND_SCHEDULES=NONE
```

After deployment, provider-native readback must prove the exact target IDs, image digest, non-root runtime, health response, false flags, empty database state, anonymous denial, and rollback target. Any mismatch is a stop.

## Safe data split

The custody-verified historical bundle now classifies all 498 human-cycle rows:

| Class | Rows | Financial status |
|---|---:|---|
| `READY` | 320 | Eligible to become authoritative only after import authorization and production readback |
| `IDENTITY_HOLD` | 107 | Review-required; no automatic merge, inherited billing identity, collectible balance, or charge |
| `CAP_HOLD` | 69 | Candidate evidence preserved; cannot silently rise above the verified amount or become collectible |
| `SOURCE_LINK_HOLD` | 2 | Four events preserved without fabricated raw-row linkage; account-cycle remains non-billable |
| `OTHER_REVIEW` | 0 | None |

These queues are not app-deployment blockers. The first dormant deployment imports zero rows. A later authorized import can load held evidence while the database and UI keep those account-cycles quarantined.

## Provider activation sequence

1. Activate the isolated app/database and complete P1 production AAA with all capabilities false.
2. Reconcile the Matrix lock, install the bounded SSO/route seam, and repeat role-isolation/BOLA verification.
3. Authorize the historical import, verify all control totals, and keep held rows non-collectible.
4. Bind notification transport and scheduler; drain only explicitly approved message classes.
5. Bind Zoom S2S and run a source-only ingestion witness; verify zero automatic identity/billing mutation.
6. Approve billing terms and immutable Stripe Test account; run SetupIntent and one authorized `$25` charge/refund witness.
7. Live billing and general student activation require separate Founder and independent financial/security acceptance.

## Current no-go boundaries

- Do not deploy to `missionmed-hq-fix005` or `ivprep-profile-b-worker`.
- Do not mutate the dirty/outdated local `/Users/brianb/MissionMed_OS` checkout.
- Do not apply migrations to an unregistered database.
- Do not import historical data in the dormant release.
- Do not install or expose the Matrix route before runtime-lock reconciliation and shared-path authority.
- Do not create Stripe objects, charge, refund, send invoices, contact students, or enable automatic billing.
- Do not activate Zoom, notifications, or recurring workers.
