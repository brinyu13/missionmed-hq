# P1-RISE-4006 Performance Report

## Verdict

**Local synthetic candidate: PASS**
**Production capacity and reliability: NOT ESTABLISHED**

## Web Artifact

| Asset | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `index.html` | 4,994 | 1,219 |
| `styles.css` | 27,975 | 5,605 |
| `app.js` | 63,632 | 15,771 |
| `vendor/lucide.js` | 5,680 | 2,016 |
| `asset-manifest.json` | 471 | 338 |
| **Total** | **102,752** | **24,949** |

Build ID: `rise_web_8d2c636a88b7`.

The selected official Lucide bundle replaced the full roughly 404 KB catalog. A browser regression test enforces a 30 KB upper bound on that bundle and verifies rendered SVG icons from `dist`.

## Synthetic Search Stress

Configuration:

- 6,500 in-memory synthetic program-specialty records;
- 200 concurrent search and sort requests;
- complete 100-record response bodies consumed before latency was recorded;
- distinct authenticated synthetic subjects;
- local loopback Node process, no network, external auth, database, cache, or reverse proxy.

Result:

| Metric | Value |
| --- | ---: |
| HTTP 200 | 200 of 200 |
| Wall time | 338.8 ms |
| Median latency | 184.4 ms |
| p95 latency | 311.2 ms |
| Maximum latency | 321.6 ms |
| RSS after run | 179.4 MB |
| Heap used after run | 35.3 MB |

Evidence: `artifacts/synthetic-stress-6500x200.json`.

## Reliability Behavior

- Stale Explorer, Profile, Compare, and Queue responses cannot overwrite a newer route.
- Slow search exposes a loading state and recovers.
- Stale compare IDs are removed without wedging the view.
- Artifact hash mismatch cleans the temporary runtime and aborts startup.
- Auth, abuse-controller, source-rights, activation, and registry failures are fail closed.
- Static assets support ETag, conditional 304 responses, and HEAD.
- Operator metrics expose bounded in-process request counters without applicant data.

## Candidate Budgets

- Raw first-party shell including selected icons: at or below 150 KB.
- Gzip shell: at or below 40 KB.
- Local synthetic search p95 at 6,500 records and 200 concurrent requests: below 500 ms.
- No unbounded page size; API page size remains capped.
- No route transition may be overwritten by a stale response.

These are review budgets, not production SLOs.

## Container Evidence

- Local arm64 image size: 58,181,739 bytes.
- Local image ID: `sha256:244ee6e217f4aaeacadb25464b3b82b1f23f1d3e61f87447f7947fd190e63461`.
- Runtime user: `node`.
- Entrypoint command: `node tools/start-production.mjs`.
- SPDX SBOM: 20 packages, SHA-256 `fdee20b81f774277d96529b4b860a5765d6f351c3ee191d309965546f87f940c`.
- Trivy 0.72.0 vulnerability scan: zero findings across all severities; report SHA-256 `1056ba5b02b6bf97204d2c8a288426c5e945e00855deadd387ccfe306ed75a5c`.

## Missing Production Evidence

- The eventual target-architecture image pushed to an approved registry does not exist and must be scanned again by approved CI or staging.
- No Railway CPU or memory profile exists.
- No real HQ introspection, durable rate service, artifact host, PostgreSQL query plan, CDN cache, WordPress shell, or geographic service was measured.
- No long-duration soak, autoscaling, multi-instance metric aggregation, alert, or production error-rate baseline exists.
- No real registry refresh timing exists because source ingestion is not authorized.

Production performance remains pending until staging provides the actual topology and an authorized dataset.
