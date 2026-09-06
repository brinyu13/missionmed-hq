# MX-MISSIONACCOUNTS-5301P production checkpoint

**Result:** PARTIAL — provider-ready release candidate is complete and verified; production remains intentionally unchanged behind exact authority, target, credential, and acceptance gates
**Date:** 2026-09-06
**Branch:** `codex/mx-missionaccounts-5301p-production`
**Implementation commit:** `d3ed02d6dae476374e03fa39bc7fbba3add98a49`

## Direct status

- **REAL DATA: PARTIAL.** The exact historical dataset is packaged, hash-bound, transactionally importable, replay-safe, and verified in disposable PostgreSQL. No production Supabase target exists, so it has not been imported into production.
- **ZOOM: PARTIAL.** The real Dr J Zoom account and Server-to-Server OAuth architecture were verified. The read-only client, reconciliation authority, daily worker, failure custody, and health surface are complete. A separate `MissionAccounts Attendance Sync` app could not be created because the authenticated Developer workspace exposes no Build-app control. Credentials therefore do not exist and no real API witness has run.
- **STRIPE: PARTIAL.** Test/live-safe provider architecture, customer mapping, Payment Element SetupIntent, consent, $25 day charges, Stripe-hosted invoices, signed webhook reconciliation, and 24–48-hour worker are complete and tested with deterministic doubles. The intended account still needs Founder confirmation, Test restricted-key/webhook binding, real Test witnesses, legal terms approval, and separately gated Live activation.
- **CORE APP DEPLOYABLE WITHOUT ZOOM: YES**, after governance registration and isolated Railway/Supabase target creation.
- **CORE APP DEPLOYABLE WITHOUT LIVE STRIPE CHARGING: YES**, after those same gates; all provider and financial flags remain disabled.

## What is complete

### Real historical data

The production importer verifies every source hash, emits mode-0600 SQL and a companion manifest that binds the SQL SHA-256, applies the import in one transaction, and treats an exact replay as a verified no-op. A separate production post-check verifies:

- 271 reconciled student records;
- 419 preserved Zoom meeting instances and 100 confirmed Drills sessions;
- 5,498 immutable raw Zoom source rows;
- 3,941 attendance events and 3,264 derived attendance days;
- 498 human-cycle rows: 320 `READY`, 107 `IDENTITY_HOLD`, 69 `CAP_HOLD`, 2 `SOURCE_LINK_HOLD`, 0 `OTHER_REVIEW`;
- 74 historical cap candidates preserved but not auto-approved; and
- zero Matrix links, billing decisions, invoices, charges, or enabled feature flags.

All unresolved records remain review/hold. The import does not invent identity, cap, payment, or billing authority.

### Zoom

The production Zoom path now includes:

- Server-to-Server OAuth token acquisition with in-memory expiry caching;
- trusted Zoom HTTPS origin enforcement, timeouts, bounded retry/429 behavior, and sequential pagination;
- explicit 9–11 digit recurring-meeting allowlist mapped to Step 1 or Step 2/3;
- the two minimum report endpoints and granular read scopes documented in the activation packet;
- recurring-instance UUID handling;
- approved Drills classification: Monday–Friday, 11:45 AM–4:00 PM Eastern inclusive, more than 15 participants, duration ignored, fixed historical cycles;
- exact-identity-only reconciliation; unknown attendees become isolated review identities;
- immutable provider/source custody, idempotent ingestion, same-day two-event/one-billable-day derivation, and no automatic billing approval or charge;
- a previous-complete-Eastern-day worker with stable date idempotency; and
- persistent failed-run exception custody plus safe administrative health reporting.

The existing `MissionMed Scheduler` app was inspected as a donor only. It has meeting create/delete scopes, was not changed, and is not suitable for least-privilege attendance reporting.

### Stripe

The production Stripe path now includes:

- Test and Live secret/restricted-key support with independent Live mutation gating;
- private Stripe customer mapping;
- Stripe-hosted Payment Element and SetupIntent method collection, with no MissionMed card fields;
- explicit, versioned automatic-billing consent and independent revocation;
- one $25 PaymentIntent per eligible Eastern attendance day, bounded to the approved 24–48-hour window;
- real provider-hosted invoice create, itemize, finalize, send, resend, and void flows;
- stable idempotency keys and two-phase database/provider custody;
- signed-event-only state transitions for payment and invoice lifecycle events;
- safe browser projection of hosted invoice URL/PDF/status without provider secrets; and
- financial-finality guards that prevent later identity/device adjudication from rewriting an invoice or charge history.

No Stripe object was created and no charge was attempted.

### Deployment safety

- Production schema runner requires the exact isolated Supabase project ref, matching database hostname, and approval token; all 11 migrations run in one transaction and are bound to a stable release digest.
- Historical import runner accepts only the exact new target, empty database or exact prior import, and a separate approval token.
- The Docker image contains only the runtime package and five scrubbed browser assets, runs as non-root `node`, and fails before listening without the explicit database target.
- The production shell contains no historical roster payload or browser-owned business state.
- All 11 feature flags seed disabled.

## Verification

- `npm run build:canon`: PASS; canonical source SHA-256 `3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8`.
- `npm test`: PASS, 153/153.
- `npm run test:postgres`: PASS; all 11 migrations exercised in disposable PostgreSQL 16.
- `npm run test:historical-import`: PASS; exact import, manifest hash, replay no-op, control counts, holds, and zero financial mutation.
- `bash -n` for both production operator scripts: PASS.
- `git diff --check`: PASS.
- Credential scan: PASS; only deliberately fake test-fixture key shapes matched.
- Docker build: PASS. Image `missionaccounts:mx5301p-provider-ready`, ID `sha256:0d64175c29dbbb1d8f219ad37326d6f63debe13f0f9fb8e1e2a1fc89f46c95c2`, size 58,527,716 bytes, user `node`.
- Docker content allowlist and missing-target fail-closed startup: PASS.
- Production/provider mutation: NONE.

## Exact remaining gates

1. Register this mission/product/authority route in canonical MissionMed OS and grant the exact dormant-release command.
2. Create isolated Railway project/service `missionaccounts-production` and isolated Supabase project `missionaccounts-production` in `us-east-2`; record provider-native identities and backup/PITR state.
3. Apply the 11-migration release, run the exact historical import, and perform provider-native readback on those isolated targets.
4. Bind and verify the Matrix/WordPress product-scoped auth route without changing unrelated Matrix routes.
5. Zoom owner exposes Build-app authority or creates the separate S2S app with only the two documented read scopes; securely transfer its four identity/credential values plus the private meeting allowlist into the isolated Railway service.
6. Run the real Zoom historical/idempotency/failure witness, then enable the daily scheduler.
7. Founder confirms the intended Stripe account; bind Test restricted/publishable/webhook credentials and run Customer, SetupIntent, hosted-invoice, webhook, one-$25-day, retry, and cleanup witnesses.
8. Founder/legal approves the exact terms version, invoice timing, reminders, overdue behavior, and Live activation boundary.
9. After independent security/acceptance, explicitly authorize and canary only the intended Live Stripe workflow.

The narrow operational instructions are in `missionaccounts/docs/PRODUCTION_ACTIVATION_PACKET.md`, `missionaccounts/docs/PROVIDER_ACTIVATION_PACKET.md`, and `_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5301P_FOUNDER_GATES.md`.
