# D9-415 Calendar CSS Reconciliation

Status: **PASS — CURRENT AND FORMER STATES PRESERVED**

## Current observed production state

- Runtime path: `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css`
- SHA-256: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`
- Commit A path: same runtime path
- Commit A result: exact production hash and byte-size match
- Immutable preservation: commit `c340a3a87732f7dc4afb06c01e4586239a050495` and tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`

This is the CSS served by the Kinsta origin and public delivery in the prior direct verification and captured again in the quiescent T0/T1 snapshot. It is the honest observed-production baseline for source recovery.

## Former lock state

- Former lock SHA-256: `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385`
- Historical source: the B1-102 pre-normalization backup created at `20260713T145356Z`
- Branch-local non-runtime preservation: `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/former-lock-student-os-calendar-v4.css`
- Verification: exact SHA-256 match

The historical file is outside `wp-content`, outside packaging, and non-autoloaded. It is preserved solely for provenance and rollback analysis.

## Reconciliation decision

The current observed CSS remains the canonical source byte. The former lock CSS remains historical evidence. D9-415 does not overwrite either state, modify the protected global lock, deploy CSS, or clear cache. Any future rollback or runtime-lock change requires its own approved change path and browser validation.
