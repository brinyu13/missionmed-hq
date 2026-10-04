# Independent manual helper TTL qualification

Verdict: **APPROVE - exact current helper and unchanged operation plan for INSTALL phaseDecision sealing.** Reviewer `/root/phase1_native_qa_runner`, Sol6.1 High, 2026-10-04, independent of helper/plan builder `/root/integration_lease_runner`. Source BASE/HEAD `6f1c2c8c8b61226258e0038974f4ead25056a7c9`. No blocker found in this narrowed change. This report does not approve its author's wrapper; separate Matrix approval supplies that dependency's acceptance. Actual execution still requires the conditions below.

| Reviewed binding | SHA256 |
| --- | --- |
| manual_runtime_operations.py | `9f797a2dc6e7d88c77aedeeed990e873aa7e75139f44a9f245ca8066094a909a` |
| MANUAL_RUNTIME_OPERATIONS_HANDOFF.md | `40612645e06d474007f8f7b06e424cc36df1465f55b5aba5e6153e0e7e2afbc5` |
| Required pinned wrapper | `a0c89cd028d1dda1f94672a77f71465ec2c42e9a8c488871565b8f2c4e639956` |
| Matrix RUNTIME_TTL_INDEPENDENT_REVIEW.md, read and hash-verified | `96a2aca7ace02b6be3cf0c8d961736dc8a8f36041dcca95c653155912d9cb1b1` |
| Preserved MANUAL_RUNTIME_OPERATIONS_FINAL_INDEPENDENT_REVIEW.md | `b512c4bb0f2b4371a8c7f59269d75fc07cf9dbc0df05007ae551dcd79b6bbead` |
| EXACT_RUNTIME_INSTALL_RECOVERY_PLAN.md | `6a1cd7a25ee809a0abe99bf77992cc1be4f03e28db19a4d0c7f97f8c8b355a97` |

All six actual artifact hashes match the assigned pins. Exact comparison with the helper Git object at BASE proves precisely three substitutions: RUNNER_SHA adopts the independently reviewed current wrapper; the duplicated admitted-session floor uses `runner.MANUAL_DISPATCH_MARGIN` (30); and the duplicated canonical-server floor uses `runner.MANUAL_SERVER_MARGIN` (20). No other helper bytes changed. Embedded REMOTE_SOURCE is byte-identical to BASE, SHA256 `7c9bbf981a16e64470e59a8537bb24bdb3f450c3f740a5b97f43fc08f7c22dc9`. Package/plan/paths/role exclusions/marker states and identities/remote alarm/operation timeout/acknowledgement-before-postguard remain unchanged. Historical prose requiring30s for BOTH deadlines is explicitly superseded by the handoff's final TTL section.

The two separate floors remain mandatory before dispatch. Thirty seconds to the stable admitted session deadline reserves the operation/drain window; twenty seconds to current canonical server expiry is compatible with a30-second TTL. The helper still invokes the actual wrapper INSTALL guard, then independently repeats both exact named floors. No TTL/client/transport/fence/source check, STOP check or one-use admission was removed. Guard2 after exclusive ACTIVE registration remains unchanged and calls this same local_guard before SSH. The helper cannot reopen dispatch, renew/acquire/release a lease, infer completion from timeout/SSH termination, or turn uncertainty into COMPLETE.

## Focused independent evidence

Replayed the exact local fixture command in the changed helper handoff: exact three-substitution comparison, unchanged embedded source, helper compile/embedded AST and five TTL/STOP guard fixtures PASS. Default invocation exits0 with the constant DORMANT message. No execution controls or operation marker were created.

Also ran the actual current helper.local_guard with its actual hash-pinned wrapper.check_install_guard, fixed in-memory clock and synthetic public-only approval/READY/STATUS/report/source adapters. Actual guard logic was not replaced. Canonical server remaining30,25 and boundary20 with session30 accepted; server19.999 and session29.999 rejected; restored healthy margins with STATUS STOP rejected, covering the guard2 closure condition. The helper's duplicated floors and wrapper floors agree at the boundaries. Popen was explicitly disabled. This is local cooperative protocol evidence, not an actual provider/remote timing observation or this reviewer's independent wrapper approval.

The prior b512 actual helper/wrapper-pair qualification remains the unchanged-protocol baseline: acknowledged same-operation COMPLETE retained before canonical release, nonacknowledgement UNCERTAIN deferred, actually observed ACTIVE disappearance deferred, and closing guard2 dispatched no SSH. Those accepted branch/race fixtures were not broadly repeated for this literal/wiring-only helper delta. Matrix's current independent wrapper report separately qualifies STOP-only same-fence drain renewal, failed-renewal/lost-marker deferral and the current TTL tests; its report conditions remain binding.

## Exact sealing and execution conditions

This helper/plan review may supply `qualifications.phaseDecision` with verdict APPROVE, independentReviewer `/root/phase1_native_qa_runner`, reportFile `MANUAL_TTL_INDEPENDENT_REVIEW.md`, this report's actual reportSha256, and exactly:

- `manualOperationsSha256=9f797a2dc6e7d88c77aedeeed990e873aa7e75139f44a9f245ca8066094a909a`
- `installPlanSha256=6a1cd7a25ee809a0abe99bf77992cc1be4f03e28db19a4d0c7f97f8c8b355a97`
- `manualOperationMode=install`

Top-level wrapper implementation/read approvals must retain the separate non-builder Matrix reviewer and current exact wrapper/tests/handoff/review hashes. Foreman must commit/freeze fresh custody sourceHead, re-seal exact sourceCommit/fullref package/authority/qualified preimages/report bytes and obtain fresh distinct one-use controls/new attempt2 control directory. Consumed attempt1 controls/receipts are immutable and cannot authorize a new claim. Qualified gateway/runtime/current preimages remain ABSENT; every actual operation still requires current healthy narrow INSTALL PATH+MATRIX-SHELL ownership, guard1/register/guard2, exact remote preimages/owned transitions and all fifteen shared-byte preservation checks. Unknown/lost/UNCERTAIN or deferred release requires actual independently admitted reconciliation, never automatic retry/cleanup or completion inference.

The unchanged plan's code-only withdrawal qualification is preserved from the earlier independent report; this INSTALL phaseDecision does not itself admit recovery. Recovery still requires its own mode, exact installed bindings, fresh prior-install release/provider-clear attestation and independent controls. Public ordinary/free-account pilot exposure remains explicit; production flags, AUTH, native identities/history acceptance and final LIVE verdict remain blocked/separate. Unrelated claims must not be borrowed or overridden.

Only this report was written, uncommitted. No helper/wrapper/product/package/client/transport/OS/HEAD/stage/commit/provider/credential/SSH/runtime/native/DB change or actual capability occurred. **STOP for Foreman custody and Matrix's fresh control sealing.**
