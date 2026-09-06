# MissionAccounts

Isolated production candidate for `MX-MISSIONACCOUNTS-5301P`.

This directory intentionally does not modify protected Matrix runtime assets. The Matrix route, Kinsta gateway, production database migration, and provider activation remain feature-off until the Matrix runtime lock and mission registration gates pass.

## Local verification

```bash
npm --prefix missionaccounts test
npm --prefix missionaccounts run test:postgres
npm --prefix missionaccounts run build:canon
PORT=4179 MISSIONACCOUNTS_AUTH_MODE=local npm --prefix missionaccounts run dev
```

The PostgreSQL check applies the complete migration to a temporary, local-only PostgreSQL cluster and exercises billing, attendance correction, exam, comp, Stripe payment-setup, and automatic-billing-consent transactions. The build command verifies the Founder-approved 5300A SHA-256 before materializing the browser artifact. The generated HTML is intentionally gitignored because the canonical payload contains historical student information. Local auth is development-only and fails closed in production.

All production capabilities default off. `MISSIONACCOUNTS_BILLING_DECISIONS=1`, `MISSIONACCOUNTS_ATTENDANCE_CORRECTIONS=1`, `MISSIONACCOUNTS_EXAM_PLANS=1`, `MISSIONACCOUNTS_COMP_DAYS=1`, `MISSIONACCOUNTS_AUTO_BILLING=1`, and `MISSIONACCOUNTS_ZOOM_SYNC=1` are effective only on a configured runtime; none has been enabled in production. Every mutation requires an `Idempotency-Key` header. Stripe API version override is optional and must come from a verified account readback through `MISSIONACCOUNTS_STRIPE_API_VERSION`; otherwise Stripe uses the account default.
