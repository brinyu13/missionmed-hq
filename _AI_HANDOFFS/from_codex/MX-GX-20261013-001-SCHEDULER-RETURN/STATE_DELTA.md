# MX-GX-20261013-001 — Scheduler Return to Matrix truthful state delta

## Authority and scope

- Product: Scheduler / Appointments only.
- Original authority: DR-427 at MissionMed OS commit
  `d95df1f7f5d061af888bf00c0f2b9913578a3887`.
- DR-427 status: EXPIRED on the first product PATH keeper/fencing loss. Later
  reacquisitions, including historical final lease
  `66f47b04-75f4-44e2-a2a6-405a911d60a9` / epoch `5839`, did not revive it.
- Truthful report-only successor: DR-441 at canonical MissionMed OS commit
  `026d742f010e4148f1db1f9d1b36c28936102fc2`.
- DR-441 permits correction of this file and citation of independent read-only
  acceptance only. It grants no product, source, deployment, backend, data,
  auth, identity, entitlement, account, profile or appointment mutation.
- Current correction fence: exact PATH
  `PATH:46842ba106527d7b9df4cb5a1273cae35774cd078c5c8e0b41d23c6a08a22ea6`,
  lease `7469ed06-ba82-48a3-8c9d-74c4220c6883`, epoch `5959`.

## Shipped bounded change

- Reused the existing StoryForge V2 compact top-navigation control; no duplicate
  control was created.
- Fixed its destination at
  `https://missionmedinstitute.com/member-dashboard/#dashboard`.
- Preserved the visible `Return to Matrix` label on desktop and 390px mobile.
- Added fail-closed navigation guards for unfinished booking/reschedule
  selections and in-flight booking, reschedule or cancellation writes.
- A canceled leave confirmation keeps the user in Appointments with selections
  intact; confirmed navigation uses the existing page cleanup/session behavior.
- Normalized existing rail and Settings return links to the same destination and
  guard.
- Added no search, theme, global runtime, schema, auth, entitlement,
  appointment, account/profile or sibling-product behavior.

## Product and production custody

- Source baseline before the Return change:
  `3159ab12a62e2c645ce3ff4fac650fadf9cf73f1`.
- Return implementation commit:
  `b06b98f115de93da25cd8ccf1d098bbc38c7059e`.
- Deployment evidence commit: `94dfc30`.
- Independent live-review evidence commit and current branch head before this
  report correction: `8f057d4a9b431e8a0e73022f56d35fa53cd3ae91`.
- Bundle: `LIVE/scheduler/scheduler_v1.html`, 294940 bytes.
- Source, immutable candidate and cache-busted live alias SHA-256:
  `e070132cd376f38da996493adb9866233dd3bc61230eee6d5e36535d53847323`.
- Immutable candidate:
  `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/versions/scheduler_v1.e070132cd376.html`.
- Preserved immutable rollback: `scheduler_v1.e9e480a9c72b.html`, SHA-256
  `e9e480a9c72b41e9f63d63cc2fcccb818c19647b4a6e2dbd45d0d0f81d1a15f2`.
- Production remains the existing V2 artifact at `e070132c...`; this correction
  performed no deploy, republish, alias change, cache purge or source-lock edit.

## Validation retained from the shipped candidate

- DR-427 Return contract: PASS, 3/3.
- Existing MX-APPT-5003G StoryForge suite: PASS, 6/6.
- Final interaction and contract suite: PASS, 9/9.
- Scheduler patch audit: PASS, 12/12.
- Independent candidate review: APPROVED.
- Independent source/immutable/live review: APPROVED; exact bytes, rollback,
  source-lock JSON, tests, patch audit and exact-scope diff were reproduced.
- Real appointment creation, reschedule or cancellation for this Return QA:
  NONE.
- No full QA rerun was performed for this report-only correction.

## Corrected authenticated-role evidence

The original version of this file incorrectly called the earlier shared Chrome
session a student session. Direct role inspection showed that session was
Administrator. Its hydrated catalogue, seven upcoming records, history,
desktop navigation and client-side draft observation are Administrator evidence
only. They do not prove genuine-student acceptance. The prior lines
`Authenticated student desktop QA: PASS` and `Authenticated student draft-state
QA: PASS` are retracted as student claims.

A later Founder-confirmed Chrome student-role observation is distinct from the
earlier Administrator session and must not be conflated with it. The independent
acceptance basis for this closeout is the separate authenticated in-app-browser
subscriber/student session described below.

Independent read-only genuine-student acceptance: PASS.

- Role: authenticated subscriber/student persona; ordinary Student dashboard
  present and Administrator tools absent.
- Desktop actual CSS viewport 1200x833: native Return exact href above; rect
  126.1x44 at x34/y96; visible, topmost and without overflow. Pointer navigation
  reached `#dashboard`, ordinary Student dashboard/Featured apps rendered, and
  Scheduler reentry worked.
- Mobile actual innerWidth 390 and innerHeight 844: native Return rect 122.1x44
  at x22/y187.66; visible, topmost, inside the viewport and without overflow.
  Pointer navigation reached the Student dashboard; Scheduler reentry worked;
  no new warning or error was captured.
- No appointment, booking/reschedule draft, form, account, profile, role,
  enrollment or entitlement was changed.
- Sanitized screenshots:
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/MX-GX-20261013-001/arena-local-qa/scheduler-student-desktop-header.png`
  and
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/MX-GX-20261013-001/arena-local-qa/scheduler-student-390-header.png`.

The earlier 390x844 candidate-contract capture remains valid as prepublication
visual evidence. Its incomplete post-deploy Chrome recapture is not the mobile
acceptance claim; the independent authenticated in-app-browser 390x844 journey
above supplies the read-only production acceptance.

## Governance incident chronology

1. DR-427 expired on its first product PATH fence loss. Later product keepers
   were reacquisitions, not authority renewal. No retroactive authority is
   claimed for implementation, deployment, browser work or earlier reports.
2. An unfiled Scheduler registration candidate locally proposed the unused
   DR-436 identifier; no canonical DR-436 exists. Its generator ran without
   explicit `MMOS_ROOT` and wrote the dirty default
   `/Users/brianb/MissionMed_OS/CURRENT.md` to reconstructed SHA-256
   `d5e3f17df01787ab836fe19eb9edcf79592a5389a1a1f373775667b10b6e1e0c`.
   After release, a second unfenced default-root write attempted restoration to
   SHA-256
   `4768d19bc3d86ed647dc8bcb40f0f3a17f85e9ad156432ca3b78ec8169b4a008`
   without CAS and may have clobbered separately preserved concurrent state
   `1b3cb157f1ce236201c930521f2f9d2cdb399588041d9c3bc698e93c715dbaf6`.
   Neither wrong-root write is cured or authorized by DR-441; the default
   checkout and rejected candidate remain untouched.
3. A different unfiled Scheduler report candidate locally proposed DR-439. It
   is unrelated to canonical Calendar DR-439, whose authority is unchanged.
   Its explicit-root generator stayed inside a clean clone, but REGISTRY lease
   `6f868948-9243-487d-81fb-b9ce1bc811c3`, epoch `5920`, expired before staging
   because the controller process did not remain alive. The candidate remained
   uncommitted and unstaged; provider readback found zero active exact-task
   claims. Its bytes were not reused.
4. DR-441 registration used persistent REGISTRY lease
   `1d851a9b-2e07-45b6-be67-2d526eb8d255`, epoch `5944`, passed independent
   staged review, pushed canonical commit `026d742f...`, verified remote bytes,
   released normally at 2026-10-14T14:33:49.203891Z, and returned zero active
   exact-task claims and zero live waiters.

## Closeout status

- Truthful correction commit/readback: pending this exact fenced transaction.
- Current correction lease normal release: pending until after commit/readback.
- Exact-task provider-zero after that release: pending readback; it will be
  recorded only under the separately fenced DR-441 closeout step.
- Product code/source/live bytes: unchanged.
