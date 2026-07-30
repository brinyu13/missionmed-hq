# D1-405 Progress Log

## 2026-07-30T19:27:20Z — M0 baseline and branch

- Estimated overall completion: 3%
- Work completed:
  - Read the complete D1-405 authority.
  - Restored the canonical D1-404 `web/index.html` from `771b877` without deleting the user-owned untracked byte-identical copy.
  - Created `d1-405-timeline-launch-refinement`.
  - Verified the unchanged 407F source boundary and produced the Phase 0 impact map.
  - Evaluated ten replacements for the founder-facing `Canvas` destination and selected `Edit Timeline`.
  - Captured fresh Home, Builder, Canvas-equivalent, and Export screenshots from the running local app.
- Screenshots:
  - `evidence/screenshots/D1-405-M0-baseline-home.png`
  - `evidence/screenshots/D1-405-M0-baseline-builder.png`
  - `evidence/screenshots/D1-405-M0-baseline-canvas.png`
  - `evidence/screenshots/D1-405-M0-baseline-export.png`
- Preview URL: `http://localhost:8793/web/`
- Tests:
  - Functional TypeScript: 110/110 passed.
  - Isolated performance: 9/9 passed.
  - Browser/module suites: 320/320 passed.
  - Total existing correctness baseline: 439/439 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed; the builder currently includes one ignored user-owned HTML copy, which will be excluded during production hardening without deleting it.
- Browser console: baseline visual capture completed; fresh-error audit is scheduled after the first implementation milestone.
- Visual verdict: canonical 407F identity is strong and must be preserved. The current narrow Builder preview visibly compresses the artifact and is a primary D1-405 correction target.
- Founder feedback received: none during M0.
- Correction performed: none.
- Next action: M1 branding and four-destination navigation clarity.

## 2026-07-30T19:40:33Z — M1 branding and navigation clarity

- Estimated overall completion: 11%
- Work completed:
  - Rebranded the 407F header to `MissionMed//TimelineBuilder` and `Mission:Residency Division`.
  - Preserved the italic 407F wordmark, amber `//`, hierarchy, and identity placement.
  - Added the collision-safe phone-only abbreviation `MM//TB`.
  - Kept exactly four destinations and changed only the founder-facing `Canvas` label to `Edit Timeline`.
  - Updated journey, preview, Review, intake, accessibility, history, and announcement language while retaining the internal `canvas` route and implementation identifiers.
  - Stacked the three-step journey strip on phones and removed the non-interactive programmatic-heading focus outline without weakening visible focus for interactive controls.
- Preservation check:
  - The 407F route graph, dark blueprint shell, active editor, timeline renderer, persistence, history, advisor flow, export flow, and all internal `canvas` contracts remain unchanged.
- Screenshots:
  - `evidence/screenshots/D1-405-M1-branding-navigation.png`
  - `evidence/screenshots/D1-405-M1-branding-navigation-tablet.png`
  - `evidence/screenshots/D1-405-M1-branding-navigation-phone.png`
- Preview URL: `http://localhost:8793/web/`
- Tests:
  - Complete functional TypeScript suite: 110/110 passed.
  - Complete browser/module suite: 320/320 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed; 185 files due only to the preserved ignored user-owned HTML copy already recorded in M0.
- Browser console: 0 fresh warnings or errors.
- Visual verdict: PASS after correction and recapture at desktop, tablet, and phone sizes.
- Founder feedback received: none during M1.
- Correction performed:
  - Removed the residual focus rectangle from a programmatically focused non-interactive H1.
  - Prevented phone journey-strip clipping.
  - Added mobile italic-glyph safe spacing.
- Next action: M2 Home faster-start and File Vault entry.

## 2026-07-30T20:23:58Z — M2 Home and File Vault entry

- Estimated overall completion: 20%
- Work completed:
  - Preserved the three-region Home composition while making File Vault the primary faster-start action.
  - Reframed document intake in direct student language and kept local PDF/DOCX upload visually secondary.
  - Added an in-app, searchable, recent-first, single-document File Vault chooser using a real fail-closed adapter contract.
  - Rendered a truthful local unavailable state with no fabricated documents or live-integration claim.
  - Renamed the lower region to `Latest timeline preview`.
  - Replaced the false student-like demo timeline on empty Home with a polished non-data placeholder.
  - Verified populated Home with a real locally created one-event timeline.
  - Resolved the inherited one-to-three-year allocation conflict at the presentation boundary: equal year widths preserve the exact 1728px board width while relaxing only the mathematically impossible 28% maximum.
  - Excluded the preserved user-owned `TimelineBuilder_v5.5_PreLaunch.html` copy from deterministic build packaging without modifying or deleting it.
- Preservation check:
  - Existing Builder, timeline store, canonical renderer, Canvas/Edit Timeline, intake review, undo/history, export, and persistence behavior remain in place.
  - The strict shared adaptive allocator and every four-plus-year allocation rule remain unchanged.
- Screenshots:
  - `evidence/screenshots/D1-405-M2-home-empty.png`
  - `evidence/screenshots/D1-405-M2-file-vault-chooser.png`
  - `evidence/screenshots/D1-405-M2-home-populated.png`
- Preview URL: `http://localhost:8793/web/`
- Tests:
  - Complete functional TypeScript suite: 119/119 passed.
  - Complete browser/module suite: 324/324 passed.
  - Total: 443/443 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed.
- Browser console: 0 fresh warnings or errors after empty, chooser, focus-restoration, local event creation, and populated-state interactions.
- Visual verdict: PASS after Miyamoto-requested corrections and recapture.
- Founder feedback received:
  - Requested a complete shareable source artifact during the milestone.
- Correction performed:
  - Restored a deterministic dark 407F atmospheric/grid field behind the main workspace.
  - Replaced the browser-default white File Vault search field with the existing dark 407F field language.
- Next action: M3 horizontal Builder workflow and launch-quality Builder composition.

## 2026-07-30T20:47:41Z — M3 horizontal Builder workflow and composition

- Estimated overall completion: 35%
- Work completed:
  - Replaced the permanent vertical Builder stepper with the approved horizontal seven-step navigator.
  - Preserved direct step movement, persisted step state, and complete/started/skipped/empty states.
  - Added accessible horizontal-tab semantics, non-color state names, roving focus, Left/Right wrap, Home/End, and polite announcements.
  - Restored focus after interactive rerenders and revealed persisted/current steps on initial route entry without moving focus.
  - Reclaimed desktop width into a 5:7 editor/preview composition and added the visible `Open full preview` action.
  - Stacked the editor before the preview at 1151px and below, with navigator-only horizontal overflow.
  - Verified no document-level horizontal overflow at 1440, 1279, 1024, and 1023.
  - Preserved all existing Builder forms, route and document state, persistence, domain workflows, preview data, and sticky actions.
- Screenshots:
  - `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-desktop.png`
  - `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-tablet.png`
  - `evidence/screenshots/D1-405-M3-builder-horizontal-workflow-tablet-preview.png`
- Preview URL: `http://localhost:8793/web/`
- Tests:
  - Complete functional TypeScript suite: 119/119 passed.
  - Complete browser/module suite: 324/324 passed.
  - Total: 443/443 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed; 185 runtime files.
- Browser console: 0 fresh warnings or errors.
- Visual verdict:
  - Miyamoto: PASS.
  - Vitruvius: D1 PASS / D2 PASS.
- Founder feedback received:
  - Requested and received a shareable current-source ZIP and direct HTML source link during the milestone.
- Correction performed:
  - Removed the exact-1024 two-column overflow by stacking at 1151px and below.
  - Put the primary editor before the stacked preview.
  - Added initial/persisted active-tab reveal without focus movement.
  - Replaced the invalid high-DPI crop with CSS-scale tablet editor and scrolled-preview evidence.
- Next action: M4 true proportional preview, element activation, zoom, and full preview lightbox.

## 2026-07-30T21:16:15Z — M4 proportional interactive preview and lightbox

- Estimated overall completion: 45%
- Work completed:
  - Mounted the canonical 1920×1080 `advancedBoardRenderer` in both the embedded Builder preview and the full-preview lightbox.
  - Preserved a single store/document/data flow while giving each SVG instance an isolated namespace.
  - Corrected namespace rewriting so canonical `data-event-id` values remain intact.
  - Added true 16:9 contain/letterbox behavior with no stretching, clipping, or document-level overflow.
  - Added deterministic owner metadata, chronological roving focus, Arrow/Home/End movement, Enter/Space activation, and 44px hit targets.
  - Routed Core markers to Core data and exam markers to the exact attempt editor with focus on the corresponding control.
  - Added Fit, 100%, and 150% lightbox presets with one contained scrollport, focus trap, inert background, Escape close, and focus restoration.
  - Removed the competing legacy Builder render call.
  - Preserved forward-compatible explanation and interview owner seams for M9 without exposing unfinished authoring behavior.
- Screenshots:
  - `evidence/screenshots/D1-405-M4-proportional-preview-desktop.png`
  - `evidence/screenshots/D1-405-M4-full-preview-lightbox-desktop.png`
  - `evidence/screenshots/D1-405-M4-click-to-edit-exam-desktop.png`
- Preview URL: `http://localhost:8793/web/`
- Tests:
  - Complete functional TypeScript suite: 119/119 passed.
  - Complete browser/module suite: 332/332 passed.
  - Total: 451/451 passed.
  - M4 dedicated Builder preview suite: 8/8 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed; 186 runtime files.
  - Build manifest SHA-256: `69a2a3301892693b364c2a6eb288ad6726a6a2687e4f27bc1d691f3598c088b3`.
- Browser console: 0 fresh warnings or errors after preview, zoom, modal, keyboard, Core routing, and exact exam routing interactions.
- Visual verdict: Miyamoto PASS.
- Accessibility verdict: initial FAIL because interview-marker order and the initial tab stop ignored chronology; final Vitruvius PASS after both corrections.
- Founder feedback received:
  - None during M4.
- Corrections performed:
  - Constrained SVG namespacing to actual `id` attributes after browser proof exposed canonical event-ID corruption.
  - Narrowed exact exam focus targeting so activation lands on the result control rather than the adjacent Delete button.
  - Derived the interview marker's roving-focus order from its date instead of always placing it last.
  - Assigned the initial SVG tab stop to the earliest visible chronological target rather than the first element replaced in DOM order.
  - Waited for and excluded an unrelated stale export toast before final click-to-edit evidence capture.
- Next action: M5 shared date controls, followed by M6 Core-data completion.

## 2026-07-30T21:52:50Z — M5 shared date controls

- Estimated overall completion before Founder steering: 53%.
- Recalibrated overall completion after Founder steering: 47%.
- Work completed:
  - Shared accessible month/year controls across Core, exams, work, research, personal, Canvas details, and retained export paths.
  - Exact-day clinical rotation controls with ISO storage and locale-safe display.
  - Additive exact-day rotation fields with month-axis projection and non-fabricating legacy migration.
  - Canvas move/resize synchronization for exact rotation dates.
  - Specific typed-date validation that preserves the user's invalid input for correction.
- Screenshots:
  - `evidence/screenshots/D1-405-M5-month-picker.png`
  - `evidence/screenshots/D1-405-M5-exact-date-picker.png`
  - `evidence/screenshots/D1-405-M5-date-error-state.png`
- Tests:
  - Complete functional TypeScript suite: 119/119 passed.
  - Complete browser/module suite: 340/340 passed.
  - Total: 459/459 passed.
  - M5 dedicated date-control suite: 8/8 passed.
  - Typecheck: passed.
  - Package verification: 23/23 passed.
  - Production build: passed; 187 runtime files.
  - Build manifest SHA-256: `d3aa5b8a9b6b195e8d9bd2831d2dc500d7eab71d667830ef6764573a563093d3`.
- Founder steering integrated:
  - keep the current Builder structure,
  - refine only stepper visual treatment,
  - add shared local Media navigation/library and drag/drop,
  - preserve one asset system and no cloud storage.
- Next action: Miyamoto-reviewed premium 407F stepper refinement, then shared Media implementation.

## 2026-07-30T22:21:35Z — Founder stepper and shared Media checkpoint

- Estimated overall completion: 55%.
- Preserved the one-column Builder editor and proportional interactive right preview.
- Implemented the premium 407F stepper treatment without changing workflow, titles, order, or completion logic.
- Added the active five-item rail: Home, Builder, Edit Timeline, Media, Export.
- Implemented the local Media page and the same non-modal asset drawer in Builder and Edit Timeline.
- Added PNG/JPG/WEBP/GIF upload validation, one-asset/one-blob persistence, shared placement, unplacement, drag/drop, and keyboard placement.
- Corrected Miyamoto’s header-inheritance and rail-edge findings and recaptured both surfaces.
- Corrected architecture findings: one active navigation authority; atomic metadata/blob upload; failure rollback with no orphan; source-byte retention through undo/history; existing Advanced asset visibility; and no immediate destructive blob deletion.
- Corrected accessibility findings: focus preservation; polite mutation announcements; no dead card tab stops; keyboard placement instructions; reduced-motion GIF suppression; complete 44px Media targets; launcher/dialog state; route-close behavior; tablet height; and phone stacking.
- Complete functional TypeScript suite: 119/119 passed.
- Complete browser/module suite: 353/353 passed.
- Total: 472/472 passed.
- Typecheck: passed.
- Package verification: 23/23 passed.
- Production build: passed; 188 runtime files.
- Build manifest SHA-256: `331d2984a7130090058767a30055e109369547e601ae0aaad9a42d62756d32e3`.
- Next action: close specialist re-audits, checkpoint M5 plus Founder refinement, then continue M6.

## 2026-07-30T23:45:00Z — M6 Core Info normalization checkpoint

- Estimated overall completion: 65%.
- Extended the canonical 407F Core Info step; no replacement shell, navigation,
  form-column layout, or preview reduction was introduced.
- Bundled 196 source-reported U.S. medical-school records:
  - 154 MD;
  - 42 DO;
  - 179 exact active institution-program matches;
  - 17 program-review records;
  - 125 normalized display names;
  - 71 name/crosswalk-review records;
  - 1 superseded duplicate crosswalk retained as provenance-only.
- Added local alias/location search, country and MD/DO facets, canonical IDs,
  source provenance, analytics eligibility, and a durable normalization queue.
- Added current work-authorization, EAD-status, and residency-visa conditionals
  without changing the frozen Core Info wording or hierarchy.
- Browser-verified keyboard selection, active descendant, announcements, focus
  restoration, required errors, review states, and the unlisted-school queue.
- Corrected the final visual search inset and guarded transient focused-select
  rerenders. Fresh-browser console result: zero warnings/errors.
- Specialist verdicts: Miyamoto PASS, Vitruvius PASS, Darwin PASS.
- Functional TypeScript suite: 119/119 passed.
- Browser/module suite: 360/360 passed.
- Total: 479/479 passed.
- Typecheck: passed.
- Package verification: 23/23 passed.
- Deterministic build: passed; 191 runtime files.
- Build manifest SHA-256:
  `3101fed536242fdc0213c36d97722db2d4ee836b7876b16985897a908bf99f21`.
- Implementation checkpoint: `3f7923f`.
- Production-only external gate: DAPIP redistribution authority requires legal
  confirmation before production distribution.
- Next action: M7 Exams workflow completion.
