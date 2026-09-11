# Deployment and Rollback

## Active production

| Component | ID / readback |
|---|---|
| Railway project | `c0113625-951e-46ab-939b-dd57acc0e87c` |
| Environment | `549d6597-1962-44cb-b0f5-7d88bd025e31` |
| RISE app deployment | `49122e0d-76cf-4be6-933e-6a2e41ab95a4`, SUCCESS |
| App build | `rise_web_1d339438ec03` |
| Worker deployment | `0da35399-f4d3-424c-a4ba-46d0dbedef5a`, SUCCESS |
| Worker image | `sha256:c1307abe93a6a9ecebe0ce1ee6003c35c2f13a1e6a86415b9559cf624b1f2c44` |
| Registry release | `rise_registry_2026-07-09_8fdb5afb84f6` |
| Migration | additive `012_deep_research_dossier_v2`; RLS/constraints read back live |

## Safety state

Router revision 19: global false, student false, kill switch true, quota 30, combined cap `$12`, actual `$7.9987`, reserved `$0`, concurrency 1, primary Terra, no fallback/escalation. Sol and Parallel are paused. New Parallel spend is `$0.00`.

## Rollback

Code/runtime rollback target: `adf9f87df3ff47727e67a2eb86cca5349aed0545` (accepted 5012E baseline). Re-deploy that image/source to app and worker; verify app health and worker PID. The paired down migration is non-destructive and preserves evidence by disabling V2 access rather than deleting canonical data. Original provider claims, superseding review claims, audit events, job, spend ledger, and quota ledger remain append-only.

The Fable UI, WordPress/HQ/Matrix/LearnDash auth chain, and unrelated MissionMed products were not modified.
