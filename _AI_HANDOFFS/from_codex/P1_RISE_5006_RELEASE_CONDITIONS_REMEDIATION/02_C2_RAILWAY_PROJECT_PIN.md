# C2 — Railway Project Pin

Result: **PASS**

## Exact provider target

```text
project = missionmed-rise-production
project_id = c0113625-951e-46ab-939b-dd57acc0e87c
environment = production
environment_id = 549d6597-1962-44cb-b0f5-7d88bd025e31
service = missionmed-rise
service_id = 9bce2090-ce45-4572-8291-e8da5d42acb6
database_service = Postgres
database_service_id = 58236876-7616-4a6b-9792-bfdb114b51d8
```

Provider-native readback from `rise/` shows the RISE project, production environment, isolated service, and attached Postgres service. Current RISE deployment `b0301470-ec0a-4e03-9340-2b06fda4befb` is `SUCCESS` with a `RUNNING` instance. Postgres deployment `b55827d6-9df2-4ec5-a955-96362ca444d0` is `SUCCESS`, its instance is `RUNNING`, and volume `38745ae2-1b6d-4174-9515-af9a5661ddf5` is `READY`.

## Mechanical guard

`rise/tools/assert-railway-project.mjs` verifies the exact project, environment, service, cwd linkage, and rejection of inherited parent-directory linkage. `npm run verify:railway-target` passed. Its three contract tests prove:

1. the isolated RISE target is accepted;
2. `missionmed-hq-fix005` is rejected;
3. an inherited parent link is rejected.

`npm run deploy:production` calls the guard first and then supplies the exact project, environment, and service identifiers to `railway up`. The deploy uploads from the repository root with `/rise/railway.json`, matching the provider's `/rise` root-directory contract.

C2_RAILWAY_PIN_PASS = YES
