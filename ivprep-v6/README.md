# MissionMed IV Prep On-Call V6

This directory contains the isolated local V6 integration candidate for
Y1-Y2-CAM-V6-3401 and its accepted successors, including the 3402 local
Founder Alpha adapter and the isolated 3430 live-interviewer integration lane.

- `baseline/IV Prep OnCall_V6.html` is the byte-for-byte accepted Fable V6
  source and must remain unchanged.
- `public/index.html` begins as an identical runtime copy and is the only V6
  product surface modified by the local integration.
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
`http://127.0.0.1:8343/`. Port 8343 intentionally avoids the existing donor
proof on port 8320. The server refuses non-loopback hosts.

## 3430 live-interviewer truth

The Founder-locked stock avatar target is `Dexter Doctor Sitting`, exact ID
`bd43ce31-7425-4379-8407-60f029548e61`. That ID is the application default and
any mismatched `LIVEAVATAR_AVATAR_ID` override fails closed. MissionMed retains
interviewer intelligence and conversation state; LiveAvatar is a media
provider, never the conversation brain.

### LiveAvatar operating mode

`LIVEAVATAR_MODE=lite` is the 3430 default for development, Founder testing,
integration testing, and initial acceptance. Configuration is normalized to
the provider's exact API value `LITE`; `LIVEAVATAR_MODE=full` is recognized as
the exact value `FULL` but currently fails closed to voice-only because its
MissionMed Conversation Rail bridge has not been implemented or tested.
Unknown values are rejected. LiveAvatar Embed is not accepted as a mode: the
current provider documents it as a separate hosted `/v2/embeddings` surface.

The application-owned delivery-profile registry exposes capabilities instead
of making the Interview Room branch on provider mode. The enabled
`liveavatar-lite-supplied-pcm` adapter reports supplied PCM, interrupt,
realtime video, reconnect, and LiveKit transport support; provider voice,
provider-agent ownership, and an application listening-control method are
false. Provider-documented capabilities are recorded separately from adapter
capabilities. `FULL` is a future, disabled profile: LiveAvatar documents voice,
agent, interrupt, listening, and realtime-video capabilities, while every
operational adapter capability remains false until a mode driver exists. It
cannot be enabled until an authenticated custom-LLM or utterance bridge proves that
MissionMed retains interview intelligence, transcript, results, evidence, and
turn control. Usage records include a separate mode-specific usage class;
pricing is not hard-coded into the application.

Founder diagnostics and evidence show the exact active provider mode and
delivery-profile ID. Ordinary interview status copy remains provider-neutral.
An unsupported `FULL` selection starts this Founder launcher in an explicit
`unsupported-mode` voice-only state and makes no LiveAvatar session request.
Changing the registered delivery profile later does not change the
Conversation Rail, Faculty Roster, Interview Room, transcript, results,
analytics, or student workflow contracts.

`LIVEAVATAR_API_KEY` is required to start live video and must remain
server-side. Current authenticated metadata verifies the exact Dexter record as
active and non-expired. The Founder-locked voice target is `W. Clint Oxley`, exact ID
`a33a57ab-8388-49fc-a069-dbcfd1bc5405`. Previous authenticated metadata bound
that voice to the `Dr Bastos` Voice Agent, and fresh authenticated metadata now
verifies the exact W. Clint record. LITE exposes no provider voice selector:
the audible identity is the PCM MissionMed supplies. The current path therefore
truthfully sounds like OpenAI `cedar` and never relabels it as W. Clint.

The current Founder account accepts a production LITE token for Dexter but
returns provider code `4033` (`Insufficient credits for session`) before media
start. LiveAvatar's current sandbox cannot substitute because it permits only
the Wayne avatar, not Dexter. The UI therefore labels Dexter `PROVIDER CREDITS
REQUIRED` and keeps the interview on the visible cedar voice-only fallback.

For the isolated 3430 Founder build, run
`LIVEAVATAR_MODE=lite PORT=8344 npm run start:founder-authenticated`, then open
`http://127.0.0.1:8344/` and click **TEST LIVE INTERVIEWER**. It selects
`Dexter · MissionMed AI Faculty`, preserves the
normal camera/microphone permission and station checks, exposes Conversation
Rail selection, and shows the actual audible voice and audio authority before
Start. It does not use the prototype's randomized join/camera/small-talk chain.
The visible disclosure states that Dexter is a provider stock AI interviewer,
not a real physician.

Exactly one audible interviewer stream is permitted:

- Responses + Speech with a connected avatar sends 24 kHz mono PCM to
  LiveAvatar and uses the LiveKit audio/video publication as playback authority.
  Raw OpenAI audio is not also played.
- Voice-only fallback uses browser OpenAI Speech playback and presents no fake
  video.
- The accepted Realtime rail currently retains direct Realtime playback and
  visibly disables LiveAvatar. The later unified V6 ticket must supply a
  normalized output-audio sink before Realtime can drive the avatar without
  duplicate audio.

Every avatar command is bound to the owning alpha session and provider session.
Interruption carries an utterance event ID; the provider invalidates it so late
PCM cannot restart cancelled speech. A live claim requires video, an audio
track, and browser audio playback. Track loss degrades visibly, bounded
reconnect is attempted, and provider failure retries the already-generated
utterance once through voice-only playback after stopping avatar media.

The server loads an ignored `ivprep-v6/.env.local` without overriding values
already supplied by its parent process. `npm run start:founder-authenticated`
verifies both locked records, starts one bounded production Dexter session,
derives and validates the provider-returned `*.livekit.cloud` signaling origin
only in process memory, requires acknowledged cleanup of that bootstrap
session, and then starts the local server. It never prints provider URLs,
credentials, session IDs, or scoped tokens. If the provider reports
insufficient credits before media start, it starts the truthful authenticated
voice-only Founder build instead.

The normal product hard cap remains 120 seconds. Dexter is unavailable in
sandbox, so the separately authorized single production transport endurance runner is
`npm run probe:avatar-transport-endurance -- --minutes=10` (10–15 minutes
only). It uses the LITE supplied-PCM path, tests control reconnect and
late-audio rejection, sanitizes output, and explicitly does **not** constitute
browser video, lip-sync, or W. Clint acceptance. Do not spend the single long
provider session until short live media acceptance succeeds.

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

## Future unified V6 integration contract

3430 does not modify the 3410/3410A rail implementation. The reconciliation
ticket should keep the accepted `ConversationRail` intelligence boundary and
add one replaceable output sink shaped around normalized events such as
`{ eventId, pcm16, sampleRateHz: 24000, channels: 1, final }` plus transcript,
state, and cancellation events. In avatar mode the sink owns LiveAvatar PCM
delivery and suppresses direct AudioContext playback; in direct mode existing
Realtime or Speech playback remains unchanged. Transcript authority and
persistence stay independent. Barge-in ordering is rail cancel/truncate,
generation invalidation, avatar interrupt with the same event ID, observed
media stop, listening state, then clean resume.
