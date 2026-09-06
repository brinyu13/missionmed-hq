# Y1-Y2-CAM-V6-3526 Physical Acceptance

## Current status

`PENDING — HUMAN SUBJECT REQUIRED`

Automated DSP, vision, state, browser, and deterministic acceptance is complete. This document intentionally does not convert deterministic evidence into a physical PASS.

## Launch

```sh
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/ivprep-v6
npm run start:3521-live-analytics
```

Open the printed localhost URL at `/iv-prep-on-call/live-analytics/` in Chrome. Use the current authenticated harness session. Click `START ANALYTICS`, allow camera and microphone, speak one sentence, and center the face until setup reports ready. Confirm metrics are already active before clicking `START INTERVIEW`.

## Three-to-five-minute script

| Step | Human action | Required visible result |
|---|---|---|
| 1 | Sit centered, then lean forward/back and turn slightly | Center overlay follows the subject; person lock survives a brief lean; teaching face/body models change state without receiving raw mesh lines |
| 2 | Show left hand, right hand, both hands, then hide both | Hands state follows `L`, `R`, `L+R`, and unavailable/visibility warning without inventing presence |
| 3 | Gesture naturally, then hold still while listening | Gesture activity/count rises only for separated observable events; listening stillness is not punished |
| 4 | Neutral mouth, mouth-only smile, then full smile with cheeks/eyes | Mouth-only does not increment a qualifying event; full-face pattern increments once; sustained smile does not repeat inside refractory period |
| 5 | Nod twice while interviewer/listening state is active, then nod while speaking | Listening nod count rises only in listening; speaking movement does not become a listening acknowledgment |
| 6 | Speak slowly for at least eight seconds, pause one second, then resume | Pace becomes numeric after trustworthy timestamps; brief pause holds rather than blanks; slow cue is `PICK UP PACE` |
| 7 | Speak normally, then quickly for at least eight seconds | WPM and 0–10 Pace move materially; target gives `HOLD`; fast speech gives `SLOW DOWN` |
| 8 | Speak quietly, normally, then loudly | Raw dBFS and Volume score move in the correct direction; silence is not scored as target; cues change `SPEAK UP` / `HOLD` / `EASE VOLUME` |
| 9 | Speak monotone, normally varied, then deliberately over-varied | Piano follows voiced F0; variety score and Pitch trace distinguish flat/healthy/excessive delivery |
| 10 | Whisper/unvoice or remain silent, then resume voiced speech | Current F0 becomes unavailable/gapped instead of fabricated; valid pitch recovers on voiced speech |
| 11 | Toggle one metric, Live Cues OFF, and Interview Only during capture | Presentation changes; camera, microphone, histories, and metric processing continue |
| 12 | Finish the answer | Derived-only post-answer card appears; raw media and transcript text are not retained by this runtime |

## Acceptance record

Fill during the physical session:

| Gate | Result | Evidence/notes |
|---|---|---|
| Real camera | PENDING | Human session not run in final tranche |
| Face/orientation | PENDING | Human session not run in final tranche |
| Body/hands/gesture | PENDING | Human session not run in final tranche |
| Real microphone | PENDING | Human session not run in final tranche |
| Real WPM slow/normal/fast | PENDING | Human session not run in final tranche |
| Real Volume quiet/normal/loud | PENDING | Human session not run in final tranche |
| Real Pitch monotone/varied/unvoiced | PENDING | Human session not run in final tranche |
| Vocal Variation history | PENDING | Human session not run in final tranche |
| 3522 conversational state | PENDING | Human session not run in final tranche |
| Visibility continuity | PENDING | Deterministic PASS; physical confirmation pending |

No physical item may be changed to PASS without observing the corresponding human action in the current runtime.
