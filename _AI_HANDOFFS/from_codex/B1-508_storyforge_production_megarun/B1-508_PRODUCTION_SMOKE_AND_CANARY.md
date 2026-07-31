# B1-508 Production Smoke and Canary

## Live smoke

Authenticated Chrome, Founder account, live Matrix path:
`https://missionmedinstitute.com/storyforge/`.

Passed:

- StoryForge V5 MissionMed shell and Home.
- Existing two private stories.
- Quick Capture.
- Durable autosave and explicit save.
- Reload persistence.
- Story Detail and exact original telling.
- Library.
- Settings with server-derived role.
- Interview Prep with 26/26 questions.
- Voice control absent.
- Authenticated recording POST denied 403 `voice_disabled`.

Screenshot:
`screenshots/founder-settings-live-20260731T071834Z.jpeg`

SHA-256:
`da123334d7d2b86bb88468b0e1aafbab654449b803acd074c114c1b2b4ca66e9`

## Synthetic canary

- Title: `B1-508 production canary — delete me`
- Story ID: `b352dd9a-c90f-4f81-bd69-97985693197e`
- Content: explicitly synthetic; no student or patient information.
- Create: PASS.
- Autosave: PASS.
- Explicit save: PASS.
- Reload: PASS.
- Detail/original preservation: PASS.
- Cleanup: archived through `POST /api/stories/:id/archive`.
- Final UI: canary absent; two active private stories remain.

The original and its four audit events remain append-only by design. A hard
delete was neither available nor authorized. The archive is the accepted
truthful cleanup.

## Stabilization

- Railway deployment status: SUCCESS.
- Health: 200.
- Config: 200, `audioAvailable:false`, signed-JWT, dev auth false, all AI false.
- Railway HTTP 5xx since deployment: 0.
- Functional runtime errors: none.
- One PostgreSQL client deprecation warning (`client.query()` while already
  executing) was observed. It caused no request failure and is P2 operational
  debt for a future pg@9 compatibility lane.
- Final voice/audio/reconciliation rows: all 0.
- WordPress scope: exact one Founder, zero cohorts.

No rollback criterion triggered.
