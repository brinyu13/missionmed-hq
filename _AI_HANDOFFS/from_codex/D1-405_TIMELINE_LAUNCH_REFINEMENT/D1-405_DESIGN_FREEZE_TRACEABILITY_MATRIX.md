# D1-405 Design Freeze Traceability Matrix

Status: in progress through M8

Canonical baseline: 407F / D1-404

| Authority / requirement | Implementation trace | Verification trace | Status |
|---|---|---|---|
| Preserve 407F; no replacement shell | `web/index.html`, `407f-engineering-adapter.js` | D1-404 authority and recovery tests | PASS |
| D1-UXR-002-CONTRAST-ADDENDUM-001 | Gold remains `#B98A2E`; normal text/icons on gold use `#191C21` | `npm run verify`; contrast regressions | PASS |
| D1-UXR-002-CONTRAST-ADDENDUM-002 | 11px/650 shell/white micro-labels use `#565D66`; tertiary retained for non-text/decorative use | `npm run verify`; candidate contrast tests | PASS |
| D1-UXR-002 IMPLEMENTATION AUTHORITY ADDENDUM 001 | Autonomous token/typography/focus adjustments are recorded with reason, contrast, and affected components | Implementation and Accessibility reports | PASS TO DATE |
| MissionMed branding and Edit Timeline label | M1 active header/rail | M1 browser and source tests | PASS |
| File Vault-first Home | M2 Home/chooser | M2 browser/module tests | PASS |
| Horizontal seven-step Builder | M3 navigator | Keyboard, tab-state, responsive tests | PASS |
| Founder premium stepper refinement | `407f-upgrade.css` layered/tactile state treatment | M7 screenshot; Miyamoto final PASS | PASS |
| One primary Builder column and larger right preview | D1-405 Builder grid and 16:9 preview | M3/M4 screenshots and proportionality tests | PASS |
| Founder Media destination | Active five-item route authority | Media navigation tests | PASS |
| Shared local Media architecture | `document.advanced.media`, IndexedDB blobs, shared drawer/drop seam | 13/13 Media suite; no duplicate blob/record | PASS |
| Scored pass/fail requires score | Exam workflow/integration | M7 exam tests and browser validation | PASS |
| Pinned normalized specialties | `specialty-taxonomy.js` | Specialty suite and browser menu capture | PASS |
| Exact rotation days | Shared exact-date control plus month projection | Date suite and persisted browser save | PASS |
| Rotation-specific specialty-aware LOR | `rotation-lor.js`; adapter target-keyed records | LOR suite and restart probe | PASS |
| Submitted LOR star and exact legend text | `board-renderer.js` | Five-theme serialization and browser screenshots | PASS |
| Truthful LOR Builder seam | Local queue adapter; `productionCreated:false` | Queue tests and browser announcement | PASS |
| M7 autonomous LOR micro-label adjustment | Undefined/body white → 11px/650 `#75CFEA` on dark card | 9.7573:1 and 10.9957:1; Miyamoto PASS | PASS |
| Target-specialty variants over shared facts | `specialty-variants.js`; prominent Builder variant bar; active Canvas/export projection | 7 M8 variant tests; browser create/switch proof | PASS |
| Variant create/switch/rename/remove safeguards | TimelineStore mutations plus last-variant and explicit-confirmation guards | Full 504/504 suite; creation screenshot | PASS |
| Specialty-specific visibility without privacy elevation | Variant stores hidden event IDs only; factual visibility remains canonical | Nonmutating projection regression | PASS |
| Active-specialty LOR presentation | Existing target-keyed LOR records consume active variant ID | IM/Pediatrics browser star comparison | PASS |
| No protected writes | Local worktree only | Git/status and browser evidence | PASS TO DATE |

The later Founder Media steering supersedes the original four-destination
acceptance row only to add `Media`; it does not authorize any other navigation
or workflow reinterpretation.
