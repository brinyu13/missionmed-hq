# Independent PHP failure marker review — 2026-10-05

Verdict: **APPROVE the bounded diagnostic delta for creation_inventory_read.** This report qualifies the exact frozen helper and dependency changes; it issues no execution controls or retry authorization. Actual attempt 4 remains INVENTORY_CAPTURE/child_exit, nativeReport null. No cause is inferred from that receipt.

Independent reviewer: `/root/inventory_exact_admission_reviewer`. Builder: `/root/inventory_php_failure_markers`. BASE: `6bc8e934fd4416ce7d128d04f85bb1ea1c8be63a`.

## Exact frozen bytes

| File | SHA-256 |
| --- | --- |
| native_account_qa.py | `5f636e4493a2b653d27e3e5a9f4bfec293c3ccef7cf3a64541c4fc3677274b15` |
| native_account_qa_tests.py | `89cdf9c3fd7b5a9bd33f0281127f0fa9b50e064fb4f7a1866a74ed5fead3a390` |
| runtime_native_runner.py | `9755facfe0cb7d0b90b5889faa015e52ce54d82e87eca4f503852706a7f1116b` |
| runtime_native_runner_tests.py | `b64058178f3ddf9697675c0fbdb2dbc00ce0b40cd73dd16bc401fed8068977d2` |
| native_inventory_owner.py | `a9c04c1f1a59c5e0bd9f02d5d847d0fb728a45bca10684ba901606ebd898ce42` |
| NATIVE_PHP_FAILURE_MARKERS_HANDOFF_20261005.md | `4e92d6814371daff9f076df6cdbe7c6082c440ef117b4038014fb23ea27312a1` |

All six hashes independently matched the frozen filesystem. The read-only diagnosis remains `NATIVE_INVENTORY_CHILD_EXIT_DIAGNOSIS_20261005_4.md`, SHA `37378ddbccfb59af0a8a48662064768a5c2834c01ffa5bbdc16ce4cf5d8620be`. It supports diagnostic discrimination, not an inferred failing callback or remote CLI cause.

## Closed failure and privacy contract

Only the existing creation inventory invocation gains a Throwable boundary. PHP emits a fixed schema plus one of HOOK_SHAPE, CALLBACK_SHAPE, REFLECTION_FUNCTION, REFLECTION_METHOD, FILE_DIGEST or ENCODE, with optional closed hook scope, then exits nonzero. The catch does not encode the Throwable or its message/type/arguments and does not read or emit a hook tag, callback identifier, path, source, row, digest, count, nonce or capability. The sentinel uses fixed literal concatenation, so failure of the ordinary WP encoder is not required to encode the diagnostic.

The six steps map exactly to `php_hook_shape`, `php_callback_shape`, `php_reflection_function`, `php_reflection_method`, `php_file_digest` and `php_encode`. Recognition happens only after a nonzero inventory child exit, within the existing bounded private stdout capture and a separate 256-byte interpretation ceiling. Duplicate keys, extra keys, unknown schema/step/scope, non-ASCII, mixed, malformed and oversized output stay `child_exit`. Sentinel-shaped successful child output still fails the unchanged inventory schema; non-inventory actions retain their prior rejection. No diagnostic becomes an inventory result, and no SSH/WP-CLI raw message matching or retry is introduced.

Scope is only ACCOUNT_STANDARD, ACCOUNT_META or OTHER. The diagnostic standard set independently equals the exact owner's 139 public names, sorted canonical SHA `005887497738cd12c6c07c9f3ae33f9bf0574cd3dc4b00c9fc106aa5e125518d`. Standard membership takes precedence; otherwise only the existing closed `sanitize_user_meta_` family prefix yields ACCOUNT_META. Encoding resets scope to OTHER. These assignments classify a failure and never prune traversal, select callbacks or reveal a concrete dynamic tag. The settled owner family and 71 mappings remain unchanged.

`Stop` validates category and scope, omitting unknown scope and discarding it when category is unknown. The wrapper accepts diagnostic scope only from exact `qa.Stop`, then independently checks its string type and enum membership. Subclasses and unrelated exceptions retain constant generic classification. Only failure receipts may add hookScope to the existing schema/binding/stage/category fields; no error string, repr or raw args is inspected or published.

## Effects, containment and compatibility

Independent AST comparison proves every other existing QA function/class unchanged. Removing only the PHP diagnostic assignments/public list and additional diagnostic globals restores the complete BASE preamble byte for byte, including every existing loop, reflection operand/branch, file hash, row construction, sorting, digest, mail/HTTP suppression and other PHP function. Normal creation_inventory_read guards, owner dispatch, JSON/schema/row/hash validation and successful result are unchanged outside the fixed diagnostic PHP argument. Normalizing only the newly inserted nonzero sentinel interpretation restores the entire private_capture AST, including stdin/stdout/stderr caps, deadlines, reap and drain ownership.

This pure diagnostic delta preserves the settled `BOOTSTRAP_ACTUAL_RESKIN_CLOSURE_REVIEW_5.md` SHA `44a658ec361dedbf86f4a52641a57b407bcfc34ad8a413e44db8c40e066adbb3` effects qualification for creation_inventory_read only. It adds local fixed-enum assignments and a failure-only private stdout discriminator; it adds no callback invocation, account/HTTP/provider action or broader bootstrap route. The prior ordinary installed CLI/framework boundary and semantic closure retain their precise scope. No account creation/login/logout or other native action is qualified by this report.

The exact native containment record may bind this report with native SHA `5f636e4493a2b653d27e3e5a9f4bfec293c3ccef7cf3a64541c4fc3677274b15`, native tests SHA `89cdf9c3fd7b5a9bd33f0281127f0fa9b50e064fb4f7a1866a74ed5fead3a390`, transport `curl-stdin-v1` and finiteContainmentQualified=true. Curl argv/config/environment, /usr/bin/curl 8.7.1 and its previously qualified AsynchDNS boundary remain unchanged; no new live curl observation is claimed. Actual SSH/WP inventory argv, capture budgets/caps and Gate controls are unchanged.

Every other wrapper function/class is unchanged. run_session's entire successful try body and finally/drain/release block are AST-identical to BASE; the only runtime receipt delta is enum scope handling in its diagnostic closure/catch. This preserves drain-before-release, retained unresolved ownership, fixed expiry/freshness limits and actual canonical release requirements. Owner AST is identical outside PINS, with exactly two changed pins (the new QA and wrapper hashes). Bridge, manual INSTALL helper, owner tests, and all other pins remain exact. The bridge retains SHA `70db84535b5c0172fa162fe553de021e25c7e3363714a807ac0f676c7191658c`; this review introduces no architecture fork or new driver.

## Independent validation and limits

Seven targeted QA tests PASS (0.272 s), including all six steps/all three scopes, malformed/duplicate/mixed/unknown sentinels, successful-child rejection, exact 139-name equality, exact generated PHP syntax-only `php -n -l`, private/read-only normal inventory, unchanged two-control order, finite capture and unresolved child ownership. Five targeted wrapper tests PASS (0.542 s), covering all new categories, enum scope, invalid category/scope/subclass refusal, receipt-write failure, null failure reports, unresolved dispatch, CLI privacy and drain-before-release. These are injected local fixtures; no real SSH or provider is called. `git diff --check` PASS.

The builder's full-suite results are separately attributed: QA23, runner48, owner23 and bridge15 PASS. Independent checks above were bounded; the full suites were not duplicated. The two changed lock-test assertions now reject actual add_user_meta/update_user_meta calls rather than diagnostic public strings; AST and PHP restoration separately prove the lock functions themselves unchanged.

No provider, lease, transport, WP bootstrap, account, browser or runtime observation was made by this reviewer. No source edit, control issuance/consumption, OS change, deployment, cleanup or retry occurred. This exact-byte approval requires Root integration and distinct manually authorized controls pinned to the new committed HEAD before any later execution. All prior consumed or expired admissions remain preserved. STOP.
