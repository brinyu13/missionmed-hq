# Current synthetic acceptance matrix

Source 7e5b6314434ee9b86fb7bb2dc0c55ba278d28b07. Every fixture uses the same 2025 template.16 mechanical passes,4 correct source-review holds; previous phase 6/4/10. No material fact was removed to obtain a pass. No claim of20 visual/sendability passes.

| ID | Case | Events | Export gate | Guardian findings after normal Builder migration | Acceptance limit |
|---|---|---:|---|---|---|
| M01 | normal IMG | 6 | PASS; five actual formats | none mechanically | Four-fixture visual review; founder pending |
| M02 | sparse IMG | 2 | PASS; five actual formats | none mechanically | Four-fixture visual review; founder pending |
| M03 | dense IMG | 24 | PASS; five actual formats | none mechanically | Density caveat; founder pending |
| M04 | 10+ year chronology | 6 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M05 | many rotations | 12 | PASS; five actual formats | COLLISION_RISK | Not individually founder accepted |
| M06 | overlapping clinical/research/work | 3 | PASS; five actual formats | none mechanically | Four-fixture visual review; founder pending |
| M07 | multiple explicit gaps | 4 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M08 | prior residency/training | 4 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M09 | long institution names | 1 | PASS; five actual formats | COLLISION_RISK | Not individually founder accepted |
| M10 | long event titles | 1 | PASS; five actual formats | LONG_EVENT_LABELS | Not individually founder accepted |
| M11 | partial dates | 1 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M12 | unknown dates | 1 | TIMELINE_EXPORT_INCOMPLETE | INVALID_DATE, EVENTS_NOT_RENDERABLE, EXPORT_BLOCKED | Source review hold |
| M13 | conflicting dates | 1 | TIMELINE_EXPORT_INCOMPLETE | END_BEFORE_START, EVENTS_NOT_RENDERABLE, EXPORT_BLOCKED | Source review hold |
| M14 | same-date events | 3 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M15 | multiple explicit exams/attempts | 2 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M16 | late correction/manual overlay | 1 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M17 | minimal source data | 0 | TIMELINE_EXPORT_EMPTY | STUDENT_NAME_MISSING, EMPTY_TIMELINE, EXPORT_BLOCKED | Source review hold |
| M18 | ambiguous source data | 1 | TIMELINE_EXPORT_INCOMPLETE | CATEGORY_REVIEW, INVALID_DATE, EVENTS_NOT_RENDERABLE, EXPORT_BLOCKED | Source review hold |
| M19 | nontraditional pathway | 5 | PASS; five actual formats | none mechanically | Not individually founder accepted |
| M20 | extreme legitimate density | 46 | PASS; five actual formats | EXCESSIVE_DENSITY | NOT SENDABLE; more technical work |

Five advertised formats:1920×1080PNG,2560×1440PNG,LetterPDF,A4PDF,editablePPTX. Diagnostic SVG/PNG for blocked cases are not final exports. Final receipt and exact hashes in ARTIFACT_MANIFEST.json, root /Users/brianb/MissionMed_worktrees/timeline-astra6-recovery-20261002/.timeline-recovery-20261002/founder-decisions-20261003.

All20 Builder-migrated SVGs match raw fixture SVGs byte-for-byte. Raw minimal fixtures omit schema categories/background and produce artificial format findings; these are preserved in raw-minimal-fixture-quality.json and are not reported as actual Builder state. Normalized findings are in final-matrix-quality.json.

Additional G4 tests preserve multiple source-linked school spans/year precision. Media privacy covers12 canonical/legacy cases plus explicit LOR sharing. Stored-media resolution and failed-image negative tests coverPNG/PDF/PPTX. Full suite 348 TS + 1249 JS; typecheck/localbuild pass. Prior actual PDF intake/consent/9-event save/reload and real PostgreSQL/RLS evidence retained, not rerun this phase.

All four current PPTXs inspected in Keynote. M03 edit/restore/save/reopen;M01/M06 reopen;M02 reopen not verified. Both PDF sizes independently rendered/inspected for the four. Native PowerPoint/live authenticated roles remain unverified.
