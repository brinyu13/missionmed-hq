# D9-415 CI Validation Report

Status: **PASS LOCALLY; NON-DEPLOYING PR CI DEFINED**

## Validated tree

- Detached precommit validation tree: `7ee36e44028bda341b5c07d23d2980eeb4838d85`
- Detached validation commit: `0a11b78fc41a80d7956f73e58ec26be1c4279c11` (temporary, not a branch head)
- Pinned runtime source: `e12cd99aa9c019a6f99325c0b961aa50db945472`
- Validation result: `PASS`

## Results

| Check | Result |
|---|---|
| Clean worktree gate | PASS; separate untracked-sentinel test failed closed with exit 2 |
| Tracked-source completeness | PASS |
| Protected hashes | PASS, 10/10 with the exact Founder-002 controller disposition |
| Plugin header/version | PASS, `1.5.1` |
| JSON | PASS, 22 tracked JSON files |
| PHP syntax | PASS, 61 package files |
| JavaScript syntax | PASS, 29 package files |
| Secret/private-data scan | PASS, 134 files / 10,575,308 bytes / zero unreviewed candidates |
| Executable backup scan | PASS, nine intended-active package MU files |
| Source-manifest validation | PASS |
| Deterministic packaging | PASS, two identical SHA-256 values |
| No-production-command scan | PASS, four execution files / zero signatures |
| Baseline tag | PASS, target `c340a3a87732f7dc4afb06c01e4586239a050495` |
| Production/database/cache/deployment side effects | NONE |

The scan permits only hash-scoped, previously reviewed source-code literals: one PKCS#8 marker and two `privateKey` schema labels in the bundled Webex adapter, plus one user-email fallback expression. It found no key body, credential, student record, log, upload, cache, session data, database export, or environment value.

## CI safety

`.github/workflows/d9-matrix-source-validation.yml` runs only for pull requests to `main`, grants `contents: read`, checks out full history/tags, and writes package outputs only under `$RUNNER_TEMP`. It has no manual/scheduled/privileged trigger, environment, secret reference, artifact upload, production command, deployment command, database command, cache command, or mutation path.

Local tools were Python 3.14.6, Git 2.50.1, PHP 8.5.4, and Node 24.14.0. GitHub-hosted CI remains pending until the branch and draft PR are published; the workflow itself is validated as non-deploying.
