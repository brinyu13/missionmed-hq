# B1-504A · Production Acceptance, Rollout, and Rollback

Labels: [VERIFIED] · [AUTHORITY] · [RECOMMENDED] · [CODEX] · [GATE]. Ladder convention per the Authority Lock. Evidence, not checkbox claims: every test below produces an artifact (screenshot, response capture, log line, or query result) filed under the B1-504A evidence folder.

## 1. Browser and device contract (facts the tests are built on)

Current-web facts, researched from official sources this run (retrieval date 2026-07-28). Research record, primary URLs:
MediaRecorder support and types: https://caniuse.com/mediarecorder · https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static · Safari mp4/aac era: https://webkit.org/blog/11353/mediarecorder-api/ · Safari/iOS 18.4 webm/opus + wake-lock expansion: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/ · timeslice chunks not standalone: https://github.com/w3c/mediacapture-record/issues/130 and https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start · getUserMedia permissions/secure context/iframe allow: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia · Safari permission persistence: https://support.apple.com/guide/safari/ibrwe2159f50/mac · mobile interruption behavior (background/lock/calls, Android ~1 min background mic loss): https://learn.microsoft.com/en-us/azure/communication-services/concepts/known-issues and https://bugs.webkit.org/show_bug.cgi?id=226620 · track mute/ended events: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/mute_event · oversized post-lock chunks: https://blog.addpipe.com/dealing-with-huge-mediarecorder-slices/ · Screen Wake Lock support: https://caniuse.com/wake-lock · Web Speech processing location: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API · AudioWorklet support (upgrade path): https://caniuse.com/mdn-api_audioworklet

- MediaRecorder is supported on all four target browsers. Chrome (desktop and Android) records webm/opus; Safari through 18.3 records mp4/aac only and rejects `audio/webm`; Safari and iOS 18.4+ add webm/opus support. Consequence: the backend accepts both webm/opus and mp4/aac; the client feature-detects with `isTypeSupported` per segment and records the chosen type (already the house pattern in the existing capture code [VERIFIED at L1]).
- Timeslice chunks after the first are not standalone files (headers live in chunk 1, W3C mediacapture-record issue 130): this is why the architecture uses segment-scoped recorders (Blueprint Section 2).
- getUserMedia requires a secure context; Safari permission grants are the least persistent (re-prompt per visit is normal); denial raises `NotAllowedError`; the WordPress embedding must carry `allow="microphone"` if any iframe is involved [CODEX verify the actual /storyforge/ route embedding shape and record it].
- Mobile interruptions: iOS Safari mutes/ends capture on backgrounding, screen lock, and incoming calls; Android Chrome loses the microphone after roughly a minute in background and auto-recovers on foreground. The product handles all of these as auto-pause with truthful messaging [AUTHORITY]; lock-screen recording is never promised.
- Screen Wake Lock (supported iOS 16.4+, Android Chrome) is requested while recording and re-acquired on visibility return; it auto-releases when hidden.
- Web Speech API is not used in production: inconsistent support, no control over processing location, no custom vocabulary [RECOMMENDED, evidence in research record]. The prototype's live-engine attempt is prototype-only behavior; production always uses the MissionMed adapter.

## 2. Production acceptance script (end to end, real accounts, real devices)

Roles: F = founder account; T = authorized 360 test student (per B1-505 truth); X = ineligible account. Devices: desktop Chrome (macOS), iPhone Safari (current iOS), plus desktop Safari and Android Chrome for the capture matrix rows marked (M).

| # | Test | PASS criterion (evidence) |
|---|---|---|
| A1 | X opens StoryForge | no voice affordance anywhere; typing flow behavior-identical to baseline (subject only to the enumerated clip-fix delta, Section 2a); `/api/recordings` AND the legacy `/api/audio/presign` + `/api/audio/:id/confirm` all return 403 `voice_disabled` when forced (screenshots + response captures) |
| A2 | F, scope `founder`: hero mic tap | permission prompt on tap only; arming then recording state; timer runs; segment POSTs visible in logs |
| A3 | F speaks the scripted medical passage (corpus passage 1) | first merged text <= 10 s p95 (3 runs); transcript accumulates; ghost line shows in-flight state |
| A4 | Permission denied path (F, fresh profile) | truthful unable-to-continue state; typing unaffected; no console errors |
| A5 | Pause 30 s, resume, continue | no duplicated words at the boundary (transcript diff vs reference); paused state shows honestly |
| A6 | App switch mid-recording (M: iPhone Safari, Android Chrome) | auto-pause with explanatory note; resume works; no words lost beyond the in-flight second |
| A7 | Screen lock 60 s mid-recording (M: iPhone) | auto-pause; wake-lock prevents idle lock during active recording with screen on |
| A8 | Network kill 20 s mid-recording, restore | reconnecting state; buffered segments upload on restore; no loss; honest messaging |
| A9 | Reload mid-recording, same device | recovery banner; transcript (including last finalized segments) restored; duration shown [AUTHORITY] |
| A10 | Continue recovery on a SECOND device (T logs in elsewhere) | draft with transcript text present (server-side durability proof) |
| A11 | Quiet audio + accented speech rows (per corpus groups) | medical-term recall >= 92% on the scripted passages; WER within thresholds (scored) |
| A12 | Transcript check | chips appear only for real flagged terms; tap applies; no chips when clean; no invented uncertainty |
| A13 | Edit transcript, add title, save | private story created; `sf_story_originals.original_transcript` = reviewed text; draft consumed atomically |
| A14 | Reopen story; play audio (policy-enabled) | audio card plays assembled take end to end; duration matches |
| A15 | Student deletes audio, keeps transcript (policy-enabled) | object HEAD 404 after deletion; transcript intact; audit event present; repeated once with voice scope `off` to prove deletion survives rollback (E8 sits outside the voice flag by design) |
| A16 | Delete story | assets retired and objects deleted; audit trail complete |
| A17 | Cross-student denial | T replays F's asset UUID + object key on playback and delete: 403/404, audited; direct R2 GET without signature: denied |
| A17b | Cross-student attach denial | T submits `POST /api/stories` with F's `recordingId`: 403, audited; no story created, no linkage |
| A17c | Cross-student session denial | T calls E3/E4/E5/E6 with F's session id: 403/404 each, audited |
| A18 | Expired signature | playback URL at TTL+60 s fails (capture) |
| A19 | Mentor visibility | mentor plays audio on a SUBMITTED story of an assigned student; cannot see private stories' audio or any recording session; unassigned mentor denied |
| A20 | Admin boundary | admin changes flag scope (audited); admin has NO playback path for student audio (attempt denied) |
| A21 | Rollback drill: scope `off` mid-session | active take finishes within grace; new sessions refused; UI reverts to typing-only V5.5 everywhere, which is behaviorally the V5 typing product plus the enumerated clip-fix delta (screenshots); saved stories/transcripts/audio untouched |
| A22 | Emergency env kill | `STORYFORGE_VOICE_FORCE_OFF=1`: every voice endpoint INCLUDING legacy `/api/audio/presign` and `/api/audio/:id/confirm` refuses immediately (playback deliberately exempt, saved audio must keep playing); client degrades per Blueprint 7; restart-clean |
| A23 | Phase 2 invisibility sweep | deployed bundle and API contain no Socratic strings, endpoints, flags, or prompts (grep + route sweep evidence) |
| A24 | Existing-product conformance with flag off | the B1-503 conformance suite passes with exactly ONE accepted, enumerated delta: the 390 px bottom-navigation clip fix (Authority Lock Section 4 item 6), which ships unflagged as a carried-defect correction; every other surface compares identical (comparison config updated to accept precisely that delta and nothing else) |
| A25 | Suites | unit, PostgreSQL authorization (extended for M1/M2 tables), e2e, integration: all green in CI logs |

PASS gates summary: transcription accuracy (A3, A11 + bake-off thresholds), medical terms (A11, A12), latency (A3), durability (A8, A9, A10), privacy (A15 to A18, log sweep), authorization (A17, A19, A20 + suite), mobile usability (A6, A7 rows on real devices), rollback (A21, A22), production health (Section 4 window).

## 2a. Enumerated flag-off delta

Exactly one intentional flag-off difference from the canonical V5 baseline exists: the 390 px bottom-navigation clip fix. It is a carried-defect correction, not a feature, and ships unflagged. A1, A21, A24, and G4 all read "identical" as "identical except this enumerated delta". No other unflagged difference is permitted.

## 2b. WordPress plugin change handling (only if R-6 or R-8 triggers)

If the cohort claim (R-6) or admin-role mapping (R-8) requires touching the SSO plugin or its settings: version-bump the plugin; back up current plugin files and the `missionmed_storyforge_settings` option before change (G1 addition); deploy the plugin change before G3 with its own smoke test (token exchange still passes for the pilot account); record a WP-side rollback step (restore files + option) in the rollback packet. Settings-only changes (the R-8 role override) follow the same backup-first rule.

## 3. Rollout sequence (with gates)

G0 Preflight [CODEX]: worktree `B1-StoryForge-502` clean on the expected branch; canonical V5 hash verified; V5.5 authority hashes verified; FRESH read of completed B1-505 authority (hard-stop if absent/partial/failed); live baseline identities match B1-503/B1-505 receipts (ladder V-1); production R2 config state captured (V-2).
G1 Backups: Kinsta recovery point; PostgreSQL dump + restore rehearsal per B1-503 discipline; Railway variable export; R2 bucket config export (if bucket exists).
G2 Migrations M1+M2 applied in one transaction via the guarded runner, feature entirely off; existing suites green.
G3 Dormant backend deploy (Railway): voice endpoints live behind scope `off`; `/healthz` green; A1-class probes confirm refusal; existing behavior regression-free (A24, A25).
G4 Hidden frontend deploy (Kinsta immutable release + pointer): flag off renders the current product subject only to the enumerated clip-fix delta (Section 2a); conformance pass (A24).
G5 Founder-only activation (scope `founder`): full device matrix A2 to A22 with F; bake-off completed and cutover decision recorded; assembly option proven.
G6 Test-student expansion (scope `allowlist` with T): repeat the abbreviated matrix on T's real devices.
G7 Policy/copy agreement gate [GATE]: founder has approved the retention policy; shipped copy matches shipped behavior (screenshot pair filed).
G8 360 cohort activation (scope `cohort` with B1-505 values): announce nothing louder than the product's own one-time hint [AUTHORITY]; monitoring window opens.
G9 Monitoring window: 72 h. Watch: transcription failure rate, upload failure rate, provider p95 latency, error categories, storage growth, cost. Alert thresholds: segment transcribe-failure > 5%/h; upload failure > 5%/h; provider p95 > 20 s sustained 30 min; any authorization-denial anomaly spike; any log-sweep hit on forbidden content (immediate).
G10 Close-out: evidence bundle, combined handoff update, MissionMed activity log entry.

## 4. Rollback design (containment before restoration)

Triggers: any privacy or authorization failure (immediate); sustained alert-threshold breach; medical-term or accuracy complaints from >= 3 cohort students; provider cost anomaly > 3x forecast; founder call.

Ladder, least destructive first:
1. Feature-off containment (seconds): scope `off` (DB) or env kill. Product is typing-only V5.5; all saved data intact. This is the default response to almost everything.
2. Frontend rollback (minutes): Kinsta pointer to the prior immutable release (existing script pattern [VERIFIED at L1]).
3. API rollback (minutes): redeploy prior Railway build. New tables tolerate the old API (they are simply unused); no data loss.
4. Provider rollback (config): switch adapter primary to fallback (`whisper-1`) or disable transcription while keeping recording, which degrades to record-then-transcribe-on-retry, truthfully messaged.
5. Schema rollback: NOT performed for containment. M1/M2 are additive and inert when unused. A destructive down-migration happens only with founder authorization and a fresh backup, and never merely to disable voice capture.
6. Data restoration: last resort, from G1 artifacts, per B1-503 restore discipline.

Post-rollback data handling: student stories, transcripts, and audio saved before rollback remain intact and playable (policy permitting); in-flight sessions are swept as abandoned (segments deleted, drafts preserved); the founder receives an incident note with error-category evidence. Rollback must never erase valid student content to disable a feature [founder instruction; tested in A21].

## 5. Support procedure

One page for the founder/support: (1) open `/api/admin/voice/health`; (2) find the student's last session row; (3) the errorCategory says which stage failed: `mic` (permission/device), `upload` (network/R2), `transcribe` (provider), `assembly`, `save`, `auth` (eligibility); (4) canned truthful responses per category; (5) escalation = flip scope for that student (allowlist removal) rather than debugging live; (6) nothing in the health surface exposes content.

## 6. Cost and capacity watch

Forecast at cohort scale for the monitoring window [RECOMMENDED, priced from official pages retrieved this run]: transcription at $0.0045/min primary; audio storage at R2 rates for opus/aac voice (well under 1 MB/min); both trivially within budget at beta scale; the daily per-student recording ceiling (Storage doc Section 5) bounds the tail. Monthly review of provider usage, storage growth, and egress until GA.
