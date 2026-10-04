# Independent INSTALL drain correction review

Verdict: **BLOCK — one bounded unknown-marker-custody defect remains.** Reviewer `/root/phase1_matrix_release_implementation`, Sol6.1 High, 2026-10-04. Source BASE/HEAD `b61c2ce000ff90f73d240ac9781a2b035eb30bba`. This reviewer did not build the wrapper/helper/native harness. Review is restricted to the changed INSTALL coordination bytes and focused fixtures; it supplies no independent product source/package self-approval, runtime operation approval or AUTH/production acceptance.

## Exact custody and replay

| Artifact | SHA256 |
| --- | --- |
| `runtime_native_runner.py` | `536ae84f25cc285de35e4290f93ce6f7d9e8628656a8ae2a170e13a56310b8cb` |
| `runtime_native_runner_tests.py` | `8b811e7e50a56e3eff3a80bf80ed1a5257f349723297593d657462aaa707625b` |
| `RUNTIME_NATIVE_RUNNER_HANDOFF.md` | `cdf6c1bf6fec24bc99227b9e037c396e00c586b59ab89628f046fd7aa322594d` |
| `MANUAL_RUNTIME_OPERATIONS_INDEPENDENT_REVIEW.md` | `6b2638968038f72432d984f422692ec09112778b4e0ca44fd5054945af29a477` |

Independent `python3 -B .../runtime_native_runner_tests.py`: **19 tests PASS**, 3.482 seconds. This includes real full35-input package snapshot compatibility, stable deadline/server margin guards, per-artifact reviewer roles, delayed0.05second admission/0.4second acknowledged completion before release, uncertain/invalid/ACTIVE-timeout deferral, source/fence/schema drift and closing-keeper behavior. All operations remain local mocked clients/source/readback/receipts. No provider, SSH, credential, runtime, identity/state or browser operation ran. Hashes were rechecked immediately before report write.

## Blocking finding

**[P1] Losing an observed ACTIVE marker is accepted as successful drain.** In `drain_manual_operation()`, the loop tracks `owned` after seeing a valid ACTIVE record, but its next `value is None` branch always breaks successfully. Therefore an unexpected deletion of the in-flight marker is treated like acknowledged completion. The fresh source/fence/expiry checks do not establish that its remote operation completed; subsequent run_session can call canonical release while that operation's acknowledgement/custody is unknown.

A bounded local reproduction invoked actual Session/drain code with a valid owned publish-gateway ACTIVE record, current fake fence/expiry and unchanged fake source. A thread unexpectedly removed only that temporary record after0.08seconds; no COMPLETE was ever written or observed. `drain_manual_operation(..., seconds=0.25)` returned **True**, making release eligible. No real remote work/provider call or source edit occurred, and the disposable fixture self-cleaned. This is the same unknown-completion class as an UNCERTAIN marker and must not be promoted to safe release merely because the file is now absent.

Minimal correction: initial absence after proven dispatch closure can remain eligible, but after the drain observes an owned ACTIVE record, absence without the same identity's verified COMPLETE must return false/RELEASE_DEFERRED. Preserve the unknown operation evidence and require separate actual reconciliation; no automatic cleanup or completion inference. Add only the focused ACTIVE-to-missing fixture alongside existing acknowledged COMPLETE/deadline tests. Align the handoff, which currently permits an owned ACTIVE to become “COMPLETE or absent.” If a legitimate helper clears an acknowledged COMPLETE before the drain observes it, that race must retain separately verifiable completion custody or safely defer; an unqualified missing file cannot prove completion.

## Corrections accepted within this review

- READY/STATUS expose one stable admitted deadline and matching source/binding/fence. New manual dispatch requires at least30seconds to both that deadline and server expiry. This is a start margin, not a hard cancellation or remote-preimage proof.
- Closing writes STOP before keeper join and again after a terminated keeper; renewal checks closing after actual heartbeat and cannot deliberately republish HEALTHY during closing. A still-live keeper blocks release. Helper guard2 after exclusive ACTIVE registration must recheck STOP before any SSH dispatch; a registration after closure cannot dispatch under a stale guard1.
- Strict marker schema binds operation allowlist, public v4 identifier, owner binding/fence and finite at-most10second operation window. ACTIVE timeout, UNCERTAIN, invalid identity/schema, source/fence/expiry drift and ambiguous dispatch closure defer release without cleanup. The bounded20second marker wait is separate from source sealing time; no total-hardwall or SSH-kill-as-remote-cancellation claim is made.
- Per-artifact roles match Foreman's adjudication: top-level wrapper/read approval excludes wrapper builder, helper builder and Foreman; INSTALL artifact qualifications exclude helper builder/Foreman and may be independently authored by the wrapper builder for artifacts they did not build. This preserves actual artifact independence rather than granting wrapper self-approval.
- Prior full-ref/sourceCommit/required-release.py package correction remains intact. AUTH still unconditionally refuses before controls/consumption/capability and direct AUTH session refuses before heartbeat/native execution. Native harness bytes remain unchanged and native deadline containment is not approved.

## Later INSTALL conditions

After the narrow fix, rereview exact changed wrapper/tests/handoff hashes and the focused missing-marker case; no broad unrelated QA is required. The separate non-builder review must accept the helper's exact compatible guard1/exclusive-marker/guard2/acknowledgement protocol and operation plan. Independent final pilot/package/source/phase/recovery/current runtime/shared15-byte/source-selection qualifications and final frozenHEAD/spec/control sealing remain required. This report invents none of those values.

On unresolved operation/remote completion, stop dispatch, retain evidence and defer release; server expiry, marker disappearance or SSH termination is not an acknowledgement. Foreman owns actual state readback and fresh qualified safe custody/recovery. Code-only withdrawal preserves identities, IR metadata/history, enrollment, student state and all siblings. No AUTH, full native/cache/browser/live or final production acceptance follows these local fixtures.

Only this new uncommitted report was written. Earlier reviews and all source/wrapper/helper/harness/OS/control bytes were preserved; no index/HEAD change, stage/commit, cleanup, provider/runtime or deployment action occurred. **STOP after report.**
