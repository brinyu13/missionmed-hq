# Independent set7 admission expiry evidence — 2026-10-05

Verdict: CLOSED EXPIRED ADMISSION; preserve all records, no reuse. Reviewer: `/root/inventory_exact_admission_reviewer`.

Set7 frozen HEAD `cd14bfa19fe94246dde681892804de099c756e20`; canonical binding `77841096ca6f07deb3e25f4c1a26fe37231968c67472747c0488b84672c49017`. Actual provider observation Unix `1791206719.94878`; initial READY freshness deadline Unix `1791207019.94878` (2026-10-05T13:30:19.948780+00:00). These immutable times are unchanged.

The exact owner pair was locally consumed at receipt filesystem mtime Unix `1791207147.8356643` (2026-10-05T13:32:27.835664+00:00), `127.886884` seconds after the provider deadline. Public receipt `NATIVE_INVENTORY_OWNER_20261005_7_PRIVATE_1/CONSUMED.json` SHA `d8ab0559f1da4bfcea85a7bb8247dc81b8f516e38f1c4e88a814517beada65d9` contains only its fixed schema and the exact owner approval/read hashes; those hashes independently match the preserved pair. Owner receipt creation precedes wrapper import/execution in the unchanged owner implementation.

`runtime_native_runner.py:278` requires `admitted < observed + 300`; `validate_controls` at line292 invokes this check using actual current time. At this later owner consumption timestamp and subsequent wrapper validation, install_clear_fresh necessarily rejects the original observation. Owner pair expiry and provider-clear freshness are distinct checks; a successful owner pair consumption cannot extend provider freshness.

Local `NATIVE_INVENTORY_20261005_7_AUTH_INVENTORY_CONTROL_1` remains absent, and the exact wrapper read-consumption marker remains absent. `NATIVE_INVENTORY_20261005_7_PUBLIC_FACTS.jsonl` is exactly28 bytes, fixed `NATIVE_INVENTORY_OWNER_STOP` plus newline, SHA `4cac9c0932ea7500c6c6a5841e0c9133122268e4916c41a1d339e48fb7e3588d`. The preserved receipts and unchanged code order show admission stopped before inventory directory creation, private transport retrieval/probe, lease acquisition or WordPress execution. No new provider query was necessary or made for this conclusion. No actual runtime failure or child cause is attributed to set7.

The original seal/dormant validation passed while fresh, then execution exceeded that same unchanged300-second window. No observation was retimed, refreshed or reissued; no consumed pair is reusable. Set7 history, public output and owner directory are preserved.

## Forthcoming scheduling arrangement

DR-375:15 expressly delegates independent review and canonical admission/deployment steps; :17 retains fresh exact leases, manifests, qualified recovery and independent exact acceptance. DR-376:29 preserves private custody, fencing and forbids implied automatic retry/renewed approval; :33 retains fresh BOOT, provider and live-release gates. A manually prearmed single-shot Root entrypoint that waits only for one distinct future manually approved packet, independently verifies its exact hashes/source/snapshot/freshness, then execs the unchanged reviewed owner while preserving PTY stdin creates no authority conflict by scheduling alone. Root's explicit launch and the future independent exact controls remain the execution authority.

This is an authority assessment of the proposed arrangement, not exact-code approval. The forthcoming program must be reviewed before prearming. No automatic observation, acquisition retry, reissuance, timeout relaxation, replay, account action or approval creation is admitted. No set8 control or entrypoint was created, qualified, consumed or executed by this reviewer.
