# D1-405 Design Freeze Traceability Matrix

Status: in progress through M10

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
| Preserve five themes and Advanced Studio | Frozen `THEME_DEFINITIONS`; unchanged catalog and mode behavior | Theme catalog and Canvas integration regressions | PASS |
| Student-content theme previews | Active document serialized through canonical renderer | Student-content theme screenshot and integration tests | PASS |
| Empty-account theme previews | Frozen example document, visible/accessibility `EXAMPLE TIMELINE` labels, same renderer | Empty-origin browser screenshot and M10 theme tests | PASS |
| Future admin theme package | `admin-theme-registry.js`; structured schema, compatibility, versioning, permission, approved assets, fallback | `d1-405-admin-theme-registry.test.mjs`; future package document | PASS |
| No arbitrary CSS/JS theme uploader | Executable keys/values and unapproved assets rejected; no production admin backend | Package-boundary tests | PASS |
| Interview-safe default | `DEFAULT_EXPORT_AUDIENCE="INTERVIEWER_SAFE"` | Export unit/integration/browser checks | PASS |
| Four explicit export audiences | Interview-safe, LOR writer, Professional connection, Mission Residency alumni connection | Export DOM screenshot set and tests | PASS |
| Required recipient context | Progressive audience-specific fields; export action gated until complete | Render/model/request tests | PASS |
| Missing-name export prevention | Non-empty unnamed timelines expose inline status and keep Export disabled | Model/render regression and live gate | PASS |
| Deterministic audience visibility | Baseline safe/full-story; advisor-only requires exact scope; hidden/student-only excluded | Four-audience deterministic fixture test | PASS |
| Recipient-scope authoring | Canvas Details writes the three explicit scopes to shared `event.fields.exportAudiences` | Adapter integration regression | PASS |
| Preview/download parity | One filtered object serves `previewInput` and `renderInput` | Identity assertion and local adapter tests | PASS |
| Theme and recipient focus continuity | Canvas picker focus/restoration; trapped Export modal; audience-selector restoration; in-place recipient updates | Source regressions and live keyboard checks | PASS |
| Empty-example conditional legend | Example clinical event includes submitted LOR and every theme miniature serializes `data-lor-legend` | Five-theme example regression | PASS |
| M10 autonomous dark-surface micro-label alias | `#A9B7D0` instead of light-shell `#565D66` on dark 407F fields | 8.3411:1–9.3335:1 evidence | PASS |
| M7 autonomous LOR micro-label adjustment | Undefined/body white → 11px/650 `#75CFEA` on dark card | 9.7573:1 and 10.9957:1; Miyamoto PASS | PASS |
| Target-specialty variants over shared facts | `specialty-variants.js`; prominent Builder variant bar; active Canvas/export projection | 7 M8 variant tests; browser create/switch proof | PASS |
| Variant create/switch/rename/remove safeguards | TimelineStore mutations plus last-variant and explicit-confirmation guards | Full 511/511 suite; creation screenshot | PASS |
| Specialty-specific visibility without privacy elevation | Variant stores hidden event IDs only; factual visibility remains canonical | Nonmutating projection regression | PASS |
| Active-specialty LOR presentation | Existing target-keyed LOR records consume active variant ID | IM/Pediatrics browser star comparison | PASS |
| Bounded Explanation annotations | `explanation.js`; Step 7 controlled authoring; canonical event/history/export path | Create/edit/move/resize/delete, four target kinds, leader, live preview and Export tests | PASS |
| Explanation accessibility and theme treatment | Conditional hidden/disabled panels, Coordinate X/Y, inline errors, light-on-dark card text | Live semantics/focus probes; 16.5528:1 contrast; Vitruvius PASS | PASS |
| General versus specific Interview Target | Active variant mode/program/specialty/date/location/label | Unit projection plus live Builder/full-preview/Export evidence | PASS |
| Shared local program-logo workflow | Active variant references one `document.advanced.media` asset and retained blob | Real WEBP upload, persistence, crop/resize, one Guided render layer | PASS |
| Truthful Matrix Calendar seam | `Scheduled Interviews` unavailable runtime adapter and local-only fixture adapter | Status/live/empty/category contract tests; unavailable browser card | PASS |
| M9 autonomous control/error adjustments | Gold selection, cyan picker/focus, `#FF9F86` inline alert, focus recovery | 5.5364:1, 10.5102:1, 9.3466:1; specialist final PASS | PASS |
| No protected writes | Local worktree only | Git/status and browser evidence | PASS TO DATE |

The later Founder Media steering supersedes the original four-destination
acceptance row only to add `Media`; it does not authorize any other navigation
or workflow reinterpretation.
