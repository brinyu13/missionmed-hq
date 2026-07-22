# Performance Report

RESULT: `LOCAL_FIXTURE_PERFORMANCE_BASELINE_PASS`

## Observed browser timings

In the isolated loopback fixture harness, the final portability-correction rerun observed:

- Today ready state: 456 ms
- rapid-route observed p95: 199 ms

The suite requirement for local Today was under two seconds and passed. These figures measure one local synthetic process on this machine; they are not network, database, staging, provider, multi-user, or production SLO evidence.

## Bounded-scale evidence

| Fixture | Evidence |
| --- | --- |
| Students | 1,000 records queried with a 100-item page bound and opaque scoped cursor |
| Work | 10,000 records queried with bounded page rendering |
| Reviews | 500 records queried with bounded page rendering |
| History | 100 sessions for one student with bounded page output |
| Transcript-like evidence | 100,000 characters remained bounded and renderable |
| Rapid routing | Same-origin client navigation remained bounded and error-free |

The direct backend scale validator also passed the same 1,000/10,000/500/100 corpus. Data generation and storage were in memory; no configured database, serialization over a real network, provider, object store, worker queue, or production resource was involved.

## Performance design controls

- Query pages cap returned collections rather than rendering the entire scale corpus.
- Cursors are opaque and scoped.
- Route views progressively disclose details and cap initial attention at three plus four.
- Long transcript-like content stays in a bounded region.
- Browser probes report no external request or runtime error in the performance run.
- Reduced-motion mode eliminates active nonessential animation.

## Unproved performance

Production concurrency, database indexes/query plans, RLS overhead, network latency, cold start, worker/provider throughput, memory pressure, mobile hardware, real transcript distributions, cache behavior, error budgets, and sustained load remain unknown until authorized staging. The Architecture 005 p95/SLO targets remain future targets, not current claims.
