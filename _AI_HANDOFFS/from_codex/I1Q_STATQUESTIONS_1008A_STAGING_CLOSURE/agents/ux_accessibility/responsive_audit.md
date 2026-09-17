# I1Q-1008A Responsive Audit

## Status

`SIMULATED LOCAL REAL-BROWSER EVIDENCE`

Exact candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

`LOCAL RESPONSIVE MATRIX: PASS`

`RESPONSIVE CERTIFICATION: NOT PROVEN`

The local matrix is clean, including the repaired table routes. Certification remains open for actual browser zoom, supported browsers, real devices, authenticated staging content, assistive technology, and human validation.

## Source Fingerprints

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |

## Matrix Scope

- Workflows: 17.
- Viewports: 11.
- Workflow cells: 187.
- Deterministic states: 16.
- State cells: 176.
- Phone context cells: 68.
- Width-equivalent reflow cells: 34 workflow and 32 state.
- Visual spot checks: 320 by 844 and 1440 by 900.
- Browser console warnings or errors: 0.

## Viewport Results

| Viewport | Workflow cells | Root overflow | Outside non-table content | Clipped controls | AA target failures | Independent table cells |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 320 by 568 | 17 | 0 | 0 | 0 | 0 | 8 |
| 375 by 667 | 17 | 0 | 0 | 0 | 0 | 8 |
| 390 by 844 | 17 | 0 | 0 | 0 | 0 | 7 |
| 430 by 932 | 17 | 0 | 0 | 0 | 0 | 7 |
| 768 by 1024 | 17 | 0 | 0 | 0 | 0 | 6 |
| 1024 by 768 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1280 by 720 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1366 by 768 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1440 by 900 | 17 | 0 | 0 | 0 | 0 | 1 |
| 1728 by 1117 | 17 | 0 | 0 | 0 | 0 | 0 |
| 1920 by 1080 | 17 | 0 | 0 | 0 | 0 | 0 |

Every viewport also had zero H1/title, duplicate-ID, broken-ARIA, refresh-geometry, and Search pagination failures.

## State Matrix

Each of the 16 deterministic states ran at all 11 viewports. Across 176 cells there were zero failures for:

- Expected state rendering.
- Alert or status role.
- Labelled H2.
- Focus on the state H2.
- `aria-busy="false"` completion.
- Root overflow.
- Visible control clipping.
- WCAG 2.2 AA target minimum.
- Duplicate IDs or broken ARIA references.
- Missing recovery action.

This is fixture evidence only. It does not replace natural staging failures.

## Root Overflow Repair

The repair adds `position: relative` to `.table-wrap` at `public/styles.css:516-525`. This makes the wrapper the containing block for absolute `.sr-only` table headers while preserving its independent `overflow-x: auto` scroller.

All targeted routes measured exact root containment:

| Workflow | Width | Viewport / document / body | Table client / scroll | Result |
| --- | ---: | ---: | ---: | --- |
| Corpus inventory | 320 | 320 / 320 / 320 | 256 / 644 | Pass |
| Extraction runs | 320 | 320 / 320 / 320 | 256 / 764 | Pass |
| Search and filters | 320 | 320 / 320 / 320 | 256 / 597 | Pass |
| Audit trail | 320 | 320 / 320 / 320 | 256 / 628 | Pass |
| Corpus inventory | 768 | 768 / 768 / 768 | 444 / 644 | Pass |
| Extraction runs | 768 | 768 / 768 / 768 | 444 / 764 | Pass |
| Search and filters | 768 | 768 / 768 / 768 | 444 / 597 | Pass |
| Audit trail | 768 | 768 / 768 / 768 | 444 / 628 | Pass |

A direct 320-pixel gesture outside the table left `window.scrollX=0`. After moving to the Inventory table, a horizontal gesture produced `table.scrollLeft=300` while root scroll remained zero. The data remains reachable through the intended scroller.

`ROOT OVERFLOW: CLOSED LOCALLY`

## Pagination

Search pagination passed all 11 viewports. Previous measured 82 by 44 and Next measured 56 by 44 at every width. Neither clipped or shrank. Reflow rules are at `public/styles.css:672-689`.

`PAGINATION CLIPPING: CLOSED LOCALLY`

## Mobile Context And Menu

At 320, 375, 390, and 430 pixels:

- Actor identity was visible before workflow content in all 68 workflow cells.
- Environment context was visible in all 68 workflow cells.
- Workflow toggle measured 102 by 44.
- Expanded navigation exposed all 17 items.
- Expanded navigation had zero horizontal clips.
- Root width equaled viewport width while expanded.
- Environment metadata used wrapping flex with 4-pixel row and 8-pixel column gaps.

`MOBILE CONTEXT: CLOSED LOCALLY`

## Identifier Presentation

No `.hash-text` depended on `title`. Full exact revision hashes wrapped without root overflow. Physician review showed the full 64-character SHA-256 at 320 pixels from `public/app.js:1423-1427`.

`TITLE-ONLY OR ABBREVIATED EXACT HASH: CLOSED LOCALLY`

## Width-Equivalent Reflow

The available browser surface did not expose native page zoom. The audit therefore ran a clearly labelled width-equivalent simulation:

| Simulation | CSS width | Workflow cells | State cells | Root, clipping, focus, or ARIA failures |
| --- | ---: | ---: | ---: | ---: |
| 200 percent width equivalent from 1280 | 640 | 17 | 16 | 0 |
| 400 percent width equivalent from 1280 | 320 | 17 | 16 | 0 |

This supports the repaired layout but does not prove WCAG zoom behavior. Native 200 and 400 percent browser zoom must be tested in supported browsers with text resizing, focus, and assistive technology active.

## Visual Inspection

At 320 by 844, the brand, workflow toggle, environment, H1, scenario selector, actor, 44-pixel refresh control, release status, selected context, and first dashboard metric were coherent without horizontal movement or overlap.

At 1440 by 900, the fixed operational hierarchy, sidebar, status, context, dashboard metrics, governance list, and guardrails remained aligned without incoherent overlap.

## Remaining External Gaps

1. Authenticated staging content and real synthetic role states.
2. Native 200 and 400 percent zoom.
3. Safari, Firefox, Edge, standalone Chrome, and real devices.
4. VoiceOver, NVDA, JAWS, magnification, switch, and voice control.
5. Text-spacing overrides, forced colors, and high-contrast modes.
6. Human task completion and comprehension.
7. Large persistent datasets that may change row, identifier, and error lengths.

## Responsive Conclusion

The narrow root-overflow repair works in the complete assigned local matrix. Root overflow, pagination clipping, mobile context, and exact-hash presentation are all closed locally. External certification remains pending.
