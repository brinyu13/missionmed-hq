# Independent non-builder review — founder curation patch 329f458 (2026-10-06)

Reviewer: separate agent session (fresh context, no builder history), own Playwright run against the candidate build at 1366/790/390 px plus WebFetch of manufacturer pages. Builder: Claude Foreman session. Conditions 1, 2, 3, 5 and 6 were closed in commit cb05add; condition 4 is a Founder gate.

## Verdict: APPROVE WITH CONDITIONS (do not deploy until conditions 1–4 are closed)

The structural change is sound and preserves the accepted release: row-0 primaries unchanged, kit identifiers unchanged, any-two comparison works across rows, Prime Day picks unchanged, MV7+ and SM7B both retained (no substitution), zero console errors, no prices/ratings/counts anywhere. What is not ready is the content: two verifiable factual errors in new product copy, two products whose "source" link is an untagged Amazon URL mislabeled as a manufacturer page, and a governance gap (builder-asserted "founder-curation" for items the Founder listed as proposed, including two that were held two days ago on the rating gate).

### Findings, by severity

- HIGH — Sony α7S III chain lists a micro-HDMI cable; the ILCE-7SM3 has a full-size Type-A HDMI port. → closed (cb05add)
- HIGH — Elgato Facecam 4K copy claims manual focus in Camera Hub; the camera is fixed-focus (elgato.com). → closed (cb05add)
- MEDIUM — EMEET S600 and NEEWER softbox `source` were untagged Amazon URLs rendered as manufacturer links (attribution leak + mislabel). → closed: source=null, tagged Amazon link only; qa.py enforces non-Amazon source or recorded sourcePolicy.
- MEDIUM — Proposed ≠ verified: MX Brio (B0BFJ4CRKD) and Key Light Air MK.2 (B0GYDFGCCQ) were held 2026-10-04 on the 4.5 rating threshold; the patch includes them on builder-asserted "founder-curation" with no rating re-pass. → OPEN: Founder sign-off required (condition 4).
- MEDIUM — Key Light Air MK.2 copy said "desk stand"; manufacturer page describes a clamp-on desk mount; box contents assumed. → closed.
- LOW — Blue Yeti evidence entry inconsistent (not re-read but stamped as read). → closed.
- LOW — Unhedged relative-price orderings. → closed (hedged "usually").
- LOW — `.tier-empty` hide breakpoint 760px vs deck strip 819px; empty card visible at 790px. → closed (819px).
- LOW — "Option 2/3" ordinal within a class could read as ranking. → closed ("Also in class").
- NOTE — Wave:3 MK.2 and Key Light Air MK.2 use shared elgato.com URLs that now describe the MK.2 models; SKU recorded for Wave:3 MK.2 (10MAO9901).

### Code review (verified by reading the patch and the served bundle)
completion.js override block additive and correct (row 0 = catalog order primaries; anchors exist; bindTierDeck handles all decks; renderPrimeDay unchanged). No whitespace-preceded uppercase `${Name.` bare identifiers introduced (delivery sanitizer risk). src.html kit toggle resolves exact key; stale keys fall through to removal as before. Comparison ids index-based and stable; DJI remains alternative:0. Cam Link 4K reuse in the chain is the same product, not identity reuse.

### Verified by reviewer vs. builder evidence
Verified: card counts/names on webcam/mic/light, row-0 primaries, kit keys, kit save and kit page, any-two compare across rows, Prime Day picks, affiliate tag on all shoppingAmazon links, untagged source links (pre-fix), zero console/page errors, no $/rating strings, empty-card visibility per breakpoint, Facecam 4K fixed focus, α7S III Type-A HDMI, Wave:3 MK.2 and Key Light Air MK.2 page content. Builder evidence only: experts count, mobile row-2 screenshot, Amazon listing titles/availability/sellers in the evidence JSON.
