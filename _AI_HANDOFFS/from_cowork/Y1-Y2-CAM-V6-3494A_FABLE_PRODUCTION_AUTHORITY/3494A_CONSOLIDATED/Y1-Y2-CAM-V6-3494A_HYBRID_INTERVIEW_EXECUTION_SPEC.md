# Y1-Y2-CAM-V6-3494A — HYBRID INTERVIEW EXECUTION SPEC

## 1. Execution strategies (hot-swappable, chosen by SessionConfiguration)

`InterviewExecutionStrategy` implementations:
- **PreRecordedStructuredStrategy** — plays pack ask-videos, listening loops between; zero live-provider consumption; deterministic question list.
- **HybridFollowUpStrategy** — structured path + FollowUpRouter; escalates to live contextual ONLY when a follow-up is warranted, then returns to the structured path.
- **LiveConversationalStrategy** — premium: no fixed list; live contextual interviewer reacts, probes, redirects. Progression-gated (Progression spec) and provider-credit-metered.

All three share: session engine, telemetry, recording, HUD law, Film Room. Strategy choice changes interviewer behavior only.

## 2. Hybrid runtime state machine

```
OPEN(pack.session_open) → ASK(play QuestionVideo) → LISTEN(loop; student answers; telemetry runs)
 → answer-end → FollowUpRouter.decide(answer, question.followup_eligible, config.followups)
    ├─ NO  → ACK(neutral/positive) → TRANSITION → next ASK …
    └─ YES → LIVE_FOLLOWUP (invoke live contextual stack: voice-first; avatar only if session tier includes it)
             → follow-up asked → LISTEN → return to structured path
 → last question → CLOSE(pack.session_close)
```

FollowUpRouter inputs: config.followups (off/low/high/adaptive), transcript signals (brevity, ambiguity, richness hooks), interviewer behavior profile (probing/challenge), remaining budget. Router decisions logged to the SYSTEM lane (Film Room forensics). Missing pack asset at any state → per-pack degrade, session continues.

## 3. Cost posture

Structured segments: media playback only. Live follow-ups: contextual runtime consumed per use. Full conversational: premium metering (Progression spec §credits). The hybrid design makes the default interview nearly provider-free without feeling canned — reactions and acks come from the pack.

## 4. Human-only provider law unchanged

Live contextual voice/avatar sessions obey the 3494 Avatar spec gates; prerecorded playback requires none of them.
