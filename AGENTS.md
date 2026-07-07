# MissionMed Product Agent Boot

Resolve `${MMOS_ROOT:-~/MissionMed_OS}` and follow `BOOT.md`.
If the folder is absent, clone `brinyu13/missionmed-os` there, then follow `BOOT.md`.
Mission ID comes from the task prompt or `CURRENT.md`.
Product passports live in `PRODUCT_PASSPORTS/`.
Load only the mission record, passport, and authority docs routed by BOOT.

Hard stop rules:
- Stop on protected path touch without a decision record.
- Stop on unresolved authority conflict.
- Stop on stale Matrix runtime warning.
- Stop when CURRENT is stale and the task depends on current state.
- Stop before secrets, tokens, keys, credentials, or env values enter files.
