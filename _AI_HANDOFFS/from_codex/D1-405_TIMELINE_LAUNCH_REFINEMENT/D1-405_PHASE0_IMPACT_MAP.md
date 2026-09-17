# D1-405 Phase 0 Impact Map

## Authority and preservation boundary

- Ticket: `D1-405-TIMELINE-LAUNCH-REFINEMENT`
- Starting branch: `d1-macprotimeline-uxr-002`
- Working branch: `d1-405-timeline-launch-refinement`
- Starting commit: `771b8775b5007617335f7aface6e3772631a32d9`
- D1-404 implementation commit: `5c57fd5`
- Canonical presentation: the in-place 407F application at `packages/mission-timeline/web/index.html`
- Preservation rule: extend the existing document, store, renderer, persistence, history, advisor, File Vault, and export architecture. Keep the internal route identifier `canvas`; change only founder-facing language.
- External boundary: no push, deployment, Matrix mutation, WordPress mutation, or production write.

## Baseline evidence

Fresh local browser captures:

- `evidence/screenshots/D1-405-M0-baseline-home.png`
- `evidence/screenshots/D1-405-M0-baseline-builder.png`
- `evidence/screenshots/D1-405-M0-baseline-canvas.png`
- `evidence/screenshots/D1-405-M0-baseline-export.png`

Current primary destinations:

1. Home
2. Builder
3. Canvas
4. Export

The selected replacement for the founder-facing `Canvas` label is **Edit Timeline**. The internal route, data contracts, persisted route value, and Canvas 2D implementation terminology remain unchanged.

## Exact source ownership

| Required area | Active implementation files | Retained supporting files |
|---|---|---|
| Branding and document title | `web/index.html`, `web/styles/407f-upgrade.css` | `web/js/uxr-002/app.js`, `web/styles/uxr-002.css`, shell tests |
| Four-destination navigation | `web/index.html`, `web/js/407f-engineering-adapter.js` | `constants.js`, `app.js`, `home.js`, `review.js`, `canvas.js`, `responsive.js` |
| Home and faster start | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/styles/407f-upgrade.css` | `home.js`, `intake.js`, `intake-d1-408-adapter.js`, File Vault adapters |
| Builder shell and workflow | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/styles/407f-upgrade.css` | `builder.js`, `responsive.js`, `review.js`, `store.js` |
| Canonical preview and renderer | `web/js/uxr-002/board-renderer.js`, `web/js/uxr-002/advanced-board.js`, `web/js/407f-engineering-adapter.js` | legacy inline `renderBoard` in `web/index.html` must be retired from live previews; retain `timeline-engine.js`, `layout-engine.js`, and the export canvas renderer |
| Full-preview overlay/lightbox | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/styles/407f-upgrade.css` | `overlays.js`, `preview.js`, `canvas.js` |
| Month/date controls | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/month-field.js` | `utils.js`, `builder.js`, ingestion date normalizer |
| Medical-school selection | `web/index.html`, `web/js/407f-engineering-adapter.js`, new registry/provider | `datasets.js`, `builder.js`, `store.js` |
| Exams | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/exam-workflow.js`, `web/js/uxr-002/exam-integration.js` | `builder.js`, `validators.js`, board renderer |
| Rotations | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/builder.js` | `store.js`, `constants.js`, board renderer, review |
| Work | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/builder.js` | `store.js`, board renderer, review |
| Research | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/builder.js` | `store.js`, board renderer, review |
| Personal | `web/index.html`, `web/js/407f-engineering-adapter.js`, `web/js/uxr-002/builder.js` | `store.js`, board renderer, review |
| Specialty variants and LOR | `web/js/uxr-002/store.js`, `web/js/uxr-002/builder.js`, `web/js/uxr-002/board-renderer.js` | `canvas.js`, `review.js`, document mapper |
| Explanation annotations | `web/js/uxr-002/advanced-board.js`, `web/js/uxr-002/advanced-studio.js`, `web/js/uxr-002/board-renderer.js` | `canvas.js`, editor history |
| Interview target/logo | `web/js/uxr-002/board-renderer.js`, `web/js/uxr-002/canvas.js`, `web/js/uxr-002/store.js` | `app.js`, overlays, media manager |
| Themes and previews | `web/js/uxr-002/themes.js`, `web/js/uxr-002/theme-picker.js`, `web/js/uxr-002/app.js` | board renderer, export screen |
| Export audiences | `web/js/uxr-002/export-screen.js`, `web/js/uxr-002/export-adapter.js`, `web/js/uxr-002/app.js` | export engine, accessible export, renderer |
| Entitlement stubs | `web/js/uxr-002/store.js`, `web/js/407f-engineering-adapter.js`, `src/security/authorization.ts` | release state, Matrix adapter/client contracts |
| Migration and persistence | `web/js/uxr-002/store.js`, `web/js/persistence/document-mapper.js`, `web/js/persistence/document-store.js` | IndexedDB/memory adapters, hybrid persistence |
| Accessibility/responsive | `web/js/uxr-002/responsive.js`, `web/styles/responsive.css`, `web/styles/407f-upgrade.css` | overlays, icons, browser QA scripts |
| Package verification/build | `scripts/verify-package.mjs`, `scripts/build-d1-404-candidate.mjs`, `package.json` | release manifest, test suites |

## Minimum refactor plan

1. Preserve the current application entry point and route graph.
2. Add small pure models for new registries, audience rules, entitlements, specialty variants, and migration.
3. Reuse the canonical board renderer for Builder, Edit Timeline, and Export; introduce only a contain/letterbox viewport adapter and interaction hooks.
4. Extend the existing document schema through backward-compatible defaults and versioned normalization.
5. Keep File Vault, LOR Builder, Matrix Calendar, and entitlement integrations as truthful capability seams unless a current local adapter already exists.
6. Update founder-visible copy and accessibility names without renaming internal `canvas` identifiers.
7. Add tests next to the retained D1-404/D1-UXR suites and preserve deterministic offline behavior.

Estimated engineering preservation: **88–92%**. The required refactor is limited to presentation/controller seams, additive schema migration, registries/policies, and integration contracts; no store, timeline engine, persistence, adaptive layout, Builder CRUD, exam workflow, Edit Timeline, or Export rewrite is warranted.

## High-risk couplings

- The active app synchronizes inline 407F state and `TimelineStore`; additive fields must be merged through the bridge rather than replaced by either side.
- Two preview renderers exist. Builder/Home must move to the retained shared board renderer so geometry matches Edit Timeline and Export.
- Existing event migration can drop unknown top-level event fields; additive event details belong under `event.fields`.
- Month-only assumptions are shared by layout, edit, review, advisor, and export; exact rotation dates require a validated exact-date field plus derived month axis values.
- The frozen theme validator intentionally accepts exactly five built-ins; admin themes require a validating wrapper registry, not relaxation of the built-in catalog.
- `EVERYTHING` is also an internal advisor/session scope; only founder-facing Export audience options should change.
- Entitlement enforcement must live at mutation/export boundaries, not only in disabled UI.
- Advisor approval fingerprints must be invalidated by new audience-sensitive presentation data.

## Ten evaluated destination labels

1. Edit Timeline
2. Timeline Editor
3. Preview & Edit
4. Refine Timeline
5. Arrange Timeline
6. Design Timeline
7. Visual Editor
8. Timeline Studio
9. Timeline Workspace
10. Timeline Designer

Selected: **Edit Timeline**. It most directly tells a student both the object and the action, and it produces the clearest four-step sequence: `Home / Builder / Edit Timeline / Export`.

## Phase 0 decision

D1-405 modifies the D1-404/407F implementation directly. It does not create a parallel application, replacement shell, alternate navigation system, or duplicated renderer.
