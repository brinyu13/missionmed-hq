# I1Q-1008A Responsive

## Verdict

`LOCAL RESPONSIVE MATRIX: PASS`

`RESPONSIVE CERTIFICATION: NOT PROVEN`

Exact product candidate: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`.

## Viewports

The 17-workflow matrix passed at:

- 320 by 568
- 375 by 667
- 390 by 844
- 430 by 932
- 768 by 1024
- 1024 by 768
- 1280 by 720
- 1366 by 768
- 1440 by 900
- 1728 by 1117
- 1920 by 1080

All 187 workflow cells and all 176 deterministic-state cells had zero page-root overflow, non-table outside content, clipped controls, target-size failures, duplicate IDs, broken ARIA references, refresh-geometry failures, or pagination failures.

## Repaired Table Boundary

The exact root-overflow cause was an absolute visually hidden table header whose containing block escaped the independent table scroller. `.table-wrap` now establishes the positioning context while retaining `overflow-x: auto`.

The four previously failing workflows passed at both 320 and 768 pixels:

| Workflow | 320 root | 768 root | Table scrolling |
| --- | --- | --- | --- |
| Corpus inventory | 320 of 320 | 768 of 768 | Preserved |
| Extraction runs | 320 of 320 | 768 of 768 | Preserved |
| Search and filters | 320 of 320 | 768 of 768 | Preserved |
| Audit trail | 320 of 320 | 768 of 768 | Preserved |

A direct gesture outside the table left root scroll at zero. A gesture inside the Inventory table moved its scroll position to 300 while root scroll remained zero.

## Other Closed Findings

- Pagination labels remained visible and controls remained 44 pixels high at every viewport.
- Actor and environment context remained visible in all 68 phone workflow cells.
- The expanded phone workflow menu exposed all 17 destinations with zero horizontal clipping.
- Exact revision hashes rendered all 64 characters and wrapped at 320 pixels.
- Mobile environment metadata retained explicit 4-pixel row and 8-pixel column gaps.
- Width-equivalent 200 and 400 percent reflow simulations passed 66 cells with zero failures.

## External Gate

Native zoom, Safari, Firefox, Edge, standalone Chrome, real devices, assistive technology, authenticated staging content, large persistent datasets, and human validation remain untested. The local matrix closes the measured source defect; it does not establish cross-browser or production certification.
