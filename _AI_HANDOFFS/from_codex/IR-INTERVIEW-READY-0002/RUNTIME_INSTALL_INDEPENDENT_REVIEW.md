# Independent INSTALL-only wrapper correction review

Verdict: **APPROVE WITH CONDITIONS — exact INSTALL-only orchestration implementation. AUTH remains BLOCKED.** Reviewer `/root/phase1_matrix_release_implementation`, Sol6.1 High, 2026-10-04. This reviewer did not build the wrapper/native harness. Observed HEAD remains `b61c2ce000ff90f73d240ac9781a2b035eb30bba`. This report supersedes the earlier missing-package-input blocker for the corrected INSTALL path only. Preserve `RUNTIME_NATIVE_INDEPENDENT_REVIEW.md`: its native worker/deadline finding remains unresolved and is closed off by unconditional AUTH refusal.

This is not an independent approval of product source authored by this reviewer, package content, installation operations, runtime/recovery observations, provider capability, identities/state work, or final production release. Those exact pilot/package/phase/recovery qualifications remain separate non-builder evidence and the actual execution controls remain to be independently sealed after Foreman custody/HEAD freeze.

## Exact reviewed correction

| File | SHA256 |
| --- | --- |
| `runtime_native_runner.py` | `e53b8f9d896d735aeec9940d51b84ecc0aae0633739cb48696ac5ddf53821c90` |
| `runtime_native_runner_tests.py` | `8954d34807e65b666639a8d93ee4f4929578d84596782c0ebe95f89cdbcf3afe` |
| `RUNTIME_NATIVE_RUNNER_HANDOFF.md` | `d0df80c140f6c05851cd155fb9cafc5408aab33c5b64c1b4f290e5865c9f568d` |

All hashes matched before review and were rechecked immediately before this report write. Native harness/tests remain unchanged at `a6f94593ee60b3f01031954f1594eff0a9edbadb3109581e272e8a6e7ed8b6cf` / `f26e1b6864cda582ac388de7c6ff1585d9e80adea58da02032638c330938e51e`; the prior `NATIVE_QA_INDEPENDENT_REVIEW.md` conditions remain binding. Canonical R2 OS/current DR/client/transport pins are unchanged from the prior review.

## Independent focused verification

`python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/runtime_native_runner_tests.py`: **13 tests PASS**, 2.248 seconds. No provider/SSH/credential/runtime/browser/identity/state operation ran. Tests use local mock controls/clients and self-cleaning temporary fixture reports; their invented report attestations are never admitted execution controls.

The added real package snapshot fixture reads actual full-ref package `/private/tmp/ir-phase1-qualified-fullref-20261004`, archive SHA256 `16f8f5795b1f54ebfce342eb36a5ca31c9717eda48755f0300c1c498c88f83fa`. It exercises actual snapshot code, all35 real committed buildInputs, actual seven-file archive/five payload hashes, current source/Git objects and authority/client/transport/native pins. Only the fixture report directory is substituted; snapshot and artifact checks are not mocked. Passing this test proves parser/custody compatibility, not semantic approval of the product/package or actual runtime preimages.

## Findings

No new blocking defect was found in the corrected INSTALL execution path.

1. `integration/release.py` is now an exact required input. Its actual bytes/digest and committed source blob receive the same checks as other fixed sources; it is not admitted through a generic script wildcard. Both manifest sourceRef and sourceCommit must equal the full product commit. The real35-input snapshot test catches the prior cross-artifact omission.
2. `execute()` unconditionally requires phase install before reading approval/read controls, consumption marker writes, module/private retrieval, provider acquisition or native capability. A supplied AUTH control cannot override it. `run_session()` independently requires install before heartbeat/readback/harness; when given an already existing AUTH handle in a local fixture, it stops and attempts finally release without native execution. The earlier alarm/race code remains inert and carries no AUTH acceptance. Direct helper/type fixtures do not confer native execution authority.
3. Accepted INSTALL behavior remains narrow: unchanged pure canonical PATH scope with exact dedicated gateway/runtime paths and MATRIX-SHELL only; snapshot/independent report/read/one-use gates before capability; immediate validated heartbeat and five-second keeper; safe STATUS/READY plus exact bound Foreman STOP; cooperative guard before each separately reviewed manual operation; canonical finally release even receipt/storage failures. The wrapper installs nothing, runs no SSH in INSTALL and changes no final flags, identities, user state, shared runtime, cache or lock.
4. Privacy/constant-output and dormant defaults remain accepted. Exact unchanged transport owns existing identity precedence, bounded retrieval/probe and canonical six-RPC seam. No raw credential or lease identity/nonce enters files, argv or diagnostic output. Missing/drifting qualifications, source/package/report paths, stale status/fence or failure receipts remain stops; absent receipts never imply success or provider-clear.

## Conditions before one INSTALL attempt

Freeze the actual postcustody sourceHead and full product sourceCommit. Independently seal exact corrected wrapper/tests/handoff, fixed full-ref package digests and all actual pilot exposure/phase/recovery/runtime readback report bindings. Product/package approval must come from its non-builder reviewer; this report supplies orchestration acceptance only. Independently author exact approval/read JSON after the final spec is supplied, binding actual reports and current source/authority/package/preimages; no missing value may be inferred or fabricated.

Qualify actual fixed host/webroot ownership, absence/collision or recoverable gateway/runtime/current-pointer preimages, exact operation/staging/atomic pointer and code-only withdrawal plan. During execution Foreman must call check_install_guard before each manual operation and separately enforce actual remote preimage/after-image/current15 shared bytes and selected-source equality. The local guard is not a remote interceptor. Pilot availability exposes normal public/free-account IR routes and is not a hidden QA-only or final LIVE release.

After STOP and canonical release, independently verify current provider-clear before any new phase. AUTH remains impossible in these bytes and requires a separately reviewed delayed-race/total-I/O/cancellation/drain design and exact changed-byte admission; no borrowed source/install claim, retry/read-admission reuse or control flag can enable it. Code rollback restores only qualified dedicated gateway/current-pointer preimages and preserves identities, IR metadata/history, enrollment, student state and siblings. Final native/browser/cache/Matrix/shared-selection/production acceptance stays open.

Only this new uncommitted report was written. The earlier BLOCK report and all product/wrapper/native/OS bytes were preserved; no index/HEAD change, stage/commit, retrieval/provider/runtime operation or deployment occurred. **STOP after report.**
