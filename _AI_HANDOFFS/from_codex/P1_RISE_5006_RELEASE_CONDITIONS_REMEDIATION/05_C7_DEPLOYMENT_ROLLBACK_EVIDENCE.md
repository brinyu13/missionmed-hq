# C7 — Deployment and Rollback Evidence

Result: **PASS**

## Pre-activation state

### Shared HQ

```text
release source commit = 258a375c479b034348ae68196255e5439ac94af3
deployment = 98bf0bda-5d96-4c1f-a243-e2a692210e66
image = sha256:8382319660ba8f9a07b2003d1eb17321cd6aa271a59e9bde22cc83e7c09ddb4e
```

### WordPress/Kinsta

- All three RISE MU-plugin files were absent.
- `MMED_RISE_ORIGIN` and `MMED_RISE_HQ_ORIGIN` were absent.
- Preimage `wp-config.php` SHA-256: `320c9eb0925f71bc4cef3ce43f36e5f08383e29c6daddb1d76f37157464afb77`.
- Private backup: `/www/theresidencyacademy_209/private/p1-rise-5006-backups/20260828T134900Z/`.
- Backup manifest SHA-256: `b17a4cda677b35d3635b1038dcefb04b057faae816d417eaa33bda9bdd9d4f27`.

### Isolated RISE

```text
prior deployment = 4d66f58f-b7e8-406c-bae8-2e7e621f462d
prior image = sha256:0851d6aab8c138f053c6a422123cda48935728eda1a6a36200c50c86028155ea
prior RISE_BUILD_ID = rise_web_c474ac3cfcc2
prior RISE_ASSET_MANIFEST_SHA256 = 62b2816b8f108f7f2fe074c0ac4587b86e987c1665a539ba397ae2b649d21c59
```

## Activated state

### Shared HQ

```text
source branch = codex/p1-rise-5006-hq-runtime
source commit = 02e68714fa11bc472bd170d56aff747f3de4f2fa
deployment = de50e87b-54a3-446c-bb46-6585027d4311
image = sha256:f113c14ba8a55c53b01dffea4dc6fb2a9b39e4bdbc58abd6ee0b3fe712ad063d
status = SUCCESS / RUNNING
```

The source branch is pushed and byte-addressable. The deployment was built from the authoritative live lineage, not an older server-byte donor.

### WordPress/Kinsta

```text
wp-config.php = b2869cef8b078e68d46e89aa5298946ae82f6907169b5ef1a5c1821f7a288f0e
missionmed-rise-route.php = 5fcfceb9e5ddc70da8575b78860738efedfa1478327b2c215b537b124b42f13f
missionmed-rise-sso.php = 23a26612fea0587773c14e1a614991babb817ee749dc9d06862bdf41b5450370
missionmed-matrix-rise-entry.php = c4fb7aa80810aa7a4a8e09fc2695eb6e8b3d8322060d90f06d8c71d1db6aa0d9
```

The two configured origins are HTTPS provider domains. The handoff secret remains server-side and is not recorded in this package.

### Isolated RISE

```text
project = c0113625-951e-46ab-939b-dd57acc0e87c
environment = 549d6597-1962-44cb-b0f5-7d88bd025e31
service = 9bce2090-ce45-4572-8291-e8da5d42acb6
deployment = b0301470-ec0a-4e03-9340-2b06fda4befb
image = sha256:87ff26522b3cdde1459ad35351c38b436e33749a20da3a1b701f7f16e3c77d2c
status = SUCCESS / RUNNING
build = rise_web_08a83ea8553d
asset manifest = f1bf187169dbc0a7665f7aaac26121e4f4a0b7d1ae75b03fc4ba1bd15191f5b3
domain = https://missionmed-rise-production.up.railway.app
```

The earlier `2cd27394...` attempt failed during config snapshot before build because the upload root did not include `/rise/railway.json`; it never replaced production. Later deployment used the repository root and succeeded.

### RISE PostgreSQL

```text
database service = 58236876-7616-4a6b-9792-bfdb114b51d8
deployment = b55827d6-9df2-4ec5-a955-96362ca444d0
volume = 38745ae2-1b6d-4174-9515-af9a5661ddf5
volume state = READY
backup name = P1-RISE-5006-PRE-ACTIVATION-20260828T132134Z
backup id = b950cadf-124c-4d64-84a9-02c28fefc7bc
external id = vs_1787923306193_0rp37gzleadl1o9s
created = 2026-08-28T13:21:46.224Z
locked = true
expires = never
```

Migration 005 is present; runtime verification proves the current least-privilege role, forced RLS, and rollback of synthetic test rows.

The exact rollback sequence and commands are in `09_ROLLBACK.md`.

C7_ROLLBACK_EVIDENCE_PASS = YES
