# D9-415 Implementation Home Lock

Status: **ACTIVE FOR SOURCE RECOVERY ONLY**

The sole implementation home for recovered Matrix source is:

`https://github.com/brinyu13/missionmed-hq.git` → `d9-matrix-plan-415-source-recovery` → `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415`

The repository base is `origin/main` at `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`. The exact observed baseline is commit `c340a3a87732f7dc4afb06c01e4586239a050495`, tree `2a43327429214fdf1c161aa9adf297fabac155bd`, with the non-deployable annotated tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`. The Phase 7 safe source head is commit `9469437d2ac5010563e59b6fdc00a9fe48548a80`.

The machine-readable lock is `D9_415_IMPLEMENTATION_HOME_LOCK.json`, byte-identical to `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_RUNTIME_SOURCE_LOCK.json` at creation.

This lock establishes where source work occurs. It does not grant database, authentication, entitlement, feature-flag, staging, deployment, production-write, cache, or CDN authority. `G-D9-4` stays open, `G-D9-5B` stays `OPEN — D9-416 REQUIRED`, overall `G-D9-5` stays `PARTIAL`, and D9-420 stays blocked.
