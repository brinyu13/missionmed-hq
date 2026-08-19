# 11 — Final Status

## RESULT: PARTIAL

Substantial, verified engineering repair of the Founder-observed failures. **No production
deployment**, blocked on two Founder-only gates. I am not claiming COMPLETE, because the
live student experience has not been proven live and several release-relevant defects remain
open.

## Acceptance matrix — honest scoring

Legend: **PASS** = verified by me this run · **FIXED (local)** = repaired and verified
locally, not proven in production · **FAIL** = confirmed still broken · **UNPROVEN** = not
testable without a live authenticated session.

| Item | Status |
|---|---|
| Canonical Timeline loads correctly | FIXED (local) |
| Default background always present | FIXED (local) — but see B-01 asset risk |
| Sparse / Dense Timeline visually clean | FIXED (local), proven across 5 densities |
| No renderer crash | FIXED (local) — OBJECT_OUT_OF_BOUNDS and furniture collisions no longer fatal |
| No internal error language exposed | **FAIL** (E-04/E-05/E-06) |
| Drag / resize / aspect lock / multi-select / group / ungroup | PASS (pre-existing, verified in code) |
| Text-container resizing/reflow | Partial — auto-fit works; **alignment FAIL** (A4) |
| Inline text editing | PASS |
| Left/right/center text alignment | **FAIL** (A4) |
| Layers front/back | PASS |
| Asset click-to-add / drag-to-canvas | PASS for built-ins; **FAIL** for uploads/text/shapes (A10) |
| Uploaded thumbnails constrained | FIXED (A3) |
| Undo / redo | PASS |
| Snap guides | PASS |
| Zoom +/− | PASS |
| Custom percentage zoom | FIXED (A2) |
| Keyboard zoom shortcuts | **FAIL** (A7) |
| Zoom does not remount/blank Timeline | PASS |
| Preview keeps last-good render | **FAIL** (E-01/E-08) — §12 not implemented |
| Save/sync truthful | FIXED (D-02) |
| Reload persistence / cross-device | UNPROVEN |
| CV upload works | UNPROVEN live; parser verified locally |
| File Vault CV selection | **FAIL** (D-01, dead in production) |
| CV dates extracted | FIXED (C-01), verified by execution |
| CV semantic categories accurate | FIXED (C-02, C-03), verified by execution |
| High-confidence auto-prefill / minimal questioning | **FAIL** (C-09 — confidence drives no UI behaviour) |
| Accepted entries materially populate Timeline | UNPROVEN |
| AI quality review available | **FAIL** (C-06 — computed server-side, discarded by client) |
| Media upload / reload / delete | UNPROVEN; D-04, D-07 confirmed broken |
| PNG / Letter PDF / A4 PDF visually clean | **PASS** — 25 artifacts opened and inspected |
| No export text collisions | PASS across 5 densities (1 residual same-row overlap in the most extreme case) |
| No missing background in export | PASS |
| Matrix round trip | UNPROVEN |
| Production console clean | Locally 0 errors across all export journeys; **moment/wp bug root-caused — see below** |
| Eligible student PASS / unauthorized denied / API bypass denied | UNPROVEN (no live session) |
| Rollback ready | Partially — F-07 tooling gap must be closed first |

## The moment/wp console bug — root cause

**F-04: there is no `moment` or `wp.*` consumer anywhere in the Timeline package or either
of its WordPress plugins, and `/timeline/` never renders `wp_head`.** The errors the Founder
saw therefore **cannot originate from Timeline**; they come from another WordPress surface
(most likely the member dashboard the Timeline route redirects through). The correct next
step is to reproduce them with the browser console filtered by initiator URL and fix them at
their real source — not to suppress anything in Timeline.

A genuine adjacent defect *was* found: **F-05** — `matrix-launch.js` is injected twice on the
Matrix page with two different `?ver` values, so the browser downloads and executes two
copies.

## What changed

Source commit **`b8b871d`** (baseline `e0c87ce`), 16 files, +513/−35. Protected D1-409H
bytes untouched — all three hashes verified. Regression **714/714**, typecheck clean.

17 confirmed defects fixed: 4 renderer/layout blockers, the milestone-flag jumble behind the
Founder's export complaint, 3 CV-intelligence blockers, 4 editor defects, save-state
truthfulness, and 2 security leaks.

## What I would do next, in order

1. **Verify the 38 accepted assets resolve in production** (B-01/F-01). Five minutes, and it
   is the difference between "works" and "every timeline is blank".
2. **Fix B-03** — give `TEXT_FIT_UNRESOLVED` a fail-soft path so the Home preview stops
   dying, then re-check Home.
3. **Implement §12 properly** (E-01/E-02/E-08) — last-good render retention with a subtle
   overlay. This is what makes the product *feel* reliable.
4. **Wire C-06** — the AI quality review already exists server-side and is thrown away.
   Cheapest large win in the product.
5. **C-09** — make confidence actually drive prefill/confirm/ask behaviour.
6. **D-01** — stop forging a SERVICE principal, then the File Vault journey can be enabled.
7. Then, and only then, the production sequence in `09_PRODUCTION_DEPLOYMENT_RECEIPT.md`.

## Founder actions required (nobody else can do these)

- Authorize deletion of exactly one Kinsta backup so the mandatory pre-deploy backup can be
  created.
- Install the four `TIMELINE_AI_*` variables in Railway (all four together; partial
  configuration stops startup).
- Provide an authenticated production session for canary, persona and live-journey testing.
