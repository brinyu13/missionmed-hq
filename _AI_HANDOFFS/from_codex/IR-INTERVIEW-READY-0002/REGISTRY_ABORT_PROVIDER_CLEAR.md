# Aborted Registry transaction: independent provider-clear

Verdict: **OLD IR REGISTRY TRANSACTION CLEAR AT READBACK**. Independent reviewer `phase1_registration_contract_review` (Sol6.1 High), source base `53832d2`, readback 2026-10-04 approximately 17:56–17:58 UTC. Foreman reported session `15738` exited after `REGISTRY_RELEASED_AFTER_STOP` / `REGISTRATION_STOP RuntimeError`; that process output alone was not treated as provider-clear.

Provenance: authorized Supabase MCP `execute_sql`, fixed coordinator project `brxqytrfdisrgakrxkhd`. Only bounded SELECTs were executed: relation/allowlisted lifecycle-column discovery, aggregate status/count reads and caller-role metadata. Effective metadata-read role was `postgres`, as supplied by this existing MCP connection; no role change, new credential, permission grant, DML, RPC invocation, secret/nonce/private-JSON selection, or raw function response occurred. Discovery established the tables in `missionmed_ops`, rather than `public`.

Actual provider results:

| Check | Result |
| --- | --- |
| Old lease `f9ae9b61-62f6-4654-a3d8-b2f46926c815`, epoch 4657 | 1 matching row; 1 released row; 0 active rows |
| Active `REGISTRY` claim for that lease or exact IR owner/session | 0 |
| Waiter rows for old lease or `codex-ir-phase1-foreman` / `ir-phase1-20261004-registration` | 1 retained granted-history row |
| Live pending IR waiter (`granted_at IS NULL`, future deadline) | 0 |
| Expired pending IR waiter | 0 |
| Other unexpired, unreleased lease rows | 2; preserved without mutation |

Active means unreleased with future expiry. The retained granted waiter is historical, not a live pending waiter; this receipt does not falsely claim deletion or zero historical rows. Other leases were counted only, not independently certified for heartbeat health or changed.

Independently rechecked the original canonical clone: HEAD remains `95a188b9cc30655b374f580775e7dc77be6d7f7a`, exactly the original nine paths remain staged, and both index and worktree hashes still match `REGISTRY_STAGED_CANDIDATE.json`. No canonical commit/push or stage rewrite occurred in this review. The original HOLD and frozen evidence remain intact.

This clears only the aborted transaction at this snapshot. It does not approve a new acquisition, retrieval/probe, corrected registrar, staged candidate, canonical custody, or protected product work. The evidence-copy/hash correction and a fresh clean candidate remain subject to their separate exact reviews and normal guards. Only this report is committed locally; dirty packet/checkpoint, receipts, CLI scratch and unrelated inputs are preserved. Stop; no push or merge.
