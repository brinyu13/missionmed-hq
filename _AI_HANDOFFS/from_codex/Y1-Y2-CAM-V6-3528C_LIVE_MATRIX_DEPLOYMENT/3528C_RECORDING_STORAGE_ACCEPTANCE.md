# 3528C Recording and Storage Acceptance

## Production architecture

- One `MediaRecorder` consumes the same real camera/microphone stream and session time basis as analytics.
- The browser uploads bounded parts to authenticated same-origin MissionMed HQ routes.
- MissionMed HQ performs the existing private Cloudflare R2 multipart transaction using S3 SigV4.
- Bucket: `missionmed-cam-production`; prefix: `ivoc/recordings`.
- The browser receives an opaque, expiring HMAC upload token; it never receives R2 credentials, multipart upload id, or the raw private object key.
- Seal completes multipart upload and performs an R2 `HEAD` verification before the recording is marked saved.
- Playback is an authenticated same-origin expiring proxy with byte-range support. The private R2 bucket remains non-public.
- No new provider, paid session, credential, or database migration was created.

## Repair evidence

The previous custom CDN signed-query seam returned `401`. It was replaced within the bounded four-file server/test tranche by the already-provisioned private R2 S3 interface.

| Gate | Result |
|---|---|
| Local R2 initiate/upload/complete/HEAD/read round trip | PASS |
| Focused server storage/routes suite | `11/11 PASS` |
| Real production recording 1 | PASS — two media parts, seal `200`, Results `200` |
| Real production recording 2 | PASS — six media parts, seal `200`, Results `200` |
| Durable saved recording rows | PASS |
| Library list after save | PASS |
| Reopen/playback URL | PASS |
| Same-origin playback bytes | PASS — `206 video/webm` |
| Browser exposure of private key/credentials | DENIED/PASS |
| Production error-log matches after deploy | `0` |
| Production HTTP 5xx in observed 15-minute window | `0` |

## Source and deployment

- Repair commit: `a9a3e41e771e95c346cb74ee40468e1c1177348c`
- Files: `missionmed-hq/ivoc/routes.mjs`, `missionmed-hq/ivoc/storage.mjs`, and their two focused tests
- Deployment: `33ed7dcd-41cb-410d-a309-29e3d019065c` (`SUCCESS`)
- Image: `sha256:8fb93c570ed5fef6c98115851466be2cf86ae7981000bc1b40d9a4f5d62159d6`

## Truth boundary

Record/pause/resume behavioral contracts pass automated tests. The two production sessions exercised real capture, stop, multipart finalization, persistence, Library, and replay. Timestamp seek and explicit download-button UX were not separately physically exercised.
