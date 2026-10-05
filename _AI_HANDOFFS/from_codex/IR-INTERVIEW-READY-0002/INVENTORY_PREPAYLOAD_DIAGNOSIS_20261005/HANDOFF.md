# SET16 pre-payload diagnosis — bounded read-only handoff

Outcome: actual cause UNKNOWN. Recommend one same-invocation outer compile-boundary discriminator, not a blind retry. BASE `1834e2d580a7d20cdf36c30c377045b9e22fdf31`; Root subsequently filed SET16 evidence at d2a3ce1 without helper/product changes. Root-reported actual capture: child_exit255, stdout absent, stderr present; PAYLOAD_NOT_OBSERVED / PAYLOAD_SHUTDOWN_NOT_OBSERVED / PHP_NOTICE; closed release/all-clear independently confirmed. No actual raw stderr available/read. Notice is a prefix observation; baseline early translation notices do not explain exit255.

Existing invocation remains fixed SSH noninteractive BatchMode/StrictHostKeyChecking/connect bound, normal `wp` at its unchanged qualified root, `eval-file /dev/stdin`, fixed private environment and stdin payload. No skip-WordPress/plugin, --exec/--require, bootstrap flag, debug/environment or transport change proposed. Current I/O/caps/guard/drain/release are not implicated or relaxed.

Installed closure evidence: EvalFile_Command.php sourceSHA `70b47a0af2055ec7936bbc9f24f5c4cc75cdbd191c70f3fbcb83d9d09e5ce49a`; Runner.php `1be98e13f066277f86376a7203038fe169f5e50dd84c72c5646df438df2c65d1`. Review4 establishes ordinary load_wordpress before execute_eval and normal settings/plugins_loaded/init before inventory. Retained execute_eval body is suppressed: exact installed include-vs-eval internals are NOT established. Public version examples cannot substitute for installed bytes. Therefore missing current ENTERED still covers transport/CLI/WordPress bootstrap, input loading, or whole-payload compilation before its first statement. Fixed globals repair does not fix a pre-statement compile failure.

**Local demonstrated possibility, not actual cause:** a previously declared helper function causes whole-program redeclaration failure before the current first marker executes. Local PHP lint alone cannot rule out symbols already declared by bootstrap. A nested eval of the same fixed body moves that compilation after an outer marker/shutdown observer and exposes fixed REDECLARE. No actual collision is established.

## Smallest proposed candidate

Inventory-only thin outer eval-file source, under unchanged invocation:

1. First executable statement emits `IR_INVENTORY_BOUNDARY_V2 WRAPPER_ENTERED`.
2. Initialize one local bool false; register the existing finite shutdown observer immediately, capturing that bool by reference. Move observer registration out of the inner source; do not duplicate it.
3. Nested eval of a literal encoding of the exact fixed inventory source, with `PAYLOAD_ENTERED` as its first executable statement. Preserve original suppression/filter registration/inventory/reflection/encoding/catch/global bindings. The literal is fixed source only, not server/private output; encoding is quoting safety, not privacy or dynamic code admission.
4. Surround only nested eval with `catch(ParseError $e)`: set local bool true and rethrow unchanged. Do not inspect/print message, file, trace or exception properties; no broad catch or continuation. This observes a ParseError escaping the eval boundary, not necessarily proof of a specific file/source cause.
5. Observer emits `IR_INVENTORY_BOUNDARY_V2 SHUTDOWN PARSEERROR UNKNOWN` when that typed bool is true (even if outer CLI subsequently handles it); otherwise the existing FATAL/<closed kind> or NONFATAL/UNKNOWN classification. No additional raw fields. Existing finite kind mapping remains unchanged.

New grammar: at most three exact newline frames, WRAPPER_ENTERED → optional PAYLOAD_ENTERED → one SHUTDOWN. PARSEERROR is permitted only without PAYLOAD_ENTERED for this fixed candidate; that combination with PAYLOAD_ENTERED fails closed. Unknown/duplicate/reversed/extra/control frames fail closed. Only WRAPPER+PAYLOAD+NONFATAL, zero child exit, zero other stderr, then every existing JSON/schema/rows/digest check can succeed. Any other stderr byte, ordinary Notice/Warning included, remains rejected. No parse/fatal/nonzero/absence becomes success. Strict existing stderrMarkers publication can add only EVAL_WRAPPER_ENTERED and EVAL_PARSEERROR; reuse current payload/shutdown/kind observations, no arbitrary dictionary.

Interpretation: wrapper present/payload absent localizes failure after eval-file began executing and before inner first statement; typed PARSEERROR or fixed fatal kind further narrows shape. Wrapper absent remains unresolved pre-wrapper/outer-compilation/transport/bootstrap absence. Wrapper+payload reuses current post-entry interpretation. Earlier shutdown handlers, signals/resources/output failure still limit observations. No absence proves bootstrap failure, no shape identifies a responsible callback, and no automatic retry follows.

## Frozen local proof

`python3 -B .../INVENTORY_PREPAYLOAD_DIAGNOSIS_20261005/local_compile_boundary_proof.py`: PASS, eight isolated PHP -n processes, no WP/transport/provider/identity. It captures current actual generated inventory source with a fake pipe, executes direct method eval versus nested method eval against synthetic empty/invalid hooks, and proves exact stdout/exit equality plus global HOOK_SHAPE attribution. It proves unwrapped redeclaration yields no entry, wrapped redeclaration yields WRAPPER/FATAL REDECLARE, typed syntax ParseError is observed/rethrown, and pre-wrapper failure still yields no observation. Raw output stays memory-only; result file contains booleans/count/reference helper SHA only. Proof script pure-compiles. No broad suite.

| Written artifact here | SHA-256 |
| --- | --- |
| local_compile_boundary_proof.py | `b54f7eabda7479fef9d9840cc84361be64f6c93e024b8580ed18e01753b30f2d` |
| LOCAL_PROOF.json | `1a50d41aa20ca4104f8f3cca15b94a36f634fee22509ab31f156b7685504f4f1` |

Reference QA remains `f64534309958e97aded039ca5e6fee65f49cf4140abafa13db4987c89222a8bb`. Boundary review4d5395 and diagnosis caf46 reused; no helper/source edits. The local proof is not a finished production decoder/fixture package or installed-loader equivalence proof. Separate SolHigh must review scope-equivalence, exact V2 grammar/closed success and effects before any implementation, then independent exact-byte implementation/admission review is still required. Only this new diagnosis directory written; no live provider/SSH/WP/lease/DB/account/raw-server-stderr/credential operations, runtime/OS/helper/product edits, commit, push or actual retry. Frozen; STOP.
