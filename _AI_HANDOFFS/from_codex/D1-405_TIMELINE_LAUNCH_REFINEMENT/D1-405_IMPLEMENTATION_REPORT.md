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

## M7 — Exams, normalized rotations, and specialty-aware LOR intelligence

- Preserved the 407F horizontal workflow, one primary form column, larger
  interactive right preview, full-preview lightbox, and shared TimelineStore.
- Refined only the stepper presentation with layered/recessed 407F surfaces,
  tactile hover and press states, restrained gold/green/amber/cyan hierarchy,
  completion glyphs, visible focus, and reduced-motion behavior.
- Completed the scored-exam contract:
  - Passed/Failed scored exams require a score;
  - Awaiting and genuine nonnumeric statuses remain valid without a score;
  - invalid scored records cannot complete the Builder step or project a board
    event;
  - system deselection retains records without reappearing until reselected;
  - automatic retake suppression is durable and the preview action restores the
    exact attempt/date control.
- Added one locally bundled specialty taxonomy with stable `acgme:<slug>` IDs.
  The ten required common specialties are pinned alphabetically; the remaining
  supported labels remain alphabetical. Unsupported free text cannot be saved
  as a normalized rotation specialty.
- Exact rotation days remain canonical `YYYY-MM-DD` fields while the retained
  axis continues to receive month projections. A shared parser now canonicalizes
  formatted display values during save, preventing a rendered exact date from
  failing its own round trip.
- Added `rotation-lor.js` as the pure specialty-aware status and local command
  layer:
  - ten guided statuses;
  - four founder-required derived states;
  - immutable records keyed by rotation and target-specialty ID;
  - durable reconstruction from serialized `statusId` records;
  - stable/idempotent LOR Builder command IDs;
  - local-only queue and unavailable adapters with non-destructive failure.
- The 407F adapter keeps the status alongside the owning clinical event and in
  the normalized rotation-LOR record set, decorates only the active target
  specialty for presentation, and does not duplicate factual timelines.
- The canonical board renderer adds a labeled star to the matching submitted
  rotation and one conditional `LOR submitted` legend entry. Both serialize in
  all five themes and remain non-color accessible.
- The LOR Builder action carries timeline/student identity, rotation,
  institution, normalized rotation specialty, preceptor, exact dates, current
  status, requested target specialty, and recommended task type. It reports
  `productionCreated:false`; no external task is fabricated.
- Complete gate: 496/496 tests, typecheck, 23/23 package verification,
  deterministic build, `git diff --check`, and a zero-warning/error fresh
  browser console passed.
- Build output: 193 runtime files; manifest SHA-256
  `7cd64b9622180e2dc7a888025a4d69d7cdfe1475237ac00323a62cde2c43df48`.
- Implementation checkpoint:
  `18ab405 feat(timeline): add exam and rotation intelligence`.
- Specialist verdicts: Miyamoto PASS after one hierarchy correction;
  Vitruvius PASS with no concrete functional defect.

### M7 autonomous implementation-level accessibility adjustment

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Undefined `.microLabel`, inheriting body-sized white text on the dark LOR card | Compact 11px/650 `#75CFEA` uppercase micro-label | Restore premium hierarchy and keep the Founder-visible wording, workflow, and brand materially unchanged | 9.7573:1 on `#131B29`; 10.9957:1 on `#080D16` | Rotation LOR card `LETTER OF RECOMMENDATION` label |

This adjustment is within
`D1-UXR-002 IMPLEMENTATION AUTHORITY ADDENDUM 001`: it is an
implementation-level typography/contrast treatment and changes no product
meaning, workflow, layout, or interaction model.

## M8 — Target-specialty timelines

- Added `specialty-variants.js` as a normalized presentation configuration,
  not a second timeline document.
- The canonical `events`, `exams`, profile, media, sources, and provenance
  remain shared facts. Each variant stores only its name, normalized specialty,
  hidden-event IDs, and compatible interview-target configuration.
- The active variant is prominent above the retained horizontal Builder steps.
  Create, switch, rename, and guarded remove actions run through TimelineStore,
  retaining autosave, undo/redo, history, versions, and IndexedDB persistence.
- A pure projection supplies active specialty identity and event visibility to
  the Builder preview, Edit Timeline renderer, theme serialization, and Export.
  Canonical events are never mutated or duplicated by the projection.
- Variant visibility is intentionally hide-only and cannot promote advisor-only
  or private source facts.
- Existing LOR records remain keyed by rotation and normalized target-specialty
  ID. Switching from Internal Medicine to Pediatrics immediately removes the
  Internal Medicine submitted star; switching back restores it.
- The Builder remains one primary editing column with the larger proportional
  interactive preview on the right. No shell, navigation system, or parallel
  media architecture was introduced.
- Complete M8 gate: 504/504 tests, typecheck, 23/23 package verification,
  deterministic 194-file build, zero live-browser warnings/errors, and final
  Miyamoto/Vitruvius PASS verdicts.

## M9 — Explanation and Interview Target tools

- Added `explanation.js` as a bounded factual-safe annotation domain:
  180-character text limit, 12-item document limit, event/date/region/coordinate
  targets, bounded position and size, optional leader, and pure
  create/update/move/resize/delete operations.
- Explanation records remain canonical events with
  `fields.builderDomain="explanation"`; they use the retained TimelineStore, so
  autosave, undo/redo, history, versions, deletion, keyboard routing, preview,
  themes, and Export remain shared.
- Builder Step 7 provides controlled authoring rather than a general drawing
  system. Target-specific panels hide and disable irrelevant controls; the
  Coordinate target exposes bounded X/Y inputs.
- The renderer creates theme-aware Explanation cards, optional leaders, and
  accessible group labels. The same serialized artifact is used in the embedded
  preview, full preview, and Export.
- Extended each specialty variant’s existing interview configuration with
  general/specific mode, program, normalized specialty, exact interview date,
  location, optional label, Calendar metadata seam, program-logo reference,
  contain/crop, and bounded placement/size.
- Program-logo upload accepts PNG/JPG/WEBP, reuses
  `document.advanced.media`, the existing IndexedDB blob store, object-URL
  registry, TimelineStore transaction, Guided/Advanced renderer, and Media
  surface. No duplicate blob or parallel asset system is created.
- A real synthetic WEBP was uploaded through the native file-chooser contract,
  persisted, resized, switched to crop, projected from the active variant, and
  rendered as one Guided media layer in the full preview.
- Added the `Scheduled Interviews` Matrix Calendar adapter contract. The active
  runtime truthfully reports unavailable/no live connection; deterministic
  fixtures remain local-only and do not claim live data.
- Default interview-marker wording remains the frozen `Interview season`;
  specific timelines use the configured optional label or program.
- The Builder remains one primary editor column with the larger interactive
  right preview. No shell, route hierarchy, or unrelated workflow changed.
- Complete M9 gate: 511/511 tests, typecheck, 23/23 package verification,
  deterministic 196-file build, zero live-browser warnings/errors, and final
  Miyamoto/Vitruvius PASS verdicts.
- Implementation checkpoint:
  `fae87de feat(timeline): add explanation and interview tools`.
- Build manifest SHA-256:
  `857fd5364a5d2eabec04cfd5b19b99833fea0ea7b247e4789771dfd06382dbfa`.

### M9 autonomous implementation-level accessibility adjustments

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Theme ink inherited on dark `#111827` Explanation cards | `#F4F7FF` on non-paper cards; `#191C21` on white paper cards | Prevent dark-on-dark text while preserving paper-theme behavior and product appearance | 16.5528:1 on `#111827`; 17.0815:1 on white | Builder, full preview, Export Explanation text |
| Browser-default blue selection controls and dark picker glyphs | Frozen gold `#B98A2E` checkbox/radio state and cyan `#75CFEA` date-indicator/focus treatment | Restore premium 407F hierarchy and improve state/picker visibility without changing semantics | 5.5364:1 gold on `#111B2C`; 10.5102:1 cyan on `#0B1321` | Explanation leader, interview-purpose radios, month/date inputs |
| Toast-only validation | Linked `role="alert"` error in `#FF9F86`, `aria-invalid`, global polite announcement, and invalid-control focus recovery | Make failures independently perceivable and keyboard recoverable | 9.3466:1 on `#0B1321` | Explanation create/save and program-logo validation |

These adjustments are within
`D1-UXR-002 IMPLEMENTATION AUTHORITY ADDENDUM 001`: they alter only
implementation tokens, control states, focus treatment, and validation
semantics while preserving wording, hierarchy, workflow, brand, and behavior.

## M10 — Themes and explicit export audiences

- Preserved all five frozen theme definitions, their order, names, descriptors,
  palettes, geometry, and Advanced Studio behavior.
- Populated theme cards serialize the student’s active timeline through the
  canonical renderer. Empty accounts serialize a five-event example through
  that same renderer and add visible `EXAMPLE TIMELINE` labels plus matching
  accessible names; no blank cards or student-ownership implication remains.
- Corrected the Canvas and Export theme-open paths to remove the picker’s
  `hidden` attribute without depending on exact attribute order.
- Added a future admin theme registry contract with declarative schema,
  renderer compatibility, semantic versioning, package replacement rules,
  permission boundary, approved asset manifest/digest boundary, preview
  request, and safe fallback.
- The future package seam rejects CSS, JavaScript, HTML, code strings,
  executable assets, `javascript:` values, and `url(...)`; it does not provide
  a production admin backend or activate imported themes.
- Replaced the user-facing `Everything` export option with Interview-safe, LOR
  writer, Professional connection, and Mission Residency alumni connection.
- Each non-interviewer audience exposes only its required recipient context.
  Export remains disabled until those recipient fields are complete.
- Visibility is deterministic: interviewer-safe/full-story baseline records
  are eligible; advisor-only records require an explicit matching
  `fields.exportAudiences` scope; student-only and hidden records are never
  included. No audience can elevate an unscoped private event.
- Preview and generated download retain the same render-input object and the
  same audience filter. Recipient context and policy evidence travel in the
  export request without entering external storage.
- Founder steering remains preserved: the premium horizontal Builder stepper,
  one primary editing column, larger right preview, first-class Media route,
  and shared local drag/drop asset system were reverified and not redesigned.
- Hardened both theme pickers with explicit initial focus, Escape/backdrop
  closure, inert background containment, and opener restoration.
- Recipient-detail changes update their gate in place, while audience changes
  restore the selector after the necessary progressive-disclosure rerender.
- Non-empty timelines without a student name remain disabled with an explicit
  Builder correction message before filename generation can fail.
- Canvas Details now writes recipient scopes to the shared event
  `fields.exportAudiences`; no parallel export-policy store was introduced.
- Empty-account theme examples include a submitted-LOR event, so every
  miniature renders the conditional legend through the canonical renderer.
- Complete M10 gate: 522/522 tests (119 TypeScript + 403 module), typecheck,
  23/23 package verification, deterministic 197-file build, and zero live
  browser console errors.
- Build manifest SHA-256:
  `d7a1ed69e9a5ffda6ebb70d566265ec7a1801e4000013e8dce029a648d3798cc`.
- Specialist verdicts: Miyamoto PASS; Vitruvius PASS after the six bounded
  hardening findings were corrected.

### M10 autonomous implementation-level accessibility adjustments

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Generic two-choice segmented audience control | Native four-option select with cyan focus/indicator and progressive labeled fieldset | Keep the expanded audience model understandable, keyboard-native, and compact without changing Export hierarchy | `#39D6FF` on `#090E18`: 11.2508:1 | Export audience choice |
| Undefined recipient micro-label treatment on dark cards | Existing 407F `#A9B7D0` dark-surface label token | The light-shell `#565D66` micro-label token would fail on the 407F dark surface; the delegated implementation authority permits a contrast-preserving alias | 8.3411:1 on `#141D2D`; 9.3335:1 on `#0B111C` | Export recipient labels and completion text |
| Theme active check and unlabeled empty miniature | Dark `#191C21` check ink on frozen gold plus visible `EXAMPLE TIMELINE` badge and accessible name | Preserve gold, meet contrast, and prevent example/student ambiguity without changing theme definitions | `#191C21` on `#FFD76A`: 12.3478:1 | Canvas and Export theme cards |

## M11 entitlement and migration implementation

- `entitlement.js` is the single pure entitlement policy surface. It evaluates
  global enablement, explicit user override, Administrator role, 360
  membership, cohort, promotion, default allowance, usage, expiry, and
  verified production authority in deterministic order.
- Local proof scenarios are restricted to localhost and disclose zero network,
  WordPress, Matrix, or production writes. The production boundary is
  intentionally unavailable and returns an unverified decision.
- `TimelineStore` defaults to denied/pending. It reads existing current or
  legacy documents before access resolution and cannot create a draft until an
  explicitly verified decision grants creation.
- Every mutation, queued save, blob transaction, undo/redo, version operation,
  restore, reset, advisor sync record, and Export request has an explicit
  capability boundary. A local persistence lease is captured synchronously
  when an authorized mutation is accepted, so that exact snapshot can finish
  after expiry without allowing any new mutation, undo, redo, or save.
- Active 407F and retained inactive-shell integration points use the same
  contract. No parallel state store or UI was introduced.
- Existing data becomes read-only on zero allowance, expiration, access
  removal, global disable, or production verification failure. No access
  decision has destructive effects.
- Migration preserves D1-404 IDs, geometry, canonical and unknown categories,
  event extensions, themes, Advanced media/text/background, advisor state,
  specialty/interview extensions, history, versions, and Export state.
- Missing clinical LOR evidence is marked `unknown` with non-submission
  evidence. Missing exact rotation days remain month-legacy/unknown.
- Migration is input-pure and idempotent. Existing source lineage wins; version
  records are not eagerly rewritten and restore retains the source version.
- M11 gate: 540/540 tests (119 TypeScript + 421 module), 16/16 focused
  entitlement/migration tests, 69/69 expanded changed-surface tests,
  typecheck, 23/23 package verification,
  deterministic 198-file build, and zero errors in a fresh removed-access
  browser session.
- Manifest SHA-256:
  `7242f0fb8b787935f8a7334e437fdc3335ad726158f3750a6cc0c96b6ac6cf0b`.
- Final specialist verdicts: Lorentz PASS for entitlement/security boundaries;
  Darwin PASS for migration and pre-expiry concurrency preservation;
  Vitruvius PASS for read-only semantics, focus, inspection, and preview
  affordances.

### M11 autonomous implementation-level accessibility adjustments

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| No entitlement state treatment | Restrained green `#A8E8C8` full-access text and 407F gold-family `#F3D997` read-only text on dark instrument surfaces | Communicate access without changing 407F hierarchy or adding a new workflow | 10.2048:1 on `#123024`; 11.9919:1 on `#221E17` | Header entitlement badge |
| Mutation refusal available only at the engineering boundary | Persistent dark read-only banner using `#E8ECF2` body and `#F3D997` label on `#151921` | Make the preserved-data/read-only state perceivable before interaction | 14.8474:1; 12.7278:1 | All primary routes |
| Visually unchanged controls after entitlement removal | Native disabled and `aria-disabled` semantics plus retained not-allowed treatment | Prevent false affordance while keeping document content and navigation readable | Non-text state plus existing 407F control contrast | Builder, Canvas, Media, Intake, Advisor, Export |
