# TIMELINE-RC1-CANONICAL-BASELINE-006

## Verdict

**PASS - finding A.** The visual drift seen in `Brian RC1 Canary` is confined to a deliberately mutated editor-torture document. It is not evidence that default creation, protected rendering, hydration, serialization, or export has silently replaced the accepted Timeline presentation.

No production code or production document was changed for this gate.

## Fixture separation

| Fixture | Purpose | Authority |
|---|---|---|
| `EDITOR TORTURE FIXTURE - NOT VISUAL AUTHORITY` | The live two-event `Brian RC1 Canary`, which contains user/editor mutations, a white background override, moved furniture, and prior test objects | Interaction and failure-recovery evidence only |
| `CANONICAL VISUAL REGRESSION FIXTURE` | Fresh deterministic seven-event document with no advanced background, object, group, or presentation override | Rendering, no-edit roundtrip, save/reload, Matrix-return, PNG, Letter PDF, and A4 PDF fidelity |

The live torture fixture was preserved. It was not reset, merged, cleaned, or used as the canonical expected image.

## Canonical authority

The canonical presentation is `packages/mission-timeline/web/presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html`, consumed through protected kernel `D1-409H-A1`.

Protected hashes:

- HTML: `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`
- CSS: `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`
- JavaScript: `ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32`

These match the governing protected hashes and the release manifest. The accepted visual comparator is `recovery-003/evidence/d1-411a-local-browser-valid/D1-411B_FULL_PREVIEW_ARTIFACT.png`, SHA-256 `fe0802b5b5f51bc003d8005fd1f51a62277702ddb0dc393cd25eaef8de4b4dfd`.

## Controlled no-edit roundtrip

Source commit: `14fb4dd3258fb8bf920910fc066495e9835503f5`.

The controlled browser journey:

1. created the clean canonical reference in a fresh isolated browser profile;
2. captured the baseline;
3. entered Advanced Studio without changing the composition;
4. visited all 11 editor panels;
5. selected 100%, 150%, then FIT;
6. saved;
7. reloaded;
8. left through the configured Matrix return and returned;
9. exported PNG, Letter PDF, and A4 PDF;
10. rendered and opened both PDFs.

Results:

- protected kernel remained `D1-409H-A1`;
- projection warnings remained empty;
- the canonical visual-model digest stayed `996c8bcf6f0ce0b367a880eaa53840f7ca3787fab88acf28696ddc9f63090dcd` across baseline, editor, zoom/panel navigation, reload, and export;
- baseline versus save/reload pixels: **zero changed pixels** after normalized decoding;
- baseline versus generated PNG: **97.706983% perceptual similarity**; remaining difference is expected rasterization/scale antialiasing;
- baseline versus previously accepted D1-411B artifact: **97.596836% perceptual similarity**;
- no browser errors occurred;
- the state-document digest changed only because editor panel/viewport state is persisted; the protected visual model did not change.

## Opened artifact review

The PNG, Letter PDF, and A4 PDF all visibly preserve the accepted denim background, title plaque, year axis and FUTURE segment, seven-event chronology, event arrows and dates, five-row Color Key, profile card, paper/board textures, typography, relative scale, and object placement. The PDFs add only the expected white page margins required to place a 16:9 composition without stretching on Letter and A4 landscape pages.

The viewport captures `02_CANONICAL_EDITOR_ENTRY_NO_EDITS.png` and `04_CANONICAL_EXPORT_PREVIEW.png` are intentionally clipped to the iframe viewport and are not pixel-diff references. Their full-UI companions show the visible editor/export screen. The actual full-composition references are the baseline, reload, and exported PNG/PDF artifacts.

## Hard-gate answers

1. **Cause:** mutated test data and presentation overrides only; no default/product renderer drift found.
2. **Canonical source:** D1-409H-A1 files and hashes listed above.
3. **Before editor:** `canonical-baseline/01_CANONICAL_BASELINE_BEFORE_EDITOR.png`.
4. **Editor, no changes:** `canonical-baseline/02A_CANONICAL_EDITOR_ENTRY_NO_EDITS_FULL_UI.png`.
5. **After save/reload/Matrix return:** `canonical-baseline/03_CANONICAL_AFTER_SAVE_RELOAD_MATRIX_RETURN.png`.
6. **Opened PNG:** `canonical-baseline/05_CANONICAL_EXPORT_1920x1080.png`.
7. **Opened Letter PDF:** `canonical-baseline/06_CANONICAL_EXPORT_LETTER.pdf`; rendered review under `canonical-baseline/rendered/`.
8. **Opened A4 PDF:** `canonical-baseline/07_CANONICAL_EXPORT_A4.pdf`; rendered review under `canonical-baseline/rendered/`.
9. **Visual diff:** model digest unchanged; reload pixel-identical; generated PNG and accepted comparator both exceed 97.5% normalized similarity.
10. **Differences:** viewport clipping in editor/export evidence, format-scale antialiasing, and legitimate PDF page margins only. No composition drift.
11. **Production student risk:** no systemic risk found. Existing intentional user overrides remain user-owned by design; they are not silently propagated to other documents.
12. **Prior PASS disposition:** the earlier *canonical visual-fidelity inference* from the distorted canary was reopened and replaced by this clean-fixture evidence. Interaction tests performed on that canary remain valid torture-fixture evidence. PNG/PDF canonical fidelity is reclosed by this gate.

## Production binding

The live route loaded successfully in authenticated Chrome with administrator access, protected kernel `D1-409H-A1`, app asset token `745937a8bdf7`, no browser warnings/errors, and the visibly mutated `Brian RC1 Canary`. The local immutable app bundle SHA-256 is `745937a8bdf7bb522af520cfb45794b6032142d2924c3c9e15b6d73d34888134`, binding the clean roundtrip to the deployed asset identity. Creating a second live document was intentionally avoided because the UI offered only `Start over`, which would overwrite the preserved torture fixture. The clean fixture therefore ran in an isolated fresh browser profile against the same immutable release source.

## Production action

No deployment, data mutation, feature-gate change, or rollback is required. Continue to preserve the live canary as debugging evidence and use the canonical fixture for all future visual acceptance.
