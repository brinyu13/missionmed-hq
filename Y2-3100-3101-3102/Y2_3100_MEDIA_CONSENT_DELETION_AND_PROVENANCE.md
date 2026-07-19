# Y2-3100 Media, Consent, Deletion, And Provenance

## Media

- Accepted Stream intake is video-only and capped at 150 seconds: `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/cloudflareStreamProvider.mjs:4-10`.
- R2 currently stores replay JSON sidecars, not long-session audio: `src/lib/r2Provider.mjs:93-125`.
- Phase 0 therefore uses text only. It creates no audio, video, provider object, upload intent, playback capability, or recording.

## Consent

CAM has no mounted purpose-specific AI consent store. `src/routes/media.mjs:227` records `analysis_consent: not_granted`. Membership, entitlement, or mentor sharing cannot be interpreted as AI-processing consent.

Future consent must be separate for live AI processing, recording, transcript, applicant-material grounding, instructor focus items, mentor sharing, research reuse, physiology, and retention. Withdrawal must stop new processing and inherit source-level access and deletion rules.

## Deletion

CAM's accepted pattern creates durable deletion intent before provider mutation and verifies absence before completion at `src/lib/deletionOrchestrator.mjs:95` and `:334`. Future Y2 artifact classes must register in that closure before any learner write.

MissionMed-controlled artifacts require verified absence. In-flight processors that expose no absence API may use only a clearly labeled contractual zero-retention evidence class after founder approval; it must never be called cryptographic or verified deletion.

## Provenance

Every Phase 0 decision records synthetic status, persona/plan/policy/model-adapter versions, evidence references, grounding source IDs and hashes, guard outcomes, event order, and a bounded instructor rationale. It stores no private chain-of-thought and no unrestricted prompt log.
