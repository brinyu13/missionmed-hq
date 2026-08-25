# D1 Timeline Founder Re-anchor 015 — Renderer, Preview, and Export Receipt

Status: `IMPLEMENTED_LOCAL_CANDIDATE`

Scope: Timeline-owned renderer, preview, export, focused tests, and synthetic evidence only. No provider, shared Matrix, production, Founder imagery, editor-gesture, Builder, or CV mutation was performed by this lane.

## Authority binding

- Supplied Founder Keynote SHA-256: `da6a7fa74a2f5d42f53399a9fc00bfe7283e7e4b79f349fca062da0be106cc19`
- Verified golden PNG SHA-256: `494694390329b0c050d7b4ca55c32b06e78eadc6375014b8a6b32c17ef36447a`
- Verified golden PDF SHA-256: `7d13f2746ff72e678a3a0b9c6a81dc42aedb467bc5266896ed9f253a4cc7e9e1`
- Canonical canvas: `1920 × 1080`, landscape
- Synthetic golden namespace: `d1-timeline-founder-reanchor-015/synthetic-golden-master/keynote-2024-v1`
- Synthetic fixture SHA-256: `fe185c69db634561521a1e8d7b626d1fa3cc9963c7fe6ecb2c1db50837fb0730`
- Exact non-personal Keynote board asset SHA-256: `f5d28c36504ea8fa0b54a55975b493bd9a0c1d6948ca447eb88a9198b8777cc1`
- Deterministic synthetic portable-SVG SHA-256: `6401dc3647c97f7fb2ab22b79a66749a9f4bd1b1c098f8ac0dde0f14fe1b09b8`

The repository contains no Founder personal imagery or slide bytes. It includes only the exact non-personal Keynote template-furniture background (`Data/Magnetboard-1920-107.jpg`), whose bytes, dimensions, and checksum were independently verified, plus synthetic same-geometry test content.

## Implementation

1. Added a checksum-bound Founder Keynote custody contract and synthetic golden manifest.
2. Added one `d1-founder-keynote-portable-svg/1` serializer over the existing Timeline scene model.
3. Routed canonical HTML preview through that serializer.
4. Routed the existing Timeline canvas/PNG/PDF engine through the same serializer and shared SVG rasterizer.
5. Routed the current UXR export adapter through the same serializer and rasterizer while preserving its Advanced overlay projection.
6. Added last-good preview retention: a failed recalculation keeps the prior complete board visible and overlays a concise recovery status.
7. Re-anchored the exact 1920x1080 Keynote linen board asset; measured axis (y=125, h=36); title, six-row Color Key, profile card, and three media frames to the supplied source geometry.
8. Projected durable profile, photo, and program-logo media into those canonical slots.
9. Made individual student-media resolution fail soft; missing media leaves the canonical frame intact and surfaces a warning rather than destroying the Timeline.
10. Propagated serializer and media warnings into generated artifact records.

## Test evidence

- New focused presentation suite: `5/5 PASS`
- Affected existing renderer/export/privacy suites: `48/48 PASS`
- Total targeted unit/regression result: `53/53 PASS`
- Direct production-entry esbuild bundle: `PASS`
- Known esbuild output: the pre-existing guarded CommonJS advisory in `presentation-kernel-adapter.js`; no new bundle error.
- Package-local `npm run typecheck`: not runnable from this fresh worktree because `node_modules` is intentionally absent. A donor TypeScript binary reached only pre-existing package-resolution errors for `jose` and AWS SDK modules; this lane changes browser JavaScript only.

Commands:

```text
node --test tests/d1-founder-reanchor-presentation.test.mjs
node --test tests/d1-406-functional-recovery.test.mjs tests/uxr-002-canvas.test.mjs tests/uxr-002-theme-picker-integration.test.mjs tests/d1-404-export-integration.test.mjs tests/d1-405-founder-artifact-contract.test.mjs tests/medical-privacy-osler-413.test.mjs
esbuild web/js/407f-engineering-adapter.js --bundle --format=esm --platform=browser --target=es2022
```

## Browser raster evidence

- Chrome loaded the localhost synthetic harness successfully.
- Shared serializer rendered the synthetic presentation at `1920 × 1080`.
- Shared SVG rasterizer produced a visible canvas with `0` media warnings.
- Exact-size raster QA screenshot: `/private/tmp/d1-founder-reanchor-015-keynote-candidate-1920x1080.png`
- Screenshot dimensions: `1920 × 1080`
- Screenshot SHA-256: `690144027a585f30d9929079538ced388ac1af83e63dc24cb3245f3a4e6056db`
- Bundled candidate SHA-256: `daeca33f3cbabfdf7da371c33e1e83fb354a8c1428354054ffbdc9a09e049044`

Visual observation after opening the exact-size PNG: the synthetic raster is complete and nonblank; the source-bound blue-gray linen board, title plaque, y=125 year ribbon, duration arrows, milestone flags, interview ribbon, corrected work/personal/exams/hospital/clinic/research key order, large profile card, and three measured photo frames are all visible. American Typewriter, Futura, and Baskerville system-font stacks are used with safe fallbacks. The raster matches the preview serializer because there is no second export geometry implementation in this path.

## Truthful limitation / next gate

This receipt proves custody, deterministic composition, source-bound template furniture, shared serialization, last-good resilience, and local browser raster viability. It does **not** claim canonical pixel fidelity merely from hash attributes. Founder visual acceptance and independent Keynote-fidelity review remain mandatory before any replacement deployment.

## Integrated opened-export verification — 2026-08-25

The integrated browser gate exposed and repaired two production-class defects before release:

1. Concurrent Founder SVG surfaces reused the same SVG resource IDs. The Edit/Export preview could therefore resolve another surface's definitions and lose the linen texture/navy year axis even though the standalone artifact was correct. Resource IDs are now namespaced per mounted surface.
2. The A4 PDF transformation matrix could serialize an effectively-zero value in scientific notation. Poppler and standard viewers treated the page as blank. PDF geometry now emits bounded finite fixed-decimal values.

The shared preview and all three downloaded artifacts were then opened and inspected:

| Surface | Result | Preview correlation | Mean absolute error |
|---|---|---:|---:|
| PNG 1920x1080 | PASS | 0.978085 | 0.012087 |
| Letter PDF | PASS | 0.969041 | 0.015065 |
| A4 PDF | PASS | 0.965575 | 0.016148 |

- browser receipt: `/private/tmp/d1-founder-shared-export-015/RC1_EXPORT_BROWSER_RECEIPT.json`
- preview/opened artifacts: `/private/tmp/d1-founder-shared-export-015/`
- mounted Founder SVGs: 4
- duplicate SVG resource IDs: 0
- clipping failures: 0
- browser console errors: 0
- PNG SHA-256: `1d5a65e537db14dddf6ee38fcc2df3c85236f34d17bdd3657731f336cbd1ac18`
- Letter PDF SHA-256: `e71ea0f17defc184731a447b2068b01f4a3873f4b9b33a1c875dd0dee9b536bb`
- A4 PDF SHA-256: `73494bc25773f5928c459232fd6ddaad6d69f7c43dceb74f3a4de7db5bf32b88`

Founder visual/product acceptance remains a separate mandatory gate; this section proves internal consistency and opened-artifact fidelity, not Founder acceptance.
