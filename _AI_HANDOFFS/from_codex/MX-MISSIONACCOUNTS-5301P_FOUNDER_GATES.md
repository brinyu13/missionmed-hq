# MX-MISSIONACCOUNTS-5301P — Founder gates

**Current production effect:** none. All provider and money movement remain off.

## H1 — Mission registration

**Blocks:** every production mutation.

**Founder action:** approve a fresh canonical MissionMed OS registration for MX-MISSIONACCOUNTS-5301P, allocating the next two collision-free decision IDs and authorizing only one isolated Railway service, one isolated Supabase project, feature-off deployment, later real-data import, and later provider activation. Shared MissionMed services and GLOBAL authority remain prohibited.

**Copy-ready:** “I approve H1 for MX-MISSIONACCOUNTS-5301P exactly as stated in this gate file.”

## H2 — Isolated production targets

**Blocks:** persistence and deployment.

**Founder action:** authorize Codex/provider admin to create:

- Railway project/service/environment: missionaccounts-production
- Supabase project: missionaccounts-production, region us-east-2
- Supabase backups/PITR before import
- a product-scoped public domain and private worker origin

Secrets go only to Railway Variables / the approved operator secret channel.

**Copy-ready:** “I approve H2 creation of the isolated MissionAccounts Railway and Supabase targets in us-east-2; do not reuse a shared target.”

## A1 — Matrix route and production auth

**Blocks:** real Dr J/student access, not isolated service deployment.

**Founder action:** approve the exact bounded Matrix/WordPress route and SSO lease after current runtime-lock validation. No broad Matrix overwrite.

## A2 — Real historical import

**Blocks:** production hydration only.

**Founder action:** after H2 backup/readback, authorize the hash-pinned import of all real records, including holds.

**Expected:** 271 students; 419 Zoom instances; 100 confirmed classes; 3,941 events; 3,264 attendance days; 320 READY; 107 IDENTITY_HOLD; 69 CAP_HOLD; 2 SOURCE_LINK_HOLD; zero billing decisions/invoices/charges.

**Copy-ready:** “I approve A2 real-data import into the verified isolated MissionAccounts Supabase target; held records must remain non-collectible.”

## Z1 — Zoom Server-to-Server OAuth

**Blocks:** automatic attendance only.

**Observed:** Dr J’s Workplace Business account is authenticated and supports account-level S2S OAuth. Existing MissionMed Scheduler has only meeting create/delete scopes and must not be changed.

**Founder action (2–5 minutes):**

1. Zoom Admin → User Management → Roles → Dr J role → Advanced features: enable View/Edit for Zoom for developers and Server-to-Server OAuth app. The current Marketplace UI does not expose Build app.
2. Marketplace → Developer → Build app → Server-to-Server OAuth.
3. Name: MissionAccounts Attendance Sync; account-level; not published.
4. Add only:
   - report:read:user:admin
   - report:read:list_meeting_participants:admin
5. Activate it, then place Account ID, Client ID, and Client Secret directly in:
   Railway → missionaccounts-production service → Variables
   as MISSIONACCOUNTS_ZOOM_ACCOUNT_ID, MISSIONACCOUNTS_ZOOM_CLIENT_ID, and MISSIONACCOUNTS_ZOOM_CLIENT_SECRET.

No callback, webhook, meeting write scope, Scheduler change, or credential pasted into chat/files.

## S1 — Stripe account identity

**Blocks:** Stripe Test witness.

**Founder action:** confirm whether MissionMed Institute — acct_1TClmEC5UTtLEXqw is the intended Dr J ExamPrep account.

**Copy-ready:** “S1 YES — acct_1TClmEC5UTtLEXqw is the intended Dr J ExamPrep Stripe account.” (Or name the correct account.)

## S2 — Stripe Test credentials

**Blocks:** real provider Test witness.

**Founder action:** after the production domain exists, create a Test restricted key for Customers, Payment Methods, Setup Intents, Payment Intents, Invoices, Invoice Items, and Account readback; bind its Test publishable key; create:

https://{missionaccounts-domain}/api/webhooks/stripe

Events: setup_intent.succeeded, payment_intent.succeeded, payment_intent.payment_failed, invoice.finalized, invoice.sent, invoice.paid, invoice.payment_failed, invoice.overdue, invoice.voided, invoice.finalization_failed.

Place keys/signing secret only in Railway → missionaccounts-production service → Variables. Do not paste them into chat.

## S3 — Billing terms

**Blocks:** live automatic charging only.

**Founder/legal action:** approve final student-facing consent text, version/hash, effective date, revocation and receipt language, invoice due days, reminder cadence, and overdue handling.

Product rules are already fixed: $25 per eligible Eastern calendar day; same-day Step 1 + Step 2/3 is one day; comp/grace/UCC/MUL/waived/prepaid/already-paid/already-invoiced are not charged; saved method and authorization are separate; authorized charges occur 24–48 hours after verified attendance.

## S4 — Stripe Live activation

**Blocks:** real money movement only.

**Founder action:** only after Test/security acceptance, explicitly authorize the Live restricted key/webhook and a bounded canary. Live requires all three independent gates: MISSIONACCOUNTS_STRIPE_MODE=live, MISSIONACCOUNTS_STRIPE_LIVE_MUTATIONS=1, and the specific hosted-invoice or automatic-billing feature flag.

## Current checkpoint

- **REAL DATA: PARTIAL** — deterministic package/replay/post-check PASS; isolated target and A2 import remain.
- **ZOOM: PARTIAL** — app/account/scopes/code verified; separate app credentials and real witness remain.
- **STRIPE: PARTIAL** — both real workflows coded/tested; S1/S2 and provider witness remain.
- **CORE APP DEPLOYABLE WITHOUT ZOOM: YES**, after H1/H2/A1.
- **CORE APP DEPLOYABLE WITHOUT LIVE STRIPE CHARGING: YES**, after H1/H2/A1.
