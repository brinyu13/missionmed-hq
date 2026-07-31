# D1-405 Accessibility Report

Status: in progress

Authority: WCAG 2.2 AA and the governing D1-405 acceptance contract.

## Preserved contrast decisions

| Original token/use | Replacement token/use | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| `accent.gold = #B98A2E` with white normal-size text | Preserve `#B98A2E`; use `accent.goldText = #191C21` for normal-size text and icons placed directly on gold | White does not meet the applicable normal-text threshold on the frozen gold | Previously approved D1-UXR-002 contrast evidence; candidate-bound states remain independently verified | Gold actions, selected states, icons, borders, and focus states where directly placed on gold |
| `ink.tertiary = #8A9099` for 11px/650 micro-labels | `ink.secondary = #565D66` for micro-label text; preserve tertiary ink for decorative/non-text use | Tertiary ink fails the normal-text threshold on white and shell backgrounds | 6.6597:1 on white; 6.1622:1 on shell | Home, Builder, Edit Timeline, Export, dialogs, slide-overs, toolbars, empty/success/error states, responsive layouts |

These substitutions preserve the frozen gold and ink families, product hierarchy, wording, navigation, workflow, and interaction behavior.

## M1 branding and navigation

- Founder-visible brand text remains readable at desktop, tablet, and phone widths.
- Navigation retains a four-item landmark and current-route announcement.
- `Edit Timeline` replaces founder-facing `Canvas` wording without changing route identity.
- Programmatically focused non-interactive headings suppress only the browser-default rectangle; interactive focus remains visible.

## M2 Home and File Vault

- Primary and secondary intake actions have distinct accessible names and visible focus.
- The chooser has a dialog name, focus trap, Escape handling, and opener focus restoration.
- Search and result controls use native label/input relationships.
- Continue is disabled until one document is selected.
- Unavailable integration state is conveyed in text and does not rely on color.
- Empty and populated timeline states are truthful and independently labeled.

## M3 Builder workflow

- The seven-step control is a named tablist with linked tab/panel semantics.
- One tab participates in the tab order at a time.
- Left/Right, Home, and End keys provide deterministic horizontal navigation.
- Complete, started, skipped, and empty states include non-color labels.
- The active tab is revealed on route entry without stealing focus.
- Horizontal overflow remains local to the navigator at constrained widths.
- The editor remains before the preview in reading and task order when stacked.

## M4 proportional interactive preview and lightbox

- Each preview SVG is a named `group`, not a misleading static image.
- Actionable timeline elements expose ownership metadata and chronological roving focus.
- Arrow, Home, and End keys move through actionable elements.
- Enter and Space activate the focused preview element.
- Core and exam activation route to the exact Builder destination and place focus on an editable control.
- Unknown or stale ownership fails closed.
- Transparent hit rectangles provide a minimum 44px target without changing visible marker geometry.
- Visible focus uses the established cyan halo, with a forced-colors fallback.
- The lightbox has a dialog name, trapped focus, inert background, Escape close, explicit close action, and focus restoration.
- Fit, 100%, and 150% zoom use one contained scrollport; the document does not acquire horizontal overflow.
- Embedded and modal previews use `xMidYMid meet` and preserve the 1920×1080 view box.

Browser proof:

| Check | Result |
|---|---|
| Chronological roving focus | Passed |
| Enter/Space activation | Passed |
| Exact exam focus target | Passed |
| Core focus target | Passed |
| 44px target overlays | Passed |
| Dialog focus trap | Passed |
| Background inertness | Passed |
| Escape and opener restoration | Passed |
| Forced-colors focus rule | Present |
| Fresh console warnings/errors | 0 |
| Specialist accessibility verdict | Initial FAIL for interview-marker order and initial tab stop; final PASS after correction |

## Autonomous implementation-level adjustments

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Browser-default SVG pointer targeting | 44px transparent target overlays | Improve pointer and touch operability while preserving the exact visible board | Not color-contrast applicable | Embedded and modal timeline events |
| DOM-order focus across renderer groups | Chronological roving focus | Match keyboard order to the presented timeline | Not color-contrast applicable | Embedded and modal timeline events |
| Browser-default SVG focus indication | Existing cyan halo plus forced-colors outline | Make focus unambiguous against both the white board and system high-contrast palettes | Candidate uses existing approved cyan; system outline controls in forced colors | Embedded and modal timeline events |
| Live background remaining interactive beneath modal | `inert` plus focus trap while the lightbox is open | Prevent assistive-technology and keyboard escape into the underlying app | Not color-contrast applicable | Header, navigation rail, main workspace |

No autonomous adjustment changes product hierarchy, workflow, navigation, layout, copy meaning, business behavior, or brand identity.

## M5 shared date controls

- Month/year and exact-day inputs remain ordinary editable text fields with adjacent calendar triggers.
- Every trigger exposes `aria-controls` and `aria-expanded`; popovers are named dialogs.
- Month cells use grid/row/gridcell semantics. Exact dates use a deterministic 7×6 grid with weekday headings.
- Exact-day keyboard support includes Arrow keys, Home, End, Page Up, Page Down, Enter/Space activation, and Escape restoration.
- Input and trigger targets are at least 44×44px.
- Help and error text are independently referenced; invalid controls set `aria-invalid`.
- Typed invalid values remain visible and receive specific correction text.
- Selected gold cells use Founder-approved `#191C21` text on `#B98A2E`.
- Cyan focus indicators are independently visible on inputs, triggers, and calendar cells.
- Phone calendars use the same semantic control in a bottom-sheet position; reduced-motion disables picker animation.

Evidence:

- `evidence/screenshots/D1-405-M5-month-picker.png`
- `evidence/screenshots/D1-405-M5-exact-date-picker.png`
- `evidence/screenshots/D1-405-M5-date-error-state.png`

## Founder steering — stepper and shared Media

- Stepper tabs retain correct horizontal tab semantics, roving focus, arrow/Home/End navigation, and descriptive state labels.
- Current, complete, started, skipped, and empty states use shape, border, glyph, underline, text, and ARIA—not color alone.
- Step controls are 68px high; Media launchers, upload, close, and card actions have a 44px minimum.
- Step hover/press motion is removed under `prefers-reduced-motion`.
- Media launchers expose `aria-controls`, `aria-expanded`, and `aria-haspopup="dialog"`.
- The non-modal Media drawer is named, Escape-closeable, restores its opener, and closes when the route leaves Builder/Edit Timeline.
- Library rerenders preserve the active upload/place/remove control where it still exists.
- Place/remove/upload actions update the global polite live region in addition to the visual toast.
- Cards are not redundant tab stops. Each unplaced asset exposes a real keyboard button with instructions for center placement.
- Reduced-motion Media markup omits the raw animated GIF URL and presents a visible `GIF · MOTION PAUSED` state.
- Tablet drawers have a viewport-bound maximum height and internal scroll. Phone page headers/toolbars stack rather than crowd.
- Contrast review retains the approved candidate tokens: `#191C21` on gold/orange surfaces; mid, dim, cyan, and green content passes on the dark 407F surfaces.

Specialist status:

- Miyamoto: stepper PASS; initial Media FAIL for inherited fixed-header layout; defect corrected and visually recaptured.
- Vitruvius: initial Media FAIL for focus/live-region/target/semantics/responsive gaps; all enumerated defects corrected; final re-audit PASS with no remaining blocker.

Darwin’s final architecture re-audit also returned PASS with no remaining Media persistence or state-flow blocker.

Evidence:

- `evidence/screenshots/D1-405-founder-steer-premium-stepper.png`
- `evidence/screenshots/D1-405-founder-steer-media-library-corrected.jpg`
- `evidence/screenshots/D1-405-founder-steer-media-drawer-builder-corrected.jpg`

## M6 — Core Info registry and conditional authorization fields

- The school search is a named combobox controlling one semantic listbox.
- The first result is active immediately; Arrow Up/Down, Enter, and Escape use
  one predictable focus model.
- Options contain no nested interactive controls.
- Search status, selection, normalization eligibility, and conditional-field
  changes are announced through polite atomic live regions.
- School verification state uses copy, icon, border, and color rather than
  color alone.
- Search, filters, unlisted-school fields, and conditional work-authorization
  controls preserve the 407F minimum target and visible-focus requirements.
- Error/help text is independently referenced. Required conditional fields set
  `aria-invalid` and receive focus on failed Continue.
- Work-authorization rerenders restore focus once and retain the relevant
  `aria-describedby` relationship.
- The dark search field uses the canonical 407F `9px 11px` inset. Gold content
  continues to use Founder-approved `#191C21`; micro-labels continue to use
  `#565D66`.
- The selected-school status stacks at narrow widths, result lists are
  viewport-bounded, and reduced-opacity states do not carry required meaning.
- Fresh-browser interaction checks completed with zero console warnings/errors.

Specialist verdict: Vitruvius PASS with no remaining local M6 accessibility
blocker.

Evidence:

- `evidence/screenshots/D1-405-M6-core-info-medical-school-registry-corrected.png`
- `evidence/screenshots/D1-405-M6-medical-school-alias-search-corrected.png`
- `evidence/screenshots/D1-405-M6-unlisted-school-normalization-queue-corrected.png`

## M7 — Exams, rotations, and LOR workflow

- Scored Passed/Failed attempts expose `Score *`, `aria-required`, a specific
  `Required.` error, and focus the first invalid score on Continue.
- Awaiting result and genuine nonnumeric status paths do not receive a false
  numeric-score requirement.
- The preview retake action is a separate keyboard/pointer target and restores
  focus to the exact retake date field.
- The specialty selector is a named combobox/listbox with active-descendant
  navigation, 44px options, non-free-text enforcement, `COMMON` badges, and
  stable normalized values.
- Exact rotation days reuse the shared named calendar dialogs and preserve
  independent start/end validation, including date-order feedback.
- LOR status uses four guided outcome buttons plus progressively disclosed exact
  workflow statuses rather than a wall of fields.
- Selected LOR outcomes use `aria-pressed`; workflow status remains available
  through a labeled select.
- The submitted marker is a named `role="img"` with `aria-label="LOR
  submitted"`. The legend repeats the exact label. Neither depends on color.
- Rotation event accessibility names include `LOR submitted` only for the
  currently selected matching specialty.
- Star and legend serialization passed across all five themes and export
  rendering.
- The local LOR Builder action announces its truthful result:
  `Queued locally. No production LOR Builder task was created.`
- The premium stepper retains tab semantics, non-color state glyphs, 44px-plus
  targets, cyan focus, and reduced-motion overrides.
- The single mobile automatic-retake badge reflows below the card heading rather
  than narrowing or obscuring the Delete action.
- Fresh-browser console after persistence restart and queue interaction:
  zero warnings/errors.

### M7 autonomous contrast/typography adjustment

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Undefined `.microLabel`, inheriting body-sized white text | 11px/650 `#75CFEA` uppercase micro-label | Restore card hierarchy while preserving wording, layout, workflow, and brand | 9.7573:1 on `#131B29`; 10.9957:1 on `#080D16` | `LETTER OF RECOMMENDATION` in the rotation LOR card |

This is narrowly implementation-level under the Founder implementation
authority. It does not replace `accent.gold`, `accent.goldText`,
`ink.secondary`, or `ink.tertiary`, and it does not reinterpret unrelated
theme colors.

Specialist verdicts:

- Miyamoto: initial FAIL for the undefined micro-label treatment; final PASS
  after correction.
- Vitruvius: PASS; no concrete M7 functional or accessibility defect.

## M8 specialty-variant accessibility

- The active specialty is communicated by visible eyebrow, timeline name,
  specialty label, selected native control value, and live announcement; it
  does not depend on the gold signal alone.
- The selector and all management actions retain 44px minimum target height,
  visible cyan focus, keyboard operation, and the 407F dark material language.
- Create and rename use labeled native controls. Remove uses an `alertdialog`
  with an explicit description that factual history remains unchanged.
- The final variant cannot be removed, and the disabled control is visible in
  the one-variant state.
- LOR difference remains non-color: the submitted state adds both a named star
  and the exact `LOR submitted` legend text.
- Mobile rules stack the identity and controls without narrowing the primary
  editor; the horizontal stepper remains independently scrollable.
- Browser create/switch interaction produced zero console warnings/errors.

Vitruvius initially failed the M8 checkpoint for missing dialog containment,
lost select focus after rerender, and a legacy backdrop path that bypassed inert
cleanup. Corrections were validated live:

- forward and reverse Tab wrap remain inside the dialog;
- Escape closes and restores the invoking control;
- backdrop click closes through the same cleanup path;
- header, rail, and main inert state clears on every close path;
- switching variants retains focus on the rebuilt native selector;
- the browser console remains clean.

Final M8 Vitruvius verdict: PASS.

## M9 Explanation and Interview Target accessibility

- Explanation authoring uses labeled native controls and bounded
  event/date/region/coordinate target panels.
- Irrelevant target panels are both hidden and disabled; Coordinate exposes
  labeled X/Y controls rather than an implicit point.
- Explanation text has a 180-character limit, and placement/size controls
  enforce visible-board bounds.
- Create/save failures set `aria-invalid`, expose linked `role="alert"` error
  text, announce through the global polite live region, and restore focus to the
  invalid textarea.
- Leader-arrow state uses a named native checkbox with a 44px label hit area.
- General/specific interview purpose uses native radio semantics, 44px labels,
  transparent unchecked centers, and a gold inner dot only when checked.
- Program-logo upload has a 44px minimum target and a visible
  `:focus-within` ring; type/storage failures use the same inline/live
  validation and focus-recovery pattern.
- Month/date picker indicators use the existing cyan visibility treatment on
  dark fields and retain the global focus-visible ring.
- Matrix Calendar fails closed with visible `Calendar unavailable` and
  `LOCAL REVIEW · NO LIVE CONNECTION` text.
- Program-logo upload, persistence, resize/crop, Guided rendering, and
  full-preview evidence were verified with a real local synthetic WEBP.
- Fresh live-browser console remained at zero warnings/errors.

### M9 autonomous adjustments

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Theme ink inherited on `#111827` Explanation card | `#F4F7FF`; paper cards retain `#191C21` on white | Prevent dark-on-dark annotation text | 16.5528:1 on `#111827`; 17.0815:1 on white | Builder, full preview, Export |
| Native blue checkbox/radio and dark date indicator | Gold `#B98A2E` selection and cyan `#75CFEA` picker/focus treatment | Preserve 407F identity while improving perceivability | 5.5364:1 gold on `#111B2C`; 10.5102:1 cyan on `#0B1321` | Leader control, interview-purpose radios, date controls |
| Toast-only failure | Linked `#FF9F86` alert, `aria-invalid`, live announcement, focus recovery | Make error state screen-reader and keyboard operable | 9.3466:1 on `#0B1321` | Explanation and logo failures |

Vitruvius initially failed M9 for conditional-target semantics, Coordinate X/Y,
logo target/focus treatment, and toast-only validation. All were corrected and
verified live. Miyamoto initially failed browser-default control styling and
the unchecked radio’s false-selected appearance. Both were corrected.

Final M9 Miyamoto verdict: PASS.

Final M9 Vitruvius verdict: PASS.
