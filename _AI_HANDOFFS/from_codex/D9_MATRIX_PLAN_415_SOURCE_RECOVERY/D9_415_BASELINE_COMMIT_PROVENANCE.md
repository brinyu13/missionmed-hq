# D9-415 Baseline Commit Provenance

Status: **PASS**

## Immutable identity

- Base commit: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`
- Observed-production commit A: `c340a3a87732f7dc4afb06c01e4586239a050495`
- Tree: `2a43327429214fdf1c161aa9adf297fabac155bd`
- Annotated tag: `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`
- Tag object: `6e2f5e32830f06b9015b9eee1870ccfab62b2a49`
- Tag target: `c340a3a87732f7dc4afb06c01e4586239a050495`
- Plugin version: `1.5.1`
- Selected source: `135` files / `10590108` bytes

## Evidence chain

1. T0 and T1 were captured read-only from production and were byte-identical across 287 manifest entries.
2. The local raw copy verified 287/287 after local-only mode restoration; no production write occurred.
3. Secret/private-data scans covered the complete plugin plus ten selected MU files; no secret, credential, student record, log, cache, upload, session, database export, or environment file entered Git.
4. Commit A maps 125/125 plugin files and 10/10 selected MU files to the direct production hashes and sizes.
5. Nine protected Matrix files match the active lock. The controller exact hash is separately and narrowly authorized by Founder Decision 002.
6. The tag is explicitly non-deployable and points directly to commit A.

## Protected-file result

| Asset | Commit A SHA-256 | Result |
|---|---|---|
| `student_os_js` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | `active_lock_match` |
| `student_os_css` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | `active_lock_match` |
| `class_mmed_student_os_php` | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | `authorized_current_observed_source_under_D9-415-FOUNDATION-002` |
| `calendar_v4_js` | `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa` | `active_lock_match` |
| `calendar_v4_css` | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | `active_lock_match` |
| `scheduler_mount_js` | `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578` | `active_lock_match` |
| `file_vault_js` | `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` | `active_lock_match` |
| `file_vault_css` | `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990` | `active_lock_match` |
| `storyforge_js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | `active_lock_match` |
| `storyforge_css` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | `active_lock_match` |

## Scope boundary

Commit A is an observed-production evidence baseline, not a release. It intentionally contains the production backup-named MU-plugin. It approves neither entitlement behavior nor deployment. D9-416 remains required before implementation or release, and D9-420 remains blocked.

## Required safe-lineage commit record

| Commit | Tree | Parent | Files/path entries | Purpose | Validation |
|---|---|---|---:|---|---|
| A `c340a3a87732f7dc4afb06c01e4586239a050495` | `2a43327429214fdf1c161aa9adf297fabac155bd` | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` | 182 | Exact observed plugin/MU baseline plus safe provenance evidence | T0/T1, 135 mappings, syntax, guard, secret/data scan |
| B `9469437d2ac5010563e59b6fdc00a9fe48548a80` | `d5d3fc057ce47f3af46774541de1faca059defb1` | A | 5 path entries / 4 logical changes | Source-only MU backup quarantine | Byte-identical move, intended-active manifest, fail-closed backup validator |
| C `e12cd99aa9c019a6f99325c0b961aa50db945472` | `9e0408d93a37c0d6f73a4d06aa9da135b79c9b90` | B | 14 | Branch-local source/lock provenance and rollback evidence | 135 Git mappings, protected hashes, former/current CSS/controller verification |
| D `a81a3afc9d7b1f40295d0a1585045293326b0387` | `60f094ed21bac2a66e31a1c45426770f80a0bc56` | C | 13 | Deterministic package and non-deploying CI | Two identical archives, local full validator |
| E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00` | `d4f60aa9c755cd143f67c759a38a4ba9de739419` | D | 3 | Wave 2 fail-closed validation fixes | Detached candidate, clean E, missing-tool, fresh-clone, and hosted CI validation |
| F | Resolve from final branch head | E | Final handoff set | Final reports and combined handoff | Detached candidate, remote/CI/mirror equality after self-referential commit |

Every commit is within the permitted D9-415 source/evidence/validation scope. No commit modifies production or the protected global Matrix lock.
