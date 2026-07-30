# B1-507A Voice Architecture

Date: 2026-07-29

## Architecture summary

The browser records private audio segments, stores a short-lived local copy in IndexedDB, uploads each segment through the authenticated StoryForge API to private R2 temporary storage, and requests transcription through a replaceable provider adapter. The transcript is merged into the normal story editor. On finish, a selected server-side assembly executor creates or verifies the permanent audio asset, attaches it transactionally to the saved story, and removes temporary objects only after verification. Replay uses authorized, short-lived signed URLs. Cleanup, sweeps, and weekly reconciliation handle abandoned and orphaned objects.

This architecture is substantially implemented and fake-boundary tested locally. It is not configured or live in production.

## Browser capture

| Property | Current design/state |
|---|---|
| API | Native `navigator.mediaDevices.getUserMedia` and `MediaRecorder` |
| MIME preference | `audio/webm;codecs=opus`, then `audio/mp4`, `audio/webm`, `audio/ogg` as supported |
| Duration | 20-minute maximum |
| Total upload bound | 50 MB |
| Segmentation | Initial 4-second segment target, then approximately 15-second segments |
| Local durability | IndexedDB buffer with seven-day expiry when the voice database is opened |
| States | permission, ready, recording, paused, finishing, recovery, error |
| Controls | record, pause, resume, stop, cancel/retry |
| Interruptions | track mute/ended and recovery paths are implemented; physical-device behavior remains unverified |
| Tested | Fake-browser E2E and unit coverage |
| Production | Hidden/disabled because `audioAvailable` is false |

## Upload and temporary storage

- Client protocol: authenticated `multipart/form-data` with an audio `Blob`.
- Server endpoint: Phase 1 segment-upload endpoint in `server/app.mjs`; request size and content type are bounded.
- Temporary key model: `storyforge-rec/{student_uuid}/{recording_uuid}/seg-{sequence}.{extension}`.
- Private storage only; no public bucket or public ACL.
- Sequence/idempotency data is database-backed. Duplicate or stale submissions fail safely or return the existing result.
- The browser retries recoverable uploads and preserves unsent local segments until success/cancel/expiry.
- Cancellation calls the recording-cancel path and retires session/objects through server-owned cleanup.
- Production gateway status: blocked. The current WordPress proxy rejects multipart requests with 415 because POST/PATCH are JSON-only.
- Production R2 status: no StoryForge bucket, scoped token, CORS, or lifecycle configuration exists.

## Transcription

| Element | Exact state |
|---|---|
| Adapter | `storyforge-v5/server/transcription/adapter.mjs` |
| Primary | `gpt-4o-transcribe` |
| Fallback | `whisper-1` |
| Provider endpoint | `/v1/audio/transcriptions` |
| Runtime provider modes | `none` or `openai` |
| Production mode | Effectively `none`; no StoryForge provider variables/key are configured |
| Polling | Ordered transcript checks about every two seconds |
| Persistence | Segment transcript plus provenance in Phase 1 tables; merged text enters the normal editable draft/story field |
| Student edits | Preserved; transcript merge is ordered and must not overwrite later student changes |
| Timeout/retry | Driver applies a 30-second request timeout; the orchestration layer performs bounded retry/fallback and exposes truthful failure states |
| Real-service evidence | None for StoryForge |

Provider/model names are infrastructure and must not appear in ordinary student-facing language.

## Assembly

Both authorized candidates exist in `storyforge-v5/server/assembly/executors.mjs`:

- **Option A:** server-side media assembly into one permanent object.
- **Option B:** manifest/segment-preserving permanent layout.

Both have local tests. Runtime startup deliberately injects an authority-blocked unavailable executor, so neither candidate can run in production. RP-8 must compare the candidates under an authorized Nixpacks-equivalent runtime, select one, and authorize the small wiring change. Current authority does not yet name a non-Docker equivalent, although no architecture principle requires Docker itself.

The intended assembly owner is the Railway backend. Startup recovery can resume transcription, pending assemblies, and pending permanent assets. With assembly unavailable, finish fails closed instead of fabricating audio success.

## Permanent attachment and replay

- Permanent key stem: `storyforge-audio/{student_uuid}/{story_uuid}/{audio_asset_uuid}` with the selected layout’s suffix/children.
- Finalization copies or creates the permanent object, performs existence/size/checksum verification as applicable, executes the database attachment transaction, verifies the database result, and only then removes temporary objects.
- The database preserves immutable story originals/revisions and audio-asset lifecycle/audit records.
- Replay endpoint authorizes ownership/role access and returns short-lived signed private-object URLs.
- The client can replay ordered segments and refresh expired URLs.
- Product conformance gap: the current client disables its button while playing and does not implement the canonical player’s usable pause toggle, progress, and elapsed/total time. Backend replay exists; the approved replay experience is incomplete.

## Deletion and reconciliation

- Explicit server-side audio deletion exists and is authorization/RLS/audit guarded.
- The client defines the DELETE request, but no Founder-approved visible delete-audio control is present. FG-1 controls whether/where it must appear.
- The WordPress gateway rejects DELETE with 405.
- Cleanup and reconciliation modes are `off`, `dry_run`, and `on`; production is off.
- Weekly reconciliation, 168-hour eligibility, suspension, bounded pages/deletes, retry, and audit logic are implemented against fake storage.
- FABLE-C1 through C4 and PROBE-C5 remain unresolved before automatic deletion can be activated.

## Authorization and audit

- JWT bootstrap is owned by the WordPress SSO plugin; API authorization remains server-side.
- PostgreSQL RLS protects sessions, segments, stories, audio assets, feature flags, and audit paths.
- Private means direct-ID access is denied as well as list omission.
- Storage keys are derived server-side; clients never receive storage credentials.
- Playback is private and signed; deletion is server-owned.
- Append-only events cover recording, transcription, assembly, attachment, replay URL issuance, cancellation, deletion, sweeps, and reconciliation outcomes.

## Status legend by boundary

| Boundary | Implemented | Local tests | Real service | Production configured | Live |
|---|---:|---:|---:|---:|---:|
| Browser UI/capture | Yes | Yes, simulated | No physical-device matrix | No | No |
| Segment upload API | Yes | Yes, API-direct | No R2/WP E2E | No | No |
| Provider adapter | Yes | Yes, fake driver | No | No (`none`) | No |
| Assembly A/B | Yes | Yes | No RP-8 equivalent | No selection | No |
| Permanent attachment | Yes | Yes, fake storage/PG | No R2 | No | No |
| Replay backend | Yes | Yes | No R2 | No | No |
| Replay canonical UX | Partial | Ordered playback only | No | No | No |
| Cleanup/sweeps | Yes | Yes | No R2 | No | No |
| Reconciliation | Yes, unresolved edges | Yes, fake storage | No | `off` | No |

## Rollback behavior

Each rollout rung must independently return to:

- database voice flag off;
- `STORYFORGE_VOICE_FORCE_OFF=true`;
- `STORYFORGE_TRANSCRIBE_PROVIDER=none`;
- `STORYFORGE_AUDIO_RECONCILIATION=off`;
- previous Railway deployment;
- previous Kinsta immutable release pointer;
- retained additive schema unless a separately authorized data-safe reversal exists.

Rollback must never delete student text or pretend that an unfinished audio asset succeeded.
