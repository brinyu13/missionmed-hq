# 10 — Testing, Stress, and Adversarial Review

## Current result

The current Git-safe engineering result is **127 of 127 tests passing** across five suites. This result covers contract validation, deterministic extraction helpers, schema enforcement, locking, full supersession, partial recovery, finalizer-drift rotation, specialist finalization, crash recovery, and adversarial tamper cases.

This is a synthetic and isolated engineering result. It does not by itself claim final protected integration, production readiness, learner release, or medical approval.

## Test strategy

The validation program exercises five layers:

1. **Contract and schema tests** verify exact fields, fixed denominators, canonical envelopes, and prohibited authority claims.
2. **Deterministic transformation tests** verify stable parsing, nine-pass execution, content roots, provisional deduplication, and provenance binding.
3. **Filesystem safety tests** verify restrictive modes, symlink and hardlink rejection, no-clobber publication, file synchronization, directory synchronization, and idempotent replay.
4. **Concurrency and recovery tests** verify lock contention, lock loss, crash points, stale-view rejection, resumability, and preservation of immutable inputs.
5. **Adversarial authority tests** attempt packet substitution, batch forgery, reviewer reuse, incomplete coverage, blocker concealment, roster tampering, false aggregate counts, receipt substitution, and completeness conflicts.

The fixed coverage assertions are 873 automated pass cells, 194 specialist verification cells, and 388 specialist role reviews.

## Independent finalizer audit

The first specialist-finalizer review returned NO-GO and identified material gaps. The corrected design now addresses them:

- Packets are rebuilt from authoritative extraction summaries rather than trusted as a self-consistent set.
- Acquisition state, extraction state, extraction receipt, safe ledger, and safe roster are cross-bound.
- Full 105-row uniqueness and availability totals are recomputed.
- Extraction-completeness fields must agree across state, receipt, and ledger.
- Four role batches require distinct reviewer identities and exact 97-artifact coverage.
- Findings and final dispositions are equivalent in both directions, and blocker findings fail closed.
- Receipts bind the submission and role-batch evidence chain consumed by downstream integration.
- The legacy single-artifact live assembler is disabled, eliminating an unlocked overwrite path.
- Publication is crash-safe, no-clobber, and idempotent.

The roster-order incident was a false rejection, not a data-integrity failure. A safe roster with identical rows but a different serialization order failed an order-sensitive projection hash. The correction sorts copied projections by already-validated unique roster position. Focused tests and independent adversarial probes confirmed that harmless permutations pass while duplicate positions, position swaps, false counts, and unbound acquisition reordering still fail.

## Independent rotation and recovery audit

The initial supersession design was also rejected before live use. Adversarial review identified weaknesses in reviewer-proof binding, crash atomicity, process-identity locking, rename collision handling, resume-source authorization, shared exclusion, and filesystem-level test coverage.

The corrected architecture uses:

- one shared kernel-backed operation lock;
- stable file-identity checks instead of process metadata;
- exclusive, no-clobber publication primitives;
- content-addressed prepared, moving, and complete recovery states;
- exact source and destination manifests;
- immutable-input preservation roots;
- crash-resume tests at each durable transition; and
- explicit rejection of unauthorized or stale recovery receipts.

Full supersession and partial recovery are both non-destructive. Source material is preserved until the copied or moved derived state is fully verified and the completion receipt is durable.

## Contract mismatch and fail-closed behavior

An earlier specialist integration attempt encountered a run-contract mismatch after code and contract inputs changed. The finalizer rejected the mismatch before publishing completion outputs. No receipt set from that attempt was accepted as integrated, and no production or release state changed.

That outcome was the intended safety behavior: a packet set created under one contract cannot be silently finalized under another. The contract-drift output was subsequently superseded non-destructively. A fresh contract-bound run completed and final integration passed with exact 97-artifact, 873-cell, 194-cell, and 388-review coverage.

## Stress and tamper cases covered

The current suite includes, at minimum:

- all durable write, synchronization, publication, and cleanup crash points;
- byte-identical replay versus differing-output collision;
- weak mode, symlink, and hardlink rejection;
- concurrent lock contention and observed holder loss;
- stale authority snapshots;
- duplicate or missing role coverage;
- reused reviewer identity;
- packet-root and run-contract substitution;
- nonempty findings presented as no-blocker and the inverse;
- blocker findings presented as verified;
- duplicate roster identities or positions;
- false transcript, Nodes, paired, Nodes-only, or unresolved totals;
- safe-roster row permutation;
- state, receipt, and ledger completeness disagreement;
- generic receipt substitution without aggregate authority; and
- resume records that attempt to broaden the authorized source set.

## Final verification state

The contract-bound extraction, four-role review integration, deterministic integration replay, refreshed Git-safe ledgers and evidence, and final test suites are complete. The final restricted-correlation leakage scan is rerun after closeout documents are assembled; its receipt is the publication gate for this handoff. These results remain restricted review evidence and do not grant release or medical approval.
