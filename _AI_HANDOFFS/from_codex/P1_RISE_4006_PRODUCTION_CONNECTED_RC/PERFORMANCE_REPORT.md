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

## Missing Production Evidence

- Container build and image scan were not run because the Docker daemon was unavailable.
- No Railway CPU or memory profile exists.
- No real HQ introspection, durable rate service, artifact host, PostgreSQL query plan, CDN cache, WordPress shell, or geographic service was measured.
- No long-duration soak, autoscaling, multi-instance metric aggregation, alert, or production error-rate baseline exists.
- No real registry refresh timing exists because source ingestion is not authorized.

Production performance remains pending until staging provides the actual topology and an authorized dataset.
