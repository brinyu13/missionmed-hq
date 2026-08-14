# D9-415 Final Test Report

Ticket: `D9-MATRIX-PLAN-415`

Result: **PASS — 25/25 VALIDATION AREAS CLOSED**

| # | Validation area | Result | Evidence |
|---:|---|---|---|
| 1 | Worktree instruction chain | PASS | Worktree `AGENTS.md`/`CLAUDE.md`, MissionMed OS BOOT/CURRENT routing, Matrix passport, lock protocol/manifest, Critical Systems Contract, and Codex guardrails loaded. |
| 2 | Git status | PASS | Clean before E validation/publication; D9-415F candidate contains only required closeout files. |
| 3 | Git diff check | PASS WITH IMMUTABLE-BASELINE EXCEPTION | D9-415E/F authored deltas are clean. Full branch reports historical CRLF/trailing whitespace in exact production and frozen evidence; those bytes cannot be normalized without breaking provenance. |
| 4 | Secret scan | PASS | Runtime scan: 134 files, zero unreviewed candidates. Branch-wide redacted scan: no new high-confidence secret candidate. |
| 5 | Student/private-data scan | PASS | Only one reviewed `user_email` fallback expression; no embedded private/student record. |
| 6 | PHP syntax | PASS | Required tool, 61 packaged PHP files. |
| 7 | JavaScript syntax | PASS | Required tool, 29 packaged JavaScript files. |
| 8 | JSON validation | PASS | 27 tracked JSON files at the detached F candidate; every file parsed successfully. |
| 9 | Source-manifest validation | PASS | 129 tracked source files, manifest SHA-256 `a650686889a6ddc22664ed890b6ff7b80fc3c1e475282723b8542d05f3967bc5`. |
| 10 | Production-to-Git map | PASS | 135/135 path/size/SHA/mode/blob mappings exact. |
| 11 | Ten protected-file hashes | PASS | 10/10, exact Founder-002 controller disposition only. |
| 12 | Active MU backup scan | PASS | Matrix backup absent from active canonical source; nine intended-active package MU files. |
| 13 | Baseline tag | PASS | Annotated tag object `6e2f5e32830f06b9015b9eee1870ccfab62b2a49` dereferences to D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495`. |
| 14 | Deterministic package build 1 | PASS | 2,711,483 bytes; SHA-256 `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`. |
| 15 | Deterministic package build 2 | PASS | 2,711,483 bytes; same SHA-256. |
| 16 | Package hash equality | PASS | SHA-256, size, and direct byte comparison equal. |
| 17 | Fresh clone/clean checkout | PASS | Local `--no-local` fresh clone at E ran the full validator successfully. A detached clean F candidate regenerated the final manifest/combined handoff byte-for-byte, reran the full validator, and remained clean. |
| 18 | CI configuration and hosted run | PASS | Pinned checkout, `contents: read`, no credentials/artifact/deploy path; GitHub run 29301277578 succeeded. |
| 19 | No-deploy assertion | PASS | Package metadata `deployable: false`; no deployment command or effect. |
| 20 | No-production-mutation assertion | PASS | Production mutation count zero. |
| 21 | No-database-mutation assertion | PASS | Database mutation count zero. |
| 22 | No-cache-change assertion | PASS | Cache/CDN mutation count zero. |
| 23 | Branch diff review | PASS | Dedicated detached review found zero unresolved P0/P1 and no protected global authority edit. |
| 24 | Independent reviewer closure | PASS | Wave 2 4/4; all five valid P1 items resolved in E/F. |
| 25 | Clean worktree after report commit | PASS GATE | D9-415F candidate is validated in a detached tree; final branch cleanliness and remote equality are rechecked immediately after commit/push. |

## Fail-closed evidence

- Missing PHP or Node.js now fails validation; a PATH-isolated test confirmed the missing-tool branch raises a blocking error.
- Alternate package policies are forbidden for the sealed D9-415 baseline.
- Mutable policy, hash-map, MU-manifest, source-lock, builder, scanner, MU validator, and workflow inputs are digest-sealed or code-pinned.
- The trusted source commit/tree, baseline tag/target, exact counts, exclusions, protected asset set/hashes, command-deny patterns, and archive root are independently enforced.
- The final handoff generator inventories Git-tracked files only and rejects missing paths, symlinks, and non-files, so ignored bytecode caches or forensic material cannot alter clean-checkout output.

## Branch-wide redacted scan

- Changed files scanned: 211.
- Bytes scanned: 11,553,364.
- Binary files: 11.
- High-confidence candidate: one known Webex PKCS#8 validation marker, no key body.
- Credential literals: two known `privateKey` schema labels.
- Private-data literal: one known user-email fallback expression.
- New unreviewed secret/private-data candidates: zero.

No test contacted or mutated production, WordPress state, a database, cache, feature flags, authentication, or entitlements.
