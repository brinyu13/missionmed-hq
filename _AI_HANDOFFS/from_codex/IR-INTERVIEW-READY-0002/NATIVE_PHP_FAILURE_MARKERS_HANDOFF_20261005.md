# Private inventory PHP failure markers — 2026-10-05

**Implemented and locally verified; frozen for fresh independent exact-byte review. STOP. Actual attempt 4 remains INVENTORY_CAPTURE/child_exit with no observed root cause. This handoff creates no new controls and authorizes no retry.**

Builder `/root/inventory_php_failure_markers`; requested Sol6.1 High for private transport/PHP integration. BASE `6bc8e934fd4416ce7d128d04f85bb1ea1c8be63a`. Read local AGENTS/BOOT and the routed R2 Interview Ready passport, DR-375 and DR-376. Root owns current OS sync/profile custody: normal OS `98cb`, assigned R2 authority root `bc1d36fcb9f7bdda4bcd4ba507078b7787d802a2`, current exact IR profile PASS; IR authority unchanged. No OS write or extra authority/runtime audit occurred here.

Read-only diagnosis `NATIVE_INVENTORY_CHILD_EXIT_DIAGNOSIS_20261005_4.md` remains SHA-256 `37378ddbccfb59af0a8a48662064768a5c2834c01ffa5bbdc16ce4cf5d8620be`. Root owns actual epoch4998 RELEASED and independent provider-clear evidence. The diagnosed failed child had no retained raw stderr/output, so this implementation does not identify its failing callback or claim a PHP runtime cause. Prior stage handoff/review and owner selection predicate were read as bounded context.

## Frozen write set

Exactly these five source/test files and this new handoff were written, all under `/Users/brianb/MissionMed_worktrees/IR-INTERVIEW-READY-0002/_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/`:

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | `5f636e4493a2b653d27e3e5a9f4bfec293c3ccef7cf3a64541c4fc3677274b15` |
| native_account_qa_tests.py | `89cdf9c3fd7b5a9bd33f0281127f0fa9b50e064fb4f7a1866a74ed5fead3a390` |
| runtime_native_runner.py | `9755facfe0cb7d0b90b5889faa015e52ce54d82e87eca4f503852706a7f1116b` |
| runtime_native_runner_tests.py | `b64058178f3ddf9697675c0fbdb2dbc00ce0b40cd73dd16bc401fed8068977d2` |
| native_inventory_owner.py | `a9c04c1f1a59c5e0bd9f02d5d847d0fb728a45bca10684ba901606ebd898ce42` |

This handoff's digest is supplied in the freeze notice, avoiding a recursive self-pin. Unrelated `supabase/.temp/cli-latest`, `_AI_INPUTS/`, and the diagnosis are preserved. No commit, push, merge or deployment by this builder.

## Exact diagnostic delta

`ir_inventory()` now assigns only private diagnostic state before the existing hook-shape check, callback extraction/unsupported-shape branch, function/method reflection, file digest and encoding/sort operations. Existing loops, callback exclusions, reflection inputs, row construction, file hashing, sorting, inventory schema/digest and Python validation remain intact. No shape check, selected pruning, unknown allowance, skip or callback invocation was added.

The existing inventory-read `echo wp_json_encode(ir_inventory())` is enclosed in a fixed `try/catch(Throwable)` that emits only schema `ir.native.hook_inventory.failure.v1`, a closed `step`, and closed `hookScope`, then `exit(1)`. Catch output uses a fixed literal concatenation rather than the possibly failing WP encoder. It never serializes the Throwable, message, type, args, hook name/tag, callback identity, path/source, row/hash, nonce or private value. Suppressed PHP errors remain suppressed. No catch or sentinel output is added to other operations.

| Private step | Stop category |
| --- | --- |
| HOOK_SHAPE | php_hook_shape |
| CALLBACK_SHAPE | php_callback_shape |
| REFLECTION_FUNCTION | php_reflection_function |
| REFLECTION_METHOD | php_reflection_method |
| FILE_DIGEST | php_file_digest |
| ENCODE | php_encode |

Hook scope is diagnostic only: exact membership in the owner's public 139-name `STANDARD_HOOKS` ceiling gives `ACCOUNT_STANDARD`; otherwise the owner's exact closed `sanitize_user_meta_` prefix gives `ACCOUNT_META`; nonstring/other tags give `OTHER`. Encoding resets scope to OTHER. Standard membership takes precedence for names present in both sets. Tests prove equality with owner constants and canonical sorted-list SHA-256 `005887497738cd12c6c07c9f3ae33f9bf0574cd3dc4b00c9fc106aa5e125518d`. No concrete dynamic tag is exposed or selected by these assignments.

`private_capture()` examines only its already bounded private stdout after a nonzero inventory child exit. A separate 256-byte diagnostic interpretation ceiling admits exactly the schema/step keys with optional valid hookScope. Duplicate keys, unknown keys/schema/step/scope, malformed/non-ASCII/mixed/oversized output remain generic child_exit. Successful-child sentinel output still fails existing inventory schema validation; non-inventory actions keep their prior rejection. No SSH/WP-CLI message parsing or fallback was added. Existing capture cap/deadline/reap/drain ownership stays unchanged.

`Stop` optionally carries only an enum hookScope. Invalid categories become the existing constant private_operation_failed and drop scope. The wrapper accepts scope only from exact `qa.Stop`, then independently whitelists its type/value before including it in a failure-only NATIVE_PHASE receipt. Invalid scope is omitted; invalid category drops scope and becomes the existing constant. Other exceptions/Stop subclasses retain generic classification. No private exception string/repr/args is inspected.

Wrapper NATIVE_SHA/NATIVE_TESTS_SHA and exactly the owner's two QA/wrapper PINS are refreshed. Owner selection/family/classification, bridge, manual helper and every other dependency pin remain unchanged.

## Local verification

| Command from assigned worktree | Result |
| --- | --- |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_account_qa_tests.py` | 23 tests PASS, 0.804 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/runtime_native_runner_tests.py` | 48 tests PASS, 8.875 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_inventory_owner_tests.py` | 23 tests PASS, 0.411 s |
| `python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/native_browser_bridge_tests.py` | 15 tests PASS, 0.128 s |
| `git diff --check` | PASS |

Injected local pipe/thread children cover all six step categories and all scope enums, optional scope absence, mixed/unknown/malformed/duplicate/non-ASCII/oversized sentinels, success-child and other-action rejection, private output nonleakage, closed streams and null failure reports. Wrapper fixtures check finite drain-before-release for each category, invalid scope/category, subclass refusal and receipt-write failure. Existing cap/deadline/unreaped-child tests still pass. No real SSH child is started.

The exact newly generated inventory PHP program is passed through local `php -n -l` stdin only; parser succeeds. No PHP statements, WP bootstrap or inventory were executed. An existing lock fixture initially rejected public hook names inside the diagnostic string list; its two no-meta-write checks now reject actual `add_user_meta(` / `update_user_meta(` calls instead of arbitrary string occurrences. The final assertion remains a prohibition on callable writes.

Read-only Python AST comparison against BASE proves every existing QA function/class outside Stop/php_preamble/private_capture/creation_inventory_read unchanged; all capture constants, argv/environment/action sets unchanged; every other wrapper function/class and the complete run_session finally/drain/release block unchanged; owner AST unchanged outside PINS. Removing only the inserted diagnostic assignments/public list/global names from expanded PHP restores the exact BASE preamble bytes, proving every original PHP operation and other PHP function unchanged. This is an intentional inventory diagnostic delta, not a claim of live acceptance.

Unchanged dependencies: owner tests `21ff6697f23c29593b5257364a1561e0b569bd82b59b8c8d3560e6242a420698`; bridge `70db84535b5c0172fa162fe553de021e25c7e3363714a807ac0f676c7191658c`; bridge tests `8bc8f485a4ea8bed9c71be35a5a051aecbf0b9df6ca193803dc356725a1cfb99`.

No actual SSH/lease/provider/WP bootstrap/account/browser/runtime/product/OS changes, controls, retry, timeout relaxation, secret files or widened audit. Freeze and STOP for independent review. Root owns subsequent scoped custody; old exact-byte contracts and admissions cannot be replayed against these new hashes.
