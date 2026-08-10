# Y1-Y2-CAM-V6-3430 — Live Interviewer Avatar + Voice Combined Handoff

## Final status

BLOCKED ON LIVEAVATAR HUMAN AUTH

This status is deliberately narrower than “feature failed.” The 3430 lane now
contains a tested provider seam, truthful Founder surface, single-audio
authority, event-scoped interruption, fallback, reconnect, repeated-session
cleanup, and a separately bounded endurance runner. The current server
environment does not contain LiveAvatar authorization or an approved LiveKit
origin, so this run did not authenticate to LiveAvatar and cannot truthfully
claim current Dexter availability, W. Clint compatibility, live video,
observed lip-sync, actual mouth-stop latency, or 10–15 minute provider media
stability.

## Authority and custody

- Mission: `Y1-Y2-CAM-V6-3430`.
- Fresh Engineering OS resolution used canonical authority commit
  `62687826e3baaa3371cff06683bddde2281f334d`.
- Decision: `DR-036_y1_y2_cam_v6_3430_liveavatar_parallel_lane_authority.md`.
- MR-079 command class: `DR-036#Exact-MR-079-command-classes`.
- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3430`.
- Authorized branch: `codex/y1-y2-cam-v6-3430-avatar-voice-aaa`.
- Frozen baseline commit: `89685d03e275adb2980e8f5f1ced9ef90153668f`.
- This lane did not merge into or mutate canonical V6, 3410/3410A Continuous
  Conversation, or 3420R communication analytics.
- The exact DR-036 file boundary is recorded in
  `ivprep-v6/ALLOWED_PATHS_3430.txt`.

## Boolean-only current configuration evidence

The ignored local environment was loaded through MissionMed's existing silent
loader. No secret value was read, printed, logged, stored, or committed.

| Server-side input | Presence |
|---|---:|
| `LIVEAVATAR_API_KEY` | false |
| `OPENAI_API_KEY` | true |
| `LIVEAVATAR_LIVEKIT_ORIGIN` | false |

The separately bounded endurance entrypoint exited before network access with
sanitized evidence: LiveAvatar auth absent, OpenAI auth present, approved
LiveKit origin absent.

## Founder-locked targets and current delivery truth

| Target | Exact ID | Current truth |
|---|---|---|
| Dexter Doctor Sitting | `bd43ce31-7425-4379-8407-60f029548e61` | Locked as the application default; mismatched override fails closed. Fresh authenticated provider verification is blocked. |
| W. Clint Oxley | `a33a57ab-8388-49fc-a069-dbcfd1bc5405` | Locked Voice Studio target. Previous authenticated metadata identified it on a LiveAvatar Voice Agent. Current Dexter-compatible delivery is unverified and is never presented as active. |
| Current LITE supplied-PCM audible voice | OpenAI `cedar` | Truthfully labeled. LiveAvatar LITE synchronizes the supplied PCM when connected; it does not transform `cedar` into W. Clint. |

No provider selection was restarted and no substitute avatar or voice was
introduced.

## Implemented application boundary

The application-owned `AvatarProvider` seam now exposes:

- configure;
- create session;
- start/connect;
- enqueue bounded PCM or attach a streaming byte source;
- synchronized media readiness;
- speaking/listening integration state;
- event-scoped interrupt;
- bounded reconnect;
- health and usage;
- stop and close.

Only LiveAvatar is implemented. MissionMed remains the intelligence owner.
Provider configuration reports the locked W. Clint target while explicitly
reporting `voiceSelectionApplied: false` for the LITE supplied-PCM path.

## Audio authority contract

Exactly one audible interviewer stream is selected per session:

| Rail / state | Audible authority | Avatar |
|---|---|---|
| Responses + Speech, LiveAvatar media ready | LiveAvatar LiveKit synchronized audio/video | on |
| Responses + Speech, avatar unavailable/off/degraded | browser OpenAI Speech | off |
| Accepted Realtime rail | existing direct OpenAI Realtime AudioContext | off until unified sink exists |

Transcript authority, observer output, persistence, and results remain
independent from playback authority. On an avatar utterance failure, the client
interrupts and stops avatar media, switches authority to browser Speech, and
plays the already-generated PCM once when available. It never intentionally
plays raw OpenAI audio concurrently with LiveKit audio.

## Interruption and lifecycle behavior

- Each utterance has one event ID across all PCM chunks.
- A superseding utterance awaits provider interruption before the next event
  begins; stale chunks from the invalidated event remain rejected.
- Browser barge-in aborts generation/playback and sends the active event ID to
  the server.
- Server control is bound to both the owning alpha session and exact provider
  session.
- LiveAvatar invalidates the event before sending `agent.interrupt`; any late
  chunk carrying that event ID is rejected with
  `liveavatar_audio_cancelled`.
- The UI immediately returns interviewer state to listening and records
  provider control-interrupt acknowledgement timing separately from the
  unproven visual mouth-stop time.
- A live media claim requires a video track, an audio track, and browser audio
  playback permission. Video alone is not “live.”
- Audio/video track loss becomes degraded/unavailable, never fake video.
- Terminal LiveKit disconnect initiates at most two browser-side reconnect
  attempts; the server separately reconnects the control socket and revalidates
  the exact approved LiveKit origin before returning scoped media credentials.
  The browser requires audio, video, and playable audio to resubscribe within a
  bounded window or atomically changes to visible voice-only authority.
- Stream-reader errors and empty streams explicitly interrupt their event and
  clear browser event ownership.
- End disables the button, reports `Ending…`, awaits conversation/provider and
  persistence cleanup, releases camera/mic, then reports device release.
- Remote stop acknowledgement is distinct from local device release. A failed
  remote stop retains server/browser retry context and returns
  `liveavatar_cleanup_unconfirmed`; ownership clears only after acknowledgement.
- Two sequential mocked provider sessions prove new session/token creation and
  local socket cleanup between runs.

## Founder test surface

Local launch remains:

```sh
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3430/ivprep-v6
npm start
```

Open `http://127.0.0.1:8343/` and click **TEST LIVE INTERVIEWER**. This run uses
`http://127.0.0.1:8344/` because an unrelated process already owned 8343 and was
left untouched.

The journey:

1. opens Founder Studio with available Conversation Rail, model, voice, and
   behavior choices;
2. shows exact audible voice and audio authority before launch;
3. launches the selected test as `Dexter · MissionMed AI Faculty`;
4. uses the normal Camera + Mic permission and Station flow;
5. labels Dexter as a provider stock AI interviewer, not a real physician;
6. skips randomized simulated join/camera/small-talk states;
7. focuses the Room on interviewer video, self PIP, Start, Mute, Interrupt,
   Type, and End controls;
8. keeps voice-only state visible when avatar media is unavailable;
9. keeps Interrupt visible but disabled when the interviewer is not speaking;
10. awaits cleanup on End.

Founder mode resets after durable session completion so later ordinary student
sessions do not inherit Dexter labels or Founder-focused presentation.

In-app browser review verified the splash CTA, permission step, Dexter identity,
Founder provider-truth surface, exact rail/model/voice controls, actual audible
voice/audio-authority disclosure, and `PROVIDER AUTH REQUIRED`. The isolated
review browser did not complete a camera/microphone grant, so microphone media
behavior is not claimed as browser E2E evidence in this run.

## Conversation Rail reconciliation contract

3430 intentionally did not edit the accepted 3410 rail implementation. The
future unified V6 ticket should add a replaceable normalized output sink:

```text
{ eventId, pcm16, sampleRateHz: 24000, channels: 1, final }
+ transcript/state/cancel events
```

- `avatar` sink: forward PCM to `AvatarProvider`, suppress direct AudioContext
  playback, keep transcript/persistence independent.
- `direct` sink: preserve existing Realtime or Speech playback.
- Barge-in order: rail cancel/truncate → invalidate pending rail generation →
  avatar interrupt with event ID → observe media/mouth stop → listening →
  resume.
- Responses + Speech already fits this sink after its PCM response.
- Realtime already emits normalized 24 kHz PCM deltas; the unified ticket
  should adapt those events instead of rewriting the accepted rail.
- Future GPT-Live uses the same sink boundary when authenticated capability
  discovery makes it available.

## Endurance boundary

The normal Founder product default and hard cap remain 120 seconds, preserving
the accepted alpha contract. A separate sandbox-only runner accepts exactly
600–900 seconds:

```sh
npm run probe:avatar-transport-endurance -- --minutes=10
```

It is prepared to exercise arbitrary OpenAI `cedar` PCM utterances, event-ID
interruption, stale-audio rejection, control reconnect, long idle/listening
intervals, usage, and acknowledged cleanup. It fails if any required interrupt,
stale-audio, reconnect, or cleanup checkpoint is false, and emits success only
after stop/close. It deliberately reports
`finalAcceptance: false`: without a browser media subscriber it does not prove
video, lip-sync, A/V drift, listening realism, or W. Clint. The single
authorized long provider run was not spent while LiveAvatar auth was absent.

## Verification evidence

- `npm test`: 84/84 passing.
- `npm run check`: passing.
- `git diff --check`: passing.
- New focused coverage includes:
  - exact target locking and truthful voice metadata;
  - one audio authority and duplicate-stream rejection;
  - video-only/audio-only media rejection;
  - alpha/provider session ownership;
  - event-scoped barge-in and late PCM rejection;
  - streaming chunk delivery;
  - reconnect and approved-origin revalidation;
  - remote stop retry and sanitized failure;
  - browser stream failure/empty-stream cancellation;
  - repeated sessions and cleanup;
  - 10–15 minute harness bounds;
  - obvious Founder CTA → rail selection → launch, identity, preflight truth,
    awaited Start/End, Founder-state reset, and accessibility state.

Protected baseline hashes remained unchanged:

- frozen V6 HTML: `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`;
- accepted Conversation Rail server contract: `dc1c2c535fa022c9535521bbcad9e3fbc7d12428371c0238efb8b3d90cfac7c2`;
- accepted Continuous Realtime provider: `fb824d650fe877556d0bc8891375e5e748849ac8d720fd96579301d033bd8ef3`;
- accepted browser Conversation Rail: `59362b61602c98fb69a1c5846f4ef54dd5f0e2fa291d3b22cc293f5260a224ea`;
- accepted mic controller: `e97e1c4fdb283aaa073df9ded441d3908e6099891ec5a091e850201d22ce8676`.

## Acceptance matrix

| Required proof | Result |
|---|---|
| Exact Dexter code/config lock | VERIFIED OFFLINE |
| Exact W. Clint target ID and no false substitution | VERIFIED OFFLINE |
| Genuine current LiveAvatar authentication | BLOCKED — auth absent |
| Current authenticated Dexter catalog/session proof | BLOCKED — auth absent |
| W. Clint audibly drives Dexter while MissionMed owns intelligence | UNPROVEN |
| Actual live provider video | UNPROVEN |
| Arbitrary contextual dialogue generation | VERIFIED for existing Conversation Rails; avatar delivery UNPROVEN live |
| Observed lip-sync / drift | UNPROVEN |
| Stable live listening state / natural motion | UNPROVEN |
| No duplicate audio by architecture | VERIFIED OFFLINE; live observation pending |
| Barge-in stale-audio prevention | VERIFIED OFFLINE; actual mouth-stop latency pending |
| Voice-only fallback preserves interview | VERIFIED BY IMPLEMENTATION AND TESTS |
| Repeated sessions / shutdown | VERIFIED WITH MOCKED PROVIDER |
| 10–15 minute provider media stability | NOT RUN — auth absent |
| Secret boundary | VERIFIED BY TESTS AND BOOLEAN-ONLY inspection |
| Frozen presentation / parallel lanes | VERIFIED HASH-IDENTICAL |

## Rollback and integration

- This is an additive isolated branch. Do not merge it directly into canonical
  V6 without the future unified reconciliation ticket.
- The later ticket must reconcile shared `public/index.html`,
  `public/v6-integration.mjs`, and `README.md` changes with the accepted 3410
  lane and any 3420R work.
- Preferred rollback after integration is a normal revert of the single 3430
  feature commit; the frozen baseline file was not modified.
- Feature commit: the final 3430 feature commit on the authorized branch above.

## Exactly one human action

Provision the authorized LiveAvatar server credential and exact approved
provider-returned LiveKit origin in ignored `ivprep-v6/.env.local` (never in
chat), then resume this same 3430 task so authenticated asset/voice discovery,
real Founder media acceptance, interruption observation, repeated live
sessions, and the single 10–15 minute endurance run can execute.

BLOCKED ON LIVEAVATAR HUMAN AUTH
