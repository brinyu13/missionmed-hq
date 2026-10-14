# MX-GX-20261013-001 — Scheduler Return to Matrix state delta

## Scope

- Product: Scheduler / Appointments only
- Authority: MissionMed OS DR-427 at `d95df1f7f5d061af888bf00c0f2b9913578a3887`
- Product lease: `e1fee490-df0b-45e6-be01-eb023f5b5f4d`, fencing epoch `5833`
- Lease recovery: the initial lease keeper failed closed after a transient backend transport failure; no protected write or deployment occurred while unfenced. The same exact four-path scope was reacquired before the handoff update, commit, and publish ladder.
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

- Deployment: pending founder approval execution
- Immutable candidate readback: pending
- Live alias readback: pending
- Authenticated student desktop QA: pending
- Authenticated student 390x844 QA: pending
- Lease release/provider-zero readback: pending
