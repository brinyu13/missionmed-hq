# P1-RISE-5012A Infrastructure Readback

Production project `c0113625-951e-46ab-939b-dd57acc0e87c`, environment `549d6597-1962-44cb-b0f5-7d88bd025e31` contains three healthy one-replica services:

| Component | Service | Deployment | State |
|---|---|---|---|
| RISE app | `9bce2090-ce45-4572-8291-e8da5d42acb6` | `507178ef-7f15-4d01-901b-e7d1b76167ec` | SUCCESS / RUNNING |
| Research worker | `a2cab443-b683-4a23-8f32-bf1351015f42` | `17af3214-8f51-483e-a82b-25a1efe330f1` | SUCCESS / RUNNING |
| PostgreSQL | `58236876-7616-4a6b-9792-bfdb114b51d8` | `b55827d6-9df2-4ec5-a955-96362ca444d0` | SUCCESS / RUNNING |

Direct health returned HTTP 200 with service `missionmed-rise`, active registry `rise_registry_2026-07-09_8fdb5afb84f6`, build `rise_web_79b4dd0f59a8`, production environment, current source rights, and `production_postgres` On-Demand storage.

Migration 011 is present through live schema behavior: the spend ledger, benchmark job fields, Terra/Sol provider rows, and hard spend constraints exist. Seven `rise_runtime.research_*` tables have RLS enabled; the router, provider, quota, job, and spend tables have RLS forced. Live constraint readback proved the combined $12.0000 cap, per-provider actual-plus-reserved caps, and benchmark/program-job shape separation.

The durable control plane contains atomic quota ledgers, unique job dedupe keys, immutable attempts/audit/spend events, bounded worker leases with heartbeats, failure refunds, provider-neutral adapter selection, canonical review/promotion handoff, and server-side scope/lifecycle/budget/concurrency gates. Zero active jobs and zero reserved spend remained after seal.

The code PATH lease was normally released before commit. Provider-native readback for lease `93da609c-f5ea-4fd5-8cbd-18c5ad03bb92`, epoch 1925: `released=true`, `expired=true`, `active=false`. One transient heartbeat transport failure recovered through a successful path revalidation before release; no lease was overridden.
