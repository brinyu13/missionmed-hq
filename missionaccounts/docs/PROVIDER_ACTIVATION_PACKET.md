# MissionAccounts provider activation packet

## Zoom

### Verified architecture

- Authenticated account: Dr J, Workplace Business, account administrator; Server-to-Server OAuth is supported.
- Donor only: `MissionMed Scheduler` is an activated account-level Server-to-Server OAuth app with only meeting create/delete scopes. It must not be changed or reused.
- New app: separate account-level Server-to-Server OAuth app named `MissionAccounts Attendance Sync`, not published to the Marketplace.
- No redirect URL, callback, webhook, recording, meeting-write, or meeting-delete permission is needed. This integration polls completed reports.

Minimum endpoint-to-scope map:

| Endpoint | Purpose | Granular scope |
|---|---|---|
| `GET /v2/report/users/{userId}/meetings` | List the host's completed meeting instances in the bounded daily window | `report:read:user:admin` |
| `GET /v2/report/meetings/{meetingUuid}/participants` | Retrieve participant join/leave/source evidence for each allowlisted instance | `report:read:list_meeting_participants:admin` |

Both endpoints are Heavy rate-limit class. The client paginates at 300 rows, calls only an explicit recurring-meeting allowlist, retries network/429 failures at most three times, and never parallel-fans out participant reports.

### Current Zoom gate

The authenticated Developer workspace exposes the existing app but currently does not expose `Build app`. A Zoom owner must ensure Dr J's role has View/Edit for both **Zoom for developers** and **Server-to-Server OAuth app**, then create the separate app above. If the control remains absent, the owner creates it from Marketplace → Developer → Build app.

Add only the two granular scopes, complete the required basic publisher/contact fields, and activate the app on the account. Do not reveal or regenerate the Scheduler secret.

Secret destination after the isolated Railway service exists:

`Railway → missionaccounts-production → missionaccounts-production service → Variables`

Variables:

- `MISSIONACCOUNTS_ZOOM_ACCOUNT_ID`
- `MISSIONACCOUNTS_ZOOM_CLIENT_ID`
- `MISSIONACCOUNTS_ZOOM_CLIENT_SECRET`
- `MISSIONACCOUNTS_ZOOM_HOST_USER_ID`
- `MISSIONACCOUNTS_ZOOM_MEETING_RULES_JSON` — derived privately from the validated historical recurring meeting IDs and mapped to `s1` or `s23`
- `MISSIONACCOUNTS_ZOOM_MODE=configured`
- `MISSIONACCOUNTS_ZOOM_SYNC=0` until the real witness passes

After binding, the witness must obtain a real S2S token, retrieve a known historical Drills meeting and participants, match it to preserved source evidence, replay idempotently, verify same-day two-event/one-day behavior, verify unknown identities enter review, and verify a provider failure leaves attendance and billing unchanged. Only then enable the daily one-shot worker at 06:30 UTC, which imports the previous complete Eastern day with a stable date key.

## Stripe

### S1 — account identity

The authenticated Stripe dashboard shows `MissionMed Institute`, account `acct_1TClmEC5UTtLEXqw`. Founder must confirm that this exact account is the intended Dr J ExamPrep production account. No account identity is inferred from branding alone.

### S2 — Test binding

In that confirmed account, create a Test-mode restricted key for Customers, Payment Methods, Setup Intents, Payment Intents, Invoices, Invoice Items, and Account readback; create the Test publishable key binding; and create a webhook endpoint at:

`https://{approved-missionaccounts-domain}/api/webhooks/stripe`

Subscribe only to:

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

Secret destination:

`Railway → missionaccounts-production → missionaccounts-production service → Variables`

Variables:

- `MISSIONACCOUNTS_STRIPE_SECRET_KEY`
- `MISSIONACCOUNTS_STRIPE_PUBLISHABLE_KEY`
- `MISSIONACCOUNTS_STRIPE_WEBHOOK_SECRET`
- `MISSIONACCOUNTS_STRIPE_MODE=test`
- `MISSIONACCOUNTS_STRIPE_LIVE_MUTATIONS=0`
- `MISSIONACCOUNTS_HOSTED_INVOICES=0` until the Test invoice witness
- `MISSIONACCOUNTS_AUTO_BILLING=0` until the Test automatic-charge witness

The Test witness covers Customer mapping, off-session SetupIntent, explicit versioned consent, one $25 PaymentIntent, real Stripe-hosted invoice create/item/finalize/send, signed webhook state, retries, and cleanup. Test success does not authorize Live mode.

### S3 — legal terms

Product behavior is fixed: $25 per distinct eligible Eastern calendar day; same-day Step 1 plus Step 2/3 is one charge; valid comp, exam grace, UCC, MUL, waived, prepaid, already-paid, and already-invoiced states are not charged; payment-method storage is separate from authorization; authorized charges occur 24–48 hours after verified attendance.

Founder/legal must approve the final student-facing consent text, version identifier/hash, effective date, revocation disclosure, receipt/contact language, invoice due days, reminder cadence, and overdue handling. Placeholder copy cannot activate live automatic charging.

### S4 — Live activation

After independent Test/security acceptance, separately bind a Live restricted key and Live webhook secret, verify the same immutable account, run a bounded canary, and explicitly set all three gates: `MISSIONACCOUNTS_STRIPE_MODE=live`, `MISSIONACCOUNTS_STRIPE_LIVE_MUTATIONS=1`, and the one intended feature flag. Hosted invoices and automatic day charges can be activated independently. No Live key or charge is authorized by this packet.
