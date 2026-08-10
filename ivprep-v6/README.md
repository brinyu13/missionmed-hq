# MissionMed IV Prep On-Call V6

This directory contains the isolated local V6 integration candidate for
Y1-Y2-CAM-V6-3401 and its accepted successors, including the 3402 local
Founder Alpha adapter and roster.

- `baseline/IV Prep OnCall_V6.html` is the byte-for-byte accepted Fable V6
  source and must remain unchanged.
- `public/index.html` begins as an identical runtime copy and receives bounded
  additive integration seams. The 3420R lane also adds isolated browser
  modules and styling under `public/analytics/` plus pinned same-origin assets
  under `public/vendor/mediapipe/`.
- `server/`, `providers/`, `config/`, and `test/` are isolated alpha runtime
  code. They do not modify the MissionMed production runtime.

No production route or deployment is authorized by this directory.

The 3403 release audit found no registered IV Prep private-preview route,
product passport, deployment authority, or online founder-auth contract. The
application therefore remains a loopback-only Founder Alpha. Server shutdown
now closes the avatar provider independently, and sessions that reach their
hard cap are durably entered in the usage ledger.

## Local launch

Run `npm install && npm start` in this directory, then open
`http://127.0.0.1:8420/`. Port 8420 intentionally avoids the existing donor
proof on port 8320. The server refuses non-loopback hosts.

## 3402 provider truth

The stock avatar `Dexter Doctor Sitting` is verified active through the public
LiveAvatar catalog as `bd43ce31-7425-4379-8407-60f029548e61`. The previously
supplied apparent UUID is not used. The integration uses LiveAvatar LITE so
MissionMed continues to own interviewer intelligence, conversation state, and
OpenAI Speech voice `cedar`.

`LIVEAVATAR_API_KEY` is currently required to start live video and must remain
server-side. Without it, the UI visibly reports avatar unavailability and
continues only in voice-only mode. `W. Clint Oxley` is verified as LiveAvatar
voice ID `a33a57ab-8388-49fc-a069-dbcfd1bc5405`, bound to the `Dr Bastos`
LiveAvatar Voice Agent. Dr Bastos is not a custom visual avatar and its managed
voice-agent pipeline is not used because V6 LITE must keep intelligence and
OpenAI Speech outside the visual provider; `cedar` remains the canonical
OpenAI Speech voice.

The server loads an ignored `ivprep-v6/.env.local` without overriding values
already supplied by its parent process. After a founder creates a LiveAvatar
API key and saves it there, `npm run probe:liveavatar-origin` starts and closes
one bounded LITE session and prints only the exact LiveKit origin needed for
`LIVEAVATAR_LIVEKIT_ORIGIN`; it never prints provider credentials or scoped
session tokens.

Local session evidence is stored under `.alpha-data/`, which is ignored by
Git. It contains transcripts and instructor records, not merely metadata. The
runtime enforces one active interview per test identity, a 120-second beta
default and hard cap, a usage ledger, and emergency disable. This local role
gate is not authentication and does not authorize a private deployment.

## 3410 experimental conversation rail

The founder-only Conversation Rail control now exposes two application-owned
paths without changing the accepted interview screens:

- `CONTINUOUS CONVERSATION` uses one long-lived, server-authenticated
  `gpt-realtime-2.1` session with 24 kHz PCM audio, `semantic_vad` at low
  eagerness, `gpt-4o-mini-transcribe`, provider interruption, and OpenAI
  Realtime voices. Browser code connects only to the same-origin IV Prep relay;
  it never receives an OpenAI credential.
- `HIGH-INTELLIGENCE FALLBACK` keeps the proven Responses + OpenAI Speech path
  with `gpt-5.6-terra` or `gpt-5.6-sol`, typed recovery, local five-second
  silence completion, observer, results, and evidence unchanged.

`GPT-Live` is shown as unavailable (`provider_api_not_available`) rather than
being simulated. Rail selection is locked during an active interview, and a
Realtime failure offers an explicit visible return to the fallback rail for a
new interview. The fallback remains the default while founder naturalness
testing continues.

For the 3410 founder build, run:

```sh
HOST=127.0.0.1 PORT=8320 npm start
```

Then open `http://127.0.0.1:8320/`. The authenticated synthetic checks are
`npm run probe:continuous-relay` and `npm run probe:continuous-pauses`; neither
prints provider credentials. The pause probe is deliberately advisory because
synthetic TTS does not replace real founder microphone evaluation.

## 3420R multimodal communication analytics

Y1-Y2-CAM-V6-3420R adds one local, consent-based analytics lane for observable
voice delivery, between-speech pauses, hand movement, posture, head position,
camera framing, and facial movement. MissionMed Ops users can open **Test
Communication Analytics** for the guided Founder test. The ordinary interview
reuses the existing camera, microphone, recording, and replay lifecycle; the
analytics code does not open a second media capture and does not touch the
Continuous Conversation or LiveAvatar providers.

The maturity boundary is deliberately narrow:

| Surface | Signals | Maturity |
| --- | --- | --- |
| Your Results | answer duration, captured microphone level, digital clipping | `VALIDATED_STUDENT_SAFE` |
| Founder test only | detected speech timing, silence between speech, energy variation, transcript-derived word rate/fillers, hands, posture, head position, camera-facing proxy, framing, and facial movement | `FOUNDER_EXPERIMENTAL` |
| Never presented as analytics | zero-crossing pitch, eye contact, emotion, intent/purpose, confidence, and semantic gesture meaning | `REJECTED_UNRELIABLE` |

There is no communication score. A camera-facing proxy describes head position,
not gaze or eye contact. Facial analysis measures movement only and never names
emotion, personality, health, or identity. Silence events never claim why a
person paused. Student results are projected through the sealed validation
registry; an unsealed, low-coverage, short, unavailable, or mismatched signal
fails closed and stays out of **Your Results**.

The 3420R persistence projection is equally narrow: only sealed
`VALIDATED_STUDENT_SAFE` summaries may enter saved demo-local rep metadata.
Founder experimental timestamped evidence and diagnostics remain in tab memory
for the active result/test experience and are not written to local storage or
the alpha-session store.

All MediaPipe runtime, WASM, and model files are pinned and served from this
loopback origin. Compact geometry is derived inside a worker; raw frames,
landmarks, blendshape vectors, PCM, embeddings, and biometric templates are not
returned to, serialized by, or persisted by analytics. A same-origin worker
network guard plus CSP blocks the MediaPipe package's external utilization
logger. Optional Founder replay is off by default and, when enabled, remains a
tab-memory audio/video blob owned by the existing local media experience.

Run locally:

```sh
HOST=127.0.0.1 PORT=8420 npm start
```

Materialize/verify the pinned assets, then verify the bounded implementation:

```sh
npm ci
npm run check
npm test
npm run analytics:assets
npm run analytics:validate
npm run analytics:privacy
npm run analytics:performance
```

The deterministic fixture seal validates only clock and digital-audio
observations. Promotion of pauses, voice-activity interpretation, transcript
metrics, or any visual signal requires a later, consented held-out ground-truth
package and an explicit registry update. This worktree has no deployment or
production-route authority and remains an integration candidate for the later
unified V6 reconciliation ticket.

The current Founder experiment does not claim explicit no-hands/no-gesture or
repetition episodes, forward/back lean, camera distance/headroom/lighting, or
rolling pacing changes. Founder WPM is unavailable unless an existing interview
transcript is supplied. These are visible limitations, not simulated values.
