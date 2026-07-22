# Y2-3100 DISC-04 Media and Storage

## Cloudflare Stream

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/cloudflareStreamProvider.mjs:4` through `:12` defines bounded provider constants.
- **VERIFIED:** Lines `:70` through `:74` report readiness without exposing credentials.
- **VERIFIED:** Lines `:87` through `:105` validate media type, size, and duration.
- **VERIFIED:** Lines `:107` through `:151` create a direct-creator upload intent with signed playback required and content-hash metadata.
- **VERIFIED:** Lines `:166` through `:186` issue bounded playback, `:189` through `:211` delete provider media, and `:214` through `:230` validate owner, rep, environment, capability, and content-hash bindings.
- **VERIFIED:** The current allowlist is video-oriented. A generic R2-only audio interview path is not an existing public CAM contract.

## Cloudflare R2

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/r2Provider.mjs:20` through `:86` implements server-side SigV4 requests.
- **VERIFIED:** Lines `:89` through `:95` derive bounded object keys.
- **VERIFIED:** Lines `:97` through `:132` write a sidecar, read it back, and verify its hash.
- **VERIFIED:** Lines `:135` through `:148` delete and then verify object absence.

## Durable Capabilities and Routes

- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/lib/providerCapabilityStore.mjs:54` through `:81` persists an intent and idempotency binding before provider use; `:84` through `:116` binds the returned provider identity with CAS; `:133` through `:149` records proof; `:165` through `:172` evaluates usability.
- **VERIFIED:** `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/src/routes/media.mjs:228` through `:266` binds content hash and capture provenance.
- **VERIFIED:** Lines `:403` through `:485` create direct-upload intent with compensation; `:526` through `:579` issue playback; `:611` through `:651` persist replay sidecars in R2.

## Y2 Storage Implications

- **INFERENCE:** A playable interactive interview recording should reuse Stream for media and R2 for a versioned metadata/replay sidecar. That is the closest current donor path.
- **INFERENCE:** LiveKit or another future WebRTC egress must first create a durable CAM capability and immutable media identity, then bind a digest, actual MIME/container, consent, capture provenance, and provider result. It must not insert an arbitrary provider UID.
- **UNKNOWN:** No current CAM source establishes LiveKit, TURN, WebRTC room, or egress provider support.
- **VERIFIED:** The amended ticket forbids changing existing rep upload and replay behavior; Y2 cannot replace or reinterpret it during Phase 0.
- **INFERENCE:** Under the verified provider-capability contract, local Brain output, model output, or a WebRTC room response cannot count as durable media proof.

## Boundary Verdict

The media plane is reusable after an explicit integration design. The current Y2 harness has no media provider integration, and the kill result forbids activating one.
