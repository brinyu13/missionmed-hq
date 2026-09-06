# MissionAccounts

Isolated production candidate for `MX-MISSIONACCOUNTS-5301P`.

This directory intentionally does not modify protected Matrix runtime assets. The Matrix route, Kinsta gateway, production database migration, and provider activation remain feature-off until the Matrix runtime lock and mission registration gates pass.

## Local verification

```bash
npm --prefix missionaccounts test
npm --prefix missionaccounts run build:canon
PORT=4179 MISSIONACCOUNTS_AUTH_MODE=local npm --prefix missionaccounts run dev
```

The build command verifies the Founder-approved 5300A SHA-256 before materializing the browser artifact. The generated HTML is intentionally gitignored because the canonical payload contains historical student information. Local auth is development-only and fails closed in production.
