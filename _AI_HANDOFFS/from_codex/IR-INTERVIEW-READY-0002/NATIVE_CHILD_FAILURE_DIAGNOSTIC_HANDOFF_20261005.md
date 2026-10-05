# Native child failure discriminator — 2026-10-05

**Implemented, locally verified and frozen for independent exact-byte review. STOP. Actual5 remains INVENTORY_CAPTURE/child_exit; no actual child cause is inferred.**

Builder `/root/inventory_php_failure_markers`, inherited Sol6.1 High. Helper BASE `d9f58cd44d62980f58a6d3f5ee1c5c25d9e34e4e`; Root subsequently filed public diagnostic custody at `8c5226d` without changing these helper base bytes. Product source `8717` remains unchanged. Existing local AGENTS/BOOT and routed R2 DR-375/376 remain the authority context; Root owns OS/profile/provider custody. No additional authority or source audit occurred here.

Read the closed CLI command-resolution program and independent read review. Root reports wp/php/qualified-launcher/stdin booleans true and effectiveUidZero false, public readback SHA-256 `65435b2552fa3d9f55ab2b4d1e5f1f507f7652c07eba63fecfb98887a8a7b277`. This establishes command-resolution metadata only. It does not establish successful PHP/WP bootstrap, inventory execution or any actual5 error text. No remote read was performed by this builder.

## Frozen write set

All six allowed paths are under `/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/`:

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | `f2954456fce5f51ac50827fdb7840311621d452d41cd523def9f55d1ffdbc3cb` |
| native_account_qa_tests.py | `9ae4cd2b92e31fc0b65b1b74c96d70ad4d4695c63ae669c6be2178ceb66facbd` |
| runtime_native_runner.py | `a36ef2e9097d8aff08af0075d123d4360389830f975c494a25dd96478433c218` |
| runtime_native_runner_tests.py | `d832743f1c9e932c4a4cb835e17a6279cd0df60139eec03e1129a0df61b57e40` |
| native_inventory_owner.py | `9309f2fbf4d0c088176da0fc3c8e6fca57bc09b0317bb682848ad29f120a19de` |
| NATIVE_CHILD_FAILURE_DIAGNOSTIC_HANDOFF_20261005.md | Digest supplied in freeze notice |

Exactly the native QA/wrapper source dependency pins in owner were refreshed. Bridge/manual helper/other owner pins are unchanged. Wrapper NATIVE_SHA/NATIVE_TESTS_SHA match the frozen QA files. No commit, push or deployment by builder.

## Minimal discriminator

Only after an existing nonzero inventory child exit, the helper considers its already privately captured stdout/stderr. The prior exact closed PHP sentinel interpretation retains priority and its scope semantics. The new fallback checks only a sole nonempty stream of at most 4096 bytes against a small known-message set:

| Category | Recognized message shape |
| --- | --- |
| php_fatal_error | Leading PHP Fatal error/Fatal error marker |
| php_parse_error | Leading PHP Parse error/Parse error marker |
| wp_cli_bootstrap_error | Fixed WordPress-installation or database-connection error prefix |
| wp_cli_command_error | Exact missing /dev/stdin file or unregistered eval-file command error |
| ssh_transport_error | Specific hostname-resolution/connect failure shape or exact host-key verification failure |
| shell_command_error | Fixed wp/php command-not-found form |

PHP Fatal/Parse markers at the start of sole private stderr permit bounded trailing trace bytes, including multiline stack traces. Sole stdout error shapes and all remaining forms must match a single printable line in full. The categories describe recognized message shapes; they do not authenticate the sender or prove an underlying root cause. Arbitrary two-stream fallback output, unknown/middle-only prefixes, oversized/malformed messages and silent exits remain child_exit. Exit255 alone never implies SSH. No generic WP error prefix, arbitrary substring match, raw-output retrieval or expanded remote investigation was added.

Root explicitly authorized a fallback discriminator even when error suppression produces no known text: optional `childExit` with exactly nonzero integer `exitCode` in [-255,255], boolean `stdoutPresent`, and boolean `stderrPresent`. It is present on nonzero inventory exits, including the existing PHP sentinel categories. It conveys no text, identity, path, hash, argv, tag, callback, exception or content. Zero-exit/non-inventory actions preserve their existing behavior and do not receive it.

QA Stop validates and copies only this closed object. Wrapper accepts it only from exact qa.Stop, independently revalidates the exact three keys and types/range, and adds it only to the failure receipt. Unknown category drops hookScope and childExit; malformed childExit is omitted; Stop subclasses/other exceptions remain generic. No message/trace bytes or exception str/repr/args are serialized. No known message changes rejection to success, and failure nativeReport stays null.

The discriminator uses existing capture and wait buffers only. Fixed PHP preamble/inventory, full registry traversal, reflection/hash/schema checks, action set, transport argv/environment, caps, budgets, deadlines, reap and drain/release custody remain unchanged. No retry, skipped hook, command flag or timeout change.

## Verification

| Local command from assigned worktree | Result |
| --- | --- |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_account_qa_tests.py` | 24 tests PASS, 0.892 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/runtime_native_runner_tests.py` | 48 tests PASS, 9.271 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_inventory_owner_tests.py` | 23 tests PASS, 0.426 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_browser_bridge_tests.py` | 15 tests PASS, 0.130 s |
| `git diff --check` | PASS |

Injected pipe/thread fixtures cover each fixed category on both streams, multiline PHP stderr, unknown/two-stream/middle-prefix/binary/oversized fallback, silent255, zero-exit and unrelated-action refusal, private-output nonleakage, exact status/presence, malformed/extra/nonboolean/out-of-range receipt values and subclass refusal. Wrapper fixtures prove null failure reports and child completion/drain-before-release for all message classes. Existing cap/deadline/unreaped containment fixtures continue to pass. No actual subprocess/SSH/WordPress operation is started by these fixtures; existing local PHP checks are syntax-only.

Read-only AST comparison against helper BASE proves every existing QA function/class outside Stop/private_capture unchanged, including exact php_preamble/creation_inventory_read/Gate/Dispatch; actions/argv/environment/caps/budgets unchanged; wrapper functions outside run_session and its entire finally/drain/release block unchanged; owner AST unchanged outside PINS. Diff is limited to diagnostic constants/helper, optional Stop data, the nonzero inventory branch, failure receipt fields, focused tests and source pins.

Unchanged dependencies: bridge `70db84535b5c0172fa162fe553de021e25c7e3363714a807ac0f676c7191658c`, bridge tests `8bc8f485a4ea8bed9c71be35a5a051aecbf0b9df6ca193803dc356725a1cfb99`, owner tests `21ff6697f23c29593b5257364a1561e0b569bd82b59b8c8d3560e6242a420698`. Unrelated existing dirty/untracked files and every earlier control/evidence artifact are preserved.

No actual remote/WP bootstrap/provider/lease/account/browser/runtime/product/OS operation, new control, retry, deploy or self-approval occurred. Old exact-byte approvals cannot admit these changed helper bytes. Root owns independent exact-byte review, scoped custody and any separately admitted actual invocation. Freeze and STOP here.
