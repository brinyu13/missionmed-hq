# I1Q-1007X RLS Test Matrix

Status: DESIGN BASELINE; NO POSTGRES EXECUTION PERFORMED

Verdict: BLOCK

## Authority Context

DR-006 now selects the additive RANKLISTIQ `i1q` schema and requires forced RLS, deny-by-default access, transaction-local canonical actor context, assignment-scoped reviews, immutable audit, and no broad grants. The earlier routing blocker was a snapshot-time root-recovery finding addressed by DR-006 and MissionMed OS PR #12. Candidate RLS remains unsafe and untested.

## Candidate Findings

- `i1q.session_actor_id()` trusts `current_setting('app.actor_id')`.
- `i1q.session_has_role()` trusts comma-separated `current_setting('app.actor_roles')`.
- Nearly every table permits SELECT when actor ID is merely non-null.
- Only `source_records` and `transcript_artifacts` receive a narrower read policy; normalized working text, answer-bearing revisions, review data, and channel artifacts remain broad.
- Insert and update policy generation treats all tables alike and recognizes only asserted admin/system roles.
- No assignment, reviewer, author, release, source, or purpose predicate exists.
- No client grants are made, which prevents present direct exposure but also means operational behavior is unproved.
- No database repository maps application records to SQL or proves transaction-local context.

## Identity Attack Cases

| ID | Actor/context | Operation | Expected | Candidate assessment |
| --- | --- | --- | --- | --- |
| RLS-001 | Anonymous, no context | SELECT any `i1q` table | Zero rows or permission denied | Likely deny; not executed |
| RLS-002 | Authenticated actor, no I1Q role | SELECT internal table | Zero rows or denied | Candidate actor-present policy would allow if actor setting exists |
| RLS-003 | Caller sets `app.actor_id` | SELECT answer revision | Denied | Candidate policy would allow if caller can set context |
| RLS-004 | Caller sets `app.actor_roles=platform_admin` | INSERT/update protected record | Denied | Candidate policy trusts asserted role |
| RLS-005 | Context omitted after pooled prior request | SELECT prior actor data | Denied; no identity bleed | Adapter absent, not tested |
| RLS-006 | Forged reviewer ID with valid actor | INSERT review event | Denied | No row-scoped policy proof |
| RLS-007 | Platform service role accidentally used by client | Any base-table operation | Impossible by architecture | Deployment/bundle proof absent |
| RLS-008 | Table owner under FORCE RLS | SELECT/UPDATE | Policy applies unless authorized bypass role | Not executed |
| RLS-009 | `BYPASSRLS` connection | Application request | Connection prohibited | Connection role design absent |

## Table Access Matrix

Legend: `D` deny, `S` scoped, `A` explicit administrative workflow, `I` internal service only.

| Table class | Anonymous | Read-only | Author | Assigned editor | Assigned physician | Privacy owner | Release manager | System |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Taxonomy/blueprint published view | D | S read | S read | S read | S read | S read | S read | I/A |
| Draft concepts/items | D | D | S own/assigned | S assigned | S assigned | D | S release | I/A |
| Answer-free revision view | D | S approved internal subset | S own/assigned | S assigned | S assigned | D | S release | I |
| Answer-bearing revision store | D | D | S purpose endpoint | S purpose endpoint | S purpose endpoint | D | S purpose endpoint | I |
| Review assignments | D | D | S own where needed | S reviewer | S reviewer | D | S queue admin | I/A |
| Review events | D | D | S authored history | S assigned insert/read | S assigned insert/read | D | S release read | I/A |
| Rights/privacy records | D | D | S read status only | S read status only | S read status only | A | S release read | I/A |
| Raw source refs/transcripts | D | D | D | D | D except explicit purpose | A restricted | D | I restricted |
| Working transcript segments | D | D | S assigned source | S assigned source | S assigned source | A | D | I |
| Releases/manifests | D | S non-answer metadata | S read | S read | S read | S read | A | I/A |
| Channel class A artifacts | D except approved consumer RPC | S internal where approved | S | S | S | S | A | I |
| Channel class B artifacts | D | D | D except purpose | D except purpose | D except purpose | D | A purpose-audited | I |
| Audit events | D | D | S own limited view if needed | S own limited view | S own limited view | S owned domain | S release domain | I/A append-only |
| Feature flags | D | S read allowed state | S read | S read | S read | S read | A per authority | I/A |

## Required Preview SQL Tests

1. Confirm every table has RLS enabled and forced.
2. Confirm no policy uses unconditional `true` for authenticated access.
3. Confirm anonymous and ordinary authenticated roles have no base-table grants beyond approved views/RPCs.
4. Attempt to forge actor and role context from every application database role.
5. Test every matrix cell with two actors, two assignments, two revisions, and two releases.
6. Prove an assigned reviewer cannot read or write another reviewer's assignment.
7. Prove an administrator cannot impersonate a reviewer through review-event insertion.
8. Prove answer-bearing tables and artifacts cannot be selected by read-only, author without purpose, or student paths.
9. Prove raw source references and transcript objects remain restricted.
10. Prove transaction rollback and pooled-connection reuse clear actor context.
11. Prove immutable tables reject update and delete through every role, including owner where expected.
12. Prove audit events cannot be updated, deleted, inserted with a broken predecessor, or reordered.
13. Run EXPLAIN and index checks for assignment queues, release joins, and composite projected identity.
14. Execute compensating rollback, verify policies and flags, then reapply and rerun all cases.

## Evidence Requirements

- Exact project ref and preview database identity recorded by Root without exposing credentials.
- Migration list/diff/lint before and after.
- Machine-readable pass/fail results for every test ID.
- SQLSTATE and row-count assertions, not screenshots alone.
- No service-role token or environment value in test artifacts.
- Independent rerun against the fixed commit.

## Exit Rule

Static claims such as `FORCE ROW LEVEL SECURITY` are insufficient. Staging remains blocked until the trusted context design exists and every RLS attack case passes on the authorized preview database.
