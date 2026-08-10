# Y1-Y2-CAM-V6-3410 Complete Combined Handoff

## Status

**REALTIME 2.1 NEEDS ANOTHER ITERATION**

The experimental continuous rail is implemented, authenticated, selectable, and safe to founder-test. It is not promoted. The existing Responses + Speech rail remains the default because identical synthetic unfinished-pause trials produced materially variable Realtime decisions.

## Authority

- Repository: `/Users/brianb/MissionMed`
- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3410`
- Branch: `codex/y1-y2-cam-v6-3410-continuous-conversation`
- Implementation commits: `ebb8584` (`feat(ivprep): add experimental continuous conversation rail`) and `4f7b69a` (`fix(ivprep): restore realtime follow-ups and focus room`)
- Accepted inherited baseline: Y1-Y2-CAM-V6-3404
- Baseline commit: `0ce0f1d2b08965ede4c717b7833535552c39e9ff`
- Rollback tag: `y1-y2-cam-v6-3410-inherited-3404`
- Frozen source `ivprep-v6/baseline/IV Prep OnCall_V6.html` SHA-256: `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`
- Accepted 3404 runtime `ivprep-v6/public/index.html` SHA-256: `42593f0dcf5b265d004126e869ed83733e2152d637c4efb89fe6428a9d16b2de`
- Current scoped runtime `ivprep-v6/public/index.html` SHA-256: `e695313d3529d77ea2662d27a4de9022f455fd39064359cb2f2ed6c989374ef6`
- Production mutation: none
- Deployment: none; loopback-only Founder Alpha

## Files changed

Application and guardrail changes are limited to:

- `ivprep-v6/ALLOWED_PATHS.txt`
- `ivprep-v6/ALLOWED_PATHS_3410.txt`
- `ivprep-v6/README.md`
- `ivprep-v6/package.json`
- `ivprep-v6/providers/conversation-rail.mjs`
- `ivprep-v6/providers/openai-continuous-realtime.mjs`
- `ivprep-v6/public/conversation-rail.mjs`
- `ivprep-v6/public/index.html`
- `ivprep-v6/public/v6-integration.mjs`
- `ivprep-v6/scripts/probe-continuous-pauses.mjs`
- `ivprep-v6/scripts/probe-continuous-relay.mjs`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/test/conversation-rail.test.mjs`
- `ivprep-v6/test/continuous-realtime-provider.test.mjs`
- `ivprep-v6/test/frontend-lifecycle-contract.test.mjs`
- `ivprep-v6/test/server-secret-boundary.test.mjs`
- this three-file 3410 handoff directory

`ALLOWED_PATHS_3410.txt` is the closeout allowlist. Frozen baseline files, environment files, `.alpha-data`, prior handoffs, and unrelated applications were not modified.

## Exact architecture

```text
Founder rail selection
  |-- HIGH-INTELLIGENCE FALLBACK (default)
  |     browser microphone -> existing 5 s completion
  |     -> Responses (Terra or Sol) -> OpenAI Speech
  |     -> existing observer/results/evidence
  |
  |-- CONTINUOUS CONVERSATION (experimental)
  |     continuous browser PCM -> same-origin IV Prep WebSocket relay
  |     -> one server-authenticated gpt-realtime-2.1 session
  |     -> normalized transcript/audio/state events -> browser playback
  |     -> completed utterance -> existing separate observer/results/evidence
  |
  `-- GPT-Live (future, unavailable; no speculative provider code)
```

The application owns interview identity, context, faculty/persona, plan, alpha limit, persistence, results, and evidence. The rail owns model transport, streaming audio, interruption, exact provider identity, health, usage, and closure. This is an IV Prep-owned adapter, not new shared MissionMed infrastructure.

## Exact provider configuration

- Realtime model: `gpt-realtime-2.1`
- Realtime input/output: PCM16 mono, 24 kHz
- Input transcription: `gpt-4o-mini-transcribe`, language `en`
- Turn detection: `semantic_vad`, `eagerness=low`, automatic response creation and interruption enabled
- Realtime reasoning: `low`
- Realtime maximum output: 512 tokens
- Default Realtime voice for this build: `cedar`, speed `0.92`
- Authenticated Realtime voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`
- Fallback models preserved: `gpt-5.6-terra`, `gpt-5.6-sol`
- Observer preserved: `gpt-5.6-luna`
- GPT-Live: `unavailable`, `provider_api_not_available`

The prior LiveAvatar identity truth is unchanged. The experimental Realtime rail uses direct browser audio and visibly disables avatar delivery to prevent duplicate or unsynchronized sound. The existing LiveAvatar path remains on the fallback rail.

## Lifecycle and failure behavior

- one Realtime provider socket per active alpha session;
- strict loopback Host and exact Origin on WebSocket upgrade;
- 64 KiB relay payload ceiling and 32 KiB PCM frame ceiling;
- one-second relay caps of 80 frames and 256 KiB audio, with policy closure on excess;
- one owner per alpha session;
- close on normal end, abandon/browser disconnect, emergency disable, 120-second hard cap, provider error, server close, SIGINT, and SIGTERM;
- local audio stops immediately on barge-in; provider response is cancelled/truncated;
- PCM scheduling is serialized and turn settlement waits for pending scheduling plus active sources to drain;
- a playback generation rejects delayed stale PCM after interruption or close;
- cancelled assistant state is discarded, preventing stale audio or duplicate transcript;
- cancelled interviewer fragments are not misrepresented as completed utterances; interrupting applicant speech stays in the still-open applicant turn;
- Realtime failure exposes a visible founder action to continue with High-Intelligence Voice;
- no silent mid-interview fallback;
- rail selection is fixed during an active interview;
- typed answers work on both rails.

## A/B evidence

Two extended authenticated runs streamed the same synthetic unfinished sentence with 2, 5, and 8 second pauses.

- Run 1: Realtime held 2 and 5 seconds, responded prematurely at 8 seconds.
- Run 2: Realtime responded prematurely at 2, 5, and 8 seconds.
- Run 2 post-answer response gaps: 7.37 s, 7.66 s, and 7.66 s.
- Fallback: 2 seconds remains open; 5 and 8 seconds complete at the existing approximate five-second threshold.

Realtime can outperform the fixed rule at five seconds, but it did not do so reliably. Provider transcription may segment a long application turn at pauses; the browser adapter coalesces segments until one interviewer response completes.

Provider-only capability timing measured one 786 ms first-audio run, 161 ms to detect interrupting speech, and another 30 ms to cancel. The same-origin relay independently streamed transcript/audio and acknowledged an explicit cancellation. These are synthetic/provider measurements, not founder-browser latency.

## Tests and probes

- Syntax checks: pass.
- Automated suite: **67/67 pass**, 0 fail.
- New rail/lifecycle contracts: 10 added and passing.
- Dependency audit: 0 vulnerabilities.
- Actual same-origin authenticated relay: pass.
- Repeated authenticated relay launch: two consecutive launches pass; four total successful relay probes in this run, including a final post-repair run.
- Actual provider streaming: exact model/voice, transcript delta, audio delta, cancellation, and session end observed.
- Synthetic 2/5/8 second pause suite: completed; variable/promotion-blocking result documented above.
- Persistence restart: three synthetic completed sessions before restart and the same three after restart.
- Health/config: OpenAI configured; default and hard maximum both 2 minutes; fallback default; Realtime experimental; GPT-Live unavailable.
- Secret literal scan: key present in process only; exact literal absent from repository content.
- Browser assets: no credential/Authorization markers.
- Allowed-path check: pass.
- Frozen baseline hash: unchanged.
- Rollback tag resolution: exact inherited baseline.
- Chrome acceptance: the founder's actual loopback tab loaded with retained camera/microphone permission. The repaired focused room was directly observed in Chrome. A typed Realtime answer produced and durably persisted a contextual model-generated follow-up plus its separate instructor record. A fresh spoken-microphone repetition after the repair remains founder acceptance, not an automated claim.

## Founder feedback repair — 2026-08-10

Founder Chrome evidence exposed two material defects after the original handoff:

1. Realtime could finish response audio before the input transcription completion event arrived. The browser cleared its assistant state before the transcript pair was complete, producing the visible false failure `Continuous Conversation did not produce a complete transcript pair` instead of advancing the interview. Turn settlement now waits for both transcript halves and retries when either late transcript-completion event arrives.
2. The Realtime room retained the V6 meeting chrome, coaching telemetry, manual `Done Answering` control, duplicate interruption controls, and permanent navigation. Student Realtime mode now uses a bounded focus presentation: interviewer stage, self-view, one plain-language state, mute, contextual interrupt, optional typed fallback, explicit fallback only on provider failure, and end interview. The underlying fallback room and V6 flow remain unchanged.
3. The focus presentation initially hid the legacy container that also owned `Begin Interview`, leaving the ready room with no launch action. Commit `ccffdc9` adds an explicit focused `Start Interview` action, a truthful `Ready when you are` state, and hides that action as soon as the interview starts. Direct Chrome verification observed the button in the ready room, clicked it, observed the protected 120-second Realtime answer window open, and confirmed the start action disappeared after activation.

Direct Chrome evidence after the repair showed the focused room without the permanent sidebar, top progress bar, meeting toolbar, live-signal drawer, `Done Answering`, or `Abandon Take`. The durable session ledger recorded the founder-test answer and the contextual follow-up `Give me a concrete example...`, with exact model `gpt-realtime-2.1` and a separate `FOLLOW_UP` instructor record. This proves follow-up generation/persistence for that tested turn; it does not promote the experimental rail or prove repeated natural-microphone stability.

## Failures and fixes during the ticket

1. The first pause probe called the environment loader without its required path. Fixed by loading only the ignored local path without overriding the process environment.
2. A short final observation window left 2/5-second trials unresolved. Extended to 12 seconds and preserved event counts/phases.
3. Cancelled browser responses retained stale latency timestamps. Fixed by resetting response/audio timing state on cancellation.
4. Founder diagnostics originally showed provider floor-to-response only, which hides semantic waiting time. Added local answer-end-to-response telemetry.
5. Browser automation could not navigate to localhost due the controlling Browser Use URL policy. No workaround was attempted.
6. Fresh verification found an asynchronous PCM scheduling race that could settle a turn before delayed audio was scheduled. Fixed with a serialized queue, pending-schedule drain gate, and generation-based stale-audio rejection.
7. Fresh verification found that model, voice, and behavior controls were still mutable during an active session even though the rail was locked. All four selections are now locked until the interview ends or is abandoned.
8. Founder Chrome testing found a late input-transcription ordering race that discarded an otherwise valid follow-up. Fixed with transcript-pair-aware settlement and regression coverage.
9. Founder feedback found the Realtime interview room cognitively overwhelming. The student Realtime room now suppresses legacy meeting/coaching/manual-turn controls and keeps only essential conversation controls.

## Security and Platform-v1 observations

- OpenAI credentials remain server-side.
- Browser source contains no credential name, bearer token, authorization header, or ephemeral client-secret endpoint.
- The relay forwards normalized provider events only.
- Runtime remains loopback-only because its local founder marker is not real authentication.
- No provider broker, shared context store, cross-app persistence, deployment route, or platform-wide contract was created.
- Environment files and runtime session data remain ignored.
- No production data or student recording was used.

## Fresh Verifier

Independent verdict: **REALTIME 2.1 NEEDS ANOTHER ITERATION**. The verifier confirmed exact authority/rollback, additive fallback-default architecture, loopback binding, exact runtime rail truth, cross-origin WebSocket rejection, protected fallback/microphone/persistence hashes, allowed paths, secret safety, and both late lifecycle repairs. Its original inspection suite passed 64/64 before the final relay-rate contract was added; supervisor closeout after founder-feedback repair passed 67/67.

Remaining limitations from independent review are the variable semantic-VAD pause behavior, unobserved real-Chrome microphone/speaker quality and end-to-end interruption latency, and the absence of exact partial-assistant/interruption-boundary reconstruction in exported evidence. None justify promoting the experimental rail.

## Launch

```sh
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3410/ivprep-v6
HOST=127.0.0.1 PORT=8320 npm start
```

Open `http://127.0.0.1:8320/` in Google Chrome. The strongest build was left running there at closeout.

## Promotion recommendation and exact next step

**REALTIME 2.1 NEEDS ANOTHER ITERATION**

Keep Responses + Speech as default. Founder should enter admin mode, select `CONTINUOUS CONVERSATION`, and run the real-world panel in Chrome—especially repeated 2/5/8 second unfinished clauses, `let me think`, false endings, interruption, background noise, and quiet breathing—while recording founder diagnostics. Only reconsider promotion if repeated natural-microphone trials are materially more stable than the synthetic evidence.
