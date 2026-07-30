# D1-405 Visual Review

Status: in progress

## M0 baseline

Canonical 407F identity preserved. The primary future correction target was the narrow Builder composition and compressed preview.

## M1 branding and navigation

Verdict: PASS

- Premium italic 407F wordmark preserved.
- Four-destination rail remains balanced at desktop, tablet, and phone.
- `Edit Timeline` reads clearly without introducing rail clutter.

## M2 Home and File Vault

Initial verdict: FAIL

Concrete corrections requested:

1. Replace the transient pale main field with the stable dark 407F atmospheric/grid field.
2. Replace the browser-default white search control with the established dark 407F field treatment.

Corrections completed and all three screenshots recaptured from the running app.

Final verdict: PASS

Evidence:

- `evidence/screenshots/D1-405-M2-home-empty.png`
- `evidence/screenshots/D1-405-M2-file-vault-chooser.png`
- `evidence/screenshots/D1-405-M2-home-populated.png`

No remaining concrete M2 visual blocker.

## M3 horizontal Builder workflow and composition

Initial Vitruvius verdict: D1 PASS / D2 FAIL

Concrete corrections requested:

1. Remove guaranteed exact-1024 overflow from the two-column minimums.
2. Put the primary editor before the preview in the stacked layout.
3. Reveal the persisted/current active tab on route entry without moving focus.

Initial Miyamoto recapture verdict: FAIL

Concrete evidence corrections requested:

1. Replace the high-DPI tablet crop with a CSS-scale viewport capture.
2. Add a scrolled tablet capture proving the preview remains available below the editor.

Corrections completed:

- Builder stacks at 1151px and below.
- Editor precedes the preview.
- Horizontal overflow is confined to the step navigator.
- Active tab is revealed on every render without focus movement.
- Exact 1024/1023 document widths do not overflow.
- CSS-scale editor and scrolled-preview captures were recorded.

Final verdicts:

- Miyamoto: PASS.
- Vitruvius: D1 PASS / D2 PASS.

Evidence:

- `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-desktop.png`
- `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-tablet.png`
- `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-tablet-preview.png`

No remaining concrete M3 visual or responsive blocker. True proportional rendering and interactive lightbox behavior remain an explicit M4 obligation.

## M4 proportional interactive preview and lightbox

Initial interaction-evidence verdict: FAIL

Concrete correction requested:

1. Ensure exam marker activation focuses an editable control instead of the adjacent Delete action.

Correction completed:

- Exact exam routing now excludes delete controls and focuses the corresponding attempt result control.
- The final click-to-edit capture was recorded after an unrelated stale export toast had cleared.
- The embedded and lightbox previews retain the canonical white 407F timeline board, dark shell, diagonal controls, and MissionMed cyan/orange interaction language.
- Both preview surfaces preserve a true 16:9 board without stretching, clipping, or an alternate shell.

Final verdict: PASS

Evidence:

- `evidence/screenshots/D1-405-M4-proportional-preview-desktop.png`
- `evidence/screenshots/D1-405-M4-full-preview-lightbox-desktop.png`
- `evidence/screenshots/D1-405-M4-click-to-edit-exam-desktop.png`

No remaining concrete M4 visual or interaction blocker.
