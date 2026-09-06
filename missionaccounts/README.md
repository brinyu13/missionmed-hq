# MissionAccounts

Isolated production candidate for `MX-MISSIONACCOUNTS-5301P`.

This directory intentionally does not modify protected Matrix runtime assets. The Matrix route, Kinsta gateway, production database migration, and provider activation remain feature-off until the Matrix runtime lock and mission registration gates pass.

## Local verification

```bash
npm --prefix missionaccounts test
npm --prefix missionaccounts run test:postgres
npm --prefix missionaccounts run test:historical-import
npm --prefix missionaccounts run build:canon
PORT=4179 MISSIONACCOUNTS_AUTH_MODE=local npm --prefix missionaccounts run dev
```

The PostgreSQL checks apply the complete migration to temporary, local-only PostgreSQL clusters. The primary check exercises billing, attendance correction, exam, comp, Stripe payment setup, automatic-billing consent, one-charge-per-attendance-day, and notification-outbox transactions. The historical check verifies the exact 5000B ledger, identity graph, source-manifest, and Zoom export hashes before building a private, mode-0600 SQL bundle; imports all preserved source and reconciliation rows; asserts the custody/control totals; and proves that no billing decision, invoice, charge, verified $300 ceiling, Matrix identity, feature flag, or production mutation is created. The canon build verifies the Founder-approved 5300A SHA-256 before materializing the browser artifact. Generated HTML and private import SQL are intentionally gitignored because they contain historical student information. Local auth is development-only and fails closed in production.

The isolated `Dockerfile` packages only the server, the scrubbed production shell, and its two browser runtime modules. It cannot copy `public/index.html`, `public/canon-manifest.json`, historical imports, local environment files, or other private build inputs. `railway.json` is scoped to this directory and does not change the repository-root MissionMed HQ service definition. A production process also refuses to start until both database target variables are present.

To build an authorized private import bundle without applying it, provide an absolute output path:

```bash
npm --prefix missionaccounts run build:historical-import -- --output /absolute/private/path/historical-import.private.sql
```

All production capabilities default off. `MISSIONACCOUNTS_STUDENT_CONTACTS=1`, `MISSIONACCOUNTS_BILLING_DECISIONS=1`, `MISSIONACCOUNTS_ATTENDANCE_CORRECTIONS=1`, `MISSIONACCOUNTS_EXAM_PLANS=1`, `MISSIONACCOUNTS_COMP_DAYS=1`, `MISSIONACCOUNTS_AUTO_BILLING=1`, `MISSIONACCOUNTS_NOTIFICATIONS=1`, and `MISSIONACCOUNTS_ZOOM_SYNC=1` are effective only on a configured runtime; none has been enabled in production. Every mutation requires an `Idempotency-Key` header. Stripe API version override is optional and must come from a verified account readback through `MISSIONACCOUNTS_STRIPE_API_VERSION`; otherwise Stripe uses the account default. Notification delivery additionally requires a separate worker token plus an explicitly configured HTTPS transport; absent those, the worker fails closed before claiming any outbox row.
