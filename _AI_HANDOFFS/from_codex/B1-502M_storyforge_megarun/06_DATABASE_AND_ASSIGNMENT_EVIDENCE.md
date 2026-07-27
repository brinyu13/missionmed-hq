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

Disposable PostgreSQL 18 evidence:

- a forced failure exited 3 and left schema, ledger, and all three roles absent;
- first run plus idempotent second run returned two ledger rows, one
  least-privilege app login, zero users, and zero active assignments;
- Turing independently forced a ledger conflict and confirmed rollback;
- the application-role `SET ROLE authenticated` boundary returned zero rows.

Final production receipts must additionally prove that the deployed app role is
`NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and
`NOBYPASSRLS`, owns no StoryForge object, has no direct table-write authority,
and can use only the intended policy boundary.

## Founder binding and assignment policy

The founder release creates exactly one `sf_users` row:

- one StoryForge UUID;
- one protected WordPress user-ID binding;
- role `student`;
- eligible and active;
- no demo identity or fixture content.

The release creates zero mentor assignments. Mentor, advisor, and coach access
remains denied. A founder may create and edit a private story but cannot submit
it for mentor review until an active assignment is added through a later
authorized release. The server RPC, UI, and authorization tests all fail
closed on that boundary.

Private means both absent from lists and inaccessible by direct identifier.
