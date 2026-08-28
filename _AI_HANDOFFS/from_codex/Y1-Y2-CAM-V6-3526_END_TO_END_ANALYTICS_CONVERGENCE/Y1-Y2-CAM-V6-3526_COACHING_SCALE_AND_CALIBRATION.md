# Y1-Y2-CAM-V6-3526 Coaching Scale and Calibration

## MissionMed Live Scale

Pace, Volume, and Vocal Variety present a dominant `0.0–10.0` student score while retaining the engineering measurement as secondary evidence. `mapToLiveScale` maps the personal corridor exactly to the Founder-required target band:

- observed minimum domain → `0`
- personal corridor minimum → `7`
- corridor midpoint → `7.5`
- personal corridor maximum → `8`
- high cap → `10`

Values outside the display domain are clamped only for the marker/score. Raw measurements are not changed or clipped by the coaching layer.

## Current session defaults

| Instrument | Default personal corridor | Secondary evidence | Coaching law |
|---|---|---|---|
| Pace | `140–175 WPM` | observed articulation WPM | below: `PICK UP PACE`; inside: `HOLD`; above: `SLOW DOWN` |
| Volume | `-30 to -18 dBFS` | speech-gated RMS/dBFS | quiet: `SPEAK UP`; inside: `HOLD`; loud: `EASE VOLUME` |
| Vocal variety | `2.5–4.5 st` variation | speaker-relative F0/semitone statistics | flat: `ADD VOCAL VARIETY`; inside: `HOLD`; erratic: `STEADY DELIVERY` |
| Effective gestures | `6–14 / speaking minute` | event count and speech-coverage denominator | low/target/excessive only while answering; listening stillness is neutral |

These are starting corridors, not universal medical-interview truths. Mentor/Admin can tune each corridor inline. Changes immediately update target markers, score mapping, and the sustained coaching-zone candidate without altering measurement.

## Stability controls

- Student display render cadence: 1 Hz with 300 ms visual easing.
- Coaching-zone change: dwell and hysteresis before a corrective cue.
- Cue refractory behavior prevents nagging after a transition.
- Pace remains valid across a brief natural pause using a bounded last-trustworthy hold; extended timing loss fails unavailable.
- Volume is speech-gated; silence cancels good-volume coaching.
- Vocal variety requires enough validated voiced evidence; unvoiced audio never creates pitch.
- Gesture rate is withheld until at least 15 seconds of speaking coverage and uses a 45-second rolling window.
- Full-face smile events use 700 ms answering duration, cheek/periocular participation, and an eight-second refractory period.

## Persistence boundary

The Live Cues preference uses session storage. Visibility stores only an allowlisted presentation schema. Baseline storage retains derived scalars keyed to admitted subject/device profile; it does not retain raw audio, video, landmarks, transcript text, or PCM. Main-app integration should replace browser-only calibration persistence only after a reviewed derived-only server contract exists.
