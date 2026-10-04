# Bounded local integration source lease runner handoff

Builder fixture PASS. Dormant implementation only; no credential/provider retrieval, authentication probe, lease acquisition, protected product implementation, push or deployment occurred. STOP AFTER COMMIT. Independent exact-byte implementation review and fresh bounded read admission remain required.

## Scope and custody

Only this handoff, `integration_lease_runner.py`, and `integration_lease_runner_tests.py` are assigned writes. Source base/preimages remain `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3`; five of the ten exact write paths are absent; the five existing preimages are pinned in the table below. The later committed source HEAD is separately bound as `sourceHead` and is the worker BASE in READY. No claim that the preimage base is current HEAD. Canonical OS root is `/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2`, HEAD `84754150b8c834ac25466860ab98600b5d5c1b9e`. Foreman supplied BOOT/profile PASS, filed DR375/376 and custody release; independent provider-clear is a separate evidence gate.

Preserved unrelated `MATRIX_CURRENT_GUARD_BASELINE.md`, `supabase/.temp/cli-latest`, and `_AI_INPUTS/`. No OS or transport/client/RPC edits. Commit identity is returned by the scoped Git commit and the builder's final handoff message; this document does not embed its own future commit hash.

## Fixed source preimages

| Exact write path | SHA256 at SOURCE_BASE |
| --- | --- |
| interview-ready/integration/matrix-entry.js | ABSENT |
| interview-ready/integration/matrix-entry.test.js | ABSENT |
| interview-ready/integration/missionmed-interview-ready.php | f32df31e1c20af86d4c6fe48ee380832dbc2dc6d60a107e58bb7bc11f7a20243 |
| interview-ready/integration/gateway.test.php | ba23b7d6bdedce44a85db34d4a4411513d4cb4067dd63cbe67cbfc970b19cc90 |
| interview-ready/build.py | ab463c64dbe9fef819183508480a31769fae331b8a2b720c0aaef7f7bbf115ad |
| interview-ready/integration/release.py | ABSENT |
| interview-ready/integration/release.test.py | ABSENT |
| interview-ready/phase1.json | 0f44ee256a985b26a6a25bd2f10a431ef8f38c24197d2a1598299676484daa18 |
| _SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json | 41a35e9d3fd5dee394ceee2a66d0cfd4fe1959bca5535f1c58bf36ee764c33ec |
| interview-ready/evidence/integration-worker-handoff.md | ABSENT |

## Exact implementation hashes

| File | SHA256 |
| --- | --- |
| integration_lease_runner.py | c17acd9595945573582c12680537849879fc17854a9512639c520ab7a4a06e81 |
| integration_lease_runner_tests.py | 299b87f0b277ce729051e21c8fdd0c141c3716355bb58257e74fe618c89ff24b |
| lease_transport.py, unchanged | 6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad |
| MATRIX_RELEASE_WORKER_PACKET.md, Foreman finalized packet | c3a6e15b98938220f10406014e992cdc9cbd4359451187c737a4a0c3d8813cbc |
| R2 tools/engineering_os_lease.py, unchanged | 36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431 |
| R2 decisions/DR-376_ir_phase1_bounded_execution_annex.md | 32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd |

## Independent approval and admission schema

The reviewer creates separate local report files and two JSON controls. Builder does not create approvals. Neither file admits automatic retry. Every report must be an ordinary nonsymlink file directly in the assigned handoff directory; each report's bytes must match its supplied `reportSha256`.

Approval fields:

- `schema`: `ir.integration_source_lease.approval.v1`; `verdict`: `APPROVE`.
- `independentReviewer`: named reviewer other than owner `codex-ir-phase1-foreman`.
- `expiresUnix`: numeric future Unix time, at most 3600 seconds ahead.
- `reportFile`, `reportSha256`: exact separate implementation-review report.
- `contract`: the exact dictionary returned by `integration_lease_runner.snapshot()` after all intended preparatory commits. It binds `sourceBASE`, current `sourceHead`, `osHead`, `writePaths`, ten `sourcePreimages`, `runnerSha256`, `testsSha256`, `transportSha256`, `workerPacketSha256`, `canonicalClientSha256`, `decisionSha256`, `origin`, `ref`, `relativePath`, and `owner`.

Read admission fields:

- `schema`: `ir.integration_source_lease.read_admission.v1`; `verdict`: `APPROVE`.
- `independentReviewer`, `expiresUnix`, `reportFile`, `reportSha256`: same field semantics, separate fresh read-admission report.
- `bindingSha256`: SHA256 of `integration_lease_runner.canonical(contract)`.
- `approvalSha256`: SHA256 of the exact approval JSON bytes.
- `maxSeconds`: exact execution bound, positive and at most 3600, matching the CLI argument.

The identity fields are review attestations, not cryptographic proof of human independence. Foreman must independently inspect their authorship/custody before invocation. Source HEAD/preimages and pinned OS/transport checks occur before loading credential capability. Missing/hash/path/base/expiry mismatches stop before retrieval. Module bytes are hashed and compiled from that same immutable in-memory byte snapshot.

## Bounded invocation after independent admission

Use the existing Python interpreter and exact runner path. The following is the invocation form, not authorization or an executed command:

```text
python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py --execute --approval <integration-implementation-approval.json> --read-admission <integration-fresh-read-admission.json> --control-directory /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/SOURCE_INTEGRATION_LEASE_20261004_1 --max-seconds 3600
```

The control directory must not exist and must be a direct child of the handoff directory. Admission is consumed with exclusive-create `SOURCE_INTEGRATION_LEASE_READ_CONSUMED_<admission-byte-sha256>.json` BEFORE retrieval. A failed retrieval/probe cannot reuse that admission with a new control directory. The runner itself executes no shell/worker commands. Unchanged transport performs its already-reviewed bounded private credential path. Retrieval happens once, actual separate authentication probe must return HTTP200, and the same private key constructs the canonical `SupabaseLeaseClient` with the exact `ApikeyOnlyLeaseOpener`.

Canonical `path_scope` receives origin `https://github.com/brinyu13/missionmed-hq.git`, ref `refs/heads/codex/ir-interview-ready-0002-storyforge`, relative path `interview-ready`. `acquire_writer` receives exactly the ten packet paths, owner `codex-ir-phase1-foreman`, unique `ir-phase1-integration-source-20261004-<uuidhex>` session, and approved contract digest. No invented PRODUCT scope or shared domain.

Immediate canonical heartbeat must succeed before READY. A daemon keeper renews every five seconds; canonical heartbeat validates timestamps, epoch and nonce. Atomic status/READY retain leaseId, epoch, hashed nonce, exact paths/scope, sourceBASE/current sourceHead and packet digest. No key/raw nonce/response/environment/header/exception text enters receipts. Thread exception values and tracebacks are suppressed.

## Worker and release controls

Foreman assigns work only after READY and healthy STATUS. Before EACH source write and commit, worker calls `check_worker_guard(control_directory, approved_binding_digest, ready_source_head)`. It verifies actual local source HEAD, binding, HEALTHY status, update age below ten seconds, and server lease expiry. STOP, stale/future timestamps, changed HEAD or binding failure stops the worker. The guard is cooperative; it does not intercept arbitrary filesystem writes. Worker must follow the exact packet paths and stop after its scoped commit.

Foreman writes local `SOURCE_LEASE_STOP.json` containing exact `owner`, `leaseId`, `bindingSha256`, and `action` of `RELEASE` or `DONE`. Mismatched controls fail closed. No command is executed by this runner. Maximum wait is 3600 seconds. Timeout, keeper failure, interruption or malformed control produces STOP. Finally joins the keeper, records terminal STOP, and attempts canonical release. `SOURCE_LEASE_RESULT.json` reports `RELEASED` only if canonical release returned successfully; `RELEASE_FAILED` always yields failure. A READY file may remain after termination; it never substitutes for the fresh status guard. Independent provider-clear after release remains separate.

## Builder verification

Local fixture command:

```text
PYTHONDONTWRITEBYTECODE=1 python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner_tests.py
```

Result: nine tests PASS, 0.075 seconds in the local fixture run. Fixtures cover actual dormant canonical `path_scope` validation and malformed-ref rejection before transport capability loads; approval/hash/path/base rejection before credential capability; expiry; immediate heartbeat/READY; initial renewal failure with no READY and finally release; keeper failure STOP/finally release; bounded timeout and release failure; one-use separate read admission with mock retrieval/probe/canonical scope/acquisition; stale/terminal/wrong-binding worker guard; no raw fixture nonce/key/error in receipts. All provider/credential operations are mocks or never imported.

Dormant invocation was executed without `--execute`; result: `DORMANT: independent exact-byte approval and fresh read admission required`. This is builder evidence, not actual provider authentication, lease health, worker implementation, or production acceptance. No actual execution was attempted. Next action: fresh independent exact-code review and read admission, after the finalized packet/checkpoint source commit.

## Accepted-runner transformation

This copies the independently accepted source runner and its nine settled fixtures. Only integration base/preimages, ten exact write paths, module/test name, packet dependency, integration approval/admission schemas, consumed marker prefix, and unique session/keeper names change. Canonical transport/client/RPC sources and the orchestration flow remain unchanged. The actual-canonical-ref fixture remains in the copied test file.

The complete PATH claim includes `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` under explicit DR376 exact-path authority even though `relativePath` remains `interview-ready`. This handoff prepares dormant custody only; it does not assert provider clearance, actual admission, or product acceptance. Old source runner controls are never overwritten. All `SOURCE_LEASE_*` runtime files use the new previously nonexistent `SOURCE_INTEGRATION_LEASE_20261004_1` directory; the integration admission consumption marker has its own prefix and exact admission-byte hash.
