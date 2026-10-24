# I1Q-1007X Release Veto Or Clearance

Final exact checkpoint: `ba17e22b0fe8a48a7397557ef95d2ceb454970d4`
Repair checkpoint: `e9e807c4803bf4483c90125ace91793489596b81`
Final diff-only range: `65bb52c4bd14d6d20145e666e3b95b6109dfef83..ba17e22b0fe8a48a7397557ef95d2ceb454970d4`

## Verdict

`STATE A CLEAR QUALIFIED ONLY`

`STATE B VETO`

`STATE C VETO`

`STATE D VETO`

IRT-002 is `CLOSED` at preserved severity `HIGH`. IRT-003 is `CLOSED` at preserved severity `HIGH`. IRT-004 remains `QUALIFIED` accepted residual at preserved severity `HIGH`: the 97-source State A evidence is a witnessed point-in-time aggregate with no retained row manifest and no independent Git recomputability.

IRT-009 is `CLOSED` only at final exact checkpoint `ba17e22`, preserved severity `HIGH`. The three prior historical Highs remain recorded. New historical `IRT-009-H4` at `65bb52c` is also preserved: `%53ource_%4Dixed%43ase` decoded to mixed case after the one-time lowercase step and evaded the lowercase comparator. Independent replay accepted and hashed the value in all four prose families, persisting `4/4` metadata and `4/4` payload rows.

At `ba17e22`, the same vector is lowercased after each decode round and final NFKC, blocked `4/4` with SQLSTATE `42501`, and persists zero rows. Fresh PostgreSQL 16.13 verifies mixed-case direct `28/28`, base64 `28/28`, base64url `28/28`, and iterative identifier/marker `128/128`; depth 9 and oversize inputs fail closed with SQLSTATE `54000`. The SQL diff changes no grant, RLS, policy, flag, gate predicate, or release policy.

IRT-010 is `CLOSED` at preserved severity `HIGH`: exact final Git-object comparison matches `44/44` paths, byte counts, and SHA-256 values with zero stale or missing records.

Exact verification: package `228/227/0/1`; focused adapters plus Class C `48/48`; fresh UTF-8 PostgreSQL 16.13 `13/13`; evidence validator `20/20` State A; report JSON valid. All disposable PostgreSQL and archive resources were cleaned.

No new `CRITICAL` or `HIGH` finding exists at `ba17e22`. Historical findings retain `HIGH` severity and are closed only by the final exact bytes.

This report makes no deployment, auth, browser, accessibility, monitoring, or protected-consumer claim. No commit or push was performed.

Final decision: `STATE A CLEAR QUALIFIED ONLY; STATE B VETO; STATE C VETO; STATE D VETO`.
