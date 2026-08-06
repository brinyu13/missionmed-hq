# B1-512C Critical Systems and Stability

## Critical Systems

The release-only StoryForge pins in `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` were reconciled only after public bytes independently matched the deployed immutable release:

- Railway deployment/current commit/current release ID;
- Kinsta generated release, route, active pointer, and candidate release pin;
- public index hash;
- public app alias/hash;
- public styles alias/hash;
- extensionless active app alias route.

`python3 _SYSTEM/tools/critical_systems_gate.py --enforce --json` completed with **111 PASS, 0 WARN, 0 FAIL**.

## Bounded stability window

| Check | Result |
|---|---|
| Railway deployment | `d0756a3d-2284-46bc-ba1c-e2f75b3cd41c` SUCCESS, exactly one configured replica |
| Railway health | `/healthz` HTTP 200 |
| Recent 5xx query | zero entries from the bounded 500–599 Railway HTTP-log query |
| WordPress route | HTTP 200, `no-store, max-age=0`, `wordpress-gateway` route behavior |
| Public release bytes | index/app/auth/styles each matched release-manifest SHA-256 |
| Database post-state | 13-row ledger with B1-512 exactly once; user/story counts unchanged; FORCE RLS four-of-four |
| Private-media residue | zero rows; zero unresolved deletion intents |

No sustained HTTP 5xx, unexplained API error, or cross-user exposure was observed in the bounded cutover window. The two corrected local execution errors were non-production: one shell quoting error before a request was made, and one browser locator capitalization mismatch. Both were immediately diagnosed and did not mutate production state.
