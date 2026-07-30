# B1-507 Kinsta and WordPress Deployment Receipt

Status: PASS — IMMUTABLE DORMANT RELEASE INSTALLED.

- Stage:
  `/www/theresidencyacademy_209/private/b1-507/stage/B1-507-KINSTA-STAGE-20260730T052200Z`.
- Guarded install preflight:
  `B1_503_KINSTA_INSTALL_PREFLIGHT_PASS`.
- Active pointer:
  `releases/09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.
- Route SHA-256:
  `51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f`.
- Route size/mode: 37,413 bytes / `0444`.
- Release SHA-256:
  `4304a2bad8818e47f7329e66cfd747604851c88ac0bf6248686765d64c9f6a93`.
- Release size/mode: 867,355 bytes / `0444`.
- Release directory mode: `0555`.
- Owner/group: `theresidencyacademy:www-data`.

The install published the exact pointer, route, and release, then its final
PHP cache-purge call failed because Kinsta returned an unexpected body and the
host PHP process exited 139. No published byte was incorrect. MyKinsta’s
authenticated **Clear all caches** control was used as the bounded provider
workaround and returned to its enabled state.

Post-purge proof, three consecutive requests:

- `/storyforge/`: 200;
- SHA-256 each time:
  `d15a7af658241ce686e14c870c6c656e78c54121490af736bb1c136d68777ccb`;
- size: 1,397 bytes;
- `CF-Cache-Status: DYNAMIC`;
- `X-Kinsta-Cache: BYPASS`;
- no `Age`.

`/storyforge/healthz` returned 200 with
`{"ok":true,"service":"storyforge-v5"}` and the same cache-bypass posture.

WordPress was held disabled through the drain, database rotation, Railway
deployment, Kinsta install, cache clear, and hidden smoke. It was then restored
to exactly:

```text
storyforge_enabled=true
allowlist=1
override=student
roles=student
cohorts=0
ttl=60
```

No `missionmed-hub` asset was changed.
