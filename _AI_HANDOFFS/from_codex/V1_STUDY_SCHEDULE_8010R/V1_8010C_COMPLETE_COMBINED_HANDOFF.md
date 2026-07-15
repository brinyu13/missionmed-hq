# V1 Study Schedule 8010C — Complete Combined Handoff

Generated: 2026-07-15 UTC  
Governed commit: `08e3681b6ea21f1ad65bc87db4ffae0597adc951`  
Status: INERT SOURCE BOUNDARY COMPLETE; ACTIVATION/DEPLOYMENT ON HOLD

This file embeds every final 8010C Markdown deliverable verbatim in logical order.

<!-- BEGIN V1_8010R_8010C_IMPLEMENTATION_REPORT.md -->

# V1 Study Schedule 8010C — Inert Integration Seam Implementation Report

Date: 2026-07-15 UTC  
Mission: V1-STUDY-SCHEDULE-8010R  
Boundary: V1-8010C  
Status: COMPLETE FOR INERT SOURCE GOVERNANCE; NOT AUTHORIZED FOR ACTIVATION OR DEPLOYMENT

## Product identity ledger

| Field | Authority |
|---|---|
| Product | V1 Study Schedule |
| Purpose | Learner academic study planning and execution |
| Historical aliases | Matrix Plan; Study Schedule; Study Scheduler; D9 Matrix Plan |
| Not this product | MissionMed Scheduler; Appointment Scheduler; Calendar; Webex Scheduler |

## Exact Git authority

| Item | SHA |
|---|---|
| 8010C parent, including validated 8010B and Y1 Matrix sync | `defb74c52d37a4390f226fbfbeb18ed3e804ae07` |
| 8010C governed commit | `08e3681b6ea21f1ad65bc87db4ffae0597adc951` |
| Governed tree | `bee2f4aa66d647cc7536081fd1c0bb32725d5684` |
| Draft governed PR | `https://github.com/brinyu13/missionmed-hq/pull/12` |
| Final validation commit with identical tree | `22cc8bb464fe0523bf157daeebddc7c48ed94d3e` |

The governed tree exactly matched the final green validation tree before the branch advanced. The commit was created through remote Git objects because MR-079 prohibited local Git writes. No local file was staged or committed.

## Frozen path set

8010C changes exactly these 19 paths:

1. `.github/workflows/v1-study-schedule-8010c.yml`
2. `tests/js/v1-study-schedule-8010c-loader.test.js`
3. `tests/php/run-v1-study-schedule-8010c.sh`
4. `tests/php/v1-study-schedule-8010c-contract.php`
5. `tests/php/v1-study-schedule-8010c-rest-loader.php`
6. `tests/php/v1-study-schedule-8010c-wordpress.php`
7. `wp-content/plugins/missionmed-hub/assets/v1-study-loader.3306a14e53f00510.js`
8. `wp-content/plugins/missionmed-hub/assets/v1-study-loader.8f5fec1fc495e441.css`
9. `wp-content/plugins/missionmed-hub/assets/v1-study-release.c711b79e783160d9.json`
10. `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php`
11. `wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php`
12. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-access.php`
13. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php`
14. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-loader.php`
15. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-observability.php`
16. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php`
17. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php`
18. `wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-rest-api.php`
19. `wp-content/plugins/missionmed-hub/missionmed-hub.php`

## Implemented contracts

- Dedicated REST namespace: `missionmed-study-schedule/v1`.
- Read-only bootstrap route: `/bootstrap`.
- Authenticated WordPress actor with nonce verification.
- Explicit server-owned learner or mentor role evidence; entitlement alone never promotes an unknown actor.
- Exact 360 entitlement normalization with freshness, revocation, enrollment, purchase/current-access, and restriction checks.
- Administrators are audit-only; mentors are assignment-scoped; learner ownership is server-derived.
- Exact action/resource/field allowlists and recursive rejection of client-supplied authority fields.
- Non-enumerating denial behavior.
- Four release modes with matching-generation store/release control records.
- Missing, malformed, torn, or stale control evidence fails closed.
- Separate canonical release digest and executable loader digest.
- Read-only repository interface with physical store provenance reconciliation and no commit method.
- Current/N-1 reader vocabulary without a production repository or schema.
- Generic, type-transition, delete, and bulk Calendar Study mutations pass through the compatibility fence.
- REST success and denial responses are private/no-store and vary on cookie and nonce.
- Permission and callback phases reuse one exact-request authorization decision.
- Request-local structural observability is allowlisted, bounded, and has no durable sink.
- The browser loader is inert: no fetch, mount, navigation, storage write, DOM mutation, or Calendar write.
- Any prior script or style registration under the owned handles causes fail-closed suppression.

## Immutable release anchors

| Artifact | SHA-256 |
|---|---|
| Loader JavaScript | `3306a14e53f0051051511ccf31e638e5411f43dd7574fcdccb007a76c163aa37` |
| Loader stylesheet | `8f5fec1fc495e441bdd29b0a3cee675b7396e83463acd0c67f0c8970e92f266b` |
| Canonical release manifest | `c711b79e783160d9f2cbbbcc4682c289958b1f5a80df1b5a881e2d8e882511bc` |

The manifest filename prefix, full manifest hash, exact JS/CSS names, and full JS/CSS hashes are cross-checked by PHP and Node tests. The client binds `release.asset_digest` to `document.currentScript`; release idempotency uses the canonical `release.digest`.

## Deliberate non-effects

8010C did not create a production table, migration, writer route, production actor adapter, control option, cohort, flag, entitlement record, learner record, telemetry sink, or deployment. It did not modify MissionMed_OS. It did not merge PR #12. Decision 12 remains HOLD.

## Rollback boundary

The 8010C source commit is separately revertible before any owner watermark exists. After a future watermark, rollback must never re-enable the legacy writer or remove the commissioned repository/current-N-1 readers; it must degrade to read-only while retaining the C guard floor.

<!-- END V1_8010R_8010C_IMPLEMENTATION_REPORT.md -->

<!-- BEGIN V1_8010R_8010C_TEST_EVIDENCE.md -->

# V1 Study Schedule 8010C — Test and Runtime Evidence

Date: 2026-07-15 UTC  
Governed commit: `08e3681b6ea21f1ad65bc87db4ffae0597adc951`  
Governed tree: `bee2f4aa66d647cc7536081fd1c0bb32725d5684`

## Local read-only verification

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| Node syntax check for loader test | PASS |
| Node immutable loader isolation test | PASS |
| Canonical manifest JSON parse and exact descriptor check | PASS |
| Full loader JS hash and filename prefix | PASS |
| Full loader CSS hash and filename prefix | PASS |
| Full canonical manifest hash and filename prefix | PASS |
| Unique JS/CSS/manifest artifact census | PASS; exactly one of each |
| Stale prior digest/name scan | PASS; no stale references |

Local PHP was not executed because MR-079 forbids local PHP/Docker/WP-CLI execution. PHP and WordPress evidence came from disposable GitHub Actions environments.

## Validation history

The first C validation run, `29391956173`, failed only in the WordPress fixture because `rest_do_request()` does not execute the final REST serving filter. Deterministic PHP and loader lanes passed. The fixture was corrected to apply `rest_post_dispatch` explicitly; production code was unchanged by that correction.

Validation commit `83025747fbb2aee4e9aa9aecbf5ea1a691268861` then passed all nine C plus containment lanes. Independent review subsequently identified handle-ownership and release-manifest gaps; they were fixed. Darwin then caught a release-digest/loader-digest cross-layer mismatch before governance. The loader, manifest, PHP descriptor, and tests were regenerated atomically.

Final validation commit `22cc8bb464fe0523bf157daeebddc7c48ed94d3e` used tree `bee2f4aa66d647cc7536081fd1c0bb32725d5684` and passed:

- 8010C integration run `29392666907`: five of five jobs passed.
- Existing containment run `29392666988`: four of four jobs passed.

## Exact governed-commit CI

The governed commit was tested again after branch promotion:

| Workflow | Run | Jobs | Result |
|---|---:|---:|---|
| V1 Study Schedule 8010C integration seam | `29392781535` | 5 | PASS |
| V1 Study Schedule containment | `29392781548` | 4 | PASS |

The nine passing lanes were:

1. PHP 7.4 deterministic 8010C contract.
2. PHP 8.3 deterministic 8010C contract.
3. WordPress 6.6.2 + MariaDB integration on PHP 7.4.
4. WordPress 6.6.2 + MariaDB integration on PHP 8.3.
5. Immutable inert loader isolation.
6. PHP 7.4 legacy containment.
7. PHP 8.3 legacy containment.
8. WordPress + MariaDB legacy containment on PHP 7.4.
9. WordPress + MariaDB legacy containment on PHP 8.3.

The only annotations were the upstream `actions/checkout` Node 20 deprecation notices while GitHub forced Node 24. No test or product failure resulted.

## Coverage summary

Tests cover:

- exact control record keys, types, versions, timestamps, generations, policy coupling, and release digest;
- missing/torn/malformed controls and default hold;
- all four release modes, current/N-1 readers, missing readers, and physical store mismatch;
- unknown actor, learner, mentor, administrator, assignment, entitlement, nonce, ownership, action, and nested-authority matrices;
- request-object authorization caching and private/no-store response headers;
- exact content-addressed loader/manifest/CSS hashes and foreign handle collisions, including exact-source collisions;
- canonical release digest versus executable asset digest across PHP, manifest, and JavaScript;
- no loader fetch, mount, route, storage, DOM, or navigation effects;
- real WordPress route coexistence and zero Calendar DML for V1 bootstrap;
- generic create/update/delete/type-transition and bulk Calendar Study fences;
- non-Study Calendar compatibility;
- missing-control fail-closed behavior before DML;
- repository source has no Calendar dependency and no commit method.

## Matrix runtime guard

Fresh full preflight after final C bytes:

`matrix_runtime_guard.py preflight --assets all --verify-public` — exit `0`.

| Protected authority | Approved/local/origin/public result |
|---|---|
| Matrix controller | `b514638b6089b12057ab53e715bc18c13b0dc21cba64e63d04be0a14cc0739d2` — MATCH |
| Matrix browser JS | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` — MATCH |
| All other protected Matrix assets | MATCH |

No production bytes were changed by this verification.

<!-- END V1_8010R_8010C_TEST_EVIDENCE.md -->

<!-- BEGIN V1_8010R_8010C_INDEPENDENT_REVIEW.md -->

# V1 Study Schedule 8010C — Independent Review Closure

Date: 2026-07-15 UTC  
Final verdict: GO FOR SEPARATE INERT SOURCE GOVERNANCE; NO-GO FOR ACTIVATION OR DEPLOYMENT

## Review wave

- Herschel mapped the V1 Study Schedule authority, dependencies, mounts, repository evidence, and protected Matrix runtime boundary.
- Avicenna diagnosed access, rollout, actor, REST, test, and deployment risks.
- Lorentz reviewed release/store identity, physical provenance, Calendar/V1 writer boundaries, reader floors, and rollback semantics.
- Darwin received the verified findings after the first wave and reviewed the minimum safe evolution sequence.
- The supervisor independently checked every accepted finding against current bytes and exact remote test evidence.

All subagents remained read-only. The supervisor was the sole writer.

## Findings closed before governance

1. Entitlement no longer promotes an unknown actor; learner status requires explicit server role evidence.
2. Generic Calendar create/update/delete/type-transition and bulk Study paths no longer bypass the compatibility fence.
3. Store/release generations and exact release fingerprints are matched.
4. Injected physical repository provenance must match state, store ID, and generation; reversible controls cannot hide a commissioned store.
5. REST success and denial responses receive private/no-store/must-revalidate headers and vary on cookie and nonce.
6. Route registration honors the Matrix enable boundary.
7. Authorization is cached only for the exact request object.
8. Foreign script/style registrations fail closed, even when the URL exactly matches the expected asset.
9. The release fingerprint is reproducible from a checked-in content-addressed canonical manifest.
10. Canonical release identity and executable loader identity are separate.
11. JavaScript binds the current script filename to `release.asset_digest` while idempotency remains bound to canonical `release.digest`.
12. Cross-layer tests independently recompute both hashes, parse the PHP constants, and exercise mismatch behavior.

## Final severity assessment

| Severity | Unresolved inert-8010C defects |
|---|---:|
| P0 | 0 |
| P1 | 0 |

The review does not approve activation. It approves only the inert source boundary represented by commit `08e3681b6ea21f1ad65bc87db4ffae0597adc951`.

## Mandatory later gates

- Pre-provision and verify matched `never_commissioned + LEGACY_PRECUTOVER + hold + exposure=false + stop=false` controls before live C source activation. Missing controls intentionally block legacy Study writes.
- Build one database-transactional, per-owner writer arbiter shared by Calendar legacy Study and V1 Plan writers.
- Atomically couple the first V1 operation with the owner watermark.
- Prove legacy-vs-V1, V1-vs-V1, retry, crash, stale generation, owner isolation, generic bypass, and database-failure races with two sessions.
- Make commissioning monotonic and repository detection independent of reversible release configuration.
- Preserve the commissioned repository and current/N-1 reader floor after the first watermark.
- Add a server-owned production learner/mentor actor provider before exposure.
- Build a full release-candidate package manifest before RC/deployment claims.
- Keep Decision 12 HOLD until founder decisions cover cohorts, real learner data, telemetry, retention, and production launch.

## Darwin sequencing verdict

1. Freeze and remotely validate C.
2. Define the explicit production actor adapter.
3. Establish monotonic store commissioning, generation, and current/N-1 readers.
4. Implement the shared transactional per-owner writer arbiter.
5. Run the complete two-session race oracle and failure-injection matrix.
6. Prepare idempotent default-hold pre-provisioning and readback evidence without deployment.
7. Only with later deployment authority, provision controls before source activation.
8. Activate hidden/read-only first, then cut over per owner through the arbiter.
9. After any watermark, rollback only to compatible read-only; never restore the legacy writer.

<!-- END V1_8010R_8010C_INDEPENDENT_REVIEW.md -->

<!-- BEGIN V1_8010R_BLOCKER_REGISTER.md -->

# V1 Study Schedule 8010R — Live Blocker Register

Updated: 2026-07-15 UTC  
Current governed boundary: 8010C complete as inert source

## Active gates

| ID | Gate | Blocks | Does not block | Resolution evidence required |
|---|---|---|---|---|
| BLK-12 | Decision 12 remains HOLD | Real learner data, cohort exposure, production telemetry/retention, activation, deployment | Isolated synthetic 8010D engineering and tests | Explicit founder decisions plus recorded policy/control version |
| BLK-C-PROVISION | Missing live control records intentionally fail closed | Any live activation of C source | Source governance and synthetic D | Two-phase idempotent pre-provision/readback/rollback proof for matched generation, `never_commissioned`, `LEGACY_PRECUTOVER`, hold, no exposure, `stop=false` |
| BLK-D-ARBITER | No transactional shared per-owner writer arbiter yet | Any V1 writer or per-owner cutover | Read-only C and isolated schema work | Two-session race oracle proving exactly one writer and atomic first operation + watermark |
| BLK-D-STICKY | Commissioning and reader floor are not yet physically implemented | Post-watermark operation or rollback | Pre-watermark synthetic design | Monotonic commissioned state, durable generation, repository probe, current/N-1 readers, degraded rollback proof |
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

## Informational maintenance

GitHub Actions reports an upstream Node 20 deprecation annotation for the pinned `actions/checkout` commit while GitHub forces Node 24. This did not fail or weaken any current lane. Track it as maintenance; do not broaden the V1 mission into unrelated CI modernization.

## Current stop/go statement

- GO: isolated synthetic V1-8010D implementation and verification.
- GO: documentation, exact-digest packaging, reversible test infrastructure, and read-only authority checks.
- NO-GO: production source activation, option pre-provisioning, schema creation, learner data, cohort exposure, feature flags, merge if it auto-deploys, or production deployment.

<!-- END V1_8010R_BLOCKER_REGISTER.md -->


