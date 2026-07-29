# B1-504A · API, Data, and Feature-Flag Contracts

Labels: [VERIFIED] checked this run at the stated ladder level · [AUTHORITY] V5.5 prototype · [RECOMMENDED] · [CODEX] · [GATE]. Ladder convention per the Authority Lock: L1 source through L5 end-to-end.

Identity model, existing and unchanged [VERIFIED at L1; L5 within B1-503 scope]: WordPress authenticates; the SSO plugin issues a short-TTL JWT (issuer/audience pinned, 60 s TTL in the B1-503 production prestate); `server/auth.mjs` verifies via JWKS or shared secret (jose); every API call carries the verified identity (user UUID, role, and entitlement) and RLS scopes queries through `withIdentity`. All new endpoints below inherit exactly this model. [CODEX R-6] verify the verified-claim set exposed to handlers includes cohort; if not, extend the token exchange inside the existing SSO plugin contract (additive claim, TTL and pinning unchanged) so cohort scoping is server-checkable.

## 1. Schema: what is proven insufficient, and the minimum additive change

Proof of insufficiency [VERIFIED at L1 by inspection of all five migrations]: the existing fields cover a single-shot voice note (one asset, one confirm, duration) and an immutable original transcript at story creation. They cannot represent: an in-progress recording session; ordered segments with per-segment upload and transcription state; transcription provider/version and retry state; near-live partial transcripts; recording-scoped recovery; feature scopes; or per-object retention/deletion state transitions initiated by students. Therefore migrations are required. All are additive; nothing existing is altered or dropped.

Migration M1 `sf_recording_sessions` + `sf_recording_segments` [CODEX]:

```
sf_recording_sessions (
  id uuid PK default gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES sf_users(id) ON DELETE RESTRICT,
  story_id uuid NULL REFERENCES sf_stories(id),        -- set when attached
  state text NOT NULL DEFAULT 'recording'
    CHECK (state IN ('recording','finishing','assembled','attached','cancelled','failed')),
  mime_type text NULL,
  total_duration_ms integer NOT NULL DEFAULT 0,
  segment_count integer NOT NULL DEFAULT 0,
  assembled_asset_id uuid NULL REFERENCES sf_audio_assets(id),
  provider_id text NULL, model_id text NULL,           -- adapter identifiers, never shown to users
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
sf_recording_segments (
  id uuid PK default gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sf_recording_sessions(id) ON DELETE RESTRICT,
  seq integer NOT NULL, UNIQUE(session_id, seq),
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL, byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  duration_ms integer NULL,
  transcribe_state text NOT NULL DEFAULT 'received'
    CHECK (transcribe_state IN ('received','transcribing','transcribed','transcribe_failed')),
  transcript text NULL,                                 -- per-segment final text
  flagged_terms jsonb NOT NULL DEFAULT '[]',            -- transcript-check chips source
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
)
```

RLS: enable on both; student SELECT/act only on own rows (mirroring `sf_audio_assets` policy shape); mentors have NO access to sessions or segments (recordings are pre-save, private by definition); mutation through SECURITY DEFINER functions or identity-scoped statements exactly per the existing house pattern; grants to `authenticated` only [CODEX, replicate existing patterns; prove with the PostgreSQL authorization suite].

Migration M2 `sf_feature_flags` [CODEX]:

```
sf_feature_flags (
  key text PK,
  scope text NOT NULL DEFAULT 'off' CHECK (scope IN ('off','founder','allowlist','cohort','eligible_all')),
  allowlist uuid[] NOT NULL DEFAULT '{}',
  cohorts text[] NOT NULL DEFAULT '{}',
  updated_by uuid NOT NULL REFERENCES sf_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
)
```

Seed row `voice_capture` scope `off`. Every mutation writes `sf_audit_events` (existing append-only table) with actor, prior scope, new scope [AUTHORITY: stamped change log]. RLS: readable by admin only; the API computes and exposes only the caller's own boolean capability.

Draft payload extension (no migration; `sf_story_drafts.payload` is jsonb through `sf_save_story_draft`): add `voice: { recordingId, recT, ghost, anchorLen }` keys to the existing payload; version/optimistic-concurrency behavior unchanged [VERIFIED at L1 that payload is jsonb with row_version].

Explicitly rejected schema changes [RECOMMENDED restraint]: no changes to `sf_stories`, `sf_story_originals`, or `sf_audio_assets` shapes; no queue tables (in-process work with DB state is sufficient at cohort scale); no analytics tables.

## 2. Endpoint contracts

Every endpoint: trusted identity from the verified JWT; authorization re-checked server-side (never trusting frontend state); JSON errors in the existing error-code style; every state transition audited via `sf_audit_events` with metadata only (no transcript text, no audio, no signed URLs in audit rows or logs).

| # | Endpoint | Auth rule | Input | Output | Idempotency / failure / retry |
|---|---|---|---|---|---|
| E1 | `POST /api/recordings` | student; `voice_capture` scope match; one active session per student | `{draftContext?}` | `{recordingId, segmentPlanMs: [4000, 15000], caps}` (opening segment 4 s, steady-state 15 s; binding for latency thresholds) | second call returns the existing active session (idempotent by student); `voice_disabled` 403 when scope fails |
| E2 | `POST /api/recordings/:id/segments` | student owns session; state `recording` | multipart: bytes, `seq`, `mimeType`, `durationMs` | `{seq, state:'received'}` | idempotent on (session, seq): duplicate seq returns 200 with existing state (client retry-safe); size/type validated against the storage rules; oversize 413 |
| E3 | `GET /api/recordings/:id` | student owns session | none | `{state, segments:[{seq,transcribeState,transcript,flaggedTerms}], fullText, totalDurationMs, assembled}` | pure read; poll every 2 s; ETag/304 friendly [CODEX optional] |
| E4 | `POST /api/recordings/:id/finish` | student owns session; state `recording` | `{clientDurationMs}` | `{state:'finishing'|'assembled', assetId?}` | idempotent (repeat returns current state); triggers assembly async; transcription of any pending segments continues |
| E5 | `POST /api/recordings/:id/cancel` | student owns session | none | `{state:'cancelled'}` | idempotent; deletes segments and any assembled object; audits |
| E6 | `POST /api/recordings/:id/retry-transcription` | student owns session | `{seq?}` | per-segment states | bounded retries (3/segment); provider failover per adapter |
| E7 | `POST /api/stories` (EXTENDED, existing endpoint) | existing rules + caller OWNS the session referenced by `recordingId`, session state `finishing` or `assembled`, session not already attached; any violation 403, audited. This ownership check is explicit and mandatory because attach may run through SECURITY DEFINER paths that bypass RLS | existing body + `recordingId?` | existing story payload | attach is transactional: story create + `sf_story_originals` (original_transcript = reviewed transcript) + session `attached` + asset linkage all commit together; on any failure nothing attaches and the draft persists (existing atomic-draft-consumption guarantee) |
| E8 | `DELETE /api/audio/:assetId` (NEW) | student owns the story; policy-gated | none | `{state:'retired'}` | idempotent; deletes object, retires row, audits; transcript untouched [GATE-dependent: ships only under the approved retention policy] |
| E9 | `GET /api/audio/:id/playback` (EXISTING) | ownership or authorized mentor on submitted story | none | signed URL, TTL | unchanged seam; L5 proof required (cross-student, direct-object, expired-signature denials) |
| E10 | `GET /api/session` (EXTENDED) | any authenticated | none | existing payload + `capabilities: { voiceCapture: bool }` | capability computed server-side from flag scope + cohort claims |
| E11 | `GET /api/admin/features` / `POST /api/admin/features/voice_capture` | admin role only | scope, allowlist, cohorts | current flag state + last 20 audit entries | validation: cohort values must exist in B1-505 authority; every change audited; non-admin 403 + audit |
| E12 | `POST /api/recordings/:id/heartbeat` (optional; may be folded into E3 polling, in which case it is not implemented separately) | student owns session | none | `{ok}` | keeps abandonment sweep honest while actively recording |
| E13 | `GET /api/admin/voice/health` | admin role only (R-8 definition: founder's exact account carrying app role `admin`); non-admin 403 + audit | none | last-24 h sessions summarized by errorCategory, counts and states only, zero content | read-only; served through a privileged service query path, not through student-scoped RLS identity [CODEX: implement with the same trusted-service pattern the mentor cross-student views already use] |

Legacy endpoint subordination (mandatory): the pre-existing `POST /api/audio/presign` and `POST /api/audio/:id/confirm` are bound to the `voice_capture` scope and `STORYFORGE_VOICE_FORCE_OFF` exactly like E1 to E6, because production R2 configuration would otherwise re-arm the legacy voice-note chain for the whole pilot outside any flag. Two endpoints deliberately sit OUTSIDE the voice flag: `GET /api/audio/:id/playback` (E9) and `DELETE /api/audio/:assetId` (E8), both ownership- and policy-gated only, so that saved audio keeps playing and "delete anytime" keeps being true across rollback and cohort revocation. Those two carve-outs are explicit, not oversights.

`sf_users` existence [VERIFIED at L1]: the M1/M2 foreign keys target `public.sf_users(id)`, which is the existing users table referenced by the foundation migration's own constraints (for example `sf_audio_assets.student_id uuid NOT NULL REFERENCES public.sf_users(id)`). This is not an assumed name.

Per-student daily recording ceiling: env `STORYFORGE_VOICE_DAILY_MINUTES` (default 60), enforced in E1/E2 [CODEX latitude on the counting mechanics; the bound and its truthful refusal state are binding].

Transcription is server-initiated (E2 enqueues); there is no client-facing transcription endpoint and no provider identifier in any response [AUTHORITY].

Feature-disable during active recording: E2/E4 continue to honor an already-open session for up to 10 minutes after a scope change (grace, so a mid-take student is not truncated), while E1 refuses new sessions immediately; emergency env kill (`STORYFORGE_VOICE_FORCE_OFF=1`) refuses everything immediately and the client degrades per Blueprint Section 7 [RECOMMENDED; both paths tested in acceptance].

## 3. Frontend/backend boundary

The frontend: renders states, records segments, posls, merges text (overlap-merge ported from the prototype), autosaves drafts, and never decides authorization, eligibility, retention, or provider anything. All copy comes from the V5.5 authority; all enforcement is server-side. The `voiceCapture` capability only chooses whether voice affordances render [AUTHORITY conformance].

## 4. Observability contract (smallest useful)

Structured JSON lines from the existing service logger: `recording_started`, `segment_received`, `segment_transcribed`, `segment_transcribe_failed`, `recording_finished`, `assembly_completed|failed`, `draft_recovered`, `story_saved_with_voice`, `audio_deleted`, `feature_scope_changed`, `unauthorized_denied`, each with: timestamp, event, recordingId/assetId (UUIDs are the only correlation IDs), studentId UUID, latencyMs where applicable, errorCategory (`mic|upload|transcribe|assembly|save|auth`) and provider latency buckets. NEVER logged: transcript text, audio bytes, patient or student names, tokens, signed URLs, secrets, raw payloads. Founder support flow: `GET /api/admin/voice/health` summarizes last-24 h sessions by errorCategory so "was it microphone, upload, transcription, save, or authorization" is answerable in one look without content access. Alert thresholds and the monitoring window: Acceptance doc. No new analytics platform [founder instruction; structured logs + existing infrastructure suffice].
