# I1Q-1008A Datastore Authority

## Project And Schema

`VERIFIED`: I1Q belongs in additive schema `i1q` under the RANKLISTIQ data-flow authority. Production project mutation is prohibited for this ticket.

`OPEN`: the nonproduction project or branch and its migration owner are unassigned.

## Principal Separation

The local candidate now separates these database concepts:

| Principal | Local candidate | Browser reachable | Current grants |
| --- | --- | --- | --- |
| Migration owner | External and unassigned | No | Migration workflow only, once approved |
| `i1q_identity_profile_reader` | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` | Inherited by `authenticated` | Schema usage and exact execute on caller-scoped `resolve_current_identity()` only |
| `i1q_app_runtime` | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` | No | Deny all pending exact target and actor-binder authority |
| Operational auditor | Contract only | No | Unassigned |
| Rollback operator | Workflow authority only | No | Unassigned |

The name split prevents future application grants from becoming transitively available to every authenticated browser user.

## Actor Context

The identity-profile RPC uses `auth.uid()` and returns only the current actor's active membership and credential status. It does not accept actor, role, email, WordPress ID, or request headers as arguments.

`OPEN HIGH`: a dedicated server connection actor binder and exact `i1q_app_runtime` grant manifest are not owner-approved. The current `PostgresRepository` is partial and is not wired into the synchronous application service. This blocks real datastore integration.

## Authority Verdict

The additive migration and role contracts are locally reproducible but unapplied. Datastore authority is not closed for State B.
