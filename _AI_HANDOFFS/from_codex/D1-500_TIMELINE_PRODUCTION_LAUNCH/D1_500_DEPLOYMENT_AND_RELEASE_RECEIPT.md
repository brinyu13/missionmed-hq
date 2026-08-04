# D1-500 Deployment and Release Receipt

- Accepted source commit: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Deployment-config repair commit: `7cf30eb`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`.
- WordPress payload SHA-256:
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`.
- Critical Systems gate: 140 PASS, 3 WARN, 0 FAIL.
- Matrix immutable-source/live guard: 10 PASS, 0 FAIL.
- PostgreSQL schema: `d1-timeline-db-500.1`, migrated and verified.
- Railway URL: `https://mission-timeline-api-production.up.railway.app`.
- First deployment `fcd4805f-153d-48b7-8b0e-1207ecdb2cbd`: FAILED CLOSED
  during image build because the generated Nixpacks plan performed duplicate
  `npm ci` operations.
- Repaired deployment `5d682cfe-ac05-42d4-8026-af9afd6eebb2`: image build
  PASS; FAILED CLOSED at `/healthz` because the API service did not contain
  `TIMELINE_JWT_SECRET` or `TIMELINE_GATEWAY_SECRET`.
- Railway application state: offline; no successful deployment identifier yet.
- Kinsta payload: installed at the exact authorized hash.
- Kinsta settings: feature off, rollout off, no canaries, no eligible users.
- Canonical route: `https://missionmedinstitute.com/timeline/`, installed but
  not live to authorized users.
- Anonymous route behavior: `302` to the approved Matrix member-dashboard
  flow.
- Anonymous token POST: denied `401` with `session_required`.

The payload contains only the Timeline SSO plugin, Matrix launch asset, MU
route, and immutable runtime release. No secret value is present in the
artifact, Git history, logs, screenshots, or evidence.
