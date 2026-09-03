# D9-415 Secret and Data Scan Report

Status: **PASS BEFORE IMPORT**

Scan scope: complete 125-file `missionmed-hub` snapshot plus the ten-file selected Matrix MU closure (`135` files, `10590108` bytes). A high-confidence path-only pre-scan also covered the full unrelated MU observation envelope. No matched value was printed or filed.

## Results

- Dedicated scanners available: none; a deterministic redacted scanner and independent path-only regular-expression scans were used.
- Private key/token/key patterns: one marker hit, reviewed as the literal PKCS#8 validation phrase inside the bundled Webex cryptography library; no key body or credential exists.
- Credential-literal patterns: two duplicate schema-label hits for `privateKey` inside the same bundled library; no assigned credential exists.
- Entropy review: `18` candidates, each reviewed redacted; all are static asset URLs/paths, selectors, image mappings, locale data, or demo markup.
- Email literals: `33` occurrences, reviewed redacted; institutional support addresses, reserved example addresses, or static form placeholders only. No live user/student record is embedded.
- Private-data literal patterns: `1` syntactic false positive in a runtime empty/fallback expression; no embedded private value.
- Binary files: `11` runtime image assets. ASCII-preserving secret/email scans found zero binary candidates.
- Filename warnings: session-named source modules only; no session data, log, cache, upload, environment, key, database, CSV, or credential file.
- Student/user payloads: none.
- Secret-bearing runtime file requiring remediation: none.

## Import gate

Selected source may enter Git unchanged. Validation must rerun against the tracked tree and fail closed if any new candidate appears. The raw forensic tree remains ignored and permission-restricted.
