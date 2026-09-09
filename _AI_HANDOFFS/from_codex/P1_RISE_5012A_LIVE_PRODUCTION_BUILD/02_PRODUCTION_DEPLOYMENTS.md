# Production Deployment Receipts

## Current live services

| Component | Service ID | Deployment ID | Image digest | Status |
|---|---|---|---|---|
| RISE app | `9bce2090-ce45-4572-8291-e8da5d42acb6` | `e12fed77-9e74-400b-ac7f-1b528d91ef0e` | `sha256:2a596b5e16ddb2c30a98a75e0412e414e5af6b7ad89c6fde257034c183fbda7a` | SUCCESS |
| Research worker | `a2cab443-b683-4a23-8f32-bf1351015f42` | `da51d547-fb40-4e69-b19d-6d0c8d82dede` | `sha256:61d3becba0346dd75290332cb2198de135239b2d35dee5b6adeaf1955f78b3ad` | SUCCESS |

Railway project: `c0113625-951e-46ab-939b-dd57acc0e87c`
Environment: `549d6597-1962-44cb-b0f5-7d88bd025e31`
Database service: `58236876-7616-4a6b-9792-bfdb114b51d8`

Final app health readback returned `ok=true`, build `rise_web_da1eaa04132e`, registry release `rise_registry_2026-07-09_8fdb5afb84f6`, production PostgreSQL storage, and fail-closed controls. Final worker logs reported `rise_research_worker_started`, available provider `RISE_REPLAY_TEST`, polling at 5000 ms, and spend `0`.

Notable contained failures: an early app candidate failed health before traffic when a stricter source-rights behavior diverged from the protected live baseline; it was corrected without changing auth. The first new worker deployment used the wrong workspace root, ran no RISE jobs, and was removed. Later upload/config failures had no associated build or traffic. These failures did not replace the active app, mutate canonical evidence, or spend provider funds.

Code push is remote-exact at `4532feb5b1e1e698944f58f40a436d9de97ecc19`.
