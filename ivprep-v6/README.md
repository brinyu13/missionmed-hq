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
runtime enforces one active interview per test identity, a 15-minute default,
a 20-minute hard cap, a usage ledger, and emergency disable. This local role
gate is not authentication and does not authorize a private deployment.
