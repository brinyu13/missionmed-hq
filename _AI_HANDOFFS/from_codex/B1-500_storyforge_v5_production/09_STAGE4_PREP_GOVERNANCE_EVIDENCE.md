# B1-500 Stage 4 — Prep and Governance Evidence

**Outcome:** `PARTIAL`

## Implemented and verified

- Approved institutional question library with provenance and governance state.
- Question Workshop data model with dual questions, preferred question, student why, mentor coaching notes, gaps, and separately stored student/mentor strengths.
- Manual next-natural-question creation for the student or an assigned mentor.
- Paste, CSV, and XLSX parser paths.
- Five-megabyte and 5,000-row limits.
- Exact normalized duplicate detection and near-duplicate token similarity.
- Formula-like cell warning and safe export representation.
- Malformed CSV failure.
- Import review rows with selected/unselected state.
- Commit creates institutional questions as `draft`, never approved.
- Batch rollback retires questions rather than hard-deleting them.
- Import and rollback actions preserve actor/batch provenance.
- AI endpoint is server-only and closed by independent role/mode flags. With flags closed it returns `ai_feature_gated`; it never supplies a fake result.

## Dependency security

- Removed `xlsx` after npm reported a high-severity no-fix advisory.
- Removed `exceljs` after its transitive archive stack produced high-severity advisories.
- Final parser: `read-excel-file` for XLSX plus local data-only CSV parsing.
- Final full `npm audit --audit-level=high`: `found 0 vulnerabilities`.

## Release-blocking gaps

- The browser surface currently exposes paste review; CSV/XLSX server paths are verified by unit tests but file-picker UX is not release-complete.
- Governance approval/retirement review UI and assignment drawer are incomplete.
- Story-question mapping proposals/confirmations are modeled but not wired end to end.
- The founder has not approved an AI provider DPA, budget, model, or promotion gate. Clinical generation remains closed; manual coaching is the only implemented clinical path.

Stage 4 therefore cannot be labeled production-complete.
