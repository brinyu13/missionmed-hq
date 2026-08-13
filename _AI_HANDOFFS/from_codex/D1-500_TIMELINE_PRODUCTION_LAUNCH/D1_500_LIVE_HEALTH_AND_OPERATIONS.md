# D1-500 Live Health and Operations

Current health: PASS.

- Endpoint: `https://mission-timeline-api-production.up.railway.app/healthz`.
- HTTP: 200.
- Cache-Control: `no-store`.
- Service: `mission-timeline`.
- Version: `timeline-0c5cc515a76346d6`.
- Schema: `d1-timeline-db-500.1`.
- Railway deployment: `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`, SUCCESS.
- Public direct data endpoint without gateway: 403 `GATEWAY_REQUIRED`.
- Anonymous same-origin API: 401 `session_required`.

Operational controls:

- Admission kill switch: WordPress `missionmed_timeline_settings`.
- Feature-off values: `timeline_enabled=false`, `rollout_stage=off`.
- Current values: enabled, `eligible_360`.
- Rate limit: 30 requests per 60 seconds.
- JWT TTL: 120 seconds.
- Kinsta current release is an atomic symlink to an immutable directory.
- Structured server logs use request IDs and avoid password/secret output.
- Backup and scoped rollback receipts are in the companion recovery report.

The real Matrix and app journeys remained functional after fixture cleanup. No unrelated-application regression was observed.

Post-authority-closure recheck at 2026-08-04T21:49Z: the anonymous canonical route returned the approved 303 Matrix handoff; Railway health returned `ok=true`, service `mission-timeline`, version `timeline-0c5cc515a76346d6`, and schema `d1-timeline-db-500.1`; Kinsta current still resolved to `releases/timeline-wp-0fc51f8906decb8e`.
