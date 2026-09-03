# Y1-Y2-CAM-V6-3526 Metric Truth Matrix

| Metric | Raw source | Classification | Live presentation | Hold/unavailable law | Physical acceptance |
|---|---|---|---|---|---|
| Pace / WPM | Same-origin, memory-only local Sherpa ONNX per-word timestamps | REAL observed timing; articulation WPM is DERIVED | 0–10 speedometer plus WPM and cue | First window at 4 s; brief pauses hold; prolonged timing loss becomes unavailable | PENDING |
| Volume / vocal energy | Microphone Float32 PCM RMS converted to dBFS | REAL measurement; 0–10 is calibrated coaching mapping | Large 0–10, raw dBFS, corridor and cue | Speech-gated; silence is explicit and never `HOLD`/target | PENDING |
| Pitch current register | Browser PCM F0 estimate with voiced validation | REAL F0 | Horizontal piano, speaker-relative current semitone position | Unvoiced frames contain no numeric F0; short visual hold is labelled held/unobserved | PENDING |
| Vocal variety | Rolling validated voiced F0 distribution, with loudness contribution defined in config | DERIVED from real audio | Large 0–10 in Pitch card and pitch trace | Withheld until sufficient voiced frames; no universal absolute-pitch target | PENDING |
| Vocal Variation volume trace | Speech-gated microphone level history | REAL history, normalized for display | Cyan continuous trace | Gaps/silence remain truthful | PENDING |
| Vocal Variation pitch trace | Validated F0/semitone history | REAL history, normalized for display | Orange continuous trace | Unvoiced samples are gaps | PENDING |
| Vocal Variation speed trace | Observed local timed-word stream | REAL timing, normalized for display | Green continuous/held trace | Short pauses may carry explicitly unobserved hold points; no synthetic WPM | PENDING |
| Face presence | Primary-associated face detection | REAL observable geometry | Presence tile and teaching-model state | Unavailable on missing/ambiguous primary | PENDING |
| Orientation/framing | Compact face/pose geometry and setup gate | DERIVED observable geometry | Center position guide, face/body teaching states | Dwell/hysteresis suppresses setup flicker; camera height is advisory | PENDING |
| Camera-facing balance | Head/gaze geometry dwell | PROXY, not eye contact | Facing/away distribution | No target and no social-quality claim | PENDING |
| Smile activity | Face smile geometry relative to personal baseline | DERIVED observable pattern | Anatomical mouth/cheek/eye region lighting | Neutral is not punished | PENDING |
| Qualifying full-face smile event | Mouth plus cheek/periocular activation, duration and refractory | DERIVED bounded event | Count inside Smile-pattern activity | Mouth-only does not qualify; no emotion/genuineness claim | PENDING |
| Blink events | Observable eyelid geometry | DERIVED count | Mentor/Lab detail | No target or penalty | PENDING |
| Listening nods | Head-pitch cycles gated to listening state | DERIVED bounded event | Listening-only count/rate | Speaking movement is excluded | PENDING |
| Body in frame | Primary-associated pose visibility/geometry | REAL observable geometry | Anatomical body region state | Missing/ambiguous primary fails closed | PENDING |
| Hands visible | Left/right hand geometry associated with the primary frame | REAL observable geometry | L/R/both state and hand region lighting | Missing hands are unavailable/visibility fault, not inferred intent | PENDING |
| Effective gesture event | Normalized hand/arm displacement, velocity, duration, separation and jitter suppression | DERIVED coaching event | Count, rate and corridor state | Rate withheld before 15 s speaking coverage; listening stillness not penalized | PENDING |
| Conversational state | First-party interviewer events plus microphone speech/VAD evidence | DERIVED state machine | Drives cues and state-aware interpretation | Supports listening, answering, short/long pause, transition and overlap when evidenced | PENDING |
| Note-taking context | Explicit user control only | REAL first-party context | Mentor/body context | Never inferred from camera movement | PENDING |

## Claim boundary

The runtime does not infer emotion, happiness, genuineness, sincerity, honesty, confidence, personality, hiring quality, gesture meaning, or note-taking intent. A displayed numeric score is a corridor-relative coaching transformation of a named observable, not a psychological judgment.
