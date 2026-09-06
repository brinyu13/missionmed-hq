# IV Prep On-Call Live Analytics — Fable 5 Standalone

Open `IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.html` directly in Chrome. No local server, installation, login, or network connection is required.

The file automatically starts the deterministic local-signal review mode so Fable 5 sees the approved full analytics composition immediately. The visibility presets, individual metric controls, diagnostics drawer, animated gauges, and deterministic face/body/hand geometry remain interactive.

This is a design and interaction review artifact, not physical-device acceptance evidence. Physical camera and microphone capture, MediaPipe workers/WASM, and local Whisper word timing remain available only in the governed hosted or localhost runtime. The standalone file creates zero provider sessions and contains no credentials, raw media, or student data.

Regenerate and verify from the accepted runtime source with:

```sh
node _AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3521_FABLE5_STANDALONE/build-standalone.mjs
node _AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3521_FABLE5_STANDALONE/verify-standalone.mjs
```
