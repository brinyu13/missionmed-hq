# B1-507 Database Migration Receipt

Status: PASS — PREFLIGHT AND APPLY COMPLETE.

Target:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- database service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- PostgreSQL 18.4 over SSL;
- system identifier `7667256745042145332`;
- source commit `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.

Guarded preflight returned
`B1_506_PRODUCTION_MIGRATION_PREFLIGHT_PASS` with exactly three pending
migrations.

The first apply attempt rolled back completely because the existing
`storyforge_app` role was already `LOGIN`, while the runner proves a `NOLOGIN`
precondition before the final transition. No ledger or schema change survived.

The successful apply:

1. disabled the WordPress StoryForge setting and observed a 65-second drain;
2. temporarily changed `storyforge_app` to `NOLOGIN` with a guaranteed restore
   trap;
3. applied the guarded transaction;
4. rotated to a new private 64-character application password coordinated with
   the dormant Railway deployment;
5. restored `storyforge_app LOGIN`.

Added ledger rows:

- `20260729000100_b1_506_voice_recording_sessions.sql` —
  `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`
- `20260729000200_b1_506_feature_flags.sql` —
  `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a`
- `20260729010000_b1_506a_voice_audit_lifecycle.sql` —
  `e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323`

Final verification:

- exact eight-row migration ledger;
- `storyforge_app`: LOGIN, non-superuser, no BYPASSRLS, NOINHERIT;
- `authenticated` retains exact membership in `storyforge_app`;
- `voice_capture|off|0|0`;
- 1 StoryForge user;
- 0 mentor assignments;
- 0 stories;
- 0 recording sessions;
- 0 recording segments;
- 0 audio assets.

No unrelated database data or schema was changed. Additive dormant schema is
retained during normal rollback; the locked provider backup and verified dump
are reserved for actual corruption recovery.
