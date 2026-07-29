# B1-504A · R2 Audio Storage, Privacy, Retention, and Lifecycle Authority

Labels: [VERIFIED] checked this run (at the stated readiness-ladder level only) · [AUTHORITY] V5.5 prototype · [RECOMMENDED] · [CODEX] Codex discovery/implementation · [GATE] founder approval.

Ladder reminder (Authority Lock convention): the storage seam described in Section 1 is verified at L1 (present in source) only. Its presence in the deployed runtime (L2), production configuration (L3), reachability (L4), and end-to-end behavior (L5) are Codex verification targets, and the seam is candidate infrastructure to preserve or repair until L5 evidence exists.

## 1. Verified current storage seam [VERIFIED at L1]

`storyforge-v5/server/storage.mjs` (inspected this run):

- Client: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` against `config.r2` (`STORYFORGE_R2_ENDPOINT`, `STORYFORGE_R2_REGION` default `auto`, `STORYFORGE_R2_BUCKET`, `STORYFORGE_R2_ACCESS_KEY_ID`, `STORYFORGE_R2_SECRET_ACCESS_KEY`). The endpoint/region shape is Cloudflare R2's S3-compatible surface.
- Upload: presigned PUT with exact `ContentType` and `ContentLength` bound into the signature; allowed types `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`; 1 byte to 50 MB (matching the DB constraint 52,428,800).
- Verification: `HeadObjectCommand` compares stored ContentType and ContentLength to the signed request, captures the ETag; mismatch fails closed (`audio_verification_failed`).
- Playback: presigned GET; TTL `STORYFORGE_R2_SIGNED_URL_TTL_SECONDS` default 300 s, clamped 60 to 900.
- Object keys: `storyforge-audio/{studentUuid}/{storyUuid}/{randomUuid}.{extension}`; opaque UUIDs only, no names, emails, titles, or content in keys; `Metadata: { student, story }` carries the same opaque UUIDs.
- Gate: `isAudioConfigured()` requires endpoint, bucket, and both credentials; when false the whole chain reports unavailable truthfully (matches the B1-503 receipt language).

Related production facts: B1-503 prestate/final records show the historical stack (Railway API, isolated PostgreSQL, Kinsta static, Cloudflare DNS) [VERIFIED in B1-503 documents]; a separate MissionMed R2 practice exists elsewhere (`.venv_r2` upload tooling in the main repo and VIDEO_SYSTEM R2 validation cases) [VERIFIED at L1], which confirms organizational R2 usage without proving anything about a StoryForge bucket.

## 2. Bucket decision [RECOMMENDED + CODEX]

Recommended: a dedicated, StoryForge-scoped private bucket (working name `missionmed-storyforge-audio-prod`), NOT shared with the video/content buckets. Reasons: blast-radius isolation for credentials (StoryForge gets its own R2 API token scoped to this bucket only), independent lifecycle rules, clean cost accounting, and simpler incident response. A separate `missionmed-storyforge-audio-staging` bucket serves local/integration testing so production objects can never be touched by tests.

[CODEX] discovery and implementation:
1. Enumerate existing R2 buckets in the MissionMed Cloudflare account; record whether any StoryForge bucket already exists (none is referenced in the repository beyond the env seam).
2. Create the two buckets if absent; default encryption at rest (R2-managed keys) and HTTPS-only access are Cloudflare defaults; confirm and record.
3. No public access, no custom public domain, no `r2.dev` public development URL enabled on either bucket. Audio must never be served through a permanently public URL [AUTHORITY + founder instruction].
4. Mint a scoped R2 API token (object read/write on the StoryForge buckets only); set the five `STORYFORGE_R2_*` variables in Railway (staging first, then production); never commit credentials; the existing secret-scan gate (`scan:secrets`) must pass.
5. CORS on the bucket: allow PUT/GET from the exact production origin(s) in `STORYFORGE_ALLOWED_ORIGINS` only, since the browser PUTs directly to the presigned URL. Record the applied CORS JSON in evidence.

## 3. Object layout and conventions [RECOMMENDED, extending the verified seam]

- Final assembled story audio (existing convention, keep): `storyforge-audio/{studentUuid}/{storyUuid}/{assetUuid}.{ext}`.
- Recording-session segments (new, transient): `storyforge-rec/{studentUuid}/{recordingUuid}/seg-{seq:05d}.{ext}`.
- Bake-off/evaluation material lives only in the staging bucket under `bakeoff/`, never in production.
- Content types restricted to the existing four; extension derived from content type exactly as the current seam does.
- Objects carry no student-identifying metadata beyond opaque UUIDs (existing behavior, keep). Filenames, keys, logs, and error reports never contain names, emails, story titles, transcript text, or audio content [founder instruction; enforced by the Observability rules in the Acceptance doc].

## 4. Upload and delivery behavior

- Segment upload path [RECOMMENDED]: segments POST to the StoryForge API (multipart, a few MB each) and the API writes them to R2 server-side. Rationale: the API must see the bytes anyway to relay them for transcription; one hop, one authorization check, no presign churn per segment, and the client never holds segment-level R2 URLs. The legacy presign+direct-PUT seam is retained deployed but UNUSED by voice flows under either assembly option, and it is subordinated to the `voice_capture` scope and the env kill (Contracts doc, legacy endpoint subordination), because production R2 configuration would otherwise re-arm the legacy voice-note chain outside any flag. Playback stays outside the voice flag by design (saved audio survives rollback).
- Multipart/resumable: individual segments are small enough that single PUTs suffice; resumability is achieved at the segment level (retry a failed segment POST), which is why no S3 multipart-upload machinery is added [RECOMMENDED: simplest sufficient].
- Playback: existing signed-GET seam, TTL 300 s default. Every playback issuance re-verifies, server-side: caller identity, story ownership or authorized mentor visibility (Section 6), asset state `verified`, and feature-independent access (playback of already-saved audio survives voice-capture rollback). Possession of an object key or asset UUID grants nothing without these checks; the RLS read policy on `sf_audio_assets` scopes through the story row [VERIFIED at L1 in migration SQL; L5 proof required by the Acceptance doc's cross-student and direct-object denial tests].
- Signed-URL TTL stays in the 60 to 900 s band; 300 s default confirmed adequate for playback start; upload presigns (where used) also 300 s.

## 5. Size, duration, and rate bounds

- 50 MB per assembled object (existing constraint, keep); 20-minute recording cap for Phase 1 (Blueprint Section 4); segment size expected well under 1 MB at opus voice bitrates, hard-capped at 5 MB each.
- Per-student concurrency: one active recording session; per-student daily ceiling (default 60 recording minutes/day) as a cost and abuse guard, adjustable by admin config; exceeding it yields the truthful unable-to-continue state, typing unaffected [RECOMMENDED].

## 6. Access model (who can hear what)

- Student: full access to their own audio (play, delete), on stories in any status.
- Mentor: may play audio only on stories the student has submitted (status not private) and only for students within the mentor's assignment boundary (existing `_missionmed_storyforge_student_ids` + B1-503 assigned-mentor invariants). Private stories and their audio are invisible to everyone but the student, including by direct ID [VERIFIED at L1: existing RLS pattern; L5 proof in acceptance].
- Administrator: NO story-content override exists (B1-503 invariant: no admin story override). Admins manage feature scopes and see operational metadata (counts, states, durations), never audio or transcript content through any admin surface. Break-glass access does not exist in Phase 1; if an incident ever requires content access, that is a founder decision with a new release [RECOMMENDED, keeps the trust promise].
- WordPress role, frontend state, or possession of an object name is never sufficient: every access decision is made by the trusted backend against account and StoryForge-record ownership [founder instruction; matches existing architecture].

## 7. Retention, deletion, and the copy that must match [GATE]

The prototype (inheriting canonical V5 copy) says "Original audio · preserved forever." That phrase must not silently become policy.

Recommended launch-safe policy [RECOMMENDED]:
1. Original audio is retained by default after transcription: it is the authentic original telling, consistent with the product's preserved-original ethos.
2. Retention is student-controlled: the student may delete a story's audio at any time while keeping the transcript (the story remains a normal text story; `capture_type` stays audio for history, the asset moves to `retired` and its object is deleted).
3. Deleting a story deletes its audio: story deletion retires and deletes all associated assets and any residual segments.
4. Mentors can play audio only per Section 6. Administrators cannot play audio at all.
5. Retention duration: life of the account while the story exists. Account closure: audio objects deleted within 30 days; transcripts follow the account-data decision of the closure process.
6. Cohort-access revocation (student leaves 360): nothing is deleted; the student keeps their stories, transcripts, and audio; only the ability to record new audio ends (Blueprint Section 8).
7. Cancelled recordings and abandoned sessions: segments hard-deleted immediately on cancel, within 24 h on abandonment; failed uploads swept the same way; every deletion writes an audit event (metadata only).
8. No legal-hold mechanism is created in Phase 1; none is known to be required [CODEX: flag to the founder if any contractual or institutional requirement surfaces during implementation].

Exact founder decision required [GATE]: approve or amend points 1, 2, 5, and the copy change below. Everything else is operational hygiene that follows from them.

Replacement product copy (already produced as the locked r2 artifact, hash in the Authority Lock):
- Audio card label: "Original audio · kept with your story" with subtext "heard by your mentor only when you submit · delete anytime".
- Library chip tooltip: "Original audio kept with this story · m:ss".
The subtext names mentor audibility on submission deliberately: an earlier "private to you" draft was rejected in fresh-context verification because it contradicted the Section 6 access model. The visible promise now matches the actual behavior exactly, which is what gate G7 enforces.
Policy-required surfaces (delete-audio control and the first-recording consent notice) have fixed placement, strings, and behavior in the Authority Lock's bounded design delegation; Codex implements those exact strings and may not invent alternatives.

Codex deployment rule [CODEX]: the release that exposes audio playback to the cohort must ship copy and policy that agree. If the founder approves the recommended policy, ship the r2 copy. If the founder instead chooses permanent retention with no student deletion, ship the original copy and remove the delete-audio control. A mismatch between visible promise and actual behavior is a release blocker (gate G7 in the Acceptance doc).

Consent and disclosure [RECOMMENDED, Phase 1 copy]:
- First recording use per account shows a one-time inline notice (not a modal wall): recording uses the microphone; the transcript and audio are stored privately to the account; audio can be deleted anytime (policy-dependent phrasing); avoid patient-identifying details when telling clinical stories. This last sentence matters: applicants tell clinical stories, and a gentle reminder to omit patient identifiers is data minimization at the source.
- Microphone permission itself is requested only on explicit user action (tap to speak), never on page load [AUTHORITY].

Regulatory posture: no HIPAA, FERPA, or other compliance claim is made or implied anywhere in product copy, marketing, or documentation unless independently established later; the design applies privacy-by-design and data minimization (opaque keys, private buckets, short-lived signatures, no content in logs, student-controlled deletion) [founder instruction].

Provider-side data handling [CODEX, mandatory before cohort activation]: audio leaves MissionMed for transcription, so the provider's data posture is part of the privacy design, not a footnote. Codex captures, as evidence at run time from the provider's current official policy pages: whether API audio/text is used for model training (OpenAI's stated API default is no training use), the stated retention window for API inputs, and whether zero-data-retention or a BAA applies or is worth requesting for this workload; files the citations; and reflects the truth in the consent notice, which already discloses "processed by MissionMed's transcription service" without naming vendors. If the provider's stated posture materially conflicts with the retention policy the founder approved, stop and report rather than shipping a contradiction.

## 8. Incident response and provider outage

- R2 outage or persistent upload failure: recording degrades truthfully (Blueprint Section 5: buffer, then auto-pause with honest message); typing is never affected; transcript text already merged remains in the durable draft.
- Transcription provider outage: adapter fails over primary to fallback once; if both fail, the dock shows the truthful "unable to transcribe right now" state, audio segments keep uploading (they can be transcribed by a later retry action), and the student can keep talking or switch to typing. A `retry transcription` action exists in review.
- Credential compromise suspicion: rotate the scoped R2 token and the StoryForge OpenAI key (both independent of other MissionMed systems by construction), invalidate nothing student-facing (signed URLs expire within minutes anyway), audit-log the rotation.
- Backup expectations: the PostgreSQL database (which holds transcripts and all metadata) is covered by the existing B1-503 backup discipline; R2 audio objects are single-copy by default. Recommended and sufficient for launch: rely on R2 durability for audio, document that story text/transcripts (the application-critical content) are database-backed, and revisit audio replication only if the founder later declares audio irreplaceable [RECOMMENDED; note this explicitly in the founder gate email so the trade-off is a conscious one].
- Monitoring: storage growth, egress, request errors, and cost from Cloudflare metrics monthly; thresholds in the Acceptance doc.

## 9. Codex verification checklist for this document

1. V-1/V-2 ladder proofs (Blueprint Section 1) before any storage change.
2. Bucket enumeration evidence; creation receipts; public-access-off proof (attempt anonymous GET on a test object and record the denial).
3. CORS proof from the exact production origin and denial from a foreign origin.
4. Signed-URL expiry proof (access at TTL+60 s fails).
5. Cross-student denial: student B replays student A's asset UUID and object key against playback; both fail with authorization errors, and the attempt is audit-logged.
6. Deletion proofs: student deletes audio (object gone, transcript intact); story deletion cascades; cancel and abandonment sweeps remove segments; all with object-level HEAD evidence.
7. Copy/policy agreement screenshot pair (gate G7 input).
