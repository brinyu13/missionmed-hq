# D1 Timeline UX-007 — Editor Architecture

## Repair

The protected D1-411A kernel overlay is now the single live interaction layer for Advanced media, text, and elements. The prior split path targeted inactive selectors and discarded media geometry at projection time.

- Scene state is additive and backward compatible: shared z-order, media x/y/width/height/crop/fit, text fit mode/minimum size/line height/vertical alignment, and durable groups.
- Pointer gestures cache snap anchors, update local DOM geometry through animation frames, and commit once on pointer-up. No remote save, protected projection, or full render occurs per pointer movement.
- Live text editing pins the mounted overlay and resolves replacement-safe node identity, preventing double-click from editing a detached node.
- Group selection bounds sit above children only for handles; grouped children remain directly targetable.
- Fatal render errors preserve the last valid canvas and show non-blocking state.
- Zoom and pan are transient viewport state; they no longer mutate the Timeline document.
- Uploaded media remains in private Timeline custody while its presentation geometry renders in the same exportable overlay.

Primary changed files: `advanced-studio.js`, `kernel-host.js`, `domain-visual-adapter.js`, `canvas.js`, `407f-engineering-adapter.js`, and `uxr-002.css`. Frozen D1-409H bytes were not edited.
