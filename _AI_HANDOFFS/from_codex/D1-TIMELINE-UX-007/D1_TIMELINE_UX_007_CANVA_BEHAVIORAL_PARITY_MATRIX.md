# D1 Timeline UX-007 — Canva Behavioral Parity Matrix

Canva was directly operated in the Founder-authenticated Chrome session during the controlling editor work. Screenshots alone were not used as the behavioral authority.

| Interaction law | Canva mental model | Timeline UX-007 result |
|---|---|---|
| Select/deselect | Canvas-first, visible bounds | Single, modifier multi-selection, marquee, and blank-canvas deselect implemented |
| Drag | Object tracks pointer continuously | Local pointer capture/rAF preview; one logical commit on release; browser PASS |
| Resize | Direct handles with live feedback | Eight handles, proportional and freeform modes; browser PASS |
| Aspect lock | Clear lock state | Persistent object/group lock-proportions control; browser PASS |
| Group/ungroup | Composition moves and scales as one | Durable group membership, proportional child transforms, duplicate/delete/layer/history; browser PASS |
| Text | Direct in-canvas edit | Double-click contenteditable with save/cancel, auto-fit and overflow state; browser PASS |
| Rail add | Click or drag to visible position | Click-to-add and physical pointer rail-to-canvas drop at exact position; browser PASS |
| Snapping | Temporary spatial guidance | Cached edge/center anchors and transient guides; implemented and focused-tested |
| Lock/layer | Immediate, persistent object action | Shared heterogeneous z-order and object/group locking; automated/browser proof |
| Zoom/pan | Viewport operation | 25–400%, +/-/editable percentage/Fit, middle-mouse pan, no document mutation/remount; browser PASS |
| Undo/redo | Direct manipulation participates in history | Real drag -> Undo -> Redo browser PASS |

Intentionally not reproduced: Canva collaboration, templates marketplace, stock search, AI generation, video/audio authoring, commercial brand kit, page management, and unrelated publishing features. Timeline preserves a focused residency-story editor and its protected semantic presentation.
