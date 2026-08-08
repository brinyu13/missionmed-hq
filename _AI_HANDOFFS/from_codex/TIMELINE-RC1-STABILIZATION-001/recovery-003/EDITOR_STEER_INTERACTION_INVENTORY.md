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
