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
