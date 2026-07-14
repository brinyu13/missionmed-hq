# D9 Matrix Runtime Source Baseline — 2026-07-13

This branch-local baseline records source authority established by D9-415. It does not replace the protected global runtime lock and does not authorize deployment.

- Exact observed-production commit: `c340a3a87732f7dc4afb06c01e4586239a050495`
- Non-deployable baseline tag: `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`
- Safe source head at Phase 7: `9469437d2ac5010563e59b6fdc00a9fe48548a80`
- Intended-active Matrix MU set: `D9_MATRIX_MU_INTENDED_ACTIVE.json`
- Source authority lock: `D9_MATRIX_RUNTIME_SOURCE_LOCK.json`
- Deterministic package policy: `D9_MATRIX_PACKAGE_POLICY.json`

The package builder and validator are `_SYSTEM/scripts/build_d9_matrix_source_package.py` and `_SYSTEM/scripts/validate_d9_matrix_source.py`. They read only tracked source, reject dirty worktrees and source drift, write only to a caller-supplied path outside the repository, and have no deployment path.

Former controller and Calendar CSS bytes, plus the observed backup MU byte, are under `_SYSTEM/FORENSICS/D9_415/` and are excluded from runtime packaging.

D9-416 remains mandatory for database, authentication, entitlement, feature-flag, staging, and deployment authority. D9-420 remains blocked.
