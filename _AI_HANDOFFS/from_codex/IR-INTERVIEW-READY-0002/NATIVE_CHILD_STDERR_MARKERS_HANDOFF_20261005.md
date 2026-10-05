# Closed stderr markers — bounded builder handoff, 2026-10-05

Builder: `/root/stderr_finish`. Review pending; this is not independent approval or invocation authority. BASE `db9492198e616f002f946dea7f1a9ae83913b067`; existing branch/worktree retained. Product 8717 lineage and unrelated dirty/untracked files preserved. No commit, push, cleanup, protected execution, SSH, PHP/WP/bootstrap run, provider/lease call, account, identity or control was created.

## Frozen helper bytes

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | `4bd7e26c4ff34456c1dab2ced66b3cab2a41388b4fb4475cbf3d40e38250d4c0` |
| native_account_qa_tests.py | `1d19826f53349d7bf95de0a78259d862ed367127db55561ee0f985b2970c236a` |
| runtime_native_runner.py | `96a8ab27c21127d2d69ae20dc9239a473dbfaeeba64a771b0a7005d4ce05cbc9` |
| runtime_native_runner_tests.py | `6ab45404045340212c1c469572f74b6f0130fa098bf8e9220740e7165a803d88` |
| native_inventory_owner.py | `832aaac4d353c5b4f8866e3f9e5b3c7196e8d3da28d74789be25686e7f4d5080` |

Wrapper QA/source-test pins match the above bytes. Owner changed exactly its two QA/wrapper source pins. Remaining pins and owner tests are unchanged.

## Closed diagnostic behavior

Complete stderr is scanned only within the existing 65536-byte cap. Standard ANSI color sequences and the optional bounded standard PHP log timestamp are removed privately before fixed-line matching. Markers are a sorted unique list drawn solely from sixteen fixed tokens: PHP_WARNING, PHP_FATAL, PHP_PARSE, WPCLI_ERROR, UNCAUGHT_ERROR, PERMISSION_DENIED, CONNECTION_CLOSED, STDIN, UNDEFINED_FUNCTION, CLASS_NOT_FOUND, REDECLARE, UNDEFINED_CONSTANT, TYPE_ERROR, ARGUMENT_COUNT_ERROR, MYSQL_EXTENSION_MISSING, PHP_VERSION_REQUIREMENT. No source text, path, function/class name, raw bytes or derived digest is returned.

Known fixed PHP Fatal/Parse and WP-CLI file/command/bootstrap lines can classify stderr despite preceding warnings/trace. Incompatible category evidence, unknown two-stream output and silent exit255 retain child_exit. Exit255 alone never implies SSH failure. Closed native PHP sentinel priority remains unchanged. Fatal-kind tags describe recognized text shapes; they do not establish root cause. Stop and wrapper independently enforce marker list type, token whitelist, maximum sixteen entries, sortedness and uniqueness, copying only accepted lists. Wrapper admits them only from exact qa.Stop on failure; invalid category removes scope, childExit and markers. Existing exact closed childExit schema and ranges remain unchanged.

## Validation

Twelve focused synthetic tests PASS in 0.675 seconds: QA known shapes/presence, complete multiline marker privacy/ambiguity, ANSI/fatal kinds and malformed marker schema, native sentinel privacy/priority, malformed/mixed/unknown/success-child refusal and exact PHP syntax; wrapper fixed receipts/drain ordering, independent marker whitelist/schema/category/subclass/write-failure handling, unresolved dispatch and CLI aggregate privacy; existing owner closed qualification and malformed binding/pin cases. No broad duplicate suite ran. Fixture children/pipes only; no real transport or provider.

AST comparison against BASE PASS: every existing QA function/class outside Stop and inventory_child_failure unchanged; existing classifier-pattern constant is the only changed preexisting QA constant. New marker constant/scanner are additive. This preserves php_preamble, creation_inventory_read, full registry/reflection program, private_capture, Gate, Dispatch, private_env, argv, timeouts/caps, kill/reap and stream closure. Every wrapper function/class outside run_session unchanged; its successful try body, else and full finally/drain/release blocks are AST-identical. Owner AST is identical outside PINS, with exactly two changed values. git diff --check PASS.

Assigned R2 IR BOOT profile independently PASS with canonical HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; routed mission/passport and DR-375/376 read. Root owns OS freshness and protected execution. No authority mutation.

Actual inventory6 remains INVENTORY_CAPTURE/child_exit, exitCode255, stderrPresent true, stdoutPresent false; no complete inventory or account was produced. Lease epoch5007 was reported RELEASED by Root, with all counts zero. This builder did not inspect actual stderr or rerun the operation. Actual cause remains unknown.

STOP after this handoff. Root and `/root/inventory_exact_admission_reviewer` must independently review exact frozen bytes. Root owns any scoped commit and distinct new admission; prior controls authorize no replay.
