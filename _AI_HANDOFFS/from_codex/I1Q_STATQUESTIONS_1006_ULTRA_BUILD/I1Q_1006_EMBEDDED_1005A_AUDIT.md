# I1Q 1006 Embedded 1005A Audit

## Verdict

VERIFIED: Phase 0 independent audit passes with 111 assertions.

| Suite | Passed | Failed |
|---|---:|---:|
| Official V1 through V20 | 20 | 0 |
| Official LT-1 through LT-6 | 6 | 0 |
| Official N-001 through N-030 | 30 | 0 |
| New N-031 through N-080 | 50 | 0 |
| Privacy contracts PA-001 through PA-005 | 5 | 0 |

VERIFIED: The official 1005 validator ran from an isolated exact-byte copy. Source SHA-256 was `edca04a0e1f8c5160c21cc4814d819f0f03f0eb32c65dead771e6128e2db9bcb`.

VERIFIED: The 1005 source estate checksum was unchanged before and after the audit run.

## Independent mutation coverage

VERIFIED: Fifty new cases cover Unicode normalization, duplicate IDs, malformed references, reviewer credentials, review order, indirect self-review, expired/retracted/changed claims, answer aliases, answer encoding in IDs and order metadata, nested debug data, class C explanation leakage, artifact hash swaps, illegal post-withdrawal promotion, missing privacy classes, split identifiers, and mislabeled student speech.

VERIFIED: The harness is outside the 1005 directory under `audit/` and uses synthetic non-clinical data only.

## Patient identifier defect

- VERIFIED: The 1005 fixture token `FAKE-PAT-0001` is classified as `student_name`, not `patient_identifier`.
- VERIFIED: Therefore the original aggregate omits the required patient-identifier class and can return a null metric while the overall result says pass.
- VERIFIED: The superseding 1006 evaluator emits every required class explicitly.
- VERIFIED: Patient-identifier recall is always numeric.
- VERIFIED: Missing required class produces `fail_missing_required_class` with recall `0`.
- VERIFIED: Denominator-zero policy is `fail_required_class_without_gold_label`.

## Evidence

- `audit/README.md`
- `audit/results/official_1005_suite.json`
- `audit/results/adversarial_audit_report.json`
- `audit/results/audit_summary.json`
- `evidence/foundation_audit.json`

## Gate 0

VERIFIED: Official suite green, adversarial suite green, fixed hash green, answer-leak mutations green, source estate unchanged, patient metric numeric.

VERIFIED: The complete integrated 1006 candidate and handoff were committed together in checkpoint commit `0a05b4d` after validation.
