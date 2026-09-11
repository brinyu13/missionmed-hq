# Provider Approval Decision

| Provider / model | Task class | Critical-field quality | Roster quality | Source quality | Unsupported certainty | Avg latency | Corrected-batch cost | Decision |
|---|---|---|---|---|---|---:|---:|---|
| OPENAI_TERRA / gpt-5.6-terra | PROGRAM_DEEP_RESEARCH | 81 FOUND; 21 researched-not-found; 2 conflicts | 5 found, 2 not found, 1 conflict | 104/104 source-backed | Conflict/unknown states retained | 39.097 s | $1.0251 | PRODUCTION_APPROVED |
| OPENAI_SOL / gpt-5.6-sol | PROGRAM_DEEP_RESEARCH | 81 FOUND; 21 researched-not-found; 2 conflicts | 3 found, 5 not found | 104/104 source-backed | Conflict/unknown states retained | 67.972 s | $1.7643 | PAUSED |

Terra matched Sol's aggregate resolution and conflict discipline, found more resident rosters, and was about 42% faster and 42% cheaper in the corrected paired batch. Terra therefore won the current full-program research task. Sol remains implemented and administratively selectable but is disabled, network-off, spend-off, and PAUSED. There is no automatic fallback or escalation route.

| Program | Frozen Parallel baseline | Terra result | Sol result | Winner / notes |
|---|---|---|---|---|
| 1201100747 | 16 claims / 8 domains | 8 found, 5 not found | 9 found, 4 not found | Sol one-field edge |
| 1201611100 | 16 / 8 | 10 found, 3 not found | 7 found, 4 not found, 2 conflicts | Terra |
| 1204821305 | 16 / 8 | 11 found, 2 not found | 12 found, 1 not found | Sol one-field edge |
| 1400400928 | 16 / 8 | 10 found, 3 not found | 10 found, 3 not found | Terra on cost/latency |
| 1401121528 | 16 / 8 | 11 found, 1 not found, 1 conflict | 11 found, 2 not found | Comparable; Terra operational edge |
| 1403100500 | 16 / 8 | 7 found, 6 not found | 7 found, 6 not found | Terra on cost/latency |
| 1403321227 | 16 / 8 | 12 found, 1 not found | 13 found | Sol one-field edge |
| 1403511262 | 16 / 8 | 12 found, 1 conflict | 12 found, 1 not found | Comparable; Terra operational edge |

The two final paired batches cost $5.5660 in completed calls. Three interrupted provider lifecycles were conservatively charged at $1.8000 unknown cost, and the earlier measured batch contributed the remainder. Total paid benchmark charge in the immutable ledger is $7.5144. Holdout A added $0.1449, producing final combined actual spend $7.6593.
