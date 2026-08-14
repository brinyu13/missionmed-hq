# I1Q-1007X Independent Red Team

## Verdict

`STATE C VETO RETAINED, STATE A SUPPORTED ONLY AS A DATED POINT-IN-TIME AGGREGATE`

At exact pushed checkpoint `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`, IRT-009 is closed in local exact-checkpoint scope and IRT-010 is closed for evidence integrity. No global deployed no-leak clearance is claimed.

## Audit Sequence

1. The first independent audit at `6ac62c5` found a Class D key in the Class C debrief and no purpose-scoped protected-content reader for assigned reviewers.
2. Commit `b9bb26a` repaired those findings. Commit `aebc987` made the inventory qualification explicit and machine-readable.
3. A report-only check at `6dc408f` closed the first two findings but was superseded because later audits found deeper encoding paths.
4. The audit at `2d28d0b` reproduced 28 double URL-encoding bypasses and required bounded iterative normalization.
5. Audits at `65bb52c` found that SQL lowercased before decoding, then restored uppercase bytes. A broader matrix persisted eight of eight full-byte mixed-case probes, and the final verifier independently persisted the named IRT-009-H4 vector in all four prose families.
6. Commit `e9e807c` case-folded after every SQL decode pass and final normalization, and expanded the relational matrix. Commit `ba17e22` refreshed the exact evidence.
7. The final independent audit at `ba17e22` reproduced all requested attacks and closed the local defect without clearing any external State C gate.

## Finding Ledger

| Finding | Final disposition |
| --- | --- |
| IRT-001, State C integration and operations absent | OPEN CRITICAL. Canonical identity, runtime repository, staging, deployment, monitoring, backup, and operational rollback proof do not exist. |
| IRT-002, Class D key in Class C debrief | RESOLVED IN LOCAL APPLICATION SCOPE. Closed-world Class C projection and value scanning pass. |
| IRT-003, assigned reviewers cannot inspect protected content | RESOLVED IN LOCAL APPLICATION SCOPE. Exact-assignment audited access passes; external runtime behavior is unverified. |
| IRT-004, exact corpus counts not independently reproducible | TRUTHFULLY QUALIFIED. The inventory is a dated point-in-time aggregate with no retained privacy-safe row manifest. |
| IRT-005, intended runtime RLS unproven | OPEN EXTERNAL. Disposable PostgreSQL passes, but canonical grants, pool, repository composition, and staging RLS proof are absent. |
| IRT-006, global no-leak claim unproven | OPEN EXTERNAL. No requested local counterexample remains, but no deployed response, browser, log, telemetry, cache, or storage proof exists. |
| IRT-007, rollback, monitoring, and protected consumers unproven | OPEN EXTERNAL. No canonical operational route or owner-reconciled runtime baseline exists. |
| IRT-008, browser, accessibility, human, and UX gates unproven | OPEN EXTERNAL. Browser was unavailable, no staging host exists, and the last simulated UX score predates the final repairs. |
| IRT-009, Class D encoding and SQL persistence bypasses | CLOSED IN LOCAL EXACT-CHECKPOINT SCOPE at `ba17e22`. All four historical High counterexamples, including IRT-009-H4 at `65bb52c`, are preserved. Every requested final JavaScript and PostgreSQL probe failed closed before hashing or insertion. |
| IRT-010, exact-checkpoint evidence integrity | CLOSED at `ba17e22`. All 44 artifact records match exact Git-object bytes and hashes. |

## Final Independent Proof

- Exact local and tracked origin commit: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
- JavaScript matrix: 196 of 196 identifier combinations denied
- PostgreSQL matrix: 196 of 196 identifier combinations and 16 of 16 marker combinations denied
- Limit probes: depth 9 and 65,537 bytes both returned fail-closed SQLSTATE `54000`
- Persistence proof: 0 artifact rows and 0 payload rows for denied probes
- Focused STAT and Drills adapters plus Class C suite: 48 passed, 0 failed, 0 skipped
- Package suite: 228 discovered, 227 passed, 0 failed, 1 intentionally gated PostgreSQL skip
- Fresh disposable PostgreSQL 16: 13 passed, 0 failed, 0 skipped
- Evidence validator: 20 of 20 files, 0 errors, claimed State A
- Exact artifact checksums: 44 of 44 matched, 0 stale
- Root dependency audit: 0 vulnerabilities
- Opaque public question identity: preserved
- STAT server projection: exactly nine frozen fields
- Student and consumer flags: all six flags off
- Real candidates: 0
- Credentialed physician approvals: 0

## State Ruling

State A is the highest supported state. The 97-source inventory is a dated aggregate attestation backed by witnessed response and probe hashes plus internally consistent totals. It is not independently reproducible row by row from Git.

State B is not achieved because no privacy-safe working transcript, accepted real privacy pilot, extraction-ready source, or real candidate exists.

State C is vetoed because canonical auth, runtime datastore wiring, preview, staging, production deployment, browser, accessibility, human, monitoring, backup, rollback, and protected-consumer evidence are absent.

State D is prohibited because medical governance remains unassigned and no credentialed physician-approved immutable revision exists.

## Scope Boundary

The final local Class D encoding contract is clear only for exact checkpoint `ba17e22` and its explicit eight-pass, 64 KiB fail-closed boundary. It is not a deployed global leak certification. All six flags must remain off, and no production, consumer, student, State B, State C, or State D activation is authorized.
