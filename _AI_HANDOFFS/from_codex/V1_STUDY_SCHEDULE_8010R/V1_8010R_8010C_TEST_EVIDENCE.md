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
