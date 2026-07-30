# D1-404 Complete Combined Handoff

Status: COMPLETE — closest safely achievable local deployment candidate

Branch: `d1-macprotimeline-uxr-002`

Remote mutations: none

Matrix mutations: none

Production writes: none

## Authority

- D1-404: `/Users/brianb/Downloads/D1-404_CODEX_407F_UPGRADE_AND_PRODUCTION_MEGARUN.md`
  - SHA-256: `b318e9da82a45c187725a6439fa042e0cab54af4973a5d5c7fdb6b5974c63db4`
- Canonical 407F presentation:
  `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html`
  - SHA-256: `23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b`
- Functional authority:
  `/Users/brianb/Downloads/D1-UXR-001-TimelineBuilder-DesignFreeze_1.md`
  - SHA-256: `f089f62f291a757393187c0c3fd400541a1514479b2ba074f37f070d389e6552`

## White-UXR halt

The prior white-shell runtime activation was halted because D1-404 explicitly
supersedes it. Its shell-agnostic logic, persistence, adapters, services, and tests
remain available as engineering sources, but `web/index.html` does not load
`web/js/app.js`, `web/styles.css`, `web/js/uxr-002/app.js`, or
`web/styles/uxr-002.css`.

## Milestone log

### M0 — canonical recovery

- Restored the exact canonical 407F bytes to the active runtime.
- Verified `http://127.0.0.1:8793/web/` in the in-app browser.
- Verified Home → Guided Builder → Home navigation.
- Console warnings/errors: 0.
- Test baseline: 371/371 (119 TypeScript + 252 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M0-canonical-407f-restored.png`
- Visual verdict: pass — immediately recognizable as canonical dark 407F.
- Commit: `d5126f8`

### M1 — four-destination 407F shell

- Reduced the canonical rail from 11 destinations to exactly Home, Builder,
  Canvas, and Export.
- Removed the XP/MP/level/avatar HUD, legacy header telemetry, Draft Status
  telemetry panel, and rail footer.
- Added the local `← Matrix` stub, preserved Timeline//S1 identity, added a
  live autosave state, and implemented zero-event Export disable semantics.
- Exposed one narrow 407F runtime seam and activated the shell-agnostic
  engineering adapter without loading the white UXR entry or stylesheet.
- Preserved prior local timeline data through the adapter.
- Browser rail/runtime assertion: pass.
- Console warnings/errors: 0.
- Test baseline: 374/374 (119 TypeScript + 255 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M1-four-destination-407f-shell.png`
- Visual verdict: pass — same dark 407F world, angular gold rail, premium depth,
  Archivo/Rajdhani character, and Keynote-derived energy.
- Commit: `fcde6fb`

### M2 — three-region Home

- Rebuilt Home as exactly three 407F-styled regions in the frozen 7/5/12-column
  layout: Build your timeline, Start from your CV or MyERAS, and Your timeline.
- Applied all verbatim five-second-contract copy.
- Added empty/ghost, resume, pending-intake, advisor-approved, live-preview, and
  start-over/version states without loading demo data into the student's draft.
- Browser semantic hierarchy: pass — one H1, two H2 region titles.
- Console warnings/errors: 0.
- Test baseline: 377/377 (119 TypeScript + 258 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M2-three-region-407f-home-desktop.png`
- Visual verdict: pass — the clearer Home hierarchy remains inside 407F's dark,
  layered, angular, premium visual system.
- Commit: `114dc37`

### M3 — seven-step Builder shell and Core Info

- Rebuilt Builder as the frozen three-zone 407F layout: fixed 264px vertical
  stepper, centered form column, and right-side live preview.
- Added the exact seven step titles, purpose copy, free step navigation, and
  complete/started/skipped/empty state glyphs.
- Implemented Core Info in frozen field order with required validation,
  flexible month parsing, country selection, degree selection, optional visa
  status, and canonical Education milestone projection.
- Persisted wizard and Builder state through the retained engineering adapter.
- Browser semantic/runtime assertion: pass — seven step buttons, one current
  step H1, sticky Back/Continue controls, and live preview.
- Console/runtime errors observed during browser validation: 0.
- Regression evidence: 381 tests pass when the nine performance tests are
  isolated from the functional/module run (110 TypeScript functional + 9
  performance + 262 module tests). The default all-at-once run produced
  load-sensitive wall-clock misses in pre-existing autosave benchmarks while
  all correctness assertions and the isolated 9/9 performance run passed.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M3-seven-step-407f-builder.png`
- Visual verdict: pass — the form hierarchy and live preview remain immediately
  recognizable as the canonical dark 407F product.
- Commit: `5f2b3e6`

### M4 — Exams workflow

- Connected the retained, tested exam workflow to the canonical 407F Builder
  through the engineering adapter; no parallel exam state machine was created.
- Implemented independent USMLE and COMLEX-USA system cards, add-via-chip exam
  creation, score/result-first card hierarchy, date fields, score visibility,
  deletion, and the exact Step 2 skip behavior.
- Preserved automatic attempt numbering and the failure transition: neutral
  failed dot, automatic retake card, linked hatched study period, dashed
  provisional outline, Set retake date action, and solid closure on retake date.
- Persisted exam records, selected systems, projected events, and workflow
  metadata through the retained local engineering store.
- Browser interaction assertion: pass — both exam systems can be active
  independently; COMLEX chips appeared while USMLE stayed active; the temporary
  COMLEX selection was returned to its original state.
- Browser semantic assertion: pass — one Exams H1, system fieldset, Added exams
  H2, frozen field order, automatic-card label, and failed-attempt signal.
- Regression evidence: 110/110 TypeScript functional tests and 266/266 module
  tests pass. The nine pre-existing performance tests remain load-sensitive:
  correctness assertions pass, but one wall-clock autosave threshold missed
  during the M4 loaded runs; the same nine-test suite passed 9/9 at M3 and no
  persistence/performance implementation changed in M4.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M4-exams-407f-workflow.png`
- Visual verdict: pass — the exam workflow reads as a native extension of the
  dark 407F Builder rather than an imported white-shell component.
- Commit: `8f11597`

### M5 — Rotations, Work, Research, and Personal

- Connected the retained Builder domain engine to the canonical 407F form layer;
  commit, edit, delete, undo ownership, linked publication milestones, canonical
  event projection, and durable draft state remain owned by the existing tested
  engineering rather than a parallel UI state machine.
- Implemented the frozen one-at-a-time, unlimited-entry model for US Clinical
  Rotations, Work Experience, Research, and Personal, including saved rows,
  Edit/Delete actions, skip actions, exact field order, date-order validation,
  open-ended spans, and live board projection.
- Bundled local-only data for medical schools, US teaching institutions, and
  the May 2026 ACGME specialty/subspecialty vocabulary. No runtime network
  request is used for search.
- Reused the retained typeahead row/ranking engineering and implemented the
  active 407F interaction layer: two-character search, at most eight matches,
  keyboard navigation/Enter, final `Use "{text}" as written` row, known-site
  City/State autofill, and editable/manual fields for unlisted sites.
- Implemented the searchable Work country control with the student's school
  country and United States pinned above the remaining alphabetical local
  country list; free-text country creation is disabled.
- Implemented all six frozen research author positions, conditional publication
  fields, Published default milestone toggle, linked publication projection,
  the exact 12 Personal icons, and interviewer-safe/advisor-only visibility.
- Browser interaction assertions: pass — keyboard and pointer typeahead paths,
  MGH → Boston/MA autofill, unlisted-site blank City/State, country pinning,
  research publication disclosure, and 12-icon Personal picker.
- Browser errors from the final M5 rerun: 0. A nested focusout/render race found
  during typeahead validation was fixed and did not recur.
- Regression evidence: 390/390 tests pass in segmented runs: 109/109
  non-performance TypeScript, 10/10 isolated performance, and 271/271 module
  tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M5-domain-entry-workflows.png`
- Visual verdict: pass — the expanded forms, suggestion surface, saved-entry
  model, and live preview preserve the canonical dark, layered 407F character.
- Data authority:
  `https://www.acgme.org/globalassets/pdfs/specialtieslist.pdf`
  (`©2026 ACGME`, May 2026).
- Commit: `a530cda`

### M6 — Review & Finish

- Connected the retained completeness and story-check engine to canonical 407F
  through the engineering adapter; no duplicate gap/overlap/exam logic was
  introduced.
- Rendered exactly six completeness rows with complete, started, skipped, and
  empty glyphs, event counts, and accessible Edit links to the owning Builder
  step.
- Rendered only the three frozen neutral check types: six-month-or-longer gaps,
  more-than-two concurrent duration events, and awaiting exam results.
- Review links route to the owning Builder step/entry or exam, including the
  retained edit-draft path for domain entries.
- Added the ungated `Open my canvas →` and `Export now` actions; Canvas opens in
  the student's Guided/blank-data mode. The redundant Step 7 sticky Continue
  control is hidden so the primary action appears exactly once.
- Extended the 407F-to-engineering mapping for Core Info and Builder touched
  state so completeness is computed from canonical durable data rather than
  display-only state.
- Browser assertions: pass — six rows, one active story check in the local
  fixture, accessible row labels, Work edit jump, owning Exams story jump,
  Guided Canvas route, and Export route.
- Browser errors from the final M6 rerun: 0.
- Regression evidence: 395/395 tests pass in segmented runs: 109/109
  non-performance TypeScript, 10/10 isolated performance, and 276/276 module
  tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M6-review-and-finish.png`
- Visual verdict: pass — the contextual summary retains 407F's dark premium
  cards, strong type hierarchy, cyan builder edge, and gold action language.
- Commit: `f7c6329`

### M7 — contextual Guided Canvas

- Removed the retired permanent Add elements/Event list, Inspector, and Draft
  history panels from the active Canvas DOM and replaced them with one narrow
  `canvas407F` mount inside the canonical 407F presentation.
- Installed the retained Canvas controller against the same `TimelineStore`
  already used by Builder, persistence, history, review, and export; no parallel
  Canvas state machine or replacement shell was created.
- Rendered the frozen 48px toolbar in exact order: Guided/Advanced Studio,
  divider, Add event, Undo/Redo, divider, Theme, Fit/100%/150%, spacer, History,
  and conditional advisor comments.
- Preserved the retained direct-manipulation behavior: month-snapped body moves,
  start/end resize handles, vertical lane moves, one drop-only adaptive reflow,
  live date tooltips, chronological keyboard selection, inline label editing,
  and right-click actions.
- Preserved flat tapered Keynote arrows and plate-free label rendering through
  the canonical board renderer.
- Connected the contextual Details action to a centered 560px 407F sheet backed
  by the owning Builder entry, including editable shared event fields and an
  explicit jump to the owning Builder step.
- Connected continuous 800ms autosave to the 407F header status and preserved
  the retained 50-step undo/redo limit across view switches.
- Connected the 360px History slide-over with manual versions, newest-first
  rows, restore/rename/delete controls, and support for all four automatic
  version types. No Canvas JSON import/export UI remains.
- Browser assertions: pass — exact toolbar, six Add-event categories,
  contextual controls and handles, 560px Details sheet, 360px History
  slide-over, Fit/100% transitions, and zero retired permanent panels.
- Browser errors after the M7 interaction run: 0.
- Regression evidence: 400/400 tests pass in segmented runs: 109/109
  non-performance TypeScript, 10/10 isolated performance, and 281/281 module
  tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M7-contextual-407f-canvas.png`
- Visual verdict: pass — the contextual Canvas retains 407F's dark angular
  navigation and toolbar while the frozen neutral letterbox frames the
  Keynote-faithful board.
- Commit: `3d40235`

### M8 — adaptive axis and automatic density response

- Verified that the active 407F Canvas delegates its board render to the retained
  deterministic adaptive layout and Keynote renderer; no second axis or lane
  algorithm was introduced.
- Preserved the frozen span calculation, 12-year cap, fixed 64px condensed early
  segment, inclusive overlap-month density calculation, bounded three-pass
  clamp redistribution, and exact left-to-right integer remainder allocation.
- Preserved month positions as linear within each adaptive year segment and the
  under-7px month-pitch response that keeps quarter ticks while hiding minor
  ticks.
- Preserved stable lane assignment: arrows before flags, start date, longer
  first, one clear month, category affinity, prior-lane stability, and minimal
  conflict movement.
- Confirmed automatic condensed rows activate only above six needed lanes,
  producing 28px lane height, 22px shafts, and 11px labels. The retired manual
  Condensed toggle and Crowded chip do not exist in the active Canvas.
- Bound drop-only layout settling to the 407F Canvas with one 240ms ease-in-out
  transition and an instant reduced-motion path. Active drag previews never
  trigger a reflow.
- Browser DOM evidence: four visible year widths were
  `2023=436, 2024=484, 2025=404, 2026=404`; the sum is exactly 1728px, and the
  busy 2024 segment is measurably wider than the sparse years.
- Browser errors after the M8 axis inspection: 0.
- Regression evidence: 405/405 tests pass in segmented runs: 109/109
  non-performance TypeScript, 10/10 isolated performance, and 286/286 module
  tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M8-adaptive-axis-407f.png`
- Visual verdict: pass — the adaptive artifact remains framed by 407F chrome
  and changes board geometry only, never the surrounding shell.
- Commit: `17d8880`

### M9 — document Intake

- Replaced the legacy simulated Intake and separate Extraction Review screens
  with one `intake407F` host inside the canonical 407F presentation.
- Reused the retained `IntakeStateMachine`, candidate normalization,
  confidence and duplicate review, source snippets, inline edits, explicit
  merge/add-anyway decisions, filters, cancellation guard, Done state, and
  atomic approval contract.
- Connected the retained local D1-408 native-text PDF adapter. The active UI
  makes no fixture, simulated, OCR, network, or unsupported DOCX extraction
  claim; adapter failures remain explicit and actionable.
- Preserved the frozen Upload → Read → Review → Done flow, privacy and consent
  copy, 20MB UI file boundary, disabled-until-file-and-consent Read action,
  two-second status rotation, live accepted-candidate preview, and failure
  escape paths.
- Persisted Intake state through the shared `TimelineStore` and connected
  Home's pending-suggestions chip back to the same Intake route.
- Preserved the one-step approval transaction: automatic
  `Before CV import · {date}` version first, then exactly one
  `applyApprovalBatchToDocument` mutation and one undo step. No event writes
  occur before approval.
- Corrected delegated MonthField installation so candidate date editors remain
  active after Intake rerenders.
- Browser assertions: pass — one Intake route, exact four-stage progress,
  unchecked consent, disabled Read action, frozen copy, and no active legacy
  fixture/pipeline language.
- Browser errors from the fresh M9 reload and Intake route interaction: 0.
- Regression evidence: 410/410 tests pass in the full run: 119/119 TypeScript
  and 291/291 module tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M9-intake-407f.png`
- Visual verdict: pass — Intake is a native dark 407F workflow with the same
  angular actions, luminous progress language, layered panels, and premium
  Timeline//S1 identity.
- Commit: `b56e7f5`

### M10 — five themes and live picker

- Activated the retained five-theme catalog in the canonical 407F Canvas:
  Keynote Classic, Mission Navy, Advisor Paper, Horizon, and Little Journeys.
- Preserved the exact frozen palettes, typography treatments, axis/flag
  signatures, shadows, Little Journeys geometry exception, and AA label
  contrast logic from the shared theme engine.
- Added the 2×3 Theme popover to the active 407F Canvas. Its five 128×72 live
  miniatures render the student's actual board; Guided Mode's sixth card is the
  locked Advanced Studio background teaser.
- Applied theme selection through one shared-store mutation with undo ownership,
  then synchronized the existing 407F bridge. No shell token, navigation,
  layout, or app-chrome theme changes are made.
- Routed the active Canvas renderer through the retained adaptive renderer and
  then the shared theme retokening layer; dense-year allocation, lanes, event
  geometry, and accessibility metadata remain owned by the M8 engine.
- Browser assertions: pass — six cells, exact five names/descriptors, one locked
  teaser, Keynote default, Mission Navy applied to the active SVG, and Keynote
  restored after validation.
- Browser errors during M10 theme selection and restoration: 0.
- Regression evidence: 414/414 tests pass in the full run: 119/119 TypeScript
  and 295/295 module tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M10-five-themes-407f.png`
- Visual verdict: pass — the picker is scoped to the dark 407F Canvas, while
  every miniature and selected board preserves the product's Keynote-derived
  artifact language.
- Commit: `e2e1da7`

### M11 — Guided and Advanced Studio

- Integrated the retained Advanced Studio state/actions and board compositor
  directly into the canonical 407F Canvas; Guided remains the default and
  renders no Advanced controls or retained Advanced layers.
- Preserved both frozen mode gates verbatim. First entry requires the exact
  Advanced Studio dialog and persists `Before Advanced Studio · {date}` before
  the mode mutation; returning requires the exact re-arrangement warning.
- Added the exact second-row inventory: Image, GIF, Logo, Text, Background,
  divider, and Layout lock. Layout lock defaults ON; restoring it re-runs the
  retained stable-lane arrangement while horizontal month snapping remains.
- Connected local PNG/JPG/GIF media, 120px top-right logos, text blocks,
  headline/text typography, z-order/delete actions, shared-store history,
  IndexedDB blob persistence, object-URL hydration, and cleanup.
- Added the exact Presets, Upload, and Color background tabs; all 12 app-owned
  presets, PNG/JPG ≤10MB upload with cover/dim behavior, theme colors, exactly
  20 curated swatches, six-digit hex, conditional EyeDropper, and eight recent
  colors are sourced from the retained frozen engine.
- Scoped every Advanced surface to the 407F Canvas or its 407F modal. No
  Advanced selector can retheme the shell, rail, navigation, or app chrome.
- Browser assertions: pass — exact six-item insert strip, three background
  tabs, 12 presets, 20 curated colors, hex and EyeDropper, Layout lock ON,
  exact return dialog, and complete Guided isolation after return.
- Browser errors during the fresh M11 interaction run: 0.
- Regression evidence: 419/419 tests pass in the full run: 119/119 TypeScript
  and 300/300 module tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M11-advanced-studio-407f.png`
- Visual verdict: pass — the creative tool row and background studio remain
  dark, angular, compact 407F controls wrapped around the canonical board.
- Commit: `4c5f535`

### M12 — Export

- Replaced the legacy simulated Export Bay internals with one `export407F`
  host while preserving the canonical 407F route, rail, header, and dark
  presentation.
- Integrated the retained Export screen/controller and verified local browser
  export adapter against the shared `TimelineStore`; no parallel export state
  or fabricated download-success path was introduced.
- Added the frozen two-column layout with a fixed 380px control stack and fluid
  letterboxed preview. The preview and downloaded file use the same single-pass
  audience filter, theme, Advanced layers, interview target, and renderer input.
- Preserved Interview-safe as default, the exact Everything danger copy, the
  exact four PNG/PDF formats, conditional 12.7mm PDF margin guide, deterministic
  `{Last}_{First}_Timeline_{date}.{ext}` filename, local download verification,
  success/failure toasts, and automatic `Export · {date}` version.
- Preserved the same global five-theme control and the one-time Advisor Paper
  PDF suggestion without silently changing the student's theme.
- Added the collapsed `Printing for interviews` accordion with all six frozen
  lines, including heavyweight matte cardstock and 3 mil matte lamination.
- Connected every frozen Advisor review card state to the retained local
  session handoff: never requested, pending/cancel, approved, edited since, and
  changes requested/comments.
- Browser assertions: pass — exact audiences and formats, 380px layout,
  audience danger copy, themed SVG preview, conditional PDF controls,
  Advisor Paper suggestion, six-line printing guidance, 12.7mm overlay, and
  restored default Interview-safe/PNG state.
- Browser errors during the fresh M12 Export run: 0.
- Regression evidence: 425/425 tests pass in the full run: 119/119 TypeScript
  and 306/306 module tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M12-export-407f.png`
- Visual verdict: pass — Export is now a calm, premium 407F workbench with
  compact dark controls and the final artifact visually dominant at right.
- Commit: `4a47d79`

### M13 — Advisor session

- Integrated the retained Advisor workflow as an invitation-only local
  `#advisor-session:{timelineId}` route. It is intentionally absent from the
  four-item student rail and performs no external invitation or Matrix write.
- Forced Advisor Paper and Everything inside the read-only advisor board while
  preserving and labeling the student's selected theme.
- Added the five frozen tri-state checklist rows, computed review questions,
  two-second source highlighting with reduced-motion accommodation, canvas
  comment pins, 280-character notes, comment CRUD/resolution, and verdict gates.
- Projected advisor comments back onto the student Canvas with local resolution
  while excluding all review annotations from export output.
- Reconciled approval fingerprints only when timeline event/exam data changes;
  theme and Guided/Advanced mode changes do not falsely mark approval stale.
- Corrected the cancelled-request display path so stale `requestedAt` metadata
  cannot make a cancelled session appear pending.
- Browser assertions: pass — Advisor Paper, Everything, student-theme chip,
  five checklist rows, four fixture questions, read-only board, pin creation,
  note save, verdict gating, and unchanged four-item student rail.
- Browser errors during the fresh M13 Advisor run: 0.
- Regression evidence: 431/431 tests pass in the full run: 119/119 TypeScript
  and 312/312 module tests.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M13-advisor-session-407f.png`
- Visual verdict: pass — the session reads as a focused 407F review surface,
  with the canonical board dominant and compact editorial controls beside it.
- Commit: `1d9bb12`

### M14 — responsive, accessibility, language, and production hardening

- Applied the frozen responsive tiers and exact one-pixel boundary pairs:
  1440/1439, 1280/1279, 1024/1023, and 768/767.
- Preserved the desktop rail through 1024px, converted navigation to the fixed
  four-item bottom tab bar below 1024px, stacked Home below 1280px, retained
  the compressed 480px Builder form, added the approved Builder preview sheet,
  and preserved phone capture workflows.
- Enforced the exact tablet/phone Canvas view-only banner,
  `Editing needs a larger screen.` Tablet retains safe view controls; phone
  hides the editing toolbar. Phone Export is preview-only with no download
  control.
- Added the global Undo, Redo, Export, Escape, and `?` keyboard map; the
  accessible six-row shortcut dialog; focus traps/restoration; route-heading
  focus; Canvas application/event semantics; and independent polite live
  announcements.
- Applied 2px cyan focus indicators, 44px coarse-pointer targets,
  `prefers-contrast`, forced-colors, and complete reduced-motion suppression.
- Namespaced every rendered board SVG instance so title, description,
  gradient, pattern, and filter identifiers remain unique across simultaneous
  Home, Builder, Canvas, Export, Intake, and Advisor previews.
- Completed the prohibited-language sweep against shipped visible HTML text.
- Added a deterministic local production build. `npm run build` packages only
  runtime files to `_BUILD_TEMP/D1-404_TIMELINE_407F`, excludes runtime test
  directories, confirms the active 407F adapter and inactive superseded shell,
  runs the language guard, and emits a SHA-256 manifest.
- Live browser boundary assertions: pass at all eight exact widths.
- Live keyboard assertion: moving an event with ArrowRight announced the new
  month; Command-Z restored the exact prior month and announced `Undid Move
  event`.
- Persistence restart: pass — all three event labels and dates were
  byte-equivalent before and after a full page reload.
- Active-DOM accessibility audit across Home, Builder, Canvas, and Export:
  one visible H1 per route; zero unnamed visible controls; zero unlabeled
  visible inputs; zero missing image alternatives; zero duplicate IDs.
- Fresh browser errors after the M14 interaction run: 0.
- Regression evidence: 439/439 tests pass in deterministic final runs:
  110/110 TypeScript functional, 9/9 isolated performance, and 320/320 module
  tests. The performance cases are isolated to prevent unrelated workstation
  contention from consuming their wall-clock budgets.
- Typecheck: pass.
- Package verification: 23/23.
- Production build: pass — 184 runtime files; manifest SHA-256
  `ba3753121eba0306e00be196c0af510aaf141af8bca40f2c032a452cfa167f0a`.
- Screenshots:
  - `screenshots/M14-desktop-407f.png`
  - `screenshots/M14-tablet-407f.png`
  - `screenshots/M14-phone-407f.png`
- Visual verdict: pass — every tier remains immediately recognizable as the
  canonical dark 407F application while progressively reducing editing
  capability exactly as frozen.
- Commit: `PENDING`

## Implementation Report

- Canonical 407F was modified in place. No parallel application, replacement
  shell, navigation system, or product workflow was created.
- The retained `TimelineStore`, domain logic, timeline engine, persistence,
  intake state machine, adaptive layout, renderer, theme engine, Advanced
  Studio actions, export controller, Advisor workflow, services, adapters, and
  tests remain the engineering authority beneath the 407F presentation.
- All active product routes share one durable document and one undo/version
  model. Builder, Canvas, Intake approval, Export, and Advisor review do not
  maintain competing timeline state.
- Runtime integrations remain local and fail closed: external API calls are
  false, production writes are false, Matrix writes are absent, and the Matrix
  and advisor invitation surfaces remain local stubs.
- Production packaging is deterministic and manifest-backed. It performs no
  deployment, push, external publication, or protected-runtime mutation.

## Accessibility Report

### Founder contrast decisions

| Decision | Original token/pair | Implemented replacement | Reason and calculated contrast | Affected components |
| --- | --- | --- | --- | --- |
| `D1-UXR-002-CONTRAST-ADDENDUM-001` | `#FFFFFF` on preserved `accent.gold #B98A2E` | `accent.goldText #191C21` for normal text/icons directly on that gold | White/gold is 3.1168:1 and fails normal-text AA; `#191C21`/gold is 5.4805:1 | Primary buttons and direct-on-gold text/icons in the retained UXR token layer |
| `D1-UXR-002-CONTRAST-ADDENDUM-002` | `ink.tertiary #8A9099` for 11px/650 micro-label text | `ink.secondary #565D66`; tertiary retained for decorative/non-text use | 6.6597:1 on white and founder-calculated 6.1622:1 on the governed shell; both exceed 4.5:1 | Home, Builder, Canvas, Export, dialogs, slide-overs, toolbars, empty/success/error states, and responsive micro-labels in the retained UXR layer |
| D1-404 dark-shell mapping | Frozen light-shell pairings superseded for active chrome | `#140B00` on `#FFB340 → #FF7A3D`; `--mid #A9B7D0` / `--dim #7D8BA6` on `--card #141B2B` | Gold-gradient worst bound 7.5196:1; mid/card 8.4912:1; dim/card 5.0071:1 | Active 407F primary actions, labels, helper text, navigation, panels, and responsive banners |

The active 407F focus indicator is `--cy #39D6FF`, 2px with 2px offset;
contrast is 10.0185:1 on `--card` and 11.2557:1 on `--bg`. Text, icons,
borders, and focus indicators were evaluated independently. Gold actions were
checked in default, hover, active, focus, disabled, and selected usage; direct
gold text remains dark at every normal-size state.

Automated evidence combines the candidate-bound contrast/theme tests with the
active-DOM scan described in M14. Keyboard evidence combines live browser
movement/undo/shortcut/focus checks with the Canvas module suite for F2,
Delete, chronological Tab/Shift-Tab, month movement/resize, lane movement,
Details routing, Escape dismissal, history, and live announcements.

## Design Freeze Traceability Matrix

| Frozen area | Implementation milestone(s) | Result |
| --- | --- | --- |
| §2 IA and relocation | M1, M6, M7, M9, M12, M13 | PASS |
| §3.2 Home | M2 | PASS |
| §3.6 Export | M12, M14 | PASS |
| §4 seven-step Builder | M3–M6 | PASS |
| §5 contextual Canvas | M7, M8, M14 | PASS |
| §6 document Intake | M9 | PASS |
| §7 adaptive layout | M8, M14 | PASS |
| §8 themes and modes | M10, M11 | PASS |
| §9 student workflow | M2–M12 | PASS |
| §10 Advisor workflow | M13 | PASS |
| §11 accessibility/responsive | M14 | PASS |
| §12 acceptance criteria | Acceptance Ledger below | PASS — 27/27 |
| D1-404 §3 visual mapping | M0–M14 screenshots | PASS |

## Acceptance Ledger

All rows are evaluated against D1-404's binding 407F visual mapping.

| # | Frozen acceptance criterion | Result and evidence |
| --- | --- | --- |
| 1 | Exact three-region Home and five-second contract | PASS — M2 UI/tests/browser |
| 2 | Exactly four rail destinations | PASS — M1; four buttons only |
| 3 | No HUD, telemetry, or rail footer | PASS — M1 markup/language tests |
| 4 | Autosave state and zero-event Export disable | PASS — M1 shared-store state |
| 5 | 264px seven-step Builder, one title | PASS — M3 |
| 6 | Core Info and medical-school fields | PASS — M3 |
| 7 | Independent USMLE/COMLEX, add via chips | PASS — M4 |
| 8 | Exam result/score above dates | PASS — M4 |
| 9 | Failed attempt → retake and provisional study period | PASS — M4 |
| 10 | Unlimited one-at-a-time Rotations/Work/Research and typeahead | PASS — M5 |
| 11 | Research publication fields and six author positions | PASS — M5 |
| 12 | Step skips, completeness, story checks, jump links | PASS — M5/M6 |
| 13 | Consent-gated four-stage Intake and atomic approval/version | PASS — M9 |
| 14 | Candidate confidence/snippet/edit/actions/high-confidence/Merge | PASS — M9 |
| 15 | Contextual-only Canvas controls and Escape dismissal | PASS — M7/M14 |
| 16 | Flat tapered, plate-free arrow labels | PASS — M7 renderer tests |
| 17 | Month-snapped body/tip/lane drag and drop-only reflow | PASS — M7/M8 |
| 18 | 50-step undo, History, automatic versions, no JSON UI | PASS — M7 |
| 19 | Adaptive widths sum exactly; 240ms/instant reduced motion | PASS — M8/M14 |
| 20 | Automatic condensed mode above six lanes | PASS — M8 |
| 21 | Exactly five themes and live own-board miniatures | PASS — M10 |
| 22 | Guided isolation; complete Advanced Studio; exact gates | PASS — M11 |
| 23 | Background upload/dim only in Advanced | PASS — M11 |
| 24 | Export audience/formats/filename/printing guidance | PASS — M12 |
| 25 | Advisor Paper/checklist/pins/questions/verdict/edited-since | PASS — M13 |
| 26 | Keyboard, live regions, focus, reduced motion, tablet/phone | PASS — M14 |
| 27 | Prohibited-language and ALL-CAPS sentence sweep | PASS — M14 automated guard |

## Milestone Status

| Milestone | Status | Commit |
| --- | --- | --- |
| M0 | COMPLETE | `d5126f8` |
| M1 | COMPLETE | `fcde6fb` |
| M2 | COMPLETE | `114dc37` |
| M3 | COMPLETE | `5f2b3e6` |
| M4 | COMPLETE | `8f11597` |
| M5 | COMPLETE | `a530cda` |
| M6 | COMPLETE | `f7c6329` |
| M7 | COMPLETE | `3d40235` |
| M8 | COMPLETE | `17d8880` |
| M9 | COMPLETE | `b56e7f5` |
| M10 | COMPLETE | `e2e1da7` |
| M11 | COMPLETE | `4c5f535` |
| M12 | COMPLETE | `4a47d79` |
| M13 | COMPLETE | `1d9bb12` |
| M14 | COMPLETE | `PENDING` |

## Verification gates

| Gate | Final result |
| --- | --- |
| Regression floor | PASS — 439/439 (119 TypeScript + 320 module); required floor 370 |
| TypeScript | PASS |
| Package verification | PASS — 23/23 |
| M0 browser smoke | PASS |
| M0 console | PASS — 0 warnings/errors |
| Full functional acceptance | PASS — Freeze §12, 27/27 |
| Full visual acceptance | PASS — M0–M14 screenshots satisfy D1-404 §3.3 |
| Persistence restart | PASS — three-event state identical across full reload |
| Keyboard-only accessibility | PASS — live Canvas plus complete keyboard module coverage |
| Automated accessibility | PASS — semantic DOM, unique IDs, labels/names, contrast/theme guards |
| Responsive breakpoint matrix | PASS — 1440/1439, 1280/1279, 1024/1023, 768/767 |
| Production build | PASS — 184 runtime files, manifest SHA-256 recorded above |

## Rollback

| Milestone | Commit | Exact rollback command |
| --- | --- | --- |
| M0 | `d5126f8` | `git revert d5126f8` |
| M1 | `fcde6fb` | `git revert fcde6fb` |
| M2 | `114dc37` | `git revert 114dc37` |
| M3 | `5f2b3e6` | `git revert 5f2b3e6` |
| M4 | `8f11597` | `git revert 8f11597` |
| M5 | `a530cda` | `git revert a530cda` |
| M6 | `f7c6329` | `git revert f7c6329` |
| M7 | `3d40235` | `git revert 3d40235` |
| M8 | `17d8880` | `git revert 17d8880` |
| M9 | `b56e7f5` | `git revert b56e7f5` |
| M10 | `e2e1da7` | `git revert e2e1da7` |
| M11 | `4c5f535` | `git revert 4c5f535` |
| M12 | `4a47d79` | `git revert 4a47d79` |
| M13 | `1d9bb12` | `git revert 1d9bb12` |
| M14 | `PENDING` | `git revert PENDING` |

## Precedence resolutions

1. D1-404 revokes the white/light shell direction but preserves the functional
   requirements and shell-agnostic engineering.
2. The canonical 407F `MM-CAM-THEME-D-001` tokens govern app chrome.
3. The two white-shell contrast addenda remain binding records for the retained
   implementation token layer. D1-404 independently maps active chrome onto the
   dark 407F tokens, and every active pairing is tested against that mapping.
4. “Production build” means the deterministic local static candidate emitted
   by `npm run build`. Protected deployment, remote publication, Matrix host
   integration, and production data remain beyond the authorized line.

## Founder decisions needed

None.

## Run and verify

```sh
cd /Users/brianb/MissionMed_worktrees/D1-MacProTimeline-UXR-002/packages/mission-timeline
npm run serve
node --import tsx --test --test-concurrency=1 $(rg --files tests -g '*.test.ts' | rg -v 'performance-failure-413\.test\.ts$')
node --import tsx --test --test-concurrency=1 tests/performance-failure-413.test.ts
node --test --test-concurrency=1 tests/*.test.mjs
npm run typecheck
npm run verify
npm run build
```

Preview: `http://127.0.0.1:8793/web/`

Local build output:
`/Users/brianb/MissionMed_worktrees/D1-MacProTimeline-UXR-002/_BUILD_TEMP/D1-404_TIMELINE_407F`

The explicit segmented commands are the reproducible full-suite procedure on
this workstation; the package's ordinary `npm test` command remains available,
but its pre-existing wall-clock performance cases can contend with concurrent
functional files.
