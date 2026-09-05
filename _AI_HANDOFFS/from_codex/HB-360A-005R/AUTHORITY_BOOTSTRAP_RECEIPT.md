# HB-360A-005R Authority Bootstrap Receipt

Status: ACTIVE AND PROVIDER-READ-BACK

- MissionMed OS start: `275b92a0a72cd4bd9477ca8ba0e0118917d9fe9e`
- MissionMed OS registration commit: `c0e0710112ccecd04e630e7aa4011d2936dab1ab`
- MissionMed HQ dependency commit: `e71b3902f40e82e4d27813cc54aa836bc13d2c35`
- Decisions: `DR-187`, `DR-188`
- Product route: existing Matrix product and `PRODUCT_PASSPORTS/matrix.md`; no duplicate HomeBase product
- Mission record: `HB-360A-005R`, active, local protected track
- Mission BOOT profile: `HB-360A-005R`
- Generated CURRENT: contains active `HB-360A-005R`
- Universal BOOT: PASS
- Mission BOOT: PASS
- Global lint: PASS
- Report-only enforcement: PASS, exit zero with expected protected-path and hash findings
- Canonical remote readback: OS `origin/main` equals `c0e0710112ccecd04e630e7aa4011d2936dab1ab`
- Registration REGISTRY filing fence: `1262`, released successfully
- Explicit mission output PATH fences: `1263` proved V2 PATH ownership and expired before custody; fresh fence `1264` filed this receipt; provider readback found no live REGISTRY waiter
- Founder bootstrap SHA-256: `cfbe44b56d27a4b08508879a75a015c29f79d79ce0f976e785923b19c9f0568e`
- QA-patched dispatch SHA-256: `d16078c4101638803826c3d7b830edfa616461a8af5cc0ccecc220726136ac22`

The QA-patched seven-package remediation may now resume under DR-187/188.
This is not authorization for HB-360A-005D feature implementation and is not
a claim that HomeBase Wave 2 or the HomeBase production build is complete.
