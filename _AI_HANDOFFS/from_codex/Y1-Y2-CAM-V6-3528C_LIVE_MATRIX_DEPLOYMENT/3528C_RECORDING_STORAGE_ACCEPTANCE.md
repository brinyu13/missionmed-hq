# 3528C Recording and Storage Acceptance

## Implemented

- One `MediaRecorder` consumes the same real camera/microphone stream and canonical session time base as analytics.
- States: `READY`, `RECORDING`, `PAUSED`, `FINALIZING`, `SAVED`, and `ERROR` with retry from the retained final blob.
- Chunks are uploaded through authenticated same-origin HQ requests with exact content ranges, bounded 5 MiB parts, retry/backoff, CSRF, an HMAC upload token, and expiry.
- The browser never receives the raw R2 object key.
- The server signs the private CDN/R2 path; playback/download URLs are short lived.
- Pause spans and media metadata have durable schema fields.

## Production evidence

A real browser recording produced a non-empty Blob, stopped, and entered finalization. The HQ same-origin proxy validated the browser upload token and reached the canonical private-media endpoint. The endpoint returned `401 Unauthorized`; bounded retries ended in the truthful `SAVE NEEDS RETRY`/error state, and the blob stayed in the live Chrome tab.

## Root cause boundary

The deployed application and the existing private-media architecture both sign `SHA-256(objectKey:expires:MMHQ_SESSION_SECRET)` for `https://cdn.missionmedinstitute.com`. The worker rejects that signed request. The repository contains no Cloudflare worker source or authorized worker configuration path, Wrangler is unavailable/unauthed, and no alternate production signing secret is configured in HQ. This is an external production CDN secret/config mismatch, not a browser recorder or IV Prep state-machine defect.

## Acceptance matrix

| Item | Result |
|---|---|
| Real media capture/blob | PASS |
| Pause/resume/stop controller contracts | PASS (automated) |
| Production stop/finalize | REACHED |
| Same-origin authenticated chunk contract | PASS to HQ boundary |
| Private R2/CDN write | BLOCKED: upstream `401` |
| Durable `saved` recording row | BLOCKED by media write |
| Playback after close/reopen | NOT TESTABLE until save succeeds |
| Download video | NOT TESTABLE until save succeeds |
| Interruption retry | UI/state PASS; production retry remains blocked by same `401` |

## Required external repair

Synchronize the CDN worker upload-signing secret/config with MissionMed HQ's current `MMHQ_SESSION_SECRET` without revealing the value, or provide the authorized Cloudflare deployment path. Then click retry in the retained production tab and run the full save/reopen/playback/download matrix.
