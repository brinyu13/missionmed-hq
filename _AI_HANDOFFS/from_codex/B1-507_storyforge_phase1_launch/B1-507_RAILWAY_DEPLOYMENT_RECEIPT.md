# B1-507 Railway Deployment Receipt

Status: PASS — DORMANT BACKEND DEPLOYED.

- Project: `missionmed-storyforge-v5` /
  `875e7c17-d06f-4301-a4bb-e61016f153cf`.
- Environment: production /
  `bcef8734-e42b-44df-8488-c2a3de68213f`.
- API service: `storyforge-v5-api` /
  `dab015bf-15ef-4698-9f16-cbf8cf23de7a`.
- PostgreSQL service:
  `a4a66362-c3ba-475a-ae21-2aa46624bafe`.
- Deployment:
  `2fe2f8e9-9f24-47c4-b0bd-3a7a0a26a82d`.
- Status: SUCCESS.
- Railway deployment `meta.imageDigest`:
  `sha256:2eafe61cfe9400e1395c94fe7938474f82f051fbf07276603bf0ff46a35b4a6d`.
- Source commit:
  `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.
- Release ID: `v-4f40609482162cbd`.
- Source archive SHA-256:
  `fcd8f773d1b1d4fd915244bac7e8d652b35ae5b538c5ed77af682b427a1fea56`.
- Topology: exactly one RUNNING API instance in `us-west2`; exactly one
  RUNNING PostgreSQL instance.

Dormant readback:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_PLATFORM_OFF=1
STORYFORGE_PLATFORM_CONSUMERS=<absent-or-empty>
STORYFORGE_R2_*=<absent>
STORYFORGE_OPENAI_API_KEY=<absent>
```

Origin verification:

- `/healthz`: 200, `{"ok":true,"service":"storyforge-v5"}`;
- `/`: 404;
- `/api/config`: 200, `devAuth=false`, `audioAvailable=false`,
  `identityMode=missionmed-signed-jwt`, `basePath=/storyforge/`;
- unauthenticated `/api/recordings`: 401 `auth_required`;
- unapproved Origin `/api/config`: 403 `origin_not_allowed`;
- authenticated Founder E1, legacy presign, and legacy confirm: each 403
  `voice_disabled`.

The build log’s generic release-safety metadata remained
`deployable:false`/`deploymentAuthorized:false`; the B1-507 Goal and later
steering supplied the actual bounded deployment authority. The deployed source
is nevertheless the exact pinned archive, and the dormant controls above are
the enforced runtime boundary.
