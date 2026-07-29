# B1-504B · R2 Audio Storage and Lifecycle Specification

Labels and ladder per the Infrastructure Authority Lock. This document carries B1-504A's storage authority forward, upgrades it with binding decision tables, and reconciles source truth with unknown production truth.

## 1. Candidate chain reconciliation (VST vs production)

Source truth (VST, line-verified): presigned PUT with exact ContentType and ContentLength bound; MIME allowlist `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`; 1 byte to 50 MB; HeadObject verify (type, size, ETag) failing closed; presigned GET playback; TTL env default 300 s clamped 60..900; keys `storyforge-audio/{studentUuid}/{storyUuid}/{assetUuid}.{ext}`; `isAudioConfigured()` gate; `sf_audio_assets` state machine with RLS.
Production truth: audio reports unavailable (VPT B1-503 receipt); bucket existence and `STORYFORGE_R2_*` state UNKNOWN (RP-6). The chain is candidate infrastructure at L2; it must reach L4 in the controlled environment and L5 in production through the acceptance matrix before any Phase 1 reliance. Repairs discovered on the way are executed and evidenced, not silently absorbed.

## 2. Buckets (AA)

- Production: `missionmed-storyforge-audio-prod`. Controlled-test: `missionmed-storyforge-audio-staging`. Region: default R2 jurisdiction (no localization requirement is on record; if RP-6 reveals an existing StoryForge bucket with a different name, that is evidence back to Fable, not a rename decision for Codex).
- No public access, no r2.dev URL, no custom domain, no CDN in front of audio. Playback is presigned GET only. Direct R2 exposure policy: forbidden.
- Credentials: one scoped R2 API token, object read/write on these two buckets only, owned by the Railway API service (`STORYFORGE_R2_*`). Rotation: token replacement + Railway variable update; in-flight signatures expire within TTL.
- CORS on both buckets: origins exactly `STORYFORGE_ALLOWED_ORIGINS` (production origin `https://missionmedinstitute.com`), methods GET (playback) and PUT (legacy presign path only; segments travel through the API and need no CORS), headers Content-Type, max-age 3600. Evidence: applied JSON captured; foreign-origin denial probed. If the legacy presign path is retired later, PUT drops from CORS.

## 3. Object model (AA)

- Final assembled asset (existing convention retained): `storyforge-audio/{studentUuid}/{storyUuid}/{assetUuid}.{ext}`.
- Segments (transient): `storyforge-rec/{studentUuid}/{recordingUuid}/seg-{seq:05d}.{ext}`; 5 MB hard cap per segment; segment upload path is API-side PUT to R2 (the API receives multipart segment POSTs per contract E2 and writes to R2 itself; the client never holds segment URLs).
- Legacy presign+direct-PUT remains deployed but UNUSED by voice flows and subordinated to the voice flag (carried binding rule); playback (E9) and deletion (E8) sit OUTSIDE the flag.
- Limits: 20-minute recording cap (client countdown from 18:00; server hard stop), 50 MB assembled cap, 200 segments max, one active session per student (DB-enforced by partial unique index), `STORYFORGE_VOICE_DAILY_MINUTES` default 60.

## 4. Assembly: the binding decision table (no Codex discretion)

Probe RP-8: in a LOCAL container built from the repo's Nixpacks configuration (never the production service; add ffmpeg to a LOCAL config copy if absent), concat-remux a 10-minute, 40-segment fixture set, measuring wall time and output integrity.

| RP-8 outcome | Binding result |
|---|---|
| ffmpeg present or addable; 10-min assembly <= 60 s on the probe hardware; output plays in Chrome and Safari | OPTION A LOCKED: async server-side concat remux to a single object under `storyforge-audio/...` (same-codec stream copy; re-encode to AAC m4a only when segment codecs differ, which cannot happen within one session; stream copy is the expected path). Register via `sf_begin_audio_asset`/`sf_confirm_audio_asset`. |
| ffmpeg not feasible OR assembly exceeds 60 s OR output fails either browser | OPTION B LOCKED: ordered-segment playback. AT ATTACH (E7), the server COPIES each segment object to permanent keys `storyforge-audio/{studentUuid}/{storyUuid}/{assetUuid}/seg-{seq:05d}.{ext}` (S3 CopyObject), registers the asset as the manifest owner, and the originals under `storyforge-rec/` are deleted with the session. The player fetches per-segment presigned GETs sequentially with preload; the audio card presents one continuous control. E8 delete and story-delete cascades remove ALL objects under the asset's key prefix (N objects, HEAD-404 evidence per object sample). The `storyforge-rec/` 7-day expiration therefore never touches saved story audio under either option. |

Probe environment note (binding): RP-8 runs in a LOCAL container built from the repo's Nixpacks configuration, never on the production service; the 60 s gate is measured there and re-confirmed in the controlled environment at S9.

Either outcome satisfies the same acceptance row (full take plays start to finish through the existing audio card). The probe result and the locked option are recorded in evidence; Codex implements exactly one option.

## 5. Lifecycle (AA; retention per the approved authority)

Approved retention (FG status: the B1-504A retention gate recommendation with the corrected copy; the founder ruling is captured in the Founder Gates register): original audio retained by default; student may delete audio anytime keeping the transcript; deleting a story deletes its audio; account closure deletes objects within 30 days; cohort revocation deletes nothing.
Approved copy (PA, immutable strings): `Original audio · kept with your story · heard by your mentor only when you submit · delete anytime` (r2 artifact, SHA `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b`). "Private to you" is forbidden copy.
Session model (binding amendment resolving the finishing-window and multi-take questions): one recording session per capture. The dock's Done enters CLIENT-SIDE review; the session stays `recording` server-side; Record more simply continues segments in the SAME session; Discard cancels the session (a fresh one opens on the next take). E4 `finish` fires at Save time (immediately before E7), so `finishing`/`assembled` exist only inside the save flow and no assembled-but-unattached takes accumulate by design. Earlier discarded takes are always explicit cancels; there is no silent multi-session orphaning.
Cleanup rules: cancel deletes session segment OBJECTS immediately AND purges segment rows (transcript and flagged_terms are erased with the rows; the student's discard means the text is gone from the database, not just from R2); abandoned sessions (no poll/upload activity for 24 h via `last_activity_at`) swept identically with session `failed` and an audit event (the client keeps polling through client-side review, so an open review never goes sweep-eligible, and the sweep additionally excludes sessions whose linked draft was updated within 24 h); failed uploads covered by the same sweep; any `finishing`/`assembled` session older than 72 h (a save that never completed) swept the same way. Sweeps run inside the existing service as an interval task every 10 minutes (`STORYFORGE_SWEEPS=on` default), through the privileged service path defined in the DB spec. Backstop reconciliation: a weekly task lists `storyforge-audio/` objects against `sf_audio_assets` and deletes unreferenced objects older than 7 days (protects the no-orphaned-audio invariant even if a sweep failed); evidence sampled in acceptance. Restore guard: after any rollback rung 6 or 7 event, the reconciliation sweep SUSPENDS pending founder review, so audio uploaded between backup time and restore can be manually re-linked instead of destroyed.
Deletion propagation: E8 audio delete = object delete + asset `retired` + audit; story delete = cascade retire/delete of assets and any residual segments; R2 delete confirmed by HEAD 404 evidence in acceptance.
Encryption: R2 at-rest encryption (platform default) + TLS in transit; no additional envelope encryption in Phase 1 (AA; no key-management system exists to own it, and inventing one is out of scope).
Lifecycle rules on the bucket: `storyforge-rec/` prefix expiration 7 days as a backstop behind the application sweeps; no expiration on `storyforge-audio/`.

## 6. Monitoring and incidents

Metrics (monthly at minimum, alert thresholds in the Observability Runbook): storage bytes by prefix, request error rate, egress, cost. Incident behaviors carried from B1-504A: upload failure buffers then honest auto-pause; playback failure shows truthful unavailable state; credential compromise rotates the scoped token; audio is single-copy in R2 by design (transcripts are database-backed and covered by PG backups), stated as a conscious trade-off in the Founder Gates register.
