# 11 v1/v2 Cutover and Rollback

RESULT: `SINGLE_WRITER_PROTOCOL_LOCALLY_VERIFIED`

## State machine

The cutover authority is tenant/environment scoped and begins `SEALED_NO_WRITER`. The in-memory JavaScript reference and durable SQL use the same phases but intentionally give the active state different names:

- JavaScript: `SEALED_NO_WRITER` → `SHADOW_READS` → `V1_FROZEN` → `V2_WRITER` → `FORWARD_REPAIR`.
- Durable SQL: `SEALED_NO_WRITER` → `SHADOW_READS` → `V1_FROZEN` → `V2_ACTIVE` → `FORWARD_REPAIR` (with the reviewed direct sealed-to-frozen preparation edge also permitted).

A durable cutover row must be born sealed with every feature plane false and no preclaimed reconciliation or acknowledgement evidence. Its progression is forward-only. Once SQL reaches `V2_ACTIVE`, its feature planes and fixed reconciliation evidence cannot be edited in place; incident shutdown proceeds only to `FORWARD_REPAIR`, never back to `SEALED_NO_WRITER`.

Historical v1 mutations are already sealed; v1 is not an emergency writer. The HTTP mutation branch returns `410`, and the shared server's low-level `insertMmcRow`/`updateMmcRow` helpers unconditionally throw before any Supabase write. Shadow reads require an exact count/hash reconciliation record. Freezing increments generation and issues an opaque lock. Switching to v2 requires exact reconciliation and zero in-flight v1/v2 commands.

## Feature planes

All planes default false and enable only in order: reads → commands → ingest → AI proposal → operational promotion → student publication. Disabling an earlier plane cascades to later planes. The gateway status is truthful: current read API remains unavailable even if a cutover object reports another value, and the local JavaScript gateway requires both `V2_WRITER` and the command plane. Durable SQL authorizes active-plane RPCs only in its equivalent `V2_ACTIVE` state.

## Command serialization

`runV2Command` holds the cutover transition lock across command execution. The command principal, request, and cutover authority must share exact tenant/environment. Only a new `COMMITTED` result increments acknowledged v2 writes; replays do not.

## Rollback law

- Before any acknowledged v2 write, the JavaScript reference can return to `SEALED_NO_WRITER`, clear its lock, and disable every plane. Before any configured SQL apply/external state, rollback remains file/commit/feature-flag scoped; the durable row does not gain a reverse lifecycle edge.
- After any acknowledged v2 write: rollback to v1 is forbidden because it would fork truth. The only permitted path is `FORWARD_REPAIR` with mutation planes disabled.
- No transition admits dual-write.

## Validation

Tests cover reconciliation mismatch, in-flight drain, default-off planes, pre-write rollback, post-write forward repair, command execution under the cutover lock, replay accounting, and cross-tenant/cross-environment principal attacks.

No cutover was performed outside memory/disposable PostgreSQL tests. Production remains unchanged.
