# Independent Timeline candidate review

Status: SEALED before reading any parent conclusions, defect ledger, SOL report or Fable report. This is an independent Codex engineering/artifact review, not Fable 5.1. The invocation did not expose a specific model identifier.

Verdict: do not treat this candidate as accepted for release. The focused suite passes, but independent adversarial cases expose the defects below. None is a production incident claim.

## Custody and scope

- HEAD: `9d07904596f05cc2d9f4f4485c0801fe87709002`; recovery origin from packet: `3f650a10fa46f637fc656dd3f13d0ce18ea7093b`.
- Frozen manifest SHA-256: `c773d309d72dfaae682ee17e210d6984b148aded0b45c08a1f9b7efc57022a10`. All 371 files matched before review and after the experiments. No source drift.
- Both actual authority files rehashed correctly: .key `113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706`; golden PNG `bf48d25b2d46a75c868f98692d480147f8c7d8f234955608a27ca50b3b808836`. The golden was visually inspected privately. No reference applicant content was used in generated fixtures.
- Only reviewer-owned `independent-*` evidence and this report were written. No application source, tracked test, provider, deployment, browser/native UI or commit operation occurred.

## Actionable findings

### 1. P1: shared preview caches can disclose another document or audience after a render failure

`web/js/uxr-002/preview.js:67-94` keys the singleton cache by audience/class, or a caller-supplied surface key, without document ID, owner, viewer or subject. Render document A successfully, then render document B with a malformed saved scene under the normal default options. B returns A's SVG, including `Synthetic SECRET_CACHE_A`, marked as last-good. The visible stale notice does not cure the cross-owner disclosure. Real callers remain in `uxr-002/app.js:426-477` and `uxr-002/home.js:56`.

A second independent probe demonstrates that `last-good-builder-preview.js:5-6,20-34` keys only by document ID. Render an EVERYTHING preview, switch to INTERVIEWER_SAFE and force the renderer to throw. The previous synthetic student-only text returns. The newer identity guard in `407f-engineering-adapter.js` passes its tests, but does not repair these shared helpers.

Smallest correction: include document, owner, viewer, subject, audience and surface identity in both cache records and reuse checks. Never reuse an unbound cache entry. Preserve same-identity stale recovery. Add direct shared-helper tests, including explicit `surfaceKey` and same-ID owner/viewer changes.

Evidence: `independent-adversarial.mjs`, `independent-adversarial-results.json`, `independent-cross-document-cache.html`.

### 2. P1: export collision checks accept an opaque overlay hiding the entire identity/profile card

`web/js/presentation/resolved-founder-presentation.js:175` starts collision checks only from text whose role is `event`. A valid authored black rectangle at `(13,661,545,410)` overlays the complete profile card. The final SVG places the opaque rectangle at paint index 52, after the profile text at indices 32-35. `assertCompleteFounderPresentation` still allows export. With a valid theme, background and categories, Guardian returns only the ordinary unfinished-furniture REVIEW finding, with no profile-occlusion finding.

A real editable PPTX was generated successfully from this SVG. Its native validation returns no errors. This demonstrates that structural editability is not material visibility.

Smallest correction: check material identity, profile and authored text against later opaque objects, preserving intentional text-on-backing relationships. Block the actual final export when required content is obscured. Do not rearrange manual layers automatically.

Evidence: `independent-profile-occluded.svg`, `independent-profile-occluded.pptx`, result JSON files. Geometry/paint order establishes this finding; no substitute renderer is used to claim native visual acceptance.

### 3. P2: milestone institution disappears while export completeness reports success

The probe uses a confirmed `Clinical license awarded` milestone at `Synthetic Licensing Council`. The institution remains in source but no visible text node contains it. `board-renderer.js:740-805` does not carry the institution into the flag projection; `locked-407f-export.js:389-430` draws only title/date. The new completeness check at `founder-presentation-serializer.js:377-379` checks title/siteName only for arrows.

The gate passes, and a real exported PPTX has no visible `Synthetic Licensing Council` text. Its editability validation passes. Hidden recovery facts do not make a printed artifact complete.

Smallest correction: retain source-grounded material institution/location in the milestone presentation, or block the unsupported case with an actionable finding. Extend visible field coverage to milestones rather than relying on event-ID presence.

Evidence: `independent-milestone-site-loss.svg`, `independent-milestone-site-loss.pptx`, `independent-native-adversarial-results.json`.

### 4. P2: generic relocation text invents a USA marker for a non-USA event

`locked-407f-export.js:405` selects the USA asset for any title matching `relocat`, `moved`, `citizen` or `immigra`, regardless of country. The independent `Moved to Canada` fixture produces `data-founder-usa-flag-asset-sha256` and a USA flag, and passes the completeness gate and real PPTX generation.

Smallest correction: require explicit confirmed USA destination/citizenship context before assigning the USA asset. Otherwise use the authorized generic milestone treatment. Add Canada and non-USA citizenship cases.

Evidence: `independent-non-usa-relocation.svg`, `independent-non-usa-relocation.pptx`, adversarial results.

### 5. P2: a schema-valid stored scene can silently lose authored non-event objects

`editor/scene-graph.js:186-188` retains only stored scene objects of type `event`; it rebuilds text/media/elements solely from compatibility arrays. A supported, valid scene containing an authored text object, with no legacy text replica, renders without that text and passes export. No recovery error occurs. The probe's `SYNTHETIC_SCENE_ONLY_AUTHORED` remains in saved input and is absent from SVG.

This is a saved-document boundary finding. I have not shown that ordinary current UI saving creates such a document. The accepted schema nevertheless treats it as valid and the serializer silently drops its authored content.

Smallest correction: detect scene objects with no compatibility representation and preserve them, or fail closed with the existing recoverable-layout error. Do not silently rebuild a materially different scene.

Evidence: `independent-scene-only-text.svg`, adversarial script/results.

## Additional boundary observation

An event with normalized coordinates but `datePrecision: UNKNOWN` and raw wording `date unavailable` displays `2/22 - 8/23` and passes export. `source-date-wording.js` handles YEAR, SEASON and VAGUE_RANGE but falls through for UNKNOWN. This is a synthetic persisted-input boundary probe; ordinary ingestion reachability was not demonstrated. Reject inconsistent normalized/unknown data or preserve uncertainty. Evidence: `independent-unknown-precision.svg` and results.

## Artifact inspection and limitations

- The actual M01 browser PNG and golden PNG were visually inspected. The candidate retains recognizable template furniture, but empty photo/interview placeholders remain exported. Contract policy for absent furniture is undefined; I do not invent a removal policy or call these artifacts sendable.
- Actual M01 and F01 saved PPTX files were structurally inspected. Each has one 20 by 11.25 inch slide and six image parts; M01 has 41 native text shapes, F01 has 31. Text and shapes are editable in OOXML. This does not prove native Keynote edit behavior, crops, font resolution or visual fidelity.
- Native font sizes are converted by `.75` in `editable-pptx.js:94`: the M01 title is 27 pt, arrow labels 13.5 pt, years 17.25 pt, against contract values described as 36/18/23 pt. Relative pixel proportions may explain the conversion. Reconcile literal native sizes versus proportional canvas scaling during parent-owned native acceptance; do not blindly change the conversion based only on this review.
- Golden PNG uses Display P3 while the browser PNG is untagged. `independent-color-samples.json` records different raw swatch pixels, but those values are not a color-managed comparison and are not asserted to be the native fill values. Native fill matching remains unverified.
- A reviewer MuPDF raster attempt did not preserve the SVG background/typography and was discarded. It supplies no product evidence.
- No browser interactions, native opening, provider calls, live authorization tests or production acceptance were performed. No claim of whole-product privacy completeness or release readiness is made.

## Reproduction and evidence

From the worktree root:

```sh
node .timeline-recovery-20261002/template-locked/independent-adversarial.mjs
```

The script creates synthetic SVG/PPTX cases and result JSON under the allowed ignored folder. Seven independent scenarios differ from the existing 20-case fixture matrix. Three real PPTX cases pass structural export validation while retaining the identified defects.

Focused command run:

```sh
node --test packages/mission-timeline/tests/d1-023-active-preview-recovery.test.mjs packages/mission-timeline/tests/d1-023-date-uncertainty.test.mjs packages/mission-timeline/tests/d1-023-export-completeness.test.mjs packages/mission-timeline/tests/d1-023-guardian-readiness.test.mjs packages/mission-timeline/tests/d1-023-presentation-scene-safety.test.mjs packages/mission-timeline/tests/d1-023-text-layout.test.mjs packages/mission-timeline/tests/d1-024-template-density.test.mjs packages/mission-timeline/tests/d1-024-template-lock.test.mjs
```

Result: 51 tests passed, zero failed. Log: `independent-focused-tests.log`. This is regression evidence, not visual/product acceptance. `independent-final-source-check.json` records the 371-file final drift check. `independent-evidence-manifest.json` binds report and evidence SHA-256 values.

Sealed independently; stop after report. No commit authorized or created.
