# B1-513 Architecture Decisions Spine (internal working doc — canonical decisions all satellite docs must agree with)

## D1 — Multi-version model (zero-copy adoption)
- One canonical story row remains authoritative. `stories.text` (the accepted Working Version) IS the Full Story version. No data migration of existing text; the section config key stays `workingVersion`, its published label becomes "Full Story".
- Original Telling stays exactly the existing immutable original (revisions[0] / original_text path). It is provenance-protected: no rename away from meaning, no hide, no edit, server-enforced.
- NEW versions live in additive table `sf_story_versions` (story_id, version_key ∈ {thirty_second, nnq_setup}, body, source typed|voice, created_at, updated_at, row_version, UNIQUE(story_id, version_key)). Per-version snapshots in append-only `sf_story_version_revisions` (id, version_id, body, source, saved_at, actor). Recording provenance: nullable recording_id/audio_asset_id columns referencing the existing recording domain (reused, not duplicated).
- Version registry is configuration, not schema: `versions` array in the published Content & Display payload (key, label, helper, target, sortOrder, state active|hidden|retired). full_story cannot be hidden; original is not in the registry (protected, always first).
- Append = save with concatenated body (client-side compose, server saves whole body + snapshot). Retell = explicit confirm; prior body becomes a revision (recovery guaranteed). Restore = revision body becomes current, current becomes a revision (nothing lost, append-only).
- Student experience: 4 tabs on the existing `.voiceTabs` strip; "One story · N of 4 tellings" strip; per-version history behind a single "Show earlier tellings" expander. No branches, no diffs, no Git vocabulary.
- Voice per version: REUSE the existing recorder pipeline (`/api/recordings` sessions, segment upload, transcription, IndexedDB durability) with a new bounded sink target (version editor instead of #capBody), and recording provenance recorded on the version revision. No second audio system.
- Deletion/retention: version revisions are append-only, bounded by a retention cap (keep all ≤ 50 per version, then oldest-compaction with audit). Story archive semantics unchanged.
- NNQ = "Next Natural Questions" (exact production Interview Prep terminology, app.js 5462: "Your answer creates the interviewer's next question."). NNQ Setup guidance: end the telling so the interviewer's next question is one you have prepared.

## D2 — Visibility & consent
- New nullable `stories.visibility` ∈ {mentor_visible, private} + `visibility_changed_at`; NULL means pre-Stage-2 semantics (= private w.r.t. observation; review path unchanged). VISIBILITY (who may observe) is orthogonal to WORKFLOW STATUS (review request lifecycle: private→awaiting→in_review→changes/reviewed/approved).
- Consent: `sf_mentorship_consent` (user_id, policy_version, decision accept|defer, decided_at, audit receipt id). Affirmative checkbox + explicit button; policy versioned; receipt surfaced to student; re-readable in Settings → Mentorship & privacy. Refusal ("Not now") = durable no-op: everything stays private, re-prompt at most once per session boundary and always available in Settings, never a dark pattern, never blocks the product.
- Post-consent default for NEW stories: mentor_visible. HISTORICAL stories: never silently converted — remain private until the student changes each story (or uses an explicit, optional bulk opt-in later; bulk tool is R-later, not R1).
- Submitted (awaiting→) stories are necessarily reviewer-observable; UI requires withdraw before making a submitted story private (matches existing "Return to Private").
- Mentor/admin observation of mentor_visible unsubmitted stories: read-only guidance surface (no status writes to unsubmitted stories except feedback? NO — review writes remain submitted-only; mentor-visible unsubmitted work is observable + notes allowed, statuses/suitability remain submission-gated).
- Founder playback of mentor-visible student audio: same short-lived signed URL path as today's owner/reviewer playback, extended by RLS to authorized mentor over mentor_visible or submitted stories only. No public URLs, no cross-student access, no unrelated mentor access.
- Every visibility change is audited (existing append-only audit events + story history line).

## D3 — Inspiration
- A student destination (`inspiration` route) that is an ENTRY POINT into the canonical Library. Answers promote via the EXISTING story creation path with `origin` provenance {type: inspiration, prompt_id, prompt_text snapshot}. No parallel story store.
- Data: `sf_inspiration_prompts` (stable id, text, who[], who_detail[], domain[], energy[], territory, follow_up, interview_use, state active|retired, sort_order, row_version — admin-governed, versioned, audited); `sf_inspiration_saved` (user_id, prompt_id, prompt_text snapshot, draft, saved_at) for save-for-later + sparks; `sf_inspiration_events` (content-free usage events for analytics: shown/answered/skipped/promoted).
- Wizard: WHO (You/Family/Someone Else) → relationship progressive disclosure (2 primary + "More…") → DOMAIN (Personal/Academic/Medical & Clinical) → ENERGY (Serious & Meaningful / Fun & Lighthearted / Emotional & Moving) → ONE question at a time. ≤3 primary choices per step. Actions: Answer (type/voice), Skip, Give me another, Save for later, This sparked another story. Agency: skip/stop/lighter-questions always available; no trauma pressure; no psychology claims.
- Prompt selection: server-side scoring on dimension match, excluding seen ids per session; deterministic + auditable.
- 81 MissionMed-original prompts synthesized from 21-source research (StoryCorps/oral history methods, narrative medicine, McAdams life-story interviewing, cue-word autobiographical memory research, episodic specificity induction, behavioral interviewing) — adapted principles, no copied banks.

## D4 — Founder/Admin operating console
- Student Directory: new bounded endpoint over the canonical LearnDash entitlement (`/api/admin/console/directory`) listing ALL trusted, verified, active eligible students, including zero-activity. No new WordPress role. Per-student: entitlement/provisioning state, last meaningful activity, story COUNTS by state and visibility (private = counts only, never titles/content), last review, last Review Check, meaningful warnings.
- Profile drawer: Overview / Activity / Stories (mentor_visible + submitted only; private = count line) / Reviews / Notifications / Account. Navigation Students → Student → Story → Review → back preserves context (drawer + existing student route).
- Review UX: five clickable stars (mentor score, visually distinct from student priority), segmented status pills, suitability chips (PS only / Interview only / Both / Neither), taxonomy chips — all direct, immediate-save, optimistic-version-checked, audited, keyboard + SR accessible, no page flash, failure rollback. Every review surface shows the owning student (identity strip).
- Review Check: preview → explicit send → audited receipt → StoryForge-owned notification (existing sf notifications domain) with truthful content branched on actual state (nothing submitted / submitted awaiting / reviewed), timestamped, read/dismiss state, per-student history, 24h dedupe/rate protection, delivery status to Founder.
- Mentor notes: REUSE B1-511 mentor-note voice/transcription architecture untouched.

## D5 — Activity analytics
- Truthful-boundary rule: never fabricate history; every metric carries `available_from` = tracking activation timestamp; UI renders "Available from [date]" / "Not available before activity tracking was enabled."
- ACTIVE-TIME model: session = foreground + bounded interaction heartbeat (60s beat while document.visibilityState==='visible' AND input/scroll/keys observed in last 120s idle threshold); session closes after 30 min gap; resume opens new session. Stored aggregated per session (started_at, last_beat_at, active_ms, coarse surface). NOT captured: keystrokes content, clipboard, other tabs/sites, screenshots, any content payloads.
- Metrics: last meaningful activity, session count/dates, active time per session/avg/total, stories opened/created/advanced, submissions, reviews opened, version usage, Inspiration usage — all as counters/aggregates (`sf_activity_sessions`, `sf_activity_counters`), content-free.

## D6 — Admin configuration
- Version labels/helpers/targets/order/visibility + Inspiration dimensions/questions/helper copy/ordering/active-retired state managed through the EXISTING Content & Display machinery (versioned payload, validate → browser-only preview → publish with optimistic version, restore defaults, append-only audit, force-off kill switch). Inspiration prompt bank is its own versioned configuration domain (`sf_inspiration_prompts` + config version) surfaced in Release Controls. No source-code editing.

## D7 — Feature flags & release train
Flags (DB flag + independent env kill switch each, default off): `visibility_consent`, `admin_directory`, `activity_tracking`, `review_check`, `admin_review_controls` (direct-control UI), `story_versions`, `inspiration`, `inspiration_admin`.
- R1 — Mentorship foundation + Founder ops: visibility/consent, admin directory, activity foundation, direct review controls, Review Check. (Consent must precede versions/Inspiration because both create/expand mentor-observable work; directory/activity give immediate Founder value; all additive.)
- R2 — Multi-version story composition (story_versions + version admin config).
- R3 — Inspiration MVP (student wizard + promotion + save-for-later; prompt bank seeded).
- R4 — Inspiration administration depth + analytics refinement (admin content manager UI beyond seed, richer analytics views, optional bulk visibility opt-in tool if Founder wants it).
Each release: standalone value, bounded scope, independently disable/rollback, production-shaped tests, Founder-first canary (brinyu) → one consenting student → eligible_all, exact acceptance gates, previous releases preserved.

## D8 — Authorization / RLS
- All new tables: RLS + FORCE RLS, owner-scoped student policies, bounded SECURITY DEFINER admin functions (existing pattern), append-only audit. Negative tests: cross-student direct-ID 404/P0002 on versions/saved prompts/activity; private stories absent from directory story lists AND direct admin story reads; anonymous 401; ineligible 403; students cannot call admin endpoints (403); mentor cannot read private or another mentor's students.
- Story Media: activation-deferred domain untouched; Stage 2 references media at the canonical story level only (versions do NOT duplicate media). No new media architecture.

## D9 — Platform Summit observations (document only, not build)
Consent/receipt pattern, notification service, activity heartbeat, entitlement directory, config-registry pattern are platform-shaped; StoryForge implements bounded local versions and records the generalization opportunity for Platform v1.

## D10 — Codex model strategy
GPT-5.6 Sol High: version engine + migration, visibility/consent transition, RLS policies, Inspiration selection logic, shared Story Room state, hard defects. Terra High: frozen deployments, backups/receipts, canary scripts, cutover verification, screenshot/evidence chores, straightforward CRUD admin panels.

## D11 — Interview Prep
Remains hidden by reversible configuration; NOT merged into Inspiration; NNQ terminology reused for the NNQ Setup Version guidance; the question-pairing workshop stays archived for a possible later Inspiration/Prep bridge (documented, not built).
