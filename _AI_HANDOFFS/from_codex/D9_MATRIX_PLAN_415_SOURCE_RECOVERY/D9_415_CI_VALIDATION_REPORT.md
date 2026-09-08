# D9-415 CI Validation Report

Status: **PASS LOCALLY AND ON GITHUB — NON-DEPLOYING**

## Validated source

- Runtime source commit: `e12cd99aa9c019a6f99325c0b961aa50db945472`.
- Wave 2 fix commit: `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`.
- Baseline tag target: `c340a3a87732f7dc4afb06c01e4586239a050495`.
- Pull request: [#9](https://github.com/brinyu13/missionmed-hq/pull/9), draft, **DO NOT MERGE**.
- GitHub Actions run: [29301277578](https://github.com/brinyu13/missionmed-hq/actions/runs/29301277578), `validate-source-only` SUCCESS.

## Results

| Check | Result |
|---|---|
| Clean worktree gate | PASS; dirty worktrees fail closed |
| Sealed trust anchors | PASS; policy, hash map, MU manifest, source lock, builder, scanner, MU validator, workflow, counts, exclusions, tag, source commit/tree, and ten protected hashes are independently pinned |
| Alternate policy | FORBIDDEN |
| Tracked-source completeness | PASS |
| Protected hashes | PASS, 10/10 with exact Founder-002 controller disposition |
| Plugin header/version | PASS, `1.5.1` |
| JSON | PASS, 25 tracked JSON files at D9-415E |
| PHP syntax | PASS REQUIRED TOOL, 61 files; missing PHP fails closed |
| JavaScript syntax | PASS REQUIRED TOOL, 29 files; missing Node.js fails closed |
| Secret/private-data scan | PASS, 134 files / 10,575,308 bytes / zero unreviewed candidates |
| Executable backup scan | PASS, nine intended-active package MU files |
| Source manifest | PASS |
| Deterministic packaging | PASS, two identical SHA-256 values |
| No-production-command scan | PASS, five execution files / zero signatures |
| Baseline tag | PASS |
| Production/database/cache/deployment side effects | NONE |

## Wave 2 hardening

D9-415E resolved the reproducibility reviewer's three P1 findings:

1. Mutable JSON inputs can no longer repin runtime source or relax package boundaries without failing independent code-level trust anchors.
2. PHP and Node.js are mandatory; unavailable tools or unexpected checked-file counts fail the run.
3. CI path filters now include the production hash map and scanner, every executed dependency is hash-sealed or scanned, checkout is pinned to commit `34e114876b0b11c390a56381ad16ebd13914f8d5`, and persisted checkout credentials are disabled.

## CI safety

The workflow runs only for pull requests to `main`, grants `contents: read`, writes temporary outputs only below `$RUNNER_TEMP`, and contains no manual/scheduled/privileged trigger, environment, secret reference, artifact upload, production command, deployment command, database command, cache command, or mutation path.

The package remains `deployable: false`. CI success is source validation only and is not release approval.
