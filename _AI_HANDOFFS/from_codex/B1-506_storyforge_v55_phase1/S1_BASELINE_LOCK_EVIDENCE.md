# B1-506 S1 Baseline Lock Evidence

Outcome: **PASS**

Recorded after the mandated authority commits and before baseline suites or
implementation.

```text
S1_REPO_ROOT=/Users/brianb/MissionMed_worktrees/B1-StoryForge-502
S1_BRANCH=codex/b1-503-storyforge-product-recovery
S1_HEAD=6e630df672e47e50ae5e14592c8455979e2b1dac
S1_STATUS=CLEAN
S1_CANONICAL_HASHES=PASS
S1_MANIFEST_A_SHA256=d7e5e92dc2359588dd5f2cd4467b5862c71094e79452d43a410f4fc2918b260f
S1_MANIFEST_B_SHA256=de63e75791c80c2f1fa134570b0917c7cce980ea5d65aba9b8f2c4a895b70fa3
S1_RESULT=PASS
```

Verified artifact hashes:

| Artifact | SHA-256 |
|---|---|
| Canonical StoryForge V5 | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| StoryForge V5.5 prototype | `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90` |
| StoryForge V5.5 r2 copy revision | `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b` |
| B1-505C execution kickoff | `2c9f28b5d5288a072efd27f8f0ce35798e2879997c4511375909530dead00ff7` |

Manifest verification:

- B1-504A `MANIFEST.sha256`: every entry `OK`.
- B1-504B `MANIFEST.sha256`: all 25 cross-package entries matched.
- B1-505C `MANIFEST.sha256`: every entry `OK`.

Authority commits:

- `a3255ad` — `B1-506: commit B1-504A/B1-504B authority folders (per RP-2)`
- `6e630df` — `B1-506: record B1-505C founder execution authority`

No product, runtime, migration, configuration, or production state changed.
