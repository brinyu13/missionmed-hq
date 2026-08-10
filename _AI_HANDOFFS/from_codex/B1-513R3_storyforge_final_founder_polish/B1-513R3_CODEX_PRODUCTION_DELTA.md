# B1-513R3 Codex Production Delta

## Status

This is a **future implementation map only**. Production is unchanged and V2 was not deployed.

## Bounded UI delta after Founder acceptance

| Prototype refinement | Existing production-shaped contract to reuse | Expected bounded production seam |
|---|---|---|
| Dr Brian Recommends module | Governed Inspiration browse response, recommendation flag, existing answer route | Student Home renderer and namespaced styles only |
| Home progression HUD | Existing student story list, status values, canonical visibility | Student Home renderer and namespaced styles only; no new endpoint required |
| Mentor voice feedback presentation | Existing mentor-note draft, recorder, upload/transcribe, publish, playback URL, audit and authorization path | Mentor-note markup/styles and pause/resume UI wiring around the existing recorder |
| Premium consent experience | Existing GET/POST consent API, policy version, audit receipt, per-story visibility API | Consent renderer/styles; retain existing endpoints and server rules |
| Deferred Settings decision | Existing consent API and Settings policy entry | Render decision controls whenever consent is not accepted, including review entry |

## Production constraints

- Do not replace the sole StoryForge renderer.
- Do not create a second identity, entitlement, consent, visibility, mentor-note, audio, or playback authority.
- Do not let the browser determine authorization.
- Do not widen historical story visibility during migration or UI initialization.
- Do not couple mentor audio to separately gated photo/video Story Media.
- Do not expose internal/private admin notes through student list, detail, playback, logs, or serialized payloads.
- Preserve current WordPress → signed bootstrap/JWT → StoryForge API → PostgreSQL/RLS boundaries.
- Preserve immutable frontend release, hash verification, active pointer, rollback, kill switches, and existing provider/storage force-off controls until the authorized V2 release train reaches them.

## No backend/schema delta introduced by this prototype

R3 does not authorize or require a new endpoint, table, token claim, WordPress role, LearnDash rule, storage namespace, provider, or application identity. Any later production implementation must follow the accepted B1-513R2 mappings and Story Survival Contract.

## Required next gate

Founder visually accepts the six surfaces listed in `B1-513R3_COMPLETE_HANDOFF.md`. Only then may a separately authorized production implementation run translate the bounded prototype delta into source, migrations if already required by R2, tests, immutable release artifacts, backups, canaries, and rollback receipts.
