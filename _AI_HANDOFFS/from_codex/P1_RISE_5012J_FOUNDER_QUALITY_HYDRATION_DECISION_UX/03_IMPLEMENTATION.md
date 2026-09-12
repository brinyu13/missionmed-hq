# Implementation

## Canonical data path

The sealed Claude package was copied exactly, normalized through the existing provider-neutral evidence contract, reviewed, and promoted into the existing canonical RISE store. No second truth store was created.

Production promotion source: `rise_src_p1_rise_5012j_review`.

The resident-country defect was traced to `normalizeRoster()` dropping structured member fields during promotion. Commit `c8c1da3` preserves `medical_school_country`, track, role, classification evidence/confidence, source date, and conflict metadata. The 27 array rosters were replayed through the canonical review/promotion path; the seven terminal unavailable roster objects were not rewritten.

## UX and decision intelligence

- Wider desktop result rows and program files use available horizontal space while retaining responsive reflow.
- Cards show concise evidence summaries; detailed evidence remains in disclosures and Sources & Details.
- At a Glance presents objective program facts; Application Fit compares confirmed profile facts and explains unavailable comparisons.
- Residents render as full-width stacked rows with name/school search, PGY, school, country, and classification filters, plus name/PGY/school/country sorting.
- Resident-school aggregation supports searchable medical-school matching.
- Numeric Step 2 and COMLEX Level 2 minimum filters preserve unknown/conflict/not-published semantics.
- DO-friendly and IMG-friendly controls require supported positive representation and sort descending; unknown remains unknown.
- Leadership, faculty, fellowships, outcomes, tracks, and application fields use their current canonical promoted records.
- The Program File begins hydration before first render, eliminating the misleading transient empty state.
- Bulk Find Programs bootstrap is compacted to decision/filter fields; named residents and verbose evidence remain in the per-program endpoint.
- Incomplete JSON now raises `RISE_INCOMPLETE_RESPONSE` instead of silently returning an empty object and false zero counts.

## CV / File Vault boundary

RISE remains a consumer of Matrix canonical profile facts, not a second profile store. The production-visible CV entry is not represented as a working extraction path unless the existing authorized File Vault/Matrix seam is available. No cross-product File Vault or Matrix write mutation was made under this ticket.

