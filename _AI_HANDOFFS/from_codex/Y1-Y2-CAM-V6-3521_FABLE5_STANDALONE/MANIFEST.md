# Y1-Y2-CAM-V6-3521 — Fable 5 Standalone Manifest

Artifact: `IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.html`

- Source checkpoint: `9143d2af6b8362af3e7fdf015623d12c17331fcf`
- Artifact bytes: `423622`
- Artifact SHA-256: `82dd5dc11cc072f9b8fd06f1738fe92d3131ed50d993f664384cde9b99efe702`
- Runtime mode: `DETERMINISTIC_LOCAL_SIGNALS`
- Provider sessions: `0`
- Network dependencies: `0`
- External asset references: `0`

## Included

- Founder-approved Live Analytics HTML and CSS composition.
- Embedded Founder face and body scanner PNG assets.
- Embedded deterministic signal producer using the accepted DSP, F0, geometry, metric projection, HUD rendering, and visibility-state modules.
- Automatic deterministic startup so the review surface animates immediately.
- Full coaching, Interview only, preset/custom visibility, per-metric controls, overlay controls, and Founder diagnostics interactions.

## Intentionally excluded

- Physical camera and microphone acquisition.
- MediaPipe workers, models, and WASM.
- Local Whisper sidecar and transcript endpoint.
- Authentication, database, deployment, provider, and persistence integrations.

This is a truthful design/interaction review artifact for Fable 5. It is not physical-device acceptance evidence and does not replace the governed runtime.

## Verification

- Deterministic rebuild produced the same SHA-256 before and after regeneration.
- Standalone structural and isolated inline-bundle execution verifier: PASS.
- No stylesheet link, external script source, server asset URL, `fetch`, Worker construction, or `getUserMedia` remains in the artifact.
- Existing 3521 regression suite: 67/67 PASS.
- Direct automated `file://` navigation was unavailable because the browser-control security policy blocks local file URLs. No bypass or alternate browser-control path was attempted.
