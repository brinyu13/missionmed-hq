# Y1-Y2-CAM-V6-3410 A/B Comparison

## Compared rails

- A — `openai-realtime-continuous`: exact `gpt-realtime-2.1`, `cedar`, 24 kHz PCM, `semantic_vad` low eagerness.
- B — `responses-speech`: exact fallback models `gpt-5.6-terra` and `gpt-5.6-sol`, OpenAI Speech, MissionMed five-second silence detector.

The repeated fixture was: `The biggest challenge for me was ... actually when my father became ill.` The two halves were generated as synthetic PCM and streamed in real time with a 2, 5, or 8 second silence between them. This is a repeatable transport/VAD probe, not a substitute for natural founder microphone review.

## Pause results

| Mid-sentence pause | Realtime extended run 1 | Realtime extended run 2 | Existing fallback contract |
|---|---|---|---|
| 2 seconds | Held the floor; one application response after completion | Responded during the unfinished pause, then was cancelled by continuation | Holds; below the five-second threshold |
| 5 seconds | Held the floor; one application response after completion | Responded during the unfinished pause | Completes at about five seconds; premature for this fixture |
| 8 seconds | Responded during the unfinished pause; continuation caused cancellation | Responded during the unfinished pause | Completes at about five seconds; premature for this fixture |

Realtime run 1 therefore beat the fixed timer at five seconds but failed at eight. Realtime run 2 failed all three identical pause lengths. That run measured approximately 7.37, 7.66, and 7.66 seconds from the final spoken audio to the eventual post-answer response for 2, 5, and 8 second cases. Provider floor-yield-to-response events were 10, 4, and 3 ms respectively; that narrow event interval excludes the provider's semantic waiting period and is not the perceived conversational gap.

## Transcript and interruption

The provider sometimes emitted two input-transcription segments for the two phrase halves even when it did not create an interviewer response between them. The IV Prep adapter accumulates those segments and records a single application turn only when the interviewer response completes. The combined synthetic applicant transcript remained coherent.

When Realtime responded prematurely, the continuation produced provider cancellation in the controlled runs. The live same-origin relay probe independently observed:

- exact rail ready with `gpt-realtime-2.1` and `cedar`;
- response start;
- transcript delta;
- audio delta;
- explicit interrupt relay acknowledgement;
- `response_cancelled`;
- clean alpha-session end.

That relay probe passed four launches total, including a two-launch repeated-session run and a final post-repair run. No duplicate rail ownership or stuck session was observed. Browser speaker cutoff is contract-tested, but localhost browser automation was blocked before a real microphone could be exercised; no browser end-to-end interruption latency is claimed.

## Stability and recovery

- Realtime: actual provider streaming/cancellation and repeated server relay sessions passed; pause classification was variable.
- Fallback: all inherited tests remain green; exact current models, typed recovery, observer, results, evidence, and five-second behavior remain intact.
- Failure recovery: Realtime exposes a visible fallback action; it never silently changes rails.
- GPT-Live: unavailable, not simulated.

## Recommendation

Historical pre-founder verdict: **REALTIME 2.1 NEEDS ANOTHER ITERATION**

This recommendation was superseded after the founder's successful spoken-microphone trial directly validated interruption, contextual understanding, and follow-up timing and quality. The accepted Founder Alpha default is now Continuous Conversation when authenticated Realtime is available; Responses + Speech remains the explicit fallback. The synthetic evidence above remains valid historical evidence and the default decision is not a production-readiness claim.
