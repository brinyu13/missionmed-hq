# Dormant reskin init hook facts reader

Prepared on base `3bf8b34c5ba8e007b62876152059225e96ff2bd8`. Root confirmed current-turn BOOT/profile authority and handoff-only scope before writes. Only this report, `reskin_hook_facts_reader.py`, and `reskin_hook_facts_reader_tests.py` were written. No provider, installed source, WordPress/bootstrap, OS, or production action was executed.

The reader exposes `prepare_program()`, `validate_capture(raw)`, and an explicit `capture_prepared(program, admitted=False)` seam and remains DORMANT on direct invocation. Preparation verifies six existing local donor/review/readback hashes and constructs a deterministic remote Python program. Preparation does not invoke a transport. `prepare_capture_adapter()` AST-extracts only the exact SHA-pinned donor `private_capture` and `Dispatch` definitions. The sole capture-definition change is the explicit `65536` stderr cap to `4096`, with replacement-count assertion exactly one. No donor top-level code is executed. `capture_prepared` refuses before transport by default; explicit independent admission and exact prepared-program identity are required. Its fixed read-only SSH argv uses `python3 -` rather than a WordPress launcher, a 10-second Dispatch deadline, 2-second reap, and 16-KiB stdout cap. Root owns any future independently admitted read.

The prepared program opens exactly the installed reskin source `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php`, 22,883 bytes, SHA-256 `727b8d94518e05a63f798cf69608f7b0a3fa07f0880f084b4453e88b6a8fb54e`, and `/usr/lib/php/20220829/tokenizer.so`, 35,080 bytes, SHA-256 `088267fb4965e634f43151d2981b8ff60e258376684990eb0791b75b6f34878c`. It verifies both before and after parsing. No symlink final component is accepted. No other installed source, PHAR, metadata, configuration, or method-body read is introduced.

One `/usr/bin/php8.2 -n -d extension=/usr/lib/php/20220829/tokenizer.so` child runs only the hardcoded token parser. The source is an in-memory input to `token_get_all(..., TOKEN_PARSE)` and is never included, required, evaluated, or executed. PHP syntax parsing necessarily tokenizes the complete pinned file; only top-level declarations in the exact class and the balanced static public `init()` body are inspected. All other method bodies are skipped by balanced token traversal and never exported. The registration-body grammar accepts exactly six direct `add_action`/`add_filter` statements. Extra statements or nesting stop closed.

The closed output contains the exact source hash/byte count, exact class/public static method, and six ordered registration rows. Hook names are exported only from a fixed public WordPress hook allowlist; all other literal hooks become `UNKNOWN_HOOK` with SHA-256 of the literal token spelling. No LearnDash hook was added without a qualified donor. Callbacks resolve only through class-array forms (`self::class`, `static::class`, exact class name, or `__CLASS__`) and an exact public method declaration in the same class. External, private, missing, or string callbacks yield null linkage and a false resolution flag. Priorities are decimal numeric literals or default 10. Unknown hooks and unresolved callbacks require later semantic review; they do not establish closure or approval.

Remote tokenizer I/O uses the donor private-capture nonblocking stdin/stdout/stderr/select pattern, without importing the donor runner. The remote total alarm is 10 seconds, tokenizer deadline 8 seconds, reap allowance 2 seconds, stdout cap 16 KiB, stderr cap 4 KiB. Errors produce only `RESKIN_FACTS_STOP`; no raw error, source, arbitrary literal, configuration, or callback-body output exists. There is no retry. The narrowly derived adapter also caps outer SSH stderr at 4 KiB; no donor file is changed.

Local validation: `PYTHONDONTWRITEBYTECODE=1 python3 _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/reskin_hook_facts_reader_tests.py` passed all 13 tests. Tests execute only synthetic fixtures through local PHP with `-n`; they do not execute the prepared remote program. Coverage includes short/long class arrays, `__CLASS__`, class-constant token normalization, filters, numeric/default priority, unknown/private literals, unresolved/private/external/string callbacks, nested init rejection, hash drift, exact count/public-static enforcement, duplicate methods, other-method nonexport, dynamic hook/priority rejection, closed output schema/cap, donor-pin drift, deterministic dormant preparation, default transport refusal, and synthetic outer stderr/stdout cap failures. Local fixture success is parser evidence, not installed-source, provider, semantic, or production acceptance.

Frozen files:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `reskin_hook_facts_reader.py` | 13074 | `11d8b123f5da2d002013bb00efe268ac0a3b5afd1ccca1a004bd234fbd329214` |
| `reskin_hook_facts_reader_tests.py` | 6947 | `f8ef18c5a9fdc8e66e77a9070c4484e22df61cef5a2b177b1ee124dec1e8eb7a` |
| exact prepared program | 9583 | `9ad0d2fb962118fef25ff508ce8328df38a9d17aad8a58981913f4dfac0d390a` |

Frozen dependencies:

| Artifact | SHA-256 |
| --- | --- |
| `bootstrap_fixed_loader_reader.py` | `91e409e5f6d27652a5215a169593852b9c3398b6791ebc396d41e6823ef67b91` |
| `native_account_qa.py` | `c84bc76264749e732e0e2555d942d64086a18cf625dd8f5006c529d32977e8f1` |
| `BOOTSTRAP_FIXED_LOADER_BODY_READBACK_3.json` | `d857cd182f16a7c4ce9a2a44688dd656298ced37aae38c38625e1c72dacd1ada` |
| `BOOTSTRAP_FIXED_LOADER_METADATA_READBACK_2.json` | `7a9069c3d4e9d22864f64e87d8f70438b1251fb75e005c6a5ee87930be68cea3` |
| `BOOTSTRAP_ACTUAL_FIXED_LOADER_SEMANTIC_REVIEW_4.md` | `ac9ef249b3e58e54d5d3ea9cc330ced0f4c1b26ad0002f5c84df3732213483c4` |
| `BOOTSTRAP_INSTALLED_TOKENIZER_METADATA_READBACK_1.json` | `81972c8b4fb99550f4f4ac6dde528c21a4f7f2df0bb548b56d0edc8e6e96590f` |

Stopped after local freeze. Independent privacy/semantic qualification must precede Root's actual read; this report authorizes neither that read nor bootstrap/control execution.
