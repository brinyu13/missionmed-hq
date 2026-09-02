# IVOC SHARED CONTRACTS

Owners: Analytics and Master jointly.
Version: `shared-contracts-v1`
6002 publication state: Master boundary recorded; Analytics capability
publication remains Analytics-owned.

## Ownership

- Analytics owns capture, objective detectors, event contracts, validation
  maturity, word timing, and the session clock.
- Master owns question/transcript alignment, semantic context, answer-stage
  interpretation, the Behavior Coaching Registry, CoachCommand arbitration,
  and report projections.
- Neither lane writes the other's source. Analytics does not emit
  CoachCommands or semantic congruence.

## Stable boundary used by 6002

- Event schema: `missionmed.ivprep.analytics.event.v1`.
- Accepted student-safe metrics: `answer_duration_ms`,
  `captured_level_dbfs`, and `digital_clipping_fraction`.
- Event identity: `eventId`, `sessionId`, `answerId`, monotonic
  `startMs/endMs`, objective observation, reliability, coverage, source, and
  maturity.
- Context schemas: `missionmed.ivoc.context.request.v1`,
  `missionmed.ivoc.context.analysis.v1`, and
  `missionmed.ivoc.context.result.v1`.
- Coach command: `missionmed.ivoc.coach-command.v1`.
- Behavior registry: `missionmed.ivoc.behavior-registry.v1`, registry
  version `2026-09-02.1`.

## Invariants

1. Context references immutable event ids; it never changes an Analytics event.
2. Monotonic session time is canonical; wall time is audit metadata only.
3. Transcript segments link to events after the fact; Analytics never needs
   transcript text and receives an empty transcript in 6002.
4. No raw pixels, PCM, landmarks, biometric templates, secret, or hidden-trait
   inference crosses this contract.
5. `UNSUPPORTED` and `UNAVAILABLE` block dependent coaching. There is no
   best-effort field guessing or zero/fixture substitution.
6. Only Analytics may promote a signal to student-safe maturity.
7. Master-derived values remain separately labeled and never reuse an
   Analytics metric name.
8. One dominant cue or `NO_CUE`; 6002 may reach only `SLOW_DOWN`,
   `PICK_UP_PACE`, `SPEAK_UP`, `EASE_VOLUME`, or `NO_CUE`.
9. Human Mentor commands outrank AI for their TTL plus refractory window.
   Future Mentor, Stream Deck, OBS, and mobile adapters must use the same
   CoachCommand contract.
10. No LLM-authored executable detector code. Future detector configuration
    is declarative, versioned, allowlisted, bounded, and server-validated.

## 6002 exclusions

Gesture meaning, dramatic-pause classification, pause coaching, eye-orientation
meaning, Mentor console, Stream Deck, OBS, transport, command persistence, and
registry persistence are excluded until Analytics publishes actual supporting
contracts and a successor authority activates them.

## Reporting

SIMPLE, ADVANCED, and EXPERT views must project the same stored Analytics truth
and the same ephemeral Context identity/provenance. A presentation layer may
hide detail but may not recalculate contradictory values.
