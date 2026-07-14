# D9-415 Complete Combined Handoff

Ticket: `D9-MATRIX-PLAN-415`

This file mechanically embeds every required Markdown deliverable verbatim in mandated logical order, followed by all standalone Wave 1/dedicated-review Markdown evidence. Machine-readable JSON remains separate. The prior blocked combined artifact is retained separately and is not nested here.

## Required Markdown deliverables

<!-- BEGIN VERBATIM FILE: D9_415_EXECUTIVE_VERDICT.md -->
# D9-415 Executive Verdict

Ticket: `D9-MATRIX-PLAN-415`

Result: **COMPLETE**

Verdict: **A — CODE SOURCE AUTHORITY RECOVERED**

## Decision

The exact quiescent Matrix production source is recovered into canonical Git history and independently verified. D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495` preserves the 125-file plugin and ten-file Matrix MU closure exactly as observed between identical T0/T1 manifests. The immutable annotated tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713` points only to D9-415A.

The safe source lineage then quarantines the executable MU backup outside the autoload tree, reconciles branch-local provenance and rollback evidence, adds deterministic non-deploying validation, and resolves every valid Wave 2 P1 finding. Pull request [#9](https://github.com/brinyu13/missionmed-hq/pull/9) is draft and explicitly marked **DO NOT MERGE**.

## Founder authority and behavior boundary

- `D9-415-FOUNDATION-001`: applied.
- `D9-415-FOUNDATION-002`: applied exactly to controller SHA-256 `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` for source recovery.
- Previous locked controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`: preserved only as historical rollback evidence.
- Entitlement behavior: **OBSERVED AND PRESERVED, NOT APPROVED**.
- D9-416 adjudication: required for entitlement, authentication, authorization, database, flags, staging, deployment, cache, and rollback authority.

## Direct evidence

- T0 and T1 normalized manifests: identical, SHA-256 `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`.
- Production-to-Git mappings: 135/135 exact for path, size, SHA-256, mode, and Git blob.
- Protected Matrix assets: 10/10 exact, with only the Founder-002 controller disposition.
- Deterministic package: two byte-identical archives, SHA-256 `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`.
- Wave 2: 4/4 complete; all valid P1 findings resolved.
- Dedicated branch review: zero unresolved P0/P1.
- GitHub CI: `validate-source-only` passed on PR #9.
- Production, database, cache, feature-flag, auth, and entitlement mutations: zero.

## Gates

- `G-D9-4`: OPEN.
- `G-D9-5A CODE SOURCE AUTHORITY`: PASS.
- `G-D9-5B DATA-AUTH AUTHORITY`: OPEN — D9-416 REQUIRED.
- Overall `G-D9-5`: PARTIAL.
- D9-416: READY for independent authority adjudication.
- D9-420: BLOCKED.

This verdict does not authorize deployment, production MU remediation, Matrix Plan implementation, or acceptance of the currently observed entitlement semantics.
<!-- END VERBATIM FILE: D9_415_EXECUTIVE_VERDICT.md -->

<!-- BEGIN VERBATIM FILE: D9_415_FOUNDER_DECISION.md -->
# D9-415 Founder Decision

DECISION ID

D9-415-FOUNDATION-001

DECISION OWNER

Dr. Brian

DECISIONS

1. `https://github.com/brinyu13/missionmed-hq.git` is designated as the canonical repository family for recovering, tracking, reviewing, and eventually implementing Matrix production source.

2. `origin/main` is the base for the dedicated recovery branch. It is not being declared the current production source.

3. The exact currently loaded Kinsta `missionmed-hub` runtime files are the authoritative OBSERVED PRODUCTION BASELINE for source recovery because verified production evidence outranks stale or incomplete repository copies.

4. D9-360 remains the product, visual, behavioral, and interaction authority. Production bytes govern only the pre-existing Matrix runtime into which D9-360 will later be implemented.

5. The Calendar CSS currently served identically by Kinsta origin and public delivery is the observed production baseline.

6. The former runtime-lock Calendar CSS must be preserved as historical and rollback evidence.

7. The exact observed production source must be committed before any cleanup or normalization.

8. The auto-loaded backup MU-plugin must be included in the exact observed baseline because it exists in production.

9. The backup MU-plugin must then be removed from the active source path in a separate commit and retained in a non-autoloaded forensic location.

10. No production file may be changed during D9-415.

11. No database, WordPress option, feature flag, cache, authentication flow, entitlement, CDN object, Scheduler HTML, or deployment may be changed.

12. The branch and baseline tag may be pushed.

13. A draft pull request may be opened.

14. The pull request must not be merged.

15. D9-420 remains blocked after this run.

16. D9-416 must resolve database, authentication, entitlement, feature-flag, staging, and deployment authority.

<!-- END VERBATIM FILE: D9_415_FOUNDER_DECISION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_FOUNDER_DECISION_002.md -->
# D9-415 Founder Decision 002

DECISION ID

D9-415-FOUNDATION-002

DECISION OWNER

Dr. Brian

This decision supplements D9-415-FOUNDATION-001.

It does not replace or weaken its safety requirements.

I authorize the following:

1. The production controller currently observed at:

   /www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php

   with SHA-256:

   23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29

   is authorized as the intended CURRENT OBSERVED PRODUCTION BASELINE for D9-415 source-recovery purposes.

2. D9-415 may recover and preserve that exact production byte even though the active Matrix runtime lock currently records the earlier SHA-256:

   c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb

3. This authorization confirms only what D9-415 must preserve as the current production state.

4. This authorization does NOT approve, ratify, validate, or normalize the entitlement behavior contained in Y1-CAM-4005.

5. D9-416 must independently review and adjudicate:

   - entitlement behavior
   - authority-mode validation
   - revocation_checked semantics
   - LearnDash-current-access semantics
   - authentication consequences
   - authorization consequences
   - compatibility with the final Matrix Plan access contract

6. D9-415 must preserve the earlier controller hash:

   c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb

   as pre-change historical and rollback evidence.

7. D9-415 must preserve the current controller hash:

   23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29

   in the immutable exact-observed-production baseline commit.

8. The observed current production source governs source recovery.

9. D9-360 continues to govern Matrix Plan product behavior, UI, UX, visual identity, and interaction design.

10. No production mutation is authorized.

11. No entitlement, authentication, database, feature-flag, cache, CDN, WordPress option, plugin activation, or deployment mutation is authorized.

12. D9-420 remains blocked.

13. G-D9-4 remains open.

14. D9-416 remains mandatory after D9-415.
<!-- END VERBATIM FILE: D9_415_FOUNDER_DECISION_002.md -->

<!-- BEGIN VERBATIM FILE: D9_415_EXECUTION_PLAN.md -->
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
<!-- END VERBATIM FILE: D9_415_EXECUTION_PLAN.md -->

<!-- BEGIN VERBATIM FILE: D9_415_DECISION_LEDGER.md -->
# D9-415 Decision Ledger

Ticket: `D9-MATRIX-PLAN-415`  
Decision owner for scoped recovery: Dr. Brian under `D9-415-FOUNDATION-001`  
Main-agent write owner: Codex `/root`

| ID | Phase | Decision | Basis | Consequence | Status |
|---|---|---|---|---|---|
| D9-415-D001 | 0 | Use `https://github.com/brinyu13/missionmed-hq.git`, branch `d9-matrix-plan-415-source-recovery`, based on current `origin/main` `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`. | Founder decision plus direct Git preflight. | Recovery has one bounded repository, branch, and clean worktree. | APPLIED |
| D9-415-D002 | 0 | Treat direct production bytes captured during this run as observed runtime authority; use D9-410 as prior evidence, not as a substitute for current production. | Founder decision, BOOT runtime-truth law, and Critical Systems source-of-truth rules. | Any post-D9-410 runtime drift must be represented honestly in the observed baseline. | APPLIED |
| D9-415-D003 | 0 | Proceed under the explicit founder decision despite D9-415 being absent from the current MissionMed OS mission registry; do not invent or mutate a registry entry. | BOOT permits graceful degradation, the task supplies the mission identity and protected local track, and permitted writes exclude registry mutation. | Record governance degradation; file only through authorized product/handoff paths and append the activity log after validation. | APPLIED |
| D9-415-D004 | 0 | Treat the active Matrix lock manifest as newer evidence than D9-410. | Active manifest SHA-256 `efb1d51b916ccc32fa0bf56fa3bd77b828f5cfa63ca04fb8b29c914654c9952d`, updated `2026-07-13T14:55:56Z`; it now pins the live Calendar CSS and newer fingerprinted shell/controller artifacts. | Wave 1 and the snapshot must validate current production directly. D9-410's ten hashes remain historical baseline evidence. | APPLIED |
| D9-415-D005 | 0 | Make no product-tree source write before the execution plan exists and all four Wave 1 reports are synthesized. | Prompt Phase 0 hard gate. | Only handoff/evidence ledger writes are allowed until Phase 1 closes. | APPLIED |
| D9-415-D006 | 0 | Stage production reads first in a local forensic evidence snapshot, scan and validate it, then run the Matrix guard against a path-shaped staging tree before importing protected paths into the product tree. | Matrix lock preflight law plus no-secret/no-data law. | Avoids both preflight circularity and unscanned source entering Git. | ACTIVE |
| D9-415-D007 | 0 | Do not modify the active Matrix manifest, protocol, guard, passport, production, database, cache, flags, auth, entitlements, or CDN in this ticket. | Founder decision and protected-path rules. | Reconciliation is branch-local evidence and a passport patch proposal only. | ACTIVE |
| D9-415-D008 | 1 | Freeze all production inspection after the protected controller mismatch and prohibit snapshot/import/tag/package/publication. | Direct production `23da5c...` versus active lock `c0a538...`; production mtime postdates lock; BOOT/Matrix/Critical/ticket hard stops. | Wave 1 evidence may be synthesized, but Phase 2 and every downstream write are blocked. | RESOLVED BY D9-415-D011 |
| D9-415-D009 | 1 | Attribute the observed byte to Y1-CAM-4005 without treating that candidate as authority. | Local content hash search: candidate `23da5c...`; pre-change backup `c0a538...`. | The drift is explained technically but remains unauthorized for D9-415 recovery until exact direction/cutoff. | APPLIED |
| D9-415-D010 | 1 | Require exact, hash-scoped authority rather than inferring that the generic founder source-precedence decision overrides the newer entitlement-significant lock conflict. | New controller behavior was not named in the original D9-415 decision and active protected lock disagrees. | Prevents accidental normalization of a concurrent/unreconciled protected deployment. | SATISFIED |
| D9-415-D011 | 1R | Apply `D9-415-FOUNDATION-002` exactly to controller hash `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` for source recovery, while retaining the active-lock hash `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` as historical/rollback evidence. | Hash-scoped founder authorization supplied in the resume ticket; one read-only production recheck confirmed the authorized byte is still current. | Phase 2 may resume without treating Y1-CAM-4005 behavior as approved and without modifying protected global lock files. | APPLIED |
| D9-415-D012 | 2 | Define quiescence through identical full T0/T1 manifests around one inbound read-only forensic copy. | Founder authorization requires equality of relative path, type, size, SHA-256, and mode for every included production path. | Any difference produces `PRODUCTION NOT QUIESCENT` and stops before import/commit; an identical comparison freezes the only admissible snapshot. | APPLIED — IDENTICAL T0/T1 |
| D9-415-D013 | 2 | Preserve current entitlement-significant source without fixing, reverting, approving, or normalizing its behavior in D9-415. | `D9-415-FOUNDATION-002` separates runtime source truth from entitlement/auth authority. | D9-416 adjudicates behavior; D9-420 remains blocked and must not infer deployability from D9-415 artifacts. | APPLIED |
| D9-415-D014 | 2 | Supersede Wave 1's `123` plugin-file estimate with the complete T0/T1 count of `125`. | Two independent local counts and both full production manifests report 125 files; T0/T1 are byte-identical across the entire snapshot window. | Preserve Wave 1 named-file findings, but use the sealed 125-file manifest for baseline scope and classification. | APPLIED |
| D9-415-D015 | 3 | Seal a ten-file Matrix-related MU closure rather than the seven Wave 1 candidates alone. | Local source analysis proved `missionmed-drj-drills-access.php` directly changes Student OS Matrix route/feature access, calls four functions from `arena-route-proxy.php`, and `missionmed-performance-boost.php` explicitly preserves exact Matrix asset query versions. | Include the three source-evidenced additions unchanged; exclude the other 116 observed MU files as unrelated. | APPLIED |
| D9-415-D016 | 3 | Permit exact product-tree import after redacted content scanning and split Matrix guard validation. | One Webex PKCS#8 validation phrase and two schema labels were false positives; no secret/private data found; nine unchanged protected assets passed guard and Decision 002 covers only the controller warning. | Import all 125 plugin files and ten MU files byte-for-byte; no broad guard override. | APPLIED |
| D9-415-D017 | 5-8 | Preserve the already-created A→B→C→D sequence rather than duplicate or rewrite it after resume-state discovery. | Git history, reflog, commit scope, tag target, and a clean worktree proved the required sequence was complete. | Independently validate the sequence and continue at Wave 2. | APPLIED |
| D9-415-D018 | 9 | Accept the reproducibility reviewer's three P1 validation findings; treat the release reviewer's two P1 items as mandatory F closeout gaps. | Main-agent source review reproduced mutable trust inputs, optional syntax tools, and missing workflow/dependency coverage. | Create one non-empty D9-415E and close documentation in D9-415F. | APPLIED |
| D9-415-D019 | 9 | Seal D9-415 trust anchors in code, require PHP/Node and exact counts, cover all consumed inputs, pin checkout, and disable persisted credentials. | Detached precommit, real-commit, fresh-clone, and GitHub-hosted validation all passed. | CI now fails closed; package bytes remain unchanged. | APPLIED |
| D9-415-D020 | 9 | Accept full-branch whitespace warnings only for immutable production/evidence bytes; require all authored E/F deltas to pass diff checks. | D9-415A must remain byte-exact and contains CRLF/trailing whitespace observed in production. | Do not normalize the baseline; document the exception. | APPLIED |
| D9-415-D021 | 10 | Publish the branch/tag and open draft PR #9 before F so final reports can record the actual PR identity. | Prompt orders publication before Phase 11; PR is draft and DO NOT MERGE. | Push E/tag, verify, open PR, then file/push F and reverify. | APPLIED |
| D9-415-D022 | 11 | Make the final combined handoff contain every required Markdown deliverable verbatim plus standalone Wave 1 evidence, excluding nested prior combined files. | Original prompt defines deliverable order; user also requested one combined Markdown file. | Generate deterministic markers and verify embedded bytes. | APPLIED |
| D9-415-D023 | 11 | Pass G-D9-5A while leaving G-D9-5B open and overall G-D9-5 partial. | Exact source, reproducibility, review, publication, and non-mutation evidence are complete; data/auth/deploy authority remains outside D9-415. | D9-416 READY; D9-420 BLOCKED. | APPLIED |

## Instruction and authority resolution

Loaded instruction files and scope:

- `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/AGENTS.md`: worktree-local MissionMed boot and hard stops.
- `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/CLAUDE.md`: same local boot and hard-stop scope.
- `/Users/brianb/MissionMed_OS/BOOT.md` from fetched `origin/main`: operating-system resolution chain and shared laws.
- `/Users/brianb/MissionMed_OS/CURRENT.md` from fetched `origin/main`: generated estate state at `2026-07-13T11:48:53-04:00`.
- Mission record: no `D9-MATRIX-PLAN-415` entry exists in fetched `origin/main:missions.json`.
- Product routing: Matrix entry in fetched `origin/main:products_index.json` points to `PRODUCT_PASSPORTS/matrix.md`.
- Authority routing: fetched `origin/main:authority_index.json` routes the Matrix lock protocol/manifest, Critical Systems Contract, and Codex guardrails.
- Product passport: `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415/PRODUCT_PASSPORTS/matrix.md`.

Conflict resolution:

- The mission-registry absence is governance degradation, not competing substantive authority. The founder-supplied mission packet is exact and the prompt does not authorize registry edits.
- D9-410 and the active Matrix manifest differ because the active manifest was updated later the same day. Runtime truth and the newer active manifest govern current snapshot validation; D9-410 remains immutable prior evidence.
- No unresolved authority conflict currently prevents read-only discovery. Any stale Matrix guard warning or current production/manifest contradiction remains a hard stop for the affected write phase.

## Final resolution

Founder Decision 002, the identical snapshot cutoff, immutable A/tag, safe B/C/D/E lineage, 4/4 Wave 2 review, dedicated branch review, hosted CI, and final closeout resolve all D9-415 source-authority conflicts. Entitlement and operational authority are deliberately routed to D9-416 rather than inferred.
<!-- END VERBATIM FILE: D9_415_DECISION_LEDGER.md -->

<!-- BEGIN VERBATIM FILE: D9_415_COMMAND_LOG.md -->
# D9-415 Command Log

Every row is one shell execution batch. All actions through Phase 0 were read-only except `mkdir -p` for the authorized handoff structure and `apply_patch` for these ledgers/evidence files. Commands executed before ledger creation are reconstructed from the authoritative tool transcript and marked `bootstrap`.

| ID | Phase | Category | Command / target | Expected side effects | Exit | Evidence |
|---|---:|---|---|---|---:|---|
| C0001 | 0 | bootstrap preflight | Inspect D9-415 `pwd`, repo root, branch, HEAD, `origin/main`, merge-base, origin, upstream, status, and remote main. | None | 0 | `evidence/PHASE_0_PREFLIGHT.txt` |
| C0002 | 0 | instruction discovery | Find and read applicable `AGENTS.md` and `CLAUDE.md`; verify no applicable override. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0003 | 0 | OS sync | `git -C /Users/brianb/MissionMed_OS fetch origin main` after local OS was found pre-existing dirty/behind. | Update remote-tracking ref only; no worktree write | 0 | Fetched `origin/main`; local dirty files preserved. |
| C0004 | 0 | OS authority read | `git show origin/main:BOOT.md`, `CURRENT.md`, registry and index reads. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0005 | 0 | prompt read | Read `/Users/brianb/.codex/attachments/0789f3ea-bb58-4911-826b-d372d0a6a6e1/pasted-text.txt` in full and extract exact phase/deliverable requirements. | None | 0 | Original attachment path. |
| C0006 | 0 | file discovery | `rg --files` filter for mandatory D9/Matrix authority inputs. | None | 0 | Mandatory source paths listed in prompt. |
| C0007 | 0 | prompt extraction | `rg -n` mandatory input/deliverable markers in the prompt attachment. | None | 0 | Original attachment path. |
| C0008 | 0 | prompt extraction | `sed -n '160,225p'` prompt attachment. | None | 0 | Original attachment path. |
| C0009 | 0 | mandatory read | Read D9-410 combined handoff lines 1-350. | None | 0 | D9-410 combined handoff. |
| C0010 | 0 | mandatory read | Read D9-410 combined handoff lines 351-700. | None | 0 | D9-410 combined handoff. |
| C0011 | 0 | mandatory read | Read D9-410 combined handoff lines 701-1050. | None | 0 | D9-410 combined handoff. |
| C0012 | 0 | mandatory read | Read D9-410 combined handoff lines 1051-1400. | None | 0 | D9-410 combined handoff. |
| C0013 | 0 | mandatory read | Read D9-410 combined handoff lines 1401-1750. | None | 0 | D9-410 combined handoff. |
| C0014 | 0 | mandatory read | Read D9-410 combined handoff lines 1751-2100. | None | 0 | D9-410 combined handoff. |
| C0015 | 0 | mandatory read | Read D9-410 combined handoff lines 2101-2450. | None | 0 | D9-410 combined handoff. |
| C0016 | 0 | mandatory read | Read D9-410 combined handoff lines 2451-2800. | None | 0 | D9-410 combined handoff. |
| C0017 | 0 | mandatory read | Read D9-410 baseline JSON, implementation-home lock JSON, and repository census. | None | 0 | Named mandatory files. |
| C0018 | 0 | mandatory read | Read D9-410 worktree census, WordPress ownership census, conflict register, and next-run inputs. | None | 0 | Named mandatory files. |
| C0019 | 0 | mandatory read | Read D9-360 implementation authority and combined handoff; combined output was tool-truncated, so it was re-read in bounded chunks. | None | 0 | Named mandatory files. |
| C0020 | 0 | mandatory read | Read D9-360 combined handoff lines 1-140. | None | 0 | D9-360 combined handoff. |
| C0021 | 0 | mandatory read | Read D9-360 combined handoff lines 141-280. | None | 0 | D9-360 combined handoff. |
| C0022 | 0 | mandatory read | Read D9-360 combined handoff lines 281-500. | None | 0 | D9-360 combined handoff. |
| C0023 | 0 | authority read | Read Matrix runtime lock protocol. | None | 0 | Authority file. |
| C0024 | 0 | authority read | Read active Matrix runtime lock manifest. | None | 0 | Authority file; SHA in `evidence/PHASE_0_INPUT_HASHES.txt`. |
| C0025 | 0 | authority read | Read `matrix_runtime_guard.py` lines 1-220. | None | 0 | Guard source. |
| C0026 | 0 | authority read | Read `matrix_runtime_guard.py` lines 221-440. | None | 0 | Guard source. |
| C0027 | 0 | authority read | Read Critical Systems Contract. | None | 0 | Authority file. |
| C0028 | 0 | authority read | Read Codex guardrails lines 1-210. | None | 0 | Authority file. |
| C0029 | 0 | authority read | Read Codex guardrails lines 211-420. | None | 0 | Authority file. |
| C0030 | 0 | authority read | Read Codex guardrails lines 421-700. | None | 0 | Authority file. |
| C0031 | 0 | passport read | Read Matrix product passport. | None | 0 | Product passport. |
| C0032 | 0 | OS authority read | Read fetched `origin/main:BOOT.md` and `CURRENT.md` verbatim. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0033 | 0 | OS routing read | Query fetched product index Matrix entry, full authority index, and D9-415 mission lookup. | None | 0 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| C0034 | 0 | prompt extraction | Read founder decision and primary-goal section. | None | 0 | Original attachment path. |
| C0035 | 0 | environment/preflight | Re-run exact Git preflight, remote main, D9-410/manifest hashes, tool versions, host/OS/date. | None | 0 | `evidence/PHASE_0_PREFLIGHT.txt`, `PHASE_0_INPUT_HASHES.txt`, `PHASE_0_ENVIRONMENT.txt` |
| C0036 | 0 | directory creation | Create authorized primary handoff `evidence`, `manifests`, and `packages` directories. | Local handoff directories only | 0 | Directory structure. |
| C0037 | 0 | ledger write | Apply patch creating Phase 0 decision/run/command/evidence ledgers, founder decision, plan, and raw evidence summaries. | Authorized handoff files only | 0 | Files in this handoff. |
| C0038 | 0 | verification | List new handoff files and check Git status. | None | 0 | Primary handoff tree; task-generated files only. |
| C0039 | 1 | prompt read | Read Phase 2-8 requirements from prompt attachment. | None | 0 | Original attachment path. |
| C0040 | 1 | repo/tooling read | Inspect ignore rules, package/deploy/validation file inventory, and `.gitignore`. | None | 0 | Agent D evidence and repository paths. |
| C0041 | 1 | orchestration | Spawn/read-only Wave 1 agents A, B, C; start D after A stopped. | No filesystem or external mutation | 0 | `evidence/WAVE_1_SUBAGENT_*.md` |
| C0042 | 1 | local provenance | Search local evidence for controller hashes `23da5c...` and `c0a538...`. | None | 0 | Y1-CAM-4004/4005 paths in Wave 1 synthesis. |
| C0043 | 1 | local hash census | Hash all local `class-mmed-student-os.php` candidates and match the disputed values. | None | 0 | Wave 1 synthesis. |
| C0044 | 1 | local source discovery | List Y1-CAM-4005 candidate/backup files and any corresponding handoff paths. | None | 0 | Agent D evidence paths. |
| C0045 | 1 | authority monitor | Re-read active manifest mtime/SHA/controller pin/validation ticket and look for newer Y1-CAM-4005 files. | None | 0 | Manifest remained `efb1d...`, pin `c0a538...`. |
| C0046 | 1 | ledger write | Apply patch filing four Wave 1 reports, synthesis, risk/conflict registers, and blocked run state. | Authorized handoff files only | 0 | This handoff. |
| C0047 | 1 | verdict write | Apply patch filing interim blocked executive verdict, execution report, and no-production-mutation attestation. | Authorized handoff files only | 0 | This handoff. |
| C0048 | 1 | stop-boundary validation | Parse JSON, scan handoff for high-confidence secret signatures, prove no product/system diff, inspect status, hash interim evidence set, count files. | None | 0 | 20 files; interim aggregate `04ef4bd310733e780969ecd2aa9aa3aa9765f90cd44647ea529281e46ec96a65`. |
| C0049 | 1 | report update | Record stop-boundary validation and interim aggregate hash. | Authorized handoff Markdown only | 0 | `D9_415_EXECUTION_REPORT.md`, this log. |
| C0050 | closeout | combined-source census | List every current Markdown source excluding prior combined files and record byte counts. | None | 0 | Fourteen Markdown source files identified. |
| C0051 | closeout | mechanical combined assembly | Assemble the fourteen Markdown sources verbatim in explicit logical order with begin/end markers; verify exact generated bytes, marker count, file count, and SHA-256. | One authorized combined Markdown file | 0 | `D9_415_BLOCKED_PHASE_1_COMBINED_HANDOFF.md` |
| C0052 | 1R | resume prompt read | Read the 495-line hash-scoped founder-authorization ticket in bounded chunks. | None | 0 | Resume attachment. |
| C0053 | 1R | plugin instruction read | Load the explicitly requested GitHub, Computer Use, and Browser skill instructions; resolve the Browser skill to its installed cache version. | None | 0 | Installed plugin skill files. |
| C0054 | 1R | resume gate | Recheck exact D9 worktree, branch, origin, HEAD/base relationship, and status. | None | 0 | Expected worktree/branch/origin; handoff-only untracked state. |
| C0055 | 1R | OS state read | Inspect local MissionMed OS status/remote relationship and compare local versus fetched/current authority state without mutating the dirty OS worktree. | None | 0 | Local OS behind seven; substantive CURRENT state unchanged. |
| C0056 | 1R | BOOT/passport read | Reload BOOT routing and the Matrix product passport. | None | 0 | Canonical OS and worktree passport. |
| C0057 | 1R | guardrail read | Read all Codex execution guardrails including MR-G8. | None | 0 | `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`. |
| C0058 | 1R | persisted-state read | Reload required D9-415 run state, decision ledger, plan, evidence index, synthesis, risk/conflict registers, and execution report. | None | 0 | Existing handoff. |
| C0059 | 1R | command-log read | Re-read the command log separately after a combined tool result truncated. | None | 0 | Existing command log. |
| C0060 | 1R | Wave 1 evidence read | Read all four existing Wave 1 reports; do not rerun the investigations. | None | 0 | `evidence/WAVE_1_SUBAGENT_*.md`. |
| C0061 | 1R | GitHub remote verification | Use the GitHub connector to confirm remote main remains `9c1fa72...` and the recovery branch is not yet remote. | None | 0 | Connected GitHub read results. |
| C0062 | 1R | original prompt read | Locate and reread all 1,443 lines of the original D9-415 mission prompt. | None | 0 | Original attachment. |
| C0063 | 1R | protected authority read | Reload the active Matrix lock protocol/manifest and Critical Systems Contract. | None | 0 | Controller lock remains `c0a538...`. |
| C0064 | 1R | authorized production check | Run one read-only SSH metadata/hash check for the protected production controller. | None | 0 | Controller remains `23da5c...`, size 32786, mode 0644, original mtime preserved. |
| C0065 | 1R | primer/hygiene read | Read worktree primer, Git workspace hygiene protocol, and local boot pointer. | None | 0 | Worktree authority inputs. |
| C0066 | 1R | canonical initialization | Resolve canonical knowledge paths; read the last ten learnings, rules engine, naming canon, and integrity extension. | None | 0 | Canonical MissionMed root. |
| C0067 | 1R | canonical drift check | Count required knowledge files and compare canonical/worktree primer hashes. | None | 0 | Canonical primer differs from older worktree copy. |
| C0068 | 1R | canonical authority read | Read canonical primer and deprecated master-knowledge compatibility marker in full. | None | 0 | Canonical MissionMed root. |
| C0069 | 1R | knowledge router read | Read Knowledge Index lines 1-400. | None | 0 | Canonical Knowledge Index. |
| C0070 | 1R | knowledge router read | Read Knowledge Index lines 401-800; tool output truncation required bounded rereads. | None | 0 | Canonical Knowledge Index. |
| C0071 | 1R | knowledge router reread | Reread lines 401-600 and 601-800 in bounded outputs. | None | 0 | Canonical Knowledge Index. |
| C0072 | 1R | knowledge router read | Read lines 601-700 and 801-1175 in bounded parallel outputs. | None | 0 | Canonical Knowledge Index. |
| C0073 | 1R | knowledge router reread | Read previously truncated lines 701-800. | None | 0 | Full canonical Knowledge Index now consulted. |
| C0074 | 1R | pre-edit preamble | Print pwd/branch/status, run read-only preflight, and extract exact founder/cutoff ticket text. | None | 0 | Preflight PASS in read-only mode. |
| C0075 | 1R | scoped preflight | Run edit-mode preflight with the six handoff targets and reread ledger/state/log. | None | 1 | Script defect: empty tracked-files array dereferenced under nounset at line 227; no tracked dirt. |
| C0076 | 1R | manual dirty triage | Inspect preflight source around the defect; independently prove zero tracked diff and only the authorized handoff tree untracked. | None | 0 | Scope is task-related and non-overlapping. |
| C0077 | 1R | decision source read | Read Decision 001 and the exact Decision 002/cutoff source text. | None | 0 | Founder attachments. |
| C0078 | 1R | resume requirement read | Read resume requirements through baseline requirements. | None | 0 | Resume attachment. |
| C0079 | 1R | entitlement evidence read | Locate exact deferral deliverable requirements and existing Wave 1 entitlement findings. | None | 0 | Resume ticket and Wave 1 evidence. |
| C0080 | 1R | timestamp read | Record current UTC and America/New_York timestamps for the resumed state. | None | 0 | `2026-07-14T00:25:32Z`. |
| C0081 | 1R | authorization ledger write | Record Founder Decision 002 verbatim, the T0/T1 cutoff, D9-416 deferral, ledger resolution, and resumed run state. | Authorized handoff files only | 0 | This handoff. |
| C0082 | 1R | authorization verification | Diff the Decision 002 artifact against the exact ticket text, parse resumed JSON, check status, and advance the plan. | None | 0 | Verbatim decision match; valid run state. |
| C0083 | 2 | phase requirement read | Reload exact original Phase 2 snapshot requirements and exclusions. | None | 0 | Original D9-415 attachment. |
| C0084 | 2 | ignore-boundary read | Inspect `.gitignore` behavior for raw forensic material and handoff JSON. | None | 0 | Raw non-Markdown handoff evidence is ignored by default. |
| C0085 | 2 | snapshot tooling write | Create a read-only remote manifest emitter and local snapshot verifier in the ignored evidence area. | Authorized evidence files only | 0 | Snapshot helper scripts. |
| C0086 | 2 | readiness validation | Add missing `awk` prerequisite, syntax-check both helpers, prove snapshot path absent, and verify remote read-only tools/roots. | Snapshot helper only; no production write | 0 | `REMOTE_SNAPSHOT_READINESS=PASS`. |
| C0087 | 2 | T0/copy/T1 snapshot | Capture T0, stream one inbound tar copy, capture T1, compare normalized manifests, and run local verifier. | Local forensic snapshot/manifests only | 1 | T0/T1 identical; local verifier stopped on mode-only mismatch caused by macOS tar plus `umask 077`. |
| C0088 | 2 | stopped-state diagnosis | Inspect only generated manifest metadata, file counts, completion markers, and local root presence. | None | 0 | Both manifests complete; local copy present. |
| C0089 | 2 | mismatch classification | Prove all 287 local mismatches are mode-only and T0/T1 compare identical; record T1 completion. | None | 0 | No path/type/content mismatch. |
| C0090 | 2 | local mode normalization | Restore copied file/directory modes mechanically from T0 without a production read; rerun full local verification. | Local snapshot metadata only | 0 | 287/287 entries, zero mismatches. |
| C0091 | 2 | inventory discrepancy triage | Cross-check the 125-file plugin count, preserved mtimes, prior D9-410 evidence locations, and local source candidates. | None | 0 | T0/T1 and independent count agree at 125. |
| C0092 | 2 | local provenance comparison | Compare sealed plugin hashes/path sets against current local and F1 Drill candidate trees without printing content. | None | 0 | No candidate is a complete match; direct sealed snapshot remains authority. |
| C0093 | 2 | cutoff ledger write | Mark T0/T1 quiescent, document the local mode correction and Wave 1 count supersession, and advance run state to local safety scans. | Authorized handoff files only | 0 | This handoff. |
| C0094 | 2 | scanner availability/status | Parse run state, check dedicated scanner availability, and prove raw snapshot/manifests are ignored. | None | 0 | No dedicated scanner installed; raw source isolated. |
| C0095 | 2-3 | path-only safety scan | Scan full snapshot for forbidden filenames, high-confidence secrets, credential literals, emails, and binary types without printing matches. | None | 0 | One Webex library marker candidate; no forbidden data file. |
| C0096 | 2-3 | redacted candidate fingerprinting | Record rule, path, line, length, and digest for high-confidence/credential candidates only. | None | 0 | PKCS#8 validation marker and schema labels only. |
| C0097 | 3 | redacted context review | Render value-redacted contexts for flagged Webex library candidates. | None | 0 | False positives; no secret body/value. |
| C0098 | 3 | MU candidate census | Hash seven Wave 1 candidates and discover filename/content-related top-level MU candidates. | None | 0 | Exact candidate hashes confirmed; additional related controls identified. |
| C0099 | 3 | MU filename list | List the eight filename-discovered candidates. | None | 0 | `missionmed-hq-route-proxy.php` analyzed but not automatically included. |
| C0100 | 3 | static extractor attempt | Extract MU definitions/includes/hooks. | None | 1 | One-off regex used a misplaced inline flag; no file write. |
| C0101 | 3 | corrected static extraction | Extract definitions, includes, hooks, filters, and REST registration from ten candidate files. | None | 0 | Runtime roles mapped. |
| C0102 | 3 | full top-level keyword map | Map Matrix/Student OS/hub/Scheduler/auth/session/app references across every top-level MU PHP file. | None | 0 | Candidate boundary narrowed by source evidence. |
| C0103 | 3 | prior authority reconciliation | Re-read D9-410 MU ownership/census evidence. | None | 0 | Named protected components and backup risk confirmed. |
| C0104 | 3 | persisted plan reconciliation | Re-read D9-415 plan and Wave 1 MU candidate/closure rules. | None | 0 | Seven candidates were explicitly pending full closure. |
| C0105 | 3 | route/asset literal analysis | Extract only route/asset/Matrix-related literals from additional candidates. | None | 0 | DrJ access directly locks Matrix routes; performance file preserves exact Matrix assets. |
| C0106 | 3 | direct dependency analysis | Extract include/class/function-existence relationships. | None | 0 | Matrix account loads hub reskin; DrJ access consumes Arena proxy functions. |
| C0107 | 3 | external-function closure | Distinguish self-defined versus external optional function references. | None | 0 | `arena-route-proxy.php` is the required custom provider. |
| C0108 | 3 | redacted scanner write | Add deterministic metadata-only source scanner. | Authorized ignored evidence helper only | 0 | No matched value emission. |
| C0109 | 3 | selected-source scan | Scan complete plugin plus ten-file candidate closure. | Generated safe JSON only | 0 | 135 files; candidates require redacted review. |
| C0110 | 3 | candidate disposition review | Produce redacted structural contexts for entropy/email/private-data/credential candidates. | None | 0 | Static paths/URLs/selectors/examples/support addresses only. |
| C0111 | 3 | email classification | Classify hard-coded emails as owned/reserved/external and role/non-role without printing addresses. | None | 0 | Institutional, reserved examples, or static placeholder. |
| C0112 | 3 | placeholder verification | Verify the one external email is inside a form placeholder. | None | 0 | Not live user/student content. |
| C0113 | 3 | binary safety extension | Extend scanner to ASCII-preserving checks on binary assets; rerun. | Scanner helper and safe JSON only | 0 | Zero binary secret/email candidates. |
| C0114 | 2-3 | report generator write | Add mechanical generator for full plugin/MU manifests, graph, exclusion register, and scan report. | Authorized evidence helper only | 0 | Source values not emitted. |
| C0115 | 2-3 | snapshot report generation | Generate/parse manifests and verify counts, controller, backup equality, and selected names. | Authorized handoff reports only | 0 | 125 plugin files; ten MU files; 116 unrelated MU files excluded. |
| C0116 | 4 | destination census | Inspect tracked WordPress paths and selected destination preimages. | None | 0 | Plugin absent; four selected MU paths tracked with older bytes. |
| C0117 | 4 | Matrix guard interface read | Read guard help and preflight options. | None | 0 | Non-deploying `--skip-production` path identified. |
| C0118 | 4 | protected asset list | List ten active protected asset keys/hashes. | None | 0 | Active controller lock remains `c0a538...`. |
| C0119 | 4 | guard behavior read | Read preflight return/warning behavior and confirm no CI use of broad override. | None | 0 | Split validation chosen. |
| C0120 | 4 | split guard validation | Run nine unchanged assets and isolated controller against sealed snapshot. | Generated safe reports only | 1 | Reports correct; summary assertion expected a different warning phrase. |
| C0121 | 4 | guard report diagnosis | Read the two local guard reports. | None | 0 | Nine assets PASS; controller-only warning is exact Decision 002 drift. |
| C0122 | 4 | guard exception verification | Validate exact report phrases/hash and prove broad override was not used. | None | 0 | Decision 002 exception applied only to controller. |
| C0123 | 4 | product edit preflight | Run scoped preflight for plugin and ten MU paths using an empty-array workaround attempt. | None | 1 | Bash 3.2 empty-array defect persists after correct zero-tracked-dirt report; manual triage clean. |
| C0124 | 4 | exact baseline import | Copy sealed plugin and ten selected MU files into product paths; verify every hash/mode/path and rerun identical tracked-tree scan. | Authorized product-tree source only | 0 | 133 plugin entries and ten MU files exact; no symlinks. |
| C0125 | 4 | baseline syntax validation | Run PHP syntax on 62 files, JS syntax on 30 files, and JSON validation. | Safe reports only | 0 | All PASS. |
| C0126 | 4 | baseline ledger update attempt | Update resolution ledgers/evidence/run state. | None | 1 | Atomic patch rejected on a historical synthesis anchor; no partial write. |
| C0127 | 4 | patch anchor diagnosis | Read actual synthesis tail and verify no partial changes. | None | 0 | Correct anchor identified. |
| C0128 | 4 | baseline ledger update | Resolve snapshot/scan risks, record ten-file closure, refresh evidence index/run state, and prepare D9-415A. | Authorized handoff files only | 0 | This handoff. |
| C0129 | 5 | baseline commit/tag | Create D9-415A and annotated non-deployable baseline tag after staged-tree verification. | Local Git objects/ref only | 0 | Commit `c340a3a...`; tag object `6e2f5e3...`. |
| C0130 | 6 | source quarantine | Move the executable backup byte-identically to forensic storage; add intended-active manifest/validator/report; create D9-415B. | Authorized source/forensic/docs only | 0 | Commit `9469437...`. |
| C0131 | 7 | provenance reconciliation | Generate hash map, source lock, implementation-home records, CSS/controller rollback evidence, and D9-415C. | Authorized branch-local provenance only | 0 | Commit `e12cd99...`. |
| C0132 | 8 | deterministic pipeline | Add package policy, builder, validator, workflow, reports; validate two identical builds; create D9-415D. | Authorized validation/CI/docs only | 0 | Commit `a81a3af...`. |
| C0133 | resume | canonical worktree recovery | Locate the existing D9-415 worktree after the app opened D9-410; verify branch/origin/history/status. | None | 0 | Existing A-D sequence found clean; no duplicate work. |
| C0134 | resume | mandatory state reload | Re-read decision ledger, plan, command log, evidence index, Wave 1 synthesis, risk/conflict registers, and execution report. | None | 0 | Persisted evidence accepted. |
| C0135 | 8 | independent A-D verification | Verify tag annotation/target, controller/backup/rollback hashes, commit separation, and rerun full validator. | Temporary local validation output only | 0 | Package SHA `afd9a1...`; all checks PASS. |
| C0136 | 9 | Wave 2 orchestration | Run exactly four new read-only reviewers: provenance; security/data; reproducibility/CI; release/rollback. | No filesystem/external mutation by reviewers | 0 | 4/4 complete. |
| C0137 | 9 | finding verification | Inspect builder, validator, policy, workflow, and trusted input hashes; reproduce three fail-closed P1 findings. | None | 0 | Main-agent adjudication accepted P1s. |
| C0138 | 9 | D9-415E edit | Seal trust anchors, require PHP/Node/counts, cover scanner/hash-map paths, pin checkout, and disable persisted credentials. | Three authorized validation files | 0 | Diff limited to workflow/builder/validator. |
| C0139 | 9 | E precommit validation attempt | Create detached temporary candidate worktree and run validator. | Temporary worktree only | 1 | Stopped before validation because zsh `status` is read-only; temp worktree removed exactly. |
| C0140 | 9 | E precommit validation | Recreate detached candidate with neutral return-code variable; run full matrix. | Temporary worktree/package outputs only | 0 | PASS; identical package builds. |
| C0141 | 9 | missing-tool fail-closed test | Run syntax validator with PHP/Node excluded from PATH. | Temporary output only | 0 | `MISSING_TOOL_FAIL_CLOSED=True`. |
| C0142 | 9 | review-fix commit | Create non-empty D9-415E. | Local Git commit only | 0 | Commit `030fe107...`; three files. |
| C0143 | 9 | E postcommit validation | Run full validator at clean real E commit. | Temporary package/report output only | 0 | PASS; trust anchors sealed. |
| C0144 | 9 | dedicated branch review | Compare origin/main...E, verify ancestry/runtime drift/protected scope/tag/rollback and classify immutable whitespace exception. | None | 0 | Zero unresolved P0/P1. |
| C0145 | 9 | branch-wide redacted scan | Scan 211 changed files without emitting matched values. | Temporary safe JSON only | 0 | Only previously reviewed candidate groups. |
| C0146 | 9 | fresh clone validation | Clone local canonical repository with `--no-local`, checkout branch, run full validator, check clean state. | Temporary clone/output only | 0 | PASS at E. |
| C0147 | 10 | GitHub prerequisites | Verify `gh` version/auth, repo/default branch, and absence of an existing PR. | None | 0 | Authenticated as repository owner. |
| C0148 | 10 | branch/tag publication | Push recovery branch and immutable tag. | Authorized GitHub refs only | 0 | Remote E branch and tag created. |
| C0149 | 10 | remote verification | Compare remote branch SHA, tag object, and dereferenced tag commit to local refs. | None | 0 | Exact equality. |
| C0150 | 10 | draft PR creation | Use connected GitHub app to open draft DO NOT MERGE PR #9. | Authorized draft PR only | 0 | `https://github.com/brinyu13/missionmed-hq/pull/9`. |
| C0151 | 10 | hosted CI verification | Inspect PR checks and workflow run. | None | 0 | Run `29301277578`; `validate-source-only` SUCCESS. |
| C0152 | 11 | final report authoring | Create Wave 2, dedicated review, test, D9-416 input, final state/verdict/attestation/risk/conflict/execution artifacts. | Authorized handoff only | 0 | D9-415F candidate. |
| C0153 | 11 | final combined assembly | Generate source manifest and one combined Markdown with required deliverables verbatim plus evidence appendices. | Authorized handoff only | 0 | 34 required + 5 supplemental Markdown sources; byte verification PASS. |
| C0154 | 11 | final closeout | Detached candidate validation, D9-415F commit/push, final remote/CI/mirror/activity-log checks. | Authorized Git/GitHub/mirror/log only | SELF-REFERENTIAL EXTERNAL VERIFICATION | Exact final hashes are recorded after the commit in the canonical activity log and final response. |
| C0155 | 11 | detached F candidate attempt | Regenerate the manifest/combined handoff in a clean temporary commit worktree before committing F. | Temporary worktree only | 1 | Fail-closed: the clean checkout omitted an ignored Python bytecode cache that the first manifest had accidentally inventoried; no commit or external mutation occurred. |
| C0156 | 11 | generator inventory hardening | Restrict final inventory and Markdown accounting to Git-tracked handoff files; reject missing, non-file, or symlink entries. | Handoff generator only | 0 | Ignored caches and raw forensic material cannot influence deterministic output. |
| C0157 | 11 | corrected final assembly | Regenerate the file manifest and combined handoff from the tracked-only inventory. | Authorized handoff only | 0 | 72 non-recursive source files; 34 required + 5 supplemental Markdown sources; verbatim verification PASS. |
| C0158 | 11 | detached F candidate validation | Recreate the temporary commit/worktree; parse all JSON, rerun the generator, require zero diff, run the full sealed validator, and require a clean checkout. | Temporary worktree/package outputs only | 0 | PASS; combined output reproduced byte-for-byte; package unchanged at `afd9a1e6...`; final combined hash is recorded externally to avoid self-reference. |
<!-- END VERBATIM FILE: D9_415_COMMAND_LOG.md -->

<!-- BEGIN VERBATIM FILE: D9_415_SUBAGENT_WAVE_1_SYNTHESIS.md -->
# D9-415 Subagent Wave 1 Synthesis

Ticket: `D9-MATRIX-PLAN-415`  
Wave status: **4/4 COMPLETE**  
Mode: four independent read-only specialists; main-agent synthesis  
Snapshot authorization: **BLOCKED AT IMPORT BOUNDARY**

## Converged finding

All four agents independently support the same disposition: D9-415 has a valid repository/base/worktree and can identify the active plugin/MU runtime, but it must not snapshot, import, commit, tag, package, push, or attest source while a protected production controller differs from the active Matrix lock and changed after that lock's validation.

Direct production observation at `2026-07-13T19:22:45Z` found:

- production `includes/class-mmed-student-os.php`: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`;
- active lock: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`;
- production mtime: `2026-07-13T18:52:21.956329834Z`;
- manifest validated: `2026-07-13T14:55:56Z`.

Main-agent local verification established that `23da5c...` is exactly the Y1-CAM-4005 candidate and `c0a538...` is exactly its pre-change backup/Y1-CAM-4004 source. The new candidate changes entitlement evaluation, so this is not harmless metadata drift.

## Production plugin root

`/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`

Observed complete metadata inventory: 123 files, eight directories including root, all files `0644`, directories `0755`, no symlinks/special entries. No content was copied. Until dependency analysis and local secret scanning are complete, the exact baseline inclusion set is all 123 files.

## Matrix-related MU dependency set

Confirmed required/import candidates pending full closure and secret scanning:

- `missionmed-matrix-account-entry.php` — `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba`;
- `missionmed-hq-auth-handoff.php` — `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3`;
- `missionmed-hq-proxy.php` — `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3`;
- `missionmed-supabase-session-cookie-auth.php` — `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f`;
- `mm-scheduler-webex-broker.php` — `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455`;
- `missionmed-mr-legacy-popup.php` and executable byte-identical backup `missionmed-mr-legacy-popup_BACKUP_PRE004.php` — backup SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`;
- directly required includes discovered from these files and hub bootstrap, after exact closure is revalidated at the quiescent snapshot cutoff.

WordPress auto-loads every top-level filename ending `.php`; therefore the backup is active regardless of its name.

## Snapshot inclusion and exclusion rules

Pending authority clearance:

- Exact observed plugin baseline: include all 123 production files, unchanged.
- MU baseline: include only proven Matrix dependency closure, including the unsafe backup exactly as observed.
- Exclude logs, caches, uploads, sessions, temp files, DB exports, user/private data, credentials, environment files, keys, authorization material, and unsafe symlinks.
- No such excluded category was identified by plugin-root filename/metadata, but content-level scanning has not occurred.
- Seemingly non-runtime docs/prototypes/duplicates/test files remain in the immutable exact baseline unless direct dependency and provenance evidence permits a documented exclusion. Packaging may exclude them later; D9-415A may not.

## Secret-scan and student-data status

- Filename/metadata scan: no obvious secret/data file in the plugin root.
- Content-level secret/high-entropy scan: **NOT RUN — NO LOCAL SNAPSHOT AUTHORIZED**.
- Student/private-data scan: **NOT RUN — NO LOCAL SNAPSHOT AUTHORIZED**.
- Status: **PARTIAL / BLOCKING BEFORE IMPORT**.

No secret, credential value, cookie, request payload, option value, environment value, or student data was printed or filed.

## Git provenance status

- Canonical recovery repo/branch/worktree/base are proven.
- No existing commit, branch, or tag contains the complete current production plugin.
- Remote `main` contains zero plugin files.
- The historical Matrix branch and known-good tag are not current source authority.
- Current production must be imported directly after clearance; local exports and objects are supporting provenance only.

## Exact-hash validation plan

After exact authority and a quiescent cutoff:

1. One minimal before-check of the disputed controller and snapshot root.
2. Atomic/non-symlink-following plugin and targeted MU snapshot.
3. Immediate after-manifest; abort if any entry changes.
4. Local redacted secret/private-data scan before product-tree copy.
5. Complete path/type/mode/size/SHA-256/MD5 classification.
6. Protected current and historical D9-410 hash mapping, explicitly distinguishing changed shell bytes.
7. Git blob OID plus SHA-256 for every baseline file.
8. `git ls-tree`, `git cat-file`, archive/fresh-checkout, and remote-ref verification.

## Packaging and CI plan

- Stdlib-only, tracked-source-only deterministic packager.
- Clean-tree requirement; canonical path ordering, modes, timestamps, metadata, version, file manifest, commit/branch/package SHA-256.
- Two independent temp builds must be byte-identical.
- CI least privilege/read-only, no secrets/environments/network production checks, no deploy/upload/cache/DB/WordPress/flag action.
- Never use `matrix_runtime_guard.py --brian-approved` as a CI pass condition.
- Backup scan must target the recovered Matrix MU set without broadening scope to unrelated inherited files.

## Rollback and release plan

- D9-415A and its immutable non-deployable tag preserve exact observed bytes, including the unsafe backup.
- D9-415B would preserve that backup unchanged outside autoload source and remove only the active source-path copy.
- Preserve current Calendar CSS `6e519195...` and former lock CSS `41b3a295...` as separate evidence.
- No production rollback/deploy is performed.
- Scheduler CDN HTML remains mutable/unpinned and is a D9-416 authority requirement.

## Material conflicts

1. `class-mmed-student-os.php` production/active-lock mismatch.
2. The observed production byte exactly matches Y1-CAM-4005 and alters entitlement logic.
3. Production appears to have changed during the recovery window; no quiescent cutoff is established.
4. Current active lock is itself an uncommitted protected-root change and cannot supply cloneable Git provenance.
5. Production auth handoff also has a current-day change and differs from tracked local source.

## P0 blocker and stopping boundary

The affected write phase is blocked under BOOT, Matrix lock, Critical Systems, and ticket hard-stop rules. No generic or inferred override is sufficient. Required resolution must explicitly identify:

- ticket `D9-MATRIX-PLAN-415`;
- controller production hash `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`;
- active-lock hash `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`;
- whether Y1-CAM-4005 production behavior is authorized/intended;
- the exact no-further-write/quiescent production cutoff;
- permission to recover the exact observed bytes despite the active-lock mismatch, without changing production.

Until then:

- forensic source copy: BLOCKED;
- product-tree import: BLOCKED;
- D9-415A/tag and later commits: BLOCKED;
- packaging/Wave 2/publication/handoff completion: BLOCKED;
- production/database/cache/flag mutations: ZERO.

## Main-agent decision

Wave 1 is complete but does **not** authorize a production snapshot. The correct current verdict is `BLOCKED AT PHASE 1`. Earlier handoff/evidence work is preserved; the run may resume from `D9_415_RUN_STATE.json` after exact authority resolution.

## Resume resolution under D9-415-FOUNDATION-002

Founder Decision 002 explicitly authorized controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` for current-observed-source recovery while preserving `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` as historical/rollback evidence and deferring behavior to D9-416. Identical T0/T1 manifests at `2026-07-14T00:31:00.453619187Z` and `2026-07-14T00:31:03.315562100Z` established the quiescent cutoff.

The complete manifests corrected Wave 1's plugin count from 123 to 125 files. The final source-evidenced Matrix MU closure contains ten files: the seven originally confirmed candidates plus `missionmed-drj-drills-access.php`, its direct custom-function provider `arena-route-proxy.php`, and `missionmed-performance-boost.php`, which explicitly preserves the exact Matrix asset version paths. Content-level redacted scanning passed before import.
<!-- END VERBATIM FILE: D9_415_SUBAGENT_WAVE_1_SYNTHESIS.md -->

<!-- BEGIN VERBATIM FILE: D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.md -->
# D9-415 Production Plugin Snapshot Manifest

- Production root: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`
- T0 completed: `2026-07-14T00:31:00.453619187Z`
- T1 completed: `2026-07-14T00:31:03.315562100Z`
- Quiescence: `PASS — IDENTICAL T0/T1`
- Files: `125`
- Directories: `8`
- Symlinks/special entries: `0`
- D9-415A exclusions: `0`
- Safety rule: every entry is included byte-for-byte in the immutable observed baseline; non-runtime residue may be excluded only from later deployable packages.

| Relative path | Type | Bytes | Mode | SHA-256 | MD5 | Classification |
|---|---:|---:|---:|---|---|---|
| `.` | `d` | 11 | `755` | `-` | `-` | directory |
| `CHANGELOG.md` | `f` | 5831 | `644` | `082428d9398fba549700c9f479caf21fad6054354237fddc68ecd303f2dc5f1e` | `fbfefa3d3effff5859f8adb33374246f` | report |
| `MULTI_DIVISION_DASHBOARD_INTEGRATION.md` | `f` | 1874 | `644` | `28e1687a54b6881d887a3e6008ba1a2f05f3228a120dc01fe31fd056b2113cd2` | `1a9630308cdcc85bf715f28b0a98837f` | report |
| `WEBEX_WIDGET_RESEARCH.md` | `f` | 6047 | `644` | `cc5be759724ac83d215e063d161d2cf6db3d8e2fe743e307129fbc1ccc69d379` | `3137119867bd166d5ef3e41b64fc7bfb` | report |
| `assets` | `d` | 58 | `755` | `-` | `-` | directory |
| `assets/admin-analytics.css` | `f` | 1596 | `644` | `626a3fbf0d37cfe87ac76df53bc16137a5280c5d81a240a798d72faebabd0487` | `c586e5e450d2cd0ee1e4482d36594039` | runtime-required built asset |
| `assets/admin-analytics.js` | `f` | 7375 | `644` | `349c824d3dadbe117300e57426c7d53360f4ab7a43b8144671d92d085ea0ee4c` | `7ba6179a75498d50028a5b5ac5ac83a6` | runtime-required built asset |
| `assets/admin-arena-battles.css` | `f` | 3286 | `644` | `aba6464bd718a34590752e93d42ef6271284a2b5b104624d373355079e353e7a` | `0f8845fbd4ac128346d9b3ce2530e72c` | runtime-required built asset |
| `assets/admin-arena-battles.js` | `f` | 16623 | `644` | `aa04fecdc1fb49546ffc1b906dc39b502f9cb4a08459fc34b079f9d19ec7a3f0` | `adf474eb495570f45b56d2a7c963dc86` | runtime-required built asset |
| `assets/admin-office-hours.css` | `f` | 3038 | `644` | `ff3525f6247f0c811c560fb56b32ffe9e9ae83cb07c821668ce30e02aa8e463d` | `148d33457f227f0237e5596c9641c1bf` | runtime-required built asset |
| `assets/admin-office-hours.js` | `f` | 10163 | `644` | `c8c42b9cbeb0c1d4aa2bd03793efcec97e1056e7b5f5e605cbf4ddbf622c86e2` | `401bd7f5c477e2076b8bd3ef3dea4e1c` | runtime-required built asset |
| `assets/admin-os.css` | `f` | 74869 | `644` | `ec212f42fd3bd23923a27775700f8790cae8dba401cdf4d80ea69afcbba58133` | `fe15599e85175068019b2de9b075de50` | runtime-required built asset |
| `assets/admin-os.js` | `f` | 273225 | `644` | `9a0289b52079f0425d68a070d7f999f0813ff793206f9b582f61bb300faff7c5` | `7b80044ccb5aaddd705f48e91529de30` | runtime-required built asset |
| `assets/admin-session-manager.css` | `f` | 7183 | `644` | `3b8edc9d79fffb64b520a3ec5db07eae7c23584884f930aec61fa61f518dd48a` | `72e3bc7795ac8b9cf882276867da2f2f` | runtime-required built asset |
| `assets/admin-session-manager.js` | `f` | 25850 | `644` | `4922ea7ce021fc06a0ac9bed467bb5ffb573ea1b9f7eb02f2f4894960562c049` | `3b09ebe13ecd1566859d45c8180ecb9e` | runtime-required built asset |
| `assets/admin-sources` | `d` | 6 | `755` | `-` | `-` | directory |
| `assets/admin-sources/matrix-calendar-prototype-v4.html` | `f` | 94362 | `644` | `a3088d61a1294a70882bfadcc66ddb7365ec86d1ea91bc2977cd5b892aa9c131` | `85b16e3541a8ab177dba467d92cb3a95` | generated but runtime-adjacent |
| `assets/admin-sources/mx-filevault-006d-nexus-clarity-final-demo.html` | `f` | 77438 | `644` | `a4b74d1479ebb2e9fb4d048ee2ff2883c0d3c4430d978c7723e0c90254837575` | `22f081635245270b97e811fd2c26899f` | generated but runtime-adjacent |
| `assets/admin-sources/scheduler-admin-source.html` | `f` | 132681 | `644` | `dd96fbaca1ab8fadb6c7f894fe10626a51112c7c8a26b49b49e00d0e17b8c51c` | `73f6e79508dd3dc7a84314deca1067e7` | generated but runtime-adjacent |
| `assets/admin-sources/storyforge-admin-source.html` | `f` | 85688 | `644` | `2c9d368d8d2acb5eb9d90cd7f93c876ade52b6ec169dbbe47acd0e125f430c02` | `5d7158e014240b7338e406d44452b266` | generated but runtime-adjacent |
| `assets/admin.css` | `f` | 7814 | `644` | `140875566f72fd9e09bdb2a6a078760455f1c7cbbcff6f93a4fd18bb620a935c` | `92fa6a60c3410363c28a05ec7809a1fe` | runtime-required built asset |
| `assets/admin.js` | `f` | 2961 | `644` | `eb518c007c04f456dff88bbd6c64c83423d843193a5ceeada2efb82df96cb693` | `a5191c5b49b55b785dbb567c2f15672b` | runtime-required built asset |
| `assets/daily-drills-live-webex-embed.js` | `f` | 45645 | `644` | `bfcb542b0034e6872da00b547806fe872a5aa0e2cd7165254fe921af283f0575` | `87096fa71de740b15736d345cd7203e4` | runtime-required built asset |
| `assets/daily-drills-live-webex-preview.html` | `f` | 39541 | `644` | `a3224c7df50f35ccbbda8ab53a358e64032da8c2c960c8fce6be0f3e6fcfdae4` | `640d24c75d7d90c319479040fe5b4841` | unknown |
| `assets/daily-drills-live-webex-sdk-v3.js` | `f` | 159267 | `644` | `3c40979791673333706bc7fa1fa536c33f35a0b258cebc3330342c962699edaa` | `bf48d234a708946615ed45c1f796ca2e` | runtime-required built asset |
| `assets/daily-drills-live-webex-v3-embed.js` | `f` | 54721 | `644` | `036897b3f3ef8d381383225a81178362dd6cc052bd6144d64129232edafe552f` | `e203c73cf917cefaeb1b19f15e960059` | runtime-required built asset |
| `assets/daily-drills-live-webex-v3.html` | `f` | 7228 | `644` | `ce5c606dfa55671c21334041c2bc5e59cb49d2b949d9e0008187b6402dbe0f4b` | `ae0a4aac5b3dbe30b08380bebbec1db6` | unknown |
| `assets/daily-drills-matrix-entry.js` | `f` | 4744 | `644` | `fd1692ce0ed149a5d975e2d80a4965a05281df0db05287b79e0ece5d5b4ba67d` | `863a0700ac7a3cd2aa83ffe6a9ffe5a3` | runtime-required built asset |
| `assets/daily-drills-team-challenge-sdk-tiles.inactive.js` | `f` | 1493 | `644` | `3a9af5fd2e86a5b75c6d76c5c3df66bde6895495487315b8ee5e6c7c50f7d6b1` | `62ee7e4af247671691f65ae9a1db9825` | runtime-required built asset |
| `assets/daily-drills-team-challenge-v3-action.php` | `f` | 12666 | `644` | `b8e0023ee44c65d9373a5354965df765558fad4fcbb661bc1f0d61bc265f945b` | `38f316acba1ff68efebc12601a8c0668` | runtime-required source |
| `assets/daily-drills-team-challenge-v3-autojoin.js` | `f` | 224640 | `644` | `bb0424e429b043ee911b61744ad7e54ba18cd55e0fbce047e129f80f4cb12a72` | `812f0a63301e4cc0f06526ca6fb8da73` | runtime-required built asset |
| `assets/daily-drills-team-challenge-v3-studentflow.js` | `f` | 268275 | `644` | `c26cf6777b3390638e42cc381e57ce1d2c8d8cbf68953d184fd5174425b85678` | `3b739353faf00c01babb9cd233d27e87` | runtime-required built asset |
| `assets/daily-drills-team-challenge-v3-worker.js` | `f` | 4282 | `644` | `721ef0a79d3fe5a91d28e27aa28db903d86babcf7b3ed3e102b0fb91aa2ab6c7` | `7884bb140d0beabb71f042d5fa2affb2` | runtime-required built asset |
| `assets/daily-drills-team-challenge-v3.js` | `f` | 222304 | `644` | `2fd945408c5266827f20b6bd5762cd195e7905d57a70dc1cfb39be656e892ad4` | `07bedefc6fc861ca758e73af095e3c60` | runtime-required built asset |
| `assets/daily-drills-team-challenge.js` | `f` | 111953 | `644` | `65ddd863a4ef820a802a34cbc5cb110c3c1315b0c2f5bf9ecd965b3ce0971ebe` | `a6d92be35d512faa9b25c16b47e5801f` | runtime-required built asset |
| `assets/email` | `d` | 3 | `755` | `-` | `-` | directory |
| `assets/email/360-name-brush-underline.png` | `f` | 14674 | `644` | `e9649a9b85651c6e847fdff3df7ab40f5878a626c9d29aacd0d0ad85f64c6180` | `c143f3c71a0bb4beeb781ea0f099fff8` | runtime-required built asset |
| `assets/hub.css` | `f` | 67706 | `644` | `f7dfd2eaf6e2ea80b16f20a634ff0730ce3c557d3d3fffd218adb9a3e1bcd62a` | `35c8795d2f0ecf55bb39191e31fa97e7` | runtime-required built asset |
| `assets/hub.js` | `f` | 39699 | `644` | `a810b4ec34e0e52919f4d5596727da50ceab72941c05c15fc1c0891ad28d0338` | `fcdb9b5f07736ea8d69bc8b792571ba0` | runtime-required built asset |
| `assets/learndash-reskin.css` | `f` | 65560 | `644` | `c989f761b4d0e15031e51d1d3e2421316c69f3878c2d59aadd679e8c9d2e15b9` | `5b0e12c261f691bbc48d05f63d8ed247` | runtime-required built asset |
| `assets/mmed-webex-widget-adapter.js` | `f` | 4963199 | `644` | `f6a3205fb28998a797892446374d9f298484a9c361d582a73e1f8320a7c82427` | `69d4d99a41473f49ff06590f2ace1c94` | dependency/vendor |
| `assets/scheduler-mount.js` | `f` | 61339 | `644` | `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578` | `6f99268709b0be5cbc0729a050017665` | runtime-required built asset |
| `assets/student-os-arena-battle.css` | `f` | 5746 | `644` | `981eacc2e9daab5b3dedf760217163774745fb375bcb922b25a02b3a1f833c12` | `a22f8088141e1ce457bb128aa4c70644` | runtime-required built asset |
| `assets/student-os-arena-battle.js` | `f` | 13143 | `644` | `f2659f15075101ace42d0eec8475a0e7ecfad14f5103e24f4c2aaa9b9ca5e435` | `bf2f3143f1b9457ecc2522ae129f9715` | runtime-required built asset |
| `assets/student-os-calendar-v4.css` | `f` | 67041 | `644` | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | `ea26e38e505b2e3a72792de85236674e` | runtime-required built asset |
| `assets/student-os-calendar-v4.js` | `f` | 102614 | `644` | `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa` | `a7f658b2767898ab2cd39025fdf80afb` | runtime-required built asset |
| `assets/student-os-drill-game.css` | `f` | 2720 | `644` | `c6edb0de1ead9cdc1097120d34cfd67dd98be1ae694d1b1f01c6eb02bdc80941` | `1caf681d509d401bb22ec2e6978ec704` | runtime-required built asset |
| `assets/student-os-drill-game.js` | `f` | 6248 | `644` | `fa773a158a865d580bfd89e80d8753d32a15e5539afd274da9e258f734070def` | `2071f76099b3ce7afcd1506308cc1d92` | runtime-required built asset |
| `assets/student-os-file-vault.css` | `f` | 74647 | `644` | `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990` | `5a54803a326dee160833bdbf61b1112c` | runtime-required built asset |
| `assets/student-os-file-vault.js` | `f` | 57912 | `644` | `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` | `67840a1ebff6efde090ec5ae2f345a57` | runtime-required built asset |
| `assets/student-os-interview-prep.css` | `f` | 6880 | `644` | `5d6a70c798f6eb86e9a59cb3c5164550e037881a5cac3ac7cc472f4c6297d4f6` | `70e2b3f5f4c53063238e18cfbb0a35c1` | runtime-required built asset |
| `assets/student-os-interview-prep.js` | `f` | 20577 | `644` | `6623c792e4d1ef803707aa61dbf0fa3b90bec8e10f0b9fd6d209261d75ef2d8c` | `d00c33e0685b6823d2b15510fad7f38f` | runtime-required built asset |
| `assets/student-os-live-session.css` | `f` | 8512 | `644` | `4b782ec26b8d62b3988f68fc5b33a1adf018bdafc7b966c84a5dca1a33463e9b` | `e03d556a31994b5338b8a335acff7db5` | runtime-required built asset |
| `assets/student-os-live-session.js` | `f` | 25496 | `644` | `f4044fedc6785fb41494491f8bed8d974d584b06d54231b29594fdf4d9a64ec9` | `0a6e84b66d9321fd5c2f2e308eed57ba` | runtime-required built asset |
| `assets/student-os-office-hours.css` | `f` | 3096 | `644` | `c0006659376b3fb23929caef869c893cea8ec6bc6182ed3585c26177c4bfa5ce` | `e5a7b3395383394395d7a2b5c7689bd9` | runtime-required built asset |
| `assets/student-os-office-hours.js` | `f` | 7614 | `644` | `e75716caa9913d86795f134a1f846f60bd887e6df187d19babd67d9f00e717f4` | `6921139f3ea80675e3a6292fbfd5e2d3` | runtime-required built asset |
| `assets/student-os-storyforge.css` | `f` | 18092 | `644` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | `2daf3c3438ad0c8ca6b31662d4b9bffb` | runtime-required built asset |
| `assets/student-os-storyforge.js` | `f` | 27456 | `644` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | `cc064d4d3a96b29947a4bfcf2d713ca0` | runtime-required built asset |
| `assets/student-os.646e3598d284fff3.js` | `f` | 268367 | `644` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | `f0cb3d146415ac8f8698db2979627be4` | runtime-required built asset |
| `assets/student-os.css` | `f` | 211321 | `644` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | `5b4be0ffb308a1f60c7638c3982b1e27` | runtime-required built asset |
| `assets/student-os.js` | `f` | 268367 | `644` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | `f0cb3d146415ac8f8698db2979627be4` | runtime-required built asset |
| `assets/team-challenge-avatars` | `d` | 12 | `755` | `-` | `-` | directory |
| `assets/team-challenge-avatars/doctor-female-01.webp` | `f` | 28790 | `644` | `b8507e6767481e7ea9e0c753e6a266a578a18bdc48d5f60b30a06c5adf289373` | `bf49bd7925fdc0eb5e1aa019b6172650` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-female-02.webp` | `f` | 35434 | `644` | `fa813a4fa98dbf52913986e00a41cb0add2cd6c9eab11a18ba7af321a9aff652` | `31a25daf21cdf2e425c445dfa876dae3` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-female-03.webp` | `f` | 31038 | `644` | `1022f804c584a47d5da7c9fae38f7c2985480c6841d2bb34221bf6bb9c3ceff9` | `5cd4eb1ffcb739dccaefdefe9579259b` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-female-04.webp` | `f` | 41380 | `644` | `4aad2e17ebc33200c0fd468efd68a3797bf87b353be8315eec8a064ce09009e5` | `f800fd426d33e9dc90daa08b9f7fe418` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-female-05.webp` | `f` | 41380 | `644` | `4aad2e17ebc33200c0fd468efd68a3797bf87b353be8315eec8a064ce09009e5` | `f800fd426d33e9dc90daa08b9f7fe418` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-female-06.webp` | `f` | 45122 | `644` | `3da7fd6b5e943df584ab8bba7e3ffea98c896b821837175f0ec12dd0d474b055` | `64ab79a60fe22984ba35a60973c43889` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-male-01.webp` | `f` | 36108 | `644` | `19aea1c07e19bd728ae5dd7c0330306045a7ea2d39edf4f0c2e751e9bf27323c` | `be850ad8fadb69c6d894a0635e3911c0` | runtime-required built asset |
| `assets/team-challenge-avatars/doctor-male-02.webp` | `f` | 36108 | `644` | `19aea1c07e19bd728ae5dd7c0330306045a7ea2d39edf4f0c2e751e9bf27323c` | `be850ad8fadb69c6d894a0635e3911c0` | runtime-required built asset |
| `assets/team-challenge-avatars/superhero-female-01.webp` | `f` | 55028 | `644` | `cbf7c9a4d5d69a5c0ecde0ea15acb9826c805be1a433c88bfb73116dc7262ba7` | `b7d620cd5ed24e14cf6d9989902cc9f3` | runtime-required built asset |
| `assets/team-challenge-avatars/superhero-female-02.webp` | `f` | 45122 | `644` | `3da7fd6b5e943df584ab8bba7e3ffea98c896b821837175f0ec12dd0d474b055` | `64ab79a60fe22984ba35a60973c43889` | runtime-required built asset |
| `assets/test-deploy.txt` | `f` | 40 | `644` | `20df1d55eb703116a19d12d1f25573336b9382bc29b443977e7106681d69d27f` | `ea6aa3de96b9ccf99949c39ace0eb7b5` | unknown production residue |
| `assets/video-inserter.css` | `f` | 15183 | `644` | `a216e568fc0de765deed7613b20ead8374019a7714ac3a395c1f886ce0584d10` | `f21bdbb269f0aeeeb039e14aee7c6561` | runtime-required built asset |
| `assets/video-inserter.js` | `f` | 26962 | `644` | `5552f955467c846b98930d22e5438e07963fa97d4549b4caf33bd3b6e052335b` | `d7ea2a5b768dfb16fa8f1d4b59c4c32d` | runtime-required built asset |
| `assets/webex-widgets.css` | `f` | 93522 | `644` | `433c5ff2e7246f5379f81c31c2c6c0ed66205e80f495ceb7910d808dd404e41a` | `7e5ee8bfb32590d45e3c228b765359b1` | runtime-required built asset |
| `class-mmed-access-audit.php` | `f` | 45389 | `644` | `f70a434f7d1a0518dc4793f970efa911db6c5546070e91f36d6e282bec3d7d45` | `ee1b80cae2eff51c63a49f1e659bd5a7` | runtime-required source |
| `includes` | `d` | 48 | `755` | `-` | `-` | directory |
| `includes/class-mmed-access-audit.php` | `f` | 45389 | `644` | `f70a434f7d1a0518dc4793f970efa911db6c5546070e91f36d6e282bec3d7d45` | `ee1b80cae2eff51c63a49f1e659bd5a7` | runtime-required source |
| `includes/class-mmed-access-gate.php` | `f` | 19641 | `644` | `9a833ea0c061a28972c1db3454552b458ddebe8cc26f97768e8d9c24b8c3f514` | `a4614ab1e20945354c02df40368d4f5a` | runtime-required source |
| `includes/class-mmed-action-items.php` | `f` | 11123 | `644` | `1079ab31217ce26b3675a96b0e9139eeb659be8f6e20d7afbf8949c493340023` | `585418e424f467b7fae8703e5221ef10` | runtime-required source |
| `includes/class-mmed-admin-os.php` | `f` | 7423 | `644` | `2669cd8af849c8fb6a96988b6b3cf9691d98d6c8114abffbe7d1fa22dd166891` | `f2c442af1bdcbf8c45f4fedcdf2e4b18` | runtime-required source |
| `includes/class-mmed-arena-live.php` | `f` | 38100 | `644` | `436343f4f03f493c2dfe01981d68a5864f8bbc429e00bf1fe89f55e1ae6c7ccc` | `ff970c58f8b60acc25eed26847bdc12a` | runtime-required source |
| `includes/class-mmed-arena.php` | `f` | 15410 | `644` | `f75c27b63ed0ae50c80f3cc4f1281d7fb045817376451ed5e63a7931f1ae66da` | `56775154ed5497a8ae009d590ccd04ad` | runtime-required source |
| `includes/class-mmed-attendance.php` | `f` | 28877 | `644` | `7802d5f8c38d6d64e310278d87bcc305f72cbc26b5f9e7cef51700d74ee2252e` | `8fb163ef1f6f1cb86a40583101eec0cb` | runtime-required source |
| `includes/class-mmed-calendar-engine.php` | `f` | 31284 | `644` | `b97bef169a25ca77bba93a8e27bbb40f3055bcc63ab85d1d864512353cdc56cb` | `d66c50199767831a621dbb2a2900c23e` | runtime-required source |
| `includes/class-mmed-calendar-enrollment.php` | `f` | 20191 | `644` | `8230621cb363451f8341c2c9153a2cb7819626b6527e47c24aef681627849b2f` | `4393c59e49f14e9c2fed7553bd711807` | runtime-required source |
| `includes/class-mmed-communications.php` | `f` | 46890 | `644` | `c790d67e46a3fc8d8b1cabe170f60d8aad128628c144eb9ffb8eedb05ff6e295` | `45f2e1023dc55a626eb5df47a9499b0a` | runtime-required source |
| `includes/class-mmed-drill-game.php` | `f` | 11946 | `644` | `5dca0ab4251c33d64877f8fd462d6132ff934d5a58aa79d6fed57abac9e00eb3` | `c88a38b50e8702655cf94b4b0b830c2d` | runtime-required source |
| `includes/class-mmed-feature-flags.php` | `f` | 6969 | `644` | `587c83235032490f03485932dc0e305bbad06627743b1bcc529cd037c16c40ab` | `5be4107931c1eac97dac127bcca16e07` | runtime-required source |
| `includes/class-mmed-file-upload.php` | `f` | 9361 | `644` | `bb73c45441ef4f658e23ba7fb254532c43b78fc52cc86f6e83ac6a45d7c2d735` | `ac6eaddb05d1e207a7c41087db21179c` | runtime-required source |
| `includes/class-mmed-file-vault.php` | `f` | 27648 | `644` | `c5ffbcdc62a83936539c044729f0b81e3b24dccb32403667d0adcf1eb27352e9` | `6cf199dce22c7541895175d92492e134` | runtime-required source |
| `includes/class-mmed-hub-page.php` | `f` | 101120 | `644` | `66147f0117ef3bee5d9e52fd820b5e84f0e41445794094d08c7833f608119753` | `009a70a6ba6911e34a0fbe7785d65eba` | runtime-required source |
| `includes/class-mmed-interview-prep.php` | `f` | 38073 | `644` | `f901b648caa032e3f1b1d69a550518f883d343ca851c1ab7e2d5bf41e271be98` | `66477cb7500472b2a39cf480c0a288ff` | runtime-required source |
| `includes/class-mmed-learndash-reskin.php` | `f` | 22883 | `644` | `727b8d94518e05a63f798cf69608f7b0a3fa07f0880f084b4453e88b6a8fb54e` | `428fcb16032605d7dcab2cbbccecf742` | runtime-required source |
| `includes/class-mmed-lifecycle.php` | `f` | 6501 | `644` | `8949d03c9219f733ec622d81e44d72ef95e2902903fe3e6ad703a67f437ccd52` | `aa53743c921e1e42a61c863a97078871` | runtime-required source |
| `includes/class-mmed-live-drills-preview.php` | `f` | 106853 | `644` | `7f20dfdf565fd7a07bf984473cdb65800f4a1d168e22ae8cadbe754e589b44c4` | `5be34fc076bf60194fdc3da20aead3e0` | runtime-required source |
| `includes/class-mmed-live-drills-sdk-v3.php` | `f` | 151838 | `644` | `7f0622c06a411bcaca2622f2ce35576cd26e742fc97ef9abd040120650f0d190` | `74e5b07fe2eaffd69aab89bf43568c30` | runtime-required source |
| `includes/class-mmed-live-drills-state-contract.php` | `f` | 21581 | `644` | `a6235ac26e63733fe814ef76c3966bde6f44a0d985f7fbac2fec888fc29d22f9` | `27831b67025bc90f7cdff04b6f3b50ff` | runtime-required source |
| `includes/class-mmed-lor-writer.php` | `f` | 14724 | `644` | `1eaf0f3d08583e1e5e061696a4f828e79436b7191b76230ed80c956e948bc2dc` | `6e313277ba51484a4ecee89f28a921ee` | runtime-required source |
| `includes/class-mmed-notifications.php` | `f` | 5899 | `644` | `498192e226e4af5cc408c9fa63c84533c11e7e108fd1a8c2c975b011e4d8262b` | `0e43a8d3b7802fbe89dad13f2cd34ac4` | runtime-required source |
| `includes/class-mmed-office-hours.php` | `f` | 19809 | `644` | `d90ff2cbd5ceb5e08f50bc8a541d523b4c667546175d05990dcf86953f166556` | `ccfdf2908cb0e7ea5f88ea6e8a599d1b` | runtime-required source |
| `includes/class-mmed-priority-engine.php` | `f` | 24226 | `644` | `13faf5966220f6b15873d8bfadcf300c5fbcc0ad20417de4a6bca68bd0bdb522` | `733eec01213d99b2e5e14111e8010016` | runtime-required source |
| `includes/class-mmed-ranklist.php` | `f` | 15426 | `644` | `91f737468563feeb2e3f64846fe2d443101fe3ee92e1b10279916bf5b2c3a92b` | `492ca5f9fd3f3a562ac9a00d082752f9` | runtime-required source |
| `includes/class-mmed-rest-api.php` | `f` | 70853 | `644` | `2e2a282d05ac876c658b0c5717e4412989b362ce63cc0731f7f97f8187126b16` | `8d41a95aea1597eadf12bea3c85844ef` | runtime-required source |
| `includes/class-mmed-session-analytics.php` | `f` | 7515 | `644` | `a18322189d3687e6ab972cd10cb221d90a5273a9cd85167e6ea3315816d828d8` | `6253916df73d70fb5f402ab7a1ccd1ee` | runtime-required source |
| `includes/class-mmed-session-chat.php` | `f` | 12385 | `644` | `489c3ee150a1994af97ea0fadefbc49bdb733cf1b46aa7e30e087c4c0ada911c` | `f51b2c6e72ccfbe554a045e178a59610` | runtime-required source |
| `includes/class-mmed-session-manager.php` | `f` | 46651 | `644` | `d5519adfeec29c923896fc75f3da0c7e2a5a30a15fdae13445ca6036dfce9e64` | `ffe870630e360ef1c63374c842fb315c` | runtime-required source |
| `includes/class-mmed-session-reminders.php` | `f` | 10753 | `644` | `81079e2e234418b3501f6a8b8a9094f925d17c05a6601307e3b8028eb71dbc2f` | `ac50b4a661268604fef6686d340874eb` | runtime-required source |
| `includes/class-mmed-ssa-adapter.php` | `f` | 16651 | `644` | `2a4902dd5ef589b09850b5703ba56512d6ef732e7fb2335894113542d970b2a8` | `29829364442c13b4fdb2b425837336cf` | runtime-required source |
| `includes/class-mmed-student-os.php` | `f` | 32786 | `644` | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | `6f0195ae33d0737e374bd7413ca1018a` | runtime-required source |
| `includes/class-mmed-study-schedule.php` | `f` | 7439 | `644` | `2356d2369007db715849a3e2ba5959ac0e4323a04a8c4206b9f8b50bd97c3234` | `9bcfe17d4dc0565211afffc3c207bf91` | runtime-required source |
| `includes/class-mmed-supabase-bridge.php` | `f` | 10236 | `644` | `69f7a05b859439e0660ef2828d1c1e24706a78caa22e16f4e3fcc13ee1a892b7` | `0634acbac3a55d6d94e93e21a580c76a` | runtime-required source |
| `includes/class-mmed-task-cpt.php` | `f` | 21946 | `644` | `0fa8cf3b3e5ce54427b40db396cd68e1a84d4a036efeb93271fee46f32685567` | `2447865929b8e58ad7d3ead87b7a5079` | runtime-required source |
| `includes/class-mmed-templates.php` | `f` | 9113 | `644` | `998f090d7c8ab1c8a092b3be2e00476e6b66a187f5a7246a47cb7340c16d554e` | `6200065baf59ed94887481ec93f86d0d` | runtime-required source |
| `includes/class-mmed-todo-engine.php` | `f` | 9615 | `644` | `39ec30bacdebac5c69d05ca13588764a0ab8c6c079d9cdc4bb203b35117a52ae` | `d33c9c20e2933b8c294562951584fb51` | runtime-required source |
| `includes/class-mmed-user-meta.php` | `f` | 12765 | `644` | `b4866c64aa47423fec20f4908523e7d9069471a6142761f24e673eb5d7fc4549` | `f8d0e79e7c6e1eca36b757c0d6ad7a60` | runtime-required source |
| `includes/class-mmed-webex-client.php` | `f` | 22941 | `644` | `5e3b18e79ee3168f0cdbc71894275de58fd86fe7730d83ea83939e35c6feaffc` | `1249fb6926cd6f93412951fd0635b81d` | runtime-required source |
| `includes/class-mmed-welcome-email-admin.php` | `f` | 39438 | `644` | `7270f420ac8b4176d4ba1acf2f0e9ad455d3e43fd946ec73e28dd99e9ef087e1` | `ce267f616fa2ab51497b640852c90d2d` | runtime-required source |
| `includes/video-dashboard.php` | `f` | 20698 | `644` | `0ce005cdce253c4e045a26c867d00bd76aabd77ac78e50cf8a019c1e344492dc` | `9d586aa5f4e3f378dc3f6bf0f04d4397` | runtime-required source |
| `includes/video-inserter-ui.php` | `f` | 22113 | `644` | `91088cf1b86aa98f9e85c5c055b37be8a874709621e34515c1f4cd8ecf77ddeb` | `61199e0f45a9aa77846c0683b3924dfd` | runtime-required source |
| `includes/video-player.php` | `f` | 14673 | `644` | `a4fdf28ce759b59bb161b244872c47e36ef5be8f19a5bcd67a2aca5d1501b6d9` | `51aba53480a469bf57e9c24b377db5a2` | runtime-required source |
| `includes/video-resolver.php` | `f` | 12421 | `644` | `24cc4058315ee0457c072000c5485a5020838fbeec6c59e333a221f38eb0bf4b` | `29fc19dcac5bd82d11e07b5d1a790340` | runtime-required source |
| `includes/video-shortcode.php` | `f` | 12106 | `644` | `d52f63e8d626288f9929660573ee013534b383080417aa78fb37b1d26ae25ad3` | `24d139f81f1afff5b4fe0ca2b2a45a5f` | runtime-required source |
| `missionmed-hub.php` | `f` | 60812 | `644` | `ed02cd301205557b656cb4758e9ba2848d3938a2429647825606da6230c96cad` | `3aa5a2d46cda9a1aa3261d2d4a9bb183` | runtime-required source |
| `readme.txt` | `f` | 3339 | `644` | `0f130ef2adfaee093f0a83c6cc7753222ea1db294ce27f7435045a1f44df6e31` | `fbf25214ea547db18144c6316c0969e7` | report |
| `templates` | `d` | 6 | `755` | `-` | `-` | directory |
| `templates/admin-os-shell.php` | `f` | 2045 | `644` | `aa4b71acff4161d81b1da78e702c861589553be251c5c1001d1785c20090ff54` | `b31f3f7640380e6e819cbfd06a063ca5` | runtime-required source |
| `templates/emails` | `d` | 4 | `755` | `-` | `-` | directory |
| `templates/emails/welcome-360.html` | `f` | 44189 | `644` | `340dbeb88c9260632c5d471592dab50ee78f7450500c3f818d1dae9bbcf6d3ff` | `be9142e883ff1eaac3c7d131c761c05f` | runtime-required source |
| `templates/emails/welcome-drj-drills.html` | `f` | 15057 | `644` | `7768bc3fb93cd2e48e383d0450aead912dae4db95e2a075ebeef9c34278f8d54` | `b86005ccb284cc721018d09c82f6c7b4` | runtime-required source |
| `templates/student-os-shell.php` | `f` | 905 | `644` | `efef5d88413924c981e475a678edae083de10cd9d664ab4f057ed9bcc398aea3` | `a1ff8bf7bb1403df2393d47f40ed3f80` | runtime-required source |
| `templates/template-hub.php` | `f` | 786 | `644` | `00f2a04ce7962b4e8e4d375514fc4ed9f2b20b82cea6420ba75bc34874cc200c` | `a29d4e9e9fdce2a89a1729b92227a270` | runtime-required source |
<!-- END VERBATIM FILE: D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.md -->

<!-- BEGIN VERBATIM FILE: D9_415_SNAPSHOT_CUTOFF.md -->
# D9-415 Quiescent Snapshot Cutoff

Status: `PASS` — T0 and T1 compare identically and the local copy is verified.  
Authority: `D9-415-FOUNDATION-002`  
Production transport: read-only SSH through `missionmed-kinsta`  
Production mutation authorized: `NO`

## Included production observation scope

The quiescence envelope covers the complete `missionmed-hub` plugin tree and the complete `wp-content/mu-plugins` tree. The full MU tree is observed so the required Matrix-related MU-plugin dependency set can be selected without allowing an unobserved concurrent change. Only the proven Matrix-related set may later be imported into Git; unrelated MU source remains forensic evidence outside the product tree.

## Exact T0/T1 procedure

1. Capture a complete, sorted T0 manifest from production using read-only commands. For every entry, record scope-relative path, file type, byte size, SHA-256 for regular files, and numeric mode. Record the production server timestamp only after the complete manifest has been emitted; that completion timestamp is T0.
2. Copy the two observed trees inbound to a permission-restricted local forensic snapshot using an SSH/tar read stream. Do not move, rename, write, chmod, touch, activate, flush, or otherwise mutate any production path.
3. Capture a second complete, sorted manifest through the same read-only command and schema. Record the production server timestamp only after the complete manifest has been emitted; that completion timestamp is T1.
4. Compare T0 and T1 mechanically on scope-relative path, type, size, SHA-256, and mode. Also verify the copied snapshot against the T0 manifest.
5. Independently confirm that `includes/class-mmed-student-os.php` remains exactly `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` and that the selected Matrix-related MU dependency set is unchanged.
6. If any entry differs, stop before import or commit, report `PRODUCTION NOT QUIESCENT` with the changing paths and both observations, and do not combine bytes from different observation times.
7. If every comparison passes, freeze the local snapshot as the formal no-further-write D9-415 provenance cutoff. Subsequent source recovery is derived only from that immutable local snapshot.

## Authorized cutoff text

The authorized production snapshot cutoff is dynamic and evidence-based.

Define:

T0 = the timestamp of the final complete pre-snapshot production manifest.

T1 = the timestamp of the complete post-snapshot production manifest.

The production runtime qualifies as quiescent for D9-415 only when:

1. A full pre-snapshot manifest is captured at T0.
2. The local forensic snapshot is copied read-only.
3. A full post-snapshot manifest is captured at T1.
4. Every included production path has the same:
   - relative path
   - file type
   - size
   - SHA-256
   - mode, where available
5. The current controller remains exactly:

   23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29

6. The required Matrix-related MU-plugin dependency set remains unchanged.
7. No production file changes during the T0-to-T1 snapshot window.

If any production path changes between T0 and T1:

STOP BEFORE IMPORT OR COMMIT.

Report:

PRODUCTION NOT QUIESCENT

Do not combine files from different observation times.

Do not retry repeatedly without reporting the changing paths and hashes.

A successful identical T0/T1 comparison becomes the formal no-further-write snapshot cutoff for D9-415 provenance.

This cutoff does not prevent other authorized teams from later changing production. It defines only the immutable production state captured by D9-415.

## Executed cutoff result

- T0 completed: `2026-07-14T00:31:00.453619187Z`
- T1 completed: `2026-07-14T00:31:03.315562100Z`
- T0/T1 normalized manifest SHA-256: `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`
- T0/T1 comparison: `IDENTICAL`
- Total observed entries: `287`
- `missionmed-hub`: `125` regular files, `8` directories
- full MU observation envelope: `126` regular files, `28` directories
- symlinks/special entries: `0`
- current controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`
- local copied entries: `287`
- local path/type/file-size/SHA-256/MD5/mode mismatches after transfer normalization: `0`
- production mutations: `0`

macOS tar initially applied the restrictive local `umask` to copied entries, yielding only mode mismatches (`600/700`) while every path, type, file size, SHA-256, and MD5 was exact. The local snapshot modes were mechanically restored from T0 without another production read; the full verifier then passed with zero mismatches. The enclosing forensic directory remains permission-restricted.

The earlier Wave 1 report estimated `123` plugin files. The authoritative full T0/T1 manifest independently counted `125`, and a second local filesystem count confirmed `125`. No T0/T1 drift occurred; the Wave 1 count is superseded as an inventory-count error, while its named-file hashes and safety findings remain valid.
<!-- END VERBATIM FILE: D9_415_SNAPSHOT_CUTOFF.md -->

<!-- BEGIN VERBATIM FILE: D9_415_SNAPSHOT_EXCLUSION_REGISTER.md -->
# D9-415 Snapshot Exclusion Register

## Immutable plugin baseline

No `missionmed-hub` entry is excluded from D9-415A. The sealed tree contains no log, cache, upload, session-data file, database export, environment file, credential file, private key, symlink, or special filesystem entry. Reports, prototypes, and `assets/test-deploy.txt` remain in the observed baseline because D9-415A must represent the complete quiescent production tree; deterministic deployable packaging excludes non-runtime residue later.

## MU observation envelope

The full MU tree was captured only inside the ignored, permission-restricted forensic area so closure could be proved. Ten top-level Matrix-related files are selected for Git. The other 116 observed MU files remain excluded because they are unrelated Kinsta/vendor or adjacent product source and the ticket forbids importing unrelated MU plugins.

## Always excluded from Git

- the raw forensic transport tree itself;
- T0/T1 raw transport artifacts except safe manifests and verification results;
- production logs, caches, uploads, sessions, temporary files, database exports, user data, credentials, environment files, private keys, and authorization material (none found in the selected source);
- unrelated MU-plugin source;
- any secret or private value discovered by later validation.

Excluded-item source content is never reproduced in reports. Safe path/type/size/mode/hash evidence remains in the full T0/T1 manifests.
<!-- END VERBATIM FILE: D9_415_SNAPSHOT_EXCLUSION_REGISTER.md -->

<!-- BEGIN VERBATIM FILE: D9_415_SECRET_AND_DATA_SCAN_REPORT.md -->
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
<!-- END VERBATIM FILE: D9_415_SECRET_AND_DATA_SCAN_REPORT.md -->

<!-- BEGIN VERBATIM FILE: D9_415_MU_PLUGIN_RUNTIME_MANIFEST.md -->
# D9-415 MU-Plugin Runtime Manifest

Full sealed MU observation: `126` files; top-level files: `46`; selected Matrix closure: `10` files.

Selection includes every component explicitly named by the ticket, the active/copy legacy-popup pair required for quarantine evidence, and direct source-evidenced Matrix effects that Wave 1 undercounted. Unrelated Kinsta/vendor and adjacent product MU files remain outside Git.

| Selected top-level MU file | Bytes | Mode | SHA-256 | Runtime rationale |
|---|---:|---:|---|---|
| `arena-route-proxy.php` | 25209 | `644` | `536cbeb8896f0e92fee992a790c5126cfc5ce826da50e697a8420c9e470420ca` | Provides the four Arena proxy functions directly consumed by the DrJ Matrix access guard. |
| `missionmed-drj-drills-access.php` | 26210 | `644` | `ffab495c8d591d2bb500838334090b816282bcee73c6f55524c0c50b31db43ce` | Auto-loaded role/access control that directly locks Student OS Matrix routes and feature flags for a restricted role. |
| `missionmed-hq-auth-handoff.php` | 24719 | `644` | `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3` | Explicit D9-415 protected WordPress-to-HQ signed authentication/entitlement handoff component. |
| `missionmed-hq-proxy.php` | 8308 | `644` | `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3` | Explicit D9-415 protected same-origin HQ authentication proxy component. |
| `missionmed-matrix-account-entry.php` | 21023 | `644` | `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba` | Matrix account/LearnDash entry component; dynamically loads the hub LearnDash reskin class. |
| `missionmed-mr-legacy-popup.php` | 14800 | `644` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Active production counterpart required by the explicit duplicate/backup preservation and remediation contract. |
| `missionmed-mr-legacy-popup_BACKUP_PRE004.php` | 14800 | `644` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Explicitly required byte-identical, currently auto-loaded backup preserved in D9-415A. |
| `missionmed-performance-boost.php` | 52078 | `644` | `00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1` | Auto-loaded source that explicitly preserves query versions for the exact missionmed-hub Matrix asset paths. |
| `missionmed-supabase-session-cookie-auth.php` | 3077 | `644` | `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f` | Explicit D9-415 protected Supabase session-to-WordPress identity bridge. |
| `mm-scheduler-webex-broker.php` | 31173 | `644` | `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455` | Explicit Scheduler/Webex entitlement, meeting, recording, and proxy broker used by the Matrix Scheduler runtime. |

The legacy popup and its backup are byte-identical at `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`. Both are auto-loaded in D9-415A exactly as observed. D9-415B removes only the backup-named active-path copy and preserves it unchanged in non-autoloaded forensics.
<!-- END VERBATIM FILE: D9_415_MU_PLUGIN_RUNTIME_MANIFEST.md -->

<!-- BEGIN VERBATIM FILE: D9_415_MU_DEPENDENCY_GRAPH.md -->
# D9-415 MU Dependency Graph

```text
WordPress MU loader (alphabetical top-level *.php autoload)
├── missionmed-matrix-account-entry.php
│   └── wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php
├── missionmed-drj-drills-access.php
│   └── arena-route-proxy.php (four optional custom Arena proxy functions)
├── missionmed-performance-boost.php
│   └── exact missionmed-hub Student OS/Calendar/Scheduler/File Vault/StoryForge asset paths
├── missionmed-hq-auth-handoff.php
├── missionmed-hq-proxy.php
├── missionmed-supabase-session-cookie-auth.php
├── mm-scheduler-webex-broker.php
├── missionmed-mr-legacy-popup.php
└── missionmed-mr-legacy-popup_BACKUP_PRE004.php (same symbols/hooks and same bytes)
```

No selected top-level MU file directly `include`s or `require`s another selected MU file. The Matrix account entry dynamically requires the hub LearnDash reskin class if not already loaded. The DrJ access guard calls four custom functions supplied by `arena-route-proxy.php`; that provider is therefore included. The performance MU file is included because it explicitly preserves query-version behavior for the exact Matrix asset set.

The two legacy-popup PHP files register the same functions and hooks. Their active co-location is preserved only in immutable D9-415A evidence and is the exact source-only quarantine target for D9-415B.
<!-- END VERBATIM FILE: D9_415_MU_DEPENDENCY_GRAPH.md -->

<!-- BEGIN VERBATIM FILE: D9_415_BASELINE_COMMIT_PROVENANCE.md -->
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
<!-- END VERBATIM FILE: D9_415_BASELINE_COMMIT_PROVENANCE.md -->

<!-- BEGIN VERBATIM FILE: D9_415_PRODUCTION_TO_GIT_HASH_MAP.md -->
# D9-415 Production-to-Git Hash Map

Verdict: **PASS** — all 135 files in the selected runtime closure map exactly from the quiescent production snapshot to immutable commit A.

- Commit: `c340a3a87732f7dc4afb06c01e4586239a050495`
- Tree: `2a43327429214fdf1c161aa9adf297fabac155bd`
- Annotated tag: `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`
- Tag object: `6e2f5e32830f06b9015b9eee1870ccfab62b2a49`
- Tag target: `c340a3a87732f7dc4afb06c01e4586239a050495`
- Plugin version: `1.5.1`
- Exact files: `135` (`125` plugin + `10` selected MU)
- Total exact source bytes: `10590108`
- T0/T1 quiescence: identical; manifest SHA-256 `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`

## Protected Matrix files

| Asset | Git path | Active-lock SHA-256 | Commit A SHA-256 | Disposition |
|---|---|---|---|---|
| `student_os_js` | `wp-content/plugins/missionmed-hub/assets/student-os.js` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | active_lock_match |
| `student_os_css` | `wp-content/plugins/missionmed-hub/assets/student-os.css` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | active_lock_match |
| `class_mmed_student_os_php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php` | `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | authorized_current_observed_source_under_D9-415-FOUNDATION-002 |
| `calendar_v4_js` | `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js` | `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa` | `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa` | active_lock_match |
| `calendar_v4_css` | `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css` | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | active_lock_match |
| `scheduler_mount_js` | `wp-content/plugins/missionmed-hub/assets/scheduler-mount.js` | `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578` | `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578` | active_lock_match |
| `file_vault_js` | `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js` | `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` | `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` | active_lock_match |
| `file_vault_css` | `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css` | `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990` | `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990` | active_lock_match |
| `storyforge_js` | `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | active_lock_match |
| `storyforge_css` | `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.css` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | active_lock_match |

The controller is the sole active-lock mismatch. Founder Decision 002 authorizes its exact current-observed hash for source recovery only; D9-416 must adjudicate entitlement behavior.

## Complete selected production-to-Git mapping

| Production scope | Production path | Git path | SHA-256 | Bytes | Mode | Git blob | Result |
|---|---|---|---|---:|---:|---|---|
| `missionmed-hub` | `CHANGELOG.md` | `wp-content/plugins/missionmed-hub/CHANGELOG.md` | `082428d9398fba549700c9f479caf21fad6054354237fddc68ecd303f2dc5f1e` | 5831 | `644` → `100644` | `ae57a715bbd3e95b772f00273ea0cf49370fd6c1` | `exact` |
| `missionmed-hub` | `MULTI_DIVISION_DASHBOARD_INTEGRATION.md` | `wp-content/plugins/missionmed-hub/MULTI_DIVISION_DASHBOARD_INTEGRATION.md` | `28e1687a54b6881d887a3e6008ba1a2f05f3228a120dc01fe31fd056b2113cd2` | 1874 | `644` → `100644` | `0df39bf4d5fc0522e8aab1372b44dadf99005984` | `exact` |
| `missionmed-hub` | `WEBEX_WIDGET_RESEARCH.md` | `wp-content/plugins/missionmed-hub/WEBEX_WIDGET_RESEARCH.md` | `cc5be759724ac83d215e063d161d2cf6db3d8e2fe743e307129fbc1ccc69d379` | 6047 | `644` → `100644` | `a659d20c8026b7fc9ffd74dadf2a77503a267f42` | `exact` |
| `missionmed-hub` | `assets/admin-analytics.css` | `wp-content/plugins/missionmed-hub/assets/admin-analytics.css` | `626a3fbf0d37cfe87ac76df53bc16137a5280c5d81a240a798d72faebabd0487` | 1596 | `644` → `100644` | `fdf4d1692c13a5358d0d813d2259f23fd12f2272` | `exact` |
| `missionmed-hub` | `assets/admin-analytics.js` | `wp-content/plugins/missionmed-hub/assets/admin-analytics.js` | `349c824d3dadbe117300e57426c7d53360f4ab7a43b8144671d92d085ea0ee4c` | 7375 | `644` → `100644` | `4500e0a4bb6047430b3e2af5cf56b0786926bc5c` | `exact` |
| `missionmed-hub` | `assets/admin-arena-battles.css` | `wp-content/plugins/missionmed-hub/assets/admin-arena-battles.css` | `aba6464bd718a34590752e93d42ef6271284a2b5b104624d373355079e353e7a` | 3286 | `644` → `100644` | `a822d4200553f141578db97d058185e0f4f23b08` | `exact` |
| `missionmed-hub` | `assets/admin-arena-battles.js` | `wp-content/plugins/missionmed-hub/assets/admin-arena-battles.js` | `aa04fecdc1fb49546ffc1b906dc39b502f9cb4a08459fc34b079f9d19ec7a3f0` | 16623 | `644` → `100644` | `aecac958aa17eae5a4e086158811d24dbbd74c57` | `exact` |
| `missionmed-hub` | `assets/admin-office-hours.css` | `wp-content/plugins/missionmed-hub/assets/admin-office-hours.css` | `ff3525f6247f0c811c560fb56b32ffe9e9ae83cb07c821668ce30e02aa8e463d` | 3038 | `644` → `100644` | `c579d42f97bbf42f1c82886e82aef7264b1a2315` | `exact` |
| `missionmed-hub` | `assets/admin-office-hours.js` | `wp-content/plugins/missionmed-hub/assets/admin-office-hours.js` | `c8c42b9cbeb0c1d4aa2bd03793efcec97e1056e7b5f5e605cbf4ddbf622c86e2` | 10163 | `644` → `100644` | `6efc100c1dc49e90825a29d0766c5010e3491ac8` | `exact` |
| `missionmed-hub` | `assets/admin-os.css` | `wp-content/plugins/missionmed-hub/assets/admin-os.css` | `ec212f42fd3bd23923a27775700f8790cae8dba401cdf4d80ea69afcbba58133` | 74869 | `644` → `100644` | `b302075a0ad9b791cad276bc49020ffce0e2a17a` | `exact` |
| `missionmed-hub` | `assets/admin-os.js` | `wp-content/plugins/missionmed-hub/assets/admin-os.js` | `9a0289b52079f0425d68a070d7f999f0813ff793206f9b582f61bb300faff7c5` | 273225 | `644` → `100644` | `2c14903f5f8a7dff91bba7b08cb54cae50913103` | `exact` |
| `missionmed-hub` | `assets/admin-session-manager.css` | `wp-content/plugins/missionmed-hub/assets/admin-session-manager.css` | `3b8edc9d79fffb64b520a3ec5db07eae7c23584884f930aec61fa61f518dd48a` | 7183 | `644` → `100644` | `e3aefed220a5e464af177f9019f9d077c75800f5` | `exact` |
| `missionmed-hub` | `assets/admin-session-manager.js` | `wp-content/plugins/missionmed-hub/assets/admin-session-manager.js` | `4922ea7ce021fc06a0ac9bed467bb5ffb573ea1b9f7eb02f2f4894960562c049` | 25850 | `644` → `100644` | `facc457e42cf790596409ede3cd9ade388d4938e` | `exact` |
| `missionmed-hub` | `assets/admin-sources/matrix-calendar-prototype-v4.html` | `wp-content/plugins/missionmed-hub/assets/admin-sources/matrix-calendar-prototype-v4.html` | `a3088d61a1294a70882bfadcc66ddb7365ec86d1ea91bc2977cd5b892aa9c131` | 94362 | `644` → `100644` | `f2cbaf7714dbd24f0c5644ecf92293bcdac93d17` | `exact` |
| `missionmed-hub` | `assets/admin-sources/mx-filevault-006d-nexus-clarity-final-demo.html` | `wp-content/plugins/missionmed-hub/assets/admin-sources/mx-filevault-006d-nexus-clarity-final-demo.html` | `a4b74d1479ebb2e9fb4d048ee2ff2883c0d3c4430d978c7723e0c90254837575` | 77438 | `644` → `100644` | `9f18327f55900aa98546b2474f73033b062a7161` | `exact` |
| `missionmed-hub` | `assets/admin-sources/scheduler-admin-source.html` | `wp-content/plugins/missionmed-hub/assets/admin-sources/scheduler-admin-source.html` | `dd96fbaca1ab8fadb6c7f894fe10626a51112c7c8a26b49b49e00d0e17b8c51c` | 132681 | `644` → `100644` | `50855520ff67e9aa397f22b01b4bed15fab950bd` | `exact` |
| `missionmed-hub` | `assets/admin-sources/storyforge-admin-source.html` | `wp-content/plugins/missionmed-hub/assets/admin-sources/storyforge-admin-source.html` | `2c9d368d8d2acb5eb9d90cd7f93c876ade52b6ec169dbbe47acd0e125f430c02` | 85688 | `644` → `100644` | `8e94e93db5ad59d19cdf8dc19198d6bdf2ffc1ae` | `exact` |
| `missionmed-hub` | `assets/admin.css` | `wp-content/plugins/missionmed-hub/assets/admin.css` | `140875566f72fd9e09bdb2a6a078760455f1c7cbbcff6f93a4fd18bb620a935c` | 7814 | `644` → `100644` | `d6d0f4fa8ccf5ffb2975afb80e908c4a3c2cc822` | `exact` |
| `missionmed-hub` | `assets/admin.js` | `wp-content/plugins/missionmed-hub/assets/admin.js` | `eb518c007c04f456dff88bbd6c64c83423d843193a5ceeada2efb82df96cb693` | 2961 | `644` → `100644` | `a60bbb4365f7e0be4a637cc302f0d4edcaa613e2` | `exact` |
| `missionmed-hub` | `assets/daily-drills-live-webex-embed.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-live-webex-embed.js` | `bfcb542b0034e6872da00b547806fe872a5aa0e2cd7165254fe921af283f0575` | 45645 | `644` → `100644` | `a08b2d64566af2615038df56ac6855707bee9e2f` | `exact` |
| `missionmed-hub` | `assets/daily-drills-live-webex-preview.html` | `wp-content/plugins/missionmed-hub/assets/daily-drills-live-webex-preview.html` | `a3224c7df50f35ccbbda8ab53a358e64032da8c2c960c8fce6be0f3e6fcfdae4` | 39541 | `644` → `100644` | `ca805b2629c336c085539c253d623e2983fcc9ae` | `exact` |
| `missionmed-hub` | `assets/daily-drills-live-webex-sdk-v3.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-live-webex-sdk-v3.js` | `3c40979791673333706bc7fa1fa536c33f35a0b258cebc3330342c962699edaa` | 159267 | `644` → `100644` | `1ea67d677510e060e7251a9b9dd3921ba7fd3797` | `exact` |
| `missionmed-hub` | `assets/daily-drills-live-webex-v3-embed.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-live-webex-v3-embed.js` | `036897b3f3ef8d381383225a81178362dd6cc052bd6144d64129232edafe552f` | 54721 | `644` → `100644` | `aa26fe2c7001abc89ef8081e6cf55d93500d3eb7` | `exact` |
| `missionmed-hub` | `assets/daily-drills-live-webex-v3.html` | `wp-content/plugins/missionmed-hub/assets/daily-drills-live-webex-v3.html` | `ce5c606dfa55671c21334041c2bc5e59cb49d2b949d9e0008187b6402dbe0f4b` | 7228 | `644` → `100644` | `f6f3b84b3ce94eb35c9b49f09f9ac77ce6c6c2e4` | `exact` |
| `missionmed-hub` | `assets/daily-drills-matrix-entry.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-matrix-entry.js` | `fd1692ce0ed149a5d975e2d80a4965a05281df0db05287b79e0ece5d5b4ba67d` | 4744 | `644` → `100644` | `6cc43fa86c9a3c76be55960f2c995268cd56eb9e` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-sdk-tiles.inactive.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-sdk-tiles.inactive.js` | `3a9af5fd2e86a5b75c6d76c5c3df66bde6895495487315b8ee5e6c7c50f7d6b1` | 1493 | `644` → `100644` | `5aabb4466bfd01f0573a29dacd890c414e559ab6` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-v3-action.php` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3-action.php` | `b8e0023ee44c65d9373a5354965df765558fad4fcbb661bc1f0d61bc265f945b` | 12666 | `644` → `100644` | `e3842f6b62f91b872408cdca42562a3332edc9f4` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-v3-autojoin.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3-autojoin.js` | `bb0424e429b043ee911b61744ad7e54ba18cd55e0fbce047e129f80f4cb12a72` | 224640 | `644` → `100644` | `ffbad5d228e08b9c2e418f4b534d9c9a3e335992` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-v3-studentflow.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3-studentflow.js` | `c26cf6777b3390638e42cc381e57ce1d2c8d8cbf68953d184fd5174425b85678` | 268275 | `644` → `100644` | `9a0a31cfc8d861ae130fb0a5d856d8a6a5ca244f` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-v3-worker.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3-worker.js` | `721ef0a79d3fe5a91d28e27aa28db903d86babcf7b3ed3e102b0fb91aa2ab6c7` | 4282 | `644` → `100644` | `b848537b8d9937005614a1ffbe644a4c7a1eb884` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge-v3.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3.js` | `2fd945408c5266827f20b6bd5762cd195e7905d57a70dc1cfb39be656e892ad4` | 222304 | `644` → `100644` | `d525df0281287e551e9fd787d58b1197dd940b97` | `exact` |
| `missionmed-hub` | `assets/daily-drills-team-challenge.js` | `wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge.js` | `65ddd863a4ef820a802a34cbc5cb110c3c1315b0c2f5bf9ecd965b3ce0971ebe` | 111953 | `644` → `100644` | `e0360eecd9d9d644bf92bc74abf0580423220044` | `exact` |
| `missionmed-hub` | `assets/email/360-name-brush-underline.png` | `wp-content/plugins/missionmed-hub/assets/email/360-name-brush-underline.png` | `e9649a9b85651c6e847fdff3df7ab40f5878a626c9d29aacd0d0ad85f64c6180` | 14674 | `644` → `100644` | `420bb0ecd011edf2cac446c7594ea4ea2eb1aa25` | `exact` |
| `missionmed-hub` | `assets/hub.css` | `wp-content/plugins/missionmed-hub/assets/hub.css` | `f7dfd2eaf6e2ea80b16f20a634ff0730ce3c557d3d3fffd218adb9a3e1bcd62a` | 67706 | `644` → `100644` | `052f0026925d6b924489b0601fb497de4bd01270` | `exact` |
| `missionmed-hub` | `assets/hub.js` | `wp-content/plugins/missionmed-hub/assets/hub.js` | `a810b4ec34e0e52919f4d5596727da50ceab72941c05c15fc1c0891ad28d0338` | 39699 | `644` → `100644` | `c617d4bf16065ab2af7e2af41116b2b9a26b1f33` | `exact` |
| `missionmed-hub` | `assets/learndash-reskin.css` | `wp-content/plugins/missionmed-hub/assets/learndash-reskin.css` | `c989f761b4d0e15031e51d1d3e2421316c69f3878c2d59aadd679e8c9d2e15b9` | 65560 | `644` → `100644` | `19d3c1cacd9a5650105ca1c7695894eb24be65dd` | `exact` |
| `missionmed-hub` | `assets/mmed-webex-widget-adapter.js` | `wp-content/plugins/missionmed-hub/assets/mmed-webex-widget-adapter.js` | `f6a3205fb28998a797892446374d9f298484a9c361d582a73e1f8320a7c82427` | 4963199 | `644` → `100644` | `d8f32e7e9ac259364be53a483f2f83013f5cf6e9` | `exact` |
| `missionmed-hub` | `assets/scheduler-mount.js` | `wp-content/plugins/missionmed-hub/assets/scheduler-mount.js` | `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578` | 61339 | `644` → `100644` | `c68219cb569d82851a882d0d590605f44578ab64` | `exact` |
| `missionmed-hub` | `assets/student-os-arena-battle.css` | `wp-content/plugins/missionmed-hub/assets/student-os-arena-battle.css` | `981eacc2e9daab5b3dedf760217163774745fb375bcb922b25a02b3a1f833c12` | 5746 | `644` → `100644` | `e47814a548a26a3ff186dacc513e85f67479477d` | `exact` |
| `missionmed-hub` | `assets/student-os-arena-battle.js` | `wp-content/plugins/missionmed-hub/assets/student-os-arena-battle.js` | `f2659f15075101ace42d0eec8475a0e7ecfad14f5103e24f4c2aaa9b9ca5e435` | 13143 | `644` → `100644` | `8cf6002f9db4279b58dd5f0ceace0d6276cc42b4` | `exact` |
| `missionmed-hub` | `assets/student-os-calendar-v4.css` | `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css` | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | 67041 | `644` → `100644` | `12522ff4e3e8318f56bc63ff68caed3dfda74600` | `exact` |
| `missionmed-hub` | `assets/student-os-calendar-v4.js` | `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js` | `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa` | 102614 | `644` → `100644` | `0f019ebc33aac8ee7504cecc1f9d3c5c7e5450f7` | `exact` |
| `missionmed-hub` | `assets/student-os-drill-game.css` | `wp-content/plugins/missionmed-hub/assets/student-os-drill-game.css` | `c6edb0de1ead9cdc1097120d34cfd67dd98be1ae694d1b1f01c6eb02bdc80941` | 2720 | `644` → `100644` | `a4906e15cef4cf26e98bc9229525f40046328e9f` | `exact` |
| `missionmed-hub` | `assets/student-os-drill-game.js` | `wp-content/plugins/missionmed-hub/assets/student-os-drill-game.js` | `fa773a158a865d580bfd89e80d8753d32a15e5539afd274da9e258f734070def` | 6248 | `644` → `100644` | `e25698316ee74f9383589ae55ce7400351098900` | `exact` |
| `missionmed-hub` | `assets/student-os-file-vault.css` | `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css` | `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990` | 74647 | `644` → `100644` | `fcf934319ef04b73d2311999d7a06a06e4f5bcfc` | `exact` |
| `missionmed-hub` | `assets/student-os-file-vault.js` | `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js` | `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` | 57912 | `644` → `100644` | `c508e456f13c3f84c437e7946caee86d382e33ed` | `exact` |
| `missionmed-hub` | `assets/student-os-interview-prep.css` | `wp-content/plugins/missionmed-hub/assets/student-os-interview-prep.css` | `5d6a70c798f6eb86e9a59cb3c5164550e037881a5cac3ac7cc472f4c6297d4f6` | 6880 | `644` → `100644` | `1082b81dc8e56122517a34e9302cf2744a12615d` | `exact` |
| `missionmed-hub` | `assets/student-os-interview-prep.js` | `wp-content/plugins/missionmed-hub/assets/student-os-interview-prep.js` | `6623c792e4d1ef803707aa61dbf0fa3b90bec8e10f0b9fd6d209261d75ef2d8c` | 20577 | `644` → `100644` | `b7ba3f9c6d929127b42e47f0a44ab90fa1548a86` | `exact` |
| `missionmed-hub` | `assets/student-os-live-session.css` | `wp-content/plugins/missionmed-hub/assets/student-os-live-session.css` | `4b782ec26b8d62b3988f68fc5b33a1adf018bdafc7b966c84a5dca1a33463e9b` | 8512 | `644` → `100644` | `8eccbc6a8e4ece16a485c6c83fc2e6c1542746a6` | `exact` |
| `missionmed-hub` | `assets/student-os-live-session.js` | `wp-content/plugins/missionmed-hub/assets/student-os-live-session.js` | `f4044fedc6785fb41494491f8bed8d974d584b06d54231b29594fdf4d9a64ec9` | 25496 | `644` → `100644` | `56045a4347411fe567ddd401bc18b7db580ff496` | `exact` |
| `missionmed-hub` | `assets/student-os-office-hours.css` | `wp-content/plugins/missionmed-hub/assets/student-os-office-hours.css` | `c0006659376b3fb23929caef869c893cea8ec6bc6182ed3585c26177c4bfa5ce` | 3096 | `644` → `100644` | `771810fcbc72aa260df678a8a4ca453c214e6e26` | `exact` |
| `missionmed-hub` | `assets/student-os-office-hours.js` | `wp-content/plugins/missionmed-hub/assets/student-os-office-hours.js` | `e75716caa9913d86795f134a1f846f60bd887e6df187d19babd67d9f00e717f4` | 7614 | `644` → `100644` | `b46eba1b91adf3eb930aab5f2735f0f566c66023` | `exact` |
| `missionmed-hub` | `assets/student-os-storyforge.css` | `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.css` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | 18092 | `644` → `100644` | `a1219e80615150f54bf54c8412b43d7194c694fa` | `exact` |
| `missionmed-hub` | `assets/student-os-storyforge.js` | `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | 27456 | `644` → `100644` | `a2ca952d9802c8bd805dec264f0bc95ed2767f5c` | `exact` |
| `missionmed-hub` | `assets/student-os.646e3598d284fff3.js` | `wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | 268367 | `644` → `100644` | `4fcea6cfbd19df18713092a2298fe0f37849b4e3` | `exact` |
| `missionmed-hub` | `assets/student-os.css` | `wp-content/plugins/missionmed-hub/assets/student-os.css` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | 211321 | `644` → `100644` | `5b5eab97ee4c64a031bb77181c0a55d0f67dc257` | `exact` |
| `missionmed-hub` | `assets/student-os.js` | `wp-content/plugins/missionmed-hub/assets/student-os.js` | `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` | 268367 | `644` → `100644` | `4fcea6cfbd19df18713092a2298fe0f37849b4e3` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-01.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-01.webp` | `b8507e6767481e7ea9e0c753e6a266a578a18bdc48d5f60b30a06c5adf289373` | 28790 | `644` → `100644` | `17ba6e58909d03d63b70bf0695c93b258b617e37` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-02.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-02.webp` | `fa813a4fa98dbf52913986e00a41cb0add2cd6c9eab11a18ba7af321a9aff652` | 35434 | `644` → `100644` | `721ce1c2c3eeaf888e8311d16df67444d94ae7cf` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-03.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-03.webp` | `1022f804c584a47d5da7c9fae38f7c2985480c6841d2bb34221bf6bb9c3ceff9` | 31038 | `644` → `100644` | `9305f5dd1330dd6c3576d4029869c5e1574341f4` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-04.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-04.webp` | `4aad2e17ebc33200c0fd468efd68a3797bf87b353be8315eec8a064ce09009e5` | 41380 | `644` → `100644` | `27a625030c919512414a9a818bf78760515e22b3` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-05.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-05.webp` | `4aad2e17ebc33200c0fd468efd68a3797bf87b353be8315eec8a064ce09009e5` | 41380 | `644` → `100644` | `27a625030c919512414a9a818bf78760515e22b3` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-female-06.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-female-06.webp` | `3da7fd6b5e943df584ab8bba7e3ffea98c896b821837175f0ec12dd0d474b055` | 45122 | `644` → `100644` | `38a28fef29b17d1d19a1aa3c476e4531a624e39a` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-male-01.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-male-01.webp` | `19aea1c07e19bd728ae5dd7c0330306045a7ea2d39edf4f0c2e751e9bf27323c` | 36108 | `644` → `100644` | `a014bfca9d92d678349d4e7ee40f5908e2cd9566` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/doctor-male-02.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/doctor-male-02.webp` | `19aea1c07e19bd728ae5dd7c0330306045a7ea2d39edf4f0c2e751e9bf27323c` | 36108 | `644` → `100644` | `a014bfca9d92d678349d4e7ee40f5908e2cd9566` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/superhero-female-01.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/superhero-female-01.webp` | `cbf7c9a4d5d69a5c0ecde0ea15acb9826c805be1a433c88bfb73116dc7262ba7` | 55028 | `644` → `100644` | `87c5c5927f91f82baf01f688459b99532138f6ac` | `exact` |
| `missionmed-hub` | `assets/team-challenge-avatars/superhero-female-02.webp` | `wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/superhero-female-02.webp` | `3da7fd6b5e943df584ab8bba7e3ffea98c896b821837175f0ec12dd0d474b055` | 45122 | `644` → `100644` | `38a28fef29b17d1d19a1aa3c476e4531a624e39a` | `exact` |
| `missionmed-hub` | `assets/test-deploy.txt` | `wp-content/plugins/missionmed-hub/assets/test-deploy.txt` | `20df1d55eb703116a19d12d1f25573336b9382bc29b443977e7106681d69d27f` | 40 | `644` → `100644` | `1133c6f66b8366f8518f8d0fef98b1ec74ae2fa9` | `exact` |
| `missionmed-hub` | `assets/video-inserter.css` | `wp-content/plugins/missionmed-hub/assets/video-inserter.css` | `a216e568fc0de765deed7613b20ead8374019a7714ac3a395c1f886ce0584d10` | 15183 | `644` → `100644` | `2d0a1d8fcfb8bf89724821149e2263fa93931d02` | `exact` |
| `missionmed-hub` | `assets/video-inserter.js` | `wp-content/plugins/missionmed-hub/assets/video-inserter.js` | `5552f955467c846b98930d22e5438e07963fa97d4549b4caf33bd3b6e052335b` | 26962 | `644` → `100644` | `7d161e9e2ff564eb09ea17eca1b5c87d8ff8c490` | `exact` |
| `missionmed-hub` | `assets/webex-widgets.css` | `wp-content/plugins/missionmed-hub/assets/webex-widgets.css` | `433c5ff2e7246f5379f81c31c2c6c0ed66205e80f495ceb7910d808dd404e41a` | 93522 | `644` → `100644` | `1cca6de0f10f25d18f29fa4755bdd62817627608` | `exact` |
| `missionmed-hub` | `class-mmed-access-audit.php` | `wp-content/plugins/missionmed-hub/class-mmed-access-audit.php` | `f70a434f7d1a0518dc4793f970efa911db6c5546070e91f36d6e282bec3d7d45` | 45389 | `644` → `100644` | `7f0edb6a5593b1c4c0ce3e6d09aafa642029756b` | `exact` |
| `missionmed-hub` | `includes/class-mmed-access-audit.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-access-audit.php` | `f70a434f7d1a0518dc4793f970efa911db6c5546070e91f36d6e282bec3d7d45` | 45389 | `644` → `100644` | `7f0edb6a5593b1c4c0ce3e6d09aafa642029756b` | `exact` |
| `missionmed-hub` | `includes/class-mmed-access-gate.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-access-gate.php` | `9a833ea0c061a28972c1db3454552b458ddebe8cc26f97768e8d9c24b8c3f514` | 19641 | `644` → `100644` | `1f8268e9f86d9a4ca2982cc8de4f900bc0efd5c6` | `exact` |
| `missionmed-hub` | `includes/class-mmed-action-items.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-action-items.php` | `1079ab31217ce26b3675a96b0e9139eeb659be8f6e20d7afbf8949c493340023` | 11123 | `644` → `100644` | `8a0a3ac8c75dcc20a1bb4225bc8734b192baf8ca` | `exact` |
| `missionmed-hub` | `includes/class-mmed-admin-os.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-admin-os.php` | `2669cd8af849c8fb6a96988b6b3cf9691d98d6c8114abffbe7d1fa22dd166891` | 7423 | `644` → `100644` | `a8ddccd55c78c19ffe08de0a7025941b9365bcba` | `exact` |
| `missionmed-hub` | `includes/class-mmed-arena-live.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-arena-live.php` | `436343f4f03f493c2dfe01981d68a5864f8bbc429e00bf1fe89f55e1ae6c7ccc` | 38100 | `644` → `100644` | `41c720cb8b72e38a232f7fcf2f9a4c74a5d62b44` | `exact` |
| `missionmed-hub` | `includes/class-mmed-arena.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-arena.php` | `f75c27b63ed0ae50c80f3cc4f1281d7fb045817376451ed5e63a7931f1ae66da` | 15410 | `644` → `100644` | `9962e32a25c9b319716f861a75ae2c35469e9e48` | `exact` |
| `missionmed-hub` | `includes/class-mmed-attendance.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-attendance.php` | `7802d5f8c38d6d64e310278d87bcc305f72cbc26b5f9e7cef51700d74ee2252e` | 28877 | `644` → `100644` | `b3d5e7e1f7ad5a2efc5d9949804e8e70d8c371e5` | `exact` |
| `missionmed-hub` | `includes/class-mmed-calendar-engine.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php` | `b97bef169a25ca77bba93a8e27bbb40f3055bcc63ab85d1d864512353cdc56cb` | 31284 | `644` → `100644` | `2a6df654ac02a537dc84415f2d13a7ebf4b92dd3` | `exact` |
| `missionmed-hub` | `includes/class-mmed-calendar-enrollment.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-enrollment.php` | `8230621cb363451f8341c2c9153a2cb7819626b6527e47c24aef681627849b2f` | 20191 | `644` → `100644` | `ac6262dac99d0c46b1cba728b012bb368901c11f` | `exact` |
| `missionmed-hub` | `includes/class-mmed-communications.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-communications.php` | `c790d67e46a3fc8d8b1cabe170f60d8aad128628c144eb9ffb8eedb05ff6e295` | 46890 | `644` → `100644` | `b7763c864930033f0d9fedd9dfa5f4f78bc2a20a` | `exact` |
| `missionmed-hub` | `includes/class-mmed-drill-game.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-drill-game.php` | `5dca0ab4251c33d64877f8fd462d6132ff934d5a58aa79d6fed57abac9e00eb3` | 11946 | `644` → `100644` | `8fe7b99255fd2f5d86309439c2583cedb47eb129` | `exact` |
| `missionmed-hub` | `includes/class-mmed-feature-flags.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-feature-flags.php` | `587c83235032490f03485932dc0e305bbad06627743b1bcc529cd037c16c40ab` | 6969 | `644` → `100644` | `bf149545fdc2adeeeaec98744f0605ca0b70caab` | `exact` |
| `missionmed-hub` | `includes/class-mmed-file-upload.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-file-upload.php` | `bb73c45441ef4f658e23ba7fb254532c43b78fc52cc86f6e83ac6a45d7c2d735` | 9361 | `644` → `100644` | `0d4cbfe8d7796681180437dfacd9164829797ed7` | `exact` |
| `missionmed-hub` | `includes/class-mmed-file-vault.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault.php` | `c5ffbcdc62a83936539c044729f0b81e3b24dccb32403667d0adcf1eb27352e9` | 27648 | `644` → `100644` | `34b1038f2fc9f43356ae9e1e1c2354a4639ca3cd` | `exact` |
| `missionmed-hub` | `includes/class-mmed-hub-page.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-hub-page.php` | `66147f0117ef3bee5d9e52fd820b5e84f0e41445794094d08c7833f608119753` | 101120 | `644` → `100644` | `26d340b762d5f4462c6ffca5515be4659b8eb251` | `exact` |
| `missionmed-hub` | `includes/class-mmed-interview-prep.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-interview-prep.php` | `f901b648caa032e3f1b1d69a550518f883d343ca851c1ab7e2d5bf41e271be98` | 38073 | `644` → `100644` | `b956dd0d44bb598cdbc9a254215bda9a7d969c09` | `exact` |
| `missionmed-hub` | `includes/class-mmed-learndash-reskin.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-learndash-reskin.php` | `727b8d94518e05a63f798cf69608f7b0a3fa07f0880f084b4453e88b6a8fb54e` | 22883 | `644` → `100644` | `22927628825fe8fa038102eba40991ab992a59af` | `exact` |
| `missionmed-hub` | `includes/class-mmed-lifecycle.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-lifecycle.php` | `8949d03c9219f733ec622d81e44d72ef95e2902903fe3e6ad703a67f437ccd52` | 6501 | `644` → `100644` | `ad848d192fa6bf9af4e47ece99fe2c8824b9d518` | `exact` |
| `missionmed-hub` | `includes/class-mmed-live-drills-preview.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-live-drills-preview.php` | `7f20dfdf565fd7a07bf984473cdb65800f4a1d168e22ae8cadbe754e589b44c4` | 106853 | `644` → `100644` | `a418225b514d834835414757f2b7d4ea6b4dfc01` | `exact` |
| `missionmed-hub` | `includes/class-mmed-live-drills-sdk-v3.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-live-drills-sdk-v3.php` | `7f0622c06a411bcaca2622f2ce35576cd26e742fc97ef9abd040120650f0d190` | 151838 | `644` → `100644` | `73651f8474ea831ec440d1b8e35c073d8a3ca28c` | `exact` |
| `missionmed-hub` | `includes/class-mmed-live-drills-state-contract.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-live-drills-state-contract.php` | `a6235ac26e63733fe814ef76c3966bde6f44a0d985f7fbac2fec888fc29d22f9` | 21581 | `644` → `100644` | `58505c37b03bcfec400f4b5a3bc124ecb38c9423` | `exact` |
| `missionmed-hub` | `includes/class-mmed-lor-writer.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-lor-writer.php` | `1eaf0f3d08583e1e5e061696a4f828e79436b7191b76230ed80c956e948bc2dc` | 14724 | `644` → `100644` | `3b4a7a2f465c407cf62997255e0840ded3d6b338` | `exact` |
| `missionmed-hub` | `includes/class-mmed-notifications.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-notifications.php` | `498192e226e4af5cc408c9fa63c84533c11e7e108fd1a8c2c975b011e4d8262b` | 5899 | `644` → `100644` | `536ceafbcedfbbed91bad241dea5fe1c2db35459` | `exact` |
| `missionmed-hub` | `includes/class-mmed-office-hours.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-office-hours.php` | `d90ff2cbd5ceb5e08f50bc8a541d523b4c667546175d05990dcf86953f166556` | 19809 | `644` → `100644` | `4756934e960620004ff903defe60fe368565a0e3` | `exact` |
| `missionmed-hub` | `includes/class-mmed-priority-engine.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-priority-engine.php` | `13faf5966220f6b15873d8bfadcf300c5fbcc0ad20417de4a6bca68bd0bdb522` | 24226 | `644` → `100644` | `dee3cef915a3e48d5368e73838e8c4b90f017d70` | `exact` |
| `missionmed-hub` | `includes/class-mmed-ranklist.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-ranklist.php` | `91f737468563feeb2e3f64846fe2d443101fe3ee92e1b10279916bf5b2c3a92b` | 15426 | `644` → `100644` | `cafe69b59815e9f6832c59ed01bde3f77db9bfcf` | `exact` |
| `missionmed-hub` | `includes/class-mmed-rest-api.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php` | `2e2a282d05ac876c658b0c5717e4412989b362ce63cc0731f7f97f8187126b16` | 70853 | `644` → `100644` | `96c5963c5449e1375bf7aae295449e7584a4fbde` | `exact` |
| `missionmed-hub` | `includes/class-mmed-session-analytics.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-session-analytics.php` | `a18322189d3687e6ab972cd10cb221d90a5273a9cd85167e6ea3315816d828d8` | 7515 | `644` → `100644` | `d7a8fcc715b5417f910904b62a2d96314210bf90` | `exact` |
| `missionmed-hub` | `includes/class-mmed-session-chat.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-session-chat.php` | `489c3ee150a1994af97ea0fadefbc49bdb733cf1b46aa7e30e087c4c0ada911c` | 12385 | `644` → `100644` | `5938dddf54a96b5b032f0ed133472d6d88a9ade0` | `exact` |
| `missionmed-hub` | `includes/class-mmed-session-manager.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-session-manager.php` | `d5519adfeec29c923896fc75f3da0c7e2a5a30a15fdae13445ca6036dfce9e64` | 46651 | `644` → `100644` | `a9be60568e61abac264a93d085551cfbe71f82ff` | `exact` |
| `missionmed-hub` | `includes/class-mmed-session-reminders.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-session-reminders.php` | `81079e2e234418b3501f6a8b8a9094f925d17c05a6601307e3b8028eb71dbc2f` | 10753 | `644` → `100644` | `5c3276ad323782d570d880ac3a4de8bb02690b02` | `exact` |
| `missionmed-hub` | `includes/class-mmed-ssa-adapter.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-ssa-adapter.php` | `2a4902dd5ef589b09850b5703ba56512d6ef732e7fb2335894113542d970b2a8` | 16651 | `644` → `100644` | `0ee377d4a317124383fd2e4a66dc04c40dc5b7e2` | `exact` |
| `missionmed-hub` | `includes/class-mmed-student-os.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php` | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | 32786 | `644` → `100644` | `3bad641a071cc633c9290a442cdfc8f8f3f53499` | `exact` |
| `missionmed-hub` | `includes/class-mmed-study-schedule.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php` | `2356d2369007db715849a3e2ba5959ac0e4323a04a8c4206b9f8b50bd97c3234` | 7439 | `644` → `100644` | `84fa3f4d89c1e7c1a0f733a41679cb4e329d7833` | `exact` |
| `missionmed-hub` | `includes/class-mmed-supabase-bridge.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-supabase-bridge.php` | `69f7a05b859439e0660ef2828d1c1e24706a78caa22e16f4e3fcc13ee1a892b7` | 10236 | `644` → `100644` | `825676cae71240369396b85850acb6d4054440c3` | `exact` |
| `missionmed-hub` | `includes/class-mmed-task-cpt.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-task-cpt.php` | `0fa8cf3b3e5ce54427b40db396cd68e1a84d4a036efeb93271fee46f32685567` | 21946 | `644` → `100644` | `bf4fab4bdfe72fedaddad94384a4be2266c17532` | `exact` |
| `missionmed-hub` | `includes/class-mmed-templates.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-templates.php` | `998f090d7c8ab1c8a092b3be2e00476e6b66a187f5a7246a47cb7340c16d554e` | 9113 | `644` → `100644` | `12ea1add002ad92db75ca58df3453de12c6eb81b` | `exact` |
| `missionmed-hub` | `includes/class-mmed-todo-engine.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-todo-engine.php` | `39ec30bacdebac5c69d05ca13588764a0ab8c6c079d9cdc4bb203b35117a52ae` | 9615 | `644` → `100644` | `6e33beaa9fd01b5339385bb2f68235de68ccfcaf` | `exact` |
| `missionmed-hub` | `includes/class-mmed-user-meta.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-user-meta.php` | `b4866c64aa47423fec20f4908523e7d9069471a6142761f24e673eb5d7fc4549` | 12765 | `644` → `100644` | `57b0bd227c7d51918af322c499f9de28f5ef6c4b` | `exact` |
| `missionmed-hub` | `includes/class-mmed-webex-client.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-webex-client.php` | `5e3b18e79ee3168f0cdbc71894275de58fd86fe7730d83ea83939e35c6feaffc` | 22941 | `644` → `100644` | `9e8cc3aceb18316799acfa784bb188615433acc1` | `exact` |
| `missionmed-hub` | `includes/class-mmed-welcome-email-admin.php` | `wp-content/plugins/missionmed-hub/includes/class-mmed-welcome-email-admin.php` | `7270f420ac8b4176d4ba1acf2f0e9ad455d3e43fd946ec73e28dd99e9ef087e1` | 39438 | `644` → `100644` | `5a4b59d50f15a2f198227fe06eaab211d37b8de0` | `exact` |
| `missionmed-hub` | `includes/video-dashboard.php` | `wp-content/plugins/missionmed-hub/includes/video-dashboard.php` | `0ce005cdce253c4e045a26c867d00bd76aabd77ac78e50cf8a019c1e344492dc` | 20698 | `644` → `100644` | `8ebcffbd881f0b791d82813c1e52f4ccfe3ad97d` | `exact` |
| `missionmed-hub` | `includes/video-inserter-ui.php` | `wp-content/plugins/missionmed-hub/includes/video-inserter-ui.php` | `91088cf1b86aa98f9e85c5c055b37be8a874709621e34515c1f4cd8ecf77ddeb` | 22113 | `644` → `100644` | `6f39c5c81746b008725cf3116f22f220fa462d12` | `exact` |
| `missionmed-hub` | `includes/video-player.php` | `wp-content/plugins/missionmed-hub/includes/video-player.php` | `a4fdf28ce759b59bb161b244872c47e36ef5be8f19a5bcd67a2aca5d1501b6d9` | 14673 | `644` → `100644` | `2d5a6fbfb72eb51c050174ae301ef74fea986c9c` | `exact` |
| `missionmed-hub` | `includes/video-resolver.php` | `wp-content/plugins/missionmed-hub/includes/video-resolver.php` | `24cc4058315ee0457c072000c5485a5020838fbeec6c59e333a221f38eb0bf4b` | 12421 | `644` → `100644` | `ca0cf45fb089ce08403ef89b6b718c41a2550136` | `exact` |
| `missionmed-hub` | `includes/video-shortcode.php` | `wp-content/plugins/missionmed-hub/includes/video-shortcode.php` | `d52f63e8d626288f9929660573ee013534b383080417aa78fb37b1d26ae25ad3` | 12106 | `644` → `100644` | `f484b34eae9315c286e6a9557f5a6b2411305555` | `exact` |
| `missionmed-hub` | `missionmed-hub.php` | `wp-content/plugins/missionmed-hub/missionmed-hub.php` | `ed02cd301205557b656cb4758e9ba2848d3938a2429647825606da6230c96cad` | 60812 | `644` → `100644` | `43b5289378a7c690b3776db68049a202f1614329` | `exact` |
| `missionmed-hub` | `readme.txt` | `wp-content/plugins/missionmed-hub/readme.txt` | `0f130ef2adfaee093f0a83c6cc7753222ea1db294ce27f7435045a1f44df6e31` | 3339 | `644` → `100644` | `d36789307afdc5f2f5e74415d6bdf6a0f3fa1dbd` | `exact` |
| `missionmed-hub` | `templates/admin-os-shell.php` | `wp-content/plugins/missionmed-hub/templates/admin-os-shell.php` | `aa4b71acff4161d81b1da78e702c861589553be251c5c1001d1785c20090ff54` | 2045 | `644` → `100644` | `f711d9640f051831ddb468c38d95061a088f4af8` | `exact` |
| `missionmed-hub` | `templates/emails/welcome-360.html` | `wp-content/plugins/missionmed-hub/templates/emails/welcome-360.html` | `340dbeb88c9260632c5d471592dab50ee78f7450500c3f818d1dae9bbcf6d3ff` | 44189 | `644` → `100644` | `714cd55bfa5add694b71ec6aa7abb61f91cc9f07` | `exact` |
| `missionmed-hub` | `templates/emails/welcome-drj-drills.html` | `wp-content/plugins/missionmed-hub/templates/emails/welcome-drj-drills.html` | `7768bc3fb93cd2e48e383d0450aead912dae4db95e2a075ebeef9c34278f8d54` | 15057 | `644` → `100644` | `731203ee1a455141b9cb4d8b5b9894fcf9e92573` | `exact` |
| `missionmed-hub` | `templates/student-os-shell.php` | `wp-content/plugins/missionmed-hub/templates/student-os-shell.php` | `efef5d88413924c981e475a678edae083de10cd9d664ab4f057ed9bcc398aea3` | 905 | `644` → `100644` | `6ac53db9995dd9083d33c031691a1c4db8ab1635` | `exact` |
| `missionmed-hub` | `templates/template-hub.php` | `wp-content/plugins/missionmed-hub/templates/template-hub.php` | `00f2a04ce7962b4e8e4d375514fc4ed9f2b20b82cea6420ba75bc34874cc200c` | 786 | `644` → `100644` | `a22d99aac010a1f37dc12faff84cb7b28b778426` | `exact` |
| `mu-plugins` | `arena-route-proxy.php` | `wp-content/mu-plugins/arena-route-proxy.php` | `536cbeb8896f0e92fee992a790c5126cfc5ce826da50e697a8420c9e470420ca` | 25209 | `644` → `100644` | `39c1e0fac1db1d1f2ed4588fdce4658952803067` | `exact` |
| `mu-plugins` | `missionmed-drj-drills-access.php` | `wp-content/mu-plugins/missionmed-drj-drills-access.php` | `ffab495c8d591d2bb500838334090b816282bcee73c6f55524c0c50b31db43ce` | 26210 | `644` → `100644` | `180747241608e12e138a67fb96bf4d089399cd4c` | `exact` |
| `mu-plugins` | `missionmed-hq-auth-handoff.php` | `wp-content/mu-plugins/missionmed-hq-auth-handoff.php` | `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3` | 24719 | `644` → `100644` | `e8211dc5295e54e4557f29a731120abd8403659e` | `exact` |
| `mu-plugins` | `missionmed-hq-proxy.php` | `wp-content/mu-plugins/missionmed-hq-proxy.php` | `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3` | 8308 | `644` → `100644` | `0b7e0d04f302fa9a045437668eb04acbf16bf7b7` | `exact` |
| `mu-plugins` | `missionmed-matrix-account-entry.php` | `wp-content/mu-plugins/missionmed-matrix-account-entry.php` | `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba` | 21023 | `644` → `100644` | `2255a666966ac7d0eac2636484ecb9bc2b85eb6b` | `exact` |
| `mu-plugins` | `missionmed-mr-legacy-popup.php` | `wp-content/mu-plugins/missionmed-mr-legacy-popup.php` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | 14800 | `644` → `100644` | `5f933e1685a0adc50b6d82e22d68ffe368e3aee2` | `exact` |
| `mu-plugins` | `missionmed-mr-legacy-popup_BACKUP_PRE004.php` | `wp-content/mu-plugins/missionmed-mr-legacy-popup_BACKUP_PRE004.php` | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | 14800 | `644` → `100644` | `5f933e1685a0adc50b6d82e22d68ffe368e3aee2` | `exact` |
| `mu-plugins` | `missionmed-performance-boost.php` | `wp-content/mu-plugins/missionmed-performance-boost.php` | `00a51063b4f56366568c96bf3bf276b441875d536c509099e05492d683808ba1` | 52078 | `644` → `100644` | `d9d52f63b115e882eed45072722f40bb0d6d3a8e` | `exact` |
| `mu-plugins` | `missionmed-supabase-session-cookie-auth.php` | `wp-content/mu-plugins/missionmed-supabase-session-cookie-auth.php` | `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f` | 3077 | `644` → `100644` | `7bc34645aee2fb3c69672a6267c82413ba0b1e4d` | `exact` |
| `mu-plugins` | `mm-scheduler-webex-broker.php` | `wp-content/mu-plugins/mm-scheduler-webex-broker.php` | `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455` | 31173 | `644` → `100644` | `027a8954232967de80a7f292396ab6c4250c6b79` | `exact` |

## Production MU files intentionally outside the D9 closure

All `116` non-selected production MU files are retained as path/type/size/hash evidence in T0/T1, but D9-415 does not import or package them. This is the ticket's explicit unrelated-MU exclusion, not an unexplained runtime difference.

| Production path | SHA-256 | Bytes | Commit A state | Reason |
|---|---|---:|---|---|
| `00-arena-anonymous-shell.php` | `afb572bc02fa41e13a62a17e6f4486f750ddd912abedd9eff0a2cfd48f013b28` | 8437 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `00-arena-anonymous-shell.php.BACKUP-MM-SPEED-ARENA-004-20260608-121107.absent` | `15f4724790f46feec18d39419b2e94d46aee37188eb1410270890ebe48e006bb` | 67 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `00-arena-cache-bypass.php` | `a23d370aa4f147c54c4769af6f1488f2d3475113283b2bf5c72a62aeee02f183` | 5521 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `00-arena-cache-bypass.php.BACKUP-MM-SPEED-ARENA-004-20260608-121107` | `0d6df5a844c9354f1802a91fa5f8ae02bdab829c76c9b173e7c28e2bcb24bbd7` | 3482 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `_backup_disabled/missionmed-hq-proxy_BACKUP_20260428_053931_A8-ARENA_LOGIN-Finetune-codex-high-001-e.php` | `ac01316fe6d0877410054874e7caa69900be641cb799c4aadace40481e44b229` | 4524 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `_backup_disabled/missionmed-hq-proxy_BACKUP_20260428_054108_A8-ARENA_LOGIN-Finetune-codex-high-001-e.php` | `ac01316fe6d0877410054874e7caa69900be641cb799c4aadace40481e44b229` | 4524 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `arena-route-proxy.php.BACKUP-MM-SPEED-ARENA-004-20260608-121107` | `6e67877f095666982825af760d4ec347163f116ff7746be6d733212d0da8eae3` | 18831 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `drills-route-proxy.php` | `cded300bfb02e9afe44860f4da650c4ec6c776cd966026fe91f0a6836ffd783d` | 18082 | `present_different` | unrelated MU source outside the D9 Matrix closure |
| `elementor-safe-mode.php` | `295a52a9297001991b92686f4c2a7a3dfe27f434f9493ec4b675c8d70f097a06` | 3894 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `health-check-troubleshooting-mode.php` | `5521685766e0ad1eba6d05e7cb6c125b2a351aff55f0479a3b10b7c276e9bef8` | 52487 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `ivoncall-route-proxy.php` | `e08cc54124f004105117471d367b383728770ad2bb6de71eef4a029195aeb6f5` | 7268 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins.php` | `fac0c7361bdc6c02e150b60aaf02c82044141ef1276afbfd73684d37f8491e13` | 2394 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/css/common.css` | `065c61e6b7adb4ca4c63f2e8110e2a17f5b30d9c494b22c38ec526eb05334c1c` | 2398 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/arrow-down.svg` | `1b8c26b88cc1ae7e59c565b55e62dc093f134adfbbf10d05ede9f51ecb841c20` | 757 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/icon-support.svg` | `6bec9053b13e79502a17e8ec3229c19e2afd32d015f77f3299ec7575bda09b27` | 9839 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/icon.svg` | `2691aee0efd15370eb486fed12860e5b92eaa2c2027caae2aa6b658604310209` | 3796 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/info.svg` | `f8a11ce16f542f5c150d52d99114163ed8af7f147cdb2fbfd50adc44cf7fdd06` | 1653 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/logo-dark.svg` | `d74e37bbb8ef1df596962ef442767b2127f8766cdde2cd4962b8eb0a712fc2d0` | 3027 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/menu-icon.svg` | `e03064f95b0fd41606984aacd5d323fa03c4a6625e10ff67fa5f5c29001a867f` | 7080 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/images/warning.svg` | `e8756ba098f670e6dfa759fef7916b0840849f05da1871677b62e28823ace89f` | 1019 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-da_DK.mo` | `5874a309821c1512cbfba6e790a869344be6baea67b9f11617fcc5418df2af35` | 9868 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-da_DK.po` | `9ec3a2bda62cfdbecc759c5684da970296862d1f5ddb9142e1096b7051d5d399` | 14380 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-de_DE.mo` | `e73633a4badd589de8c5748cda7cec1d3168a2c049f53e33305e148cfdc6f28c` | 10551 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-de_DE.po` | `f20d2f7198464a1ab484b5af1e5848b9e582846b6f7c1ca282372f12d26841a1` | 15063 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-es_ES.mo` | `2f0d5ebd54451104625b9ece505cb3aedfc48f27f9011a25a364a349ed2a824c` | 10533 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-es_ES.po` | `475e29bebbce450b1f995ef0db61f65e7754017d31e328abdf7543c3cdb76cdf` | 15045 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-fr_FR.mo` | `524d98be92ebd506083af95ef748366bfca1bd5b2f8d4270bc4144b8f5d641fb` | 10805 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-fr_FR.po` | `f5b92b990da382270814888843e55cf4e1e73d83b8f9512fdada8534ecba5fe6` | 15317 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-it_IT.mo` | `3eca4b3c5af90ca6a3bc4e5d6248daf89e0720c6b75259de369275d4161d178d` | 10533 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-it_IT.po` | `0bad9708c546b6f948ddd0e9759e54516b09ff376b1b91e083c922a730ceb818` | 15045 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-ja.mo` | `4495216724ff306f2f6e4072ab1f7208bed6e516259ed5accf60734acc73fea1` | 11541 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-ja.po` | `f1bbb79164798f1afac03dca7807939c8802bcb4c22abeccd87034e123be2c93` | 16086 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-nl_NL.mo` | `7e0083ef8bfe4254ca68e108e9220f654c6f3c6f01610a95036f0440b22392b0` | 10089 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-nl_NL.po` | `c223bd72f747d2218003ffd429e5c8ad10f82b713a6bad6ae13c9c62f884dc05` | 14601 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-pt_PT.mo` | `721721a2a812e7dcf8e5a29f2a996d5954e63862ad06cb1d2a11002ffd75aa55` | 10219 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-pt_PT.po` | `9f29cd41ef8285fe15d11c2f604025505d2cdc34f34acd3cd3b22238b9be543d` | 14731 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-sv_SE.mo` | `ddafcd0779db4f9c44db74efd976600eaf3d4fad8c03f33ec3be613e37236771` | 10006 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins-sv_SE.po` | `e6c351615e61b877844135a30da1172155d639d1a95b7bbb1df402df8101bfad` | 14518 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/assets/translations/kinsta-mu-plugins.pot` | `3f522cb09daa3708aa713149e3870a6e8f6cf625bab038084ca68a3ed55ff410` | 12653 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/class-kmp-admin.php` | `938bea88fe41879315e04cb11dbf16e1e1a48a66f65ef10140f329c24342327a` | 12781 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/pages/cache.php` | `2c433d4b36720523df56f082057c91b470ecf00f844f60e904162fff051ad744` | 14398 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/pages/cdn.php` | `f9773d04e5b962a845839ece34963350dfe5beb9c367ff38cf228aff273aa149` | 2158 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/pages/partials/sidebar-support.php` | `14acc72c20b7a1821f4d02f497a426a02a06250bb8ff58fc31d3e52d69e5df9d` | 810 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/admin/pages/settings.php` | `da0b2c433d93e36b603175bf501312159034884b4573c492f663786ee0447bb6` | 1967 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/AdminPage.php` | `aafbe73d15b4bb678722d557dc4435346c55547746cb09b679c17c8e1ff2eec4` | 1760 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge.php` | `984dfd3025e649a2e298dcba02988a37602efcd60af9a5c6eb198ac2b1ac60bb` | 3432 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/ACFController.php` | `62ceeb8f5cd7909566a1db195b19ab5a9d8c3443f376f63492da58d148bdb554` | 779 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/Controller.php` | `fc8e1b4d922dc8a495bf410b808b2aa0b988e561c52e89d8b7574c3452047fba` | 2871 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/ElementorController.php` | `3b4d745704fc7c470969d482debb0c9a87593bc2325b157f2386bf081d74d740` | 593 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WPOptionController.php` | `5bd58d2c63b11e4b78091a2d3b305caf2056f746ddfbcbaaed41e3469dcda76b` | 1150 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WPPostController.php` | `c58f57e25557910be81f8d041ae9e919cc560ab5a21f8ecd4c883b574dc13298` | 3136 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WPThemeController.php` | `1b43036411f96ba0b3a8812b83f50ca85fc05af47736a96fb4e8838b40023aa8` | 1142 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WPThemeHeaderController.php` | `50380335ab6e26de4ee4d64c1fe443a4a42e63773f94951d11356b891e5719fb` | 1055 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WPThemeWidgetController.php` | `1a21e6e311e0228b9ef60887a377f40d1e3da5981922102079735440ef3dbe61` | 1336 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/Autopurge/WooCommerceController.php` | `f119c9c8e954ab07ce24140b1bee878d65d4b93234a2de465e076dfef378f17d` | 2988 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Cache/CustomPaths.php` | `1a43b2e143a17d014706b53ce2bb18f3e9a7a7b3dbc19892c6561ae805452aa7` | 1967 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Commands/Cache/AutopurgeCommand.php` | `87964c3b1e95e5e5dd4e5714d68a5fdddf3916e9c2d4256143867855ea52dd15` | 5426 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Contracts/Autopurgable.php` | `15cb0cc048330a18f968f917117ff18fcd04fab6da2beca84c5bea99b7d835c7` | 518 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Contracts/Describable.php` | `49a3ccbb15f00c5b24f65501fd8d31c1089d02859513942d68309a189a11c718` | 109 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Contracts/Hookable.php` | `05f233ca0d197671ee2c8773132d312cb91ed6448a1bf8fab6d7884736df6021` | 94 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Contracts/Nameable.php` | `4eb579b58be24a71c9263838d71d9f91e16971814e13e7f2bde706d1c4c27622` | 99 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Contracts/Purgeable.php` | `8cde7264731acbeddba246cfd355e5ee41c6c986619aa2eaeab747c8f0fc8555` | 234 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/app/Helpers/Whitelabel.php` | `e0fdb17060cacb2dd36b5e11406719d6e348fbdabb3ecda7b5a8c30a6e911a52` | 2088 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/bootstrap.php` | `a53b418915f970aa07b34d4cc18f1b2f4bb8b1b692ff8af15dddd184f82b4b07` | 684 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/cache/class-cache-purge.php` | `0ad40fe4c17b36cdcf20914cba7dcb2a615696a1adbc35f61ef5848d817405af` | 21713 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/cache/class-cache.php` | `28c60318fb0ccc757cbc6feb4950e2f063724755bfc6bc0623acdf3fa2c578a9` | 4058 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/class-kmp.php` | `d0cb25aade022531708c7b36db4e2fd8fd36e6fdebf01ed2a4e6325f147b6c93` | 3347 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/compat/compat.php` | `0b3c0af15e0557743ba45339c87d70af7b16ca51617945adaf698526b6586414` | 720 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/compat/third-party/class-cdn-enabler.php` | `63060b0fd79dada0ca04f2888ccc036ce5776d93e4fa212cef88a5a36f00e37f` | 940 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/compat/third-party/swift-performance.php` | `53520cc3b6b4aae3658791dd7ae764c03454bf23f0160d8da307367881b072e7` | 1660 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/compat/third-party/wordfence.php` | `2c6a9595fe4ee98de4cdbacf6c1332a96a95c55ef803854ee499d5ebaec3ac10` | 1579 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/compat/third-party/wp-rocket.php` | `6e1b44084eb6ce114e7c94ec804c77a9b8aeda2c0c5797ae16f132d2c741a32e` | 2010 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/inc/functions.php` | `d4c23dac37b507afb1a12ce008c2743371eafafc4e731f402f22ccb59d0c245a` | 1819 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/inc/versions.php` | `e882f109fa33ee09a0f70742b010b6fd52f8a6c5a8e67f31683d5bec129bac36` | 426 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/security/class-banned-plugins.php` | `338f305ab11bccbe915617c9273e3d3bff2d6a2591b10c9e0322fdc5187cedd7` | 20780 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/utils/utils.php` | `ef40012597d0a87c2b8aa5f089e04e4136b21785f5f4b82ae7e00775c67ae445` | 1628 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/autoload.php` | `abdc7a7a2b0b758ecd9b452ef54284a18b8749729afeb6d9e14c4e29cbc9dc52` | 748 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/ClassLoader.php` | `d4b2313e562edf942838ec316d983c1a3459ca67da3e5658e861200b0b3693c2` | 16378 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/InstalledVersions.php` | `1e4525198301d1ed1f87ac3df2a8555a6f139f8df30a703d0b775a61963c96e4` | 17395 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_classmap.php` | `8cb651a94056e05ce17003948e258e61741228b021c5e3f1d66bf9f7c7160e1c` | 2478 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_files.php` | `04516072fd87aa4c58117382eb8c3a5467af8ea7d5f4ab3c371b86254af73fc0` | 328 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_namespaces.php` | `90bd91c2969d4421dc427e469bfaa9f6f567ca26704f7242de7ab0d2d73fedff` | 148 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_psr4.php` | `0f2fa70af81b59a1e3d2159a21ab62d5ffe168533f9efb3c798d969946943aa0` | 209 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_real.php` | `3fe24c8fe2c2ec4559a5c283b0f6a6a799b86b61ed222b773a53a3b820347d31` | 1622 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/autoload_static.php` | `06670e81c399faf5d5ba29dab922a1077751a0a4f4a74128f0859e88d0b104fa` | 3909 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/vendor/composer/installed.php` | `ea1707a9ebfbf879ebce2aa2be0745bc603d55c2b2068f90869ca3f5d1de2971` | 779 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/wp-cli/class-kmp-wpcli.php` | `69caf5a1289ff3c294a1faecef754d7b859285a9dd8a1f5b39a77f1002ec703b` | 2137 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/wp-cli/commands/class-cache-purge-command.php` | `2cce8f85826d2887edfcff3a9381881230334e693788a2b8b2644e30fd5e9c29` | 4633 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `kinsta-mu-plugins/wp-cli/commands/class-plugin-list-command.php` | `86489cfca8344c8b03e473a0f2bcc38c569a99a889034058b2bedbeacc58d9bb` | 5473 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-arena-identity-guard.php` | `774252c3437967ac5300a259a049e357a0ce4dcda7d0899405ecf3fe50b9af01` | 5894 | `present_exact` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-auth-cookie-scope.php` | `3975d79ff80acffaa7189bbd1e6084bbaf386381463f5275f7d730e8fe48b8e4` | 4664 | `present_exact` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-drills-oncall-enrollment.php` | `3ea27f4d2fd51e9e2bfded66a7ff9c7f79fe7dc5f93cdad7c7382847dc89f106` | 14008 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-homepage-asset-cleaner.php` | `e3756d681c84024d659d808631f33b8d5025f94f4b3a1f790e36e334b7a373f8` | 5115 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-homepage-ld-unload.php` | `c944681d176e49442662b7b6870aca1b47a5583c2ff304641e59d8251511e4cd` | 12536 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-hq-route-proxy.php` | `d604f3adce2bcfc5b0cdadc160647155fc2729c46465b2db1bcbbbdfdab7d338` | 36626 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-launch-sev1-fixes.php` | `0395ce6aad8fe74fdae3c9beb2482b1246f8c9784d0a888b9fada98a4434274c` | 49914 | `present_exact` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-legacy-residency-transition.php` | `3729e85d64a6bbba7a3b590ef3d726d56e36b2039f58e4071c970f6732e9ea71` | 16066 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-login-flow-restore.php` | `565397ed7f5f25cc9f8d10cb36a10b34c9123e6361e2d4542bc2e8aef339ce39` | 7233 | `present_exact` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-B1-STORYFORGE-100-e-e-20260628T152537Z` | `3acff1904fac66f1e2af2e9fde2fb6e3bcdb4ac59c0546954253d0045d1d0450` | 50820 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-HOME-011-20260607-113743` | `d2f9a7451bb861426559adfb39796a57ef899dabbbecc72725d54d7f043385f6` | 14618 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-HOME-012-20260607-122029` | `05dced354fbdf45850a0e1a06e2adbccc751a28e5e2e674224556637cc23f158` | 18922 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-HOME-016-20260607-150501` | `fdc9a923406d7c49414a22946d588a0f9ef73f469464d2737535f57b033de574` | 21530 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-MR-001-20260607-175153` | `4ed299adf6b851428397d41b308f7ef7a5d62a4a747e22fd14dbf3b278fabbb5` | 23336 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-MR-002-20260607-195143` | `0eac35d55176ed7c515e2508da474334be7b9e208797e44115e4f4c24e29ddae` | 23822 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-MR-004-20260607-212538` | `3387eeaf3f06b3a6449da43adb0332611143c78e7eeb24f59e3e3e742ad4bead` | 27129 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-MR-005-20260607-223939` | `3d93dc5f37c23f4654a02288c1ea4cdd6d277bd8580e4bfbe262a29b4eda7ce7` | 45429 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.BACKUP-MM-SPEED-MR-006-20260608-014232` | `0fc8dffd10ca214f981281d937264773f1f02a05e5d7748af2b13de6fdfc00df` | 47453 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-performance-boost.php.bak_v2` | `725cdef43c621f815b97eae0c5280eef8a6233416f3f21d377becc2eb51ae8d2` | 8125 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-rlq-bff.php` | `24d39a1034886a3f5fc983dd8f41da0475b9ebdab0abfcc00fcff87c081a4e93` | 70309 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `missionmed-wc-stripe-division-router.php` | `3dcb3f8dfbaea89ff3f4d6c1ecf98933d5225260238f7450d4309534f64feacf` | 20778 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `mmi-instructor-panel-loader.php` | `2aed9fe3a6693d0bdf6be4eadf5ab96454dab04d2daa879d04850a7faf2e33fc` | 7438 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `mmi-mixed-cart-guard.php` | `2a6b1f38c30af240da696f4f1778a6a3febd9bd6eebb73fb03ef2d23efe55e4b` | 17117 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `stat-route-proxy.php` | `ebd284c602a9a369b22a7ea0eb473f758f3692c966b0ecf12699e14238fa0ab6` | 8306 | `present_different` | unrelated MU source outside the D9 Matrix closure |
| `wp-config.php.bak1402` | `190cdd15444b5a77c893e837ab8cfd518521d8a300ccad9d21609bbd059f8649` | 3545 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `zoom-drill-notes-preview-route.php` | `6204e3038f3fcc08fd81f41e33f680614c18b21a18466744a7cf87ddef592e83` | 6966 | `absent` | unrelated MU source outside the D9 Matrix closure |
| `zoom-drill-notes-preview/page.php` | `b8bf7134e4b72cd939b48d86f60626ca4066bb72202d9679e5675296ee1183c8` | 51184 | `absent` | unrelated MU source outside the D9 Matrix closure |

## Commit A MU files not observed in production

`6` pre-existing repository MU files were absent from the full T0/T1 production observation. They are outside the D9 closure and the deterministic Matrix package; D9-415 does not change them.

| Git path | Commit A SHA-256 | Bytes | Reason |
|---|---|---:|---|
| `wp-content/mu-plugins/arena-bypass.php` | `bdb80634850d3d46e6eaf0e4ad81ef63b4da021ff9b2784332206f50abb6ad62` | 625 | pre-existing repository MU source outside the D9 Matrix closure |
| `wp-content/mu-plugins/arena-route-proxy_BACKUP_20260427_101948_A7-ARENA_ECO_FINETUNE-codex-high-2000-i.php` | `c775b9f41986eb2ea0683246922abb53129c96186e8d66dbe1944e66e09709c2` | 9364 | pre-existing repository MU source outside the D9 Matrix closure |
| `wp-content/mu-plugins/arena-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php` | `59c12c16aedad160484a848ff1babb2da4b52b2bd287e7964ffa5a1bca323b44` | 13089 | pre-existing repository MU source outside the D9 Matrix closure |
| `wp-content/mu-plugins/missionmed-global-auth-ui.php` | `42b33e97870bb22dd6ea2ae6efacca7db1c130308ec833547d411bacdc1de38b` | 10479 | pre-existing repository MU source outside the D9 Matrix closure |
| `wp-content/mu-plugins/mmvs-drills-proxy.php` | `13298a5ebd48ed6bcb7d835550210e6254d2141ccb054034e2d91813f8dfca5e` | 2598 | pre-existing repository MU source outside the D9 Matrix closure |
| `wp-content/mu-plugins/stat-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php` | `70a2cc2a8a2fa4275f508fc324450584bbd55a63c80618808df6bf001504f9b9` | 2820 | pre-existing repository MU source outside the D9 Matrix closure |

## Provenance gate

There are zero unexplained executable or runtime differences inside the selected closure. Provenance passes. This evidence authorizes safe source normalization only; it is not deployment approval.
<!-- END VERBATIM FILE: D9_415_PRODUCTION_TO_GIT_HASH_MAP.md -->

<!-- BEGIN VERBATIM FILE: D9_415_CALENDAR_CSS_RECONCILIATION.md -->
# D9-415 Calendar CSS Reconciliation

Status: **PASS — CURRENT AND FORMER STATES PRESERVED**

## Current observed production state

- Runtime path: `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css`
- SHA-256: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`
- Commit A path: same runtime path
- Commit A result: exact production hash and byte-size match
- Immutable preservation: commit `c340a3a87732f7dc4afb06c01e4586239a050495` and tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`

This is the CSS served by the Kinsta origin and public delivery in the prior direct verification and captured again in the quiescent T0/T1 snapshot. It is the honest observed-production baseline for source recovery.

## Former lock state

- Former lock SHA-256: `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385`
- Historical source: the B1-102 pre-normalization backup created at `20260713T145356Z`
- Branch-local non-runtime preservation: `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/former-lock-student-os-calendar-v4.css`
- Verification: exact SHA-256 match

The historical file is outside `wp-content`, outside packaging, and non-autoloaded. It is preserved solely for provenance and rollback analysis.

## Reconciliation decision

The current observed CSS remains the canonical source byte. The former lock CSS remains historical evidence. D9-415 does not overwrite either state, modify the protected global lock, deploy CSS, or clear cache. Any future rollback or runtime-lock change requires its own approved change path and browser validation.
<!-- END VERBATIM FILE: D9_415_CALENDAR_CSS_RECONCILIATION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_MU_PLUGIN_BACKUP_REMEDIATION.md -->
# D9-415 MU-Plugin Backup Remediation

Status: **SOURCE-ONLY QUARANTINE COMPLETE; PRODUCTION UNCHANGED**

## Finding

The quiescent production snapshot contained both `missionmed-mr-legacy-popup.php` and the executable top-level `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. Both files were 14,800 bytes with SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`. WordPress auto-loads top-level MU-plugin PHP, so the backup filename did not make the second copy inert.

## D9-415B source action

- Preserved the exact observed file at `_SYSTEM/FORENSICS/D9_415/MU_PLUGIN_BACKUPS/missionmed-mr-legacy-popup_BACKUP_PRE004.php`.
- Removed it only from the canonical source top-level MU directory.
- Kept `missionmed-mr-legacy-popup.php` unchanged as the intended-active runtime file.
- Added `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_MU_INTENDED_ACTIVE.json` with the nine intended-active Matrix MU files and exact hashes.
- Added `_SYSTEM/scripts/validate_d9_matrix_mu_active_set.py`. It validates source hashes and quarantine integrity; strict-package mode fails on backup/old/copy/disabled/archive patterns and on any unexpected executable top-level PHP.

No `missionmed-hub` byte and no other MU-plugin behavior changed.

## Pre-existing repository exclusions

Three April-era Arena/STAT backup-named PHP files already exist in the repository, were absent from the complete T0/T1 production MU observation, and are outside the ten-file D9 closure. The ticket forbids changing any other MU-plugin behavior, so D9-415 does not move them. They are explicitly excluded from the D9 package, recorded in the intended-active manifest, and would fail strict validation if introduced into a package/runtime root.

## Production boundary

Production still contains and auto-loads `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. D9-415 made no production mutation, cache change, deployment, WordPress change, database change, authentication change, or entitlement change. Removing the production copy requires a later founder-approved remediation with backup, validation, rollback, and cache discipline.

The immutable D9-415A commit and tag retain the exact observed state for provenance and rollback evidence. The D9-415B source head is safer but is still not approved for deployment. D9-416 remains required before implementation or release.
<!-- END VERBATIM FILE: D9_415_MU_PLUGIN_BACKUP_REMEDIATION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_RUNTIME_LOCK_RECONCILIATION.md -->
# D9-415 Runtime Lock Reconciliation

Status: **SOURCE PROVENANCE RECONCILED; GLOBAL LOCK UNCHANGED**

## Result

Immutable commit A maps all ten protected production files. Nine match the active protected lock. `class-mmed-student-os.php` is the sole mismatch: production and commit A are `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`, while the former lock byte is `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.

Founder Decision 002 authorizes the exact current controller only as the observed source-recovery baseline. It does not approve Y1-CAM-4005 entitlement behavior. The former controller is preserved unchanged at `_SYSTEM/FORENSICS/D9_415/CONTROLLER_ROLLBACK/former-lock-class-mmed-student-os.php`; the current controller remains in commit A.

## Calendar CSS

The current observed and now active-lock Calendar CSS is `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`. The former lock CSS `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` is preserved at `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/former-lock-student-os-calendar-v4.css`. Neither byte was edited.

## Branch-local authority

`_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_RUNTIME_SOURCE_LOCK.json` records the canonical repository, recovery branch, worktree, plugin root, exact baseline identity, safe source head at Phase 7, protected hashes, rollback locations, source-only MU quarantine, and open authority gates. It is branch-local evidence; it does not supersede or weaken `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`.

## Open authority

- `G-D9-4`: OPEN.
- Database authority: OPEN — D9-416 required.
- Authentication and entitlement authority: OPEN — D9-416 required.
- Feature-flag, staging, and deployment authority: OPEN — D9-416 required.
- Scheduler's mutable CDN HTML dependency remains an explicit unresolved authority/reproducibility risk.
- `D9-420`: BLOCKED.

D9-415 made zero production, cache, database, authentication, entitlement, feature-flag, CDN, or protected-global-lock mutations.
<!-- END VERBATIM FILE: D9_415_RUNTIME_LOCK_RECONCILIATION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_CANONICAL_REPOSITORY_DECISION.md -->
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
<!-- END VERBATIM FILE: D9_415_CANONICAL_REPOSITORY_DECISION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_IMPLEMENTATION_HOME_LOCK.md -->
# D9-415 Implementation Home Lock

Status: **ACTIVE FOR SOURCE RECOVERY ONLY**

The sole implementation home for recovered Matrix source is:

`https://github.com/brinyu13/missionmed-hq.git` → `d9-matrix-plan-415-source-recovery` → `/Users/brianb/MissionMed_worktrees/D9-MatrixPlan-415`

The repository base is `origin/main` at `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`. The exact observed baseline is commit `c340a3a87732f7dc4afb06c01e4586239a050495`, tree `2a43327429214fdf1c161aa9adf297fabac155bd`, with the non-deployable annotated tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`. The Phase 7 safe source head is commit `9469437d2ac5010563e59b6fdc00a9fe48548a80`.

The machine-readable lock is `D9_415_IMPLEMENTATION_HOME_LOCK.json`, byte-identical to `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_RUNTIME_SOURCE_LOCK.json` at creation.

This lock establishes where source work occurs. It does not grant database, authentication, entitlement, feature-flag, staging, deployment, production-write, cache, or CDN authority. `G-D9-4` stays open, `G-D9-5B` stays `OPEN — D9-416 REQUIRED`, overall `G-D9-5` stays `PARTIAL`, and D9-420 stays blocked.
<!-- END VERBATIM FILE: D9_415_IMPLEMENTATION_HOME_LOCK.md -->

<!-- BEGIN VERBATIM FILE: D9_415_REPRODUCIBLE_PACKAGE_REPORT.md -->
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
<!-- END VERBATIM FILE: D9_415_REPRODUCIBLE_PACKAGE_REPORT.md -->

<!-- BEGIN VERBATIM FILE: D9_415_CI_VALIDATION_REPORT.md -->
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
<!-- END VERBATIM FILE: D9_415_CI_VALIDATION_REPORT.md -->

<!-- BEGIN VERBATIM FILE: D9_415_DEPLOYMENT_LINEAGE_PLAN.md -->
# D9-415 Deployment Lineage Plan

Status: **LINEAGE DEFINED; DEPLOYMENT NOT AUTHORIZED**

## Proven source chain

1. Quiescent direct production snapshot: T0/T1 normalized manifest `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`.
2. Exact observed baseline: D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495`, protected by the non-deployable annotated tag.
3. Source-only backup quarantine: D9-415B `9469437d2ac5010563e59b6fdc00a9fe48548a80`.
4. Source/lock reconciliation: D9-415C `e12cd99aa9c019a6f99325c0b961aa50db945472`.
5. Deterministic package: 129 tracked source files, source manifest `a650686889a6ddc22664ed890b6ff7b80fc3c1e475282723b8542d05f3967bc5`, archive SHA-256 `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`.
6. D9-415D adds validation only; later D9-415 closeout commits must not change the pinned runtime source.
7. The recovery branch may be reviewed only through a draft, do-not-merge pull request.

## Mandatory future gates

No package from D9-415 may be staged or deployed. D9-416 must first resolve database, authentication, entitlement, authority-mode validation, `revocation_checked`, LearnDash-current-access behavior, feature flags, mutable Scheduler CDN authority, staging, deployment, cache, rollback, and production MU remediation. D9-360 remains product/visual/interaction authority.

Only a later founder-approved run may define a deployable release from a reviewed commit, create a new production backup, pin every mutable dependency, validate a staging environment, produce a release-specific package, verify origin and public hashes, perform browser regression, and update the protected runtime lock. That later lineage must reference the exact approved commit and must not repurpose the D9-415A evidence tag.

This run performs none of those future actions. `G-D9-4` and `G-D9-5B` remain open, overall `G-D9-5` remains partial, and D9-420 remains blocked.
<!-- END VERBATIM FILE: D9_415_DEPLOYMENT_LINEAGE_PLAN.md -->

<!-- BEGIN VERBATIM FILE: D9_415_ROLLBACK_PLAN.md -->
# D9-415 Rollback Plan

Status: **ROLLBACK EVIDENCE SEALED; NO RUNTIME ROLLBACK REQUIRED**

Production was never changed by D9-415, so there is no D9-415 production rollback to execute.

## Source recovery points

- Exact observed production: commit `c340a3a87732f7dc4afb06c01e4586239a050495` and tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`. This state includes the auto-loaded backup MU file and is evidence-only, not deployable.
- Safe source quarantine: commit `9469437d2ac5010563e59b6fdc00a9fe48548a80`.
- Reconciled source authority: commit `e12cd99aa9c019a6f99325c0b961aa50db945472`.

## Preserved historical bytes

| State | SHA-256 | Preservation |
|---|---|---|
| Current Calendar CSS | `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e` | Commit A runtime path |
| Former lock Calendar CSS | `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` | `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/` |
| Current controller | `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` | Commit A runtime path |
| Former controller | `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` | `_SYSTEM/FORENSICS/D9_415/CONTROLLER_ROLLBACK/` |
| Observed backup MU byte | `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b` | Commit A active path and later non-runtime forensics |

## Future rollback requirements

Any later deployment must first create its own production backup and must define atomic restore steps for the plugin, intended MU set, cache state, and protected lock. It must validate origin/public hashes and Matrix routes after both deploy and rollback. Restoring the former controller would also restore different entitlement semantics and therefore requires D9-416 authority; it is not a mechanical fallback. The Scheduler adapter's mutable CDN HTML must be separately pinned or backed up before any release because the Git package alone cannot roll that external runtime back.

No rollback command, cache purge, production copy, WordPress mutation, database mutation, or CDN mutation is included or authorized here.
<!-- END VERBATIM FILE: D9_415_ROLLBACK_PLAN.md -->

<!-- BEGIN VERBATIM FILE: D9_415_SUBAGENT_WAVE_2_REVIEW.md -->
# D9-415 Subagent Wave 2 Review

Ticket: `D9-MATRIX-PLAN-415`

Wave status: **4/4 COMPLETE**

Final review verdict: **PASS — ZERO UNRESOLVED P0/P1**

## Reviewer 1 — provenance and hash chain

### P0 findings

None.

### P1 findings

None.

### P2 findings

- Hosted CI was pending at review time and later passed on PR #9.
- The global lock intentionally retains the former controller; D9-416 remains required.
- Production still auto-loads the backup MU file; the branch is non-deployable.

### Evidence and verdict

The reviewer independently verified all 135 production-to-Git mappings, T0/T1 equality, tag object/target, current and historical controller hashes, A→B→C→D separation, and zero protected global lock changes. Verdict: **PASS, high confidence**.

## Reviewer 2 — security and data safety

### P0 findings

None.

### P1 findings

None.

### P2 findings

- Three inherited Arena/STAT backup-pattern PHP files predate D9-415 and are excluded from the package; never deploy the repository MU directory wholesale.
- The scanner and production hash map should be included in workflow path filters.
- Candidate sets should remain hash-scoped.

### Evidence and verdict

The reviewer verified the 134-file redacted scan, 125-file plugin, nine intended-active MU files, absence of the Matrix backup from the active source path, byte-correct forensic preservation, package exclusions, and read-only CI. Verdict: **PASS, high confidence**. The workflow-path advisory was resolved by D9-415E.

## Reviewer 3 — reproducibility and CI

### P0 findings

None.

### P1 findings

1. Mutable JSON policy/lock inputs could be changed together to repin source and weaken boundaries.
2. Syntax checks returned a non-failing skip when PHP or Node.js was unavailable.
3. Workflow filters omitted the hash map and scanner, while the scanner was executed without dependency sealing/command scanning.

### P2 findings

- Pin checkout by immutable commit and disable persisted credentials.
- Constrain the archive root to a single safe component.
- Keep entropy/email candidate identity hash-scoped.

### Required fixes and disposition

All three P1 findings and the first two P2 hardening items were independently reproduced and fixed in D9-415E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`. The full validator passed in a detached precommit tree, at the real E commit, in a fresh clone, and on GitHub Actions. Verdict after fix: **PASS**.

## Reviewer 4 — release and rollback

### P0 findings

None.

### P1 findings

- The required exact D9-416 inputs file was not yet created.
- The run state, execution report, and no-production-mutation attestation still described the Phase-1 stop.

### False positives rejected

- The former controller was not restored.
- Both Calendar CSS states are preserved.
- D9-415B does not claim production MU remediation.
- The generated package is non-deployable.

### Required fixes and disposition

These were mandatory closeout-document gaps rather than runtime defects. D9-415F creates `D9_415_D9_416_NEXT_RUN_INPUTS.md` and refreshes the final state, execution report, and mutation attestation. Verdict after closeout: **PASS**.

## Mandatory controller question

Does the recovered controller exactly match authorized current production hash `23da5c...`, while the former `c0a538...` controller is preserved as historical evidence and not silently restored?

**YES.** Runtime source, D9-415A, D9-415C, and the package manifest use `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`. The former `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` byte exists only in non-runtime forensic rollback evidence.

## Main-agent adjudication

- Valid Wave 2 P0: 0.
- Valid Wave 2 P1: 5, comprising three validation defects and two closeout-document gaps.
- P1 resolved in D9-415E: 3/3 validation defects.
- P1 resolved in D9-415F: 2/2 closeout-document gaps.
- Remaining P0/P1: **0**.
- D9-415E was required and is not empty.
<!-- END VERBATIM FILE: D9_415_SUBAGENT_WAVE_2_REVIEW.md -->

<!-- BEGIN VERBATIM FILE: D9_415_NO_PRODUCTION_MUTATION_ATTESTATION.md -->
# D9-415 No Production Mutation Attestation

Ticket: `D9-MATRIX-PLAN-415`

Scope: the entire D9-415 run, including the Founder-002 resume, T0/copy/T1 snapshot, source import, commits A–E, Wave 2, branch review, packaging, GitHub publication, and closeout.

| Mutation class | Count | Attestation |
|---|---:|---|
| Kinsta/WordPress production files | 0 | No production file was written, moved, deleted, normalized, or restored. |
| WordPress options, activation, rewrites, users, or entitlements | 0 | No WordPress state mutation occurred. |
| Database/Supabase | 0 | No query, migration, policy, function, or data mutation occurred. |
| Cache/CDN | 0 | No purge, refresh, upload, invalidation, or object mutation occurred. |
| Feature flags | 0 | No flag value or authority changed. |
| Authentication/authorization/entitlement behavior | 0 | Current behavior was observed and preserved in source only; it was not approved or modified. |
| Deployment/release | 0 | No package was uploaded or deployed. |

Production activity was limited to the authorized read-only controller recheck and the single inbound T0/copy/T1 forensic snapshot. T0 and T1 were identical. All later work used the sealed local snapshot and Git history.

The source-only quarantine in D9-415B has **not** remediated production. Production still auto-loads the backup-named MU file, and any production remediation requires separate founder-approved authority.

Git and GitHub writes were limited to the authorized recovery branch, immutable provenance tag, and draft PR #9. The protected global Matrix lock, canonical passport, MissionMed OS doctrine, production, database, cache, flags, auth, and entitlements were not modified.
<!-- END VERBATIM FILE: D9_415_NO_PRODUCTION_MUTATION_ATTESTATION.md -->

<!-- BEGIN VERBATIM FILE: D9_415_TEST_REPORT.md -->
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
<!-- END VERBATIM FILE: D9_415_TEST_REPORT.md -->

<!-- BEGIN VERBATIM FILE: D9_415_RISK_REGISTER.md -->
# D9-415 Final Risk Register

No unresolved D9-415 source-authority P0/P1 remains.

| ID | Final severity/status | Risk | Final control / disposition |
|---|---|---|---|
| R-001 | RESOLVED FOR SOURCE RECOVERY | Production controller differed from active global lock. | Founder Decision 002 authorized exact current hash `23da5c...`; both bytes preserved; global lock untouched. |
| R-002 | DEFERRED TO D9-416 | Current controller changes entitlement evaluation. | Preserved without approval or behavior edit; D9-416 adjudicates the future access contract. |
| R-003 | RESOLVED | Production might not be quiescent. | Identical 287-entry T0/T1 manifests and zero local-copy mismatches. |
| R-004 | RESOLVED | Secret/private/student data might enter Git. | Runtime and branch-wide redacted scans passed; zero unreviewed high-confidence/private-data candidate. |
| R-005 | RESOLVED | Partial import might omit dependencies. | Complete 125-file plugin plus source-evidenced ten-file MU closure; Wave 2 independently verified. |
| R-006 | OPEN D9-416 OPERATIONAL RISK | Executable backup remains in production. | Canonical source-only quarantine passed; production remediation remains separately gated. |
| R-007 | RESOLVED | Local candidates might create false provenance. | Direct production snapshot, 135 exact mappings, immutable A/tag. |
| R-008 | RESOLVED | CI trust could be weakened by mutable inputs or skipped tools. | D9-415E sealed trust anchors, required tools/counts, pinned checkout, and covered every consumed input. |
| R-009 | ADVISORY / OTHER OWNERS | Three inherited Arena/STAT backup-pattern files remain in the wider repo. | Absent from production T0 and package; never deploy the repository MU directory wholesale. |
| R-010 | OPEN D9-416 | Scheduler HTML is mutable CDN content. | Exact URL recorded; D9-416 must set source/hash/deploy/cache/rollback authority. |
| R-011 | P2 PROVENANCE DEBT | Bundled Webex adapter lacks deterministic upstream-source provenance. | Exact shipped byte preserved and scanned; future dependency provenance work remains. |
| R-012 | ADVISORY GOVERNANCE DEGRADATION | D9-415 is absent from MissionMed OS mission registry. | Exact founder packet governed scoped work; no unauthorized registry mutation. |
| R-013 | ACCEPTED IMMUTABLE-BASELINE EXCEPTION | Full branch `git diff --check` reports production CRLF/trailing whitespace. | Do not normalize immutable production/evidence bytes; authored E/F deltas are whitespace-clean. |
| R-014 | EXTERNAL DEFAULT-BRANCH ADVISORY | GitHub reported pre-existing dependency alerts on `main` during push. | Outside D9-415 scope; no dependency or production change inferred. |

Gate effect: R-002, R-006, and R-010 keep `G-D9-5B` open and D9-420 blocked, but do not prevent `G-D9-5A` from passing.
<!-- END VERBATIM FILE: D9_415_RISK_REGISTER.md -->

<!-- BEGIN VERBATIM FILE: D9_415_AUTHORITY_CONFLICT_REGISTER.md -->
# D9-415 Final Authority Conflict Register

No authority conflict was silently resolved.

| ID | Final status | Conflict | Resolution / routing |
|---|---|---|---|
| C-001 | RESOLVED FOR SOURCE RECOVERY | Production controller `23da5c...` versus active global lock `c0a538...`. | Founder Decision 002 authorizes exact current byte for source recovery; former byte remains rollback evidence; global lock unchanged. |
| C-002 | DEFERRED TO D9-416 | Observed controller is entitlement-significant, while D9-415 cannot approve entitlement authority. | Preservation is not approval; D9-416 decides intended semantics and access contract. |
| C-003 | RESOLVED AS TIME-SCOPED PROVENANCE | D9-410 hashes versus newer observed runtime. | Both baselines retained with timestamps and direct mappings; current D9-415 snapshot governs source recovery. |
| C-004 | RESOLVED BY BRANCH-LOCAL EVIDENCE | Newer active Matrix manifest is in a protected dirty root. | Read as evidence only; no protected root mutation; branch-local lock records the discrepancy. |
| C-005 | RESOLVED | Exact baseline includes shipped residue while package must be safe. | A/tag preserve all 125 plugin files; policy excludes five documented non-runtime residues from the 120-file package set. |
| C-006 | ROUTED TO OTHER OWNERS | Wider repository contains inherited Arena/STAT backup-pattern MU files. | Matrix package selects only nine intended-active files; other product owners must quarantine their files before general deployment. |
| C-007 | ADVISORY | D9-415 absent from MissionMed OS registry. | Founder packet governs this bounded mission; registry and doctrine remain untouched. |
| C-008 | DEFERRED TO D9-416 | Source authority is recovered but data/auth/deployment authority is open. | `G-D9-5A` PASS; `G-D9-5B` OPEN; overall G-D9-5 PARTIAL; D9-420 BLOCKED. |
<!-- END VERBATIM FILE: D9_415_AUTHORITY_CONFLICT_REGISTER.md -->

<!-- BEGIN VERBATIM FILE: D9_415_D9_416_NEXT_RUN_INPUTS.md -->
# D9-415 → D9-416 Exact Next-Run Inputs

This is an evidence and decision-input packet only. It is not a D9-416 prompt and contains no implementation or deployment instructions.

## Source authority now established

- Canonical repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Canonical branch: `d9-matrix-plan-415-source-recovery`.
- Base: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Observed production baseline: D9-415A `c340a3a87732f7dc4afb06c01e4586239a050495`.
- Baseline tag: `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`.
- Runtime source commit used by deterministic packaging: D9-415C `e12cd99aa9c019a6f99325c0b961aa50db945472`.
- Review-fix commit: D9-415E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`.
- Draft PR: [#9](https://github.com/brinyu13/missionmed-hq/pull/9), **DO NOT MERGE**.
- Package SHA-256: `afd9a1e6a236413552c6477b1f959ac5d750233724ceb14dd2351393430dae5f`, non-deployable.

## Founder-002 behavior boundary

- Authorized current production controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`.
- Previous locked controller: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Current byte is production provenance.
- Previous byte is historical rollback evidence only.
- Entitlement behavior is **OBSERVED AND PRESERVED, NOT APPROVED**.

D9-416 must independently adjudicate the intended future access contract, including:

- entitlement behavior;
- authority-mode validation;
- `revocation_checked` semantics;
- LearnDash-current-access semantics;
- authentication consequences;
- authorization consequences;
- the final interaction among WordPress, LearnDash, Matrix, and upstream identity/entitlement authority.

## Data and operational authority still open

D9-416 must decide, without inferring approval from D9-415:

- database schema/data/RLS/function authority;
- feature-flag authority;
- staging environment and acceptance authority;
- deployment and rollback authority;
- cache/CDN invalidation authority;
- authentication/session/bootstrap/exchange authority;
- production MU-plugin backup remediation authority.

Production still auto-loads `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. D9-415 quarantined it only in canonical source. Any production removal/move requires separate founder approval and its own backup, verification, cache, and rollback controls.

## Scheduler CDN input

- Mutable dependency URL observed in source: `https://cdn.missionmedinstitute.com/html-system/LIVE/scheduler/scheduler_v1.html`.
- D9-416 must establish canonical source, immutable hash/version pin, backup, deploy, cache, verification, and rollback authority for that HTML.

## Calendar and controller rollback evidence

- Current Calendar CSS: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`.
- Former Calendar CSS: `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385`.
- Current controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`.
- Former controller: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Forensic paths are recorded in the branch-local runtime source lock and rollback plan.

## Required gate posture on entry

- `G-D9-4`: OPEN.
- `G-D9-5A CODE SOURCE AUTHORITY`: PASS after D9-415 final remote/mirror verification.
- `G-D9-5B DATA-AUTH AUTHORITY`: OPEN — D9-416 REQUIRED.
- Overall `G-D9-5`: PARTIAL.
- D9-420: BLOCKED.

D9-416 must not assume that source recovery approves entitlement semantics, authorizes production remediation, makes the package deployable, or opens D9-420.
<!-- END VERBATIM FILE: D9_415_D9_416_NEXT_RUN_INPUTS.md -->

<!-- BEGIN VERBATIM FILE: D9_415_ENTITLEMENT_BEHAVIOR_DEFERRED_TO_D9_416.md -->
# D9-415 Entitlement Behavior Deferred to D9-416

## What changed

The former locked controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` is the Y1-CAM-4004/pre-change byte. The current production controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` is the Y1-CAM-4005 byte. Wave 1 established that Y1-CAM-4005 changes entitlement evaluation by adding authority-mode validation, requiring `revocation_checked`, and accepting a LearnDash-current-access authority mode. The exact source diff is preserved in D9-415 provenance evidence.

## Why D9-415 preserves it

`D9-415-FOUNDATION-002` explicitly identifies `23da5c...` as the intended current observed production baseline for source-recovery purposes. D9-415 therefore preserves the byte that is actually running, while retaining `c0a538...` outside the active runtime path as historical and rollback evidence.

## Why preservation is not approval

Source recovery records runtime truth; it does not approve product or security behavior. The founder decision expressly does not approve, ratify, validate, or normalize Y1-CAM-4005 entitlement behavior. D9-415 will not fix, revert, reinterpret, or otherwise change controller entitlement logic, Access Gate logic, authentication, HMAC handoff, Supabase session behavior, LearnDash entitlement behavior, roles, flags, or production routing.

## What D9-416 must decide

D9-416 must independently adjudicate entitlement behavior, authority-mode validation, `revocation_checked` semantics, LearnDash-current-access semantics, authentication consequences, authorization consequences, and compatibility with the final Matrix Plan access contract. D9-360 remains the product, UI, UX, visual, and interaction authority.

## What D9-420 must not assume

D9-420 must not treat the recovered byte, the observed-baseline commit, the tag, the safe source head, or the draft pull request as approval to deploy or as proof that entitlement/authentication behavior is correct. D9-420 remains blocked, G-D9-4 remains open, and D9-416 is mandatory before implementation or release.
<!-- END VERBATIM FILE: D9_415_ENTITLEMENT_BEHAVIOR_DEFERRED_TO_D9_416.md -->

<!-- BEGIN VERBATIM FILE: D9_415_MATRIX_PASSPORT_PATCH_PROPOSAL.md -->
# D9-415 Matrix Passport Patch Proposal

Status: **PROPOSAL ONLY — CANONICAL PASSPORT NOT MODIFIED**

The following facts should be added to the Matrix product passport through a separately reviewed authority update:

1. Source recovery repository: `https://github.com/brinyu13/missionmed-hq.git`.
2. Recovery branch: `d9-matrix-plan-415-source-recovery`.
3. Exact observed-production baseline: `c340a3a87732f7dc4afb06c01e4586239a050495` with the non-deployable tag `d9-matrix-observed-production-baseline-NOT-DEPLOYABLE-20260713`.
4. Safe source lineage begins at D9-415B `9469437d2ac5010563e59b6fdc00a9fe48548a80` and advances only through the required D9-415 commits.
5. Complete `missionmed-hub` source is tracked; the Matrix MU closure is constrained by `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_MU_INTENDED_ACTIVE.json`.
6. Current Calendar CSS is `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`; former rollback CSS `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` is non-runtime evidence.
7. Current controller is `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`; former controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` is rollback evidence. This source record is not entitlement approval.
8. Production still contains the backup-named MU file; D9-415B quarantines it only in source.
9. Scheduler's mutable CDN HTML authority remains unresolved.
10. `G-D9-4` remains open; `G-D9-5B` remains `OPEN — D9-416 REQUIRED`; overall `G-D9-5` remains `PARTIAL`; D9-420 remains blocked.

No canonical passport or global doctrine file was edited by D9-415. Adoption of this proposal must preserve the Founder Decision 002 distinction between observed source and approved behavior.

Final adoption should also record D9-415E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00` as the fail-closed validation hardening commit, draft PR #9 as **DO NOT MERGE**, `G-D9-5A` as passed only for code source authority, and the exact D9-416 input packet as the unresolved data/auth/deployment authority boundary.
<!-- END VERBATIM FILE: D9_415_MATRIX_PASSPORT_PATCH_PROPOSAL.md -->

<!-- BEGIN VERBATIM FILE: D9_415_FILE_MANIFEST.md -->
# D9-415 File Manifest

This deterministic manifest covers every Git-tracked final handoff file present before the manifest and combined file are generated. It excludes the raw forensic snapshot, itself, and the combined handoff to avoid recursive hashes. The final response separately reports the combined-file SHA-256 and the post-commit aggregate for the exact mirrored tracked handoff set.

- Source file count: 72.
- Sorted source-manifest aggregate SHA-256: `ea8e4bfa006956a2b67fe6b0f3e9b97a4accdf898a56c2e368eb65efef43d1b9`.
- Symlinks: excluded and forbidden.
- Matched secret/private values: never emitted.

| SHA-256 | Bytes | Relative path |
|---|---:|---|
| `d643c0bf13684092f3f78ae41e6ef419b7d9f0892153e6a086d1494729705163` | 1835 | `D9_415_AUTHORITY_CONFLICT_REGISTER.md` |
| `e136a6b30921721e0c0d43536e6e9420e3513de8a5c9927b7c3828ecf1e16eea` | 4485 | `D9_415_BASELINE_COMMIT_PROVENANCE.md` |
| `55b60bc77364c70e7a5fdb496b715709c02d50489c2d0edbc4f35176dc57d3f4` | 58839 | `D9_415_BLOCKED_PHASE_1_COMBINED_HANDOFF.md` |
| `55ad9e579d1af0d25db664ce26d52fc273f7e4d48f2e002fe10a2447feccc369` | 1616 | `D9_415_CALENDAR_CSS_RECONCILIATION.md` |
| `76090e66a8ba2fec68d1b1b2bbf192379db7f07c11693dab16844836c0de9b25` | 1204 | `D9_415_CANONICAL_REPOSITORY_DECISION.md` |
| `40df18c730735c68977d7ab31c5807c74e8f8f5357a381cbb6b04855eae783d6` | 2701 | `D9_415_CI_VALIDATION_REPORT.md` |
| `2c8c978b256e17ae8a8b2c966f0f4341cd72971291717919af92a55468fd3f13` | 29317 | `D9_415_COMMAND_LOG.md` |
| `09b8e9fa348a5169897d274dea16ad44c0cf4eb65f9a2a060275e20a8cd18844` | 3590 | `D9_415_D9_416_NEXT_RUN_INPUTS.md` |
| `e18e00cdd5a5321c38a7494f83b831f9c3db72a9aaa7e9ea75cbe42e74986e9a` | 10779 | `D9_415_DECISION_LEDGER.md` |
| `66592ab350ed5c028b370780346ecbc2cb5d33b80730fe0b21217b1efd14cd67` | 2082 | `D9_415_DEDICATED_BRANCH_REVIEW.md` |
| `e90d9e62126bf2b643cf2b0fbc1e8804c257d5fc9c4564e7af6b4004c7100d22` | 1933 | `D9_415_DEPLOYMENT_LINEAGE_PLAN.md` |
| `40ce85dfd882861cb0fead4b7bcf8b4506798a2abbfb20f068fef3ae5c5996db` | 2116 | `D9_415_ENTITLEMENT_BEHAVIOR_DEFERRED_TO_D9_416.md` |
| `aef48d7a208523a53cbefd82d06a0f6373481ddef4679f5e8d2b861a9727a1e8` | 5776 | `D9_415_EVIDENCE_INDEX.json` |
| `99cc3c24868d65df2ce90bb2cb560dd664ab00a2ef1d2d2dbc84226a5f0f6d11` | 9473 | `D9_415_EXECUTION_PLAN.md` |
| `915b6f42012bb5a92183cfc7cdc50416680e7bd764eb88a3697ff12c0b3dd22d` | 3774 | `D9_415_EXECUTION_REPORT.md` |
| `690683e66ab343d6c848a4fc85130a7e9f4f8bff36300f3a94a671ed7f81b195` | 2584 | `D9_415_EXECUTIVE_VERDICT.md` |
| `696551d1a9f07e038a3a42ffe58274f0f39405e0890f059e83095cf9a7325820` | 1896 | `D9_415_FOUNDER_DECISION.md` |
| `53e983006b07dead9daa6685be63b140dd8ec6e951dd8effbc06a2d86055f2ee` | 2159 | `D9_415_FOUNDER_DECISION_002.md` |
| `d9c5eeda6b244d1491f2c45f22736d4f31382940c38dd0285c1c4eed02e0e861` | 6466 | `D9_415_IMPLEMENTATION_HOME_LOCK.json` |
| `04d9ab0b3983de3222e64af68dcd28d9f25bc8a0cd8ff8db2aed1eac9d3a4f49` | 1187 | `D9_415_IMPLEMENTATION_HOME_LOCK.md` |
| `8f8ffd88f7dd0d134ae36568b5ba955cd5a804c6bd2dae94689803f09e1dda13` | 2094 | `D9_415_MATRIX_PASSPORT_PATCH_PROPOSAL.md` |
| `99146b4d8d924efb0f284e7ade5abb6af9a9a1d26a997702ee604f4170708f61` | 1451 | `D9_415_MU_DEPENDENCY_GRAPH.md` |
| `2dbfcae492224ce6beaff9fe0128f6a4d4d8ebb1eb43b369a8bc8bc953696917` | 2374 | `D9_415_MU_PLUGIN_BACKUP_REMEDIATION.md` |
| `b412c5138e5772280999feaea04ed729bbb84fee86cd5fc2d1e17339d12b5c3f` | 5713 | `D9_415_MU_PLUGIN_RUNTIME_MANIFEST.json` |
| `bc07b949b5abb0a12633b202d4d6226de55e4c695dbb99248b62657f41cf7ba1` | 3023 | `D9_415_MU_PLUGIN_RUNTIME_MANIFEST.md` |
| `f6e5154138490d445a5dcca2d5fa9cf105f698aef66d519e13d9a263a115ee68` | 1704 | `D9_415_NO_PRODUCTION_MUTATION_ATTESTATION.md` |
| `9d22b12cef678475831286d6621557204e9e57f802b9f82725941d886188eee0` | 56931 | `D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.json` |
| `a925509ccd973686358283a9d130104719f0e0e5db23260f473437bdbaea341c` | 25829 | `D9_415_PRODUCTION_PLUGIN_SNAPSHOT_MANIFEST.md` |
| `81046f4c828594667c6692521501d5d69bdd73035fc3dc99f0f0ba7e5b8ff63a` | 139158 | `D9_415_PRODUCTION_TO_GIT_HASH_MAP.json` |
| `0595616967fa9d1521a7efeb8c2c79fcc381d466f504cf5671187f8662b665ce` | 67587 | `D9_415_PRODUCTION_TO_GIT_HASH_MAP.md` |
| `acb77d04a4f285822ef0b129428795ade38b55543d9b40d5d95353acf3615c5b` | 2573 | `D9_415_REPRODUCIBLE_PACKAGE_REPORT.md` |
| `6abccc146077ae122d6e34ef4abf4851c70d9e3d27462f7ad16fd03c72138f2a` | 2785 | `D9_415_RISK_REGISTER.md` |
| `e57dfed4c4ab3b82fbc11f2f4fceea5a218be66bd22cc51face41c6b632d0ea2` | 2128 | `D9_415_ROLLBACK_PLAN.md` |
| `c3379ecc0f6c0cd353b1a7b92c5dcb0360a1e5eab45331327d7e445e7c202e43` | 2120 | `D9_415_RUNTIME_LOCK_RECONCILIATION.md` |
| `350d6e2c7384b7930ead8d608751c2aceba03b456bc75cf8d57994ca1123c4e1` | 3415 | `D9_415_RUN_STATE.json` |
| `4bd0ad6d1484c31dfe43c039afb23ae6652e0ed28ec54d226ad1a9251682ffee` | 1836 | `D9_415_SECRET_AND_DATA_SCAN_REPORT.md` |
| `9332898f2ffb54da2f4a34ef44035ad7ab179ef85a407e6cd2e4fe765356102f` | 5037 | `D9_415_SNAPSHOT_CUTOFF.md` |
| `1fec1c6569a521604dd2a33fccc49aa877192fd018ef058a52ba1fafb2f2c290` | 1474 | `D9_415_SNAPSHOT_EXCLUSION_REGISTER.md` |
| `826f21f67eee8674c18ae4e8dbdf14546638095ea60fda869d45e0e35142ffa8` | 8755 | `D9_415_SUBAGENT_WAVE_1_SYNTHESIS.md` |
| `a7f94da98a5e08fbc33033d24e67a1d6c1e42f4f6f199b72d392e57db10c41e4` | 3997 | `D9_415_SUBAGENT_WAVE_2_REVIEW.md` |
| `d2de18cf9e9421f4cd859cb817fd08c4027f3dd2cc4dab38c0cbafa9338589b1` | 4692 | `D9_415_TEST_REPORT.md` |
| `c8b6d0e41fdf3b1fdf6b11137ea1d5699c18491416cbff123031a3453d43f937` | 8626 | `evidence/D9_415_BUILD_FINAL_HANDOFF.py` |
| `ee93c188ec4835b943864b145542f34dafeb3feeafd7645efeeb9188fe935ae7` | 17916 | `evidence/D9_415_BUILD_PROVENANCE_REPORTS.py` |
| `5daf57474285bd2b56aaebad3b039bb237138f3bc6cfb9f4ab926415f7c32302` | 15908 | `evidence/D9_415_BUILD_SNAPSHOT_REPORTS.py` |
| `80e4a1041649e72449c3ff01b8bd1b7e2f5c898d7f16e13f57894564a8b6e38e` | 7170 | `evidence/D9_415_REDACTED_SOURCE_SCAN.py` |
| `ffafc86111eb712efa548514d39c62a636d403949a01cd5394a0f1d4dd78d81d` | 2230 | `evidence/D9_415_REMOTE_FULL_MANIFEST.sh` |
| `97571da44ec1e4d08b0e72f274e87b026d78733712894f2f7db433219eb12732` | 5041 | `evidence/D9_415_VERIFY_LOCAL_SNAPSHOT.py` |
| `b41ec71f4d2ef378ba4099106f25afc8c6774423488ca996eb46cfd5b6848139` | 266 | `evidence/PHASE_0_ENVIRONMENT.txt` |
| `15e030475804648b386c3157d5673ffb0998de3fee8c5f3ad53b69e2c1a281b3` | 537 | `evidence/PHASE_0_INPUT_HASHES.txt` |
| `80ce6c2e2dfa8d2f43d9d4dd458ef78a8c6e3d6973e5b1f8ebab45fc35967b60` | 1435 | `evidence/PHASE_0_INSTRUCTION_SOURCES.txt` |
| `2a987558ea12150c8981d4172780e660dd284625882ab063e60445ec1d0981ee` | 922 | `evidence/PHASE_0_PREFLIGHT.txt` |
| `d785cb59dec8c8a56629753b638818289fd8e5fdbf53c3911ddd7287886a7c3b` | 4637 | `evidence/WAVE_1_SUBAGENT_A.md` |
| `7f42668d2b46c9bc71672e1f9e2b57fe74e4002e0764179ce6d65022ecbe2577` | 3026 | `evidence/WAVE_1_SUBAGENT_B.md` |
| `90a90a8dca593c7eb149afe715766ffba1de06c460cd55d4d4fa8905f996c140` | 3590 | `evidence/WAVE_1_SUBAGENT_C.md` |
| `866f78e3a00cefdc916ac71a0fdbed91745db5bd2e778e130a26bb1f00da64b6` | 3423 | `evidence/WAVE_1_SUBAGENT_D.md` |
| `5a4c801e8893ffbec78b4d20e95e574ac89b62c9c7fe4305811b479405859275` | 1009 | `manifests/D9_415_BASELINE_INDEX_VERIFICATION.txt` |
| `1d8f329e61e1c2d9454b6d6209599544d321939eaea871c544813951f770e5e2` | 2196 | `manifests/D9_415_BASELINE_JS_SYNTAX.txt` |
| `30d196a19d167e7bf8d27c2d6f5404f642bc76ea45138e0902d95a960da9735f` | 5981 | `manifests/D9_415_BASELINE_PHP_SYNTAX.txt` |
| `a6602d0082ad75788b9caf7b6b9193fb81a4ac44e4917fec20acd8c0a18511b2` | 593 | `manifests/D9_415_D_PACKAGE_BUILD_METADATA.json` |
| `a650686889a6ddc22664ed890b6ff7b80fc3c1e475282723b8542d05f3967bc5` | 46129 | `manifests/D9_415_D_PACKAGE_SOURCE_MANIFEST.json` |
| `7fdea58f5515e2b7236c51c83c5a5e7eb357002f4b7d16cd256d2549b98d6736` | 3365 | `manifests/D9_415_D_PIPELINE_PRECOMMIT_VALIDATION.json` |
| `9359e42711d22a2aef189a7c2c630670be462a421369a56f3cc001ca2edf0219` | 3536 | `manifests/D9_415_E_PIPELINE_VALIDATION.json` |
| `6f991ba40292985ed70efe180c91ae18a05b94b7a3ea62e0c464499953062d50` | 1051 | `manifests/D9_415_FINAL_BRANCH_SCAN_SUMMARY.json` |
| `772c7d4c80fd4850c42145ea2beb6de7b8c4e705da79e3fd0113463cbf56172b` | 186 | `manifests/D9_415_LOCAL_SNAPSHOT_VERIFICATION.json` |
| `25af42d122fcea3ae310da4cfbc7e44660865abc286c3a3dbaf347c5a52d7d86` | 825 | `manifests/D9_415_MATRIX_GUARD_AUTHORIZED_CONTROLLER_EXCEPTION.txt` |
| `66bab3a6e2bd87f93ce15e590b15cf377752390b80b6e5938442c0ae6a871241` | 2589 | `manifests/D9_415_MATRIX_GUARD_NINE_UNCHANGED_ASSETS.txt` |
| `349e91261cb64c3356ce4f6efda2b99f38fedcc492ccf7000cc839fad2e09e55` | 14111 | `manifests/D9_415_REDACTED_SOURCE_SCAN.json` |
| `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61` | 44014 | `manifests/D9_415_T0_FULL_PRODUCTION_MANIFEST.normalized.tsv` |
| `5fd174ea962bbc52d8d1a3f87c2ea472755ad63e0643273799ebe7a4e3929546` | 44197 | `manifests/D9_415_T0_FULL_PRODUCTION_MANIFEST.tsv` |
| `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61` | 44014 | `manifests/D9_415_T1_FULL_PRODUCTION_MANIFEST.normalized.tsv` |
| `d0330e7d6d0cdbb5fc48a117baa3035e1abde39c66aa87c976e2d1b472dad034` | 44197 | `manifests/D9_415_T1_FULL_PRODUCTION_MANIFEST.tsv` |
| `349e91261cb64c3356ce4f6efda2b99f38fedcc492ccf7000cc839fad2e09e55` | 14111 | `manifests/D9_415_TRACKED_SOURCE_SCAN.json` |
<!-- END VERBATIM FILE: D9_415_FILE_MANIFEST.md -->

<!-- BEGIN VERBATIM FILE: D9_415_EXECUTION_REPORT.md -->
# D9-415 Execution Report

Ticket: `D9-MATRIX-PLAN-415`

Date: 2026-07-13 to 2026-07-14, America/New_York

Result: **COMPLETE — VERDICT A**

## Outcome

D9-415 recovered the exact current Matrix production source into immutable Git history without modifying production. Founder Decision 002 resolved the controller/lock conflict only for source recovery. Identical T0/T1 manifests sealed a quiescent snapshot, local verification found zero mismatches, and redacted scanning found no secret or private/student data.

D9-415A preserved the complete observed source and received the immutable non-deployable tag. D9-415B quarantined the executable Matrix MU backup only in canonical source. D9-415C filed branch-local provenance and rollback evidence. D9-415D added deterministic non-deploying packaging/CI. D9-415E resolved every valid Wave 2 validation finding. D9-415F files the final reports and combined handoff.

## Phase results

| Phase | Result |
|---|---|
| 0 — preflight, authority, plan | PASS |
| 1 — Wave 1 | 4/4 COMPLETE; blocker resolved by Founder-002 |
| 2 — T0/copy/T1 snapshot | PASS; manifests identical |
| 3 — safety scan and MU closure | PASS; 125 plugin + ten selected MU files |
| 4/5 — exact import, D9-415A, tag | PASS |
| 6 — source-only backup quarantine | PASS |
| 7 — source/lock provenance | PASS |
| 8 — deterministic package and CI | PASS |
| 9 — Wave 2 and branch review | PASS after D9-415E; zero unresolved P0/P1 |
| 10 — branch/tag/PR publication | PASS at E; final F head reverified after commit |
| 11 — reports, tracked-only combined handoff, mirror, activity log | PASS after final post-commit checks |

## Immutable identities

| Role | Commit/tree |
|---|---|
| Base | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` |
| D9-415A | commit `c340a3a87732f7dc4afb06c01e4586239a050495`; tree `2a43327429214fdf1c161aa9adf297fabac155bd` |
| D9-415B | commit `9469437d2ac5010563e59b6fdc00a9fe48548a80`; tree `d5d3fc057ce47f3af46774541de1faca059defb1` |
| D9-415C | commit `e12cd99aa9c019a6f99325c0b961aa50db945472`; tree `9e0408d93a37c0d6f73a4d06aa9da135b79c9b90` |
| D9-415D | commit `a81a3afc9d7b1f40295d0a1585045293326b0387`; tree `60f094ed21bac2a66e31a1c45426770f80a0bc56` |
| D9-415E | commit `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`; tree resolved in the commit record |
| D9-415F | the commit containing this self-referential report; resolve with `git rev-parse HEAD` and the verified remote branch |

All commits are single-parent, in the exact A→B→C→D→E→F order, and were not squashed or rewritten. The tag object `6e2f5e32830f06b9015b9eee1870ccfab62b2a49` still dereferences only to A.

## Publication

- Repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Branch: `d9-matrix-plan-415-source-recovery`.
- Draft PR: [#9](https://github.com/brinyu13/missionmed-hq/pull/9), **DO NOT MERGE**.
- Hosted CI at E: SUCCESS, run [29301277578](https://github.com/brinyu13/missionmed-hq/actions/runs/29301277578).
- Final F remote/head/CI equality is verified immediately after commit and recorded in the activity log and final response because a commit cannot embed its own hash.

## Security and non-mutation

- Production mutations: 0.
- Database mutations: 0.
- Cache/CDN mutations: 0.
- Feature-flag mutations: 0.
- Authentication/entitlement mutations: 0.
- Deployments: 0.
- Unreviewed secret or private/student-data candidates: 0.

## Final gate posture

- `G-D9-4`: OPEN.
- `G-D9-5A`: PASS after final remote/mirror verification.
- `G-D9-5B`: OPEN — D9-416 REQUIRED.
- Overall `G-D9-5`: PARTIAL.
- D9-416: READY.
- D9-420: BLOCKED.

Entitlement behavior remains **OBSERVED AND PRESERVED, NOT APPROVED**. This report is not deployment, implementation, or production-remediation authority.
<!-- END VERBATIM FILE: D9_415_EXECUTION_REPORT.md -->

## Supplemental standalone Markdown evidence

<!-- BEGIN VERBATIM FILE: D9_415_DEDICATED_BRANCH_REVIEW.md -->
# D9-415 Dedicated Branch Review

Review basis: detached/read-only comparison of `origin/main` `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` against D9-415E `030fe1071b76dfa7e37757eb70ba9c3aa1e41b00`.

Verdict: **PASS — ZERO UNRESOLVED P0/P1**

| Criterion | Result |
|---|---|
| Ancestry A→B→C→D→E | PASS |
| Exact production baseline and provenance | PASS |
| No runtime drift after D9-415C | PASS |
| Secrets and student/private data | PASS; branch-wide redacted scan found only the already reviewed Webex marker/schema labels and user-email fallback expression |
| Complete runtime dependencies | PASS; 125 plugin files observed, 120 packaged, nine intended-active MU files packaged |
| Unsafe Matrix MU backup | PASS; absent from active source, byte-identical in forensic storage |
| Deterministic packaging | PASS; two identical archives |
| CI deploy side effects | PASS; none |
| Runtime-lock data | PASS; branch-local only, global protected lock untouched |
| Calendar CSS evidence | PASS; current and former states preserved separately |
| Controller evidence | PASS; current `23da5c...`, former `c0a538...` forensic only |
| Rollback | PASS; source/history rollback only, no production command |
| Unrelated source changes | PASS; A is exact observed source, B is scoped quarantine, C provenance, D pipeline, E review fixes |
| D9-416 inputs | PASS after D9-415F closeout |

## Formatting exception

A repository-wide `git diff --check origin/main...HEAD` reports CRLF/trailing whitespace inside the exact production snapshot and frozen Phase-1 evidence. Those bytes are intentional provenance and must not be normalized after the immutable tag. All authored D9-415E and D9-415F deltas are checked independently and are whitespace-clean.

## Scope boundary

Three inherited Arena/STAT backup-pattern PHP files remain in the wider repository but were absent from the production T0 snapshot and are excluded from the Matrix package. They are an advisory for their owning scopes, not a D9-415 Matrix P0/P1. The repository MU directory must not be deployed wholesale.
<!-- END VERBATIM FILE: D9_415_DEDICATED_BRANCH_REVIEW.md -->

<!-- BEGIN VERBATIM FILE: evidence/WAVE_1_SUBAGENT_A.md -->
# Wave 1 Subagent A — Production Snapshot and Secret-Safety Analyst

## ROLE

D9-415 Wave 1 Subagent A — Production Snapshot and Secret-Safety Analyst.

## SCOPE

Strictly read-only inspection of the active Kinsta `missionmed-hub` plugin tree, protected Matrix runtime hashes, public asset hashes, permissions, symlinks, filename-level secret risks, and snapshot boundaries. No source content was copied or written and no production state was altered.

## FILES AND SYSTEMS INSPECTED

- Production host `zdu-theresidencyacademy-live-prod` at `2026-07-13T19:22:45Z`.
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`.
- MU directory existence only.
- Active Matrix lock manifest and Matrix passport.
- Safe command classes: `find -P -xdev`, `stat`, `readlink`, SHA-256, and public fetch piped directly to SHA-256 without printing bodies.

## FACTS ESTABLISHED

- 131 entries: 123 regular files and eight directories including root.
- Files mode `0644`; directories `0755`; no symlinks or special files.
- No cache/log/upload/session/temp/dump/`.env`/credential/key/token/backup-named entry was observed by filename inside the plugin root.
- An exact baseline must initially retain all 123 files; apparently non-runtime documentation, prototypes, duplicates, and `assets/test-deploy.txt` cannot be excluded without breaking exactness.
- Current protected observations:
  - `assets/student-os.646e3598d284fff3.js`: `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`.
  - `assets/student-os.js`: same `646e3598...` hash.
  - `assets/student-os.css`: `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33`.
  - `includes/class-mmed-student-os.php`: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` — active-manifest mismatch.
  - Calendar JS: `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa`.
  - Calendar CSS: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`.
  - Scheduler mount: `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578`.
  - File Vault JS/CSS: `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` / `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990`.
  - StoryForge JS/CSS: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` / `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`.
- Nine publicly checked static artifacts matched production origin.
- Content-level secret safety was not established; filename checks are insufficient.

## CONFLICTS

- Manifest expects controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Production observed controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`, size 32,786, mode `0644`, mtime `2026-07-13T18:52:21.956329834Z`.
- Production changed nearly four hours after the active manifest update.
- Stop boundary: no production command was run after the protected-file/public-hash command returned the mismatch.

## P0 BLOCKERS

- Protected production and the active manifest conflict.
- Further production inspection/copy/import/attestation is blocked pending exact authority resolution.
- The observed hash must not be normalized to the manifest, nor the manifest value represented as current production.

## P1 RISKS

- No content-level secret scan.
- Dependency closure cannot safely be reduced below the full plugin tree.
- The 4.96 MB Webex adapter lacks reproducible-source provenance.
- Source alias and fingerprinted shell are byte-identical but both are currently shipped.

## RECOMMENDED MAIN-AGENT ACTIONS

- Freeze production commands and import writes.
- Obtain exact authority for the observed controller and quiescent cutoff.
- After clearance, perform one minimal pre-copy consistency check, atomic non-symlink-following snapshot, and redacted local content scan.
- Preserve all 123 plugin files in the exact baseline.

## EVIDENCE PATHS

- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

## CONFIDENCE

High for metadata/hashes/public-origin coherence; low for secret safety until a quarantined content scan runs.

## UNRESOLVED QUESTIONS

Who authorized `23da5c...`; is production quiescent; does the class contain environment-specific values; which shipped residues are intentionally runtime material?

<!-- END VERBATIM FILE: evidence/WAVE_1_SUBAGENT_A.md -->

<!-- BEGIN VERBATIM FILE: evidence/WAVE_1_SUBAGENT_B.md -->
# Wave 1 Subagent B — Git Provenance and Hash Analyst

## ROLE

D9-415 Wave 1 Subagent B — Git Provenance and Hash Analyst.

## SCOPE

Read-only inspection of repository identity, refs, tags, worktrees, historical Matrix branches, local Git objects, D9-410 hashes, and the active lock. No state changed.

## FILES AND SYSTEMS INSPECTED

- D9-415 Git repository and remote/local refs/tags/worktrees.
- D9-410 baseline/lock/census/next-input evidence.
- Active Matrix lock.
- B1, RT-460, and Y1-CAM local source candidates.

## FACTS ESTABLISHED

- D9-415 HEAD/base/merge-base/current remote main: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Remote `main` has zero `missionmed-hub` plugin files.
- Only remote Matrix-named branch: `missionmed-matrix-phases-1-4` at `50ade02f02ded4b4fd832274f964c50f2d718c2f`, with 35 stale historical plugin files.
- Tag `known-good/2026-06-25-critical-auth-usce-arena-matrix` resolves to `3f0c27aac55dbf82748b3eaba360006d4041b539` but its tree has zero plugin files.
- No inspected local or remote ref contains the complete current production baseline.
- Only current protected local-ref match: Scheduler hash `2a47b...`, blob `c68219cb569d82851a882d0d590605f44578ab64`, introduced at local-only commit `6a2db3ca595f72f163e365dbb03b17807e963ac9`, not on a remote branch.
- The active manifest is an uncommitted modification in the protected root; its current file SHA-256 is `efb1d51b916ccc32fa0bf56fa3bd77b828f5cfa63ca04fb8b29c914654c9952d`.
- D9-410 shell hashes are historical; current lock/source candidates have newer shell bytes.

## CONFLICTS

- D9-410 is historically valid but stale for the current shell.
- The newer active manifest is not committed/cloneable provenance.
- Calendar CSS is semantically reconciled to `6e519195...` locally but not in committed Git authority.
- Local object/branch/tag names are not proof of production source.

## P0 BLOCKERS

- No Git commit/branch/tag contains exact complete active production source.
- Current production must not be reconstructed from historical hashes or mutable local exports.
- G-D9-5A cannot pass before direct snapshot-to-commit path/blob mapping.

## P1 RISKS

- Protected-only import would omit dependencies.
- Merging baseline/reconciliation would destroy historical separation.
- Local-only Scheduler provenance can be mistaken for reviewed remote authority.

## RECOMMENDED MAIN-AGENT ACTIONS

- After the runtime conflict is resolved, recover complete source directly from Kinsta.
- Commit exact observed source first, tag it, then quarantine and reconcile in separate commits.
- Record SHA-256 and Git blob OID for every baseline file and verify via `git ls-tree`, `git cat-file`, `git archive`, and remote refs.

## EVIDENCE PATHS

D9-410 handoff files, active Matrix lock, and Git refs/objects in this repository.

## CONFIDENCE

High for Git/ref/tree findings.

## UNRESOLVED QUESTIONS

Final production cutoff, full current plugin/MU set, and the authoritative release record for post-D9-410 shell changes.

<!-- END VERBATIM FILE: evidence/WAVE_1_SUBAGENT_B.md -->

<!-- BEGIN VERBATIM FILE: evidence/WAVE_1_SUBAGENT_C.md -->
# Wave 1 Subagent C — WordPress, MU-Plugin, and Security Analyst

## ROLE

D9-415 Wave 1 Subagent C — WordPress, MU-plugin, and security analyst.

## SCOPE

Read-only inspection of WordPress/MU metadata, load behavior, Matrix boot structure, auth bridges, account entry, Scheduler/Webex dependencies, and secret/private-data risks. No state changed.

## FILES AND SYSTEMS INSPECTED

Production WordPress MU loader, targeted top-level MU files, complete hub inventory/bootstrap structure, and local tracked auth/proxy counterparts. No credentials, cookies, request payloads, database rows, or student data were inspected.

## FACTS ESTABLISHED

- WordPress sorts and `include_once`s every top-level MU filename ending in `.php`; nested PHP is not auto-loaded without a loader.
- `missionmed-mr-legacy-popup_BACKUP_PRE004.php` is auto-loaded, mode `0644`, 14,800 bytes, SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`.
- It is byte-identical to `missionmed-mr-legacy-popup.php`, including guarded functions and registered callbacks.
- Target MU hashes:
  - auth handoff `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3`;
  - HQ proxy `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3`;
  - Supabase cookie bridge `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f`;
  - Matrix account entry `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba`;
  - Scheduler/Webex broker `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455`.
- Hub bootstrap always requires 24 core components and conditionally requires 14 Matrix classes plus optional Live Drills SDK v3 when Student OS is enabled.
- Account entry can directly load the hub LearnDash reskin class.
- Auth handoff/proxy/Supabase bridge and Scheduler/Webex files are source-sensitive and must be content-scanned locally without exposing values.
- Local tracked versions of the three auth/proxy MU files do not match production.

## CONFLICTS

- Current controller `23da5c...` supersedes D9-410 `f97fb...` and active lock `c0a538...`.
- Production auth handoff also has a current-day modification and differs from the tracked local copy.
- The exact baseline and safe source head must remain separate commits.

## P0 BLOCKERS

- Controller drift is a stale-runtime hard stop.
- No production source may enter Git before a quarantined redacted secret/high-entropy scan.

## P1 RISKS

- Executable backup placement can become behaviorally dangerous if bytes/order diverge.
- Handoff tokens carry signed identity/entitlement fields and proxying forwards broad headers/cookies.
- Scheduler/Webex uses configured credentials/tokens; no option/log/request data may enter source.
- Plugin activation must never run in CI because it can seed state.

## RECOMMENDED MAIN-AGENT ACTIONS

- Resolve the runtime cutoff first.
- Snapshot atomically, content-scan outside Git, and import exact bytes only if safe.
- Preserve the backup in D9-415A and move it unchanged outside autoload scope only in D9-415B.
- Build explicit MU autoload/dependency manifests; defer all auth/entitlement behavior changes.

## EVIDENCE PATHS

Production WordPress core loader, targeted MU paths, hub bootstrap/classes, and this worktree's tracked MU directory.

## CONFIDENCE

High for loader behavior, targeted hashes, backup execution, and boot dependencies; medium for complete transitive closure.

## UNRESOLVED QUESTIONS

Authority/cutoff for Y1-CAM-4005, secret-scan outcome, exact entitlement/plugin versions, and whether additional auth/session controls exist.

<!-- END VERBATIM FILE: evidence/WAVE_1_SUBAGENT_C.md -->

<!-- BEGIN VERBATIM FILE: evidence/WAVE_1_SUBAGENT_D.md -->
# Wave 1 Subagent D — Packaging, CI, Release, and Rollback Analyst

## ROLE

D9-415 Wave 1 Subagent D — Packaging, CI, Release, and Rollback Analyst.

## SCOPE

Read-only analysis of repository tooling, Matrix guard, CI, deterministic packaging, release lineage, rollback, and Scheduler CDN risk. No state changed.

## FILES AND SYSTEMS INSPECTED

Repository packages/ignore/deploy/rollback/validation files, Matrix lock/guard, D9-410 deployment/testing reports, Y1-CAM-4005 candidate/backup, and D9-415 requirements.

## FACTS ESTABLISHED

- `origin/main` has no plugin source and no GitHub workflows.
- Root build is `echo build-placeholder`; nested HQ package only provides runtime start.
- Existing deploy tooling is not a source-linked plugin pipeline.
- Matrix guard is a selected-file backup/upload verifier, not a complete source/package/staging pipeline.
- `preflight --brian-approved` can return success even with warnings/failures and must never be a CI pass condition.
- Scheduler mount consumes mutable unpinned CDN HTML outside the package.
- Production controller `23da5c...` matches Y1-CAM-4005 candidate exactly; active lock `c0a538...` matches its pre-change backup exactly.
- The Y1-CAM-4005 candidate changes entitlement evaluation by adding authority-mode validation, requiring `revocation_checked`, and accepting a LearnDash-current-access authority mode. This is auth/entitlement-significant.
- A repository-wide backup-name gate would hit inherited unrelated top-level MU backup files; D9-415 validation must be scoped without modifying unrelated protected source.

## CONFLICTS

- Production/lock controller mismatch.
- Observed drift is entitlement-significant while D9-415 forbids auth/entitlement changes.
- Global backup scan versus inherited unrelated repository state.

## P0 BLOCKERS

- Do not import/commit/tag/package/attest while the controller conflict remains unresolved.
- A trusted immutable tag requires a quiescent cutoff and recapture after the final authorized production write.
- Protected-hash CI cannot pass against the active lock today.
- Generic `--brian-approved` is not an adequate exact authority decision.

## P1 RISKS

- Guard uploads are sequential and partial-release prone.
- Selected-file backups are incomplete rollback artifacts.
- Network-dependent guard checks are nondeterministic for CI.
- Branch metadata can contaminate package bytes.
- Scheduler CDN can drift independently.

## RECOMMENDED MAIN-AGENT ACTIONS

- Keep the freeze.
- Obtain exact authority for `23da5c...`, Y1-CAM-4005, and a no-further-write cutoff.
- After clearance, use a stdlib-only clean-tree deterministic packager with canonical ordering/timestamps/modes/metadata and no network/deploy action.
- Build twice in separate temporary directories.
- Add least-privilege read-only CI; never invoke production guard modes or `--brian-approved` in CI.
- Preserve both Calendar CSS hashes and require D9-416 to pin Scheduler HTML lineage.

## EVIDENCE PATHS

Matrix lock/guard, D9-410 deployment/testing reports, repository package/deploy files, and Y1-CAM-4005 candidate/backup.

## CONFIDENCE

High for tooling/packaging facts and controller provenance; medium-high for release implications pending authorization/cutoff.

## UNRESOLVED QUESTIONS

Y1-CAM-4005 authorization, production quiescence, exact cutoff, scoped backup-scan rule, artifact retention, and Scheduler CDN authority.

<!-- END VERBATIM FILE: evidence/WAVE_1_SUBAGENT_D.md -->

