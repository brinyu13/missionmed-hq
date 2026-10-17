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

