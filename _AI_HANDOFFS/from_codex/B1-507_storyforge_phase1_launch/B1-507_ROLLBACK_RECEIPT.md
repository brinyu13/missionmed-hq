# B1-507 Rollback Receipt

Status: COMMANDS AND BASELINE VERIFIED; FRESH REHEARSAL PENDING.

Last safe production rung: existing B1-503 Founder-only text production.

Rollback order for a dormant deployment:

1. keep/remove all voice cohort scope;
2. set database voice flag `off`;
3. set `STORYFORGE_VOICE_FORCE_OFF=1`;
4. set `STORYFORGE_TRANSCRIBE_PROVIDER=none`;
5. set `STORYFORGE_AUDIO_RECONCILIATION=off` and suspension nonempty if incident response requires it;
6. restore the previous Kinsta pointer/route via the sealed install receipt;
7. re-upload the verified B1-503 Railway archive if the API must be restored;
8. retain additive dormant schema unless verified corruption requires an expressly authorized database restore.

Verified B1-503 rollback archive:

- path `/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar`
- required SHA-256 `dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870`

Fresh timed rollback proof remains mandatory before production writes.
