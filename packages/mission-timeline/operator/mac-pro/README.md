# D1 Mac Pro Renderer Operator Fixture

Status: `LOCAL_WORKER_SIMULATOR_NOT_CONNECTED`

This package documents and exercises the D1-413 Mac Pro job contract. It is not a Matrix, database, storage, Keynote, FileVault, or production connection. Installing the LaunchAgent does not make the worker production-ready.

## Safety Boundary

- The coordinator sends a sanitized render projection, immutable source version/hash binding, approved template/font/asset/renderer hashes, requested format, and idempotency key.
- It never sends Matrix cookies, WordPress nonces, database credentials, object-store credentials, raw source documents, extraction text, advisor review bodies, or event notes/provenance.
- `INTERVIEWER_SAFE`, `PRINT`, and `ACCESSIBLE` jobs contain only `INTERVIEWER_SAFE` events.
- Job envelopes and worker commands use separate HMAC credentials.
- Output completion is atomic only after authority fields, MIME, dimensions, byte size, magic bytes, and SHA-256 pass.
- `connected` is hard-coded `false`. There is no remote poll URL in this fixture.

## Files

- `sample-config.json`: non-secret staging configuration.
- `com.missionmed.timeline-renderer.staging.plist`: disabled LaunchAgent template.
- `worker-entrypoint.mjs`: configuration check that refuses connected operation.
- `rotate-credential.mjs`: creates local credential files with mode `0600`; it never prints secret values.
- `acceptance-check.mjs`: runs one disconnected deterministic job and verifies replay.

## Local Acceptance

Run from `packages/mission-timeline`:

```bash
D1_MAC_PRO_ENVELOPE_SECRET='local-acceptance-envelope-secret' \
D1_MAC_PRO_WORKER_SECRET='local-acceptance-worker-secret' \
node --import tsx operator/mac-pro/acceptance-check.mjs
```

The script must report:

- mode `LOCAL_WORKER_SIMULATOR_NOT_CONNECTED`
- connected `false`
- first completion `COMPLETED`
- repeated submission reuses the same job
- output SHA-256 and 1920x1080 dimensions validated

## Credential Rotation

Credentials are separate and should be rotated independently:

```bash
node operator/mac-pro/rotate-credential.mjs \
  --output-dir "$HOME/Library/Application Support/MissionMed/TimelineRenderer/staging"
```

Rotation procedure:

1. Stop the disabled/local fixture.
2. Generate new credential files with the command above.
3. Update the coordinator and worker references together during a maintenance window.
4. Reject queued envelopes signed by retired keys or explicitly reissue them with new idempotency keys.
5. Run `acceptance-check.mjs` with the new credentials.
6. Record key IDs and timestamps, never secret values, in the operator audit record.

## Failure Behavior

- Crash or lost heartbeat: the coordinator lease expires and requeues until `maxAttempts`, then fails.
- Low disk: the worker refuses the job and returns `RENDER_LOW_DISK`.
- Partial or corrupt output: no output becomes completed; the job is requeued or fails at the retry ceiling.
- Duplicate submission/completion: identical input is returned idempotently; conflicting input is rejected.
- Timeout: handled by the same heartbeat/lease sweep.

## Promotion Blockers

Production promotion requires a ratified network transport, mTLS or equivalent machine identity, secret storage, queue durability, object-store transfer, real disk telemetry, sandboxed Keynote execution, template/font installation checks, atomic upload, monitoring, operator paging, and a supervised Mac Pro acceptance run. None is supplied here.

