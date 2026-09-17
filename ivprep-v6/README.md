# MissionMed IV Prep On-Call V6

This directory contains the isolated local V6 integration candidate for
Y1-Y2-CAM-V6-3401 and its accepted successors, including the 3402 local
Founder Alpha adapter and roster.

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

## 3410 Founder Alpha conversation rail

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
new interview. After successful founder spoken-microphone acceptance,
Continuous Conversation is the Founder Alpha default whenever authenticated
Realtime capability is available. High-Intelligence Voice becomes the explicit
default only when Realtime is unavailable; this is not a production promotion.

For the 3410 founder build, run:

```sh
HOST=127.0.0.1 PORT=8320 npm start
```

Then open `http://127.0.0.1:8320/`. The authenticated synthetic checks are
`npm run probe:continuous-relay` and `npm run probe:continuous-pauses`; neither
prints provider credentials. The pause probe is deliberately advisory because
synthetic TTS does not replace real founder microphone evaluation.

## 3451 AAA UX/product prototype

The founder-review prototype is an additive visual/product lane at
`/aaa/index.html`. It does not replace or restyle the accepted live V6 at `/`.
The prototype includes the complete student journey—assignment, Instant
Interview, interview designer, explicit Start Interview control, room,
results, transcript-word Vault search, mentor review, application-aware prep,
program prep, one-question-at-a-time debrief, and a local admin playbook.

Prototype fixtures are synthetic and remain in browser memory. The prototype
does not claim a provider call, live media replay, account persistence, mentor
delivery, production analytics, or cross-product hydration. Its room links
directly to the preserved 3410 V6 whenever the founder wants to test the real
continuous `gpt-realtime-2.1` conversation rail.

Launch both surfaces from this isolated worktree:

```sh
HOST=127.0.0.1 PORT=8351 npm start
```

Then open:

- AAA founder prototype: `http://127.0.0.1:8351/aaa/index.html`
- accepted live V6/Realtime rail: `http://127.0.0.1:8351/`

The server remains loopback-only. This is a founder approval artifact, not a
private preview or production deployment.
