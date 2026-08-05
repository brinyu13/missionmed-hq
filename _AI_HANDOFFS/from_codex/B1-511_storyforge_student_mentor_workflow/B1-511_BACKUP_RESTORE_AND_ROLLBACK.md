# B1-511 Backup, Restore, and Rollback

## Fresh pre-write backups

Railway volume backup:

- volume instance `8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5`
- backup `9d5468b6-d9c5-4c86-913b-9faeed7aa6c5`
- created `2026-08-05T23:09:39.100Z`, locked, no expiry

PostgreSQL 18 custom dump:

- `/Users/brianb/MissionMed_private_backups/B1-511/B1-511-PRE-20260805T230950Z/storyforge-b1-511-pre.dump`
- SHA-256 `a78ec12adb858e182f0fe745fc527580553241ec35785e772ebe67011ec1ba96`
- 378,316 bytes, mode `0600`, 384 catalog lines
- isolated PostgreSQL 18 restore: PASS after recreating the non-login
  `authenticated` and `storyforge_app` roles
- restored counts: 441 users, 20 stories, 10 migration rows, 13 recordings

The first dump attempt used Railway's private hostname outside Railway and
created a zero-byte file. It was immediately replaced at the same exact path
using the public endpoint and was not treated as a backup until the catalog and
restore passed.

Kinsta snapshot:

- `/www/theresidencyacademy_209/private/b1-511/B1-511-PRE-20260805T231300Z`
- manifest SHA-256 `aad8c4d756dd0f3c0a23d0f8df6c347adf87646eb7849699b62afeeee5bc92a0`
- 9 sealed files covering route, release, pointer, SSO, and settings
- prior pointer `releases/4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981`

## Rollback ladder

1. Keep/restore `STORYFORGE_MENTOR_NOTES_FORCE_OFF=1`.
2. Set `story_workflow` off.
3. Set the related additive feature flags off.
4. Atomically restore the prior Kinsta pointer/route from the sealed receipt.
5. Redeploy the prior Railway image/deployment.
6. Leave the additive schema dormant.
7. Restore the database only under explicit incident authority.

Kinsta rollback receipt:
`/www/theresidencyacademy_209/private/b1-511/rollback/B1-511-KINSTA-ROLLBACK-20260805T232900Z/rollback.tsv`,
SHA-256 `794530531850fc74d1594c477b72960eb2d34ab742e28f4786bb03b2c68f15b6`.
