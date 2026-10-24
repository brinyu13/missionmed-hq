# Blocked Sources Register

Status: 97 OF 97 BLOCKED FROM EXTRACTION
Date: 2026-07-15
Artifact zone: evidence-only

## Aggregate Disposition

| Cohort | Count | Source attribution | Segment attribution | Extraction status |
|---|---:|---|---|---|
| Explicit speaker evidence | 96 | `verified_drj` | Potentially resolvable through restricted exact-match mapping | `BLOCKED` |
| Generic-only speaker evidence | 1 | `verified_drj` | Unresolved; zero segments may be retained | `BLOCKED` |
| **Total** | **97** | **Source-level verified** | **Multi-speaker filtering required** | **BLOCKED** |

The 97-source total is exhaustive for the authorized registry export identified by its recorded digest. No source title, URL, filename, path, original ID, or speaker label is reproduced in this register.

## Blocking Conditions

| Blocker | Applies to | Condition |
|---|---:|---|
| `PRIV-001_RAW_COEXPOSURE` | 97 | Candidate code returns raw text beside redacted text; the output contract is unsafe |
| `PRIV-002_CLASS_OMISSIONS` | 97 | Student speech and identifying clinical anecdotes are not required removal classes in the candidate implementation |
| `PRIV-003_AGGREGATE_MASKING` | 97 | A required class can have zero recall while an aggregate still passes |
| `PRIV-004_NO_WORKING_COPY` | 97 | No compliant working-redacted copy is evidenced |
| `PRIV-005_PILOT_NOT_RUN` | 97 | No frozen, class-complete, gold-label pilot has passed |
| `PRIV-006_PER_SOURCE_VALIDATION` | 97 | Forbidden-field, metadata-leak, deterministic-rerun, and per-source checks have not passed |
| `ATTR-001_GENERIC_ONLY_MAPPING` | 1 | No authoritative Dr J segment mapping exists; every segment remains removed by default |
| `RIGHTS-001_PUBLIC_USE` | 97 | Public excerpts, quotations, and media clips lack evidenced current Rights Records |

`RIGHTS-001_PUBLIC_USE` does not revoke Brian's DR-006 internal-derivation authorization. It independently blocks public source expression and student-facing publication.

## Unblock Requirements

For the 96 explicit-evidence sources, extraction eligibility requires a compliant Dr J-only working copy, all per-source controls, and the global privacy pilot to pass. For the generic-only source, those gates are necessary but not sufficient: an authoritative source-owner attestation or equivalent reliable MissionMed speaker mapping must also be recorded in the restricted zone.

No cohort may be partially declared passed through an aggregate score. A source remains blocked whenever its own validation is missing or failing, even after a global pilot passes.
