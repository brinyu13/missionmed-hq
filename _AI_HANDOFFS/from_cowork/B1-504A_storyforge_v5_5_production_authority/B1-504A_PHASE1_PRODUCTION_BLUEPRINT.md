# B1-504A · Phase 1 Production Blueprint

Voice capture and transcription, live for the verified 360 beta cohort, without disturbing the running product.

Labels: [VERIFIED] checked this run · [AUTHORITY] V5.5 prototype behavior · [RECOMMENDED] architecture decision · [CODEX] Codex discovery/implementation · [GATE] founder approval.

## 1. What exists, scored on the five-level readiness ladder

Code presence is not production readiness. Every existing capability below is scored on the ladder defined in the Authority Lock: L1 present in source, L2 in the currently deployed runtime, L3 enabled by production configuration, L4 reachable by the authorized population, L5 verified end-to-end in production. Levels are never inferred downward from source inspection.

| Capability | L1 source | L2 deployed runtime | L3 prod config | L4 reachable | L5 verified e2e | Status |
|---|---|---|---|---|---|---|
| R2 storage seam (`server/storage.mjs`: presign PUT, Head verify, signed GET) | YES [VERIFIED this run] | PROBABLE, unproven: B1-503 deployed from source commit `36e823da`; exact runtime inclusion must be re-proven against live hashes [CODEX V-1] | NO, per B1-503 receipt: audio "reports unavailable unless its real chain" is configured; `STORYFORGE_R2_*` state unknown [CODEX V-2] | NO | NO | Candidate infrastructure to preserve or repair |
| Audio endpoints (`/api/audio/presign`, `:id/confirm`, `:id/playback`) | YES [VERIFIED] | PROBABLE, unproven [CODEX V-1] | Gated off by `isAudioConfigured()` returning false when R2 env absent | NO | NO | Candidate infrastructure |
| `sf_audio_assets` table + state machine + RLS | YES in migrations [VERIFIED] | YES as schema: B1-503 receipt records five migration rows applied and 25 RLS tables in the final database | n/a (schema) | n/a | NO end-to-end use: final database recorded zero stories | Schema exists; behavior unproven in production |
| Frontend voice-note capture (single-shot MediaRecorder, presign upload) | YES [VERIFIED] | PROBABLE, unproven [CODEX V-1] | Renders "Voice capture is not configured on this environment" when `/api/config.audioAvailable` is false | NO | NO | Candidate infrastructure |
| Durable drafts (`/api/drafts/story-builder`, `sf_story_drafts`) | YES [VERIFIED] | YES: B1-503 authenticated production validation exercised Quick Capture surfaces PASS | YES (no extra config) | YES for the current pilot | PARTIAL: validated within B1-503's scope, not under Phase 1 load patterns | Usable; re-verify under Phase 1 flows |
| Story domain, auth, RLS, audit | YES [VERIFIED] | YES per B1-503 gates (44 unit, PostgreSQL authorization suite, 16 e2e, 72 canonical comparisons, authenticated production validation) | YES | YES for the pilot | YES within B1-503 scope | Production baseline |
| Transcription (any) | NO: absent from StoryForge entirely [VERIFIED by search] | NO | NO | NO | NO | Must be built |

Reconciliation with B1-503, explicit: there is no contradiction between B1-503 reporting audio as a truthful gated-off state and this run finding complete audio code in source. The B1-503 release intentionally ships the audio chain dormant: `isAudioConfigured()` returns false without the full `STORYFORGE_R2_*` set, `/api/config` then reports `audioAvailable: false`, and the frontend renders the truthful "not configured" message. Dormant-by-configuration is the designed state, and it is also why none of L3, L4, or L5 can be claimed today. Consequence for Phase 1: the existing recording and upload code path must pass its own full end-to-end verification (real recording, upload, authorization, playback, deletion, and failure testing, per the Acceptance doc) before any Phase 1 work builds on it; where verification finds defects, Codex repairs the candidate infrastructure rather than assuming it.

Mandatory runtime verifications [CODEX]:
V-1 Prove the currently deployed Railway runtime and Kinsta release match the expected B1-503 identities (and B1-505 identities once its completed authority exists), and that the audio code paths in the deployed runtime match worktree source, before modifying anything.
V-2 Capture the actual production Railway variable state for `STORYFORGE_R2_*` and record it in evidence (values redacted, presence/absence only).

Source inspection detail, all [VERIFIED at L1] in `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5/` this run:

- App shape: Node >= 20 ESM service (`server/app.mjs`, 2068 lines; `auth.mjs`, `config.mjs`, `db.mjs` on `pg`, `storage.mjs`, `imports.mjs`), static frontend (`public/app.js`, 4369 lines; `index.html`; `styles.css`), Railway API-only origin (`railway.json`, healthcheck `/healthz`, build `npm run build:api`), Kinsta immutable static releases with pointer install/rollback scripts (`scripts/install-b1-503-kinsta-release.sh`, `scripts/rollback-b1-503-kinsta-release.sh`), guarded migration runner (`scripts/apply-production-migrations.sh`), WordPress SSO plugin (`wp-content/plugins/missionmed-storyforge-sso/`), Cloudflare edge worker (`infra/edge/`).
- R2 audio seam, complete in code: `server/storage.mjs` uses `@aws-sdk/client-s3` + presigner against `config.r2.*` (`STORYFORGE_R2_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY`, signed-URL TTL default 300 s, bounds 60 to 900). Allowed types `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`; 1 byte to 50 MB; object keys `storyforge-audio/{studentUuid}/{storyUuid}/{randomUuid}.{ext}` (opaque UUIDs only); presigned PUT, HeadObject verification of exact type and size, presigned GET playback. `isAudioConfigured()` gates the whole chain and `/api/config` exposes `audioAvailable`.
- Audio endpoints: `POST /api/audio/presign`, `POST /api/audio/:id/confirm`, `GET /api/audio/:id/playback`, backed by SQL functions `sf_begin_audio_asset` and `sf_confirm_audio_asset` and table `sf_audio_assets` (state machine pending, uploaded, verified, failed, retired; checksum column; RLS enabled; read policy scoped through story ownership).
- Story domain: `sf_stories` (row_version optimistic concurrency, `capture_type` in text, audio, imported), immutable `sf_story_originals` (`original_transcript`, `audio_asset_id`, `capture_type`), append-only `sf_audit_events` (update/delete blocked by trigger), durable drafts (`/api/drafts/story-builder` GET/PATCH, `sf_story_drafts`, `sf_save_story_draft(jsonb, bigint)` with version).
- Frontend voice note today: single-shot MediaRecorder (no timeslice, no pause), mimeType picked via `isTypeSupported` from webm, mp4, ogg; record, stop, save story (`captureType: 'audio'`), presign, direct PUT to R2, confirm with durationMs; save blocked while recording; durable draft autosave with row_version; explicit truthful copy: "Nothing is transcribed or claimed complete until the server confirms it."
- Access policy: WordPress option `missionmed_storyforge_settings` (`storyforge_enabled`, `allowed_user_ids`, `app_role_overrides`, `allowed_roles`, `allowed_cohorts`, token TTL, rate limits); cohort from user meta `_missionmed_storyforge_cohort` with `_mmed_cohort` fallback; JWT exchange at `/wp-json/missionmed/v1/storyforge/token`; JOSE verification in `auth.mjs`.
What does NOT exist anywhere in StoryForge [VERIFIED by search]: transcription. No transcription endpoint, table, provider call, or client code. The word appears only in UI copy and in the migrated `original_transcript` column name.

The incumbent MissionMed pipeline [VERIFIED]: `MissionMed/missionmed-hq/server.mjs`, function `transcribeDbocAudio()`: OpenAI `POST https://api.openai.com/v1/audio/transcriptions`, `model: 'whisper-1'`, multipart upload of a complete audio file, 30 s abort timeout, mock transcript fallback when `OPENAI_API_KEY`/`MMHQ_OPENAI_API_KEY` is absent, safe-mode mock on error, batch only, no prompt, no keywords, no interim results. This proves a production OpenAI API account and a working transcription pattern, and equally proves the incumbent cannot deliver V5.5's live-ish experience or medical-term boosting as-is (full analysis in the Bake-off doc).

## 2. Architecture summary [RECOMMENDED]

The simplest architecture that satisfies all nine core requirements is an extension of the existing StoryForge service, not a new service:

1. Frontend: the V5.5 capture interaction, implemented in `public/app.js` in the existing capture sheet, gated by a server-granted `voiceCapture` capability.
2. Recording transport: segment-scoped MediaRecorder. The client records short standalone segments (default 15 s, plus a boundary at every pause and at stop) and POSTs each finished segment to the StoryForge API immediately. Segments are durable on the server the moment they arrive.
3. Transcription: the StoryForge API relays each segment to the MissionMed transcription adapter (new module `server/transcription/`), provider-selected by configuration. Recommended primary provider: OpenAI `gpt-transcribe` with `keywords` for medical vocabulary (Bake-off doc). Incumbent `whisper-1` is the configured fallback.
4. Near-live text: the client polls the recording session every 2 s and merges newly finalized segment text into the textarea using the prototype's overlap-merge behavior. The ghost line shows "still transcribing" state truthfully.
5. Final audio: on finish, the server assembles the ordered segments into one playback asset registered through the existing `sf_audio_assets` chain, so playback, RLS, and the story workspace audio card all work unchanged.
6. Flags: a server-enforced voice feature scope (off, founder, allowlist, cohort) stored in the database, changeable instantly without deploy, with an env kill switch as a second, independent off-path.
7. Phase 2: nothing deployed. The plug-in boundary is a contract (Section 10).

Why segments instead of a realtime WebSocket audio pipe [RECOMMENDED, with evidence]: MediaRecorder timeslice chunks after the first are not standalone decodable files (container headers live in chunk 1; W3C mediacapture-record issue 130), so chunk-level batch transcription requires either server-side remux of partial containers or a raw-PCM AudioWorklet pipeline. Both are heavier than Phase 1 needs. Segment-scoped recorders produce complete, independently decodable files on every browser in scope, survive interruption by construction (every segment already uploaded is safe), give truthful near-live latency of roughly segment length plus provider turnaround, and leave a clean upgrade path: the adapter's interim/final contract is transport-agnostic, so a later Realtime WebSocket provider (OpenAI `gpt-live-transcribe`, PCM over WS) slots in behind the same adapter without any product change. This matches the founder's "as near to real time as is technically responsible" and avoids overstating capability.

Honest latency envelope [RECOMMENDED, to be measured in the bake-off]: first visible transcript text within roughly 5 to 10 s of speech start (first segment boundary at 4 s for the opening segment, then provider turnaround); steady-state new text every few seconds; final stable transcript within a few seconds of stop. The UI language for this state is "Transcribing…" with the ghost line, exactly as the prototype's review-state semantics; the words "live transcription" may only be shown if measured latency meets the acceptance thresholds in the Acceptance doc.

## 3. Recording session flow (end to end)

State machine (server-side, per session): `recording` → `finishing` → `assembled` → `attached` (or `cancelled` / `failed`). Segments: `received` → `transcribing` → `transcribed` (or `transcribe_failed`, retryable).

1. Student taps the hero mic or the dock's Speak control [AUTHORITY]. Client checks `/api/session` capability `voiceCapture` (Contracts doc). Client calls `POST /api/recordings` to open a session; server verifies eligibility again and returns `recordingId` plus the normative segment plan `segmentPlanMs: [4000, 15000]` (first segment closes at 4 s so first text appears fast; steady-state segments 15 s thereafter). This plan is binding for the latency thresholds.
2. Client requests the microphone (arming state [AUTHORITY]). Permission denial renders the truthful unable-to-continue state; typing remains available [AUTHORITY].
3. Client starts segment recorder 1 with the best supported mimeType (`isTypeSupported` order: `audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`, `audio/ogg`; record the chosen type per segment). Browser format matrix and interruption semantics: Contracts doc Section 7, from current MDN/WebKit evidence.
4. At each segment-plan boundary (4 s for the opening segment, every 15 s thereafter), on pause, and on stop, the active segment recorder stops, its blob POSTs to `POST /api/recordings/:id/segments` (multipart, with `seq`, `mimeType`, client duration), and (unless stopping or paused) the next segment recorder starts in the same tick. Gaps between segments are typically under 200 ms; the bake-off measures word loss at boundaries and the acceptance test bounds it.
5. Server stores each segment durably (R2 under the recordings prefix, Storage doc) and enqueues transcription through the adapter with `keywords` (medical lexicon + terms from the student's own draft title) and `prompt` set to the tail of the previous segment's transcript for context continuity.
6. Client polls `GET /api/recordings/:id` every 2 s; newly `transcribed` segments merge into the textarea via overlap-merge [AUTHORITY]; the ghost line shows the in-flight tail state. Client autosaves the durable draft (existing `/api/drafts/story-builder`) on every merge, so the transcript text itself is server-durable within seconds.
7. Pause [AUTHORITY]: current segment closes and uploads; no new segment starts; timer halts; the dock shows paused. Auto-pause fires on `visibilitychange: hidden` and on track `mute`/`ended` (mobile app switch, screen lock, incoming call), with the prototype's explanatory note. A Screen Wake Lock is requested during recording and re-acquired on visibility return (supported iOS 16.4+/Android Chrome; evidence in Contracts doc).
8. Stop [AUTHORITY]: final segment uploads; client calls `POST /api/recordings/:id/finish`; server assembles the playback asset (Section 4), computes total duration, and returns final state. Client renders review: transcript editable, transcript check chips (Section 6), Record more (opens a new session linked to the same draft), Discard (Section 5).
9. Save [AUTHORITY]: existing `POST /api/stories` with `captureType: 'audio'` plus `recordingId`; the server verifies that the CALLER OWNS the referenced recording session, that its state is finishing or assembled, and that it is not already attached (any violation: 403, audited; this explicit check is mandatory because attach may run through SECURITY DEFINER paths that bypass RLS); it then attaches the assembled asset and the reviewed transcript to the story atomically, writes `sf_story_originals`, consumes the draft, audits. The story is a normal private StoryForge story.

## 4. Final-audio assembly [RECOMMENDED + CODEX]

Requirement: one playable "original audio" per story through the existing signed-playback card. Segments are separate container files, so simple byte concatenation is invalid.

Codex implements one of two approved options, in order of preference, and proves the choice with evidence:

- Option A (preferred): server-side assembly with ffmpeg (concat demuxer, stream copy for same-codec segments, re-encode fallback) producing a single m4a or webm object registered through `sf_begin_audio_asset`/`sf_confirm_audio_asset`. [CODEX] verify ffmpeg availability on the Railway Nixpacks build or add it explicitly; measure assembly time for a 10-minute recording; assembly runs async after finish and must not block the review UI (transcript is already present).
- Option B (fallback, no ffmpeg): retain ordered segment objects and register a manifest-backed asset; the player plays segments sequentially with preloading. Schema support for the manifest is in the Contracts doc. Product acceptance is identical: the audio card plays the full take from start to finish with one control.

Either way: 50 MB total cap and a 20-minute recording duration cap for Phase 1 (client-enforced with a visible countdown after 18 minutes; server-enforced hard stop), consistent with the existing byte-size check constraint. [GATE-free: these are safety bounds, adjustable later.]

## 5. Discard, cancel, cleanup

- Discard recording [AUTHORITY]: client removes voice-inserted text (anchor semantics per prototype), calls `POST /api/recordings/:id/cancel`; server marks the session cancelled and hard-deletes its segment objects and any assembled object (Storage doc lifecycle). Typed text is never touched.
- Abandoned sessions (no finish, no cancel, no activity): swept after 24 h; segments deleted; session marked failed-abandoned; audit event recorded. [CODEX] implement sweep as a guarded periodic task in the existing service (no new infrastructure).
- Failed uploads: a segment POST that never lands is retried by the client (3 attempts, exponential backoff); on persistent failure the dock enters the truthful reconnecting state, keeps recording locally, and buffers up to 2 unsent segments; beyond that it auto-pauses with the honest message rather than silently losing audio [AUTHORITY: recovery ethos].

## 6. Transcript check (medical-term support) [AUTHORITY, production-truthful form]

The prototype's chips ("wipple" to Whipple) are simulated. Production renders chips only from real signals, in priority order:

1. Provider-reported low-confidence spans where the provider exposes them. [CODEX] verify during the bake-off whether the selected provider returns usable confidence or logprobs; whisper-1 exposes segment-level avg_logprob, gpt-transcribe exposure must be tested, not assumed.
2. MissionMed medical lexicon pass (server-side, deterministic): a curated list of high-value residency/clinical terms, medications, and procedures, matched against the transcript with fuzzy distance to catch common mis-hearings; each hit renders a chip "heard-form to lexicon-form, you decide". The lexicon lives in the repository, versioned, reviewable by the founder. Seed list: Bake-off doc Section 5 corpus vocabulary.
3. If neither source yields anything, no chips render. The transcript check row simply does not appear. Never invent uncertainty [AUTHORITY conformance law].

Student edits always win. Chips apply replacements only on tap. Nothing auto-corrects.

## 7. Interruption and recovery, production-truthful [AUTHORITY]

Layers, from most to least protective:

1. Uploaded segments are durable server-side the moment they land (survives device death mid-recording).
2. Transcript text merges into the server-side durable draft within seconds of each segment finalizing (survives browser and device loss; recovery works on a different device, which localStorage alone could never do).
3. localStorage supplement keeps the very latest unmerged ghost words on the same device (prototype behavior, retained).
4. On reload/reopen with an in-progress draft: capture reopens with the recovery banner, restored transcript, and duration [AUTHORITY]. If the session still has unassembled uploaded segments whose transcription completed after the interruption, their text appears too. Recovery must not restart the microphone by itself.
5. Feature disabled mid-recording (rollback while a student records): client stops recording gracefully, keeps all transcript text in the draft, shows the honest message that voice capture is currently unavailable, and leaves the student in the fully working typing flow. Already-saved stories, transcripts, and audio are never touched by rollback [AUTHORITY + Acceptance doc].

## 8. Feature activation [RECOMMENDED; exact contract in Contracts doc Section 5]

- Source of truth: `sf_feature_flags` row `voice_capture` with scope `off | founder | allowlist | cohort | eligible_all`, allowlist of user UUIDs, cohort list. Admin-only API mutates it; every change writes an audit event with actor and timestamp [AUTHORITY: stamped change log].
- Enforcement: every voice endpoint checks the scope server-side against the caller's identity and cohort claims. Frontend `/api/session` returns the computed `voiceCapture` capability for UI gating only.
- Emergency off: env `STORYFORGE_VOICE_FORCE_OFF=1` beats the database (Railway variable change; both paths are exercised in acceptance).
- Legacy audio endpoints are subordinated to the same regime [RECOMMENDED, mandatory]: setting `STORYFORGE_R2_*` in production necessarily flips `isAudioConfigured()` true, which would otherwise re-arm the pre-existing `/api/audio/presign` and `/api/audio/:id/confirm` voice-note chain for the whole pilot population outside any flag. Codex therefore binds those two legacy endpoints (and the legacy frontend voice-note affordance) to the `voice_capture` scope and the env kill exactly like E1 to E6. Playback (E9) AND audio deletion (E8) deliberately stay outside the voice flag, ownership- and policy-gated only, so saved audio keeps playing and "delete anytime" stays true across rollback and cohort revocation (Storage doc Sections 4 and 7); those carve-outs are explicit, not oversights. Acceptance rows A1 and A22 probe the legacy endpoints, and A15 additionally proves audio deletion succeeds with scope `off`.
- 360 cohort truth comes exclusively from B1-505's COMPLETED final authority, fresh-read by Codex at its own run time immediately before any access-control change (Authority Lock Section 2 item 5; partial files and moving worktree state do not qualify). The cohort scope references those cohort values, and a student who loses 360 eligibility simply stops matching the scope: existing stories, transcripts, and audio remain intact and playable per the retention policy.
- Founder-only validation = scope `founder` (the founder's WordPress user, per B1-503's exact-account binding).

## 9. Live-product continuity (build order) [RECOMMENDED]

1. Baseline lock: verify live release identities against B1-503 (and B1-505 once present) before any change.
2. Additive migrations only (Contracts doc Section 4): new tables and columns; nothing existing is altered destructively; deployed while the feature is entirely off.
3. Backend deploys dormant: all voice endpoints live behind scope `off`; `/healthz` unchanged; existing endpoints byte-identical in behavior (full existing test suites must pass: 44 unit, PostgreSQL authorization suite, conformance).
4. Frontend deploys hidden: voice UI renders only when the session capability grants it; with scope off, the shipped bundle renders the current product except the single enumerated clip-fix delta (Acceptance doc Section 2a); the conformance comparison must pass with the flag off under exactly that one accepted delta.
5. Founder-only activation, real-device validation, bake-off cutover decision, then cohort activation. Full sequence with gates: Acceptance doc.

No maintenance outage is required by any step above; every migration is additive and every deploy is dormant-first. [VERIFIED pattern: B1-503 executed exactly this shape with feature-off gates.]

## 10. Phase 2 boundary (contract only, no code) [AUTHORITY]

What Phase 1 leaves behind so Phase 2 plugs in cleanly later: the mentor room's rail-card slot (frontend), the `/api/ai/*` route namespace and flag pattern (already existing), and the rule that any future draft-question generator may only write into the existing mentor ask mechanism (`s.refl`-equivalent server path) as the mentor, behind a mentor-scope flag, after separate founder authorization. No Phase 2 table, endpoint, prompt, or provider call ships in Phase 1. Verification: the Phase 1 acceptance run includes a sweep proving no Socratic strings, endpoints, or flags exist in the deployed bundle and API.

## 11. Traceability: prototype surface to production change

| Prototype surface/state | Current production component [VERIFIED] | Frontend change | API | Storage/data | Tests | Flag |
|---|---|---|---|---|---|---|
| Hero mic starts recording; NEW pulse; placeholder | Home hero in `public/app.js` (mic exists, opens sheet only) | arm-on-open path; pulse + one-time hint; all removed when capability absent | `/api/session` capability | none | e2e: mic tap to first text; flag-off hides | voice_capture |
| Dock idle/arming/recording/paused/review | capture sheet `micBar` (single-shot record) | replace micBar with dock states per prototype | `POST /api/recordings`, `POST .../segments` | `sf_recording_sessions`, `sf_recording_segments` | unit: state machine; e2e: full take | voice_capture |
| Live transcript into the same textarea + ghost + overlap-merge | textarea `#capBody` (typing only) | poll-merge engine, ghost line, overlap-merge (port prototype algorithm) | `GET /api/recordings/:id` | segment transcript columns | unit: overlap-merge property tests; e2e: no duplicated words on pause/resume | voice_capture |
| Pause/resume, auto-pause on app switch | none | segment boundary + visibility/mute handlers + wake lock | same | same | mobile device tests | voice_capture |
| Transcript check chips | none | chips from server `flaggedTerms` | included in session GET | lexicon file, versioned | unit: lexicon matcher; e2e: chip applies | voice_capture |
| Interruption recovery banner | durable draft (text fields) exists | recovery open path per prototype | existing drafts API + session GET | draft payload gains voice fields | e2e: reload mid-take on desktop and mobile | voice_capture |
| Review, Record more, Discard | save-blocked-while-recording logic | review row per prototype; discard anchor semantics | `finish`, `cancel` | lifecycle deletes | e2e: discard removes take, keeps typed text | voice_capture |
| Save to private story; audio card | `POST /api/stories` + `sf_audio_assets` + playback card, all existing | attach recordingId on save | extend stories create | assembled asset + `sf_story_originals.original_transcript` = reviewed transcript | postgres suite: RLS on new tables; e2e: reopen and play | voice_capture |
| Release Controls panel (admin) | none (env AI flags only) | admin settings panel per prototype interaction | admin feature API | `sf_feature_flags` + audit | authz tests: student cannot read/mutate | admin role |
| Socratic co-pilot | none | NOT BUILT in Phase 1 | none | none | absence sweep | n/a |

## 12. Discovery requirements consolidated [CODEX]

R-0 Ladder verifications V-1 and V-2 (Section 1): prove deployed-runtime identity and capture production R2 config state before any change; then, before relying on any candidate audio infrastructure, take it to L5 with real end-to-end tests and repair what fails.
R-1 Confirm production Railway `STORYFORGE_R2_*` state; create/scope the private bucket per Storage doc if absent.
R-2 Fresh-read the COMPLETED B1-505 final authority at Codex run time (handoff + production access receipt); extract exact cohort values and access policy. Stop scope, identical to the Authority Lock and MegaRun: without it, S0 to S6 plus S7 founder-only validation may proceed; all allowlist/cohort activation (S8 onward) and any WordPress access-policy change are hard-stopped, where "access-policy change" means `allowed_user_ids` membership, `allowed_roles`, or `allowed_cohorts` (the R-8 founder role override, which grants no student access, is exempt so S7 cannot deadlock). Absence at Fable inspection time is not final; B1-505 may complete before the Codex run.
R-8 Admin identity: "admin" for E11/Release Controls means the founder's exact WordPress account (B1-503 exact-account binding) carrying app role `admin` in the verified JWT. [VERIFIED at L1] the SSO plugin's `allowed_roles` includes `admin` and `app_role_overrides` can map a user to it; [VERIFIED in B1-503 prestate] the founder pilot currently carries a `student` override, so Codex must coordinate the explicit, audited settings change (or a second founder admin account) with the founder at G5 before the admin surface is reachable; document whichever is chosen.
R-9 Staging environment: verify whether a StoryForge staging service/database exists; if none, use the existing local harness (`scripts/run-local.sh`, dev-auth loopback mode [VERIFIED at L1]) plus the staging R2 bucket for S1/S6, and say so in evidence. Do not invent a staging deployment that was never verified.
R-3 Verify OpenAI API key availability for the StoryForge service (its own scoped key, not the hq key, Storage/Contracts doc); confirm `gpt-transcribe` and `whisper-1` respond on the production account; record model availability evidence.
R-4 Bake-off per the Bake-off doc against real APIs; produce the cutover decision record.
R-5 ffmpeg feasibility on Railway for assembly Option A; otherwise implement Option B.
R-6 Verify JWT claims carry cohort (or add it to the token exchange within the existing SSO plugin contract) so cohort scoping is server-checkable in the API.
R-7 Confirm provider confidence-signal availability for transcript check source 1.
