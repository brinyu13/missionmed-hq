# B1-504B · Observability and Operator Runbook

Labels per the Infrastructure Authority Lock. Smallest useful production observability; structured JSON lines on the existing Railway service logger; no analytics platform.

## 1. Event names and correlation (AA, binding)

Events: `recording_started`, `segment_received`, `segment_transcribed`, `segment_transcribe_failed`, `provider_failover`, `recording_finished`, `assembly_completed`, `assembly_failed`, `draft_recovered`, `story_saved_with_voice`, `audio_playback_granted`, `audio_deleted`, `feature_scope_changed`, `voice_denied`, `unauthorized_denied`, `platform_read`, `platform_denied`, `sweep_cleaned`.
Fields: `t`, `event`, `recordingId` / `assetId` / `storyId` / `jobSeq` / `consumerId` / `purpose` as applicable (UUIDs are the only correlation IDs), `studentId` (UUID), `latencyMs`, `errorCategory` in `mic|upload|transcribe|assembly|save|auth|platform`, `providerLatencyBucket`.
NEVER logged (binding, tested by a log-content sweep in acceptance): full or partial story text, transcripts, audio bytes, patient or student names, bearer or service tokens, presigned URLs, provider secrets, mentor note text.

## 2. Metrics and thresholds (AA)

From structured logs (Railway log queries) plus Cloudflare R2 metrics: transcription failure rate (alert > 5%/h), upload failure rate (> 5%/h), playback failure rate (> 2%/h), deletion failure (any, immediate review), recovery success rate (report), provider p95 latency (> 20 s sustained 30 min), provider failover rate (> 1/day review), first-text latency p95 (report vs 10 s gate), R2 storage growth (> 2 GB/week at beta scale review), transcription cost (> 3x forecast alert), active voice users and capture completion rate (report), flag state changes (each one is an audited event), authorization denial counts (spike = immediate review), suspicious access patterns (repeated cross-student denials from one account = immediate review), platform contract failures (any in CI = block), health checks (`/healthz` by Railway).
Alerting posture, stated precisely (AA): there is NO automated alert evaluator in Phase 1 (building one would violate the no-new-stack rule, and none exists today at any verified level). The thresholds above are REVIEW THRESHOLDS: during observation windows the operator runs the deterministic threshold queries DAILY (S19) and then weekly (S21) and reports breaches to the founder's operational email the same day. Any automated alerting is a post-Phase-1 backlog item.

## 3. Operator procedures

Support triage (one page): open `GET /api/admin/voice/health` (E13; admin only; last-24 h sessions by errorCategory, counts and states only) -> read the student's latest session errorCategory -> `mic`: device/permission guidance; `upload`: network/R2 status check; `transcribe`: provider status + E6 retry guidance; `assembly`: check assembly queue, replay; `save`: draft intact, retry save; `auth`: eligibility/flag scope check. Canned truthful responses per category ship with the release notes. Escalation ladder: individual (remove from allowlist or advise) -> scope narrowing -> `off` -> env kill. Nothing in any admin surface exposes content.
Troubleshooting queries (read-only, run via the guarded psql path), exact SQL over the locked M1/M2 schema:
- Sessions by state, 24 h: `SELECT state, count(*) FROM public.sf_recording_sessions WHERE created_at > now() - interval '24 hours' GROUP BY state ORDER BY state;`
- Stuck transcriptions: `SELECT id, session_id, seq, retry_count, updated_at FROM public.sf_recording_segments WHERE transcribe_state = 'transcribing' AND updated_at < now() - interval '10 minutes' ORDER BY updated_at;`
- Stale active sessions: `SELECT id, student_id, last_activity_at FROM public.sf_recording_sessions WHERE state = 'recording' AND last_activity_at < now() - interval '1 hour';`
- Audit tail for a story: `SELECT created_at, actor_id, action, metadata FROM public.sf_audit_events WHERE entity_type = 'story' AND entity_id = $1 ORDER BY created_at DESC LIMIT 50;` (column names confirmed against RP-13 evidence in the amendment pass)
- Flag history: `SELECT created_at, actor_id, action, metadata FROM public.sf_audit_events WHERE action LIKE '%voice_capture%' ORDER BY created_at DESC LIMIT 20;`
Incident evidence package (for any P0 incident): timeframe log extract (scrubbed by construction), flag history, audit tail for affected IDs, R2 request metrics, provider status page capture, and the action taken; filed under the B1-506 evidence tree.
Backlog (explicitly deferred, recorded so deferral is a decision, not an omission): CSP hardening pass; student-facing consumer-access transparency surface; DB-backed consumer registry; push-based change delivery.
