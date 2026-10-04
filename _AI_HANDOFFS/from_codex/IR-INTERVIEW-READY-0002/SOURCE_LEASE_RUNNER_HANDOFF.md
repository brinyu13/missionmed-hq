# Bounded local source lease runner handoff

Builder fixture PASS. Dormant implementation only; no credential/provider retrieval, authentication probe, lease acquisition, protected product implementation, push or deployment occurred. STOP AFTER COMMIT. Independent exact-byte implementation review and fresh bounded read admission remain required.

## Scope and custody

Only this handoff, `source_lease_runner.py`, and `source_lease_runner_tests.py` are assigned writes. Source base/preimages remain `15488295c9e7d135d3a9e51a1b5feb571c2922e2`; five of the six product paths are absent, and `interview-ready/build.py` SHA256 is `c119d1bf8c9b6df4c02d765369fa90af849477708c4ca8dfb7eeacd4c0399dea`. The later committed source HEAD is separately bound as `sourceHead` and is the worker BASE in READY. No claim that the preimage base is current HEAD. Canonical OS root is `/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2`, HEAD `84754150b8c834ac25466860ab98600b5d5c1b9e`. Foreman supplied BOOT/profile PASS, filed DR375/376 and custody release; independent provider-clear is a separate evidence gate.

Preserved unrelated dirty packet/checkpoint, `supabase/.temp/cli-latest`, and `_AI_INPUTS/`. No OS or transport/client/RPC edits. Commit identity is returned by the scoped Git commit and the builder's final handoff message; this document does not embed its own future commit hash.

## Exact implementation hashes

| File | SHA256 |
| --- | --- |
| source_lease_runner.py | db2f5660f664efbe2561c313c184cc9e53015294f37fd841b7277d575e6f9b5f |
| source_lease_runner_tests.py | 3692591941dad46df66eb597d64ddabc6ad73019abf3b280cdb5599d7b613a29 |
| lease_transport.py, unchanged | 6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad |
| PHASE1_ACCOUNT_WORKER_PACKET.md, Foreman prospective packet | 45d19d350a36707a4574669e7889fc18e787e85f01b3c57da3bbb004eae4186f |
| R2 tools/engineering_os_lease.py, unchanged | 36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431 |
| R2 decisions/DR-376_ir_phase1_bounded_execution_annex.md | 32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd |

## Independent approval and admission schema

The reviewer creates separate local report files and two JSON controls. Builder does not create approvals. Neither file admits automatic retry. Every report must be an ordinary nonsymlink file directly in the assigned handoff directory; each report's bytes must match its supplied `reportSha256`.

Approval fields:

- `schema`: `ir.source_lease.approval.v1`; `verdict`: `APPROVE`.
- `independentReviewer`: named reviewer other than owner `codex-ir-phase1-foreman`.
- `expiresUnix`: numeric future Unix time, at most 3600 seconds ahead.
- `reportFile`, `reportSha256`: exact separate implementation-review report.
- `contract`: the exact dictionary returned by `source_lease_runner.snapshot()` after all intended preparatory commits. It binds `sourceBASE`, current `sourceHead`, `osHead`, `writePaths`, six `sourcePreimages`, `runnerSha256`, `testsSha256`, `transportSha256`, `workerPacketSha256`, `canonicalClientSha256`, `decisionSha256`, `origin`, `ref`, `relativePath`, and `owner`.

Read admission fields:

- `schema`: `ir.source_lease.read_admission.v1`; `verdict`: `APPROVE`.
- `independentReviewer`, `expiresUnix`, `reportFile`, `reportSha256`: same field semantics, separate fresh read-admission report.
- `bindingSha256`: SHA256 of `source_lease_runner.canonical(contract)`.
- `approvalSha256`: SHA256 of the exact approval JSON bytes.
- `maxSeconds`: exact execution bound, positive and at most 3600, matching the CLI argument.

The identity fields are review attestations, not cryptographic proof of human independence. Foreman must independently inspect their authorship/custody before invocation. Source HEAD/preimages and pinned OS/transport checks occur before loading credential capability. Missing/hash/path/base/expiry mismatches stop before retrieval. Module bytes are hashed and compiled from that same immutable in-memory byte snapshot.

## Bounded invocation after independent admission

Use the existing Python interpreter and exact runner path. The following is the invocation form, not authorization or an executed command:

```text
python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/source_lease_runner.py --execute --approval <reviewer-approval.json> --read-admission <fresh-read-admission.json> --control-directory /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/<unique-new-control-directory> --max-seconds 3600
```

The control directory must not exist and must be a direct child of the handoff directory. Admission is consumed with exclusive-create `SOURCE_LEASE_READ_CONSUMED_<admission-byte-sha256>.json` BEFORE retrieval. A failed retrieval/probe cannot reuse that admission with a new control directory. The runner itself executes no shell/worker commands. Unchanged transport performs its already-reviewed bounded private credential path. Retrieval happens once, actual separate authentication probe must return HTTP200, and the same private key constructs the canonical `SupabaseLeaseClient` with the exact `ApikeyOnlyLeaseOpener`.

Canonical `path_scope` receives origin `https://github.com/brinyu13/missionmed-hq.git`, ref `codex/ir-interview-ready-0002-storyforge`, relative path `interview-ready`. `acquire_writer` receives exactly the six packet paths, owner `codex-ir-phase1-foreman`, unique `ir-phase1-account-source-20261004-<uuidhex>` session, and approved contract digest. No invented PRODUCT scope or shared domain.

Immediate canonical heartbeat must succeed before READY. A daemon keeper renews every five seconds; canonical heartbeat validates timestamps, epoch and nonce. Atomic status/READY retain leaseId, epoch, hashed nonce, exact paths/scope, sourceBASE/current sourceHead and packet digest. No key/raw nonce/response/environment/header/exception text enters receipts. Thread exception values and tracebacks are suppressed.

## Worker and release controls

Foreman assigns work only after READY and healthy STATUS. Before EACH source write and commit, worker calls `check_worker_guard(control_directory, approved_binding_digest, ready_source_head)`. It verifies actual local source HEAD, binding, HEALTHY status, update age below ten seconds, and server lease expiry. STOP, stale/future timestamps, changed HEAD or binding failure stops the worker. The guard is cooperative; it does not intercept arbitrary filesystem writes. Worker must follow the exact packet paths and stop after its scoped commit.

Foreman writes local `SOURCE_LEASE_STOP.json` containing exact `owner`, `leaseId`, `bindingSha256`, and `action` of `RELEASE` or `DONE`. Mismatched controls fail closed. No command is executed by this runner. Maximum wait is 3600 seconds. Timeout, keeper failure, interruption or malformed control produces STOP. Finally joins the keeper, records terminal STOP, and attempts canonical release. `SOURCE_LEASE_RESULT.json` reports `RELEASED` only if canonical release returned successfully; `RELEASE_FAILED` always yields failure. A READY file may remain after termination; it never substitutes for the fresh status guard. Independent provider-clear after release remains separate.

## Builder verification

Executed locally:

```text
python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/source_lease_runner_tests.py
```

Result: eight tests PASS, 0.053 seconds in final fixture run. Fixtures cover approval/hash/path/base rejection before credential capability; expiry; immediate heartbeat/READY; initial renewal failure with no READY and finally release; keeper failure STOP/finally release; bounded timeout and release failure; one-use separate read admission with mock retrieval/probe/canonical scope/acquisition; stale/terminal/wrong-binding worker guard; no raw fixture nonce/key/error in receipts. All provider/credential operations are mocks or never imported.

Dormant command was executed without `--execute`; result: `DORMANT: independent exact-byte approval and fresh read admission required`. This is builder evidence, not actual provider authentication, lease health, worker implementation, or production acceptance. No actual execution was attempted. Next action: fresh independent exact-code review and read admission, after the finalized packet/checkpoint source commit.
