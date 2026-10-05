# Inventory stderr classifier gap — diagnostic-only handoff

Status: PREPARED; implementation frozen for independent review. No actual runtime execution, push, merge, or deployment performed.

Base helper commit: `3d7ec2bddd2106fe228f9fe4d78b4bcabac9ca88`. Root subsequently filed SET11 public proof at `19631f2`; that does not change these helper preimages. Routed R2 / DR-375 / DR-376 authority is reused; no controls requested here.

SET11 evidence: `NATIVE_INVENTORY_20261005_11_INDEPENDENT_NATIVE_STOP_REVIEW.md` confirms INVENTORY_CAPTURE / child_exit / exitCode 255 / stdoutPresent false / stderrPresent true / stderrMarkers empty, with closed STOP and explicit release. No retained raw stderr is available. This delta does not identify SET11's cause.

## Exact delta

- QA privately strips only known SGR color formatting, leading space/tab/CR, and the existing PHP timestamp prefix. Existing full bounded stderr scan is retained.
- Five fixed observations added: SSH_MESSAGE, SHELL_MESSAGE, WPCLI_WARNING, PHP_NOTICE, STDERR_UNCLASSIFIED. Prefix observations describe formats, not authenticated source or causes; a bare Warning remains compatible with the inherited PHP_WARNING observation as well. Nonempty stderr with no recognized marker receives STDERR_UNCLASSIFIED and remains child_exit.
- One closed fullmatch alternative adds exact common kex/client_loop connection messages to ssh_transport_error. Existing PHP/CLI/shell fullmatch categories remain unchanged. Unsupported NUL/control/non-ASCII tails may retain a fixed ASCII prefix-family observation but cannot promote category or semantic kind. Unsupported leading formatting remains unclassified.
- Existing sentinel priority, mixed stdout fallback, ambiguous categories, over-cap rejection, strict value-free Stop metadata, and strict wrapper receipt sanitization remain unchanged.
- Wrapper duplicates exactly the 21-marker enum. QA source/test hashes refreshed first; owner changes exactly two dependency pin literals (QA and runner). Bridge and other dependencies unchanged.

## Frozen file hashes

| File (this handoff directory) | SHA-256 |
| --- | --- |
| native_account_qa.py | `dfe79f51fc62f964e68d310999a9f563ecb6e95d91035106643ffccbb24cc12d` |
| native_account_qa_tests.py | `14c3360b4420d91014a1d9559acb3d0a5a619636d055689541df958a655205ad` |
| runtime_native_runner.py | `2416e49a62676b79093ba983806bf88ce5bae217bb1d6ffc81cf935e42495fe7` |
| runtime_native_runner_tests.py | `8954922431392170d5ff570f09bb8daec5d4384e1553bed4049a01595f739296` |
| native_inventory_owner.py | `d6e35e4d17f302204ae845d3b21b85f1be419228fc98ab3af45c7ed98bf94a08` |

## Verification

Focused command, from this directory:

```text
python3 -B -m unittest
 native_account_qa_tests.Fixtures.test_inventory_closed_php_failures_never_publish_private_child_output
 native_account_qa_tests.Fixtures.test_inventory_failure_marker_rejects_mixed_unknown_malformed_and_success_children
 native_account_qa_tests.Fixtures.test_inventory_known_error_shapes_keep_only_closed_status_and_presence
 native_account_qa_tests.Fixtures.test_inventory_stderr_marker_scan_complete_stream_privacy_and_ambiguity
 native_account_qa_tests.Fixtures.test_inventory_stderr_ansi_fatal_kinds_and_closed_marker_schema
 native_account_qa_tests.Fixtures.test_inventory_stderr_fixed_families_normalization_and_unknown
 native_account_qa_tests.Fixtures.test_inventory_diagnostic_public_hook_ceiling_and_exact_program_syntax
 runtime_native_runner_tests.Fixtures.test_inventory_failure_receipts_fixed_stage_category_and_drain_before_release
 runtime_native_runner_tests.Fixtures.test_inventory_phase_receipt_write_failure_and_unknown_category_fail_closed
```

Run as one shell command: 9 tests PASS (0.792s), with injected local pipes/mocks only; PHP syntax fixture uses local parser only. New cases cover whitespace/CR/color/timestamp, known SSH/shell/PHP/CLI message formats, opaque Unicode/invalid UTF-8/NUL/control text, unknown fallback, 65536/65537-byte boundary, sentinel privacy, and wrapper receipt propagation. Existing malformed/mixed/sentinel/ambiguous tests and drain-before-release assertions pass. Existing wrapper invalid enum/type/subclass sanitization and all-marker schema case pass.

All five Python files compile without execution. Base-versus-candidate AST comparison passes for all QA nodes except fixed message patterns, marker enum, and private scanner; all runner AST except source/test pins and nested marker enum; all owner AST except PINS. PINS differs in exactly two authorized keys. Duplicated marker equality and every refreshed dependency hash pass. Thus capture/drain, private PHP/preamble/reflection/program, action/guard/budgets/argv/env, and release are unchanged. No broad synthetic suite run.

## Limits and custody

This is a fixed-format diagnostic improvement, not a diagnosis or a successful inventory. Unknown remains unknown; unsupported formats can still be unclassified. No arbitrary captured strings, names, paths, lengths, hashes of private text, or raw stderr enter receipts/handoff. Frozen product sources, provider state, accounts, browser, credentials, OS, and unrelated dirty files remain untouched. Independent exact-byte review is required before any fresh admitted actual run. No rollout authorization is conveyed.
