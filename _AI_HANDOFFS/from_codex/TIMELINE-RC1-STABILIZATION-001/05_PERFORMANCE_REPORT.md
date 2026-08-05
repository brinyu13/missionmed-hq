# Timeline RC1 Performance Report

## Release size

- Pre-RC1 recorded raw production payload: approximately 1.808 MB.
- RC1 raw production bundle: 1,189,312 bytes.
- RC1 gzip bundle: 463,643 bytes.
- Raw reduction: approximately 34%.

## Browser workflow measurements

The final 39/39 Chromium workflow run recorded representative timings:

- Builder/protected render: approximately 159 ms.
- Edit Timeline continuity/readiness: approximately 208 ms.
- Autosave plus reload verification: approximately 649 ms.
- PNG/PDF export workflow: approximately 931 ms for the administrator journey.
- Browser errors in the run: zero.

## Live service measurements

Five consecutive production health requests on 2026-08-05:

- Average: 188.6 ms.
- Minimum: 129.0 ms.
- Maximum: 316.5 ms.

The anonymous canonical route returned the expected `303` Matrix handoff in 978.7 ms during the final probe. API health reported the exact RC1 static identity and production database schema.

## Rendering behavior

RC1 avoids unchanged preview rebuilds by comparing a presentation signature before rerendering and by scheduling preview work to the next frame. Media failures are isolated; no retry loop or whole-document render retry was added. Memory ownership is bounded by revoking replaced and teardown object URLs.

## Session renewal

Production issued two distinct JWTs, both authorized the Timeline API with `200`, TTL was 120 seconds, and the renewed token expiry exceeded 90 seconds. The browser client schedules background refresh 30 seconds before expiry.

## Recovery 002 performance and session evidence

The repaired clean Incognito session remained authenticated beyond the former 120-second token window, retained remote hydration, and displayed `SAVED & SYNCED`. A post-deployment refresh briefly displayed truthful `SAVING…` during reconciliation, then settled to `SAVED & SYNCED` with the protected preview rendered. Sequential principal-directory reads add only the latency of three small indexed authorization queries on a connection that cannot execute them concurrently; they remove the pg 9 incompatibility without changing payloads or extra round trips outside the existing transaction.
