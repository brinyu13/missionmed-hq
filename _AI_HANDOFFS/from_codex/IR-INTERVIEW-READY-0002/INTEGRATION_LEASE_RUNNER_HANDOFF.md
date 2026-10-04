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

## Fresh live-render repair packet (2026-10-04)

The following typed packet supersedes the historical recovery admission for this runner only. Historical reports/consumed controls remain sealed. No implementation or runtime action is admitted by this text alone.

<!-- LIVE_RENDER_REPAIR_PACKET_BEGIN -->
{
  "change": "COUNT_ONE_RENDERED_ACCOUNT_COMPARISON_s.revision<0_TO_0>s.revision",
  "diagnosisFile": "LIVE_RENDER_COMPATIBILITY_DIAGNOSIS.md",
  "diagnosisSha256": "5f31e00f4704532bea3cd6e8985242e83f8df1459ccad3b6bcdcb6b1c145230f",
  "preserve": "ACCOUNT_SOURCE_STATE_ENGINE_GATEWAY_SHARED_ASSETS_AND_RUNTIME",
  "runtimeAdmission": "SEPARATE_NEW_COMMITTED_PACKAGE_REVIEW_PRESENT_OWNER_PREIMAGES_AND_FRESH_INSTALL_REQUIRED",
  "schema": "ir.live_render_source_repair.packet.v1",
  "sourceBASE": "2db1f985e4678f8429af7b45969cde5729bd26d8",
  "sourcePreimages": {
    "interview-ready/build.py": "252faef3ee21ed66d7d0eb331c113c533eb28a0de2e5e0cfcf4c4d7f686ac1e1",
    "interview-ready/evidence/integration-worker-handoff.md": "fce9c8c8597b721892a63b4705203eb1b1c672dc070819c8f99088f1970d1e0f",
    "interview-ready/integration/release.test.py": "98401d50a70d9a037602775e92273e81d9aab3a1c2ce4201fbf2f3762282e592"
  },
  "verification": "BUILT_INLINE_SCRIPT_PARSE_SAFE_COMPARISON_SOURCE_ACCOUNT_BYTES_AND_EXISTING_PACKAGE_GATES",
  "writePaths": [
    "interview-ready/build.py",
    "interview-ready/integration/release.test.py",
    "interview-ready/evidence/integration-worker-handoff.md"
  ]
}
<!-- LIVE_RENDER_REPAIR_PACKET_END -->

## Fresh repair runner custody and reviewed control contract

Current runner SHA256 12d4c346a879867d68965621dc90c2789899375fb010cfd8066850d4a7318953; tests SHA256 2864c9edc995498c554b00fc555b39b46eb980377a53c3a8d1a420bd79d4c293. Typed packet canonical SHA256 a59585b87eb4119bdf848de69080c6c949d0449e4be1c3f0d323e80e2760a79f is extracted only from the single begin/end block above. Diagnosis SHA256 5f31e00f4704532bea3cd6e8985242e83f8df1459ccad3b6bcdcb6b1c145230f. Whole handoff bytes intentionally are not self-pinned in the packet; final report SHA is supplied separately. Packet has no executable approval or runner/test self-hash cycle.

This new admission replaces the original a7 source/recovered0566 snapshot logic. SOURCE_BASE is immutable2db1f985e4678f8429af7b45969cde5729bd26d8; exactly three Git-object preimages and current working-tree preimages must match the packet. Ten-path/checkpoint/native-QA adoption is no longer admissible for this runner. OS_HEAD is bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2; current unchanged DR376/registration/client/transport hashes remain mandatory. OS adoption basis is Foreman's already qualified unchanged routed IR records with unrelated OS additions. No OS mutation or broader authority reconciliation was performed here.

snapshot() obtains actual local sourceHead, not a constant equal to the helper commit that cannot exist until after bytes are frozen. After Foreman commits this preparation and any independently reviewed custody reports, the reviewer must bind that exact actual HEAD and all snapshot bytes into fresh controls. Independently signed approval.contract must equal snapshot() exactly. New HEAD with unchanged fixed three preimages is eligible only through new independent controls; old source-head controls fail. The worker's HEAD fence continues to require that admitted HEAD before every write/commit, allowing the worker to commit only after checking the precommit HEAD and then stop as instructed by Foreman. No automatic adoption or self-approval is implied.

Fresh controls (Foreman/reviewers author, not created by this builder):

- Approval schema ir.live_render_source_lease.approval.v1, verdict APPROVE, independentReviewer distinct from owner/builder, fresh expiresUnix <=now+3600, contract exact snapshot, reportFile/reportSha256 for an independent actual exact-byte report.
- Embedded repairReview schema ir.live_render_source_lease.repair_review.v1, verdict APPROVE, independently assigned reviewer distinct from owner/builder, canonical contract bindingSha256, fresh expiresUnix and separate actual reportFile/reportSha256. Report affirms only the typed count-one build repair, focused package regression and product handoff under exact three paths.
- Separate read admission schema ir.live_render_source_lease.read_admission.v1, verdict APPROVE, reviewer distinct from owner/builder, bindingSha256 exact canonical snapshot, approvalSha256 exact approval file bytes, maxSeconds equal CLI bound <=3600, fresh expiresUnix and third distinct reportFile/reportSha256. All three actual report bytes are checked locally before any credential-capable import.

Use new distinct LIVE_RENDER_SOURCE_APPROVAL.json and LIVE_RENDER_SOURCE_READ_ADMISSION.json names; never replace previous controls/reports. Proposed new unique control directory SOURCE_LIVE_RENDER_REPAIR_LEASE_20261004_1 must not exist. Canonical path_scope stays exact origin https://github.com/brinyu13/missionmed-hq.git, canonical ref refs/heads/codex/ir-interview-ready-0002-storyforge, relativePath interview-ready, owner codex-ir-phase1-foreman. New session is ir-phase1-live-render-source-20261004-uuidhex. New exclusive consumption marker is SOURCE_LIVE_RENDER_REPAIR_LEASE_READ_CONSUMED_<read-admission-byte-SHA256>.json; prior markers are retained and old schema controls fail before capabilities. Any fresh-read failure consumes the one-use admission; it is not retry permission.

Prospective invocation only after independent review/controls and Foreman's current admission:

    python3 -B /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py --execute --approval /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/LIVE_RENDER_SOURCE_APPROVAL.json --read-admission /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/LIVE_RENDER_SOURCE_READ_ADMISSION.json --control-directory /Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/SOURCE_LIVE_RENDER_REPAIR_LEASE_20261004_1 --max-seconds 3600

The worker must call check_worker_guard(controlDirectory,binding,approvedSourceHead) immediately before each of the three permitted product writes and immediately before the one exact three-product-path commit. This runner does not grant writes to gateway/account source/manifest/phase1/other paths, package install, cache invalidation, native QA or provider mutation outside existing canonical source lease operations. New package generation/review/present-owner pointer activation/cache/live acceptance require separate admission after source repair.

Executed locally only:

    python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner_tests.py
    python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/integration_lease_runner.py

18 focused fixtures PASS; default DORMANT exit0; runner/tests compile PASS. Existing five-second keeper, immediate canonical renewal, ten-second worker freshness, finally release/cancellation/receipt failures/redaction and maximum3600 remain tested. New fixtures cover exact fresh base/three paths/current+Git preimage drift, independent repair review, old approval/read schema and packet expansion rejection, distinct newly bound custody HEAD, and KeyboardInterrupt release without false READY. Existing actual canonical-ref fixture is pure local; fake client/transport adapters perform no provider/credential/network operations. Byte comparison proves check_worker_guard and orchestrate are unchanged from BASE2db1f98. No transport/canonical RPC or source protocol rewrite occurred.

STOP UNCOMMITTED for Matrix independent exact helper/packet review. Only runner, its existing tests and this handoff were written; no actual credentials/retrieval/probe/provider/native/runtime/source-product/OS write, HEAD change, stage or commit occurred. Historical preceding recovery prose and receipts remain historical, not current admission.
