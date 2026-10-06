# Production architecture and capability ownership

All paths below relative to the Foreman repo unless absolute. Owner means code/runtime authority, not permission to mutate.

Matrix/WP identity → HQ signed session/admission → ivprep-v6/server/hq-mount.mjs → public/studio-fable/index.html and app/main.mjs → Fable adapters → existing production capabilities → HQ/provider endpoints → Supabase canonical rows + R2 private media → saved-review/Results/Film Room/history.

HQ server is missionmed-hq/server.mjs; business/permission endpoints missionmed-hq/ivoc/routes.mjs under /api/ivoc/v1/. Mount maps BOTH normal product and /candidate to studio-fable. Public/studio is reused engine/adapter code, not the current shell. Never develop against file:// or7002 harness as live proof.

| Subsystem / owner | Source files | Contract / status / risk |
|---|---|---|
| Student shell / IVOC presentation | public/studio-fable/app/main.mjs, state.mjs, room.mjs, results.mjs | Normal goals/state routing; live. DOM owns display, not canonical provider/data logic. |
| Library / IVOC curriculum | public/studio-fable/app/questions.mjs, questions/selector.mjs; public/questions/question-store.mjs |193canonical IDs, selected tray/order/filter. Preserve identities; fixtures not real attempts. |
| Session / IVOC | studio-fable/app/controller/session-controller.mjs; public/studio/durable-session.mjs | One admitted canonical subject/session, save/abandon/teardown. No second controller by route. |
| Media / IVOC engine | studio-fable/app/adapters/engine-adapter.mjs, media-readiness.mjs, device-controls.mjs; public/studio/media-analytics-capability.mjs | Exact stream/video binding, actual pixel/frame gate. Room rerender must not stop/recreate unrelated stream. |
| Face/head/body/hands / Analytics | public/ivoc-standalone/app/real-runtime.mjs; public/live-analytics/behavior-intelligence-runtime.mjs, media-bridge.mjs; public/analytics/face-detector-worker.mjs, face-family.mjs, nod-detector.mjs, smile-pattern.mjs | Bounded local detector frames, subject lock, quality/unavailable states. Primary ambiguity withholds person-specific measures. |
| Voice / Analytics | public/analytics/audio-signal.mjs, pitch-f0.mjs, audio-worklet-capture.mjs; public/live-analytics/live-metric-projector.mjs, local-transcript-timing.mjs, baseline-store.mjs | PCM/voicing/timed words plus personal baseline. No semantic/psychological inference. |
| Pace/Volume/Pitch/Variety / presentation projection | studio-fable/app/instruments/rails.mjs, model/trace-reducer.mjs; real-runtime.mjs | Consume real frames + calibration; nullable measures. Four designs protected. Pitch new rolling fix needs physical proof. |
| Recorder lanes / IVOC evidence view | studio-fable/app/instruments/flight-recorder.mjs, model/trace-reducer.mjs, model/teaching.mjs | Shared capture clock, explicit gaps and semantic marks. Live compact / Film Room expanded seek. |
| GPT-Live / native conversation | public/capabilities/live-interview.mjs; server/providers/openai-live-session.mjs | Mic→WebRTC→native remote audio/transcript. Server-bounded config/limits, one audio authority, cancel/teardown. |
| Context / IVOC consumer | server/providers/ivoc-context-pack-resolver.mjs; public/studio/live-context-adapter.mjs; studio-fable/app/adapters/context-adapter.mjs; missionmed-hq/ivoc/context-provider.mjs, application-intelligence.mjs; ivoc/intelligence/index.mjs | Authorized versioned owner projections → bounded private Context Pack. Donor0867deb already incorporated. |
| Hooks / IVOC guidance | studio-fable/app/brain/hook-detector.mjs, conductor.mjs, native-observer.mjs; model/native-observation-marks.mjs | Observational hook candidates, quiet native hint; NOT a second GPT brain. Fragments not completed/audible turns. |
| Closing / IVOC curriculum | public/capabilities/interview-progression.mjs, interview-policy.mjs, interviewer-preferences.mjs | Mandatory invitation, candidate questions/sign-off; explicit qualified observed versus heard evidence. |
| Embodiment / visual Actor | public/capabilities/embodiment-renderer.mjs, embodiment-pcm-worklet.mjs; server/providers/lemonslice-embodiment.mjs; HQ routes.mjs | Founder-only one reservation, secure WSS→LiveKit→decoded frame; currently OFF, actual repaired connection unproven. |
| Recording / IVOC media | public/capabilities/conversation-recording.mjs, stable-camera-recording.mjs | Candidate mic + authoritative heard interviewer tap silently mixed; one user output. Interruption gates recording with heard output. |
| Transcript / canonical native session | public/studio/live-transcript-review.mjs; missionmed-hq/ivoc/live-transcript-review.mjs; server provider above | Canonical event/turn identities/time; partial fragments withheld from completed-turn proof. |
| Save/data / IVOC server | public/aaa/api-client.mjs; missionmed-hq/ivoc/repository.mjs, storage.mjs, candidate-audio.mjs | Subject-bound admit/upload/commit/results/reload. Upload ticket or row ≠ playable saved recording. |
| Review / IVOC | studio-fable/app/results.mjs; adapters/saved-review.mjs, derived-evidence.mjs, interviewer-review.mjs, replay-overlays.mjs | Persisted evidence only; legacy last-readout is not timeline coverage. |
| Retry/Compare/Progress / IVOC | adapters/retry.mjs, comparison-view-model.mjs, history-view-model.mjs; public/studio/longitudinal-model.mjs | Same question/compatible versions/owner only; observed closing remains qualified, no invented audibility/improvement. |
| RISE / owner→IVOC consumer | missionmed-hq/ivoc/rise-projection.mjs; lib/auth/rise-current-eligibility.mjs; context-adapter.mjs | Authorized actual search/exact program and minimized fresh intelligence; no owner cloning. |
| File Vault / owner→IVOC consumer | missionmed-hq/ivoc/file-vault-projection.mjs; ivoc/intelligence/normalize/normalizers/filevault-document.mjs | Current reviewed CV version/facts/consent. Positive genuine data still needed. |
| StoryForge / owner→IVOC consumer | missionmed-hq/ivoc/storyforge-projection.mjs; ivoc/intelligence/normalize/normalizers/storyforge-stories.mjs | Approved/promoted + consented versions, invalidation. Private raw stories never copied into public UI. |
| Admin review / HQ permissions | public/capabilities/admin-student-library.mjs; adapters/account-adapter.mjs, own-scope.mjs; routes.mjs | Actor permissions separate selected subject; stale selection/media cleared. Genuine negative matrix remains open. |
| Live Mock/Webex/Calendar / owner projection | public/capabilities/live-mock-studio.mjs, calendar-context.mjs; adapters/calendar-view-model.mjs | Supervised owner workflow, not fake completed media. Event-dependent final evidence. |

Path prefix public above means ivprep-v6/public; server means ivprep-v6/server; studio-fable entries under that public prefix. Full normalized critical paths are in MANIFEST.json.

## Persistence

Supabase authority: sessions, recordings, results, reviews, preferences, access_log; session_contracts, timeline_events, conversation_turns, answer_segments, coaching_evidence; question_catalog, context_packs, mentor_priority_sets, admin_config_versions, credit_accounts, credit_events, answer_asset_versions (all ivoc_ prefixed). Live transcript events include server-only ivoc_live_transcript_events. Browser has no privileged table grant; service RPCs scoped/allowlisted. Do not make browser-side presentation an RLS substitute.

Private R2 default bucket missionmed-cam-production; server-owned key shape ivoc/recordings/<safe ownerSubject>/ivoc_<recordingId>.webm. Signed bounded upload/playback, ownership checked before issuance; no public bucket/signed URL in docs. Recordings/results/transcripts/evidence preserve session/subject/version/program identities. Use repository API, not presentation SQL.

## Configuration names only

Server-only: IVPREP_SUPABASE_URL, IVPREP_SUPABASE_SERVICE_ROLE_KEY; MMHQ_R2_ENDPOINT, MMHQ_R2_ACCOUNT_ID, MMHQ_R2_ACCESS_KEY_ID, MMHQ_R2_SECRET_ACCESS_KEY, MMHQ_R2_BUCKET, MMHQ_R2_IVOC_PREFIX; MMHQ_SESSION_SECRET, MMHQ_SESSION_COOKIE, MMHQ_WP_BASE, MMHQ_RISE_BASE; IVPREP_ENABLED, IVPREP_ADMIN_CANARY_ENABLED; IVOC_CONTEXT_CANDIDATE_ENABLED, IVOC_CONTEXT_TRANSCRIPT_ENABLED, IVOC_REQUIRE_MEDIA_HEAD; MMHQ_OPENAI_API_KEY or OPENAI_API_KEY, IVOC_TRANSCRIPTION_MODEL, IVOC_CONTEXT_MODEL; LEMONSLICE_API_KEY, LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET; IVOC_LEMONSLICE_CANARY_ENABLED, IVOC_LEMONSLICE_CANARY_SESSION_ID, IVOC_LEMONSLICE_CANARY_BUDGET_USD.

Values, tokens and full environment dumps must never enter handoffs. Browser consumes sanitized bootstrap/capability state/CSRF, not these credentials. Railway contains server activation; provider switch is OFF and cannot be armed by this package.
