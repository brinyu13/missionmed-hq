# 03 — Editor Interaction Report

## What the investigation established about the architecture

The edit canvas is a **cross-document iframe**. `renderResponsiveAdvancedBoard`
(`407f-engineering-adapter.js:1484`) always routes through `kernelManager.render()`, which
emits a `<d1-timeline-kernel>` custom element hosting the protected master inside a
shadow-root iframe. A large part of `canvas.js`'s interaction layer is therefore **inert in
the shipping path**: its pointer handlers target `[data-canvas-event]`, which only exists in
the legacy `interactiveBoardSvg` path. All real direct manipulation lives in
`kernel-host.js` (`_beginGesture` for protected furniture, `_applyAdvancedOverlay` for
student-added objects). Any future editor fix belongs there, not in `canvas.js`'s drag code.

`patchPersistentCanvas` (`canvas.js:1630-1694`) keeps the kernel element alive across
renders — which is why zoom does not remount the timeline — but deletes and re-creates
every *other* child of the screen on every render. That single behaviour is the root cause
of both focus-loss defects below.

## Genuinely implemented (verified in code; do not rebuild)

Grouping/ungrouping with proportional child scaling, marquee multi-select, snapping to
board and object edges/centres with visible guides and alt-to-disable, eight-handle resize
with corner aspect lock, keyboard nudge (1px / 10px with shift), delete, duplicate,
bring-forward / send-backward, double-click inline text editing with Escape-revert and
Cmd-Enter-commit, click-to-add from the rail, ghost-based drag-to-canvas with correct drop
coordinates, and direct manipulation of the colour key, profile card and year-axis
boundaries. Zoom is viewport-only and does not mutate the document or remount the kernel.

## Fixed in this run

| ID | Defect | Fix |
|---|---|---|
| A1 | Selecting a text object collapsed its font to the minimum and flagged it as overflowing — the eight resize handles are appended as children and positioned outside the box, so they were measured as text content | `fitTextNode` hides the selection chrome across the measurement and restores it in a `finally` |
| A2 | The editable zoom percentage field was unusable — every keystroke triggered a full render that detached the live input | Zoom now applies in place (inline width + data attributes, exactly what `renderCanvas` writes, so the kernel's ResizeObserver refits without re-projecting), with a `change` listener that commits and re-syncs to the clamped value |
| A3 | Uploaded rail thumbnails had no size constraint and rendered at natural size — a tall photo became an enormous vertical preview | The rail-list image joins the existing constrained thumbnail rule (`height:62px; object-fit:cover`) |
| A9 | Uploads were constrained on width only, so a 1000×5000 image resolved to height 2400 on a 1080 board and centred at y=−660 | `createMediaElement` aspect-fits into a bounded box on both axes |

## Confirmed but NOT fixed in this run

These are real and verified; they are the highest-value editor work remaining.

- **A4** — Text alignment left/center/right does nothing, and the vertical-alignment control
  moves text horizontally (`kernel-host.js:950`).
- **A5** — Milestone flags, title plaque, photo tiles, logo mount and sticky note are
  selectable but cannot be dragged; `_beginGesture` implements only arrows, axis, colour key
  and profile card (`kernel-host.js:1542`). Ticket §3 wants every presentation object
  manipulable, so this is the largest remaining parity gap.
- **A6** — All direct manipulation of protected objects is switched off below 40% board
  scale (`kernel-host.js:1480`).
- **A7** — No keyboard zoom shortcuts; ctrl/cmd+wheel is dead over the board because the
  listener is on the parent document, not the kernel iframe (`canvas.js:2335`).
- **A8** — Typing in the Advanced Studio text field loses focus after every character; the
  inspector is rebuilt per keystroke (`407f-engineering-adapter.js:4487`). Same root cause as
  A2 and fixable the same way.
- **A10** — Uploaded/text/shape rail tiles advertise drag-to-canvas but every drop handler
  rejects their payload (`advanced-studio.js:1768`).

Canvas zoom is also never persisted back to `preferences.canvasZoom` even though it is read
from there at install — a one-line addition in `syncCanvasDocument` if zoom should survive
a reload.
