# Y2-3101 Model, Voice, and Avatar Adapters

## Model Boundary

The model adapter contract records:

- adapter identity and revision;
- execution mode;
- network access;
- provider and retention profile;
- raw-output persistence;
- canonical content hash.

The Phase 0 `RuleModelAdapter` is deterministic, has no provider, performs no network access, and persists no raw provider output. It extracts sentence evidence, claims, STAR-pattern coverage, a small set of domain cues, and narrow inconsistency candidates.

## Model Finding

The rule implementation is not adequate for the frozen language distribution, and the current adapter boundary is not yet genuinely replaceable. Its descriptor hard-locks deterministic-rule, provider-null execution and there is no validated analysis-output contract. The T1, T3 and T4 failures are consistent with limited semantic classification, while separate ledger defects remain named. A stronger model adapter may help, but that hypothesis requires a new frozen development/holdout protocol and cannot be claimed proven.

## Voice Boundary

`InactiveVoiceRailAdapter` is:

- activation state `INACTIVE`;
- provider `null`;
- accepted writes `false`;
- network access `false`;
- retention profile `none`.

No LiveKit, ElevenLabs, STT, TTS, streaming, interruption, usage, billing, or provider-recovery implementation exists. Holdout ASR/barge-in/voice-kill cases are reported as future inactive boundaries, not passed voice tests.

## Avatar Boundary

`InactiveAvatarAdapter` has the same fail-closed activation law. No avatar SDK, media, animation, rendering, provider account, or UI exists.

## Next Research Boundary

The smallest defensible next ticket is a provider-neutral semantic model-adapter bakeoff using synthetic data only. It should freeze a new model-adapter corpus, preserve the existing Brain contracts and ledger, compare at least one local deterministic baseline with candidate structured-output adapters, and test T1/T3/T4 without changing probe, safety, consent, or instructor laws.

Voice remains blocked until that adapter passes a fresh unseen holdout.
