# D9-415 Execution Plan

Ticket: `D9-MATRIX-PLAN-415`  
Risk: **HIGH — protected production-source recovery, Git publication, no deployment**  
Founder decisions: `D9-415-FOUNDATION-001` plus hash-scoped resume authority `D9-415-FOUNDATION-002`  
Canonical worktree: `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415`

## Outcome boundary

Recover and attest the exact active Kinsta Matrix plugin and required Matrix-related MU-plugin source into immutable Git history, then create a separate safe source head that quarantines the unsafe auto-loaded backup. Add deterministic non-deploying packaging/validation, push the branch and immutable tag, open a draft DO NOT MERGE pull request, and file the complete authority handoff. Production, databases, caches, flags, auth, entitlements, and CDN objects remain byte-for-byte and state-for-state unchanged.

## Dependency graph

```text
Phase 0 preflight + authority reads + ledgers
  -> Wave 1: four independent read-only investigations
  -> main-agent synthesis and snapshot authorization
  -> read-only production forensic snapshot
  -> secret/data/exclusion scan + exact hashes
  -> immutable observed-baseline import (D9-415A) + annotated tag
  -> safe MU backup quarantine (D9-415B)
  -> branch-local lock/provenance reconciliation (D9-415C)
  -> deterministic package + non-deploying CI (D9-415D)
  -> Wave 2: four new independent read-only reviews
  -> serial P0/P1 fixes only if evidenced (optional D9-415E)
  -> final reports/handoff (D9-415F)
  -> push branch/tag + draft DO NOT MERGE PR
  -> mirror, recursive verification, sanctioned activity-log append
```

No downstream node may start before every inbound dependency is satisfied.

## Phase sequence and gates

| Phase | Work | Required exit gate |
|---|---|---|
| 0 | Verify worktree/repo/branch/base/remote/upstream/clean state; read all inputs; hash D9-410; record environment; create ledgers/plan. | Clean preflight, exact expected remote/base, mandatory inputs read, persistent plan present. |
| 1 | Run exactly four independent read-only Wave 1 specialists and synthesize. | 4/4 complete; main verifies facts; no unresolved snapshot P0. |
| 2 | Create read-only local forensic snapshot of complete production plugin and required Matrix MU set. | Complete tree; no production write; inventory, symlink/mode/hash evidence captured. |
| 3 | Scan candidate snapshot for secrets, credentials, sessions, logs, uploads, student/private data, and excluded/generated material. | No unsafe file enters product tree; exclusions and redactions documented. |
| 4 | Import exact observed source without byte normalization; verify product-tree hashes against snapshot and production. | Exact baseline is representable and all required protected/dependency hashes match. |
| 5 | Commit `D9-415A: import exact observed Matrix production baseline`; create annotated immutable baseline tag. | Commit contains unsafe MU backup exactly as observed; tag points only to this commit. |
| 6 | Move backup unchanged to `_SYSTEM/FORENSICS/D9_415/MU_PLUGIN_BACKUPS/`; commit D9-415B. | Top-level autoload path absent at safe head; forensic bytes/hash unchanged. |
| 7 | Add branch-local provenance, historical Calendar CSS evidence, implementation-home lock, and non-mutating reconciliation; commit D9-415C. | Current runtime and former lock CSS are honestly represented; protected global authorities untouched. |
| 8 | Add deterministic packaging and non-deploying validation/CI; run twice; commit D9-415D. | Two clean package builds have identical SHA-256; CI performs no deploy. |
| 9 | Run exactly four new read-only reviewers; synthesize; fix P0/P1 serially if needed. | 4/4 complete; zero unresolved P0/P1. |
| 10 | Final tests, 37 deliverables, combined handoff, D9-415F, publication, mirror, activity log. | Clean worktree; remote branch/tag and draft PR verified; primary/mirror identical; no secret/data leak. |

## Wave 1 assignments

Exactly four independent read-only agents:

- A: production snapshot and secret-safety analyst.
- B: Git provenance and hash analyst.
- C: WordPress, MU-plugin, and security analyst.
- D: packaging, CI, release, and rollback analyst.

Each returns only the required distilled structure. Subagents may not write, stage, commit, branch, tag, push, open PRs, mutate production/WordPress/databases/caches/flags, or decide final authority. With four total concurrency slots, A/B/C may run concurrently and D will run as soon as a slot is free; the wave still consists of exactly four independent agents.

## Wave 2 assignments

After D9-415D, run exactly four new read-only reviewers:

- provenance and hash-chain reviewer;
- security, secret, and private-data reviewer;
- reproducibility and CI reviewer;
- release, rollback, and no-production-mutation reviewer.

The main agent alone verifies findings and applies any real P0/P1 fix serially. D9-415E is omitted if no fix is needed.

## Allowed-write map

- This worktree and branch only.
- `wp-content/plugins/missionmed-hub/**` recovered exact production source.
- Required Matrix-related `wp-content/mu-plugins/**` recovered exact production source.
- `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/**` branch-local provenance and preserved historical artifacts.
- `_SYSTEM/FORENSICS/D9_415/MU_PLUGIN_BACKUPS/**` byte-identical quarantined backup.
- Non-deploying scripts/tests/workflows required for deterministic validation.
- D9-415 handoff/evidence/manifests/packages folders.
- Approved mirror handoff folder after final validation.
- Annotated baseline tag, remote recovery branch, draft PR, and sanctioned append-only activity log after success.

## Forbidden-write map

- Kinsta/WordPress production and every production plugin or MU-plugin byte.
- WordPress options, plugin activation, rewrite state, user/entitlement state.
- Supabase/databases/migrations/RLS/functions/data.
- Kinsta/CDN/browser/Railway caches and Scheduler CDN HTML.
- Feature flags, auth/session/bootstrap/exchange, credentials, environment values.
- Active Matrix lock protocol/manifest/guard, Critical Systems Contract, Codex guardrails, MissionMed OS constitutional/registry files.
- D9-300, D9-350, D9-360, and D9-410 artifacts.
- Other worktrees, branches, tags, or unrelated dirty files.

## Commit plan

1. `D9-415A: import exact observed Matrix production baseline`
2. Annotated tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`
3. `D9-415B: quarantine unsafe MU backup in canonical source`
4. `D9-415C: reconcile Matrix runtime source and lock provenance`
5. `D9-415D: add deterministic Matrix source validation pipeline`
6. Optional `D9-415E` only for real Wave 2 review fixes.
7. `D9-415F: file source-recovery handoff and final reports`

Every commit is verified before the next; no amend/rewrite of D9-415A or its tag.

## Rollback plan

This mission makes no production change, so operational rollback is not exercised. Source rollback is additive and Git-native:

- D9-415A/tag permanently preserves exact observed bytes, including the unsafe top-level MU backup.
- D9-415B safe head preserves the backup byte-identically outside autoload scope.
- Later source work can compare or restore exact files from the immutable tag without rewriting it.
- No production restore command will be run or embedded as an executable action in CI.
- Deployment lineage remains a plan only and D9-416 retains staging/deploy authority work.

## Gate plan

- `G-D9-4`: remains OPEN unless an independent signed approval already exists; no inference.
- `G-D9-5A`: PASS only if exact source, dependency, provenance, safe head, reproducibility, review, publication, and clean-worktree criteria are directly evidenced.
- `G-D9-5B`: `OPEN — D9-416 REQUIRED`.
- Overall `G-D9-5`: PARTIAL if 5A passes while 5B is open.
- D9-420: BLOCKED.

## Stop rules

Stop the affected write phase on every prompt hard stop, BOOT hard stop, Matrix stale warning, production/manifest/hash contradiction, secret/private/student data discovery, missing dependency, unsafe snapshot, unexpected remote, unrelated dirty state, or unresolved review P0. Continue only earlier or independent evidence work that remains demonstrably safe.

## Phase 0 result

- Worktree path/root/branch/remote/upstream/base: verified.
- Initial product-tree status: clean.
- Base and current remote `origin/main`: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Mandatory authority packet: read in full.
- D9-410 combined SHA-256: `12f6521d8fdb3e9158780dccca2e78083e463919dc3a6c8fddcf68484f8b7397`.
- D9-410 baseline JSON SHA-256: `cfcebb2e31853264da6048071323ff806e4d4ff3a3b12fe224cd6c6514b63105`.
- Product-tree source writes: zero.

`PHASE 0 COMPLETE`  
`WORKTREE CLEAN AT ENTRY: YES`  
`SUBAGENT WAVE 1: STARTING`

## Final execution result

- Phase 0: PASS.
- Wave 1: 4/4 complete; exact blocker resolved by `D9-415-FOUNDATION-002` without rerun.
- T0/copy/T1: PASS, identical manifests.
- D9-415A/tag, B, C, D: complete in required order.
- Wave 2: 4/4 complete; three validation P1s resolved in non-empty D9-415E; two report gaps closed in F.
- Dedicated branch review and 25-area validation matrix: PASS, zero unresolved P0/P1.
- Branch, tag, draft PR #9, and hosted CI: verified.
- D9-415F: final reports and combined handoff.
- Production/database/cache/flag/auth/entitlement/deployment mutations: zero.

Final gate posture: `G-D9-5A PASS`; `G-D9-5B OPEN — D9-416 REQUIRED`; overall `G-D9-5 PARTIAL`; D9-420 BLOCKED.
