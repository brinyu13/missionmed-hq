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
