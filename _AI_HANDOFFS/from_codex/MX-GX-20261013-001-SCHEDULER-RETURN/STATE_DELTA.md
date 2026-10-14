# MX-GX-20261013-001 — Scheduler Return to Matrix state delta

## Scope

- Product: Scheduler / Appointments only
- Authority: MissionMed OS DR-427 at `d95df1f7f5d061af888bf00c0f2b9913578a3887`
- Final product lease: `66f47b04-75f4-44e2-a2a6-405a911d60a9`, fencing epoch `5839`
- Lease recovery: earlier keepers failed closed after a transient backend transport failure and a provider timestamp parser edge case. No protected write or deployment occurred while unfenced. The same exact four-path scope was reacquired before each protected step; the final keeper uses provider-identity-checked raw heartbeats through the approved MissionMed lease wrapper.
- Source baseline: `3159ab12a62e2c645ce3ff4fac650fadf9cf73f1`
- Pre-deployment live alias SHA-256: `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`
- Preserved immutable rollback: `scheduler_v1.e9e480a9c72b.html`

## Bounded change

- Reused the existing StoryForge V2 compact top-nav return control; no duplicate control was created.
- Set the exact destination to `https://missionmedinstitute.com/member-dashboard/#dashboard`.
- Kept the visible `Return to Matrix` label on desktop and at 390px mobile width.
- Added fail-closed navigation guards for unfinished booking/reschedule selections and in-flight booking, reschedule, or cancellation mutation work.
- A canceled leave confirmation keeps the student in Appointments with selections intact.
- Confirmed navigation uses the browser's existing cleanup and session behavior.
- Normalized the existing rail and Settings return links to the same exact destination and guard.
- Added no search, theme, global runtime, schema, auth, entitlement, appointment, or sibling-product behavior.

## Candidate

- Bundle: `LIVE/scheduler/scheduler_v1.html`
- SHA-256: `e070132cd376f38da996493adb9866233dd3bc61230eee6d5e36535d53847323`
- Bytes: `294940`
- Test: `tests/scheduler/mx-gx-scheduler-return.spec.mjs`

## Validation before deployment

- DR-427 return contract: PASS, 3/3
- Existing MX-APPT-5003G StoryForge suite: PASS, 6/6
- Scheduler patch audit: PASS
- `git diff --check`: PASS
- Real appointment creation/cancellation: NOT PERFORMED, by design

## Deployment and production acceptance

- Product commit: `b06b98f115de93da25cd8ccf1d098bbc38c7059e`
- Deployment: PASS
- Immutable candidate: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.e070132cd376.html`
- Immutable candidate readback: PASS, exact SHA-256 `e070132cd376f38da996493adb9866233dd3bc61230eee6d5e36535d53847323`
- Live alias readback: PASS, exact SHA-256 `e070132cd376f38da996493adb9866233dd3bc61230eee6d5e36535d53847323`
- Rollback artifact readback: PASS, exact SHA-256 `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`
- Authenticated student desktop QA: PASS. Live appointment catalogue, entitlements, seven upcoming records, and history hydrated; the native control had the exact URL and navigated to Matrix Dashboard.
- Authenticated student draft-state QA: PASS. Selecting `Consult: Non-Member` created only client-side state; dismissing the leave confirmation kept the student on `#scheduler` and left the selected radio option intact.
- Real appointment mutation during QA: NONE
- 390x844 contract and visual QA: PASS against the exact production bundle bytes before publication; the visible label, header fit, responsive bottom navigation, and no-overflow layout were captured. A redundant post-deploy authenticated mobile capture was attempted but not completed after the Chrome extension became unavailable; no product failure was observed.
- Independent candidate review: APPROVED
- Independent live review: APPROVED. Source, immutable artifact, and cache-busted live alias were reproduced byte-identical; rollback, source-lock JSON, 9/9 tests, 12/12 patch audit, and exact-scope diff all passed with no product/runtime drift.
- Final regression suite: PASS, 9/9 interaction and contract tests plus Scheduler patch audit
- Cache-busted live response check: PASS, HTTP 200, 294940 bytes, 0.245 seconds observed
- Lease release/provider-zero readback: pending
