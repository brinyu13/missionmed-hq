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
