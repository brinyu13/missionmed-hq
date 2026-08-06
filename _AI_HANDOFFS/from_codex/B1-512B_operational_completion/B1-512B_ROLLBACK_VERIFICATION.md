# B1-512B Rollback Verification

Status: **PASS for current live-runtime recovery; B1-512 release rollback remains unexercised because B1-512 is not deployed.**

1. Fresh Railway provider backup `835127ec-49f6-46a9-a55c-db6582748edd` is locked with `expiresAt=null`.
2. Fresh PG18 logical dump restored in isolation with empty stderr.
3. Fresh MyKinsta manual backup has Restore control and 14-day retention.
4. Sealed Kinsta snapshot pointer, route, release, and manifest hashes verify a second time.
5. `bash -n` passed for `rollback-b1-503-kinsta-release.sh`, `install-b1-503-kinsta-release.sh`, and `apply-b1-512-production-migration.sh`.

Current Kinsta pointer is `releases/752d408f32c7becc9d10712e163ab86693998edc`; current Railway deployment is `17615414-9422-453a-9eb8-7d1b36f462a6`. The Kinsta rollback contract restores only a sealed route/pointer and does not delete release directories. Database restore remains incident-only after route drain.

There is no B1-512 deployment, migration, active pointer, or B1-512 install rollback receipt to execute. A B1-512 deployment must first create the install receipt before a candidate pointer can be rolled back.
