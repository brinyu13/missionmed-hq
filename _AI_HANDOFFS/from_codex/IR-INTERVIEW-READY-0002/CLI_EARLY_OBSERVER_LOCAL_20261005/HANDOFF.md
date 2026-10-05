# Installed CLI early observer ordering — bounded local finding

BASE ea6546ef7b9cb3636052a442bea8893c26daca4c. Retained installed source does **not** qualify whether --require or --exec executes before load_wordpress. No unchanged retry or hook implementation is recommended on this evidence alone.

## Exact local evidence

BOOTSTRAP_FIXED_LOADER_BODY_READBACK_3.json SHA d857cd182f16a7c4ce9a2a44688dd656298ced37aae38c38625e1c72dacd1ada:

- Lines260–263: installed EvalFile_Command source70b47a0af2055ec7936bbc9f24f5c4cc75cdbd191c70f3fbcb83d9d09e5ce49a retains __invoke: conditional load_wordpress precedes execute_eval. execute_eval's body is suppressed. This proves the visible call order, not installed stdin include/eval internals or startup-option handling.
- Lines310–313: installed Runner source1be98e13f066277f86376a7203038fe169f5e50dd84c72c5646df438df2c65d1 retains start and load_wordpress. start eventually calls load_wordpress then run_command_and_exit; load_wordpress evaluates configuration and requires normal settings/admin dependencies. get_required_files, init_config and do_early_invoke bodies are suppressed. Their names alone do not prove which startup options they handle or their timing.
- Lines324–327: installed bootstrap dispatcher source332b5e6f5783c9b0e420a1cd7f97d89a2a4642863a1311b33b6e7532e1c71863 loops get_bootstrap_steps and calls each process method. get_bootstrap_steps, prepare_bootstrap and initialize_bootstrap_state bodies are suppressed. No retained processing body demonstrates --require or --exec execution before Runner start/load_wordpress.

BOOTSTRAP_ACTUAL_FIXED_LOADER_SEMANTIC_REVIEW_4.md line34 (SHA ac9ef249b3e58e54d5d3ea9cc330ced0f4c1b26ad0002f5c84df3732213483c4) qualifies ordinary CLI/WordPress bootstrap closure, not a new early-observer option. Current native_account_qa.py line44 still invokes eval-file /dev/stdin; lines639–678 install the V2 observer inside that supplied payload. QA SHA913dd3cb0911fb78196120598f47b62f68954ef1c5032f388d78d1eff5295096; runner SHA30aae2b2cdb2db45ed94019b818e40648a0bad9ce8674f0a4a6eb052aa5aeb81. No startup option was changed.

## Exact missing evidence

To choose one installed early hook, the unresolved minimum is: (1) installed bootstrap step ordering before the step that starts Runner; (2) the exact step/method body that consumes require or exec configuration and invokes the code; (3) the config/argument binding proving that the proposed CLI option reaches that step; (4) any relevant guard that defers, skips, duplicates or catches that invocation. Retained Runner.get_required_files/init_config and bootstrap.get_bootstrap_steps bodies are candidate edges, not proven owners. The option-processing step class names cannot be established from the redacted step list. No public-version implementation is substituted for these installed bytes.

## Smallest conditional candidate

After exact installed ordering is independently qualified, choose one hook only. A fixed inline --exec observer would avoid any new server file if that exact option is proven available and early; --require is not selected here because its file-loading/custody path is not qualified. Either requires a separately authorized argv/contract delta before implementation.

The observer should emit only a fixed versioned EARLY_ENTERED frame to private stderr and register one anonymous shutdown callback. Its terminal should be only FATAL or NONFATAL using the already closed PHP fatal-type set; UNKNOWN is sufficient. It should inspect only error_get_last type, never message/file/line, exception properties, names, paths, lengths or hashes. No error handler, suppression, debug flag, plugin exclusion, exit, catch replacement or bootstrap/config change. Keep the existing V2 payload observer unchanged. An early frame without the V2 outer frame would establish arrival at the newly qualified hook but would not identify a specific plugin, config, input loader or fatal cause. Absence would remain unresolved before that hook.

Parser integration would require exact ordered/unique finite frames, malformed/mixed/control fail-closed behavior, fixed whitelist-only receipts, preserved ordinary stderr rejection and existing caps/exit/sentinel/guard/drain/release/success checks. An early observer is a discriminator only and conveys no success or account readiness. No generic diagnostic framework or raw stderr capture is proposed.

Only this directory/handoff was written. No WP/Native execution, live/provider/SSH read, retry, helper/product/source/profile/release change or commit. Hook ordering remains unproved on retained evidence. STOP.
