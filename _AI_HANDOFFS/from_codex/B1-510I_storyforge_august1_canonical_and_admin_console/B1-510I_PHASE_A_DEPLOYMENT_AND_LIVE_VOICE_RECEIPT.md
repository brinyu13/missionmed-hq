# B1-510I Phase A Deployment and Live Voice Receipt

## Deployments

| System | Identifier | Result |
|---|---|---|
| Kinsta static release | `releases/3aeceee268ed6fd9a8eaa50138b8c00e8f13211b` | published; exact public hashes verified |
| Railway attempt | `825381fb-...` | build failed before replacing runtime because the upload root was wrong |
| Railway | `ae9f8488-ca6b-4e69-809b-ffc20daa319d` | eligible-all runtime seam deployed |
| Railway | `391474f5-...` | explicit prompt-label guard deployed |
| Railway | `35b5ecbd-...` | raw vocabulary guard deployed |
| Railway final | `80e39e8e-954f-4964-9bfc-6b7c98fac1a4` | primary contamination failover deployed; service online |

Final health response: `{"ok":true,"service":"storyforge-v5"}`.

## Founder physical-microphone acceptance

At `2026-08-01T19:55Z`, the Founder completed the required non-private physical-microphone canary in the canonical live release. The real MediaRecorder, WordPress gateway, private R2 path, configured OpenAI transcription provider, and approved `concat` executor produced an editable transcript. The Founder assessed the returned transcript as:

`PASS — accurate and usable.`

This auditory and transcription-quality judgment belongs to the Founder, not Codex. The transcript and story were saved successfully. The Learning Lesson remained available. Reopening the Library preserved the story and transcript.

A distinct replay defect remains: the original saved audio did not play when the Founder reopened the story from the Library. This does not invalidate the successful recording/transcription canary and is tracked separately for a narrow follow-up investigation.

## Final Phase A state

- feature scope: `eligible_all`
- allowlist count: `0`
- cohort count: `0`
- broad eligible-student voice: ON for the existing trusted StoryForge-entitlement population
- reconciliation: OFF
- latest canary recording: attached to the saved Founder story
- permanent canary audio: one attached, referenced object; preserved as user content and replay-defect evidence
- transient database segments: `0`
- transient `storyforge-rec/` R2 objects: `0`
- HTTP 5xx after activation: `0`
- cross-user direct-ID request: denied with HTTP `404`
- Founder administrator voice capability: `false`
- ineligible WordPress identity: no StoryForge token issued
- anonymous session: HTTP `401`

The audited activation occurred through `POST /api/admin/features/voice_capture` at `2026-08-01T20:18:06.155Z`; PostgreSQL records the actor as the Founder administrator. No direct SQL update was used. Phase A is frozen complete against canonical release `v-21d896bc96f9c454`.
