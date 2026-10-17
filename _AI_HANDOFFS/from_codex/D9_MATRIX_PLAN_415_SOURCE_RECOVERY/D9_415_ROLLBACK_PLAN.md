# D9-415 Rollback Plan

Status: **ROLLBACK EVIDENCE SEALED; NO RUNTIME ROLLBACK REQUIRED**

Production was never changed by D9-415, so there is no D9-415 production rollback to execute.

## Source recovery points

- Exact observed production: commit `c340a3a87732f7dc4afb06c01e4586239a050495` and tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`. This state includes the auto-loaded backup MU file and is evidence-only, not deployable.
- Safe source quarantine: commit `9469437d2ac5010563e59b6fdc00a9fe48548a80`.
- Reconciled source authority: commit `e12cd99aa9c019a6f99325c0b961aa50db945472`.

## Preserved historical bytes

| State | SHA-256 | Preservation |
|---|---|---|
| Current Calendar CSS | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | Commit A runtime path |
| Former lock Calendar CSS | `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` | `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/` |
| Current controller | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | Commit A runtime path |
| Former controller | `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` | `_SYSTEM/FORENSICS/D9_415/CONTROLLER_ROLLBACK/` |
| Observed backup MU byte | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Commit A active path and later non-runtime forensics |

## Future rollback requirements

Any later deployment must first create its own production backup and must define atomic restore steps for the plugin, intended MU set, cache state, and protected lock. It must validate origin/public hashes and Matrix routes after both deploy and rollback. Restoring the former controller would also restore different entitlement semantics and therefore requires D9-416 authority; it is not a mechanical fallback. The Scheduler adapter's mutable CDN HTML must be separately pinned or backed up before any release because the Git package alone cannot roll that external runtime back.

No rollback command, cache purge, production copy, WordPress mutation, database mutation, or CDN mutation is included or authorized here.
