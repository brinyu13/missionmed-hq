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

## Autonomous implementation-level adjustments

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Browser-default focus outline on programmatically focused `tabindex="-1"` route heading | `outline:none` for `tabindex="-1"` only | Prevent a non-interactive heading from looking like a selected/editable control while preserving route-focus semantics | Not color-contrast applicable; interactive focus remains 2px cyan | Home route heading and future programmatically focused non-interactive route headings |
| Renderer isolation for fewer than four normal years because the 28% cap and exact-sum invariant conflict | Equal-width, exact-sum small-span presentation fallback; strict shared allocator retained | Ordinary short student timelines must render; this changes only the impossible implementation constraint | Not color-contrast applicable; 1728px becomes 1728, 864+864, or 576+576+576 | Home latest preview, Edit Timeline renderer, theme miniatures, export renderer |
| Decorative canvas alone supplied the main atmospheric field | Deterministic dark 407F grid/atmosphere on `main`, with the decorative canvas retained | Prevent a transient pale capture during canvas resize while preserving the accepted visual identity | Existing 407F color tokens retained | All route workspace backdrops |

No product hierarchy, workflow, behavior, or meaning changed through this adjustment.
