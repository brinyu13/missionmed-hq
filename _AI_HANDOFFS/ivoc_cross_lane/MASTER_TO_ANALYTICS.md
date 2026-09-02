# MASTER_TO_ANALYTICS

Owner: Master lane. Analytics lane: read only.
Version: master-requirements-v1
Master source base: `a74e9a6fe62cf44fba505e0b5a8af361cd7e6cbd`
Authority: `DR-168/169`

## Required for IVOC-CTX-6002

No Analytics implementation change is required. 6002 consumes only
`projectStudentEvents()` output from the existing
`missionmed.ivprep.analytics.event.v1` envelope:

- `answer_duration_ms`, unit `ms`;
- `captured_level_dbfs`, unit `dBFS`; and
- `digital_clipping_fraction`, unit `fraction`.

The server calls `projectStudentEvents()` and
`assertStudentProjection()`. Version mismatch, an unvalidated event, a
coverage/reliability failure, or any additional metric fails closed. Master
never passes transcript text into `AnalyticsSession.endAnswer()`, never
modifies an Analytics event, and never writes a Master-derived value back
under an Analytics metric name.

Master derives pace as transcript word count divided by
`answer_duration_ms / 60000`. It is labeled
`MASTER_DERIVED_FROM_TRANSCRIPT_WORDCOUNT_AND_ANSWER_DURATION`.

## Master V1 coaching policy, not an Analytics detector contract

The 6002 code registry uses the existing IV Prep pace corridor of 140-175 WPM.
It may select `SLOW_DOWN` above 175 WPM or `PICK_UP_PACE` below 140 WPM
only when the transcript and validated duration event are both available.

`SPEAK_UP` requires validated `captured_level_dbfs < -40` and carries the
explicit limitation that device capture is not calibrated loudness.
`EASE_VOLUME` requires validated
`digital_clipping_fraction >= 0.01` and describes digital clipping only.
These thresholds are Master product policy; Analytics is not asked to adopt,
calculate, or certify them. One cue wins by declared priority, otherwise
`NO_CUE`.

## Requested for later missions, no commitment implied

Analytics may answer any item `UNSUPPORTED`; that is a complete answer and
blocks dependent coaching.

1. Stable detector id/version or an explicit current source-engine mapping.
2. Event phase on the one monotonic session/answer timebase.
3. Whether `pause_episode` can reach validated student-safe maturity.
4. Observable gesture primitives: hand presence/zone/trajectory, palm
   orientation, hand-to-torso proximity, finger-count evidence, bilateral
   relation, wave periodicity, steeple/chin-contact candidates, repetition.
5. Dramatic-pause sequence primitives: speech end, silence, orientation
   release, re-engagement, speech resume, coverage, and reliability.
6. A versioned safe detector-config schema limited to allowlisted primitives,
   numeric bounds, temporal joins, and boolean combinators. No executable code.
7. Stable event identity for transcript alignment and Flight Recorder refs.
8. The stability posture of `live-metric-projector.mjs`.

## Boundary Master will honor

Analytics owns observation. Master owns semantic/context interpretation,
student-specific registry policy, reporting, and CoachCommand arbitration.
Master never asks Analytics to infer gesture meaning, gaze meaning, emotion,
intent, personality, honesty, or any hidden trait.
