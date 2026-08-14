# I1Q-1008A Datastore Authority Map

## Verdict

`TARGET PROJECT AND SCHEMA RESOLVED; RUNTIME CONTRACT CANDIDATE OBSERVED; PREVIEW ROUTE, OWNERSHIP, AND LIVE WIRING MISSING`

DR-006 and MR-078B route I1Q to an additive `i1q` schema in RANKLISTIQ. The 1007X base migration is well-formed and intentionally contains no runtime grants. During this discovery, a concurrent untracked 1008A migration and compensation candidate appeared that define `i1q_runtime`, `i1q.resolve_current_identity()`, four additional disabled flags, and a forward compensation. They are in-flight source, not registered authority or applied state. No canonical project-pinned migration directory, preview target, GitHub workflow, migration-history proof, named database owner, runtime connection, preview apply, rollback, or reapply exists.

This report is read-only discovery. No Supabase access, SQL execution, migration application, role change, production read, environment read, or datastore write occurred.

## Authority Stack

| Priority | Authority | Exact path | Datastore ruling |
| --- | --- | --- | --- |
| Mission-specific | DR-006 | `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md` | Additive `i1q` schema in RANKLISTIQ; preview or staging first; forward-only; forced RLS; deny by default; canonical GitHub route. |
| Data routing | MR-078B | `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md` | RANKLISTIQ owns STAT and question data. Root `supabase/migrations/` targets Growth Engine. |
| Migration process | MR-078A | `/Users/brianb/MissionMed/_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md` | Fourteen-digit UTC names, strict history alignment, backup, diff review, transaction wrapping, no destructive history repair. |
| Execution safety | MR-079 | `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` | Project pin before commands; no history rewrite; no unsafe service-role or RLS behavior. |
| Shared system protection | Critical Systems Contract and Manifest | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`; `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` | Pin by project, schema, table, RPC, role, and RLS expectation. |

For I1Q, DR-006 and MR-079 are stricter than MR-078A's historical repair discussion. No migration-history repair or direct `schema_migrations` mutation is permitted.

## Project Map

| Provider project | Project ref | Named domains | I1Q authority |
| --- | --- | --- | --- |
| RANKLISTIQ, `missionmed-ranklistiq` | `fglyvdykwgbuivikqoah` | Arena, STAT, Supabase Auth, question data, telemetry, USCE `command_center.usce_*` | `AUTHORIZED TARGET`: additive `i1q` schema only. |
| Growth Engine | `plgndqcplokwiuimwhzh` | HQ CRM, media, and contract-listed drill registry data | `DO NOT TARGET`: root migration directory is assigned here and documented as history-desynchronized. |
| Scheduler Staging | `avpdetdkpwmqqxtvomix` | Scheduler staging | `OUT OF SCOPE`: no I1Q authority. |

The schema name `command_center` exists in more than one project. It cannot be used as a project selector.

## Current I1Q Candidate

| Property | Observed value |
| --- | --- |
| Migration | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql` |
| SHA-256 | `0c2ca0c48436c7684b97ce88d6b7d518b0780c3e336ad1b5bfd457c4fd60b5e3` |
| Target declaration | RANKLISTIQ, additive `i1q` schema, offline candidate only |
| Tables | 52 |
| Dependencies | PostgreSQL 15 or later, `auth.uid()`, `pgcrypto`, future approved unprivileged runtime role |
| Transaction | Wrapped in `BEGIN` and `COMMIT` |
| RLS | Enabled and forced on all 52 tables |
| Public access | Revoked from `PUBLIC`; `anon` and `authenticated` revoked when present |
| Runtime grants | Intentionally absent |
| Actor | `i1q.current_actor_id()` returns `auth.uid()` UUID |
| Role authority | `i1q.actor_role_memberships`, keyed by `auth.uid()` |
| Feature flags | Six seeded false |
| Apply evidence | Disposable PostgreSQL passed 13 of 13 in 1007X; preview/staging/production apply count is zero |

The migration's own schema comment states that runtime grants are absent pending a canonical unprivileged adapter role and reviewed auth bridge. This is a deliberate safety boundary, not an incomplete test accident.

### Concurrent 1008A Runtime Candidates

These files appeared as untracked concurrent work after the initial HERSCHEL snapshot. HERSCHEL read them without executing or modifying them.

| Property | Observed in-flight value |
| --- | --- |
| Additive migration | `i1q-question-platform/db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql` |
| Migration SHA-256 at reconciliation | `413a921577c581334601321a58a6119621ca26294748cf07b3de1e5cc60df7c4` |
| Forward compensation | `i1q-question-platform/db/rollback/20260715193845_i1q_1008a_compensating_disable.sql` |
| Compensation SHA-256 at reconciliation | `ac7f5c9885259bf9aa5d2c112114d77af755e65f093407d4418c54ca93f09fe9` |
| Forward reapply | `i1q-question-platform/db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql` |
| Reapply SHA-256 at reconciliation | `e633dfcc2fcfbe9bb965f9507457231d4968952dbfcd80007420d969de01d88d` |
| Runtime role candidate | `i1q_runtime`, `NOLOGIN`, `NOBYPASSRLS`, no schema ownership, no table grants |
| Current grant candidate | Schema usage and execute on `i1q.resolve_current_identity()` to `i1q_runtime`; role membership granted to `authenticated` |
| Identity function | Reads only `auth.uid()`, app-owned memberships, and reviewer credential state; returns `i1q.identity.v1` |
| Additional flags | Transcript batch extraction, physician approval, public access, and automated release publication, all inserted false |
| Compensation behavior | Revokes `i1q_runtime` from `authenticated` and invokes the existing data-preserving disable function |
| Operational state | Migration, compensation, and reapply are untracked and unapplied; no canonical workflow, target-side role evidence, rollback run, or reapply run exists |

`REVIEW BLOCKER`: granting `i1q_runtime` membership to the shared `authenticated` role is narrow while that role has only schema usage and identity-function execution. Any later table, authoring, or answer-key privilege on `i1q_runtime` would become broadly inheritable by authenticated clients unless the ownership model explicitly prevents it. The candidate must not be treated as authorization for broader grants.

### Compensation Candidate

| Property | Observed value |
| --- | --- |
| File | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql` |
| SHA-256 | `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a` |
| Behavior | Disables all six I1Q flags while preserving data and history |
| Status | Designed and validated locally; never executed on an authorized preview or staging target |

## Current Application Wiring

`OBSERVED SOURCE`:

- `i1q-question-platform/src/postgres-repository.mjs` defines a transaction-scoped repository contract.
- It requires a dedicated client, begins a transaction, sets isolation, checks `i1q.current_actor_id()`, commits or rolls back, and releases the client.
- It does not establish a Supabase JWT claim, database actor context, connection provider, or runtime role.
- `i1q-question-platform/src/server.mjs` does not instantiate this repository.
- The local application still uses the in-memory platform unless supplied with another platform object.
- `i1q-question-platform/package.json` has no PostgreSQL driver dependency.

`OBSERVED IN-FLIGHT SOURCE`: the concurrent identity adapter validates a RANKLISTIQ bearer token and accepts a supplied database-backed role-profile resolver. The concurrent migration exposes a current-identity function under the candidate runtime role. No composition root connects either candidate to `PostgresRepository`, and no operational client, target, or database grants for application data operations exist.

Therefore a datastore contract exists, but no operational datastore adapter exists.

## MR-078A Compliance And Missing Pieces

| Requirement | Current state | Evidence or impact |
| --- | --- | --- |
| Correct 14-digit timestamp | `OBSERVED PASS` | `20260715122434` |
| Ticketed descriptor | `OBSERVED PASS` | `i1q_1007x_question_platform` |
| Required header and transaction | `OBSERVED PASS` | Migration header plus `BEGIN` and `COMMIT` |
| Forward-only additive design | `OBSERVED PASS` | Creates new schemas and objects; no production mutation occurred |
| Target project pin | `AUTHORITY PASS` | RANKLISTIQ `fglyvdykwgbuivikqoah` |
| Canonical migration directory | `MISSING` | App-local candidate is not registered as project migration history. |
| Project-pinned CLI configuration | `MISSING` | No `supabase/config.toml`, project ref file, branch binding, or equivalent tracked configuration. |
| Preview project or branch | `MISSING` | No authorized preview or staging database identity was found. |
| GitHub preview workflow | `MISSING` | Source branch contains no `.github/workflows/`; GitHub's active workflows contain no I1Q or MR-078A workflow. |
| Current migration history | `MISSING` | No Supabase access was performed and no authorized static history export exists. |
| Backup identity | `MISSING` | No preview baseline or backup record. |
| Migration owner role | `MISSING` | No exact role or owner registration. |
| Unprivileged runtime role | `IN-FLIGHT CANDIDATE` | Untracked 1008A SQL defines `i1q_runtime` and a narrow identity RPC grant; it is not registered or applied, and it has no application data privileges. |
| Read-only operational auditor | `MISSING` | No exact role or grants. |
| Schema owner | `MISSING` | No target-side ownership evidence. |
| Apply verification | `MISSING` | Zero preview, staging, or production applies. |
| Rollback and reapply | `MISSING` | Local compensation proof is not operational rollback proof. |

## Root Migration Directory Is Not An I1Q Route

Path: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/supabase/migrations/`

MR-078B assigns this directory to Growth Engine. It also contains historical STAT, duel, avatar, telemetry, and USCE migrations associated with RANKLISTIQ. The authority document records Growth Engine migration history as desynchronized. This collision makes the directory unsafe for I1Q by convenience.

`DO NOT TOUCH`: do not copy the I1Q migration into this directory, infer a project from existing SQL content, run `db push`, repair history, or use Growth Engine as a preview substitute.

## Required Database Roles

| Role | Required authority | Observed implementation | Missing evidence |
| --- | --- | --- | --- |
| Migration owner | Applies versioned migration; owns schema as approved | None registered | Role name, owner, login path, workflow binding, target-side privileges |
| I1Q runtime role | No ownership, no bypass RLS, only approved operations | In-flight `i1q_runtime` is `NOLOGIN` and `NOBYPASSRLS`; only identity-function execution is proposed | Authority ratification, target-side existence, inheritance review, data-operation grants, connection binding, claim propagation, pool tests |
| Operational auditor | Read-only, no answer key or raw source unless explicitly authorized | None | Role name, views/functions, deny tests |
| Review identities | Enforced by `auth.uid()`, memberships, assignments, and RLS | Schema functions and policies exist | Canonical JWT/actor propagation and real role fixtures |
| Browser role | No service role; no broad direct authoring access | Built-in `anon` and `authenticated` explicitly revoked from `i1q` | Exact browser/API boundary for staging |

The exact owner of the RANKLISTIQ migration route is not named in inspected authority. Brian owns the product and Root alone may apply the migration in this ticket, but a datastore owner or workflow owner still must register the target and roles.

## Identity And Database Contract Gap

The database resolves actors through `auth.uid()`. In Supabase, that requires trusted request JWT claims or an equivalent provider-supported context. The current repository only checks the resulting value. It does not establish it.

`MISSING AUTHORITY AND OPERATIONS`: the in-flight candidate proposes verified RANKLISTIQ bearer identity plus `auth.uid()`-grounded role lookup. No approved composition proves how a dedicated I1Q server binds that identity to every PostgreSQL transaction without caller spoofing, pooled-connection leakage, or broad inherited privileges.

The design must not solve this by:

- trusting an actor UUID or role array from client JSON or headers;
- setting caller-controlled GUC values;
- embedding a service-role token in the browser;
- granting broad access to `authenticated`;
- using email as the authorization key;
- connecting the in-memory app directly to production.

Root and Lorentz must align the identity resolver, runtime role, connection pool, `auth.uid()` semantics, RLS, and audit actor on one versioned contract.

## Provider, Project, And Workflow Pins

| Pin | Current result |
| --- | --- |
| Datastore provider | `RESOLVED`: Supabase/PostgreSQL |
| Production project | `RESOLVED`: RANKLISTIQ `fglyvdykwgbuivikqoah` |
| Schema | `RESOLVED`: additive `i1q` |
| Preview project or branch | `MISSING` |
| Migration source directory | `MISSING` as canonical project history; app-local candidate only |
| CLI project binding | `MISSING` |
| GitHub workflow | `MISSING` |
| GitHub environment | `MISSING` |
| Migration owner role | `MISSING` |
| Runtime role | `IN-FLIGHT CANDIDATE`; not registered, applied, or connected |
| Auditor role | `MISSING` |
| Backup destination and identity | `MISSING` |
| Monitoring destination | `MISSING` |

## Safe Integration Path

1. Root obtains a named RANKLISTIQ datastore owner and records the exact preview or staging target identity without exposing credentials.
2. Register a dedicated I1Q migration source path and project-pinned GitHub workflow. Do not reuse root Growth Engine history.
3. Review the in-flight `i1q_runtime` design, especially its membership grant to shared `authenticated`, then register separate migration-owner, unprivileged runtime, and operational-auditor roles with explicit ownership, grants, inheritance, and deny rules.
4. Freeze the exact migration and compensation hashes in the workflow and release evidence.
5. Before apply, capture migration history, schema inventory, role inventory, grants, ownership, backup identity, and drift.
6. Apply only to the authorized preview target. Prove 52 tables, indexes, constraints, forced RLS, policies, no broad grants, no answer/source access, audit immutability, and legal transitions.
7. Execute the complete identity and role matrix against the real target, including pool reuse, forged actor, revoked actor, unauthorized student, and direct table access.
8. Execute forward compensation, prove the exact prior behavior boundary, then reapply and rerun the full matrix.
9. Wire the dedicated I1Q service to the unprivileged role through the approved identity context. Remove the in-memory repository from non-demo staging.
10. Run Arena, STAT, USCE, auth, and shared RANKLISTIQ regressions before any staging verdict.

## Exact Blockers Returned To Root

| Blocker | Impact | Required owner action |
| --- | --- | --- |
| No MR-078A I1Q workflow | Migration cannot be applied canonically. | Datastore and deployment owners register a project-pinned preview workflow. |
| No preview target | No real RLS, rollback, or reapply proof. | Datastore owner registers an authorized preview or staging database. |
| Runtime role candidate is unregistered and has no data-operation grants | Application cannot access the schema; future broad grants could unintentionally reach all shared authenticated clients. | Datastore owner and Security review inheritance, register the role, and prove least privilege on preview. |
| No actor propagation contract | `auth.uid()` cannot be trusted from the dedicated service. | Identity and datastore owners bind one versioned contract. |
| No PostgreSQL application wiring | Current service remains in-memory. | Root implements after authority and role closure. |
| Root migration directory collision | Wrong-project or history damage risk. | Keep I1Q isolated; register its own path. |
| No operational rollback proof | State B cannot pass. | Execute compensation and reapply on the authorized target. |

## Protected No-Touch Boundary

HERSCHEL did not access Supabase, inspect credentials, run SQL, apply or create a migration, alter roles, modify migration history, change flags, or edit any datastore or application file.
