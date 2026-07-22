# Y2-3100 DISC-10 Reuse and Dead Ends

## Reuse As-Is or Through a Thin Adapter

- **VERIFIED:** JWT, CAM authority-session, and entitlement evaluation are established donors. Source: `verifyJwt.mjs:53-86`, `requireCamSession.mjs:40-98`, and `entitlements.mjs:155-252` under `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/`.
- **VERIFIED:** Mutation envelopes, durable receipts, and server audit are established donors. Source: `mutationEnvelope.mjs:19-44`, `mutationReceiptStore.mjs:16-68`, and `auditStore.mjs:7-38`.
- **VERIFIED:** Exact review grants, attributed notes, and one Order are established donors. Source: `/src/routes/reviews.mjs:49-199` and the review migrations.
- **VERIFIED:** Server-owned deletion, Stream direct upload, signed playback, and R2 sidecars are established donors. Source: `deletionOrchestrator.mjs`, `cloudflareStreamProvider.mjs`, `r2Provider.mjs`, and `providerCapabilityStore.mjs`.
- **VERIFIED:** The capture FSM and MIME negotiation are established browser donors. Source: `/cam-hq/public/cam/cam-runtime-integrity.js:55-65` and `:152` onward.

## Do Not Reuse as Product Authority

- **VERIFIED:** The amended ticket forbids modification of canonical RC1, Matrix, Arena, WordPress authority, and current CAM production routes.
- **VERIFIED:** The transcript and RISE source files are unmounted and excluded from the 40-contract production surface. Treat them as dead-end placeholders.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-hq/server.mjs:5019` through `:5163` contains unrelated DBOC transcript/scoring logic. It is not CAM interviewer authority and must not be imported.
- **VERIFIED:** The `cast` and `meet` views are scripted persona presentation; they are not an adaptive interviewer engine.
- **VERIFIED:** `PACKS` is empty and disabled at `index.html:2246-2249`; it is not a provider-backed interview-plan registry.
- **VERIFIED:** The locked Foundation panel is disclosure only, not implementation.
- **VERIFIED:** The governing CAM exclusion law forbids reuse of Y1-CAM-3031P.

## Current Y2 Harness Classification

- **VERIFIED:** The Phase 0 text Brain is MissionMed-owned, provider-neutral in its public contract, deterministic, synthetic-only, and isolated.
- **VERIFIED:** Its frozen holdout failed central capability after two policy iterations. T1, T3, and T4 failed materially; T2 passed; T5 difficulty adaptation failed; T6 is incomplete; T7 lacks the required human timed review.
- **VERIFIED:** Fresh adversarial probes found protected-topic focus bypass, sensitive-answer persistence after refusal, encoded-injection evasion, Unicode/code-switching rejection, and an overly broad claim contract.
- **VERIFIED:** The kill law forbids tuning frozen policy against the opened holdout; the named defects become Y2-3103 inputs.
- **UNKNOWN:** The exact current canonical CAM tracked source and a merged Engineering OS registration for Y2 were not established. The isolated registration receipt is unmerged and noncanonical.

## Recommended Next Step

**INFERENCE:** The smallest safe continuation is `Y2-3103: Provider-Neutral Semantic Model Adapter Bakeoff and New Frozen Holdout`, preceded by contract/privacy repairs and a new independent evaluation set. Voice, avatar, media, Y1 integration, pilot, staging, and production remain out of scope.

## Boundary Verdict

Adopt mature CAM infrastructure patterns. Reject placeholders, unrelated scoring code, speculative UI labels, and the failed deterministic policy as integration shortcuts.
