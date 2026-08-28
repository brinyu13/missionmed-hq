# Provenance and Rights Projection

Field-level publication classes:

- `RIGHTS_SAFE`: bounded HRSA THCGME factual projection only — 26 program-specialty identities, 104 source-labeled claims.
- `INTERNAL_ONLY`: all 196 fields in the current FREIDA-derived canonical workbook, including identity, location, program URL/type/status, ACGME/NRMP identifiers, leadership, requirements, statistics, resident composition, narrative, MissionMed enrichment, and source-tracking fields.
- `REVIEW_REQUIRED`: SOL56, P1-RISE-4102 official-source corpus, SOAP 2026, and broader HRSA narrative/enrichment.

Exact field names and unblock conditions are in `rise/governance/RIGHTS_REVIEW_REQUIRED.csv` (196 workbook fields plus four bounded corpus reviews). `rise/governance/FIELD_PROVENANCE_AUDIT.csv` records include/exclude decisions.

Blocked fields do not create negative facts. The student UI renders unknown, not published, not yet verified, conflicting, or pending as appropriate.

No restricted workbook values, ACGME identifiers, FREIDA URLs, SOAP rows, SOL56 records, or 4102 research were copied into the 5007 student build.

