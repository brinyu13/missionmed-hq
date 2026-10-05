# Independent closed stderr diagnostic review — 2026-10-05

Verdict: APPROVE the exact frozen diagnostic delta for `creation_inventory_read` only. Reviewer: `/root/inventory_exact_admission_reviewer`, independent of builder `/root/stderr_finish`. Reviewed helper base is `db9492198e616f002f946dea7f1a9ae83913b067`; product source remains `8717ebd04ad1cd60e66ef197b55080d58492e2be`. This report grants no activation, consumption, lease, account, or replay authority.

## Exact reviewed bytes

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | `4bd7e26c4ff34456c1dab2ced66b3cab2a41388b4fb4475cbf3d40e38250d4c0` |
| native_account_qa_tests.py | `1d19826f53349d7bf95de0a78259d862ed367127db55561ee0f985b2970c236a` |
| runtime_native_runner.py | `96a8ab27c21127d2d69ae20dc9239a473dbfaeeba64a771b0a7005d4ce05cbc9` |
| runtime_native_runner_tests.py | `6ab45404045340212c1c469572f74b6f0130fa098bf8e9220740e7165a803d88` |
| native_inventory_owner.py | `832aaac4d353c5b4f8866e3f9e5b3c7196e8d3da28d74789be25686e7f4d5080` |
| NATIVE_CHILD_STDERR_MARKERS_HANDOFF_20261005.md | `3664c8a763e0ceed0dab17110ab55cff1bc214e9e79aebadf36e4c55e0368878` |

The wrapper QA/test pins match these bytes. Owner changes exactly its two QA/wrapper pins; its other code and pins remain unchanged. Browser bridge and manual runtime helper are unchanged (`70db84535b5c0172fa162fe553de021e25c7e3363714a807ac0f676c7191658c` and `8ab2d30b5bd5b8170250e124dd6c8bdf6268915d4ff62002eb857aa68a747389`).

## Qualified effects and privacy

The sole new operation interprets already captured private stderr within the unchanged 65536-byte capture cap. It scans the complete bounded stream rather than the former 4096-byte sole-stream fallback, privately normalizing fixed ANSI color codes and a bounded standard PHP log timestamp. This diagnostic widening performs no additional transport, I/O, callback, PHP, or provider operation. Two fixed WP-CLI message shapes extend the existing conservative classifier.

Public `stderrMarkers`, when present, is a copied sorted unique list of at most sixteen exact tokens: PHP_WARNING, PHP_FATAL, PHP_PARSE, WPCLI_ERROR, UNCAUGHT_ERROR, PERMISSION_DENIED, CONNECTION_CLOSED, STDIN, UNDEFINED_FUNCTION, CLASS_NOT_FOUND, REDECLARE, UNDEFINED_CONSTANT, TYPE_ERROR, ARGUMENT_COUNT_ERROR, MYSQL_EXTENSION_MISSING, PHP_VERSION_REQUIREMENT. QA and wrapper enforce this schema independently. Exact list/string types, membership, count, uniqueness and order are checked. No captured text, argument, path, function/class name, derived digest, or exception value is returned. Wrapper accepts diagnostics only from exact qa.Stop on failure; an invalid category removes scope, childExit and markers.

The existing exact PHP sentinel retains priority. Incompatible fixed categories, mixed unknown streams, malformed sentinels and silent exit255 remain child_exit. Recognized message shapes and markers do not establish root cause. The optional existing childExit receipt remains a nonzero integer in [-255,255] and two booleans; exit255 alone provides no SSH or PHP cause inference.

The `private_capture`, PHP preamble and full registry/reflection inventory, Gate, Dispatch, SSH argv/environment construction, action whitelist, time/capture budgets, kill/reap and stream closure are AST-identical to the approved base. Wrapper successful try body, else and full finally/drain/release blocks are unchanged. All existing QA functions/classes outside Stop and inventory_child_failure are unchanged; only the additive scanner and fixed marker set are new. Every wrapper function/class outside run_session is unchanged. No guard, skip, flag, requirement or success-path change exists.

The settled semantic closure `BOOTSTRAP_ACTUAL_RESKIN_CLOSURE_REVIEW_5.md` (`44a658ec361dedbf86f4a52641a57b407bcfc34ad8a413e44db8c40e066adbb3`) remains applicable to the exact ordinary CLI creation inventory read. Both qualified bootstrap flags retain that limited scope. The 139 hook selection, 71 source mappings, closed account-meta family and source union are unchanged. This review supplies the exact diagnostic/nativeReview delta and finiteContainment evidence for these new helper bytes; it does not qualify account/login/logout/HTTP effects or actual inventory completion.

`curl-stdin-v1` finiteContainment remains qualified by the unchanged reviewed transport implementation and prior qualified curl evidence. Current helper/test pins above are the binding bytes; no new runtime curl observation is asserted here. Assigned R2 IR profile validation passed against HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; routed DR-375/376 authority remains unchanged.

## Independent validation

PASS: four targeted QA privacy/protocol fixtures and three wrapper failure/privacy/custody fixtures. Additional independent pure decoder checks preserved PHP sentinel priority, rejected mixed-category and malformed-stream classification, rejected over-cap input and string-subclass markers, and verified accepted-list copying. Private fixture values remained absent from public str/repr/receipt data. Independent AST comparisons established the invariants above, QA/wrapper fixed sixteen-token equality, and owner exactly-two-pin delta. `git diff --check` passed. Frozen file hashes were rechecked before sealing.

Builder's twelve focused passing fixtures are supporting evidence, separate from these independent checks. No duplicate broad suite, actual SSH/PHP/WordPress/provider operation, control issuance, source mutation, commit, or deployment was performed by this reviewer. Actual set6 remains a released STOP with private nonzero stderr and unknown cause. Root owns scoped integration and any distinct subsequent admission.
