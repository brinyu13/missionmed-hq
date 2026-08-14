# D9-415 Reproducible Package Report

Status: **PASS — TWO BUILDS BYTE-IDENTICAL**

## Source identity

- Runtime source commit: `e12cd99aa9c019a6f99325c0b961aa50db945472`
- Runtime source tree: `9e0408d93a37c0d6f73a4d06aa9da135b79c9b90`
- Canonical branch metadata: `d9-matrix-plan-415-source-recovery`
- Plugin version: `1.5.1`
- Package policy: `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_PACKAGE_POLICY.json`

Commit C is intentionally pinned as the runtime-source commit because D and later closeout commits add validation and evidence without changing runtime bytes. The builder rejects any plugin or intended-active MU drift after C.

## Package boundary

- Included plugin files: 120.
- Included intended-active MU files: 9.
- Total tracked source files: 129.
- Total tracked source bytes: 10,560,023.
- Archive files: 131, including generated `PACKAGE_METADATA.json` and `SOURCE_MANIFEST.json`.
- Source-manifest SHA-256: `a650686889a6ddc22664ed890b6ff7b80fc3c1e475282723b8542d05f3967bc5`.

Five observed plugin files are excluded as non-runtime residue: three root documentation reports, `assets/test-deploy.txt`, and the unreferenced `.inactive.js` asset. Handoffs, evidence, tests, caches, logs, `node_modules`, raw transport, and `_SYSTEM/FORENSICS` cannot enter the archive because the builder selects only the pinned plugin paths and nine manifest-approved MU files.

## Reproducibility proof

| Build | Archive bytes | SHA-256 |
|---|---:|---|
| 1 | 2,711,483 | `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f` |
| 2 | 2,711,483 | `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f` |

Direct byte comparison also passed. Ordering, file and directory modes, owner fields, source-commit tar timestamps, gzip timestamp, metadata serialization, and source-manifest serialization are deterministic.

The archives were created only under a temporary local validation directory and were not committed, uploaded, deployed, or sent to production. Package metadata explicitly records `deployable: false` and `deployment_side_effects: NONE`.

## Wave 2 revalidation

D9-415E did not change runtime or package bytes. It independently sealed the runtime commit/tree, tag/target, policy, source lock, production map, MU manifest, counts, exclusions, protected hashes, builder/scanner/validator/workflow dependencies, and command-deny patterns. The identical package SHA-256 remained `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f` in detached-candidate, clean-E, fresh-clone, and hosted-CI validation.
