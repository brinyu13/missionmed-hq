# 12 API, RPC, and Developer Ergonomics

RESULT: `BOUNDARIES_EXPLICIT_DEFAULT_OFF_AND_NOT_RELEASED`

## HTTP surface

The v2 route module defines `GET /api/mmc/v2/status` and is mounted in the shared HQ dispatcher indirectly: `missionmed-hq/server.mjs` imports `mmc-coaching-pipeline.mjs`, that compatibility module's predicate recognizes the exact `/api/mmc/v2/**` family, and its handler delegates those requests to the v2 gateway. Shared API authentication runs before dispatch, and route-specific private authorization plus the default-off gateway gate run inside the boundary. With the default configuration the mounted source path returns safe `503 MMC_V2_GATEWAY_DISABLED`; no v2 service was deployed. Contract tests prove that an explicitly enabled local status response reports API version, CAM v2 authority family, persistence truth, derived role, writer state, feature planes, section availability, freshness, environment, server time, and correlation ID without representing absent durable adapters/providers as available.

The same mounted-but-default-off module defines `POST /api/mmc/v2/commands` as a local contract harness, not an enabled, durable, deployed, or production command service. Its direct tests require private-session authorization, gateway and command feature flags, `FIXTURE`/`LOCAL` memory mode, the shared canonical RFC 9562 variant UUID parser (versions 1–8) for tenant/principal/command/target boundaries, admin role until persisted assignment authorization exists, string-typed CSRF session/header tokens, exact approved HTTPS origin, bounded strict UTF-8 JSON, and single-writer cutover authority. Valid uppercase UUID input is normalized before binding; v9 and type-coerced numeric IDs/versions fail closed. `STAGING` and `LIVE` reject the memory kernel. Of the seven typed command kinds, only local `task.upsert` has a built-in handler; every domain-owned command fails closed until its owning adapter is injected.

The route predicate recognizes only the exact `/api/mmc/v2` family; lookalikes such as `/api/mmc/v20` do not cross the boundary in direct or shared-dispatch tests. Historical pipeline and private UI routes on the shared server authenticate (and mutations cross CSRF) before returning a sealed `410` replacement pointer. MegaRun 007 should compose the local mentor UI, query contracts, and owning-domain adapters on the existing default-off bridge; it must not add a second mount or bypass the shared controls.

The shared dispatcher canonicalizes the URL pathname before any MMC, general API, or static-file branch. A malformed percent escape, decoded NUL/backslash, or decoded `.`/`..` segment receives a bounded `400` before routing; safely encoded ordinary separators and spaces are decoded once and routed by their canonical path. This prevents an encoded private path from bypassing the sealed mount through generic static serving.

## Response contracts

Query responses use exact `{data, meta}` envelopes and preserve `EMPTY`, `PARTIAL`, `UNAVAILABLE`, `REVOKED`, stale, and current truth rather than collapsing them to null. Public errors use one nested `{error: {code, message, retryable, correlationId, ...}}` envelope. Messages are bounded and redacted; diagnostics and retry delay are optional. Version conflicts may expose only the safe exact object `{expectedVersion, currentVersion, resolution: "COMPARE_AND_REAPPLY"}`.

Command success returns an aggregate version plus bounded object results, audit/correlation identities, status, and replay truth. Provider/native objects, paths, authority claims, SQL diagnostics, stack traces, and secrets never cross the public DTO.

## Durable SQL/RPC boundary

The additive migration defines claim-derived, bounded security-definer functions for worker claim/heartbeat/result/completion/recovery, typed producer→consumer input edges, and outbox claim/inbox effect receipt. Tenant, environment, principal, workload, queue, lease generation, and outbox lease generation come from signed application metadata and locked durable rows rather than request JSON. Authenticated direct table access is SELECT-only under forced RLS. Authenticated execution is limited to the reviewed worker/outbox/input RPC set; there is no runtime enqueue, canonical artifact-output, publication-approval/render, or general domain-command mutation RPC in 006.

The migration is LOCAL/STAGING/CI-build-target-only and unapplied to every configured MissionMed environment (`schemaApplied: false` in the file-mode validator). Its RPCs passed owner-seeded disposable PostgreSQL 16.13 fixture, rollback, catalog, and two-session lock proofs, but remain schema artifacts rather than an operational end-to-end service because no durable application adapter or configured database uses them. Exact database evidence belongs in reports 04 and 15.

## Developer ergonomics

- Shared frozen state, command, job, publication, and student-response vocabularies.
- Exact plain-object schemas with unknown-field rejection and byte limits.
- Exact JSON scalar types; no numeric/string coercion across command, job, or evidence contracts.
- One shared RFC 9562 UUID parser across route, command, and job boundaries; v7 accepted and v9 rejected.
- Deterministic clock, ID, authority, repository, and failure adapters for local tests.
- Opaque asset and authority handles instead of native paths or reflectable grants.
- Server-owned clocks for identity, assets, publication, and revocation checks.
- Machine-readable local test outputs suitable for a future CI evidence manifest.
- Deliberately unavailable domain handlers instead of misleading no-op success.

## Tradeoff and next boundary

One generic CRUD API would be shorter, but it would erase domain ownership and invite client-authored authority. The selected typed boundary creates more adapters, yet makes security review, error handling, idempotency, and backwards compatibility explicit. MegaRun 007 should generate the parity manifest, compose local owning-domain mentor adapters, and add query endpoints only for validated local CAM v2 mentor screens. Durable staging SQL/RPC composition belongs to MegaRun 009; student routes belong to MegaRun 008.

There is no general query API, mentor assignment adapter, production repository, worker daemon, provider adapter, authenticated student route, or operational CAM v2 UI in 006. No endpoint was deployed and no external state changed.
