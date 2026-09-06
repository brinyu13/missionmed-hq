# D1 Timeline app_demo_401

Hardened in 407 from the 406A Keynote Classic sprite integration baseline, extended in D1-408 with real local PDF ingestion and quarantined human review, advanced in D1-409 into a durable local-first product foundation, and completed in D1-410 as a sandbox release candidate.

## Run

Open `index.html` directly in a browser, or serve this folder with any static file server. The app is a sandbox-only filesystem demo and does not require a backend.

## Scope

- Preserves the 406 UX and interaction model.
- Uses `assets/keynote_classic_402a/` for Keynote Classic arrows, axis, flags, and chrome where available.
- Keeps Keynote Classic as the default timeline theme.
- Keeps Blank Builder as the default canvas.
- Does not use the completed sample PNG as the editable canvas.
- Adds a canonical in-memory `TimelineDocument` bridge for future CV/ERAS ingestion.
- Reads native-text PDFs locally with a vendored PDF.js runtime and no network dependency.
- Keeps source documents, pages, section blocks, candidate provenance, duplicate/conflict analysis, privacy review, and human actions distinct.
- Uses separate ERAS, CV, resume, and unknown-layout parsing paths.
- Preserves user-declared, detected, and effective document types, with a per-source correction and local re-run control.
- Detects image-only PDFs and stops honestly at `OCR_REQUIRED`; the local OCR adapter boundary does not fabricate text.
- Requires explicit confirmation before any extracted candidate becomes a timeline event.
- Adds deterministic layout, collision diagnostics, validation warnings, fixtures, and durable version restore.
- Persists drafts, named versions, recovery checkpoints, media blobs, advisor state, export records, and artifacts in IndexedDB.
- Implements autosave, explicit save, dirty/error state, draft duplication, rename, archive, comparison, restore, import migration, and entire-draft deletion preview.
- Supports local JPEG, PNG, and WebP media with validated dimensions and size, thumbnails, bounded crop/zoom/rotation, alt text, visibility, replacement, and removal.
- Persists advisor comments, change requests, acknowledgements, audit history, and scope-specific approval; material changes revoke stale approvals deterministically.
- Generates local interviewer-safe/full-story PNGs, print/advisor PDFs, sanitized Timeline JSON, TimelineArtifact manifests, and a ZIP student archive without external services.
- Defines mock-only legacy and proposed FileVault v2 adapters plus a five-mode reconciliation bridge; the default is disabled and all production-write capabilities are false.
- Does not use `localStorage`, credentials, deployment scripts, or production routes.
- Does not claim Template Package freeze.
- Adds first-use route guidance and explicit five-state visibility language.
- Adds undo/redo, duplication, recovery, source-date reset, lane locking, density, zoom, title/profile editing, and deterministic collision diagnostics.
- Paginates and filters 500-candidate review fixtures with preserved selection and safe bulk acceptance.
- Implements a local manual OCR-text fallback while keeping cloud OCR disabled and every result quarantined.
- Generates semantic accessible HTML and text companions while honestly labeling visual PDFs as untagged.
- Adds an exact export-renderer preview, deterministic repeated PNG output, and hidden-item exclusion from portable JSON/ZIP output.
- Adds a five-minute advisor brief, timeline-derived practice questions, personal-context approval, and explicit approval revocation.

## Main Files

- `index.html`
- `styles.css`
- `app.js`
- `styles/`
- `js/`
- `tests/run_407_regression.js`
- `tests/run_408_ingestion.js`
- `tests/fixtures/`
- `js/ingestion/`
- `js/persistence/`
- `js/recovery/`
- `js/media/`
- `js/advisor/`
- `js/export/`
- `js/artifacts/`
- `js/filevault/`
- `js/migrations/`
- `js/product-409.js`
- `js/ui/product-409-ui.js`
- `js/product-410.js`
- `js/release/release-state.js`
- `js/editor/editor-history.js`
- `js/editor/collision-engine-410.js`
- `js/review/review-workspace.js`
- `js/export/accessible-export.js`
- `js/ui/product-410-ui.js`
- `styles/product-410.css`
- `docs/ingestion-schema-408.json`
- `docs/timeline-artifact-409.schema.json`
- `vendor/pdfjs/`
- `assets/keynote_classic_402a/`

## Architecture

- `styles.css` is an import wrapper for design tokens, the preserved 406A stylesheet, and 407 hardening partials.
- `app.js` is a compatibility wrapper for old links and imports `js/app.js`.
- `js/app-legacy-406a.js` preserves the 406A single-file behavior as the rendering base.
- `js/timeline-engine.js` owns month math, range math, and axis calculations.
- `js/state.js` converts between the legacy 406A state and the canonical 407 `TimelineDocument`.
- `js/layout-engine.js` assigns deterministic lanes and milestone placements.
- `js/validators.js` emits nonblocking data and layout warnings.
- `js/fixtures.js` provides 5, 15, 30, 50, same-month, 10-year, and 20-year fixture documents.
- `js/renderers.js` renders 407 diagnostics and version controls around the preserved app.
- `js/interactions.js` installs the 407 bridge and exposes `window.D1_407_TEST`.
- `js/ingestion/index.js` installs D1-408 and exposes `window.D1_408_TEST` for deterministic regression coverage.
- `js/ingestion/pdf-text-extractor.js` performs browser-local, page-preserving native PDF extraction.
- `js/ingestion/ingestion-controller.js` owns quarantine, review, merge, visibility, provenance links, reruns, and document-removal impact.
- `js/persistence/indexeddb-adapter.js` and `js/persistence/document-store.js` own atomic durable browser-local storage and document lifecycle operations.
- `js/recovery/recovery-manager.js` owns checkpoints and guarded crash recovery.
- `js/media/media-manager.js` owns local media validation, persisted blobs, transforms, thumbnails, and object URL cleanup.
- `js/advisor/advisor-manager.js` owns review state, comments, change requests, audit history, and fingerprint-bound approvals.
- `js/export/export-engine.js` composes real local PNG, PDF, JSON, ZIP, and TimelineArtifact outputs using the canvas, PDF, and ZIP writers.
- `js/filevault/bridge.js` coordinates disabled or mock-only legacy/v2 adapters with deterministic idempotency and visible reconciliation.
- `js/migrations/timeline-migrator.js` imports 407, 408.1, 409.1, and TimelineArtifact companion documents without silent schema downgrade.
- `js/product-409.js` installs D1-409 and exposes `window.D1_409_TEST` for deterministic verification.
- `docs/ingestion-schema-408.json` documents the versioned sandbox domain contract; it is not a production database schema.
- `docs/timeline-artifact-409.schema.json` documents the canonical FileVault-neutral artifact contract.

## Test

Run:

```bash
NODE_PATH=/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/tests/run_407_regression.js
```

Latest 407 run: 81 passed, 0 failed, 0 console errors, 0 request failures.

Run the D1-408 ingestion suite:

```bash
NODE_PATH=/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/tests/run_408_ingestion.js
```

The 408 suite generates only synthetic local fixture PDFs. It does not use or upload real student documents.

Evidence is written to:

`/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/407/`

D1-408 evidence is written to:

`/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/408/`

Run the D1-409 foundation suite:

```bash
node /Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/tests/run_409_foundation.js
```

Latest verified totals: D1-407 81/81, D1-408 160/160, and D1-409 237/237. Combined: 478/478, with zero console errors, request failures, unexpected network requests, or production FileVault requests.

D1-409 evidence, generated exports, external export validation, responsive screenshots, and contact sheets are written to:

`/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/409/`

Run the D1-410 release-candidate suite while serving this folder locally:

```bash
node /Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/tests/run_410_release_candidate.js
```

Latest verified totals: D1-407 81/81, D1-408 160/160, D1-409 237/237, and D1-410 306/306. Combined: 784/784. The separate performance sweep passes 20/20 budgets. D1-410 evidence is written to:

`/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/410/`
