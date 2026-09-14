# Provider/model forensics

## Historical provider dispositions (not apples-to-apples)

| Provider | Programs in source artifact | Retained claim variants | Approved current | Approved historical | Conflict | Insufficient | Researched not found | Superseded |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CLAUDE_SONNET | 695 | 4230 | 1396 (33%) | 22 | 68 (1.6%) | 344 (8.1%) | 248 (5.9%) | 2152 |
| PARALLEL | 271 | 4126 | 946 (22.9%) | 15 | 41 (1%) | 436 (10.6%) | 334 (8.1%) | 2354 |
| CLAUDE_OPUS | 270 | 1723 | 478 (27.7%) | 11 | 72 (4.2%) | 401 (23.3%) | 15 (0.9%) | 746 |

The Sonnet, Parallel, and Opus numbers reflect different prompts, domain scopes, eras, and validation rules. Approval rate is not a model leaderboard by itself. Historical provider union was 1,077 unique ACGME program IDs across 1,236 provider-program rows; the current matrices rejoin those IDs to the deployed 6,139-program index.

## Controlled Terra vs Sol benchmark

| Provider/model | Jobs | Findings | Found | Not found | Conflicts | Mean latency | Final-row artifact cost | Approx cost/program |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| OpenAI Terra / gpt-5.6-terra | 8 | 104 | 81 | 21 | 2 | 39.1 sec | $1.0251 | $0.1281 |
| OpenAI Sol / gpt-5.6-sol | 8 | 104 | 81 | 21 | 2 | 68.0 sec | $1.7643 | $0.2205 |

The corrected paired batch was about $5.566 across lifecycle retries; the sealed total later reached $7.6593 including Holdout A. Terra was faster and cheaper for this tested 13-field task. Holdout A cost $0.1449, produced 13 claims / 12 approvals, and moved Basic to Enriched. Holdout B Dossier V2 cost $0.3394, took 653.1 seconds, produced 21 findings over 18 attempted domains, and remained Enriched/Partial after a roster repair.

## Engine assessments

### Parallel

- Strength: broad, high-volume multi-domain corpus; 271 programs / 2,063 original claim variants, later 4,126 retained variants.
- Weakness: historical approved-current rate 22.9%; 2,354 superseded variants; exact runtime/currency per program unavailable.
- Use: $0 reconciliation of stored results; optional future retrieval comparison after a controlled re-benchmark.
- Do not use: default paid route without a fresh cost/quality benchmark. Existing reserved second tranche remains paused.

### Claude Sonnet

- Strength: broad Phase A coverage across nine specialties, especially Family Medicine; 695 programs / 2,116 initial variants, later 4,230 retained variants.
- Weakness: shallow domain scope in the Phase A reconciliation (principally leadership and roster in many rows); the 695 was not all IM.
- Use: $0 reuse and targeted reconciliation.
- Do not use: assume Phase A row presence equals current Deep completeness.

### Claude Opus

- Strength: high-depth manual packages; 270-program corpus and later 34-program TX/FL Adult Neurology package (884 facts, 566 residents, 212 leadership, 636 faculty, 4,032 source rows).
- Weakness: expensive/slow token footprint when measured in the TX package (~3.74M tokens for 16 Texas programs; currency cost not exposed) and not self-verifying—a fabricated high-confidence NMSS designation was caught only by adversarial sibling review. Florida received stronger adversarial validation than Texas.
- Use: hard-conflict escalation and bounded high-consequence dossiers with independent validation.
- Do not use: unattended bulk default.

### OpenAI Terra

- Strength: best measured speed/cost for the controlled MissionMed 13-field benchmark; good primary DELTA/full-dossier candidate.
- Weakness: Dossier V2 quality was not sufficient for unreviewed six-specialty activation; requires deterministic and adversarial validation.
- Use: primary paid research lane after explicit authorization.

### OpenAI Sol / GPT-5.6 Sol

- Strength: capable independent comparison/escalation model.
- Weakness: slower and more expensive than Terra in the only controlled paired RISE benchmark.
- Use: selective conflict escalation or periodic benchmark challenger, not routine primary.

### Codex

- Strength: deterministic identity reconciliation, schema validation, normalization, promotion, database/file readback, and cross-source QA.
- Weakness: not a substitute for an evidence source or an independent human sign-off on ambiguous high-consequence claims.
- Use: normalization/promotion and adversarial rule execution.

## Error/retraction evidence

Six source-package retractions were preserved in the TX/FL hydration work. A precise provider-level retraction rate cannot be computed because the current production review ledger is empty and historical retractions are not mapped to the provider-level disposition summary. Do not represent this as zero.
