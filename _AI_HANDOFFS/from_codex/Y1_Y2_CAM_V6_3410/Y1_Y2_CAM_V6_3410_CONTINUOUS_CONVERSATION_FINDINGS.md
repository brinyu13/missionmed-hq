# Y1-Y2-CAM-V6-3410 Continuous Conversation Findings

## Verdict

`gpt-realtime-2.1` is authenticated and the additive continuous rail works end to end through the IV Prep server relay. Repeat synthetic trials produced materially different decisions for the same unfinished pauses, but the later founder spoken-microphone trial directly validated interruption, contextual understanding, and follow-up timing and quality.

Current founder decision: **REALTIME 2.1 FOUNDER ALPHA DEFAULT**. Responses + Speech remains the explicit fallback. This does not claim production readiness, and human-realism prompting remains the next bounded iteration.

## Authority and isolation

- Accepted inherited release: Y1-Y2-CAM-V6-3404.
- Baseline commit: `0ce0f1d2b08965ede4c717b7833535552c39e9ff`.
- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3410`.
- Branch: `codex/y1-y2-cam-v6-3410-continuous-conversation`.
- Implementation commit: `ebb8584` (`feat(ivprep): add experimental continuous conversation rail`).
- Rollback tag: `y1-y2-cam-v6-3410-inherited-3404` -> exact baseline commit.
- Frozen source `ivprep-v6/baseline/IV Prep OnCall_V6.html` SHA-256 remained `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`.
- Accepted 3404 runtime `ivprep-v6/public/index.html` SHA-256 was `42593f0dcf5b265d004126e869ed83733e2152d637c4efb89fe6428a9d16b2de`; the scoped 3410 disclosure edit yields `e695313d3529d77ea2662d27a4de9022f455fd39064359cb2f2ed6c989374ef6`.
- Runtime remains loopback-only. No production deployment, shared auth, shared persistence, or unrelated MissionMed application was changed.

## Authenticated provider findings

The existing process credential was checked only for non-empty presence. Its value was never printed or copied.

Authenticated discovery proved:

- exact model `gpt-realtime-2.1` is visible and creates a Realtime session;
- audio input and output stream as PCM16 mono at 24 kHz;
- `semantic_vad` accepts `eagerness=low`, `create_response=true`, and `interrupt_response=true`;
- `server_vad` and manual turn detection are also accepted, but are not used by this experiment;
- `gpt-4o-mini-transcribe` input transcription is accepted;
- reasoning efforts `none`, `low`, `medium`, and `high` are accepted; the rail uses `low`;
- function tools with automatic tool choice are accepted but not needed by this bounded rail;
- exact authenticated Realtime voices are `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, and `cedar`;
- voice `cedar` with speed `0.92` is accepted;
- output audio/transcript deltas, response cancellation, and automatic barge-in cancellation were observed;
- GPT-Live API access was not discovered. It remains `status=unavailable`, `reason=provider_api_not_available`.

Provider-only synthetic timing from capability discovery was 786 ms to first audio, 161 ms from first appended interrupting audio to provider speech-start detection, and 30 ms from speech-start detection to provider cancellation. These are not browser end-to-end measurements.

## Implemented rail

`ConversationRail` now has three explicit entries:

1. `OpenAIRealtimeRail`: experimental, exact `gpt-realtime-2.1`.
2. `ResponsesSpeechRail`: existing reliable fallback, `gpt-5.6-terra` or `gpt-5.6-sol`.
3. `GPTLiveRail`: truthful unavailable seam only.

The Realtime path uses one long-lived provider WebSocket for one active alpha session. The browser sends bounded PCM frames to a same-origin WebSocket relay; only the server authenticates to OpenAI. The relay validates loopback Host and exact Origin, limits control/audio payloads, caps each one-second window at 80 frames and 256 KiB of audio, enforces one rail owner per active alpha session, and closes on session end, browser disconnect, emergency disable, hard cap, server close, SIGINT, or SIGTERM.

Provider events are normalized before reaching browser code. Browser audio playback is the sole Realtime delivery owner, preventing duplicate OpenAI/LiveAvatar audio. LiveAvatar remains available only on the unchanged Responses + Speech rail; the experimental direct-audio rail shows a truthful voice-only state.

Candidate speech during interviewer output stops scheduled browser audio immediately and uses provider interruption plus response cancellation/truncation. Cancelled assistant audio/transcript state is cleared before the next response. Completed applicant transcript segments are coalesced into one application turn until a completed interviewer response, then the existing separate observer pass runs.

PCM scheduling is serialized and counted before any asynchronous `AudioContext.resume()`. Turn settlement waits for both pending scheduling and active sources to drain. Interruption advances a playback generation so delayed work from the cancelled response cannot schedule stale audio. A cancelled interviewer fragment is deliberately not recorded as a completed utterance; the applicant's interrupting speech remains part of the still-open applicant turn.

## Founder controls and evidence

The existing founder studio now includes an explicit Conversation Rail selector. Exact rail, model, voice, connection state, first-audio latency, answer-end-to-response timing, provider floor-to-response timing, interruption timing, round trip, streaming state, and provider health are founder-only. Rail, model, voice, and behavior selection are locked while an interview is active. Realtime failure shows a visible `Continue using High-Intelligence Voice` action; no silent substitution occurs.

The local browser automation surface blocked localhost navigation under its URL policy before application code loaded. No visual or real-founder microphone claim is made. Static contracts, the same-origin relay, actual provider audio/transcript streaming, cancellation, repeated sessions, persistence, and HTTP health/config were verified. The build remains running for direct Chrome testing.

Cancelled assistant fragments are intentionally excluded from the completed-utterance transcript while applicant segments remain in the open turn. This prevents a partial question from being misrepresented as completed, but current exports cannot reconstruct the exact partial interviewer words or interruption boundary. That limitation should be addressed if interrupted-fragment auditability becomes a founder acceptance requirement.

## Material finding

Semantic VAD at low eagerness is better than an arbitrary shorter timer, but it is nondeterministic on the core unfinished-thought fixture. It may preserve a pause or respond with a backchannel/follow-up before the second half. Provider transcription can also emit multiple segments during one application-level turn; the adapter coalesces these, but raw provider segmentation remains observable.

The experiment therefore stays selectable but not default.
