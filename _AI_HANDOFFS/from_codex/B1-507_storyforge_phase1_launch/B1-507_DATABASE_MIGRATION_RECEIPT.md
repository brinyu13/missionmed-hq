# B1-507 Database Migration Receipt

Status: READ-ONLY BASELINE PASS; PREFLIGHT/APPLY NOT EXECUTED.

Production baseline:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- database service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- PostgreSQL 18 over SSL;
- system identifier `7667256745042145332`;
- database/user `railway` / `postgres`;
- exact five known migrations;
- 1 StoryForge user;
- 0 active mentor assignments;
- `sf_recording_sessions` and `sf_feature_flags` absent;
- existing `sf_audio_assets` present.

Pending candidates and hashes:

- `20260729000100_b1_506_voice_recording_sessions.sql` — `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`
- `20260729000200_b1_506_feature_flags.sql` — `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a`
- `20260729010000_b1_506a_voice_audit_lifecycle.sql` — `e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323`

Exact next command after fresh backup/restore receipts:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
./scripts/apply-production-migrations.sh preflight
```

Do not run `apply` until the preflight passes against the exact release commit and receipt.
