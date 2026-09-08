# Rollback

No WordPress, RISE service, RISE database, Matrix, LearnDash, cache, or environment configuration changed in P1-RISE-5010. Those planes require no incident rollback.

## Shared-HQ provider anchors

Pre-repair active deployment:

- deployment `c12ee3b3-3524-40f6-8236-d4811b1e5bc0`
- image `sha256:0a2ff252258ef96d110a30e3a8cfd89a69b8f95ffdd275ef1889bc8f74e315d7`
- source `420c36693d426b1d24d4001e710304451886451c`

Repaired deployment:

- deployment `fefc56c4-5c0e-41c5-96fc-6493a1d966af`
- image `sha256:8e16a5a1263f0cb280cdb9f40a9c9a0547e62299cff070ffbd055599ce960288`
- historical coherent source deployment `c322eee1-4ca2-456c-a9f4-09f6705eb16b`
- source runtime commit `c3d6c9cd12d4838fed6bb699fe9d574956ab15e7`

## Procedure

If the repaired shared runtime develops an attributable critical regression:

1. Re-read the current Railway project, environment, service, deployment, and image.
2. Preserve logs and the current provider IDs.
3. Prefer provider-native redeploy of the verified coherent historical deployment `c322eee1-4ca2-456c-a9f4-09f6705eb16b`, or redeploy the current repaired deployment `fefc56c4-5c0e-41c5-96fc-6493a1d966af` if only the running instance is unhealthy.
4. Require `/api/health` HTTP 200, `/health/lor-studio` HTTP 200, a fresh RISE-audience SSO exchange, administrator control, 360 control, and anonymous fail-closed checks.
5. Do not roll back RISE PostgreSQL migrations or registry data; this incident made no database change.

Railway can also redeploy the exact pre-repair deployment `c12ee3b3-3524-40f6-8236-d4811b1e5bc0`, but doing so would deliberately restore the known RISE outage and the LOR health regression. It is an emergency preimage only, not the recommended service-recovery target.

The provider-native historical redeploy mechanism was exercised to produce the active repaired deployment. A destructive post-repair reversal was not performed because it would recreate the P1 outage.

```text
ROLLBACK_READY = YES
```
