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

The canonical HQ session supplies subject, display name, roles, Matrix entitlement, cookie fingerprint, CSRF token, and origin. Session creation accepts `sessionType`, `questionId`, `questionText`, `title`, `interviewerProvider`, `recordingEnabled`, calibration snapshot, and context. `interviewerProvider` defaults to `missionmed-static` and is the stable future provider slot.

## API surface

| Contract | Purpose |
|---|---|
| `GET /bootstrap` | Identity, entitlement, CSRF, preferences |
| `POST /sessions` | Canonical session/question/context/t=0 |
| `POST /sessions/:id/recordings` | Private recording intent and bounded upload capability |
| `PUT /recordings/:id/media` | Same-origin authenticated ranged chunk proxy |
| `POST /recordings/:id/seal` | Validate/seal metadata and storage object |
| `POST /sessions/:id/results` | Versioned `ivoc.analytics.v1` Results |
| `GET /library?scope=own|assigned|all` | Student/Mentor/Admin authorized collection |
| `GET /sessions/:id` | Authorized detail/Results/recording projection |
| `GET /recordings/:id/playback-url` | Expiring inline/download media URL |
| `GET/PUT /preferences` | Calibration, visibility, coaching, recording defaults |
| `POST /sessions/:id/review` | Authorized mentor/admin review state |

## Events and timeline

The real analytics adapter emits frame, pipeline-state, and word-timing-state events. Results persist scores, counters, observable events, and normalized Volume/Pitch/Pace history with the shared session time basis. Recording metadata preserves duration and pause spans; event clicks may seek the authorized playback element to the event timestamp.

## Data and storage

- Migration: `supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql`
- Results schema: `ivoc.analytics.v1`
- Private media key form (server only): `dboc-iv/{safe-owner}/ivoc_{uuid}.webm`
- Browser upload: same-origin HQ; CDN/R2 signature stays server-side.

## Navigation and recovery

SETUP may show app navigation. READY through PROCESSING use the full-room shell. RESULTS restores navigation. Setup draft and safe UI preferences persist locally/account-side; the recorder keeps a failed final blob in-tab for explicit retry. The host must warn before abandoning an active or unsaved room.

## Known integration condition

The module is prefab-ready at code/contract level, but production media completion requires the CDN worker and HQ to share the same current signing configuration.
