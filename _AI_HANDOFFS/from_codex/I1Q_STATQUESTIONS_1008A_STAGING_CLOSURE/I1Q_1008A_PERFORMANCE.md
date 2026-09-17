# I1Q-1008A Performance

## Verdict

`LOCAL SYNTHETIC BASELINE RECORDED; STAGING PERFORMANCE NOT CERTIFIED`

Darwin ran after correctness was established and made no product refactor. No performance SLO, hosted query plan, authenticated ingress result, or production claim is inferred from loopback measurements.

## Local Measurements

| Measure | Result | Evidence class |
| --- | ---: | --- |
| Full Node suite | 287 total, 285 pass, 0 fail, 2 DB skips | Local synthetic |
| Public assets raw | 139,559 bytes | Local static |
| Public assets gzip level 9 | 30,711 bytes | Offline estimate |
| `/api/health` p95, 300 samples | 0.276 ms | Single-process loopback |
| dashboard p95, 300 samples | 0.230 ms | Single-process loopback |
| inventory first page p95, 300 samples | 0.135 ms | Single-process loopback |
| `app.js` p95, 100 samples | 0.463 ms | Single-process loopback |
| 5,000 synthetic creates with audit | 54.527 ms | MemoryRepository |
| 20,000 synthetic creates with audit | 200.977 ms | MemoryRepository |
| 20,000-row first page p95 | 1.132 ms | MemoryRepository |

The exact environment, sample method, percentiles, memory figures, asset sizes, and candidate fingerprint are preserved in `agents/darwin/performance_before_after.json`.

## Static Findings

1. Darwin found that the browser originally stopped at the first 200-row page. Commit `483b0f7` closed that correctness defect: the client drains bounded cursor pages, rejects changing snapshots, cursor loops, overlapping IDs, invalid totals, incomplete responses, and results above 50,000 rows. A 250-row regression passes locally. Commit `fd7ddcd` then contained visually hidden table headers within each independent scroller, closing the measured page-root overflow without removing table access.
2. Several review and authoring screens still join complete collections in the browser. Correctness is locally preserved, but this is not a viable hosted high-cardinality query plan.
3. The reviewer queue query is caller-bound but unbounded, and its observed predicate order does not align with the current leading index column. A preview `EXPLAIN` is required before changing the index or query contract.
4. Static assets are small and dependency-free, but the local server uses `no-store` without compression or validators. Actual ingress behavior is unknown.
5. The largest maintainability surfaces are the browser application, evidence validator, and platform service. Four repeated-code clusters are candidates for later behavior-preserving extraction.

## Refactor Ruling

No optimization was applied because the useful changes require a representative datastore, authoritative pagination UX, and measured query plans. Changing contracts from local microbenchmarks would be premature.

Recommended order after staging authority exists:

1. Replace full client-side collection joins with server-filtered cursor workflows and explicit page controls before representative hosted scale testing.
2. Measure reviewer, assignment, audit, and release queries at 1,000, 10,000, and 50,000 synthetic rows.
3. Tune indexes only from captured plans and latency distributions.
4. Verify compression, cache policy, validators, and authenticated asset behavior at ingress.
5. Run concurrent edit, auth refresh, database interruption, restart, retry, and connection-pool tests.

## External Blockers

- no authorized preview datastore;
- no representative hosted corpus;
- no canonical identity integration;
- no staging URL or ingress;
- no database query plans, slow-query telemetry, connection metrics, or operational load evidence.

The local candidate remains suitable for continued engineering. It is not performance-certified for preview, staging, internal production, or student use.
