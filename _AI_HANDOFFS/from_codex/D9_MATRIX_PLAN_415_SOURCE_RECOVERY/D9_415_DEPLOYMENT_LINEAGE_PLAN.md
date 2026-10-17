# D9-415 Deployment Lineage Plan

Status: **LINEAGE DEFINED; DEPLOYMENT NOT AUTHORIZED**

## Proven source chain

1. Quiescent direct production snapshot: T0/T1 normalized manifest `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`.
2. Exact observed baseline: D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495`, protected by the non-deployable annotated tag.
3. Source-only backup quarantine: D9-415B `9469437d2ac5010563e59b6fdc00a9fe48548a80`.
4. Source/lock reconciliation: D9-415C `e12cd99aa9c019a6f99325c0b961aa50db945472`.
5. Deterministic package: 129 tracked source files, source manifest `a650686889a6ddc22664ed890b6ff7b80fc3c1e475282723b8542d05f3967bc5`, archive SHA-256 `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`.
6. D9-415D adds validation only; later D9-415 closeout commits must not change the pinned runtime source.
7. The recovery branch may be reviewed only through a draft, do-not-merge pull request.

## Mandatory future gates

No package from D9-415 may be staged or deployed. D9-416 must first resolve database, authentication, entitlement, authority-mode validation, `revocation_checked`, LearnDash-current-access behavior, feature flags, mutable Scheduler CDN authority, staging, deployment, cache, rollback, and production MU remediation. D9-360 remains product/visual/interaction authority.

Only a later founder-approved run may define a deployable release from a reviewed commit, create a new production backup, pin every mutable dependency, validate a staging environment, produce a release-specific package, verify origin and public hashes, perform browser regression, and update the protected runtime lock. That later lineage must reference the exact approved commit and must not repurpose the D9-415A evidence tag.

This run performs none of those future actions. `G-D9-4` and `G-D9-5B` remain open, overall `G-D9-5` remains partial, and D9-420 remains blocked.
