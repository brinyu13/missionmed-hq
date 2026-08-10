# Y1-Y2-CAM-V6-3430 — Authenticated Live Interviewer Combined Handoff

## Final status

LIVEAVATAR VOICE COMPATIBILITY LIMITATION CONFIRMED

This status is grounded in current authenticated provider evidence. The exact
Dexter and W. Clint records both exist, but LiveAvatar LITE has no provider
voice-selection field: it synchronizes the PCM supplied by MissionMed. The
truthful audible voice in this architecture remains OpenAI `cedar`, not W.
Clint. A genuine Dexter media session could not start because the authenticated
account returned provider code `4033`, `Insufficient credits for session`.

## Authority and custody

- Mission: `Y1-Y2-CAM-V6-3430`.
- Fresh boot route: `MissionMed_OS/BOOT.md` → active mission → product authority
  index → `DR-036_y1_y2_cam_v6_3430_liveavatar_parallel_lane_authority.md`.
- Canonical authority commit:
  `62687826e3baaa3371cff06683bddde2281f334d`.
- DR-036 blob verified as
  `c028f86550fc6d9bc92c3e5803707633069fb4c0`.
- MR-079 command class: `DR-036#Exact-MR-079-command-classes`.
- Worktree:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3430`.
- Branch: `codex/y1-y2-cam-v6-3430-avatar-voice-aaa`.
- Resume base: `a41354b1aae54d673e2d6f6e4552ec1ab1c9d9ce`.
- No merge into canonical V6 and no changes to 3410/3410A, 3420R, accepted
  Conversation Rail/OpenAI providers, mic controller, models, or frozen V6.

## Secret boundary

The ignored `ivprep-v6/.env.local` was loaded only through the existing silent
server loader. Boolean-only evidence was:

| Input | Presence |
|---|---:|
| `LIVEAVATAR_API_KEY` | true |
| `OPENAI_API_KEY` | true |
| `LIVEAVATAR_LIVEKIT_ORIGIN` | false |

No credential value, token, session ID, provider URL, signaling origin, error
body, or scoped LiveKit credential was printed, logged, committed, persisted,
shown in the browser, or included here.

## Current authenticated target evidence

Two direct authenticated lookups used the exact IDs rather than catalog
enumeration. The live response success envelope uses provider code `1000`.

| Target | Exact ID | Current authenticated result |
|---|---|---|
| Dexter Doctor Sitting | `bd43ce31-7425-4379-8407-60f029548e61` | Exact ID/name match; type `VIDEO`; status `ACTIVE`; `is_expired=false`; provider default voice does not match W. Clint. |
| W. Clint Oxley | `a33a57ab-8388-49fc-a069-dbcfd1bc5405` | Exact ID/name match; language `en`; gender `male`. |

The verifier returns only these allowlisted fields and rejects a mismatched ID,
name, expired avatar, malformed envelope, or provider code other than `1000`.
Raw provider responses and unrelated assets are discarded.

## Exact provider constraint

LiveAvatar documents LITE as bring-your-own ASR/LLM/TTS with LiveAvatar
handling real-time video. Its LITE configuration contains `mode`, `avatar_id`,
video settings, and optional WebRTC infrastructure, but no provider voice
selector. MissionMed sends 24 kHz mono signed PCM through `agent.speak`; that
PCM is the audible identity. Consequently:

- W. Clint metadata availability does not make W. Clint audible in LITE.
- Dexter's provider default voice is not W. Clint.
- Supplying OpenAI `cedar` PCM makes cedar audible and lip-synchronized by the
  avatar provider; it cannot truthfully be labeled W. Clint.
- A FULL/Voice-Agent architecture could select provider voice/persona, but it
  would change the accepted intelligence boundary and was not substituted here.

Primary provider references:

- `https://docs.liveavatar.com/docs/lite-mode/configuration`
- `https://docs.liveavatar.com/api-reference/sessions/create-session-token`
- `https://docs.liveavatar.com/api-reference/sessions/start-session`
- `https://docs.liveavatar.com/docs/sandbox-mode`

## Founder mode steer and switch contract

- Default configuration: `LIVEAVATAR_MODE=lite`.
- Exact provider session value: `LITE`.
- Enabled delivery profile: `liveavatar-lite-supplied-pcm`.
- The only other current session value documented and accepted by the
  configuration parser is `FULL`, selected with `LIVEAVATAR_MODE=full`.
- LiveAvatar Embed is a separate hosted `/v2/embeddings` integration surface,
  not a valid `LIVEAVATAR_MODE` value. No `EMBED` session mode was invented.
- Unknown mode values fail server startup; `FULL` is recognized but returns a
  truthful `unsupported-mode` voice-only provider and makes no session request
  until a compatible mode driver is implemented.

Sanitized capability metadata is server-owned and immutable for an active
session:

| Capability | LITE adapter operational | FULL provider-documented / adapter operational |
|---|---:|---:|
| Supplied audio | true — PCM16/24 kHz/mono | unverified / false |
| Provider voice | false | true / false |
| Provider agent | false | true / false |
| Interrupt protocol | true | true / false |
| Listening control | provider documents true; adapter method false | true / false |
| Realtime video | true | true / false |
| Reconnect | true | unverified / false |
| MissionMed Conversation Rail ownership | true | blocked until custom-LLM/utterance bridge proof |
| Implementation/test status | implemented and unit/integration tested | not implemented; not live-tested |
| Usage class | `liveavatar-lite-session-minute` | `liveavatar-full-session-minute` |

`capabilities` means operational in the current MissionMed adapter.
`providerAdvertisedCapabilities` separately records current provider
documentation and never enables runtime behavior. Neither represents observed
perceptual quality. Lip-sync, visible mouth-stop latency, motion naturalness,
drift, and endurance still require live Founder observation.

Mode switching is behind the existing `AvatarProvider` lifecycle. Mode/profile
selection is server environment configuration, never a browser/session-body
override. The stable product contract remains configure, create, start,
capabilities, audio/stream delivery, interrupt, reconnect, health, usage, stop,
and close. The Interview Room, Conversation Rail, personas, Faculty Roster,
transcript, results, evidence, analytics, and student workflows do not require
redesign. A future FULL driver must normalize its media/control events and
prove MissionMed-owned intelligence before it can be marked implemented.

FULL and Embed were not implemented or tested in this run. LITE remains the
strongest accepted architecture because it directly preserves the required
MissionMed Conversation Rail → supplied audio → synchronized avatar flow.

## Authenticated session gate

Observed current flow, with all opaque values retained only in memory:

1. `POST /v1/sessions/token` with exact Dexter, `mode=LITE`, production mode,
   H264/high settings, and a 120-second cap: accepted; session token minted.
2. `POST /v1/sessions/start` with the scoped bearer token: rejected with HTTP
   403, provider code `4033`, sanitized provider condition `Insufficient credits
   for session`.
3. No start response, LiveKit signaling data, client token, control WebSocket,
   media room, video track, or audio track was returned.

The sandbox flag was also tested and rejected for Dexter. Current official
sandbox documentation explains why: only Wayne
(`dd73ea75-1218-4ef3-92ce-606d5f7fbc0a`) is available, sessions are about one
minute, and a production avatar requires removing the sandbox flag. Wayne was
not substituted for the Founder-locked Dexter target.

Because provider start failed before returning session connection data, the
exact LiveKit origin could not be derived. The new authenticated starter will,
after credits are available, validate the provider-returned signaling URL as
`wss`, credential-free, path/query/fragment-free, and an exact single-label
`*.livekit.cloud` host. It keeps the derived origin only in server process
memory, compares every start/reconnect response to it, and never loosens CSP or
the origin check globally.

## Implemented and hardened behavior

- Application-owned `AvatarProvider` seam remains the accepted configure,
  create, start, audio, stream, interrupt, reconnect, health, usage, stop, and
  close boundary. Only LiveAvatar is implemented.
- Exact Dexter is now the production default. Sandbox is not used for Dexter.
- `InterviewerAudioAuthority` is wired at runtime and exports sanitized history:
  only one of LiveKit, direct Realtime, or browser Speech may be audible.
- Responses + Speech avatar mode sends cedar PCM to LiveAvatar and suppresses
  browser playback. Voice-only mode preserves browser Speech. Realtime remains
  direct and visibly disables the avatar until the unified output sink exists.
- Each utterance retains one event ID; interruption invalidates it before
  `agent.interrupt`, and late chunks are rejected.
- Superseding speech awaits interruption before new avatar audio begins.
- Stream errors and empty streams interrupt and clear ownership.
- Live media readiness requires a rendered video frame, an audio track, and
  playable browser audio. Video subscription alone cannot claim live.
- Founder diagnostics distinguish video-track time, first rendered frame,
  audio-track time, audio-element playback, rail first audio, and provider
  control acknowledgement. They do not label control acknowledgement as mouth
  stop.
- Founder evidence export contains only target IDs, delivery truth, sanitized
  media/authority metrics, reconnect results, and cleanup state. An explicit
  Founder End automatically downloads a final copy after acknowledged cleanup,
  before results/home navigation.
- `TEST RECONNECT` provides a visible bounded control/media-readiness check.
- End waits for cleanup, retries an unconfirmed remote stop, distinguishes
  provider acknowledgement from local camera/mic release, and retains retry
  context if cleanup remains unconfirmed.
- The provider adapter requests remote stop before closing its local control
  socket. A successful-but-malformed start response is treated as a possibly
  billable session and remotely stopped before ownership is cleared; a provider
  rejection before media activation clears an unstarted token without
  pretending it was an active media session.
- Provider code `4033` is mapped to a fixed safe public condition and visible
  voice-only fallback.

## Founder build left running

URL: `http://127.0.0.1:8344/`

The process is loopback-only. Its current public state is:

- server authorization configured: true;
- default provider mode: exact `LITE` from `LIVEAVATAR_MODE=lite`;
- active delivery profile: `liveavatar-lite-supplied-pcm`;
- exact Dexter authenticated metadata verified: true;
- exact W. Clint authenticated metadata verified: true;
- locked W. Clint LITE compatibility: false;
- approved provider-returned LiveKit origin: false;
- live session block: `insufficient-credits`;
- fallback: OpenAI cedar voice only.

Fresh in-app browser verification confirmed:

- obvious splash CTA `TEST LIVE INTERVIEWER`;
- Founder Studio rail/model/voice/behavior controls;
- Founder-only truth displays `LiveAvatar · LITE · liveavatar-lite-supplied-pcm`;
- Founder diagnostics/evidence separate the profile's implemented/block state,
  operational capabilities, and provider-advertised capabilities;
- exact Dexter and W. Clint IDs visible;
- explicit cedar audible voice and browser audio authority;
- explicit LITE voice-selector limitation;
- Dexter roster status `PROVIDER CREDITS REQUIRED`;
- normal Camera + Mic → Station → Room journey remains reachable;
- no fake Dexter video is presented.
- ordinary Student entry shows no `LITE`, LiveAvatar, LiveKit, provider UUID, or
  delivery-profile terminology.

## Exact Founder steps

1. Open `http://127.0.0.1:8344/`.
2. Click **TEST LIVE INTERVIEWER**.
3. Confirm **HIGH-INTELLIGENCE FALLBACK**, `gpt-5.6-terra`, and cedar.
4. Confirm both locked IDs and `PROVIDER CREDITS REQUIRED`.
5. Click the Founder Studio **TEST LIVE INTERVIEWER** action.
6. Choose Camera + Mic or Mic Only and complete Station Check.
7. Enter the Room. The current build must remain visibly voice-only and must
   not show fake Dexter video.
8. After provider credits are provisioned, restart with
   `PORT=8344 npm run start:founder-authenticated`; the starter will derive the
   exact origin from the authenticated provider response, stop the bootstrap
   session, then enable the real Dexter path.

## Acceptance matrix

| Requirement | Result |
|---|---|
| Exact Dexter current authenticated metadata | VERIFIED |
| Exact W. Clint current authenticated metadata | VERIFIED |
| W. Clint compatible with MissionMed-owned LITE intelligence | INCOMPATIBLE — LITE has no provider voice selector |
| Production Dexter token mint | VERIFIED |
| Genuine provider media session | FAILED — provider 4033 insufficient credits |
| Provider-returned LiveKit origin | UNAVAILABLE — returned only after successful start |
| Real Dexter video / first rendered frame | NOT RUN |
| Arbitrary contextual avatar speech | NOT RUN; Conversation Rail generation remains verified separately |
| Observed lip-sync / listening motion / drift | NOT RUN |
| Duplicate-audio prevention | VERIFIED BY RUNTIME GUARD + TESTS; LIVE OBSERVATION NOT RUN |
| Barge-in stale-audio prevention | VERIFIED BY TESTS; LIVE MOUTH/AUDIO STOP NOT RUN |
| Reconnect | VERIFIED BY TESTS; LIVE NOT RUN |
| Voice-only fallback and no fake video | VERIFIED BY IMPLEMENTATION, TESTS, AND BROWSER |
| Repeated live sessions | NOT RUN |
| Remote media cleanup | IMPLEMENTED/TESTED; NO MEDIA SESSION STARTED IN AUTH RUN |
| 10–15 minute endurance | DELIBERATELY NOT RUN — short live gate failed |
| Secret safety | VERIFIED |
| Frozen baseline / parallel lanes | VERIFIED |

## Verification and regression

- `npm run check`: PASS.
- `npm test`: 97/97 PASS.
- `git diff --check`: PASS.
- Authenticated exact-target probe: PASS for both locked metadata records.
- In-app Founder fallback journey: PASS.
- Protected frozen/rail/model/mic hashes remain unchanged, including frozen V6
  HTML SHA-256
  `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`.

## Unified V6 integration contract

3430 did not change 3410/3410A. The future reconciliation ticket should keep
the accepted Conversation Rail intelligence boundary and add one normalized
output sink:

```text
{ eventId, pcm16, sampleRateHz: 24000, channels: 1, final }
+ transcript/state/cancel events
```

- Avatar sink owns LiveAvatar PCM and LiveKit playback; direct AudioContext is
  suppressed.
- Direct sink preserves existing Realtime or Speech playback.
- Barge-in ordering is rail cancel/truncate → generation invalidation → avatar
  interrupt with the same event ID → observed media/mouth stop → listening →
  resume.
- Transcript, observer, persistence, and results remain independent of playback.
- Realtime output-sink reconciliation remains owned by the unified V6 ticket.

## Rollback

All changes are inside the DR-036 3430 allowlist. The frozen baseline is
unchanged. Roll back with a reviewed revert of the final 3430 feature commit;
do not selectively copy shared seams without the unified reconciliation ticket.
