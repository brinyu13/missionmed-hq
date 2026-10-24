# Y1-Y2-CAM-V6-3521 Integration Notes

## Isolation boundary

This work adds one subsystem route and does not converge the full IV Prep On-Call product. The canonical page is:

`/iv-prep-on-call/live-analytics/`

`ivprep-v6/server/hq-mount.mjs` serves the page and its static module assets inside the existing authenticated IV Prep mount. The localhost harness creates only a synthetic local entitlement and explicitly has no provider controller or paid-provider capability.

## Reused seams

- `BrowserAnalyticsPipeline` remains the local vision/audio orchestration seam.
- `holistic-worker.mjs` remains the local pose/hand/framing drawing worker.
- The existing Face Family observable summaries feed the Head/Face projector.
- The existing audio diagnostic path supplies RMS, envelope history, and validated F0.
- The existing session clock is the sole timebase for metric freshness and history.
- Device acquisition remains in a bridge rather than in visibility or rendering modules.

The worker instrumentation contract now has independent `faceOverlayEnabled`, `handsOverlayEnabled`, `bodyOverlayEnabled`, and `framingOverlayEnabled` flags. The legacy `bodyHandsOverlayEnabled` flag remains supported for compatibility.

## Integration contract

Keep these ownership boundaries during the eventual product merge:

- `media-bridge.mjs`: capture and device lifecycle only.
- `live-metric-projector.mjs`: diagnostic-to-display projections and availability/provenance only.
- `visibility-state.mjs`: allowlisted presentation preferences only.
- `hud-renderers.mjs`: canvas/DOM painting only.
- `live-analytics.mjs`: runtime coordination, one session clock, and UI event wiring.

Do not route visibility choices into `BrowserAnalyticsPipeline`, detector enablement, session reset, or future evidence recording. `MEASURED != VISIBLE` is covered by regression tests and is a merge invariant.

## Security and privacy invariants

- Live Analytics assets use `connect-src 'self'`; a configured product LiveKit origin is not inherited by this isolated page.
- No provider, upload, recording, network telemetry, or analytics persistence path exists here.
- Raw media stays in browser capture/worker paths.
- Worker-rendered bitmaps are transient and cleared on expiry, ambiguity, disconnect, stop, and destroy.
- Raw landmark arrays are not persisted by the page runtime.
- Only schema version plus allowlisted visible metric IDs may enter localStorage.
- Normal live metrics fail closed instead of consuming deterministic fixture values.

## Truth and maturity boundaries

- Physical Volume, Volume Modulation, and Pitch have genuine local signal producers.
- Physical face/body/hand behavior uses local vision workers; several user-facing interpretations are explicitly labelled observable proxies.
- Physical Speaking Speed has no verified aggregate word-timing producer and remains unavailable.
- Deterministic transcript timing is accepted only when the localhost fixture query is explicitly enabled and remains visibly labelled as test input.
- Notes detection/confidence, repetitive movement, and head nods remain unavailable without validated detectors.

Do not add Web Speech, a cloud transcript, LemonSlice, or another provider merely to make WPM appear available. A future producer must prove local/on-device or separately authorized egress behavior, emit aggregate observed word timing on the shared session clock, and pass the projector provenance gate.

## Product-merge checklist

1. Preserve the route or mount the page modules behind the same authenticated IV Prep shell.
2. Keep the page-specific self-only CSP unless an explicit, reviewed integration requires another origin.
3. Provide one product-owned `MediaStream`/device lifecycle; do not create a second camera/microphone pipeline.
4. Preserve one shared session clock across capture, transcript timing, and later review evidence.
5. Bind future Film Room evidence downstream of measurement, never downstream of visibility.
6. Retain all 22 visibility IDs or provide a versioned migration for stored Custom preferences.
7. Preserve worker flag backward compatibility until every caller is migrated.
8. Run the physical human-response acceptance matrix before release.
9. Add a verified local aggregate word-timing producer before calling WPM supported in normal live mode.
10. Re-run route/CSP, privacy lifecycle, recovery, device switching, visibility continuity, and browser visual checkpoints after merge.

## Out of scope and untouched

- No full-product navigation or page redesign.
- No Railway deployment.
- No production database mutation.
- No provider session.
- No changes to the 3440 donor worktree.
- No Film Room/recording persistence.
