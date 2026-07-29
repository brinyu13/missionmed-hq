# B1-504B · Feature Flag and Rollout Authority

Labels per the Infrastructure Authority Lock.

## 1. Storage and keys (AA)

- Source of truth: `public.sf_feature_flags` (M2), single row `key='voice_capture'`.
- Allowed `scope` values and meaning (AMENDED, superseding the earlier `founder` scope value everywhere in B1-504A/B):
  `off` (nobody) · `allowlist` (UUIDs in `allowlist[]`; the founder-only stage IS scope `allowlist` containing exactly the founder's pilot `sf_users` UUID, which removes any out-of-band founder-identity constant) · `cohort` (JWT `cohort` claim matches an entry in `cohorts[]`; empty-string cohort NEVER grants, and E11 rejects `''` as a cohort value) · `eligible_all` (every `storyforge_eligible` user; reserved post-beta, own founder ruling).
- Valid cohort values at runtime: env `STORYFORGE_VALID_COHORTS` (comma-separated), set at deploy from the quoted B1-505 extract; E11 validates against it; unknown or empty strings rejected.
- Environment override (kill switch): `STORYFORGE_VOICE_FORCE_OFF=1` on the Railway service. PRECEDENCE, binding: env kill > DB scope > everything. There is no env "force on".
- Default state: `off` (seeded by M2).

## 2. Enforcement (AA)

- Backend: every voice endpoint (E1..E6, plus the subordinated legacy `POST /api/audio/presign` and `POST /api/audio/:id/confirm`; E12 is DECIDED OUT: heartbeat is folded into E3 polling, which updates `last_activity_at`, and no separate endpoint ships) evaluates: env kill, then scope against the verified identity (`sub`, `cohort` claim surfaced by the one-line auth.mjs change; empty cohort never grants). Deny = 403 `voice_disabled`, audited. E8 delete and E9 playback are OUTSIDE the flag (ownership/policy gated only) so saved audio keeps playing and delete-anytime stays true across rollback and revocation (carried rule).
- Grace: sessions already in `recording`/`finishing` when scope changes may finish for up to 10 minutes (E2/E4 honor them; E1 refuses new sessions immediately). Env kill refuses everything immediately; the client degrades truthfully and the draft keeps all text.
- Frontend: `capabilities.voiceCapture` from E10 controls rendering only; never authorization.
- Cache: capability is computed per request from the DB row (single-row read, negligible); a 30 s in-process cache is permitted with explicit invalidation on E11 writes; the env kill is read per request, never cached.
- Phase 2/3 impossibility: no flag key for student-facing intelligence exists; `sf_ai_suggestions` remains governed by the pre-existing `STORYFORGE_AI_*` env flags (V5 scope, default off, untouched); the Phase 1 flag gates capture/upload/transcription ONLY. Creating any new AI flag key is outside this authority.

## 3. Administration and audit (AA)

- Admin surface: E11 (`GET /api/admin/features`, `POST /api/admin/features/voice_capture`) + E13 health; admin = verified `app_role='admin'`. TWO-ACCOUNT RULE (binding, resolving the single-account role conflict): the founder's existing pilot account KEEPS its `student` override and is the subject of the allowlist founder stage and the A2..A22 student-flow validation; a SEPARATE founder-controlled WordPress account receives the `admin` override (R-8 settings change, backup-first, at S12) and operates E11/E13 only. app_role is single-valued; one account cannot be both the student tester and the admin, and admins deliberately have no content access. The admin-account addition grants no student any access and is exempt from the B1-505 stop scope.
- Every flag mutation writes `sf_audit_events` (actor, prior scope, new scope, lists changed) in the same transaction. E11 validates cohort values against the B1-505 authority file quoted in evidence; unknown cohort strings are rejected.
- The prototype Release Controls panel is the interaction authority for this surface (PA); the panel renders in Mentor/admin Settings only and displays the audit tail.

## 4. Rollout order (binding; gates in the Deployment Runbook)

`off` (build, dormant deploy, regression) -> `allowlist` = founder pilot UUID only (S12/S13: full device matrix + bake-off cutover) -> `allowlist` + designated test students (S14, abbreviated matrix) -> `cohort` with exact B1-505 values (S18 narrow pilot, then S20 full 360; both under FG-2, after the retention/copy gate G7) -> observation windows -> `eligible_all` only under a separate founder ruling (not part of Phase 1 activation).
Rollback behavior: scope `off` at any moment = typing-only product (plus the enumerated nav-fix delta), all saved content intact, playback and deletion intact; env kill for emergencies; neither touches data. Deactivation of a student (loses 360 eligibility): token mint stops WP-side (the token simply is not issued), so the API never sees them; stored stories, transcripts, and audio remain intact and reachable if eligibility returns. Deletion-rights continuity: the Infrastructure Lock Section 6 carries an FG-1 PROPOSED 30-day wind-down (WP entitlement retained for the window so playback and deletion keep working, with voice recording already excluded via flag scope); until the founder rules it, immediate token stop is the operative behavior and post-deactivation deletion happens through the account-level support process.
