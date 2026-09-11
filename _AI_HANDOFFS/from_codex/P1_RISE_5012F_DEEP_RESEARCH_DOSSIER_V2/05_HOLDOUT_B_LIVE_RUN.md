# Holdout B Live Run

| Item | Production readback |
|---|---|
| ACGME ID | `1851113100` |
| Program-specialty ID | `rise_ps_b5dfed79-696b-512d-b8d1-0daf0c570532` |
| Canonical program ID | `rise_prg_ca9967ac-479e-5f64-8d3e-1d60672b84e5` |
| Job | `56303671-4983-4d79-b622-c35bf994b453` |
| Route | `OPENAI_TERRA / gpt-5.6-terra` |
| Request | `FULL`, contract `2.0.0` |
| Result schema | `missionmed.rise.deep-research-dossier.v2` |
| Created / completed | `2026-09-11T20:09:36.356Z` / `2026-09-11T20:20:29.491Z` |
| End-to-end | 653.1 seconds |
| Outcome | `PARTIAL`, completion `0.9295` |
| Actual cost | `$0.3394` |
| Findings / web searches | 21 / 7 |
| Canonical ingest | `abebf8ac-2265-455c-bcac-7adcd9a9840d` |
| Provider response | `resp_003e70f90716c6a7016aa462190c1887d0a37a02e50343cfb0` |

Live path: authenticated request -> quota reservation -> durable job -> isolated async worker -> Terra -> structured Dossier V2 -> review/promotion -> shared Program File and filter/search projection. Balance moved from 1 used/29 remaining to 2 used/28 remaining exactly once.

Provider spend readback at seal: combined actual `$7.9987` of `$12.0000`, reserved `$0.0000`; new Parallel spend `$0.00`.
