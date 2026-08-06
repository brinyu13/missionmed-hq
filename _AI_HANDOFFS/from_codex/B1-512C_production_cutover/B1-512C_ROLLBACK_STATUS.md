# B1-512C Rollback Status

## Ready rollback position

The prior immutable Kinsta release remains retained and the B1-512 installer sealed an additional rollback receipt before activation.

| Rollback item | Verified value |
|---|---|
| Prior Kinsta pointer | `releases/752d408f32c7becc9d10712e163ab86693998edc` |
| Prior route SHA-256 | `e30a563cedd6e4d4fab03bbbac1bc72bfe2fbe82efbd44fdad5e6b5ea607455f` |
| New rollback receipt | `/www/theresidencyacademy_209/private/b1-512c/rollback/B1-512C-KINSTA-20260806T214900Z/rollback.tsv` |
| New receipt SHA-256 | `212d92c2207c5b8ffc51ff46064e3d410b9e9d2918e291ffec5250c612134cd5` |
| Railway prior deployment | `17615414-9422-453a-9eb8-7d1b36f462a6` (retained history) |
| Database recovery | locked Railway backup `835127ec-49f6-46a9-a55c-db6582748edd` plus verified local PG18 dump/restore receipt |

## Narrow rollback order

1. Keep `STORYFORGE_STORY_MEDIA_FORCE_OFF=1`; if needed, force off only the new Content & Display capability.
2. Restore the Kinsta `current` pointer and route using the sealed B1-512C receipt and re-enable the flag after verification.
3. Redeploy Railway deployment `17615414-9422-453a-9eb8-7d1b36f462a6` only if the API regression requires it.
4. Leave the additive B1-512 migration dormant after frontend/backend rollback.
5. Use database restore only under incident authority for demonstrated data or schema corruption.

No rollback trigger was observed during the B1-512C bounded cutover.
