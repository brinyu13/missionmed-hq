# IM + FM cost/time forecast

No work below is authorized by this report. Ranges use observed Terra costs ($0.128/program for the 13-field benchmark, $0.145 Holdout A, $0.339 Dossier V2 Holdout B) and explicitly add validation/retry uncertainty.

| Plan | Programs requiring paid work after $0 reuse | Approx calls | Provider mix | Spend range | Provider wall time at controlled concurrency | Review burden | Expected result |
|---|---:|---:|---|---:|---|---|---|
| A — minimum viable high-yield | 993 maximum; prioritize only missing requirements, visa, roster/composition, leadership and differentiators | 993 targeted DELTA calls maximum | Terra primary; Sol/Opus <5% exceptions | $90–$220 | 2–6 hours at concurrency 8–12 | 2–4 reviewer-days | Every worked row gains high-value fields; depth may remain Enriched where optional domains are absent. |
| B — full current Deep | 993 after reuse candidates, subject to reconciliation results | 993–1192 | Terra full/delta; Codex validation; Sol/Opus exceptions | $180–$520 | 4–12 hours | 4–8 reviewer-days | Target 1504 canonical-supported Deep, with conflicts retained rather than forced. |
| C — tiered national | Roughly 547 paid rows after high-demand selection | 547–696 | Terra targeted/full by tier; on-demand long tail | $110–$320 | 3–8 hours | 3–6 reviewer-days | High-demand set Deep; remaining useful rows Enriched; long tail on-demand. |

## Risks

- Current source-type projection emits 0 Deep/0 Enriched even though canonical facts support 237 Deep and 433 Enriched across exact IM/FM. Fix this before spending.
- Per-program review exceptions cannot be reconstructed from the current empty ledger. Historical review artifacts must be reconciled before treating promotion-only candidates as approved.
- Provider prompts/scopes differ, so a claimed per-program price must be re-verified on the next authorized batch.
- Concurrency cannot outrun review, source quality, or provider rate limits.
