# IR Lease authentication diagnosis — bounded read-only review

Date: 2026-10-04. Reviewer: `/root/lease_transport_diagnosis`. Assignment: read-only provider/CLI diagnosis; write and commit this report only; no push/merge. Assigned product base `44faf75`; OS base `1e8374664751ad911280d83d8c60e200a224245d`; project `brxqytrfdisrgakrxkhd` (`missionmed-os-coordination`).

## Verdict

BLOCKED — existing credential authentication has not been established. Supabase CLI 2.75.0 has a source-confirmed limitation: its API-key listing omits the Management API `reveal` query parameter and exposes no `--reveal` flag. This establishes an existing-secret retrieval limitation, not the exact cause of either reported 401. No credential, provider, OS, runtime, client, header, lease or registrar mutation was performed here.

Do not label this incident a proven masked-key failure. The settled evidence supplied by Foreman says the legacy JWT was unmasked, project/role matched and expiry was valid, and the existing named secret passed the stated non-mask/length predicates. Neither decoded claims nor those string predicates verify signature, current gateway acceptance, revocation state or completeness. This review retrieved no credentials and cannot establish those properties.

## Evidence and custody

- Read product AGENTS.md, canonical OS BOOT and CURRENT, routing registries and current independent contract review/addenda. IR mission, product passport and boot profile remain absent at the inspected OS snapshot; the existing independent review records this prerequisite. No pull/fetch was performed because this assignment forbids OS mutations. Current remote freshness remains a registrar prerequisite; no registration authority was created by this report.
- Universal boot validation passed: `BOOT_DEPENDENCY_VALIDATION_PASS profile=universal hq_tip=0feee579b0a9f2c90529220899f6cf6d21b8cd05`. Read immutable HQ `origin/main:_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`; accepted SHA256 is `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- Installed `supabase projects api-keys --help` identifies installed version 2.75.0 and offers `--project-ref`, with no reveal option. No API-key listing or authentication probe was executed by this reviewer.
- Canonical `/Users/brianb/MissionMed_OS/tools/engineering_os_lease.py` accepts constructor-injected URL/key/project in memory; RPC requests use the same supplied credential in `apikey` and bearer authorization. The unchanged product `register_phase1.py` uses the 256KiB/60-second memory-only CLI pipe and selects exactly `name=missionmed_lease_runtime_v5`, `type=secret`, with the expected prefix. It adds no reveal query or independently verified key-validity condition.
- Connected metadata-only `get_project` returned `ACTIVE_HEALTHY` for the pinned project. A bounded `pg_catalog` role-ACL SELECT returned `public.mmos_acquire_scoped_lease_v2`, SECURITY DEFINER, with EXECUTE for `postgres`, `service_role` and `mmos_engineering_executor`. This proves only that inspected function's metadata; it does not prove other registrar functions' ACLs or successful Data API authentication. No student or lease rows were read.
- Foreman-supplied settled observations, not repeated here: legacy-key REST root and canonical registrar admission 401; existing named secret unchanged dual-header health 401; single approved apikey-only health 401; no IR lease/waiter/OS stage created; healthy existing USCE/Timeline V2 leases preserved. This review did not independently reproduce those observations or reread their lease state.

## Primary-source findings

1. [Pinned v2.75.0 command registration](https://github.com/supabase/cli/blob/v2.75.0/cmd/projects.go) exposes no reveal flag. [Pinned implementation](https://github.com/supabase/cli/blob/v2.75.0/internal/projects/apiKeys/api_keys.go) calls `V1GetProjectApiKeysWithResponse` with empty parameters. For JSON it directly serializes the API response; pretty/env maps a null key to a mask. There is no source evidence here of CLI-side truncation or partial reconstruction of a non-null JSON key. Raw source was read in memory through the official GitHub contents API; no source download was saved.
2. [Issue #4775](https://github.com/supabase/cli/issues/4775) specifically reports that legacy service-role keys remain fully available while newer secret keys are unrevealed. [Merged fix #5633](https://github.com/supabase/cli/pull/5633) adds an opt-in reveal option to the native TypeScript implementation and explicitly leaves the Go CLI untouched. An arbitrary Go CLI upgrade is therefore not a verified fix. No newer binary, package or preview was installed or tested.
3. [Official Management API reference](https://supabase.com/docs/reference/api/v1-get-project-api-keys) documents read-only `GET /v1/projects/{ref}/api-keys` with optional `reveal=true`. Access uses existing management identity with OAuth `secrets:read`; fine-grained secret reveal requires `api_gateway_keys_secret_read` alongside key-read permission. The endpoint can retrieve an existing key without creating/rotating a credential or changing provider grants when that identity already has the necessary permission. This reviewer did not inspect the existing token's permissions or execute the endpoint.
4. Supabase skill's public changelog index was scanned for relevant breaking entries; it did not establish a separate runtime correction. No auth/config mutation follows from that scan.

## Smallest concrete fix packet — review required before execution

The present independent review admits only the exact existing CLI listing command and the already-consumed health probes. It does not admit a new Management API credential retrieval. Foreman must obtain a narrow independent transport addendum before changing the helper or retrieving anything further. The requested addendum should permit only:

- Existing authenticated Management API identity; exact GET to `https://api.supabase.com/v1/projects/brxqytrfdisrgakrxkhd/api-keys?reveal=true`; no redirects, no fallback/default key, no new key, no grant/role/config changes.
- Same 60-second/256KiB bounds, memory-only private parsing, suppressed stdout/stderr/bodies/headers/object representations/tracebacks, no key or management token in argv/environment/files/chat. Existing identity must be obtained through its already approved secure in-memory mechanism; no raw credential-store discovery is implied.
- Select exactly one pre-existing record with the already approved name and type. Reject absent, null, malformed, masked, ambiguous or unexpectedly changed metadata. Emit only value-free status/classification.
- Compare any previously held value to the revealed existing value only inside memory if an approved process still holds it; emit a boolean comparison only. Without that comparison, a subsequent successful revealed-key health probe establishes a working retrieval path but does not retrospectively prove masking caused the original failures.

Alternative CLI route: identify and independently review a released, exactly pinned native TypeScript CLI implementation whose official source and installed `--help` prove the reveal option. Do not infer that a numerically newer Go release contains #5633. No version is proposed as tested here.

If the existing management identity lacks secret-read permission, the concrete non-delegable gate is the project's credential owner making the approved existing key available through an authorized secret channel or authorizing the minimum secret-read access. Request no provider mutation until this specific permission failure is evidenced. If reveal succeeds and the exact existing key still receives 401, stop; the provider owner must inspect that key's current gateway status/revocation and legacy-key enablement. A healthy project and RPC ACL cannot settle those gateway properties. Do not rotate, create, switch/default a key or alter header/client/provider behavior as a diagnosis shortcut.

## Expected validation after separately approved retrieval

1. Reveal retrieval returns 200; exactly one approved existing secret is available privately. A 401/403 is a management identity/permission gate; null/unrevealed/ambiguous output is a transport gate. No key material enters files or output.
2. One newly authorized, bounded read-only REST health probe uses the already reviewed exact header shape and no redirect. Require authentication success before any registrar invocation. A 401 stays blocked; do not recycle the previously consumed probe authorization.
3. Submit exact helper/adapter bytes and the prospective registration contract for independent review before normal REGISTRY admission. Credential transport success alone grants neither lease nor authority.
4. Only then execute the normal canonical registrar/keeper transaction, exact staged-byte review, fresh BOOT/canonical custody, healthy identity/epoch/nonce fencing, release/provider-clear and separately scoped product gates. Preserve every existing USCE/Timeline lease; do not call lease acquisition, release or direct lease-table writes as an authentication probe.

## Scope and preservation

All provider calls here were project/function metadata reads. No credential was retrieved, logged or saved. No unauthenticated or credential-bearing REST request was added. No student, lease or waiter data was read or changed. Existing dirty registration packet, Phase1 source, CLI scratch and `_AI_INPUTS/` were left untouched. This report-only commit is local; it is not canonical filing, provider acceptance, lease admission, deployment or release approval.

Next action: independent review of the exact existing-key `reveal=true` retrieval extension; then bounded authentication validation or the specifically evidenced credential-owner gate.
