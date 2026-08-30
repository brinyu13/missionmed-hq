# 3528C Prefabricated Module Contract

## Mount

- Public authenticated UI route: `GET /iv-prep-analytics/`
- Real analytics assets: `GET /iv-prep-on-call/analytics/*`
- Server API prefix: `/api/ivoc/v1`
- Frontend root: `ivprep-v6/public/ivoc-standalone/`
- Server adapter: `missionmed-hq/ivoc/`
- Host mount: `missionmed-hq/server.mjs`

The master IV Prep app mounts this module; it must not copy or rebuild the analytics, recorder, Results, or Library internals.

## Host inputs

The canonical HQ session supplies subject, display name, roles, Matrix entitlement, cookie fingerprint, CSRF token, and origin. Session creation accepts `sessionType`, `questionId`, `questionText`, `title`, `interviewerProvider`, `recordingEnabled`, calibration snapshot, and context. `interviewerProvider` defaults to `missionmed-static` and remains the provider slot.

## API surface

| Contract | Purpose |
|---|---|
| `GET /bootstrap` | Identity, entitlement, CSRF, preferences |
| `POST /sessions` | Canonical session/question/context/t=0 |
| `POST /sessions/:id/recordings` | Private recording intent and bounded upload capability |
| `PUT /recordings/:id/media` | Same-origin authenticated media upload; server performs private R2 multipart operations |
| `POST /recordings/:id/seal` | Complete multipart upload, verify object, seal metadata |
| `POST /sessions/:id/results` | Versioned `ivoc.analytics.v1` Results |
| `GET /library?scope=own|assigned|all` | Student/Mentor/Admin authorized collection |
| `GET /sessions/:id` | Authorized detail/Results/recording projection |
| `GET /recordings/:id/playback-url` | Expiring same-origin inline/download URL |
| `GET /recordings/:id/playback` | Authenticated token-scoped private R2 proxy with range support |
| `GET/PUT /preferences` | Calibration, visibility, coaching, recording defaults |
| `POST /sessions/:id/review` | Authorized mentor/admin review state |

## Events and timeline

The analytics adapter emits frame, pipeline-state, and word-timing-state events. Results persist scores, counters, observable events, and normalized Volume/Pitch/Pace history with the shared session time basis. Recording metadata preserves duration and pause spans; event clicks may seek authorized playback to the event timestamp.

## Data and storage

- Migration: `supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql`
- Results schema: `ivoc.analytics.v1`
- Private media key form (server only): `ivoc/recordings/{safe-owner}/ivoc_{uuid}.webm`
- Existing private bucket: `missionmed-cam-production`
- Browser upload and replay: same-origin HQ only
- R2 S3 SigV4 credentials, multipart upload id, and raw object key remain server-side
- No additional schema migration was needed for the repair; upload state uses the existing recording metadata boundary and final ETag.

## Navigation and recovery

SETUP may show app navigation. READY through PROCESSING use the full-room shell. RESULTS restores navigation. Setup draft and safe UI preferences persist locally/account-side; the recorder keeps a failed final blob in-tab for explicit retry. The host warns before abandoning an active or unsaved room.

## Integration status

The prefab is live and its production save/library/replay vertical slice has passed. Full human analytics response and separate-persona acceptance remain external QA gates, not module integration defects.
