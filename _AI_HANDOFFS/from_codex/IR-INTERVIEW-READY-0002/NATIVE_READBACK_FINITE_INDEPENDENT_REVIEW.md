# Independent finite native readback delta review

Verdict: **APPROVE WITH CONDITIONS — exact three-file containment/freshness delta only.** The actual runtime-readback capture/reap/custody blocker in NATIVE_AUTH_CONTAINMENT_INDEPENDENT_REVIEW.md SHA256 `8c714122bf02d2924186e6d0add357ad0c941717ca726902f4a1cb4a11e70383` is resolved for the frozen bytes below. Initial prior-INSTALL-clear freshness is enforced before execution admission and acquisition and through the actual initial READY timestamp. This report issues no execution approval, read admission, lease, bootstrap qualification, native fixture creation or LIVE verdict.

Reviewer: independent nonbuilder `/root/phase1_release_verifier`, requested Sol6.1 High, 2026-10-04. Builder confirmed freeze and no further writes before review. Actual source HEAD remained `956d99717a9fe46968dccf4b3d94cfa17d0955a4`; canonical OS remains R2 `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`. Only this new report was written; no source/helper/OS/HEAD/stage/commit change or external capability occurred.

## Frozen custody

All paths are in `_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/`.

| File | SHA256 |
| --- | --- |
| runtime_native_runner.py | 42fec695a6161da453881d40c75ea940de1c55055a8e3641f3c60a72400a7302 |
| runtime_native_runner_tests.py | 0f44c89d2064e0942e55aec570332a1598fdc450fbbb6a97b3e7309e9faa933e |
| RUNTIME_NATIVE_RUNNER_HANDOFF.md | c74b91c0ffb09180bc5cc49dd9c2e74460467ac099d1ccc61d81213c9c824615 |

Native source `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1`, native tests `20f3510bd448acb876195eaba9592ca8d6845a1233f880b1deb8d872445e5015` and native handoff `4b25238b522405fbd5f46eb87a5bbef12d8c051e40f8189b427596125df16026` match HEAD byte-for-byte. Their earlier independent containment findings are reused rather than replaying the whole native suite. Matrix helper four paths and transport also match HEAD: helper `8ab2d30b5bd5b8170250e124dd6c8bdf6268915d4ff62002eb857aa68a747389`, tests `cba6974c6c7c01c2bd2b02a219c5db9870ef338f0b69359f2e187938b5b905ae`, plan `80e86a5e2413a21cecf2ce75ed165dea7268824949a5a2b49a2ee5102291288b`, handoff `1d28424093ba42fae64260e2e5a898dd9a2694282857d13fad0bcf2bb12240d8`, transport `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad`.

## Resolved finite-readback finding

The fixed SSH argv and remote read-only public-artifact hashing program are unchanged. `runtime_readback()` now delegates to the hash-pinned native `private_capture()` rather than `communicate()` and unbounded `wait()`. Stdout is capped during receipt at4096 bytes; stderr retains the existing65536-byte cap and any stderr causes rejection. Nonzero exit, malformed JSON, extra/missing keys and hash drift fail privately. One8192-byte read chunk can precede cap rejection; no4096-byte total-memory claim is made.

`Session.checked_readback()` registers its Dispatch before capture or process start, including initial verification before NativeGate exists. The Session-owned begin guard checks phase, closing/failed state, exact initial fence, actual canonical expiry and the unchanged session or closed-drain deadline. The production entry cannot select the test-only readback callback through controls. I/O uses the lesser of10 seconds and the existing session/drain deadline; native capture adds at most2 seconds of local reap grace. No unbounded wait remains in this seam.

Launch attempts with unknown outcome and children still unresolved at the custody check remain tracked and sticky; later exit does not erase a previously recorded unresolved state. `readbacks_drained()` uses its separate lock, so an in-flight keeper holding the Session lock cannot make the release decision wait on that lock merely to inspect readback custody. Canonical release requires native drain, readback drain, dispatch closure, keeper completion and the existing manual-operation drain. A stopped, actually reaped initial failure can release its owned claim; an active/unresolved readback produces RELEASE_DEFERRED. No remote completion, rollback or cancellation is inferred from local reap.

Closed native drain uses only the already established drain deadline and same unexpired fence, retains STOP, and cannot reopen dispatch. Existing source, heartbeat, expiry and release checks are retained. INSTALL does not dispatch this runtime-readback path.

## Initial freshness and later owned lifetime

Static snapshots retain the structurally qualified report and exact binding: prior phase install, released=true, integer activeIR0/pendingIR0 and finite positive observation time. Expired-but-unreleased evidence cannot satisfy this field.

`install_clear_fresh()` requires `observedUnix <= admittedUnix <= now` and `admittedUnix < observedUnix+300`. It runs during control validation before consumption/private module loading, immediately before canonical acquisition after retrieval/probe, before initial renewal/readback, and against the actual generated initial READY timestamp before publication. Age299.999 is accepted;300 and future observations/READY times reject. Time spent in the private probe or initial verification cannot admit a stale acquisition/READY.

Later static snapshots do not repeatedly expire the historical clear record. They still bind its exact content/report and current source/contract. Actual later operations retain current healthy-fence, canonical expiry, STOP/closure and unchanged session/drain deadline checks. This does not extend the admission, refresh a prior observation, rewrite READY, reacquire an expired claim or fictionally release the original retired claim.

## Independent local evidence

- The handoff's exact focused33 replay passed independently:33 tests,2.830 seconds. Nine readback tests exercise the actual native streaming capture with injected OS pipes/thread children; six clear tests cover admission/acquisition/initial READY and later lifetime; eighteen related scope, privacy, race, drain and role regressions pass. No actual subprocess, SSH, provider or WordPress execution was used by these fixtures.
- Four additional independent injected cases passed in0.065 seconds: strict299.999/300/future/non-numeric admission boundaries; later historical clear cannot admit a changed fence or expired closed drain; expiry between registration and Dispatch.begin prevents Popen and clears nonstarted custody; one stderr byte yields private STOP and actual child/thread end precedes canonical release. No fixture artifact was added to the repository.
- Focused33 includes pre-Gate unresolved/unknown launch deferral, current STOP/fence/expiry and registration-to-begin refusal, slow-drip/delayed-output/cap/nonzero/invalid JSON cases, post-Gate unresolved custody, keeper/worker end before release, unchanged50ms/311ms native worker race, stale clear before consumption, stale-after-probe no acquisition, and stale-after-readback no READY.
- Both changed Python files compile without bytecode. Default CLI exits0 with DORMANT. Scoped three-file `git diff --check` passes. Frozen hashes and source HEAD were independently checked.

## Remaining gates and disposition

This report qualifies the missing finite wrapper seam together with the unchanged native containment evidence in8c; it does not qualify WordPress bootstrap or any callback semantics. AUTH/auth_inventory still require independent bootstrap and reachable-inventory qualification before actual WP bootstrap; private inventory observation and actual released inventory binding; subsequent independent reachable creation/auth/metadata/role/mail/HTTP/direct-effect review; and separate fresh create admission. Unknown reachable effects remain blocked.

Before execution, Foreman must freeze current custody, repin the dependent manual helper as separately authorized, obtain the actual unpatched current35-input/source/package/qualification snapshot, and author new exact independent one-use controls with fresh provider/runtime observations and canonical AUTH admission. No old controls or old-package snapshot is reused here. Installed-clear report `b83817ee3962b291029942839fc8b488b620c5ce1e402cd27a02d71d46e24210` remains historical actual released/runtime evidence, not a new freshness observation by this review.

Actual native persistence/security/role/cache acceptance remains separate. Existing Root public/browser/admin evidence retains its stated provenance; no actual MR-session proof or A/B native state proof is supplied here. No source/bootstrap metadata reader, runtime operation, fixture identity, credential retrieval, provider read/DML, cache write or execution control was performed.

STOP UNCOMMITTED. Write set: only NATIVE_READBACK_FINITE_INDEPENDENT_REVIEW.md. Independent delta verdict only; no self-approval or broader production authorization.
