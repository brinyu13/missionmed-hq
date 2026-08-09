# Timeline UX Implementation 006 - Implementation Report

## Outcome

Timeline Builder RC1 is live with the bounded editor interaction repair. The final canonical-baseline gate found no product baseline drift and required no additional code or deployment.

## Exact baseline and release

- Accepted pre-006 closure: `e169a66`.
- Final source: `14fb4dd3258fb8bf920910fc066495e9835503f5`.
- Source commits: `961f9c5` human UX recovery, `44ce8b6` bounded overlap recovery, `14fb4dd` advanced-object hit priority.
- Static release: `timeline-390aab3459459825`.
- WordPress release: `timeline-wp-ed84301a63d1ed11`.
- App bundle: `app.745937a8bdf7.js`, SHA-256 `745937a8bdf7bb522af520cfb45794b6032142d2924c3c9e15b6d73d34888134`.
- API unchanged: `timeline-c9eda9eeb7d6cf98`, deployment `b0c3401a-c482-4aac-9580-8e0067554289`, schema `d1-timeline-db-500.1`.

## Files changed from accepted closure

| File | Reason |
|---|---|
| `tests/d1-411b-fable-integration.test.mjs` | Contract coverage for overlap recovery, advanced selection priority, and editor state laws |
| `web/index.html` | Human-facing renderer recovery language |
| `web/js/407f-engineering-adapter.js` | Preserve last-good render and bounded failure recovery |
| `web/js/d1-411a/domain-visual-adapter.js` | Canonical projection and collision-safe geometry behavior |
| `web/js/d1-411a/kernel-host.js` | Direct manipulation, selection, transform, group, and presentation gesture seam |
| `web/js/uxr-002/advanced-studio.js` | Functional asset rail, direct insertion/edit controls, and advanced-object hit priority |
| `web/js/uxr-002/canvas.js` | Persistent editor state, zoom, grouping, and contextual controls |
| `web/tests/run_d1_411b_kernel_browser.mjs` | Browser acceptance and regression assertions |
| `web/tests/run_rc1_editor_export_browser.mjs` | Same-DOM editor/export fidelity coverage |

Protected D1-409H HTML/CSS/JavaScript hashes did not change.

## Root causes and repairs

- **Renderer failure:** normal recoverable collisions were promoted to fatal candidate rejection, exposing technical fallback language. The repair keeps the last-good board mounted, emits bounded overlap guidance, and does not expose internal details.
- **Selection:** protected furniture hit targets could sit above overlapping advanced objects. The advanced overlay now wins within the bounded editor seam, so a student can select, recover, move, or delete the object they placed.
- **Drag/resize:** gesture-local pointer state uses pointer capture and local transforms; one logical document mutation occurs on completion rather than per pointermove.
- **Resize/aspect:** generic objects and groups use consistent handles with independent aspect-lock and object-lock state.
- **Grouping:** durable group membership stores child transforms relative to group bounds; move, proportional resize, duplicate, lock, delete, undo, redo, ungroup, save, reload, and export preserve membership.
- **Inline editing:** double-click enters direct text editing; committed text is stored once and survives reload/export.
- **Undo/redo:** each completed gesture is one history action; pointer cancellation restores pre-gesture geometry without polluting history.
- **Asset library:** populated visual panels provide shapes, arrows, timeline decorations, medical/personal icons, country flags, professional backgrounds, text, logos, photos, and uploads. Click-to-add and physical rail-to-canvas drag both create selected objects.
- **Loading/performance:** panel switching and zoom preserve the mounted canvas; ordinary gestures do not call the network, autosave, or full renderer on pointermove. The visible board remains available through candidate errors.
- **Export:** PNG and both PDFs serialize the committed protected board. Object URL lifetime was previously repaired; final canonical exports preserve all accepted textures and composition.

## Tests

- Full authoritative suite: 689/689 PASS after the combined repair.
- Latest focused source contract: 21/21 PASS after advanced-object hit priority.
- Latest affected browser suite: 42/42 PASS across administrator, eligible-360, and removed access personas, with zero browser errors.
- Editor acceptance: 32/32 local and 32/32 live.
- Canonical no-edit roundtrip: visual model 5/5 identical; baseline/reload zero pixel differences; PNG/Letter/A4 opened.

The prior method that treated the distorted live canary as visual authority was false methodology. It has been replaced by `TIMELINE_RC1_CANONICAL_BASELINE_006_REPORT.md` and the isolated canonical fixture.

## Performance

- Latest browser export timings: PNG 277.7 ms, Letter PDF 697.8 ms, A4 PDF 554.0 ms.
- Selection is immediate at browser-observed latency.
- Pointer manipulation stays local and does not issue a network/save/render transaction per frame.
- Zoom and panel switching do not blank or remount the canvas.

## Limitations

- The live `Brian RC1 Canary` remains intentionally distorted and must not be used as visual authority.
- Variable user-managed Color Key category counts remain a Version 2 enhancement; RC1 preserves canonical IDs/order.
- A separate live canonical document was not created because production offered only destructive `Start over`; the exact immutable release was tested in a fresh isolated profile instead.

## Rollback

- Immediate WordPress rollback: `releases/timeline-wp-7890b335cbbbe44e`.
- Provider-native backup: `TIMELINE-RC1-EDITOR-UX-004-PRE-20260808T161951Z`.
- Latest scoped snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260809T181853Z-timeline-ux-006`.
- Kill switch: `timeline_enabled=false` or restrict rollout stage.
- API/database were not changed by UX-006; do not roll back or drop the schema for a presentation-only rollback.
