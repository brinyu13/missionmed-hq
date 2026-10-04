# Independent native AUTH containment and INSTALL wrapper review

Verdict: **BLOCK AUTH / AUTH_INVENTORY execution for the exact frozen wrapper below. APPROVE WITH CONDITIONS for the bounded INSTALL-only schema/coordination changes.** The native HTTP/owner capture and race containment fixtures pass, but the wrapper's actual runtime-readback SSH seam does not satisfy finite receive/reap containment. No execution controls, native admission, release authorization or LIVE claim are issued by this report.

Reviewer: independent nonbuilder `/root/phase1_release_verifier`, requested Sol6.1 High routing, 2026-10-04. This reviewer did not build the native harness, wrapper, product, or current manual helper. Only this report was written. Source HEAD independently matched `8717ebd04ad1cd60e66ef197b55080d58492e2be`; no stage/commit/HEAD/push/source/provider/runtime/credential/bootstrap operation was performed.

## Exact frozen review custody

Builder confirmed all six files frozen and no further writes before review. SHA-256 was independently checked before reading and after local verification:

| File in this handoff directory | SHA-256 |
| --- | --- |
| native_account_qa.py | c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1 |
| native_account_qa_tests.py | 20f3510bd448acb876195eaba9592ca8d6845a1233f880b1deb8d872445e5015 |
| NATIVE_ACCOUNT_QA_RUNNER_HANDOFF.md | 4b25238b522405fbd5f46eb87a5bbef12d8c051e40f8189b427596125df16026 |
| runtime_native_runner.py | 4aab4b5b37625134572cd231ac326cc6d8b95eb2aee94e70175cf92a48185dc3 |
| runtime_native_runner_tests.py | 2fe7b2f4eb735566676b7b85b0b7246db0ab7dd245b494d6f30f2ad7e5a23150 |
| RUNTIME_NATIVE_RUNNER_HANDOFF.md | a6f58636761a96d5e40cad1fb97c8c5284c7df0dd2c6ae83a8d90b3fd6880e97 |

Bounded dependency checks: AUTH_CONTAINMENT_PACKET.md `d5318c14da0a686070d3bff4bfd3b3c363a9e0f2f77285086cacc57c7ecb316a`; lease_transport.py `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad`; canonical engineering_os_lease.py `36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431`; canonical DR-376 `452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e`; LIVE_RENDER_SOURCE_CLEAR_REVIEW.md `a3a6767253095a352da8f388d74ea05fbfc819dd88d5bb037199b9384ec6a786`.

Read only IR-routed R2 BOOT/CURRENT/mission/passport/authority dependencies. Independent read-only validation command returned `BOOT_DEPENDENCY_VALIDATION_PASS profile=IR-INTERVIEW-READY-0002 hq_tip=0feee579b0a9f2c90529220899f6cf6d21b8cd05`:

```text
python3 /Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2/tools/validate_boot_dependencies.py --hq-git-dir /Users/brianb/MissionMed/.git --os-root /Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2 --mission-profile IR-INTERVIEW-READY-0002
```

The canonical storage contract remains WordPress `_mmed_ir_state_v1` for the authenticated self; no GrowthEngine product state, borrowed AUTH mutation scope or enrollment grant is admitted. The separate immutable render package `/private/tmp/ir-phase1-renderfix-20261004`, source8717/archive `a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3`/HTML `456269800610e4370ab2930bc7ee7007eadc3f36c3ba2116136ef611c15e354c`, is supplied prospective custody only here. This review did not rerun/adopt the old16f8 snapshot or independently qualify new product/package/helper bytes.

## P1 blocker: actual AUTH runtime readback has an unbounded capture/reap path

`runtime_native_runner.py:303-312` starts an SSH subprocess, uses `communicate(..., timeout=10)`, applies the4096-byte stdout cap only after all output is captured, and on timeout/error executes `child.kill(); child.wait()` without a timeout. There is no receiving-time stdout/stderr cap, explicit reap deadline, or retained tracked child when reap cannot complete. The private environment/capture discipline of native `private_capture` is not used by this seam.

This is inherited code, but it is actually reachable in both new AUTH entries: initial `run_session` renewal requests runtime verification before READY, each `native_control` calls `renew(verify_runtime=True)`, and closed native keeper drain calls runtime readback again under the session lock at line378. Native Gate dispatch/process tracking does not cover this wrapper subprocess. A stuck wait can therefore prevent bounded STOP/drain; unexpected SSH output can exceed the intended cap in memory before rejection. The ten-second communicate timeout alone does not establish the required total bounded stop. No claim of an observed live hang is made.

Independent local fake-child reproduction, with Popen replaced and no subprocess/network/provider capability, observed:

```json
{"fixture":"runtime_readback_timeout_reap","communicate_timeout":10,"kill_calls":1,"wait_timeout":null,"wait_has_explicit_timeout":false}
```

The33 builder-focused tests passed independently but do not cover this actual runtime-readback receive/reap seam. **Do not set `nativeContainment.finiteContainmentQualified=true`, issue AUTH read admission, bootstrap WordPress, or create fixtures using these wrapper bytes.**

Bounded correction required: route this fixed read-only readback through receiving-time capped private capture with an explicit finite I/O/reap budget and retained unresolved-process custody. Failed/unreaped readback must STOP and defer canonical release; add fake-only timeout/slow-output/cap/reap/release-order evidence for this exact seam. Refreeze affected bytes and obtain independent review. This report authorizes no implementation edit.

## Passing contract observations

- Native admission modes are closed and separate. Inventory admits only creation_inventory_read without an unknown hook digest. Bootstrap/reachable-inventory semantic qualification precedes actual WP bootstrap. Create admission requires a separately observed digest, released inventory binding and reachable/bootstrap qualification; each creation rechecks the full registry digest.
- Inventory pipe allowance is1MiB only for its named action; other owner/credential captures retain64KiB. Registry schema, counts, callback identifiers/types and PHP-compatible row digest are checked. Raw registry remains in process memory; durable result and CLI project only safe digest/counts. Caller must preserve the private API result boundary.
- Exactly the two named `.example` subscriber fixtures are prospective. Username/email collision stops without adoption/reset/deletion. Private credentials use stdin/memory, canonical wp_insert_user, no-course assertion, no mail/enrollment authority, and self-only IR metadata. Semantic qualification remains necessary because suppression is installed after WP bootstrap and cannot establish direct callback/transport safety.
- Native curl argv is fixed `/usr/bin/curl -q --config -`; URL/method/body/header/cookie/nonce use private stdin. Fixed nonsecret environment, HTTPS/TLS, no proxy/netrc/rc/redirect/retry flags and bounded body/header/stderr capture are implemented. Curl max-time and independent capture share an absolute deadline no later than remaining admission/12s, with2s local reap. Root's curl8.7.1/AsynchDNS executable qualification is supplied evidence; this reviewer did not execute curl.
- Gate closure/register/begin checks, queued cancellation, nested owner/HTTP budget, tracked futures/threads/processes and shared15s drain prevent native worker early-release. Unreaped native process remains ACTIVE and defers release. Already sent server work may have committed; local stop is not remote rollback or cancellation proof.
- Native drain renewals retain only the same unexpired fence, verify source/runtime, publish STOP before/after heartbeat, and do not reopen dispatch. Receipt/fence failures do not bypass worker drain. This logic passes the fake release-order fixtures, subject to the actual readback blocker above.
- INSTALL marker additions are exactly refresh-ir-html, refresh-home-html and restore-pointer. The wrapper performs no cache/network/runtime mutation. Typed PRESENT preimage is accepted only for RUNTIME, with exact schema/sha256 keys; gateway/current remain string SHA or historical ABSENT. PRESENT helper transitions, fixed layout inventory and recovery require separate independent qualification.
- Current manual helper builder is `/root/phase1_matrix_release_implementation`; wrapper role excludes that builder, the native/wrapper builder and Foreman. Separate install_artifact role excludes actual helper builder/Foreman while permitting an independent product/helper reviewer. Historical donor identity does not replace current authorship. These role checks do not self-approve any report.

## Independently executed local verification

1. `python3 -B .../native_account_qa_tests.py`:17 PASS,0.846s. This exercises normal forms/privacy/named owner/collision/PHP syntax, private curl config/cookie/POST, injected pipe slow-drip headers/body/DNS model/caps/nonzero/no retry, nested/expired/closed-before-start budgets, actual50ms/311ms race/queued cancellation, strict private inventory and unreaped-child retention.
2. Selected wrapper16 fixtures:16 PASS,1.470s. Actual two-worker race ends precede release; STOP-only owned drain renewals; receipt/fence failure drain; unresolved child release deferral; inventory mode/CLI aggregation; qualification failure before capability/read consumption; exact scopes/one-use/no retry; INSTALL lost-marker/closing keeper/TTL; three new marker names; strict typed preimages; actual-builder role exclusions.
3. Independent fake runtime-readback timeout fixture confirmed the P1 unbounded wait, as shown above. No actual child was launched by it.
4. All four Python files compile using compile() without bytecode. Scoped `git diff --check` passes. Six final SHA-256 pins rechecked unchanged. Only local PHP syntax checking was executed by the native fixtures; no WordPress was loaded.

Selected wrapper fixture names: test_auth_real_race50ms311ms_workers_end_before_release_with_stop_drain_keeper; test_native_receipt_or_drain_fence_failure_never_releases_before_worker_end; test_native_unresolved_dispatch_defers_release_and_inventory_receipt_is_aggregate_only; test_inventory_mode_has_only_read_action_and_cli_omits_private_registry; test_real_native_admission_types_and_auth_failure_drains_before_release; test_missing_auth_or_inventory_qualification_precedes_consumption_and_capabilities; test_exact_canonical_phase_scopes_and_no_other_domain; test_one_use_consumption_before_private_transport_and_no_retry; test_actual_active_marker_disappearance_defers_release; test_closing_prevents_inflight_keeper_healthy_republication; test_canonical_ttl30_accepts25_server_remaining_but_requires30_session; test_owned_active_drain_renews_same_ttl30_fence_with_stop_only; test_default_missing_final_artifacts_and_bad_phase_have_no_capability; test_only_admitted_route_refresh_and_pointer_restore_markers_use_install_guard_and_drain; test_typed_layout_preimage_is_runtime_only_closed_and_lowerhex64; test_per_artifact_review_roles_preserve_wrapper_independence. Prefix each with `Fixtures.` on the wrapper test CLI.

## INSTALL-only disposition and limits

The blocked SSH seam is not invoked by the inspected INSTALL phase: initial renewal uses verify_runtime=false, ordinary INSTALL keeper renews source/fence only, manual owned drain likewise verifies local snapshot/fence/marker without runtime_readback. Thus this AUTH finding does not itself reject the reviewed INSTALL-only schema/marker/PRESENT changes. **APPROVE WITH CONDITIONS applies only to that capability boundary**, with exact new product/package/helper/plan/recovery/runtime qualifications and a fresh real unpatched35-input snapshot still required before independent INSTALL execution controls. There is no INSTALL acquisition or render-upgrade admission in this report.

Old pilot PRESENT structure/source-release/provider counts in LIVE_RENDER_SOURCE_CLEAR_REVIEW are time-specific prior independent evidence, not fresh provider/runtime observations by this reviewer. New package is not installed by this work. No private inventory, named fixture creation, native role flow, actual browser/motion/mobile, cache, admin/MR or live persistence acceptance was attempted. No broad audits were replayed. Remote completion/ambiguity is unresolved by local fixture success.

STOP UNCOMMITTED. Write set: only NATIVE_AUTH_CONTAINMENT_INDEPENDENT_REVIEW.md. No controls, source/helper edits, credentials/private output, provider reads/DML, lease calls, curl/SSH/bootstrap, runtime/cache mutation, stage/commit/push or self-approval. Parent may route the bounded readback correction and a fresh independent affected-byte review.
