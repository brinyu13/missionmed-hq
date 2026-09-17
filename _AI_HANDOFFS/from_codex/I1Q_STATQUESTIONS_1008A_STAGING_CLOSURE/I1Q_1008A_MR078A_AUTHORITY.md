# I1Q-1008A MR-078A Authority

## Loaded Authority

The exact local Supabase Migration Protocol, Data Flow Contract, Codex Execution Guardrails, DR-006, and I1Q passport were read before migration work.

MR-078A requires a versioned forward migration, exact target, migration-history backup, review, rollback or compensation, verification, and activity evidence. MR-078B pins I1Q to an additive `i1q` schema in the approved RANKLISTIQ data-flow authority. It does not authorize a production migration in I1Q-1008A.

## Target Ruling

`VERIFIED`: the known RANKLISTIQ production project ref is `fglyvdykwgbuivikqoah`.

`VERIFIED`: no authorized preview project ref, database host, database name, provider backup identity, tested restore reference, GitHub `i1q-preview` environment, or required preview secret inventory was found.

`ROOT RULING`: the committed preview target manifest remains `UNASSIGNED` and explicitly forbids both known production project refs. Apply, compensate, and reapply must fail before connection until a separate nonproduction target, backup, restore evidence, and approval hash are committed.

## Workflow Ruling

No pre-existing I1Q or global preview workflow was found. The new I1Q-only workflow is the narrowest additive candidate:

- manual dispatch only
- exact authorization phrase
- GitHub environment gate
- commit-pinned actions and Supabase CLI
- project, host, database, and production-denial checks
- backup and restore evidence required before writes
- dry run before selected operation
- post-operation RLS, role, grant, and flag checks
- evidence redaction and checksummed artifact inventory

It is a fail-closed workflow candidate. It has not run and is not canonical until the target owner approves its exact environment and route.
