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

## M5 shared date controls

The shared controls preserve the accepted 407F shell and use:

- dark ink popovers with restrained depth,
- cyan triggers and focus indicators,
- Founder-approved gold selection with `#191C21` text,
- compact monospaced calendar labels,
- 44px controls without expanding the Builder form into multiple columns,
- fixed/clamped desktop placement and phone bottom-sheet placement.

Evidence:

- `evidence/screenshots/D1-405-M5-month-picker.png`
- `evidence/screenshots/D1-405-M5-exact-date-picker.png`
- `evidence/screenshots/D1-405-M5-date-error-state.png`

Founder steering received after capture requires a separate Miyamoto review of only the horizontal stepper visual treatment. The Builder layout and preview composition remain unchanged.

## Founder steering visual refinement

Miyamoto reviewed the implemented horizontal stepper and returned PASS:

- restrained layered texture and dimensionality,
- tactile hover lift and pressed depression,
- clear current/complete/started/skipped hierarchy,
- premium 407F cyan/amber/green accents,
- no glossy or childish treatment,
- no change to step order, height, Builder column geometry, or preview ratio.

Miyamoto’s initial Media review found the global 407F `header` selector positioning local Media headers as fixed application headers and the drawer bisecting the 190px rail. Both findings were corrected:

- page and drawer headers explicitly use local static positioning and transparent/local backgrounds,
- the desktop drawer starts at the full rail edge,
- the editing side is covered while the larger live preview remains visible,
- the Media page’s intended asset-library headline and local-only badge render in the workspace.

Evidence:

- `evidence/screenshots/D1-405-founder-steer-premium-stepper.png`
- `evidence/screenshots/D1-405-founder-steer-media-library-corrected.jpg`
- `evidence/screenshots/D1-405-founder-steer-media-drawer-builder-corrected.jpg`

Visual verdict after correction: PASS.

## M6 Core Info visual review

Miyamoto’s first M6 review found three presentation defects: a browser-default
search field, compressed selected-school hierarchy, and crowded filters. The
corrected registry now uses:

- a full-width dark 407F search surface with the canonical `9px 11px` inset;
- one-column filter stacking inside the narrow editing column;
- a selected-school status line beneath the school identity;
- restrained cyan/gold/green emphasis, inset depth, and tactile list states;
- a bounded result layer that does not reduce the proportional live preview;
- the unchanged one-column Builder editor and larger interactive preview on the
  right.

The final visual re-audit returned PASS.

Evidence:

- `evidence/screenshots/D1-405-M6-core-info-medical-school-registry-corrected.png`
- `evidence/screenshots/D1-405-M6-medical-school-alias-search-corrected.png`
- `evidence/screenshots/D1-405-M6-unlisted-school-normalization-queue-corrected.png`

## M7 exams and rotations visual review

The Founder steering was applied as a visual refinement, not a redesign:

- the horizontal seven-step layout remains unchanged;
- the one-column editing workspace remains primary;
- the larger proportional interactive preview remains on the right;
- full preview remains available;
- no form columns or replacement navigation system were introduced.

The stepper now presents:

- restrained machined texture and inset/recessed depth;
- a gold current-state rail and selected edge;
- subordinate green complete state;
- amber started state;
- neutral empty state;
- non-color glyphs and under-rails;
- tactile hover lift and pressed depression;
- cyan focus and reduced-motion suppression;
- no glossy or childish treatment.

The rotation/LOR surface uses the same 407F material language:

- gold edge and restrained diagonal texture;
- cyan target-specialty badge;
- exact dates above the LOR workflow;
- four tactile guided outcome buttons;
- a small gold/dark submitted star;
- a conditional bottom-right board legend.

Miyamoto’s first M7 audit returned one concrete FAIL: the unstyled
`LETTER OF RECOMMENDATION` label inherited body-sized white text and competed
with the card heading. The correction applies a compact 11px/650 cyan
micro-label with 9.7573:1–10.9957:1 contrast across the card gradient bounds.
The corrected screenshot was recaptured and the final re-audit returned PASS.

Evidence:

- `evidence/screenshots/D1-405-M7-premium-step-navigation.jpg`
- `evidence/screenshots/D1-405-M7-rotation-specialty-pinned.jpg`
- `evidence/screenshots/D1-405-M7-rotation-exact-dates-lor-workflow.jpg`
- `evidence/screenshots/D1-405-M7-lor-star-legend.jpg`

Final M7 visual verdict: PASS.

## M8 visual checkpoint

The specialty selector is a single, premium 407F instrument panel above the
horizontal workflow. Its amber status lamp, cyan micro-label, large active name,
native selector, and restrained machined texture make the active presentation
clear without becoming a second navigation system.

The one-column editor and larger live preview remain unchanged. Switching from
Pediatrics to Internal Medicine leaves the factual rotation and canvas geometry
stable while the specialty-matched LOR star changes immediately.

Evidence:

- `evidence/screenshots/D1-405-M8-variant-creation-workflow.jpg`
- `evidence/screenshots/D1-405-M8-two-variants-pediatrics.jpg`
- `evidence/screenshots/D1-405-M8-lor-star-internal-medicine.jpg`

Miyamoto identified one pre-final defect: the last-variant Remove guard looked
actionable. The corrected native disabled button now has a scoped dim,
desaturated, non-actionable treatment with a visible not-allowed cursor and no
hover-color response.

Final M8 Miyamoto verdict: PASS.

## M9 visual checkpoint

The Explanation tool is a bounded 407F instrument panel rather than a drawing
canvas. Its controls remain in the single primary Builder column while the
larger proportional preview stays fixed to the right and updates immediately.
The artifact uses a restrained dark callout with a gold leader and high-contrast
light text; Advisor Paper retains a white card with dark ink.

The Interview Target panel uses the same dark material language, cyan
micro-labels, gold edge, tactile segmented purpose controls, exact program
details, and a shared local Media logo well. A real WEBP was uploaded, cropped,
resized, persisted, and rendered in the full preview.

Initial review defects and corrections:

1. Native blue checkbox/radio styling and dark picker glyphs were replaced by
   407F gold selection and cyan picker/focus treatments.
2. The unchecked interview-purpose radio was changed from a solid white circle
   to a transparent center; only the selected radio receives a gold inner dot.
3. Explanation text inherited dark theme ink on a dark card. Non-paper cards
   now use `#F4F7FF` at 16.5528:1 contrast on `#111827`.

Evidence:

- `evidence/screenshots/D1-405-M9-explanation-creation.jpg`
- `evidence/screenshots/D1-405-M9-explanation-move-resize-leader.jpg`
- `evidence/screenshots/D1-405-M9-interview-specific-calendar-unavailable.jpg`
- `evidence/screenshots/D1-405-M9-calendar-unavailable.jpg`
- `evidence/screenshots/D1-405-M9-explanation-interview-export.jpg`
- `evidence/screenshots/D1-405-M9-control-polish.jpg`
- `evidence/screenshots/D1-405-M9-interview-control-polish.jpg`
- `evidence/screenshots/D1-405-M9-conditional-target-validation.png`
- `evidence/screenshots/D1-405-M9-program-logo-upload-resize.png`
- `evidence/screenshots/D1-405-M9-program-logo-full-preview.png`

Final M9 Miyamoto verdict: PASS.

## M10 visual checkpoint

The five frozen theme cards remain recognizably 407F: compact dark instrument
tiles, live 128×72 artifacts, restrained gold active state, and the existing
Advanced Studio cell. Populated timelines show the student’s real current
artifact. Empty accounts now show substantive rendered timelines in every
theme, with a cyan-on-dark `EXAMPLE TIMELINE` badge inside each miniature.

Export retains the 380px control rail and large right artifact preview. The
audience control is one premium dark native select. LOR, professional, and
alumni choices disclose only their own recipient fields in a bordered
instrument panel; Interview-safe stays concise. There is no generic
`Everything` choice.

Founder steering was rechecked in the same pass:

- the horizontal step layout is unchanged;
- step tiles use layered material, completion bars, status glyphs, and tactile
  hover/active/current states;
- Builder remains one primary editor column with the larger right preview;
- Media remains a first-class 407F route with one local asset library and
  shared drag/drop access from Builder/Edit Timeline.

Evidence:

- `screenshots/D1-405-Founder-Steering-Builder.png`
- `screenshots/D1-405-Founder-Steering-Media.png`
- `screenshots/D1-405-M10-theme-previews-student-content.png`
- `screenshots/D1-405-M10-theme-previews-empty-example.png`
- `screenshots/D1-405-M10-export-interview-safe.png`
- `screenshots/D1-405-M10-export-lor-writer.png`
- `screenshots/D1-405-M10-export-professional-connection.png`
- `screenshots/D1-405-M10-export-mission-residency-alumni.png`
- `screenshots/D1-405-M10-export-theme-focus-modal.png`

Final M10 Miyamoto verdict: PASS.
