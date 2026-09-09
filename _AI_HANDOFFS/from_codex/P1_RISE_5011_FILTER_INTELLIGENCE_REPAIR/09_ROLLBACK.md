# Rollback

Protected rollback source commit: `87baae48626c49873c35ed387b79229782144525`.

Protected prior RISE deployment:

- deployment: `42fc0ec3-3dfc-4e0a-a517-4b158b98fcb6`
- historical status: `REMOVED` after successful cutover, retained in Railway deployment history
- image: `sha256:a88fe4bc8a7d9542d1cca58e4a1a2cae286d25c8e2a5aaefff02aafff673b036`
- build: `rise_web_15b0c71f1bf7`
- web manifest pin: `315df087ffe11ec81ded740133694cf2872f19fb229987e7edf97b48d8adb09a`

Rollback procedure:

1. Select historical deployment `42fc0ec3-3dfc-4e0a-a517-4b158b98fcb6` in the isolated RISE service.
2. Restore the two safe build/manifest pins above without exposing or changing any secret value.
3. Verify `/api/rise/v1/health`, authenticated 360/admin sessions, anonymous denial, all 6,139 programs, 31 specialties, SOAP 883, Program File, My Programs, and Student Intel.
4. Confirm RISE HTTP 5xx remains zero and no shared product changed.

No rollback was executed because the new deployment passed service, student, admin, anonymous, data, filter, mobile, and regression gates. Database rollback is unnecessary: 5011 applied no migration and performed no data mutation.

