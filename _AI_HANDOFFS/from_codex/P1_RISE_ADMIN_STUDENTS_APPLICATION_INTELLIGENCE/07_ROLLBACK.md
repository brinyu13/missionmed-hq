# Rollback

Application rollback target:

- deployment `ede2968f-cceb-4bd1-8de3-6a229f0cc926`
- image `sha256:c1faeb3fd40aed9b59d026d90bb5fa39b221991a1d63dfc23c78e8ef61408b77`
- build `rise_web_8a55c2a73ee5`
- asset manifest SHA-256 `7f1b2f2326a239e4cd47b03e39cb04f4a171f291fce180056a54e0acd73d0c0f`

Rollback procedure: restore the prior build and manifest pins, redeploy the immutable rollback image, verify health and anonymous fail-closed behavior, then run authenticated RISE smoke QA.

Migration 015 is additive. Application rollback safely ignores the added column/table. The checked-in down migration is intentionally non-destructive and does not erase student state or identity projections. Destructive schema removal is not part of rollback.
