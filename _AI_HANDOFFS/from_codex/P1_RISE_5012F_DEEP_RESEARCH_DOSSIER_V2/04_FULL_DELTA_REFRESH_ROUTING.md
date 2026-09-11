# FULL / DELTA / REFRESH Routing

The server computes request class from canonical Dossier V2 state:

- `FULL`: no V2 dossier; requests every required domain and its mapped fields.
- `DELTA`: meaningful enrichment exists; requests only missing/unresolved V2 domains.
- `REFRESH`: Deep dossier exists but freshness-sensitive domains are stale; requests only volatile/high-value domains.
- `NO_OP`: current Deep dossier or matching active job; no quota or spend.

Dedupe keys bind program, provider route, task class, request class, field set, and quota window. New canonical evidence automatically changes profile, depth, filters, and search without a frontend program list.

Production route at seal: `OPENAI_TERRA / gpt-5.6-terra`; Sol paused; Parallel paused; replay adapter test-only/offline. Global and student execution are off and the emergency kill switch is on.
