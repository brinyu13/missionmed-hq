# Research Factory Bridge

`research-factory-ingest.mjs` normalizes completed Parallel and Claude/Opus records into one provider-neutral claim contract. The adapter requires supported completed campaign IDs, strict identity shape, stable completed-file snapshots, deterministic idempotency keys, source provenance, and review-required publication state.

No factory state, queue, raw result, launch agent, or concurrent Opus producer was changed. New Parallel spend is structurally and operationally zero.

