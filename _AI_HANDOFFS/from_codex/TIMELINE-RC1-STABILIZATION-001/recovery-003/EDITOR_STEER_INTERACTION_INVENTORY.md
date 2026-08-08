# Timeline RC1 editor steer — interaction inventory

Date: 2026-08-06

Status: local implementation contract; not approved for production deployment.

## Authenticated Canva observations

- A persistent narrow tool rail opens a single left content panel while the canvas remains the primary workspace.
- Elements and uploads are searchable, visual thumbnail grids; clicking a thumbnail inserts it and the same assets can be dragged to the canvas.
- The selected object is outlined on the canvas with eight resize handles and a rotation handle.
- Selection exposes a compact top toolbar appropriate to the selected object and a floating action bar for lock, duplicate, delete, and overflow actions.
- Position opens an on-demand Arrange/Layers panel with forward/back, alignment, size, coordinates, and rotation controls.
- Text has one-click heading/body insertion and in-place editing.
- Undo/redo, panel switching, selection, and zoom do not replace the canvas with a loading state.
- Keyboard instructions expose direct move, rotate, resize, and canvas/toolbar traversal.

## Timeline editor gap

### Remove from the primary workspace

- The full-width Year Axis and Color Key form block.
- The plain-text asset row list.
- The form-first Advanced Studio layout that pushes the timeline below the fold.

### Retain

- MissionMed Matrix shell and Home / Builder / Edit Timeline / Media / Export navigation.
- Canonical D1-409H-A1 / 407G Preview 6 composition and protected renderer.
- Timeline chronology, category IDs, save/sync, versions, history, entitlement, durable media, and export contracts.
- Existing event drag/date-resize, media/text movement, text editing, undo/redo, theme, and zoom engines.

### Relocate

- Year-axis controls into the contextual inspector opened from the axis itself.
- Color-key controls into the contextual inspector opened from the key itself.
- Background and typography controls into the selected tool/object panel.
- Layer ordering, lock, duplicate, delete, size, and alignment into the selected-object toolbar/inspector.

### Rebuild

- Canvas-first editor shell with a persistent tool rail and expandable left panel.
- Searchable visual asset thumbnails and one-click/drag insertion.
- On-canvas selection frames, explicit resize/rotation handles, snapping guides, and layer controls.
- Direct year-boundary manipulation and direct color-key move/resize/edit interaction.
- Persistent-canvas reconciliation so panel, selection, zoom, and control changes never show `LOADING CANONICAL TIMELINE...`.

## Deployment boundary

The editor correction remains local until the Founder visually reviews the candidate. Existing production RC1 remains unchanged.

## 2026-08-07 bounded implementation checkpoint

### Canva behavior directly operated

The authenticated Canva design was operated in Chrome, then restored with undo. Confirmed: selection/deselection, live drag, corner resize, inline text edit, visual-asset click insertion, visual-asset drag insertion, duplicate, lock/unlock, rail switching, and viewport zoom. This report uses those observed behaviors as an interaction reference only; it does not copy or reverse-engineer Canva code.

### Implemented locally and browser-smoke-tested

- The protected Timeline board stays mounted while Advanced Studio elements/text use a local interaction overlay.
- Element selection shows eight resize handles; pointer moves are rendered locally through requestAnimationFrame and persist only at gesture completion.
- Asset click insertion creates a durable `advanced.elements` record and selects it after the host settles.
- The visual rail provides local vector shapes, arrows, timeline decoration, medical/personal icons, a dynamic country-flag data source, backgrounds, and text. Basic assets are not placeholder tiles.
- Object lock and aspect lock are separate persisted state fields.
- The document model has durable multi-object group membership, group lock/aspect state, and group transform handling.
- The host forwards typed native asset drops across the protected iframe boundary without touching frozen D1-409H presentation files.

### Checks run

- `npm --prefix packages/mission-timeline run typecheck` — PASS.
- `node --test packages/mission-timeline/tests/d1-411b-fable-integration.test.mjs` — 14/14 PASS.
- Local Chrome smoke test — Advanced Studio loaded with no kernel failure; selection with eight handles, click-insert, and direct pointer drag were observed.

### Still required before any production claim

- Complete real-browser proof of cross-frame rail drag/drop, multi-select/group/ungroup gesture paths, group resize, text-in-canvas edit, lock/aspect persistence, snapping, axis/key/profile behavior, export fidelity, reload persistence, and all production canary journeys.
- Immutable package, Timeline-only backup, production canary, rollback verification, and independent browser verification.

Production was not mutated in this checkpoint.

## Continuation checkpoint — local Chrome

- Direct selection of an inserted element shows eight handles and its contextual controls: layer ordering, duplicate, delete, individual lock, and a visibly checked `Lock proportions` control.
- A physical browser pointer-drag moved the selected object without a blank-board replacement; the selection remained visible after the committed mutation.
- A corner resize was exercised on a proportion-locked element. The document state retained `aspectLocked: true`.
- FIT to 150% zoom was exercised. The same advanced overlay remained mounted (`1 → 1`) and no `LOADING CANONICAL TIMELINE` replacement appeared.
- The aspect-lock model test now confirms that changing proportions does not accidentally change the independent object/group lock state.

These are local candidate checks only. Group UI, rail drag/drop, persistence/reload, export, and production canary remain open.

## Continuation checkpoint — persistence and rail drag

- Click-to-add was exercised in Chrome and then reloaded through the real Edit Timeline route: element count was `6 → 7 → 7`. The inserted asset survived reload.
- The physical rail-to-canvas drag journey remains **FAIL / open** in the current Chrome automation path (`6 → 6`). A native `dragend` fallback has been added for protected-frame handoff, but it is not credited until the journey produces a visible inserted object in a real browser.

## 2026-08-08 local RC1 editor seal

Status: **LOCAL PASS; production packaging and canary pending.** The earlier open rail-drag result above is superseded by the verified result in this section.

### Canva-to-Timeline behavior disposition

| Interaction law | Canva observed behavior | Timeline RC1 verified behavior |
|---|---|---|
| Selection and direct manipulation | Canvas object remains selected while it follows the pointer | Selected object remains mounted and follows local pointer state; one document commit occurs at gesture end |
| Rail insertion | Thumbnail click or physical drag inserts at the canvas | Click-to-add and physical rail-to-protected-canvas drag both create and select the durable asset |
| Text | Direct canvas editing | Double-click enters inline editing; committed text survives save/reload |
| Multi-selection and grouping | Modifier selection forms a movable/resizable composition | Shift selection, Group, move, resize, Ungroup, undo, and redo pass in Chrome |
| Resize and proportions | Handles provide free or proportional resizing | Corner/side handles, independent object lock, and persisted proportion lock pass |
| Spatial feedback | Temporary alignment guides and snapping | Canvas-center, edge, and nearby-object snapping update without remounting the board |
| Viewport zoom | Viewport operation; canvas remains mounted | FIT/100%/150% preserve DOM, selection, panel, and scroll context |
| Export | Visible composition is serialized | PNG, Letter PDF, and A4 PDF preserve the host overlay and protected board composition |

Timeline intentionally does not reproduce Canva collaboration, stock search, animation, video/audio, AI generation, brand-account administration, or its full template ecosystem. Those are outside this bounded Timeline editor.

### Browser results

- **32 / 32 local interaction and export journeys PASS in Chrome.** This includes physical rail drag/drop, click insertion, inline text editing, multi-select/group/ungroup, group move/resize, lock/unlock, freeform resize, layer changes, snapping, duplicate, undo/redo, zoom without remount, Color Key move/resize, profile-card move/resize, manual year-boundary drag, save/reload, and opened export artifacts.
- The visible library panels contain working vector shapes, arrows, medical/personal icons, Timeline decorations, app-owned MissionMed wordmark, professional backgrounds, and a runtime-generated country/region flag collection. No visible tile used by the acceptance journey is decorative-only.
- Two consecutive full real-browser regression runs completed **42 / 42 PASS each (84 / 84 combined)** across administrator, eligible-360, and removed/read-only personas.
- Targeted Node regression after the final fixes: **119 / 119 PASS**; TypeScript typecheck PASS; `git diff --check` PASS.
- Dense 13-event rendering, missing/failed media fail-soft behavior, responsive 390×844 rendering, history, save/reload, manual axis, Color Key interaction, and same-DOM export passed with zero new browser errors.

### State, persistence, and performance

- Pointermove uses local frame-scheduled geometry and does not send a network request, regenerate the protected renderer, remount the board, or persist on every event. A single logical state update is committed at gesture completion, followed by existing debounced persistence.
- Groups persist child membership and relative transforms; lock, aspect, z-order, background, axis override, Color Key overrides, and advanced objects remain document-owned state.
- Profile visa wrapping is presentation-only; stored profile data remains unchanged.
- Successful administrator browser timing: PNG approximately **267–327 ms**, Letter PDF approximately **612–683 ms**, and A4 PDF approximately **513–545 ms**.

### Export defect and repair

The first opened artifacts exposed a real serializer boundary defect: host-layer Advanced objects were present on screen, but their positioning CSS lived in the iframe head while export cloned only `#board`. The objects therefore collapsed at the left edge in exported output. The repair embeds the bounded host-overlay style inside the cloned overlay. The regenerated PNG and both rendered PDF pages were opened and visually compared to the source canvas; object placement, background, protected geometry, typography, and z-order match the visible composition.

Artifacts:

- `editor-ux-004/export-artifacts/RC1_EDITOR_CANVAS.png`
- `editor-ux-004/export-artifacts/RC1_TIMELINE_1920x1080.png`
- `editor-ux-004/export-artifacts/RC1_TIMELINE_LETTER.pdf`
- `editor-ux-004/export-artifacts/RC1_TIMELINE_A4.pdf`
- `editor-ux-004/export-artifacts/RC1_EXPORT_BROWSER_RECEIPT.json`

### Bounded files changed

- `web/js/uxr-002/advanced-studio.js`
- `web/js/uxr-002/advanced-board.js`
- `web/js/d1-411a/kernel-host.js`
- `web/js/d1-411a/domain-visual-adapter.js`
- `web/js/407f-engineering-adapter.js`
- focused editor/Fable tests and the local export-browser evidence runner

No Matrix shell, StoryForge, Arena, USCE, File Vault, WordPress core, Railway API, database schema, entitlement, or unrelated application source changed.

### Remaining release work

1. Bind the source to an immutable Git commit and build the content-addressed static and WordPress payloads.
2. Verify the exact live Timeline pointer and hashes, create a fresh Timeline-only recovery snapshot/provider backup, and preserve the immediate prior pointer.
3. Install the Timeline-only immutable runtime, run Founder/admin/student/security canaries, open live PNG/PDF exports, and independently verify the release.
