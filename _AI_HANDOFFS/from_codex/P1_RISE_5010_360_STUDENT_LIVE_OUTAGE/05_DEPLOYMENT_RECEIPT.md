# Deployment and Provider Receipt

## Shared HQ target

- Railway project: `29afe885-b9b1-425d-8fd8-8611cd275409`
- environment: `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`
- service: `3d18b017-4fc9-4b22-b097-ba879816d374`
- domain: `missionmed-hq-production.up.railway.app`

## Active repaired deployment

- deployment: `fefc56c4-5c0e-41c5-96fc-6493a1d966af`
- created: `2026-09-08T16:25:18.104Z`
- status: `SUCCESS`
- reason: `redeploy`
- image: `sha256:8e16a5a1263f0cb280cdb9f40a9c9a0547e62299cff070ffbd055599ce960288`
- healthcheck: `/health/lor-studio`
- runtime source lineage: `c3d6c9cd12d4838fed6bb699fe9d574956ab15e7`

Provider and live readback:

- `/api/health`: HTTP 200, service `missionmed-hq`
- `/health/lor-studio`: HTTP 200, status `ready`
- anonymous `/api/auth/session?audience=rise`: HTTP 200, authenticated false
- `/api/auth/start?audience=rise`: HTTP 302 to the WordPress `mmed_rise_auth_redirect` action
- HTTP 5xx count since cutover: 0
- application error-log count since cutover: 0
- Railway variable-name inventory unchanged: 147 keys, matching SHA-256

## RISE target readback

- project: `c0113625-951e-46ab-939b-dd57acc0e87c`
- environment: `549d6597-1962-44cb-b0f5-7d88bd025e31`
- service: `9bce2090-ce45-4572-8291-e8da5d42acb6`
- active deployment: `42fc0ec3-3dfc-4e0a-a517-4b158b98fcb6`
- status: `SUCCESS`, one running instance
- health: HTTP 200
- build: `rise_web_15b0c71f1bf7`
- registry release: `rise_registry_2026-07-09_8fdb5afb84f6`
- activation: `active`
- environment: `production`
- source rights current: true

## Lease V2 and temporary credential cleanup

- scope: `SHARED:AUTH`
- lease: `32495778-7da8-424c-86c5-d48720c85f6f`
- fencing epoch: `1516`
- provider SQL: `released=true`, `expired=true`, `active=false`, `active_lease_count=0`
- the temporary secret API key `mmos_lease_runtime_20260908_p1_recovery` was deleted after release
- provider UI readback after deletion: recovery key absent; only the pre-existing `default` secret-key name remains

No secret value, cookie, or live session token is present in this evidence package.
