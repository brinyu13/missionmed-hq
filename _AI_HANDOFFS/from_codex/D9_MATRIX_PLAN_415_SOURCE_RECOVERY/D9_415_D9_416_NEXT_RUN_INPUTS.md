# D9-415 → D9-416 Exact Next-Run Inputs

This is an evidence and decision-input packet only. It is not a D9-416 prompt and contains no implementation or deployment instructions.

## Source authority now established

- Canonical repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Canonical branch: `d9-matrix-plan-415-source-recovery`.
- Base: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Observed production baseline: D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495`.
- Baseline tag: `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`.
- Runtime source commit used by deterministic packaging: D9-415C `e12cd99aa9c019a6f99325c0b961aa50db945472`.
- Review-fix commit: D9-415E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`.
- Draft PR: [#9](https://github.com/brinyu13/missionmed-hq/pull/9), **DO NOT MERGE**.
- Package SHA-256: `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`, non-deployable.

## Founder-002 behavior boundary

- Authorized current production controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`.
- Previous locked controller: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Current byte is production provenance.
- Previous byte is historical rollback evidence only.
- Entitlement behavior is **OBSERVED AND PRESERVED, NOT APPROVED**.

D9-416 must independently adjudicate the intended future access contract, including:

- entitlement behavior;
- authority-mode validation;
- `revocation_checked` semantics;
- LearnDash-current-access semantics;
- authentication consequences;
- authorization consequences;
- the final interaction among WordPress, LearnDash, Matrix, and upstream identity/entitlement authority.

## Data and operational authority still open

D9-416 must decide, without inferring approval from D9-415:

- database schema/data/RLS/function authority;
- feature-flag authority;
- staging environment and acceptance authority;
- deployment and rollback authority;
- cache/CDN invalidation authority;
- authentication/session/bootstrap/exchange authority;
- production MU-plugin backup remediation authority.

Production still auto-loads `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. D9-415 quarantined it only in canonical source. Any production removal/move requires separate founder approval and its own backup, verification, cache, and rollback controls.

## Scheduler CDN input

- Mutable dependency URL observed in source: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html`.
- D9-416 must establish canonical source, immutable hash/version pin, backup, deploy, cache, verification, and rollback authority for that HTML.

## Calendar and controller rollback evidence

- Current Calendar CSS: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`.
- Former Calendar CSS: `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385`.
- Current controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`.
- Former controller: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Forensic paths are recorded in the branch-local runtime source lock and rollback plan.

## Required gate posture on entry

- `G-D9-4`: OPEN.
- `G-D9-5A CODE SOURCE AUTHORITY`: PASS after D9-415 final remote/mirror verification.
- `G-D9-5B DATA-AUTH AUTHORITY`: OPEN — D9-416 REQUIRED.
- Overall `G-D9-5`: PARTIAL.
- D9-420: BLOCKED.

D9-416 must not assume that source recovery approves entitlement semantics, authorizes production remediation, makes the package deployable, or opens D9-420.
