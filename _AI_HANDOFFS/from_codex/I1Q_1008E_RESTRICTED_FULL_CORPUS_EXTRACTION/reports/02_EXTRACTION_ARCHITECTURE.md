# 02 — Extraction Architecture

## Status and authority

This report describes the restricted, deterministic extraction architecture for the observed I1Q-1008E cohort. The second non-destructive contract-drift supersession, corrected extraction, four-role specialist review, and final integration are complete and content-bound.

All output remains Lane B review material. The workflow grants no production, learner-release, credentialed medical-approval, or final governance authority.

## Fixed processing denominator

The observed processing cohort contains 97 validated transcript artifacts. Every artifact is processed through nine automated passes, producing the fixed coverage denominator:

`97 artifacts × 9 passes = 873 automated pass cells`

The pass contract is:

| Pass | Purpose |
|---|---|
| PASS 1 | Direct questions |
| PASS 2 | Rapid-fire and imperative prompts |
| PASS 3 | Implied clinical questions |
| PASS 4 | Learner questions paired with teaching |
| PASS 5 | Testable teaching statements |
| PASS 6 | Nodes-assisted recovery |
| PASS 7 | Medical and assessment review proposals |
| PASS 8 | Adversarial missed-occurrence search |
| PASS 9 | Cross-pass merge and final binding |

The architecture treats every automated result as a proposal. It never upgrades automated classification into physician approval, assessment approval, or release authority.

## Deterministic processing chain

Each artifact moves through a content-addressed chain:

1. The acquisition roster binds the validated source cohort and availability state.
2. Restricted parsing produces deterministic transcript and optional Nodes shards.
3. Nine-pass execution emits content-addressed pass receipts and occurrence shards.
4. Processing receipts bind input hashes, pass roots, occurrence-set roots, and the run contract.
5. The safe processing ledger projects only aggregate state, counts, and hashes.
6. Specialist review packets bind the artifact input root and the PASS 7, PASS 8, and PASS 9 proposal roots.
7. Four independent roles review every packet.
8. Per-artifact receipts bind two specialist verification cells and four role reviews into PASS 9.
9. A refreshed ledger may claim completion only after every required specialist receipt is validated and integrated.

Canonical serialization and SHA-256 content addressing make every envelope independently reproducible. Derived identifiers and roots are deterministic, while protected source content remains outside Git-safe artifacts.

## Specialist verification architecture

The specialist denominator is fixed independently of the automated pass denominator:

- 97 artifacts × 2 specialist verification cells = 194 cells.
- 97 artifacts × 4 independent role reviews = 388 role reviews.

The required roles cover medical-content risk, assessment science, deterministic pipeline integrity, and engineering integrity. Reviewer identities must be distinct, every role must cover all 97 packets exactly once, and every review must bind the exact packet root. A blocker finding cannot be finalized as verified. Non-blocking findings require an explicit findings disposition.

The finalizer validates the complete packet set, all four role batches, authoritative extraction state and receipt, the safe ledger, and the safe roster before publishing any completion aggregate. Downstream integration is required to validate the aggregate, submission set, receipt set, and batch roots rather than trusting an isolated receipt.

## Roster semantics and safe projections

The full 105-row acquisition roster is validated for unique source identity, unique protected artifact identity, unique roster position, exact availability totals, and exact status mapping. Safe projections preserve only approved identifiers, statuses, counts, and hashes.

An order-sensitive comparison once rejected a semantically identical safe roster whose rows were serialized in a different order. The comparison now sorts copied projections by the already-validated unique roster position. This removes serialization-order sensitivity without weakening authority:

- The acquisition array remains bound by its original roster root.
- Duplicate or invalid roster positions fail before sorting.
- Swapped positions, changed availability, changed hashes, and changed status mappings still fail.
- Reordering a safe projection alone is accepted only when every row remains semantically identical.

## Isolation and publication

All restricted operations are constrained to a dedicated encrypted boundary outside the worktree and cloud-synchronized paths. Git-safe outputs contain only approved aggregate projections and content roots.

Extraction, rotation, partial recovery, and specialist finalization share one kernel-backed operation lock. The lock uses a stable protected file identity and is checked throughout long operations. Lock contention and observed lock loss fail closed.

Protected publication uses restrictive file modes, temporary files, file and directory synchronization, no-clobber publication, and deterministic crash recovery. Existing differing output is a collision, not an overwrite opportunity. Idempotent replay accepts only byte-identical content.

## Completed transition state

The nine-pass architecture, specialist contracts, finalizer, full supersession path, partial recovery path, and finalizer-drift rotation have passed synthetic and adversarial review. The current result is 127 of 127 tests passing across five suites.

The earlier contract mismatch was rejected before specialist publication, as designed. Its derived state was archived non-destructively, after which a fresh contract-bound extraction completed all 873 automated cells and all 194 specialist verification cells. Final integration passed with 97 transcript artifacts, 99 Nodes artifacts, 117,893 occurrences, 57,688 provisional concepts, and zero production mutations.
