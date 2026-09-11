# Claim Review Summary

## Corpus accounting

| Provider | Claims | Approved current | Approved historical | Not found | Superseded | Conflict | Insufficient |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude Opus | 1,723 | 478 | 11 | 15 | 746 | 72 | 401 |
| Claude Sonnet | 4,230 | 1,396 | 22 | 248 | 2,152 | 68 | 344 |
| Parallel | 4,126 | 946 | 15 | 334 | 2,354 | 41 | 436 |
| **Total** | **10,079** | **2,820** | **48** | **597** | **5,252** | **181** | **1,181** |

Every claim has exactly one current disposition. The reviewed target inputs comprised 1,236 source rows, 1,077 programs, and 5,156 newly evaluated claim variants. The 4,923 previously retained legacy variants were preserved and classified `SUPERSEDED`; no source claim was deleted or rewritten.

The review factory is deterministic and provider-neutral. It groups claims by canonical program identity and field, normalizes comparable values, evaluates source URLs and structured evidence, selects approved current/historical winners, records conflicts or insufficiency explicitly, and writes append-only review events plus promotion lineage. It never treats “not researched” as a negative fact.

Provider-native readback proves 10,079 current review rows, 2,820 promotion lineage rows, and 0 claims without a final disposition.
