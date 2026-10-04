# Final independent INSTALL wrapper correction review

Verdict: **APPROVE WITH CONDITIONS — exact INSTALL-only orchestration; AUTH remains BLOCKED.** Reviewer `/root/phase1_matrix_release_implementation`, Sol6.1 High, 2026-10-04. Observed BASE/HEAD `b61c2ce000ff90f73d240ac9781a2b035eb30bba`. This reviewer did not build the wrapper/helper/native harness. The prior reports and BLOCK findings remain preserved as history; this report clears the narrow missing-owned-marker blocker for the changed INSTALL bytes only.

This is orchestration acceptance, not independent approval of product source authored by this reviewer, package content, actual installation/recovery/current runtime observations, native identities/state work, provider capability or final production release. Independent product/package/pilot/helper/operation-plan qualifications and final frozen custody HEAD/spec/control sealing remain required.

## Exact reviewed bytes

| Artifact | SHA256 |
| --- | --- |
| `runtime_native_runner.py` | `714c09d781b75c62e0296cd0f064879dbfeb7fb96c37833fb81cffa95dd617da` |
| `runtime_native_runner_tests.py` | `660e199a22c0660e965d91c62b2d61d9b454d8694b6633ec3e5209f2e25a1a24` |
| `RUNTIME_NATIVE_RUNNER_HANDOFF.md` | `ecd5dd924138242b44d768920afbf294d71647d55a50f34f35b187506cb71e93` |

All supplied hashes matched and were rechecked immediately before report write. The correction changes only owned-marker disappearance handling, its focused regression and corresponding handoff claims. Existing canonical authority/client/transport/source-package bindings, artifact-specific reviewer roles, privacy/one-use admission and unconditional AUTH blocks remain as reviewed in the preceding reports; native harness bytes are unchanged.

## Independent focused verification

`python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/runtime_native_runner_tests.py`: **20 tests PASS**, 3.750 seconds. No provider/SSH/credential/runtime/browser/identity/state operations ran. Mock controls/receipts use disposable local directories and actual source/package parsing; fixture attestations are not execution approvals.

The new regression calls actual run_session/drain, waits until a valid ACTIVE marker has actually been read, then unexpectedly unlinks that temporary marker. It verifies result STOP, **RELEASE_DEFERRED**, and no canonical client.release call. The source now returns false on absence once an owned identity was observed. Release after ACTIVE requires a valid COMPLETE record with unchanged operation/UUID/binding/fence/timestamps. Initial absence after dispatch closure remains eligible only under the separately reviewed helper guard2 protocol; it is not an inference that a previously observed operation completed.

The suite retains the actual delayed-operation ordering case, uncertain/invalid/ACTIVE-timeout deferral, source/fence/schema drift, stable admitted deadline and minimum30second margins to both deadline/server expiry, keeper closure, per-artifact reviewer rejection/acceptance, one-use custody/receipt failure, actual full35-input/full-ref package snapshot and pre-capability AUTH refusal. No further blocking defect was found in the narrow corrected INSTALL change.

## Conditions before one INSTALL execution

- Independently accept exact matching helper and operation-plan bytes, including guard1 → exclusive owned ACTIVE publication → guard2 before SSH → verified same-identity COMPLETE or UNCERTAIN. The wrapper/helper handshake is cooperative; actual remote preimage/after-image/shared preservation remain separate checks. Unknown custody must defer release and retain evidence, with no automatic cleanup/retry or cancellation/rollback inference.
- Freeze actual postcustody sourceHead/full sourceCommit and independently seal the exact wrapper/reports/package/source/DR/client/transport preimages. Supply real product/pilot/phase/recovery/runtime readback/three-path preimage and all15 shared bytes/selected-source qualifications from their appropriate non-builder reviewers. No value or approval may be inferred from a fixture or this report.
- Author exact separate one-use implementation/read JSON only after final spec is supplied and source custody is frozen. Healthy narrow INSTALL PATH+MATRIX-SHELL admission, immediate heartbeat, current operation guards, finally STOP/terminated keeper/fresh source/fence/expiry and acknowledged drain remain mandatory. The wrapper installs nothing itself. Missing or lost receipts/provider ambiguity require stop/current readback rather than inferred success.
- AUTH still refuses before controls/consumption/capability, and unresolved native race/deadline containment is not accepted. No INSTALL/source claim or control flag may be borrowed to perform native identity/state operations. Code-only withdrawal requires exact qualified dedicated gateway/current-pointer custody and preserves identities, IR metadata/history, enrollment, student state and siblings. Final native/browser/cache/Matrix/live/production gates remain open.

Only this new uncommitted report was written. All prior reports and source bytes remain preserved; no sourceHEAD/index change, stage/commit, provider/runtime/SSH/credential operation or deployment occurred. **STOP awaiting Foreman frozen custody HEAD/spec for separate exact INSTALL control sealing.**
