# Independent inventory stderr classifier gap review

Verdict: APPROVE — exact bounded diagnostic delta only.

Reviewer: /root/inventory_exact_admission_reviewer

Helper preimage/public custody BASE: 19631f289dd752489ba1c55e2f63c5228ab6885c

The exact six frozen hashes match. Relative to that BASE, QA changes only the closed pattern tuple, marker enum and private scanner. Known SGR, leading space/tab/CR and the existing PHP timestamp are stripped privately. Five fixed observations are added: SSH_MESSAGE, SHELL_MESSAGE, WPCLI_WARNING, PHP_NOTICE, STDERR_UNCLASSIFIED. They describe message formats; they do not authenticate the speaker or establish cause. A bare Warning retains inherited PHP_WARNING as well as WPCLI_WARNING. Exact kex/client_loop fullmatches map to existing ssh_transport_error. Unsupported control/non-ASCII tails may emit a fixed prefix-family observation but cannot promote a category or semantic kind. Unknown nonempty bounded stderr emits STDERR_UNCLASSIFIED and remains child_exit. SET11's actual cause remains UNKNOWN.

Existing exact PHP sentinel priority, hookScope enums, childExit nonzero integer/presence booleans, mixed stdout fallback, category ambiguity handling and over-cap rejection are unchanged. No raw messages, captured names, paths, private-text lengths/hashes, arguments, credentials or exception values are serialized. Strict Stop and wrapper receipt sanitizers remain in place; QA and wrapper have identical closed21-marker sets. Unknown/duplicate/malformed/subclass metadata stays rejected.

Independent verification: nine focused protocol/privacy/drain fixtures PASS (0.739s), including normalization, unknown Unicode/invalid UTF-8/NUL/control tails, 65536/65537 boundary, malformed and mixed sentinel inputs, fixed stderr-family propagation and release-after-drain. All five Python files pure-compile. Independent AST comparison proves every QA node unchanged except the three allowed diagnostic nodes; wrapper unchanged except QA/source-test pins and the nested marker-set assignment; owner unchanged except PINS. Owner PINS changes exactly QA and wrapper; refreshed QA/test dependencies and unchanged bridge hash match. Thus PHP inventory/preamble/reflection, required registration checks, guards/actions, environment/argv, budgets/caps, capture, reap/drain, release/finally and private inventory custody are unchanged. The inventory_child_failure function and Stop constructor are byte/AST invariant.

Finite containment qualification carries forward from the exact prior independent stderr review889128823e7df3a5df09fed35f614d7e1a161fe6f4b4048c2146db4fa27c3d67 and settled native containment: transport curl-stdin-v1, /usr/bin/curl8.7.1 with AsynchDNS true. The unchanged transport/capture AST justifies finiteContainmentQualified=true for the new QA/test hashes below when a future spec references this exact review. This is an effects-neutral diagnostic delta composed with settled bootstrap semantic5 review44a658ec361dedbf86f4a52641a57b407bcfc34ad8a413e44db8c40e066adbb3 for creation_inventory_read only. It adds no product, callback, account, login/logout, HTTP or AUTH effects qualification. That separate settled qualification is not refreshed or broadened here.

Any actual run still requires Root's explicit operator decision, a new committed sourceHead, independent fresh provider/runtime observations and newly issued one-use owner/inventory controls with unchanged1800/600/300 limits. This review issues no controls or live-read admission. No provider/RPC/SSH/WP/bootstrap/account operation, source edits, commit, push or deployment was performed by this reviewer.

Exact frozen files:

- native_account_qa.py SHA256 dfe79f51fc62f964e68d310999a9f563ecb6e95d91035106643ffccbb24cc12d
- native_account_qa_tests.py SHA256 14c3360b4420d91014a1d9559acb3d0a5a619636d055689541df958a655205ad
- runtime_native_runner.py SHA256 2416e49a62676b79093ba983806bf88ce5bae217bb1d6ffc81cf935e42495fe7
- runtime_native_runner_tests.py SHA256 8954922431392170d5ff570f09bb8daec5d4384e1553bed4049a01595f739296
- native_inventory_owner.py SHA256 d6e35e4d17f302204ae845d3b21b85f1be419228fc98ab3af45c7ed98bf94a08
- INVENTORY_STDERR_CLASSIFIER_GAP_20261005_HANDOFF.md SHA256 5b4badd3c3609f4cd346e202ff807350407572a35f9ae7f91491d70675111160
