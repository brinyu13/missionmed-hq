# Deployment Report

Pinned isolated RISE target: project `c0113625-951e-46ab-939b-dd57acc0e87c`, environment `549d6597-1962-44cb-b0f5-7d88bd025e31`, app `9bce2090-ce45-4572-8291-e8da5d42acb6`, database `58236876-7616-4a6b-9792-bfdb114b51d8`.

Migrations 006/007, the 909-program rights-safe release, 925 SOAP claims, and 3,040 existing research claims were applied successfully. Isolated app deployment `dae9adf5-9c97-4908-97df-1a68e2a5d5cf` reached `SUCCESS` on image `sha256:1f326acd8328947167819673f39d94c5d3b4bb7d2067652d64548d9b05e209da` and passed health/protected-route checks.

Pinned shared HQ target: project `29afe885-b9b1-425d-8fd8-8611cd275409`, environment `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`, service `3d18b017-4fc9-4b22-b097-ba879816d374`. Reviewed candidate `7a4c59c75bcbb954dd4be433fcc236f2a007c1be` deployed successfully as `fc09ee0b-540e-49e3-9ece-40fdffe61670`, image `sha256:5ceb879f5f1e287657f739e32609721439adef61cbaf6f62efef640d1c674198`.

Eligible live QA exposed the WordPress authority mismatch, so mandatory provider-native rollback was executed:

- Shared HQ rollback deployment `b109b297-73da-476b-9424-e420bddef87b`: `SUCCESS`, exact prior image `sha256:12d7c914a504241c04899eab74a4aa3b95e4b5ade57cd08b0bbda03f60f02d7d`.
- Isolated RISE rollback deployment `0580e425-7462-4eb2-9901-f5f5c7cfd03b`: `SUCCESS`, exact prior image `sha256:87ff26522b3cdde1459ad35351c38b436e33749a20da3a1b701f7f16e3c77d2c`.
- Isolated config restored to 40 keys with names SHA-256 `9679f6ed2512b8eebf92671f21833986e7ea46d833f4fbab7d8ef01cc17c33a7` and values SHA-256 `79438476224941e0ed27499f11ab9849fe94125ba2917938f148768be8c800ef`.
- Active release pointer restored to `rise_rights_safe_hrsa_20260828_716fceb7d0ac` with 26 programs.

No WordPress file was changed. Product implementation custody is remote-exact at `2c27deb84f1a7b542ef5a700ec1fccc9f25a1c72`.

