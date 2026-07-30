# B1-507 Rollback Receipt

Status: PASS — FRESH RECOVERY POINTS AND GUARDED PREFLIGHT VERIFIED.

Current safe production rung: B1-507 dormant/default-off Founder-only text.

Rollback order for a dormant deployment:

1. keep/remove all voice cohort scope;
2. set database voice flag `off`;
3. set `STORYFORGE_VOICE_FORCE_OFF=1`;
4. set `STORYFORGE_TRANSCRIBE_PROVIDER=none`;
5. set `STORYFORGE_AUDIO_RECONCILIATION=off` and suspension nonempty if incident response requires it;
6. set `storyforge_enabled=false` and observe the drain;
7. restore the previous Kinsta pointer/route via the sealed install receipt;
8. restore the previous Railway archive with the database credential that
   matches the rotated `storyforge_app` password;
9. restore the WordPress setting only after the old text shell is healthy;
10. retain additive dormant schema unless verified corruption requires an
   expressly authorized database restore.

Sealed Kinsta rollback:

- directory:
  `/www/theresidencyacademy_209/private/b1-507/rollback/B1-507-09878514-20260730T052200Z`;
- receipt SHA-256:
  `550aa70723e1ab57806c3c7cad5dc22bf85e862f04c0879996625229efde67f5`;
- prior route SHA-256:
  `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61`;
- guarded result during the feature-off cutover window:
  `B1_503_KINSTA_ROLLBACK_PREFLIGHT_PASS`;
- preflight observed active target:
  `releases/09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.

Verified B1-503 rollback archive:

- path `/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar`
- required SHA-256 `dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870`

Database recovery:

- locked Railway backup
  `aed95152-2d7e-46ac-9d5d-d303c1c6a474`;
- logical dump SHA-256
  `42b9394b609b732ceb4b70ddccf45c70a481f8caf586867ff5a0849dfb35f53f`;
- isolated restore PASS.

No rollback was executed because the cutover and all health/auth/hash checks
passed. That avoids an unnecessary production outage while proving the exact
guarded rollback inputs and preconditions. The preflight is intentionally not
runnable while the restored Founder setting is true; an actual rollback must
first disable the feature and observe the drain.
