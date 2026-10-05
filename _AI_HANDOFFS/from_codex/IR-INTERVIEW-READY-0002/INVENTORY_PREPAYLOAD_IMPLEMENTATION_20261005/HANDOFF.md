# Inventory prepayload V2 implementation — frozen PREP

Immutable helper BASE: `cb5da5b464dd34d53494944c2d5163a489e30598`. Implements the approved specification `90fae0a9` and `INVENTORY_PREPAYLOAD_DIAGNOSIS_20261005/ROOT_IMPLEMENTATION_PACKET.md`. Actual SET16 cause remains unknown. No actual retry was performed.

## Narrow delta

Inventory-only generated PHP now begins with a fixed V2 WRAPPER_ENTERED observer, registers one best-effort shutdown callback, then evaluates a literal base64 encoding of the prior generated inventory body. The inner body begins with PAYLOAD_ENTERED; thereafter its shared preamble and diagnostic global/catch body are byte-identical to the immutable baseline. Other actions retain the unchanged shared preamble.

The outer catch handles only typed ParseError: it sets a local boolean and rethrows without reading or emitting exception properties. Shutdown then emits PARSEERROR UNKNOWN rather than claiming a fatal error type. The strict QA and runner whitelists add exactly EVAL_WRAPPER_ENTERED and EVAL_PARSEERROR, for 31 markers total. Owner changes are exactly the two QA/runner dependency pins.

V2 accepts at most three ordered, unique frames: WRAPPER_ENTERED, optional PAYLOAD_ENTERED, then one SHUTDOWN terminal. NONFATAL UNKNOWN, PARSEERROR UNKNOWN, and FATAL with the existing closed kinds are the only terminals. PARSEERROR after PAYLOAD_ENTERED is invalid. Legacy, mixed, unknown, duplicate, reversed, extra, or control-containing protocol frames fail closed with BOUNDARY_INVALID. Missing frames remain observations of absence.

Child success requires complete WRAPPER_ENTERED + PAYLOAD_ENTERED + NONFATAL UNKNOWN. Only exact valid protocol frames are removed; every other stderr byte remains subject to existing rejection. Ordinary notices/warnings are not discarded. Nonzero exit preserves existing sentinel/category priority and adds only fixed observations. No captured strings, names, paths, exception data, lengths, or hashes enter diagnostics.

## Frozen SHA-256

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | 913dd3cb0911fb78196120598f47b62f68954ef1c5032f388d78d1eff5295096 |
| native_account_qa_tests.py | 295f44e5d2add7aa2122c77535357651bef0f1ecf2cb947880052a91e9532f45 |
| runtime_native_runner.py | 30aae2b2cdb2db45ed94019b818e40648a0bad9ce8674f0a4a6eb052aa5aeb81 |
| runtime_native_runner_tests.py | 797cffb45dcda4ca326639507e8b8ed2fc493edf09df3bbcb0565130236451df |
| native_inventory_owner.py | a804b2415fe182d774f5239eabab51d924890815dcae038308fa9afc92ac90ad |

## Focused verification

`python3 -B -m unittest` with the following exact method selectors: **11 tests PASS, 1.856 seconds**.

- native_account_qa_tests.Fixtures.test_inventory_boundary_exact_grammar_absence_caps_and_privacy
- native_account_qa_tests.Fixtures.test_inventory_boundary_capture_success_warning_invalid_and_nonzero
- native_account_qa_tests.Fixtures.test_inventory_boundary_actual_php_method_scope_normal_and_suppressed_fatal
- native_account_qa_tests.Fixtures.test_inventory_closed_php_failures_never_publish_private_child_output
- native_account_qa_tests.Fixtures.test_inventory_failure_marker_rejects_mixed_unknown_malformed_and_success_children
- native_account_qa_tests.Fixtures.test_inventory_stderr_ansi_fatal_kinds_and_closed_marker_schema
- native_account_qa_tests.Fixtures.test_inventory_stderr_fixed_families_normalization_and_unknown
- native_account_qa_tests.Fixtures.test_inventory_diagnostic_public_hook_ceiling_and_exact_program_syntax
- native_account_qa_tests.Fixtures.test_actual_capture_slow_drip_dns_caps_and_nonzero_are_finite_private_stop
- runtime_native_runner_tests.Fixtures.test_inventory_failure_receipts_fixed_stage_category_and_drain_before_release
- runtime_native_runner_tests.Fixtures.test_inventory_phase_receipt_write_failure_and_unknown_category_fail_closed

Actual isolated generated PHP lint/method-eval cases pass: normal output and explicit diagnostic globals match direct evaluation; predeclared ir_fail yields fixed REDECLARE without payload entry; malformed inner syntax yields typed PARSEERROR without a fatal marker. Existing closed fatal kinds, unknown/private text, caps, mixed sentinels, residual stderr, strict subclass-dropping sanitization, and drain-before-release fixtures pass.

AST comparison against BASE passes: only inventory_boundary, inventory_boundary_preamble, creation_inventory_read, and the new inventory_boundary_wrap change in QA. Creation's remaining AST is identical after normalizing the source-wrapper call. Literal decoding proves exact prior inner preamble/body plus the single entry frame, with no inner shutdown registration. Runner changes only its two pins and nested marker whitelist; owner changes only two pins. Capture/Gate/IO/reap/drain/release/argv/env/budgets/reflection/success schemas remain unchanged. All five Python files compile; matching 31-marker sets and topological pins pass. Scoped `git diff --check` passes.

## Limits and custody

Wrapper absence remains unresolved among transport/bootstrap/load/outer-compilation possibilities. A typed ParseError identifies an exception shape, not a source file or callback cause. Shutdown observation is best effort. Local PHP fixtures establish transformation/scope behavior; they do not establish actual server cause or Native/account/production readiness.

Writes are limited to the five authorized helpers/tests and this handoff. No product/source/bridge, provider/SSH/control, browser/account/DB, credentials, bootstrap, global debug/plugin, budget, environment, or argv changes were made. No commit, push, activation, or actual admission occurred. Candidate is frozen for separate independent exact-byte review. STOP.
