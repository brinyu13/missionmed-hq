# IVOC-CTX-6002 Fable 5 AAA Input

Date: 2026-09-02
Product: MissionMed IV Prep On-Call
Stage: working production-shaped Context Intelligence V1 candidate

## Live surface

https://missionmed-hq-production.up.railway.app/iv-prep-analytics/#/context-lab

Access is restricted to MissionMed administrators and currently entitled IV Prep 360 users through the existing Matrix / WordPress / LearnDash / WooCommerce identity and entitlement path.

## Fable goal

Redesign the working Context Intelligence V1 experience into a coherent AAA interview-coaching flow. Preserve the real runtime, data boundaries, access gate, private recording path, Analytics truth, semantic evidence rules, and one-cue cognitive-load law. Improve comprehension, emotional clarity, spatial hierarchy, progress feedback, recovery, and post-answer insight without creating fake capabilities.

## State map

1. Authenticated candidate preparing.
2. Real corpus question ready.
3. Camera and microphone permission / device initialization.
4. Live capture with real Analytics.
5. Ending and sealing the existing private recording.
6. Analytics saved; server transcription and Context running.
7. Success result: real transcript, semantic observations, objective Analytics, MASTER_DERIVED pace, one cue, provenance, limitations.
8. Fail-closed result: transcript UNAVAILABLE, Context unavailable, NO_CUE, explicit reason.
9. Logged-out or unauthorized denial.

## Real contracts Fable must not break

- Question identity is server-selected from the 193-question corpus. CORE-01 revision 1 is the V1 proof.
- Student-safe Analytics events are immutable references: answer_duration_ms, captured_level_dbfs, digital_clipping_fraction.
- Pace is MASTER_DERIVED, not an Analytics-native detector.
- Context observations must cite actual transcript segment IDs.
- Do not display inferred emotion, affect, hidden traits, diagnosis, or semantic gesture meaning.
- One dominant live CoachCommand only.
- Allowed V1 cues: SLOW_DOWN, PICK_UP_PACE, SPEAK_UP, EASE_VOLUME, NO_CUE.
- Registry is declarative and versioned. No LLM-generated executable detector code.
- Transcript, Context output, registry assignment, and CoachCommand are ephemeral in this tranche.
- OpenAI keys and provider requests remain server-only.
- Real recording and Analytics persistence remain on the existing private path.
- Access remains Admin plus currently entitled 360; do not create another login or entitlement system.
- Context failure must not fail the underlying Analytics session.

## Real now versus deferred

| Capability | Real now | Deferred | Notes |
| --- | --- | --- | --- |
| Matrix identity and gate | Yes | Broader cohorts | Admin plus active 360 only |
| Real question | Yes | Question-selection redesign | 193-question server corpus |
| Camera, microphone, recording | Yes | Device UX polish | Existing private recording path |
| Analytics events | Yes | New detectors | Frozen answer event projection |
| OpenAI transcription adapter | Yes | Provider upgrades | Default whisper-1, server-configurable |
| Context provider | Yes | Follow-up conversation | Default gpt-5.6-terra, strict schema |
| Behavior registry contract | Yes | Persistent student assignments | Version 2026-09-02.1 |
| One-cue arbitration | Yes | Mentor, OBS, Stream Deck sources | Single AI command in V1 |
| Simple Results | Yes | Advanced and Expert projections | Same truth must underlie all depths |
| Purposeful gesture meaning | No | After Analytics contract | Must stay visibly unavailable |
| Dramatic pause | No | Multimodal semantic sequence | Must not classify ordinary silence |
| Mentor live console | No | Later Master tranche | Same CoachCommand bus |
| Avatar / LemonSlice | No | Later provider tranche | Do not imply provider embodiment |

## Evidence

The live deployment is c322eee1-4ca2-456c-a9f4-09f6705eb16b.

Observed live states:

- Authenticated entitled 360 candidate with CORE-01 ready.
- Real camera video and microphone capture live.
- Sealing / completing Analytics.
- Fail-closed Simple Results with transcript UNAVAILABLE and NO_CUE after the deliberately oversized 464-second test artifact crossed 25 MB.
- Successful Simple Results from a bounded 22-second, 6.6 MB recording: transcript REAL, eight evidence-cited segments, all three objective Analytics observations at 100 percent coverage, 79.3 MASTER_DERIVED WPM, and one PICK_UP_PACE command from registry 2026-09-02.1.

Durable implementation evidence:

/Users/brianb/MissionMed_worktrees/ivoc-context-6002/_AI_HANDOFFS/from_codex/IVOC-CTX-6002_LIVE_CONTEXT_BUILD_DEPLOY_HANDOFF.md

The successful full-page result screenshot was captured in the Codex task browser evidence and the live result tab was preserved for Founder review. No sensitive transcript screenshot was written into the repository. Fable should capture its own approved reference set from the live route during the design pass.

## Complete 102-entry visual archive

/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/_AI_HANDOFFS/from_codex/IV_PREP_COMPLETE_VISUAL_HISTORY_20260902

Start at:

/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/_AI_HANDOFFS/from_codex/IV_PREP_COMPLETE_VISUAL_HISTORY_20260902/AUDITOR_START_HERE.md

The archive contains 102 distinct entries: 92 legacy entries, 10 later generations, 22 curated semantic/context-aware Interview AI generations, and 11 LemonSlice/LiveAvatar/provider-seam generations.

## Recommended donor shortlist

1. VG-102 / 3521 Live Analytics: current Analytics truth and instrument density; treat as dependency, not Master source.
2. VG-101 / 3528C Codex runtime: latest continuous 0-10 voice plot integration and hosted candidate DNA.
3. VG-100 / 3528B Claude visual rebuild: current cockpit visual system.
4. VG-065 / 3451: contextual conversation product UX.
5. VG-062 / 3410: continuous contextual conversation.
6. VG-063 / 3420R: conversation plus multimodal Analytics.
7. VG-067 / 3440: integrated seams; reference only because donor custody is protected.
8. VG-050 / 3200 and VG-051 / 3205: InterviewBrain and provider/schema lineage.
9. VG-095 and VG-096: Fable Analytics and redraw explorations.

Visual references are not provider proof. Do not imply that LemonSlice, LiveAvatar, Mentor console, OBS, Stream Deck, semantic gesture detection, or dramatic pause is operational.

## Known UX weaknesses

- The route is not yet surfaced at a first-class custom Matrix domain; it is reached through the existing authenticated handoff to Railway.
- Startup gives limited progress detail while camera, microphone, and Analytics models initialize.
- Sealing, Analytics finalization, transcription, and semantic analysis need a clearer staged progress experience.
- The functional layout leaves substantial unused space and does not yet feel like one authored interview journey.
- Success and fail-closed Results need stronger hierarchy without hiding provenance or limitations.
- A long answer can cross the 25 MB provider boundary; UX should disclose or prevent overruns without encouraging rushed answers.
- Recovery and retry should be obvious and should never risk duplicate persistence.
- Accessibility, mobile composition, focus order, and reduced-motion treatment need a dedicated visual pass.

## Non-negotiable product law

Complex analysis in; simple coaching out. Purposeful gestures are not more movement. Analytics observes motion; Context understands the moment; the Behavior Registry defines what matters for this student; the CoachCommand arbiter decides whether to intervene; the Mentor may eventually override through the same bus; the Flight Recorder eventually preserves the event.

Fable should redesign a working machine, not produce another hypothetical prototype.
