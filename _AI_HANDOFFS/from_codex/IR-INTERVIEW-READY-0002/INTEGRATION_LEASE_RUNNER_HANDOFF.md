# Integration source lease recovery handoff

Builder local fixture PASS. Recovery preparation only; no actual retrieval, authentication probe, lease acquisition, provider mutation, product implementation, OS write, push or deployment in this work. STOP AFTER THE EXACT THREE-FILE COMMIT. Fresh independent review, partial-source adoption, and separate one-use read admission remain required before any resume.

## Evidence and bounded correction

The interruption checkpoint at source HEAD `0566cf093aaa0058632c7ca2b4e09c0ecef8b075` records epoch4674's stopped worker, stale local HEALTHY status and missing terminal RESULT. The independent interruption review established exact provider release and zero active IR/pending at its observation. These establish neither successful worker completion nor a proven cause of the local interruption. Disk recovery was supplied by Foreman; no disk cleanup occurred here.

The old runner let terminal receipt write exceptions propagate without useful safe phase information. This change hardens that control flow; it does not claim to reproduce or prove the epoch4674 failure. Canonical client, retrieval, authentication probe, lease scope, three-second RPC ceiling, five-second keeper, ten-second worker freshness fence, owner, unique session prefix and 3600-second execution cap remain unchanged. The ten original integration write paths and packet are unchanged.

Before retrieval and live steps, a safe atomic `SOURCE_LEASE_PHASE.json` breadcrumb records only a constant phase, binding digest and timestamp. Failure before acquisition stops without retrieval retry. After acquisition, breadcrumb/heartbeat/status/READY/control errors enter STOP and the release attempt. Diagnostic output contains only constant phase, whitelisted `OS_ERROR`, `CONTROL_STOP`, `INTERRUPTED` or `EXCEPTION`, and a recognized numeric OS errno (otherwise null). Exception text, arbitrary exception class names, raw nonce/key/response/header/environment/user values never enter diagnostic receipts or output.

Healthy, terminal and RESULT write failures are caught. Failure handling makes a best-effort removal of stale status and exclusive `SOURCE_LEASE_FAILURE.json` marker; the worker guard refuses any failure marker. If storage also refuses those operations, durable STOP cannot be guaranteed: the unchanged worker freshness/server-expiry fence remains mandatory, and missing/old receipts never prove success. The release attempt does not depend on terminal status storage success. `RELEASED` is recorded only after the unchanged canonical release returns successfully; any diagnostic or failed RESULT write makes the orchestration return failure and stdout `SOURCE_LEASE_STOP`. RESULT may truthfully report released with outcome STOP; that is no worker-completion claim. Independent provider-clear remains separate.

## Original immutable base and explicit partial adoption

Original `SOURCE_BASE` remains `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3`. `snapshot()` now proves its original preimages separately with fixed read-only local Git `ls-tree`/`cat-file` calls, replacement objects disabled, no shell/remote/worker commands. `originalSourcePreimages` must equal the immutable pins below. Current `sourcePreimages` binds the exact ten worktree images and may differ from the original base only under the fresh explicit recovery review. The six integration checkpoint drafts must retain the checkpoint hashes. This does not approve unfinished drafts automatically.

The recovery object binds checkpoint source HEAD, exact checkpoint/review filenames and byte hashes, and the immutable seven-draft custody dictionary. The seventh native QA file is outside the source write claim: its current bytes are separately observed as `observedNativeQaSha256` for fresh review because the separate QA worker may complete that file. At final preparation, the separate QA worker is stopped and current observed QA SHA256 is `a6f94593ee60b3f01031954f1594eff0a9edbadb3109581e272e8a6e7ed8b6cf`; fresh snapshot/approval binds that current value. No QA file write or commit is performed here. The current source HEAD, including the forthcoming three-file commit and Foreman's later explicitly rebound preparation commits, must be the exact HEAD in the fresh approved contract and READY; a changed HEAD stops the worker.

| Original exact write path | SHA256 at a7adc5e |
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

| Immutable checkpoint custody path | SHA256 at interruption |
| --- | --- |
| _SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json | 5bd21265a8d8c48986ada406e7cf2802a6cb755200892448adbd58474b8eb150 |
| interview-ready/build.py | 2776ea801ad4440bfaf3446ebe311febe758f162e775a0cf623a4ff8acd1a432 |
| interview-ready/integration/missionmed-interview-ready.php | 406c97135c6ea768f990390a588adfeca037c1b69c0c4b158f67e47b3c940c65 |
| interview-ready/phase1.json | c552cc20f09a7dce76c91a22bfd507e91c6d33b78b043df9f420fdf57d1351c0 |
| interview-ready/integration/matrix-entry.js | 238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad |
| interview-ready/integration/release.py | 7a4ad5d0cd3465124de98de2eb8e91a61ad3f3780c7754a6363c90acb978bf0e |
| _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_account_qa.py | 9c4452da53981fb70de6afae504fe38ee9cd0445d1e4187464220124d947b7b5 |

## Exact dependency bytes and authority adoption

| File / dependency | SHA256 |
| --- | --- |
| integration_lease_runner.py | d5ab7fcc164f1f4f6404013f45c2fabfb579a52033e5cfacc14f035032f4359c |
| integration_lease_runner_tests.py | 6ad67956ad040884301788f8609e1bd98b3c36459e99742da5cc55d857e228ce |
| lease_transport.py, unchanged | 6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad |
| MATRIX_RELEASE_WORKER_PACKET.md, unchanged | c3a6e15b98938220f10406014e992cdc9cbd4359451187c737a4a0c3d8813cbc |
| IR_PHASE1_INTERRUPTION_CHECKPOINT_20261004_1929.md | 63c57989a0ac670d14f2a0383a1d0c0c1a25a211017beb6c67e63577d905032e |
| INTEGRATION_LEASE_INTERRUPTION_REVIEW.md | 59f4fdf7a8a7a7c719a73c79fe2842a615b568907a0d066a4919d01ce099c592 |
| R2 tools/engineering_os_lease.py, unchanged | 36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431 |
| Current R2 decisions/DR-376_ir_phase1_bounded_execution_annex.md | 452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e |
| Current R2 handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md | ed3a5cb6c439147471860a78654aeecbaca367d6ed2f7cd92c4159d331f6556d |

Fresh OS HEAD is pinned to `81c3ac794b0b3436c7ce66cada31b9f2a1e05356`. Foreman supplied BOOT mission PASS and independently verified that the IR DR376/registration-handoff change is solely en/em-dash to ASCII-hyphen normalization with no scope change. This exact adoption is included in `authorityAdoption`, and must receive fresh independent review before controls. Historical `84754150b8c834ac25466860ab98600b5d5c1b9e` and DR376 hash `32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd` remain historical sealed values; normalized current bytes are not represented as old bytes. The canonical client hash is unchanged and pinned. No OS reconciliation or unrelated authority mutation occurred here.

## Fresh approval, recovery review and read admission

Builder writes none of these reviewer controls or reports. The reviewer must inspect custody/authorship; named identity fields are attestations, not cryptographic proof of independence. Three separate nonsymlink report files directly in the handoff directory are required, each matching its exact supplied byte hash.

Implementation approval JSON retains `schema: ir.integration_source_lease.approval.v1`, `verdict: APPROVE`, `independentReviewer` other than owner `codex-ir-phase1-foreman`, future `expiresUnix` no more than 3600 seconds ahead, `reportFile`, `reportSha256`, and `contract` equal to the entire fresh `integration_lease_runner.snapshot()`. That exact contract includes source BASE/current HEAD, original Git-object proof/current ten preimages, checkpoint/review/seven-draft custody/current QA observation, OS and authority adoption, runner/tests/transport/packet/client/decision/authority hashes, exact write paths, origin/ref/relativePath/owner.

The approval additionally requires `recoveryReview` containing `schema: ir.integration_source_lease.recovery_review.v1`, `verdict: APPROVE`, independent reviewer other than owner, fresh `expiresUnix`, separate `reportFile`/`reportSha256`, and `bindingSha256` equal to SHA256 of `integration_lease_runner.canonical(contract)`. Missing/stale/wrong-binding recovery review denies execution. This separate review explicitly adopts partial source and current authority; old approval equality or current snapshot generation alone is insufficient.

Read admission JSON retains `schema: ir.integration_source_lease.read_admission.v1`, `verdict: APPROVE`, independent reviewer other than owner, fresh `expiresUnix`, its own separate report filename/hash, exact contract `bindingSha256`, exact implementation approval byte `approvalSha256`, and `maxSeconds` equal to the positive CLI cap at most 3600. The actual source HEAD/preimages and all gates are checked before loading credential capability. Canonical `path_scope` validation remains pure local before transport load or retrieval.

## Fresh controls, worker fence and release

Use a new nonexistent direct-child directory such as `SOURCE_INTEGRATION_LEASE_20261004_2`, new integration approval/read-admission JSON bytes and a newly hashed exclusive consumption marker. Preserve all epoch4674 consumed markers/receipts and old directories. No old HEALTHY, READY or guard is revived. Invocation form only, not authorization or an executed command:

```text
python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py --execute --approval <integration-recovery-implementation-approval.json> --read-admission <integration-recovery-fresh-read-admission.json> --control-directory /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/SOURCE_INTEGRATION_LEASE_20261004_2 --max-seconds 3600
```

The existing `SOURCE_INTEGRATION_LEASE_READ_CONSUMED_<exact-admission-byte-sha256>.json` marker is created before retrieval; failed retrieval/probe never authorizes reuse or retry. Canonical origin/ref remain `https://github.com/brinyu13/missionmed-hq.git` / `refs/heads/codex/ir-interview-ready-0002-storyforge`, relativePath `interview-ready`, owner `codex-ir-phase1-foreman`, unique `ir-phase1-integration-source-20261004-<uuidhex>` session. The complete PATH claim includes the manifest under the exact DR376 authority.

Worker must call `check_worker_guard(directory, approved_binding_digest, ready_source_head)` before every exact-path write and commit. It checks local HEAD, binding, HEALTHY state, update age below ten seconds, canonical server expiry and absence of failure marker. This is a cooperative fence, not filesystem interception. STOP controls retain exact owner/leaseId/binding and RELEASE or DONE action. Foreman assigns only under new READY and healthy fresh guard; source worker stops after its one scoped implementation commit. Foreman owns release, independent provider-clear and later native/live acceptance.

## Local builder verification and filing

Executed only locally with fixture clients/transport and actual dormant canonical scope validation:

```text
PYTHONDONTWRITEBYTECODE=1 python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner_tests.py
PYTHONDONTWRITEBYTECODE=1 python3 /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py
```

Result: fourteen fixtures PASS, 2.223 seconds; dormant invocation returns `DORMANT: independent exact-byte approval and fresh read admission required`. Tests retain the nine settled cases and add healthy-status/terminal-status/RESULT/all-receipt failure with release attempt, no false successful return, whitelisted phase/errno/no raw fixture key or nonce, missing/stale/wrong recovery approval, immutable original proof/current partial drift and changed HEAD worker fence. Fixture clients perform no provider work. Builder evidence does not admit execution or certify real authentication, lease health, worker completion or production.

Only this handoff, runner and test file are assigned writes/staging/commit. The six partial product paths, QA worker files, uncommitted checkpoint/review, unrelated dirty `supabase/.temp/cli-latest` and `_AI_INPUTS/` remain outside this commit. Future commit identity is reported by scoped Git output and builder's final handoff. Stop after commit; Foreman explicitly rebinds new HEAD, and independent reviewers author fresh controls after that binding.
