# 3528C Physical Acceptance

## Evidence actually observed

- Chrome acquired `FaceTime HD Camera` and `MacBook Pro Microphone` tracks in the real runtime.
- The production analytics engine entered live state.
- Audio stimulus changed real microphone-derived Volume/Vocal Variation signals during the run.
- The production Sherpa worker loaded after the vocabulary packaging repair and reported `LOCAL_SHERPA_WORD_TIMING_LIVE`.
- A real MediaRecorder blob was produced in the production session.

## Not yet truthfully accepted

No human remained at the camera/microphone for the complete scripted matrix. The camera view available during unattended validation was dark and contained no observable person. System speech was not treated as a substitute for a human slow/normal/fast WPM test.

| Physical action | Status |
|---|---|
| Center, lean, turn | PENDING |
| Left/right/both/hidden hands | PENDING |
| Effective/excessive gesture | PENDING |
| Neutral/mouth-only/full-face smile | PENDING |
| Listening nod vs speaking nod | PENDING |
| Thinking gaze release | PENDING |
| Quiet/normal/loud human speech | PENDING |
| Slow/normal/fast human speech | PENDING |
| Monotone/normal/exaggerated variation | PENDING |
| 1s/3s/long pause and recovery | PENDING |
| Voiced/unvoiced pitch behavior | PENDING |
| Record/pause/resume/stop/finalize/reopen | BLOCKED at final upload |

## Required rerun

After the CDN signing configuration is synchronized, open the existing production route in authenticated Chrome, retry the retained recording or start a fresh session, and complete the table above with a visible human. Fixtures and synthetic speech do not satisfy this gate.
