# D1-405 Implementation Report

Status: in progress

Branch: `d1-405-timeline-launch-refinement`

Starting commit: `771b8775b5007617335f7aface6e3772631a32d9`

Canonical product: in-place 407F / D1-404 implementation

Preview: `http://localhost:8793/web/`

## M0 — Baseline and change map

- Preserved and restored the canonical `web/index.html` without deleting the user-owned ignored byte-identical copy.
- Created the required branch.
- Captured Home, Builder, Edit Timeline, and Export baseline screenshots.
- Verified 439 existing tests, typecheck, package verification, and production build.
- Produced the exact Phase 0 impact map and minimum refactor plan.

## M1 — Branding and navigation clarity

- Original brand: `TIMELINE//S1` / `SEASON ONE · TIMELINE OPS`.
- Replacement brand: `MissionMed//TimelineBuilder` / `Mission:Residency Division`.
- Responsive implementation: full wordmark through tablet widths; `MM//TB` only at phone width.
- Original destination label: `Canvas`.
- Replacement destination label: `Edit Timeline`.
- Internal route and engineering identifier retained: `canvas`.
- Updated all active and retained founder-facing labels, accessibility names, history labels, and announcements.
- Preserved exactly four primary destinations.
- Browser-tested at desktop, tablet, and phone sizes with zero fresh warnings/errors.
- Full functional and module suites, typecheck, package verification, and production build passed.

## M2 — Home and File Vault entry

- Preserved the accepted Home hierarchy and changed only the founder-requested regions.
- Added a primary `Choose from File Vault` action, secondary local PDF/DOCX upload, review-before-add assurance, and direct faster-start language.
- Added the `missionmed-filevault-source` contract with:
  - explicit `connected` state,
  - `listRecent`, `search`, and `select` methods,
  - metadata-only normalized document descriptors,
  - deterministic 20-result bound,
  - fail-closed unavailable behavior.
- Added an in-app modal with search, recent results, one-document radio selection, disabled-until-selected continuation, Escape handling, focus trap, and focus restoration.
- Added a truthful local unavailable state and did not fabricate File Vault documents.
- Changed the lower Home heading to `Latest timeline preview`.
- Removed demo rendering from the zero-event Home path and added an honest, styled placeholder.
- Retained the real current timeline render and edit action when student data exists.
- Added a bounded small-span renderer compatibility policy for one-to-three-year documents:
  - exact 1728px sum remains mandatory,
  - equal-width years preserve a consistent temporal scale,
  - only the impossible 28% maximum is relaxed,
  - four-plus-year adaptive allocation is unchanged,
  - policy metadata is retained on the rendered axis segments.
- Added build filtering for the preserved, user-owned prelaunch HTML copy so it is not shipped as a second entry.
- Browser-tested Home empty, File Vault unavailable, Escape/focus restoration, one-event creation, and Home populated with zero fresh console warnings/errors.
- Miyamoto visual verdict: PASS after dark-field and search-control corrections.

## M3 — Horizontal Builder workflow and composition

- Replaced the permanent 264px left stepper with one horizontal seven-step navigator spanning the Builder workspace.
- Preserved the approved labels, direct movement, persisted step state, and complete/started/skipped/empty presentation.
- Added a named navigation landmark and horizontal tab model with:
  - stable tab IDs,
  - roving `tabindex`,
  - `aria-selected` and panel linkage,
  - non-color state labels,
  - Left/Right wrap plus Home/End movement,
  - focus preservation after rerender,
  - polite step announcements.
- Corrected the seventh label to the exact D1-405 capitalization: `Review & Finish`.
- Reclaimed desktop width into a 5:7 editor/preview composition:
  - 488px editor and 683px preview at 1440px,
  - 420px editor and 589px preview at 1279px,
  - no document-level horizontal overflow.
- Added a persistent `Open full preview` action while retaining the existing focus-trapped 407F modal seam for M4 enhancement.
- At 1151px and below, stacked the editor before the preview and confined horizontal step overflow to the navigator.
- Verified exact 1024/1023 boundaries:
  - document `scrollWidth === clientWidth`,
  - active persisted tab revealed without moving focus,
  - editor remains the primary first task,
  - preview remains available below the editor.
- Preserved the existing Builder domain forms, sticky action footer, state, persistence, timeline engine, and route graph.
- Browser-tested direct and wrapped keyboard movement, active-step restoration, desktop/tablet composition, and exact boundary overflow with zero fresh console warnings/errors.
- Miyamoto visual verdict: PASS.
- Vitruvius responsive/layout verdict: D1 PASS / D2 PASS.
- True proportional rendering, preview element activation, and zoom-capable lightbox behavior remain explicitly assigned to M4.

## M4 — Proportional interactive preview and lightbox

- Replaced the Builder preview placeholder path with the same canonical `advancedBoardRenderer` used by Edit Timeline and export.
- Preserved one timeline document and one store; the embedded preview and full-preview lightbox are projections of the same current state and renderer.
- Added a true 16:9 preview container using the renderer's 1920×1080 view box, `xMidYMid meet`, and contained letterboxing without stretching or clipping.
- Added stable per-render SVG namespaces while preserving canonical event IDs and owner metadata.
- Added deterministic preview ownership for:
  - Core events,
  - exact exam attempts,
  - research/publication,
  - service and leadership,
  - work experience,
  - interests and life events,
  - explanation seams,
  - interview seams.
- Added chronological roving focus, Arrow/Home/End navigation, and Enter/Space activation for actionable preview elements.
- Core and exam activation now route to the exact Builder step and place focus on the corresponding editable control. Stale owners fail closed.
- Added 44px transparent hit targets without changing visible marker geometry.
- Upgraded `Open full preview` into a dedicated focus-trapped dialog with:
  - Fit, 100%, and 150% zoom presets,
  - a single contained scrollport at enlarged zoom,
  - background inertness,
  - Escape and close-button handling,
  - opener focus restoration,
  - activation-driven focus transfer to the selected editor.
- Removed the competing legacy preview render call so the canonical preview has one renderer owner.
- Browser-tested proportionality, zoom dimensions, document overflow, inertness, focus trap, Escape restoration, Core routing, exact exam routing, and zero fresh console warnings/errors.
- Miyamoto final visual verdict: PASS.
- Vitruvius accessibility verdict: initial FAIL because the interview marker was always ordered last and the first rendered event still owned the initial tab stop; final PASS after both owner order and `tabindex` were derived from the earliest visible chronological target.
- Explanation and interview owner metadata are forward-compatible seams only; their approved authoring forms remain assigned to M9.

## Autonomous implementation-level adjustments

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Browser-default focus outline on programmatically focused `tabindex="-1"` route heading | `outline:none` for `tabindex="-1"` only | Prevent a non-interactive heading from looking like a selected/editable control while preserving route-focus semantics | Not color-contrast applicable; interactive focus remains 2px cyan | Home route heading and future programmatically focused non-interactive route headings |
| Renderer isolation for fewer than four normal years because the 28% cap and exact-sum invariant conflict | Equal-width, exact-sum small-span presentation fallback; strict shared allocator retained | Ordinary short student timelines must render; this changes only the impossible implementation constraint | Not color-contrast applicable; 1728px becomes 1728, 864+864, or 576+576+576 | Home latest preview, Edit Timeline renderer, theme miniatures, export renderer |
| Decorative canvas alone supplied the main atmospheric field | Deterministic dark 407F grid/atmosphere on `main`, with the decorative canvas retained | Prevent a transient pale capture during canvas resize while preserving the accepted visual identity | Existing 407F color tokens retained | All route workspace backdrops |
| Browser-default SVG pointer targets and focus order | 44px transparent hit targets plus chronological roving focus | Make small timeline markers reliably operable without changing visible geometry or chronology | Not color-contrast applicable; visible focus halo uses the existing high-contrast cyan token | Embedded Builder preview and full-preview lightbox |
| Competing legacy preview render and broad SVG ID rewriting | One canonical preview owner plus attribute-boundary ID namespacing | Prevent duplicate rendering and preserve event identifiers used for exact editor routing | Not color-contrast applicable | Builder preview SVG definitions, event ownership, and click-to-edit |

No product hierarchy, workflow, behavior, or meaning changed through this adjustment.

## M5 — Shared month/year and exact-day date controls

- Reused and extended the retained month-field module for every user-facing month/year input in the active 407F Builder and Canvas details.
- Added one shared exact-day module for clinical rotation dates. It accepts ISO and unambiguous month-name input, stores `YYYY-MM-DD`, and rejects locale-ambiguous numeric dates.
- Kept the canonical timeline axis month-based. Exact rotation days are additive fields under `event.fields`; `startDate` and `endDate` remain their month projections.
- Migrated legacy rotations as `month-legacy` without inventing a day.
- Kept Canvas move and resize atomic: clinical exact dates shift with the same month delta and clamp safely at month ends.
- Added custom dark 407F month and 7×6 day calendars with keyboard navigation, 44px targets, typed fallback, visible errors, responsive bottom-sheet positioning, and reduced-motion handling.
- Preserved the frozen Core, exam, and Builder field order/copy while routing the fields through the shared controls.
- Browser-verified the month picker, exact-day picker, and invalid typed-date state.
- Full gate: 459/459 tests, typecheck, 23/23 package verification, and deterministic production build passed.
- Build output: 187 runtime files; manifest SHA-256 `d3aa5b8a9b6b195e8d9bd2831d2dc500d7eab71d667830ef6764573a563093d3`.

## Founder steering refinement received during M5

- Preserve the one-column Builder editor and proportional interactive preview on the right.
- Refine only the horizontal stepper's visual treatment to be more dimensional, premium, tactile, and 407F.
- Add one shared local Media destination and reuse the existing asset architecture for Builder-preview and Edit-Timeline drag/drop.
- No cloud storage, duplicate asset store, alternate shell, or form-layout redesign is authorized.

## Founder steering refinement — implemented checkpoint

- Preserved the horizontal seven-step layout, one primary Builder form column, larger right-side live preview, and full-preview control.
- Reworked only the stepper treatment with layered 407F texture, inset depth, tactile hover/press motion, gold current state, green complete state, amber started state, dashed skipped state, cyan focus, and a reduced-motion override.
- Added `Media` as the fifth active 407F navigation destination through one `PRIMARY_NAV_ITEMS` authority while leaving the inactive superseded UXR shell on its frozen four-item navigation.
- Added one local Media library over the retained `document.advanced.media`, IndexedDB `blobs`, object-URL registry, Advanced renderer, and shared TimelineStore.
- Builder preview and Edit Timeline use the same drawer, drag payload, placement command, media collection, and blob reference. Placement mutates an existing record and never copies source bytes.
- Compatible pre-existing Advanced image/GIF/logo records appear in Media; new library assets can become Guided overlays only after explicit placement.
- Local asset metadata and bytes now commit through one TimelineStore/IndexedDB transaction. Failed upload transactions restore the prior document and leave no orphan blob.
- Undo retains source bytes so restored metadata cannot point to a deleted image. The refinement does not expose a destructive asset-delete control until version/history-aware garbage collection exists.
- Media mutations preserve focus, announce status, expose dialog state, close on unrelated routes, provide a keyboard placement action, suppress animated GIF markup under reduced motion, and use 44px controls.
- Miyamoto’s first review passed the stepper and found global-header inheritance on Media. The Media page/drawer headers were explicitly localized and the desktop drawer was aligned to the full 190px rail edge.
- Final complete gate: 472/472 tests, typecheck, 23/23 package verification, and deterministic production build passed.
- Build output: 188 runtime files; manifest SHA-256 `331d2984a7130090058767a30055e109369547e601ae0aaad9a42d62756d32e3`.

## M6 — Core Info normalization and medical-school registry

- Preserved the exact 407F Step 1 hierarchy and extended its existing Core
  Info state, Builder projection, shared document, persistence adapter, and
  Education milestone.
- Added one lazy local medical-school provider over a bundled DAPIP-derived
  U.S. MD/DO snapshot. The active application makes no registry network
  requests.
- Added canonical school IDs, source and accreditation provenance, normalized
  aliases, country and MD/DO facets, an inverted token index, and deterministic
  search ranking.
- Added an explicit local normalization queue for unlisted, international,
  ambiguous, source-review, and superseded-crosswalk records. Review-needed
  records are excluded from verified analytics.
- Preserved stale source provenance while resolving the duplicate Medical
  College of Georgia crosswalk to one selectable and analytics-eligible
  canonical record.
- Added the current work-authorization choices and only the approved EAD and
  residency-visa conditionals. No legacy value is silently treated as an
  unrestricted status.
- Corrected the registry search inset and transient focused-select rerender
  guard without changing the Builder layout or workflow.
- Fresh-browser checks passed search, keyboard selection, active descendant,
  live announcements, conditional focus, required errors, normalization
  queuing, and zero console warnings/errors.
- Specialist re-audits: Miyamoto PASS, Vitruvius PASS, Darwin PASS.
- Full gate: 479/479 tests, typecheck, 23/23 package verification, deterministic
  build, and `git diff --check` passed.
- Build output: 191 runtime files; manifest SHA-256
  `3101fed536242fdc0213c36d97722db2d4ee836b7876b16985897a908bf99f21`.
- Implementation checkpoint:
  `3f7923f feat(timeline): normalize core medical education data`.
- Production-only external gate: confirm DAPIP redistribution authority before
  any production distribution. This does not block the local/no-deploy
  milestone.
