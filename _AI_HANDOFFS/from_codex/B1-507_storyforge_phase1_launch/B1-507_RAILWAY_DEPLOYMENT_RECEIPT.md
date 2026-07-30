# B1-507 Railway Deployment Receipt

Status: READ-ONLY PREFLIGHT PASS; NO DEPLOYMENT.

Verified:

- project `missionmed-storyforge-v5`;
- production environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- API service `dab015bf-15ef-4698-9f16-cbf8cf23de7a`;
- database service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- current API deployment `fa7ad084-4dae-4039-a154-2250a407d95e`;
- current API deployment status SUCCESS;
- one running API instance in `us-west2`;
- one running PostgreSQL instance;
- current backend is the B1-503 release.

Current API variables do not yet contain the four B1-507 dormant declarations. Before deploy, set with `--skip-deploys`:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_PLATFORM_OFF=1
```

Keep `STORYFORGE_PLATFORM_CONSUMERS` absent/empty and do not add R2/OpenAI secrets during dormant deployment.
