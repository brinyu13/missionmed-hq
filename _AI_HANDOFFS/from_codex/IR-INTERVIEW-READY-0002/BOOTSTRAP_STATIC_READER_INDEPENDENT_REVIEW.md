# Independent bootstrap static reader review

Verdict: **BLOCK the frozen reader for actual-source capture.** Actual local PHP tokenizer verification confirmed one concrete config-value disclosure. No remote read, execution approval, provider admission or bootstrap semantic qualification is issued.

Reviewer: independent nonbuilder `/root/phase1_release_verifier`, requested Sol6.1 High, 2026-10-04. Builder froze all three paths before review. Actual HEAD observed `3da89f3d6a40b620cc89aba1a79d3d55a273a3f8`, the Foreman custody advance described in the handoff. Only this new report was written. No reader/source/helper edit, SSH, remote PHP, provider, WordPress bootstrap, identity, credential, control, stage or commit operation occurred.

## Exact reviewed bytes

All files below are in `_AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/`.

| File | SHA256 |
| --- | --- |
| bootstrap_static_reader.py | b13313773d5264b8a974cd668d4aa4f041f4178271b8cf5d10cd9d33b2e57b1f |
| bootstrap_static_reader_tests.py | f08d66aae27768ddd3c4810d7bd23e1a83571e1dd51e1a36933ef5a02ab1102a |
| BOOTSTRAP_STATIC_READER_HANDOFF.md | b3299deb5a98b34ee51df79622afe705cbdd507e6db44b6f49c6fe024c7c273b |
| BOOTSTRAP_STATIC_SEED_METADATA_20261004.json | 91f8956cb0d43fe7b6e82fb55bb12f92fcfcf12879a11d64b30e92f6c604f5ef |

Prepared remote Python program: `d6e53cef45b6a30e683a45eb610ee97e5c9cae91d78d0f3bb793ba6d5d131b7e`. PHP template: `2ac3102a6639dd6b2f4c589e8d024aa47616f786f34e34b2b451434e5945f0b6`. Native private_capture dependency remains `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1`; no native adapter was invoked. Routed DR375/376 hashes remain `05803e16c985437a6400aa261e55bdb57f50ed2a0c7200f904fcffc49155a508` and `452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e`.

## Concrete blocker and minimal correction

PHP_READER's T_CONSTANT_ENCAPSED_STRING branch applies safeLiterals to every role, including wp-config.php. Actual `/opt/homebrew/bin/php -n` tokenization of synthetic config source confirmed that configuration values equal to the fixed words cli and WP_CLI remain quoted in redactedSource. The words were synthetic canaries, not actual credentials; the defect is that a real configuration value would cross the private-source boundary based solely on its content. Config public-hook classification is correctly omitted, but that does not suppress this rendering path.

Minimal required delta: **all config-role string literals must be opaque**, regardless of safeLiterals equality. Keep allowed public constant IDENTIFIERS for guard structure; do not copy arbitrary config values to preserve a guard comparison. Apply the same role-aware rule to the Python reference and actual PHP template. Add actual PHP canaries for every safe literal in a config-value position, plus allowed guard identifiers and existing nonconfig behavior. Refreeze the affected reader/tests/handoff and obtain a bounded independent delta review. This reviewer changed no implementation.

## Passing bounded evidence

- Seven builder Python fixture groups replayed independently:7 PASS,0.011 seconds. Compile without bytecode and prepared Python AST pass. Default CLI exits0 DORMANT; --execute exits1 BLOCKED without dispatch.
- Root expressly authorized local isolated PHP execution over synthetic canaries only. The actual PHP template passed eight synthetic-source cases covering comments, doccomments, inline HTML, strings/escapes, numeric literals, interpolation, heredoc/nowdoc, backticks and trailing __halt_compiler data. Canary values and private variable names were absent from output. Config hook facts were omitted; nonconfig bare public registration facts and source-defined flow names remained, with object/static lookalikes omitted.
- A separate synthetic source containing exit, throw, echo and require remained inert under token_get_all. No inspected source was included/evaluated/executed; the source execution sentinel was absent from output.
- The actual remote regular-file function was extracted by AST and tested locally with synthetic temporary files only: normal bounded read, cap refusal, leaf symlink refusal, ancestor symlink refusal and in-read metadata-change refusal all passed. The remote program itself was not executed.
- Local PHP canaries used the pinned private_capture with finite3-second I/O, existing2-second reap and small output caps. No raw actual source or remote errors entered artifacts. These passing cases do not override the confirmed config collision failure.

## Scope of a future corrected static-read packet

After correction/review, the prospective packet must bind the exact reader, tests, handoff, seed, prepared-program and capture hashes. Permit only the fixed SSH argv/webroot and exact seed roles:14 regular seeded sources, six ABSENT seed roles,61 named top-level MU sources and the launcher, yielding76 readable roles. Keep source private in tokenizer memory; no include adoption, recursion, WP command, plugin/theme loading or source execution.

Use the fixed10-second local I/O budget,2-second local reap and8MiB aggregate output cap; retain the declared per-file/launcher/aggregate limits and fail closed on capture, hash/list, symlink, tokenizer or schema failure. Remote tokenizer availability under /usr/bin/php8.2 -n is still unobserved. Do not install/enable extensions or substitute a parser following failure. Only validated redacted syntax and closed metadata may become an artifact. Local transport termination does not certify remote child completion; failed/uncertain capture cannot qualify source or authorize automatic retry.

This review qualifies no actual bootstrap effects. Later semantic review must use actual safe evidence and resolve concrete reachable dependencies and callback effects. Unknown direct dispatch/provisioning/enrollment effects remain unqualified; source hashes or a callback digest cannot establish harmless execution.

## AUTH helper dependency clarification

Preserve prior review d837eb243fce03ce86ef6e8b77dd1953437edaa77144e94a57c0f73b48031e07. Its manual-helper repin condition was overbroad for AUTH/auth_inventory: the inspected execute path loads canonical client, transport and native harness; snapshot has no manual-helper pin requirement; NativeGate dispatches the native entry. Generic drain_manual_operation reads only marker/source/fence metadata, not helper code. MANUAL_BUILDER is a reviewer-role exclusion. Helper repinning applies to a future INSTALL using that helper, not these AUTH paths. All actual AUTH snapshot, containment, bootstrap/hooks, freshness and one-use gates remain required.

STOP UNCOMMITTED. Write set: only BOOTSTRAP_STATIC_READER_INDEPENDENT_REVIEW.md. Await the minimal privacy correction and new independent byte review; no execution is approved.
