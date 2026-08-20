# D1-TIMELINE-CODEX-FINAL-012A — Canonical visual finding

## Verdict

The accepted Timeline presentation is still the protected **D1-409H-A1 / 407G Preview 6** 1920×1080 landscape board. Its sealed HTML, CSS, amended JavaScript, and denim background hashes match authority. The clean current renderer and PNG export retain the denim background, title plaque, year axis, protected Color Key, profile card, typography, and composition geometry.

The Founder-visible white/sparse result was not the golden visual. It was the deliberately mutated **Brian RC1 Canary** / torture document, which carries explicit Advanced Studio background and furniture overrides. It is valid adversarial data but must never be used as the presentation-authority fixture.

A separate real UI defect made the Export surface appear incomplete or wrongly oriented: the intrinsic 1920px kernel established the grid item's min-content width, while the preview panel clipped overflow. The exported bytes were correct, but the visible preview could show only the left portion of the board.

## Bounded repair

Only `packages/mission-timeline/web/styles/407f-upgrade.css` was changed in this lane. The Export preview panel, content wrapper, and kernel host now explicitly permit shrinking within the responsive grid track (`min-width: 0`, `width: 100%`, and `max-width: 100%`). No renderer, protected presentation byte, student data, fixture data, persistence, infrastructure, or production system was changed.

Before the repair, clean-fixture Export-preview similarity to the same-render baseline was **0.44847222** because the browser capture was clipped. After the repair it is **0.96418017** and the full UI visibly contains the complete landscape board. The downloaded 1920×1080 PNG is **0.9771412** similar to the same-render baseline at the established threshold; baseline versus post-reload is exactly **1.0**. Browser errors: **0**.

## Deterministic authority fingerprint

- Founder evidence: `/Users/brianb/Downloads/D1-409H_EVIDENCE/01_full_board.jpg`
- Founder evidence SHA-256: `08590cf374a363879d8311053a8854e641a22cbf433020f25a372411ba889bff`
- Accepted denim: `/Users/brianb/Downloads/D1-409H_VISUAL_MASTER_PACKAGE/assets/tex/board_denim.jpg`
- Accepted denim SHA-256: `9ac898468cf2844247d1c4285565f95341a1c62b45d244d8ffd753e30b87ae75`
- Protected HTML SHA-256: `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`
- Protected CSS SHA-256: `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`
- Protected amended JavaScript SHA-256: `ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32`
- Clean-fixture normalized visual digest: `0d116e2617a66cf30a8bc0c561748b348d6cde12d1d44bfe69e6d9aefaed43f2`

The Founder evidence contains private representative photographs and populated sample content that are intentionally absent from a clean student fixture. Exact screenshot equality against that evidence would therefore produce false failures. The release gate binds protected bytes and required assets, then compares the deterministic clean fixture across preview, reload, and export.

## Verification

- `node --test packages/mission-timeline/tests/d1-final-012a-canonical-visual.test.mjs` — **4/4 PASS**
- Focused current-source Chromium round trip — **PASS**, zero browser errors
- Screen → reload visual comparison — **1.0 similarity**
- Screen → PNG comparison — **0.9771412 similarity**
- Screen → repaired Export preview — **0.96418017 similarity**
- PNG opened and visually inspected — complete 1920×1080 landscape denim board
- Export UI opened and visually inspected — complete board visible; no left-half clipping

The current-source browser receipt, repaired full Export UI, and opened PNG are preserved beside this report. Durable earlier canonical evidence remains under `_AI_HANDOFFS/from_codex/TIMELINE-UX-IMPLEMENTATION-006/`; the JSON fingerprint beside this report contains the release-blocking facts.

## Files in this lane

- `packages/mission-timeline/web/styles/407f-upgrade.css`
- `packages/mission-timeline/tests/d1-final-012a-canonical-visual.test.mjs`
- `packages/mission-timeline/tests/fixtures/d1-409h-canonical-visual-golden.json`
- `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/canonical-visual/CANONICAL_VISUAL_FINGERPRINT.json`
- `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/canonical-visual/CANONICAL_VISUAL_FINDING.md`
- `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/canonical-visual/CANONICAL_ROUNDTRIP_RECEIPT.json`
- `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/canonical-visual/04A_CANONICAL_EXPORT_PREVIEW_FIXED_FULL_UI.png`
- `_AI_HANDOFFS/from_codex/D1-TIMELINE-CODEX-FINAL-012A/canonical-visual/05_CANONICAL_EXPORT_1920x1080.png`

No authority blocker remains in this visual lane. No deployment was performed.
