# V1 Study Schedule 8010R — Live Blocker Register

Updated: 2026-07-15 UTC  
Current governed boundary: 8010E E0 normalized Week/Block contract verified; E1 synthetic migration/reader work authorized

## Active gates

| ID | Gate | Blocks | Does not block | Resolution evidence required |
|---|---|---|---|---|
| BLK-12 | Decision 12 remains HOLD | Real learner data, cohort exposure, production telemetry/retention, activation, deployment | Isolated synthetic 8010D engineering and tests | Explicit founder decisions plus recorded policy/control version |
| BLK-C-PROVISION | Missing live control records intentionally fail closed | Any live activation of C source | Source governance and synthetic D | Two-phase idempotent pre-provision/readback/rollback proof for matched generation, `never_commissioned`, `LEGACY_PRECUTOVER`, hold, no exposure, `stop=false` |
| BLK-D-PHYSICAL | Active database, locked C control snapshot, and physical repository probe are not yet integrated | Any real schema or repository promotion | Isolated kernel proof | Read-only active-database identity/capability evidence and fail-closed physical probe against locked C control |
| BLK-D-ARBITER | No transactional shared per-owner writer arbiter yet | Any V1 writer or per-owner cutover | Read-only C and isolated schema work | Two-session race oracle proving exactly one writer and atomic first operation + watermark |
| BLK-D-STICKY | Commissioning and reader floor are not yet physically implemented | Post-watermark operation or rollback | Pre-watermark synthetic design | Monotonic commissioned state, durable generation, repository probe, current/N-1 readers, degraded rollback proof |
| BLK-D-BACKUP | No staging backup/restore and degraded-reader rehearsal exists | Migration promotion or rollback claim | Isolated kernel proof | Exact backup manifest, restore rehearsal, retained bytes, and fail-closed degraded-reader evidence |
| BLK-D-ACTOR | No production explicit actor adapter | Learner or mentor exposure | Default-hidden C and synthetic D | Server-owned learner/mentor evidence adapter with assignment and entitlement tests |
| BLK-RC-DIGEST | No full release-candidate package digest | RC/deployment attestation | Inert C and synthetic D | Canonical full-package manifest with exact-digest CI and rollback package |
| BLK-VISIBLE-UX | No learner-visible slice exists yet | UI/UX 9.0 closure, accessibility, responsive and usability launch claims | Backend/storage synthetic work | Independent visible-slice reviews, accessibility/responsive evidence, scores at least 9.0/10 |
| BLK-PROD-E2E | No authorized production rollout or authenticated production evidence | Mission COMPLETE claim | All reversible non-production work | Controlled cohort rollout, authenticated admin/eligible-student proof, monitoring and rollback evidence |

## Resolved blockers

| ID | Resolution |
|---|---|
| RES-Y1-LOCK | Y1 owner reconciled the Matrix runtime manifest. Fresh full local/origin/public guard passed with controller `b514638b...` and browser JS `c1d97237...`. |
| RES-C-ACTOR | Unknown actors are no longer promoted by entitlement. |
| RES-C-BYPASS | Generic and bulk Calendar Study mutation bypasses are fenced. |
| RES-C-PROVENANCE | Physical repository store identity and generation are reconciled. |
| RES-C-HANDLES | Any prior owned-handle registration fails closed. |
| RES-C-MANIFEST | Release identity is reproducible from a canonical content-addressed manifest. |
| RES-C-DIGEST-SEAM | Release digest and executable asset digest are separated and cross-layer tested. |
| RES-C-CI | Exact governed commit passed all nine PHP/WordPress/loader/containment lanes. |
| RES-D-KERNEL | Exact validation commit `3d392dbd...` passed six digest-pinned PHP 7.4/8.3, WordPress, MariaDB 10.11, MySQL 8, and extended concurrency/crash lanes. |
| RES-D-CLOCK | Session `timestamp` replay spoofing is independently bounded before mutation and every ledger clock read; 2037 contamination fails before DDL on both database families. |
| RES-D-REVIEW | Three read-only P0/P1 audits closed with no remaining P0/P1 in final kernel digests. |
| RES-E0-DOMAIN | Pure Week/Block normalization, temporal intent, collision, tombstone, and Mission projection laws passed PHP 7.4/8.3. |
| RES-E0-SCHEMA | Exact migrations 6–7 and constraints passed physical MySQL 8 and MariaDB 10.11 inspection/enforcement at commit `9e8e2f...`. |
| RES-E0-REGRESSION | All 8010C, containment, 8010D, and 8010E exact-tree CI jobs passed together. |

## Informational maintenance

GitHub Actions reports an upstream Node 20 deprecation annotation for the pinned `actions/checkout` commit while GitHub forces Node 24. This did not fail or weaken any current lane. Track it as maintenance; do not broaden the V1 mission into unrelated CI modernization.

## Current stop/go statement

- GO: continue isolated synthetic V1-8010E E1 migration/current-reader work from the verified E0 contract.
- GO: documentation, exact-digest packaging, reversible test infrastructure, and read-only authority checks.
- NO-GO: real schema creation, production source activation, option pre-provisioning, learner data, cohort exposure, feature flags, merge if it auto-deploys, or production deployment.
