# D9-415 Canonical Repository Decision

Decision: **PASS — ONE RECOVERY HOME ESTABLISHED**

Under Founder Decision `D9-415-FOUNDATION-001`:

- Canonical repository: `https://github.com/brinyu13/missionmed-hq.git`
- Canonical base: `origin/main` at `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`
- Canonical recovery branch: `d9-matrix-plan-415-source-recovery`
- Canonical worktree: `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415`
- Canonical plugin root: `wp-content/plugins/missionmed-hub`
- Canonical selected MU root: `wp-content/mu-plugins`, constrained by the D9 intended-active manifest

The merge base of commit B and `origin/main` is exactly the recorded base commit. `origin/main` is a base, not a claim that main already represented production. Commit A `c340a3a87732f7dc4afb06c01e4586239a050495` is the exact observed-production source baseline; commit B `9469437d2ac5010563e59b6fdc00a9fe48548a80` is the source-only backup quarantine.

No other repository, branch, worktree, untracked source directory, or production filesystem path is authorized as the D9-415 implementation home. The recovery branch remains draft-only and non-deployable until later gates are independently approved.
