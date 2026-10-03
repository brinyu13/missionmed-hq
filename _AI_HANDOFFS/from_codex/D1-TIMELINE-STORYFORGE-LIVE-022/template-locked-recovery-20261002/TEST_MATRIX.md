# Synthetic acceptance matrix

Every case uses the same hash-pinned2025 Founder template. A technical gate pass is not sendability. Latest completed browser export batch binds 3ab692393505c0cb64a7faddd9e3730b50300367. See final-artifact-batch-binding.json and ARTIFACT_MANIFEST.json in the local evidence directory.

| ID | Required case | Events | Mechanical export outcome | Product acceptance |
|---|---|---:|---|---|
| M01 | normal IMG | 6 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M02 | sparse IMG | 2 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M03 | dense IMG | 24 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M04 | 10+ year chronology | 6 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M05 | many rotations | 12 | PASS — five actual formats generated | NOT ACCEPTED |
| M06 | overlapping clinical research and work | 3 | TIMELINE_EXPORT_TEXT_COLLISION | NOT ACCEPTED |
| M07 | multiple explicit gaps | 4 | PASS — five actual formats generated | NOT ACCEPTED |
| M08 | prior residency training | 4 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M09 | long institution names | 1 | PASS — five actual formats generated | NOT ACCEPTED |
| M10 | long event titles | 1 | PASS — five actual formats generated | NOT ACCEPTED |
| M11 | partial dates | 1 | PASS — five actual formats generated | NOT ACCEPTED |
| M12 | unknown dates | 1 | TIMELINE_EXPORT_INCOMPLETE | Correctly held for human review; not export-ready |
| M13 | conflicting dates | 1 | TIMELINE_EXPORT_INCOMPLETE | Correctly held for human review; not export-ready |
| M14 | same-date events | 3 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M15 | multiple explicit exam attempts | 2 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M16 | late correction with manual overlay | 1 | PASS — five actual formats generated | NOT ACCEPTED |
| M17 | minimal source data | 0 | TIMELINE_EXPORT_EMPTY | Correctly held for human review; not export-ready |
| M18 | ambiguous source data | 1 | TIMELINE_EXPORT_INCOMPLETE | Correctly held for human review; not export-ready |
| M19 | nontraditional pathway | 5 | TIMELINE_EXPORT_MISSING_FIELDS | NOT ACCEPTED |
| M20 | extreme legitimate density | 46 | TIMELINE_EXPORT_TEXT_OVERFLOW | NOT ACCEPTED |

Six fixtures currently pass the mechanical export gate: M05/M07/M09/M10/M11/M16. Four inputs are correctly held for missing/conflicting/ambiguous source facts. Ten require mapping/layout work. All 20 diagnostic PNG/SVG files exist. Actual exporter generates1920/2560 PNG, editablePPTX, Letter/A4 PDF only for gate-passing cases. Older files for now-blocked cases are historical, not accepted.

M03 has zero measured material collisions after unequal-year spacing, but still blocks milestone institution omissions; it is not visually polished enough to certify. M20 remains overflow/occlusion blocked. M06 remains color-key occlusion blocked; M14 has same-date marker collisions behind its first missing-field gate. No source labels, dates or institutions were deleted to make this matrix pass.

Coverage beyond composition: long600-character token; shared cache document/owner/viewer/subject/audience isolation; scene-only object recovery; manual lane/axis preservation; per-field coverage; paint-order occlusion; non-USA flags; unknown precision; profile consent/conflicts; source PDF extraction; local browser save/reopen; real disposable PostgreSQL RLS and71 admin-workflow assertions. Actual synthetic PDF browser import/profile consent/category review/9-event acceptance/local IndexedDB reload passed. Final authenticated production flows and PowerPoint remain unverified. M09 actual Keynote edit/save/reopen passed; this is not all-fixture native acceptance.
