# MissionMed Continuous Contextual Conversation — Donor Transfer

## Purpose

This is the no-rediscovery engineering transfer for MissionMed applications that need the continuous contextual voice system founder-accepted in IV Prep On-Call V6.

Use the verified implementation as a donor. Do not repeat broad OpenAI, StoryForge, Whisper, model, voice, or Realtime capability discovery. Do not copy secrets. Do not treat this local Founder Alpha as production authority.

## Accepted donor

- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3410`
- Branch: `codex/y1-y2-cam-v6-3410-continuous-conversation`
- Current accepted implementation: `d2cb7f1` (`chore(ivprep): label realtime alpha default`)
- Original rail implementation: `ebb8584` (`feat(ivprep): add experimental continuous conversation rail`)
- Founder Alpha default promotion: `4c55368` (`feat(ivprep): promote realtime to founder alpha default`)
- Rollback tag: `y1-y2-cam-v6-3410-inherited-3404`
- Combined evidence: `/_AI_HANDOFFS/from_codex/Y1_Y2_CAM_V6_3410/Y1_Y2_CAM_V6_3410_COMPLETE_COMBINED_HANDOFF.md`
- Current automated suite: 68/68 passing
- Runtime class: loopback-only Founder Alpha; no production deployment authority

## Founder acceptance truth

The founder directly tested the system in Google Chrome with the real microphone and accepted the system behavior as “pitch perfect” and “really solid” for:

- natural floor-taking;
- interruption/barge-in;
- contextual understanding;
- well-timed follow-up questions;
- follow-up relevance and quality;
- the subjective feel of a full-duplex conversation.

Authenticated Continuous Conversation is now the IV Prep Founder Alpha default. The remaining product problem is human realism in the interviewer wording/delivery: replies can still sound robotic. Do not alter the accepted rail, VAD, interruption, or context transport while working on realism.

## Canonical architecture

```text
Browser microphone (processed MediaStream)
  -> 24 kHz mono PCM16 frames
  -> same-origin application WebSocket relay
  -> one server-owned OpenAI Realtime WebSocket
  -> gpt-realtime-2.1 + semantic_vad low eagerness
  -> normalized transcript/audio/state events
  -> serialized browser PCM playback
  -> completed applicant + assistant transcript pair
  -> application-specific structured observer/reducer after the utterance
  -> application ledger/results/artifact state
```

The model rail does not own pedagogy, artifact state, user memory, entitlements, results, analytics, or persistence. Each application owns those things and consumes normalized completed-turn events.

## Exact provider configuration

- Provider model: `gpt-realtime-2.1`
- Input: mono PCM16 at 24 kHz
- Output: mono PCM16 at 24 kHz
- Input transcription: `gpt-4o-mini-transcribe`, language `en`
- Turn detection: `semantic_vad`
- Eagerness: `low`
- `create_response: true`
- `interrupt_response: true`
- Realtime reasoning effort: `low`
- Maximum output: 512 tokens
- Accepted default voice: `cedar`
- Accepted default speed: `0.92`
- Authenticated Realtime voices at discovery: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`
- Exact explicit fallback: Responses + OpenAI Speech using `gpt-5.6-terra` (with `gpt-5.6-sol` selectable where retained)
- Separate structured observer in IV Prep: `gpt-5.6-luna`

Voice is chosen before first audio. Do not assume the provider permits changing a Realtime voice after a session has spoken.

## Reusable donor files

### Provider-neutral contracts and server provider

- `ivprep-v6/providers/conversation-rail.mjs`
  - rail IDs and public capability/default configuration;
  - Founder Alpha default is Realtime only when authenticated capability is available;
  - Responses + Speech becomes the configuration default when Realtime is unavailable.
- `ivprep-v6/providers/openai-continuous-realtime.mjs`
  - exact server-authenticated OpenAI Realtime session;
  - normalized provider events;
  - bounded audio input;
  - typed input;
  - opening utterance;
  - cancel/truncate;
  - health and usage.
- `ivprep-v6/server/serve.mjs`
  - same-origin `/api/conversation-rail` WebSocket relay;
  - exact Origin/Host/loopback validation;
  - one rail owner per application session;
  - lifecycle registry, hard-cap timer, cleanup, and rate limits.

### Browser rail

- `ivprep-v6/public/conversation-rail.mjs`
  - one long-lived browser rail;
  - microphone capture/resampling to PCM16;
  - normalized event assembly;
  - serialized output playback;
  - stale-audio generation rejection;
  - late transcript-pair settlement;
  - interruption and clean close.
- `ivprep-v6/public/v6-integration.mjs`
  - IV Prep-specific integration example only;
  - use it to understand lifecycle, typed fallback, completed-turn observer, persistence, and focused room state;
  - do not copy IV Prep persona/pedagogy/UI logic into StoryForge.
- `ivprep-v6/public/index.html`
  - legacy V6 bridge example and the plan-extension fix for genuine Realtime contextual follow-ups.

### Tests and probes

- `ivprep-v6/test/conversation-rail.test.mjs`
- `ivprep-v6/test/continuous-realtime-provider.test.mjs`
- `ivprep-v6/test/frontend-lifecycle-contract.test.mjs`
- `ivprep-v6/test/server-secret-boundary.test.mjs`
- `ivprep-v6/scripts/probe-continuous-relay.mjs`
- `ivprep-v6/scripts/probe-continuous-pauses.mjs`

## Server relay laws

Keep the OpenAI key server-side. The browser connects only to the application's same-origin relay; it receives neither the long-lived key nor an ephemeral provider credential.

The accepted relay has:

- exact loopback Host and Origin validation for the unauthenticated local alpha;
- one provider rail per durable application session ID;
- 64 KiB control payload ceiling;
- 32 KiB PCM frame ceiling;
- one-second limits of 80 messages and 256 KiB audio;
- owner verification before audio/control events;
- idempotent close on normal end, abandon, browser disconnect, provider failure, hard cap, emergency disable, server close, SIGINT, and SIGTERM;
- no duplicate provider session creation on retry/reconnect;
- normalized public errors without secret-bearing provider payloads.

For an authenticated online application, replace the loopback-only identity assumption with the application's real authenticated session/entitlement. Do not widen the existing local relay to public network access.

## Browser lifecycle laws

- Keep one long-lived rail for the application session; do not open one WebSocket per turn.
- Capture processed microphone audio and stream bounded PCM frames continuously.
- Realtime owns floor detection. Disable local five-second answer completion while this rail is active.
- Stop browser output immediately on candidate speech or explicit interrupt.
- Cancel/truncate the provider response with the played-audio offset when possible.
- Serialize PCM scheduling. Count pending scheduling promises before awaiting `AudioContext.resume()`.
- Settle only after output is done, pending scheduling is zero, active sources are drained, and both completed transcript halves exist.
- Reject delayed PCM from an older playback generation after interrupt/close.
- Never persist cancelled assistant fragments as completed interviewer utterances.
- Typed input is a supported recovery path on the same long-lived rail.
- Do not silently change rails mid-session. Make fallback explicit and start a new rail/session with carried application context.

## Critical defects already found and fixed

Do not reintroduce these:

1. **Discrete Realtime masquerading as continuous.** The old `/api/realtime-turn` opened a new socket per completed text turn. It is not the donor.
2. **Early turn settlement.** Response audio can finish before input transcription completion. Clearing assistant state early caused a false “complete transcript pair” error. Settlement now waits for both transcript halves and retries on each transcript-completion event.
3. **Async PCM scheduling race.** Audio completion could settle before delayed buffers were scheduled after `AudioContext.resume()`. The donor serializes scheduling and drains pending work.
4. **Stale audio after interruption.** A playback generation rejects delayed audio from cancelled responses.
5. **Fixed-plan rejection of excellent follow-ups.** V6 rejected a real contextual third follow-up at 69.662 seconds because the original question plan had ended. Realtime now may extend with genuine follow-ups until the server-owned cap; the fixed fallback remains fail-closed.
6. **Hidden launch action.** Focus-mode cleanup hid the legacy container that owned Begin Interview. The donor has an explicit `Start Interview` state/action.
7. **Cognitive overload.** Student Realtime mode hides meeting chrome, coaching telemetry, manual Done Answering, duplicate controls, and permanent navigation. It keeps the stage, self-view, one state line, start/mute/contextual interrupt/typed fallback/end, and an explicit fallback only on failure.
8. **Selector mutation mid-session.** Rail, model, voice, and behavior are fixed for an active session.
9. **Provider-only metrics treated as browser proof.** Do not make that claim. The later founder test supplies real Chrome microphone acceptance for this build.

## Application-specific adoption — IV Prep On-Call

Prefer direct adoption from this donor rather than rebuilding:

1. Continue from the accepted V6 successor or explicitly transplant commits/files into the new authoritative V6 successor.
2. Preserve `gpt-realtime-2.1` as the Founder Alpha default when authenticated capability is available.
3. Preserve Responses + Speech as the explicit/unavailable fallback.
4. Preserve the current full-duplex rail, semantic VAD, barge-in, transcript-pair handling, persistence, and 120-second beta cap.
5. Preserve separate natural interviewer generation and instructor-observer/evidence processing.
6. Allow contextual follow-ups to extend beyond a prebuilt question list until the server-owned duration cap.
7. Keep the focused room presentation and explicit Start Interview action.
8. Make the next iteration prompt/delivery-only: more concise, physician-like, varied, and naturally conversational; fewer virtual-assistant acknowledgements and robotic restatements. Do not change rail mechanics while doing this.

## Application-specific adoption — StoryForge

StoryForge's existing OpenAI integration is transcription-only at `storyforge-v5/server/transcription/adapter.mjs` (`gpt-4o-transcribe`, fallback `whisper-1`). It is not a general conversation adapter and should not be stretched into one.

Canonical StoryForge evidence at the last verified read:

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- App folder: `storyforge-v5`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Current authority may contain an unresolved B1-513R3 registration/MR-079 gate. Revalidate before mutation; this transfer is donor evidence, not StoryForge write authority.

Recommended StoryForge seam:

1. Create an application-owned `StoryForgeConversationRail` contract or reuse the donor provider-neutral contract with StoryForge naming.
2. Copy/adapt the server provider and same-origin relay; do not copy IV Prep's interview instructions or UI integration.
3. Feed only StoryForge-authorized context: selected story, approved timeline/CV facts, current elicitation stage, user-approved notes, and the specific coaching objective.
4. Use the live rail for relevant voice-native surfaces such as story elicitation, memory probing, clarification, narrative rehearsal, and real-interview debrief capture—not every editing screen.
5. After each completed conversational utterance, run a separate StoryForge structured reducer/observer that proposes artifact changes. The Realtime model must not directly own or silently mutate the canonical story artifact.
6. Keep consent, sharing, story visibility, versioning, mentor visibility, and canonical persistence in StoryForge. The rail owns only conversation transport and normalized completed turns.
7. Persist applicant/user transcript, assistant utterance, model/voice/rail identity, timestamps, interruption boundary where available, and reducer result.
8. Require explicit user confirmation for material story edits unless current StoryForge authority says otherwise.
9. Retain StoryForge's transcription adapter for uploads and asynchronous recordings. Continuous Realtime is a sibling, not a replacement.
10. Start with local/authenticated alpha, explicit duration/usage caps, one active rail per identity, emergency disable, and clean provider closure.

## Reuse strategy

Shortest safe route:

- IV Prep successor: direct file transplant or same-repository cherry-pick where path/history alignment is verified.
- StoryForge: copy the provider-neutral/server/browser rail core and write a thin StoryForge adapter plus StoryForge-specific observer/reducer. Do not cherry-pick IV Prep UI/pedagogy wholesale.

Do not prematurely create a platform-wide shared package while authority and product contracts are still moving. After both applications pass independent acceptance, extract the stable pieces into a versioned shared package such as `@missionmed/conversation-rail-core` with application-owned adapters. Until then, bounded duplication is safer than coupling two active products.

## Destination acceptance minimum

- exact model and voice identity visible in founder mode;
- real microphone continuous input;
- semantic pauses do not require Done Answering;
- contextual response after genuine floor yield;
- candidate barge-in stops audio;
- no duplicate/stale audio;
- late transcript ordering does not lose a turn;
- typed recovery works;
- explicit fallback works without silent switching;
- application context remains coherent across several turns;
- completed-turn observer/reducer runs afterward;
- session/usage persists and provider closes on every exit path;
- second session launches cleanly;
- key absent from browser assets, logs, screenshots, Git, and handoffs;
- fallback product behavior remains intact;
- full inherited and new rail tests pass.

## Secret and deployment truth

`OPENAI_API_KEY` was present/non-empty in the IV Prep server process during acceptance. Its value was never read into a handoff, browser asset, screenshot, repository file, or chat. Each destination must use its own authorized server environment loading. Do not copy keys between repositories or ask the founder to paste a key into chat.

The donor remains local Founder Alpha. It does not authorize StoryForge or IV Prep production deployment, public exposure, paid usage, shared auth changes, or production data migration.
