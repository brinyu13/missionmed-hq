# Y1-Y2-CAM-V6-3526 Complete Handoff

## Disposition

The real IV Prep On-Call Live Analytics runtime has been converged onto the Founder-approved Fable 3525 cockpit and is merge-ready except for the final physical-human camera/microphone script. No production deployment, Matrix activation, database mutation, paid-provider session, or donor-worktree mutation occurred.

| Field | Value |
|---|---|
| Branch | `codex/y1-y2-cam-v6-3521-live-analytics-runtime` |
| Product commit | `aac89b5fc066558dc1d01b23bca782b4057562fa` |
| Remote | exact at `aac89b5fc066558dc1d01b23bca782b4057562fa` |
| Real runtime | `ivprep-v6/public/live-analytics/` |
| Route | `/iv-prep-on-call/live-analytics/` |
| Local launch | `cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/ivprep-v6 && npm run start:3521-live-analytics` |
| Deterministic QA | append `?testInput=deterministic-local-signals` |
| Provider sessions | `0` |
| Production | not modified; not deployed |

## What converged

- The 3525 layout is the real runtime: anatomical Head/Face and Body teaching instruments, dominant 16:9 interview stage, right-side Pace/Volume/Piano Pitch, and a full-width three-trace Vocal Variation history.
- Camera and microphone measurement start from the explicit analytics-connect action before interview start. Starting the interview preserves measurement but starts the interview timer at `00:00`.
- Pace uses first-party, same-origin, memory-only local Sherpa ONNX word timestamps. The first decode window is four seconds; overlapping windows are deduplicated into a rolling articulation-rate stream. Short pauses hold the last trustworthy reading instead of flickering unavailable.
- Volume comes from real microphone PCM RMS/dBFS and is speech-gated. Silence cannot be presented as a good volume score.
- Pitch comes from validated F0 only. Unvoiced evidence is numeric-free. The student score represents speaker-relative vocal variation, while the piano shows current register relative to the speaker median.
- Vocal Variation stores bounded real Volume, Pitch, and Pace histories with `30S`, `1M`, `3M`, `5M`, and `FULL` views and independent trace controls.
- The left models are teaching visualizations driven by observable geometry; raw face/body/hand tracking remains confined to the center video overlays.
- Full-face smile events require simultaneous mouth and cheek/periocular activation, minimum duration, continuity, and an eight-second refractory period. Mouth-only motion does not qualify.
- Person lock now gives a true no-face occlusion five seconds of grace while ambiguous replacement candidates still fail closed on the shorter safety boundary.
- Live cues, individual metric visibility, rail visibility, Full Coaching, Interview Only, Simple, Standard, Lab, and Mentor presentation modes do not stop measurement.

## Verification

### Automated

- Syntax checks: PASS for every changed `.mjs` file.
- Diff hygiene: `git diff --check` PASS.
- Focused runtime suite: `156/156 PASS`.
- Combined analytics suite: `347/347 PASS`.
- Local route/provider guard: PASS; deterministic harness reports `PROVIDER_SESSIONS=0`.

### Browser

- Required viewport checks: `1626×968`, `1440×900`, and `1920×1080` PASS.
- Center video ratio: `1.777–1.778` at all three sizes; no document scroll at the required desktop sizes.
- Pre-interview measurement: PASS for deterministic Pace, Volume, Pitch, face, body, and hands.
- Pace first-result contract: `150 WPM`, `7.3/10`, `HOLD` after the four-second fixture window.
- Interview timer boundary: PASS; setup measurement remained active and the interview timer read `00:01` approximately 1.3 seconds after start.
- Inline tune controls: Pace, Volume, Pitch variation, and Gesture popovers open and update the personal corridor without changing raw measurement.
- Pace tune proof: the same `150 WPM` changed from `7.3/10` in `140–175` to `6.6/10` in `160–190`, with the sustained cue changing to `PICK UP PACE`; restoring the corridor restored the score mapping.
- Mentor drawer: PASS with raw WPM, dBFS, pitch variation, smile/nod/gesture counts, and claim boundary.
- Individual hide/restore and Live Cues OFF: PASS; presentation changed while capture/projectors remained owned.
- Interview Only: PASS; the cockpit collapsed to video-first presentation, kept a `16:9` stage, and raw metric values continued updating.

## Hostile-review disposition

| Reviewer | Disposition |
|---|---|
| Founder fidelity | PASS against frozen 3525 composition |
| Communication skills | PASS for action-oriented Pace/Volume/Variation cues; physical calibration remains pending |
| Human factors | PASS for density modes, cue toggle, visibility, and raw-secondary hierarchy |
| Computer vision | PASS for fail-closed lock, teaching-model separation, bounded proxies, and deterministic geometry; physical subject pending |
| Audio DSP | PASS for RMS, VAD, validated F0, word-timing provenance, and unvoiced gaps; physical subject pending |
| Interaction / AAA UI | PASS in required desktop viewports |
| Claim safety | PASS; no emotion, sincerity, honesty, personality, or confidence inference |
| Integration / regression | PASS, `347/347` |

## Remaining truthful gate

Physical-human acceptance is `PENDING`, not failed. The Founder was not available as a physical subject during the final acceptance tranche. The complete three-to-five-minute script is in `Y1-Y2-CAM-V6-3526_PHYSICAL_ACCEPTANCE.md`. No implementation or automated-test blocker remains.

## Preserved external state

The existing staged Fable 3524 package and unrelated untracked Fable/3523 artifacts were not reset, cleaned, stashed, or included in the product commit. `supabase/.temp/cli-latest` was restored from the automatic CLI side effect `v2.116.0` to its tracked exact value `v2.95.4`; no other unrelated path was changed.

## Companion records

- `Y1-Y2-CAM-V6-3526_PHYSICAL_ACCEPTANCE.md`
- `Y1-Y2-CAM-V6-3526_METRIC_TRUTH_MATRIX.md`
- `Y1-Y2-CAM-V6-3526_COACHING_SCALE_AND_CALIBRATION.md`
- `Y1-Y2-CAM-V6-3526_VISUAL_CONFORMANCE.md`
- `Y1-Y2-CAM-V6-3526_MAIN_APP_INTEGRATION_HANDOFF.md`
- `Y1-Y2-CAM-V6-3526_ROLLBACK.md`
