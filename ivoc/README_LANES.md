# IVOC convergence lanes

F1 is the sequential contract foundation for `IVOC-CONVERGE-8001`. It is
isolated source behavior at base `c3d6c9c`; it is not a database, route,
provider, physical-device, deployment or production acceptance claim.

## F1 ownership

- `ivoc/contracts/**`: versioned session, timeline, pool, result and coaching
  evidence contracts.
- `ivoc/core/**`: deterministic in-memory reference Spine, session state and
  capture-owner clock used by fixtures and later adapters.
- `ivoc/orchestrator/core/**`: one runtime state machine, teardown order and
  `audio_authority = none` for Prompted Mock.
- `ivoc/brain/prompted/**`: deterministic question-card Director supporting
  only explicit Next or spacebar input.
- `ivoc/fixtures/**`: synthetic, non-deliverable contract fixtures.

## Held lanes

Analytics, media/transcript/projectors, presentation, realtime conversation,
Fabric, embodiment, production routes and migrations remain held for their
registered successor tranches. Existing `ivprep-v6/**`, `missionmed-hq/**`,
`supabase/migrations/**`, Matrix, provider configuration and deployment files
are read-only in F1.

## Invariants

One session ID, one capture-owner clock, append-only idempotent events,
optimistic state versions, deterministic Prompted Mock questions, no provider
session, no audible stream, and teardown that attempts every step even after a
failure.
