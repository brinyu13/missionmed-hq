# B1-502M Database and Assignment Evidence

Recorded: 2026-07-27

## Isolated production target

- Railway project:
  `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment:
  `bcef8734-e42b-44df-8488-c2a3de68213f`;
- PostgreSQL service:
  `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- provider database deployment:
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`;
- PostgreSQL version: 18.4.

No existing Supabase project or MissionMed HQ database was reused.

## Exact before-state

Before migration:

`ledger_absent|class_objects|functions|role_collisions=1|0|0|0`

This proves:

- `public.sf_schema_migrations` absent;
- zero `sf_*` relation objects;
- zero `sf_*` functions;
- zero collisions for `anon`, `authenticated`, and `storyforge_app`;
- zero StoryForge users and assignments.

The readable pre-migration dump is
`B1-502M-RP-DB-PRE-20260727T173144Z`.

## Current applied state

The three guarded migrations were applied to the isolated target and recorded
with their exact checksums:

| Version | Migration | SHA-256 |
|---|---|---|
| `20260726150000` | `20260726150000_b1_500_storyforge_v5_foundation.sql` | `93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f` |
| `20260727170000` | `20260727170000_b1_502_storyforge_submit_assignment_gate.sql` | `95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f` |
| `20260727190000` | `20260727190000_b1_502_storyforge_background_preference.sql` | `ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405` |

Post-apply restore identifier:
`B1-502M-RP-DB-SCHEMA-20260727T190219Z`; dump SHA-256:
`60e12d7c38963ce05ffcbe735beb71d1e037225dd370a7ab32747182f80b2c00`.

Read-only verification at `2026-07-27T22:04:58Z` proved:

- migration ledger count: 3;
- all 15 StoryForge application tables have RLS enabled; the separate
  `sf_schema_migrations` ledger is present;
- `sf_users`, `sf_mentor_assignments`, `sf_stories`, and `sf_audit_events`
  each contain zero rows;
- the application role remains least privilege with `rolbypassrls=false`;
- database deployment `f5c7179e-b805-4e82-b080-d2349a0a47cf` is `SUCCESS`
  with `stopped=false`.

The related Railway API deployment
`fb43a551-04c8-41f7-a6e6-fb16aae3894e` is also `SUCCESS` with
`stopped=false`. Its sanitized health response is
`{"ok":true,"service":"storyforge-v5"}`; the origin root returns 404 and an
unauthenticated `/api/session` request returns 401.

## Migration contract

The immutable B1-500 foundation migration remains byte-identical to its
committed source:

`93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f`

B1-502M adds only additive migrations for:

- denying story submission when no active mentor assignment exists;
- an owner-bound authenticated StoryForge background preference.

The guarded production runner:

- checks exact Railway project and database service IDs;
- requires a verified backup ID and full deploy commit;
- refuses unexpected ledger, object, function, role, or checksum state before
  mutation;
- streams role bootstrap, all pending migrations, and matching ledger rows
  through one PostgreSQL transaction;
- creates `storyforge_app` as `NOLOGIN` during that transaction;
- configures a client-side SCRAM password and enables login only after the
  complete schema commit;
- is idempotent and checksum-enforced.

PostgreSQL 18 runner evidence:

- a forced failure exited 3 and left schema, ledger, and all three roles absent;
- first run plus idempotent second run returned three ledger rows, one
  least-privilege app login, zero users, and zero active assignments;
- Turing independently forced a ledger conflict and confirmed rollback;
- the application-role `SET ROLE authenticated` boundary returned zero rows.

The deploy receipt proves that the application role is `NOINHERIT`,
`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and
`NOBYPASSRLS`, owns no StoryForge object, has no direct table-write authority,
and can use only the intended policy boundary. The later read-only receipt
reconfirmed the least-privilege role and `rolbypassrls=false`.

## Founder binding and assignment policy

A future controlled founder enablement would create exactly one `sf_users`
row:

- one StoryForge UUID;
- one protected WordPress user-ID binding;
- role `student`;
- eligible and active;
- no demo identity or fixture content.

The current production database has zero `sf_users` rows and zero mentor
assignments. Mentor, advisor, and coach access remains denied. Once the exact
founder is bound, that founder may create and edit a private story but cannot
submit it for mentor review until an active assignment is added through a
later authorized release. The server RPC, UI, and authorization tests all fail
closed on that boundary.

Private means both absent from lists and inaccessible by direct identifier.
