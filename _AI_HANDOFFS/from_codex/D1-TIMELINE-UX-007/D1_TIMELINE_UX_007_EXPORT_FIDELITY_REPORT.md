# D1 Timeline UX-007 — Export Fidelity Report

The production-like browser candidate used the same protected kernel for editor, export preview, PNG, Letter PDF, and A4 PDF. Editor and export receipts independently reported the same gradient background, six Advanced objects, direct-edited text, MissionMed wordmark, and US flag with zero console errors.

Opened artifacts:

- `local-browser/RC1_TIMELINE_1920x1080.png`: visually inspected full composition; background, paper texture, fonts, axis, events, profile card, Color Key, and Advanced objects present without clipping or collisions.
- `local-browser/RC1_TIMELINE_LETTER.pdf`: rendered/opened; one page, 792×612 pt, 922,895 bytes; no clipping, collision, missing texture, or missing font.
- `local-browser/RC1_TIMELINE_A4.pdf`: rendered/opened; one page, 841.89×595.28 pt, 922,936 bytes; no clipping, collision, missing texture, or missing font.

This is exact-candidate local evidence. Live post-cutover downloads must still be opened and compared before production PASS.
