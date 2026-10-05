# Independent PHP CLI metadata read admission — 2026-10-05

Verdict: APPROVE one exact bounded read-only metadata invocation under DR-375, after Root verifies the frozen pins below. Reviewer: `/root/inventory_exact_admission_reviewer`. No actual PHP or remote execution was performed by this reviewer. This admission creates no lease, account, bootstrap, control-consumption or replay authority.

## Exact binding

Program: `PHP_CLI_METADATA_PROGRAM_20261005_1.php`, SHA-256 `21db639904f82f63b61bf6b84efe140b9358b24483459a632d39bd32736e3cbb`.

Finite capture helper: `native_account_qa.py`, SHA-256 `4bd7e26c4ff34456c1dab2ced66b3cab2a41388b4fb4475cbf3d40e38250d4c0`.

Independent helper review: `NATIVE_CHILD_STDERR_MARKERS_INDEPENDENT_REVIEW_20261005.md`, SHA-256 `889128823e7df3a5df09fed35f614d7e1a161fe6f4b4048c2146db4fa27c3d67`.

Helper base `db9492198e616f002f946dea7f1a9ae83913b067`; product source `8717ebd04ad1cd60e66ef197b55080d58492e2be` remains unchanged. The exact private_capture implementation is AST-identical to the previously qualified finite implementation. The helper is imported dormant with pin checking, without owner qualification or wrapper execution.

## Fixed invocation and closed output

Use the exact existing native SSH_ARGV prefix through `missionmed-kinsta`: ssh, -T, -o BatchMode=yes, -o ConnectTimeout=10, -o StrictHostKeyChecking=yes, missionmed-kinsta. Append only `php`, `-r`, and `shlex.quote(exact_program_bytes.decode())`. The quoted fixed public code is one remote shell argument; independent shlex.quote/shlex.split round-trip verified exact recovery. Pass one newline on stdin, action None, Dispatch budget 12 seconds, stdout cap 4096 bytes, existing stderr cap 65536 bytes and reap bound 2 seconds. Preserve the reviewed environment construction, deadline, kill/reap and stream closure. Any nonzero exit or stderr fails closed and remains private; do not print or store raw buffers or exceptions.

The program emits only the exact six-field object: schema `ir.php.cli_metadata.v1` plus booleans php82, mysqli, curl, openssl, mbstring. php82 is solely `80200 <= PHP_VERSION_ID < 80300`; the other four fields use extension_loaded on those fixed names. Root must validate the exact field set, exact schema and exact bool types before writing only that public JSON. No additional fields or raw failure output are admitted.

Static examination finds only fixed JSON emission, the PHP version comparison and four extension-presence tests. It contains no WordPress loading, database connection, source reads, environment reads, identity/private values, or account/provider operation. Normal PHP CLI startup is the explicitly admitted diagnostic scope. No -n, debug, skip, allow-root or other invocation flag is added.

## Validation and limits

PASS: exact program/helper hashes, static six-field/five-bool schema, fixed extension names/version bounds, shell quoting round-trip, unchanged finite capture AST and the independently approved diagnostic helper review. No PHP lint/run, SSH, provider query or inventory bootstrap was used to review this program.

The admission allows Root to observe these five current metadata booleans once through the pinned finite transport. It asserts no actual CLI version or extension result, does not prove WordPress inventory success, and does not identify set6's child failure cause. Root owns the actual invocation and exact public-schema validation. Any later protected inventory requires distinct separately issued controls.
