# I1Q-1007X Performance

## Verdict

`LOCAL SYNTHETIC MECHANICS PASS, STAGING CAPACITY UNKNOWN`

## Evidence

The full local package suite completes in approximately 1.4 seconds on the current workstation. A bounded in-memory benchmark inserts 10,000 synthetic extraction candidates and reads a 200-row page within the generator's 8-second safety budget. The latest generated result is recorded in `i1q-question-platform/evidence/load_results.json`.

The HTTP and UI contracts cap individual list requests at 200 records. Migration indexes cover source identity, transcript timing, revision-source joins, release membership, and other primary access paths. The disposable PostgreSQL contract run completes in under one second, but it is a correctness rehearsal, not a load test.

## Known Limits

The browser shell still performs some filtering within one bounded page. Cursor-backed server search, stable sorting, queue pagination, and 10,000-record operator journeys are not implemented end to end. No staging query plan, connection-pool saturation, concurrency, extraction throughput, retry pressure, network latency, cold start, memory, or production capacity evidence exists.

## Gate

Performance is adequate for continued local engineering only. State C requires staging load evidence against the actual unprivileged repository and deployment topology.
