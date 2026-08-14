# D1-405 Acceptance Ledger

Status date: 2026-07-31

Overall estimated completion: 94%

`PASS TO DATE` means the criterion passes at the M11 checkpoint but remains
subject to the final M12/M13 regression gate. `PENDING` means its assigned
milestone has not yet completed.

| # | Acceptance criterion | Status | Evidence / next milestone |
|---|---|---|---|
| 1 | D1-404 remains the direct implementation base; no parallel app or shell | PASS | Canonical 407F `web/index.html`; in-place commits |
| 2 | Existing D1-404 functionality remains operational | PASS TO DATE | 540/540 tests |
| 3 | Required MissionMed branding | PASS | M1 |
| 4 | Exactly four primary destinations remain | SUPERSEDED / PASS | Later Founder steering explicitly adds Media; active order is Home, Builder, Edit Timeline, Media, Export |
| 5 | Canvas founder label replaced after ten-option evaluation | PASS | Edit Timeline |
| 6 | Home composition remains recognizable and strong | PASS | M2 |
| 7 | File Vault faster-start priority and conversational explanation | PASS | M2 |
| 8 | Local upload is secondary | PASS | M2 |
| 9 | Latest timeline populated/empty states are accurate | PASS | M2 |
| 10 | Premium horizontal seven-step navigator | PASS | M3 plus Founder visual refinement; Miyamoto PASS |
| 11 | Builder uses space efficiently without crowding | PASS | One-column editor plus larger right preview |
| 12 | Preview preserves artifact proportions | PASS | 1920×1080, 16:9 |
| 13 | Preview elements route to owning editor | PASS | M4 |
| 14 | Keyboard/full-preview element editing | PASS | M4 |
| 15 | Appropriate accessible calendar controls | PASS | M5 |
| 16 | Normalized searchable medical-school registry | PASS | M6 |
| 17 | Aliases, country, and U.S. MD/DO facets | PASS | M6 |
| 18 | Canonical medical-school IDs persist | PASS | M6 |
| 19 | Redundant degree-name field removed except conditional Other | PASS | M6 regression |
| 20 | Conditional visa/work authorization | PASS | M6 |
| 21 | Exam score required when applicable | PASS | M7 |
| 22 | Rotations use exact dates and normalized specialties | PASS | M7 |
| 23 | Common specialties pinned as specified | PASS | M7 |
| 24 | Rotation LOR status is specialty-aware | PASS | M7 |
| 25 | Submitted LOR star appears on artifact and legend | PASS | M7; all five themes |
| 26 | Truthful LOR Builder integration seam | PASS | M7; local queue, `productionCreated:false` |
| 27 | Specialty variants share factual history | PASS | M8 normalized presentation configuration; no event duplication |
| 28 | Work, Research, Personal retain quality | PASS TO DATE | Retained workflows; final M12 regression pending |
| 29 | Explanation annotations are editable/exportable | PASS | Bounded Builder create/edit/move/resize/delete; leader line; active preview and Export |
| 30 | Interview target and logo workflow function locally | PASS | General/specific mode; program details; shared local WEBP upload; contain/crop, resize, placement, remove/replace; live full-preview proof |
| 31 | Matrix Calendar seam is activation-ready without live claim | PASS | `Scheduled Interviews` adapter contract; runtime truthfully unavailable; fixtures local-only |
| 32 | Theme previews work with/without student data | PASS | Student content or labeled example through the same renderer; live screenshots |
| 33 | Safe extensible theme registry | PASS | Structured versioned package, compatibility, permission and asset boundaries, fallback; no executable content |
| 34 | Explicit export audience options replace Everything | PASS | Interview-safe, LOR writer, Professional connection, Mission Residency alumni connection |
| 35 | Deterministic audience visibility rules | PASS | Explicit audience scopes; hidden/student-only never included; preview/download share one input |
| 36 | Entitlement limit/override states | PASS | Administrator, 360, explicit override, cohort, promotion, zero, numeric, unlimited, expiry, removal, disabled, production fail-closed |
| 37 | Existing D1-404 documents migrate without data loss | PASS | Pure/idempotent additive migration; sentinel-rich IDs, geometry, unknowns, themes, Advanced, advisor, specialty/interview, history, versions, Export |
| 38 | Undo, autosave, history, versions, export, advisor remain intact | PASS TO DATE | 540/540 regression gate; direct writes guarded; pre-expiry concurrency preserved |
| 39 | Accessibility passes modified routes | PASS TO DATE | Final M11 Vitruvius PASS after read-only preview, History, focus, and dynamic-control hardening |
| 40 | Responsive exact-boundary behavior passes | PASS TO DATE | Current modified routes pass; final M12 gate pending |
| 41 | Fresh browser console is clean | PASS TO DATE | Zero errors in fresh M11 removed-access session |
| 42 | Full test suite passes | PASS TO DATE | 540/540 |
| 43 | Typecheck passes | PASS | `npm run typecheck` |
| 44 | Package verification passes | PASS | 23/23 |
| 45 | Deterministic build passes | PASS | 198 files; manifest `7242f0fb...cf0b` |
| 46 | No protected external mutation occurred | PASS TO DATE | No push/deploy/Matrix/WordPress/production write |
| 47 | One local review URL | PASS | `http://localhost:8793/web/` |
| 48 | Progress screenshots shown | PASS TO DATE | M0–M11 evidence |
| 49 | Updates include honest completion percentage | PASS TO DATE | Current 94% |
| 50 | Automatic continuation unless Founder objects | PASS TO DATE | Active execution loop |
| 51 | No out-of-scope feature/design concept | PASS TO DATE | Authority-bound milestone reviews |
