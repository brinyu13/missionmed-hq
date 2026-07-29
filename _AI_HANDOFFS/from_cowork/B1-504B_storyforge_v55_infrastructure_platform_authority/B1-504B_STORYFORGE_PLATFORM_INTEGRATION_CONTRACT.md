# B1-504B · StoryForge Platform Integration Contract

Labels per the Infrastructure Authority Lock. This contract makes StoryForge the canonical MissionMed story system of record with plug-and-play seams, WITHOUT building downstream consumers now and WITHOUT inventing an event platform.

## 1. Canonical ownership (AA)

StoryForge owns, authoritatively: story; original telling (`sf_story_originals`, immutable); working versions (`sf_story_revisions` + current text on `sf_stories`); approved/reviewed state (`sf_stories.status` + `sf_feedback`); lesson; themes/classifications (themes, birds, positions); use designations (`uses`); interview-question mappings (`sf_story_questions`); preferred mappings (`sf_question_preferences`); follow-up questions (`sf_pair_followups`); mentor reviews, scores, coaching notes; student scores and reflections; audio assets and recording sessions; audit events for all of the above. (All tables VST.)
File Vault owns general student files and binary documents; StoryForge audio is NOT File Vault's domain. Attachment relationships between a story and a File Vault document are OWNED BY STORYFORGE as reference rows (durable IDs both sides), with file bytes, file permissions, and file lifecycle staying in File Vault. Neither system copies the other's record.
Forbidden for every consumer (Matrix, Arena, IV Prep On-Call, File Vault, LOR Studio, Timeline Builder, future apps): reading StoryForge tables; scraping StoryForge UI; storing authoritative copies of story content; re-implementing StoryForge authorization; receiving fields outside the approved read model for the stated purpose.

## 2. Stable identity (AA)

All IDs are server-generated UUIDs, immutable, never reused, tenancy-scoped by ownership rows, already present in the schema (VST): student/mentor = `sf_users.id`; story = `sf_stories.id`; version = `sf_story_revisions.id` (plus the reserved words `original` and `current` as version selectors); audio asset = `sf_audio_assets.id`; recording session = `sf_recording_sessions.id`; question = `sf_questions.id`; story-question pair = `sf_story_questions.id`; preferred mapping = `sf_question_preferences.id`; follow-up = `sf_pair_followups.id`; review/feedback = `sf_feedback.id`; audit = `sf_audit_events.id`. New in this contract: attachment relationship ID (Section 6) and consumer ID (Section 4).
Archive/delete/tombstone: deleted stories resolve on every platform endpoint to `410 {code:'story_deleted', id}` (tombstone by response, no tombstone table; the 410 derivation mechanism is bound by the DB spec's story-deletion decision table); archived stories resolve with `status:'archived'` in summaries; deleted audio resolves to `audio: null` with `audioDeleted: true`. Titles, URLs, display names, mutable text, and array positions are never identity.
Version resolution: `GET .../stories/{id}/versions/current` returns the working text and its `versionId`; consumers that stored a `versionId` can detect staleness via the summary's `currentVersionId`.

## 3. Read models (AA; exact field sets)

Every model includes: `storyId`, `currentVersionId`, `updatedAt`, `status`, `schemaVersion:1`. Exclusions are as binding as inclusions.

- `StorySummary`: + `title`, `lesson`, `themes[]`, `uses[]`, `questionMappings[{questionId, confirmed, mentorStrength}]`, `preferredForQuestionIds[]`, `mentorScore`, `studentScore`, `hasAudio`, `audioDurationMs`. EXCLUDES: any story text, mentor comments, reflections, audio access.
- `StoryInterviewContext`: + `title`, `workingText` (current version), `lesson`, for a GIVEN question: `pairStrengths {student, mentor}`, `confirmed`, `preferred`, approved `followUps[{id, text, source, prepared}]`, `coachingNotesForStudent` ONLY where the house model already exposes them to the student (coaching notes are student-visible in V5, VST). EXCLUDES: mentor-only drafts, other students' anything, audio (separate grant).
- `StoryApplicationContext`: + `title`, `workingText`, `originalTelling` (the student's own authentic original), `lesson`, `themes[]`, `uses[]`, `reflections[{q, a}]` (student-authored). EXCLUDES: mentor comments and scores UNLESS `includeMentor=true` AND the purpose grant allows mentor-visible material; then `mentorScore` and mentor feedback text ONLY for submitted stories.
- `StoryMentorContext` (mentor-facing consumers only): + everything a mentor sees in StoryForge for an ASSIGNED student's SUBMITTED story: `workingText`, `originalTelling`, `lesson`, feedback thread, scores, craft ratings, question work. EXCLUDES: private stories (absolutely), recording sessions, drafts.
- `StoryAttachmentContext`: + `attachments[{attachmentId, fileVaultFileId, label, linkedAt}]`. EXCLUDES: file bytes, File Vault permissions (consumers resolve the file through File Vault under ITS authorization).
- `StoryTimelineReference`: `storyId`, `title`, `status`, `themes[]`, `updatedAt` only.
- `StoryChangeEnvelope`: `cursor`, `changes[{seq, at, type, storyId, actorRole}]`. EXCLUDES: all content, all names, all text (privacy-safe by construction; consumers must fetch through an authorized read model).
Audio never appears in any model; audio access is only the explicit playback grant (Section 5 endpoint 12). Mentor comments never reach a student-facing consumer without the explicit mentor-visible grant. Private stories appear ONLY in self-purpose calls by their owner (Section 6 matrix).

## 4. Service-to-service authorization (AA)

Phase 1 production posture (binding, closes the confused-deputy exposure): `STORYFORGE_PLATFORM_OFF=1` is FORCED ON in production for all of Phase 1; the `contract-test` consumer is registered ONLY in CI and the controlled environment, NEVER in production; runbook step S22 verifies both. The platform API therefore ships as tested, dormant code with zero production attack surface.
Consumer registry (Phase 1): env `STORYFORGE_PLATFORM_CONSUMERS` on the API service, JSON array of `{consumerId, sharedSecret(>=32 chars), secretPrev?, allowedPurposes[], allowedModels[], allowedSubjects?}`. `secretPrev` enables dual-secret rotation with overlap. A DB-backed registry is deliberately deferred until the first real consumer ships (anti-invention). No consumer entries exist in production in Phase 1.
Service token: HS256 JWT signed with the consumer's shared secret. Claims (all required): `iss` = consumerId, `aud` = `storyforge-platform`, `sub` = end-user StoryForge UUID, `act_role` = `student|mentor`, `purpose` (one of the seven), `jti` (UUID), `iat`, `exp` (<= 120 s). Replay: jti cache per consumer sized >= rate-limit x TTL (restart gap accepted and documented). Verification mirrors house auth (jose, pinned aud/iss-from-registry).
END-USER PROOF PRECONDITION (binding; a REQUIRED amendment before ANY real consumer is registered): the consumer token alone never establishes the end-user. Version 1.1 of this contract must require the end-user's own StoryForge-audience JWT (or an equivalent StoryForge-verified delegation token) to accompany the consumer token, with `sub` derived from the VERIFIED user token, not from the consumer's assertion; per-consumer `allowedSubjects` scoping is the interim containment for any single-tenant consumer. Until that amendment is ruled by Fable and, where private-story exposure changes, by the founder, registering any real consumer is FORBIDDEN. This precondition exists because a shared-secret-only model would let one leaked secret read any student's self-purpose content; the package does not accept that risk.
Authorization decision per request answers exactly: which application (iss), which end-user (sub + act_role), which student's data (derived server-side: sub itself for students; assignment-checked for mentors via `sf_mentor_assignments`), what purpose, which resource, which read model (must be in `allowedModels` AND compatible with purpose), what is returned/excluded (the model definition), what audit event (`platform_read` with consumerId, purpose, model, storyId, sub; no content). A MissionMed domain, an admin role, or network position grants nothing. Deny = 403 `consumer_not_authorized` / `purpose_not_allowed` / `model_not_allowed`, audited. Incident disablement: remove the consumer entry (env change) or flip `STORYFORGE_PLATFORM_OFF=1` (global platform-API kill, separate from the voice kill).

## 5. Versioned Platform API (AA; base `/platform/v1`; JSON; cursor pagination `?cursor=&limit<=100`; ETag on single resources; rate limit 60 req/min per consumer; every call audited)

Implemented and contract-tested IN PHASE 1 (dormant: no consumers registered):
1. `GET /platform/v1/students/{sub=self}/stories` -> `StorySummary[]` (filters: `status, theme, use, questionId, preferredOnly, updatedSince; sort=updatedAt`).
2. `GET /platform/v1/stories/{storyId}/summary` -> `StorySummary`.
3. `GET /platform/v1/stories/{storyId}/versions/current` -> `{versionId, workingText, updatedAt}`.
4. `GET /platform/v1/stories/{storyId}/interview-context?questionId=` -> `StoryInterviewContext`.
5. `GET /platform/v1/questions/{questionId}/preferred-story` -> `{storyId, versionId} | 404 no_preferred_mapping`.
6. `GET /platform/v1/changes?cursor=` -> `StoryChangeEnvelope` (Section 7). TENANCY-SCOPED: returns only changes for the verified `sub`'s own stories (student), or for submitted stories of assigned students (mentor `sub`); never an org-wide feed. A contract test proves a consumer cannot observe another user's storyIds in the feed.
7. `POST /platform/v1/use-checks` `{storyId, purpose}` -> `{allowed, reasons[]}` (the consent matrix, Section 6, as an API).
Defined in v1, implemented when the first consumer needs them (contract text is binding now; adding them later is additive, not a version bump):
8. `GET .../application-context`, 9. `GET .../mentor-context`, 10. `POST/DELETE .../attachments` (File Vault relationship), 11. `GET .../attachments`, 12. `POST /platform/v1/stories/{storyId}/audio-playback-grants` -> short-lived signed URL `{playbackUrl, expiresIn<=300}`: allowed ONLY for `sub` = story owner, OR an assigned mentor on a SUBMITTED story (the mentor branch mirrors E9 exactly, submitted-only; a mentor grant on a non-submitted story is a contract-test denial row); never student-facing third apps without a founder ruling, 13. search extensions (specialty relevance, rotation/institution, date, score filters), 14. `GET /platform/v1/stories/{storyId}/followups?questionId=`, 15. consumer self-descriptor `GET /platform/v1/whoami`.

Purpose-to-model matrix (binding, default deny; `allowedModels` can only narrow it, never widen):

| Purpose | Permitted models/endpoints | includeMentor material |
|---|---|---|
| interview_practice | StorySummary, StoryInterviewContext, preferred-story, followups, changes(self) | never |
| application_writing | StorySummary, StoryApplicationContext, changes(self) | only when `sub` = story owner AND story submitted (student sees their own mentor feedback, as in StoryForge itself) |
| mentor_coaching | StorySummary, StoryMentorContext, changes(assigned submitted) | yes, assignment-checked, submitted-only |
| timeline_reference | StoryTimelineReference only | never |
| attachment_link | StoryAttachmentContext + attachments CRUD | never |
| audio_playback | grant endpoint 12 only | n/a |
| change_sync | changes (tenancy-scoped) only | never |

Every disallowed (purpose, model) pair returns `model_not_allowed` and is contract-test asserted in both directions.
Errors: `401 invalid_consumer_token`, `403` codes above, `404 not_found` (never distinguishing "exists but private" from "absent" to unauthorized callers), `410 story_deleted`, `429 rate_limited`. Internal table shapes are never exposed; models are the wire truth.

## 6. Privacy, consent, and reuse matrix (AA; enforced by `use-checks` and every endpoint)

| Scenario | Ruling |
|---|---|
| Student's own PRIVATE story in another student-facing MissionMed tool | Allowed for purposes `interview_practice`, `application_writing`, `timeline_reference` with the student as `sub` (authenticated self-use allowed by default; the student is using their own words). FG-1-CONDITIONAL: this default is the recommended ruling inside the FG-1 sitting; the founder may narrow it before any consumer ships (zero consumers ship in Phase 1, so narrowing later costs nothing). UI in the consumer must show StoryForge as the source. |
| Story designated for interview use / application use | The designation (`uses[]`) is advisory metadata for ranking, not an access gate for self-use; it IS a gate for any future non-self exposure. |
| Mentor viewing via a consumer | `mentor_coaching` purpose + assignment check + submitted-only. Identical boundary to StoryForge itself. |
| IV Prep On-Call session hydration | Self purpose `interview_practice`; models 1/2/4/5/14; audio only via grant 12 for the student's own playback. |
| Arena mock interview | Self purpose `interview_practice`; same as above; Arena stores only its disposable session projection. |
| LOR Studio evidence | `application_writing` with `includeMentor=true` allowed ONLY for submitted stories; mentor-only notes never exported; bulk export endpoints do not exist. |
| Timeline Builder | `timeline_reference`; `StoryTimelineReference` only. |
| File Vault link | Purpose `attachment_link`; creates/removes the reference; no content flows. |
| Audio playback in another product | Grant 12 only; owner or authorized mentor; short TTL; audited. |
| Withdrawn use designation / archived story | Summaries reflect immediately; `use-checks` returns false for affected purposes; consumers must re-check on hydration (Section 7 TTL). |
| Deleted story / deleted audio | 410 / `audioDeleted:true`; consumers purge projections on next sync (and within the 24 h TTL at latest). |
| Expired or reassigned mentor / revoked consumer | Assignment checked per request (no caching of authorization); revoked consumer fails at token verification; cached data governed by the TTL rule below. |
Disposable-cache rule (binding for every consumer): projections derived from platform reads carry a maximum 24 h TTL, refresh via `changes` + re-fetch, MUST be purged on `story.access.revoked`-class changes and on 410, and are never re-shared onward. Consumers never become owners.
Student visibility and control: StoryForge Settings will list consumer access events per story (from `platform_read` audits) in a post-Phase-1 surface; recorded in the backlog, not built now (FG-free deferral; audits already capture everything needed).

## 7. Change propagation and hydration (AA; evidence-based minimal mechanism)

Mechanism decision: a CURSOR-BASED CHANGE FEED over existing data. No webhooks, no queue, no outbox table in Phase 1 (nothing in the verified stack runs a broker, and inventing one for zero consumers is forbidden by the anti-invention rule). Producer: the API computes the feed from `sf_audit_events` (append-only, in-transaction with every mutation, VST) filtered to platform-relevant actions, joined to row `updated_at` stamps; `cursor` = last consumed position (ordering defined below). Delivery: pull, at-least-once on cursor replay; ordering per story guaranteed by seq; dedup by (seq); no dead-letter (pull model); replay = reset cursor; retention = audit retention (indefinite in Phase 1).
Event types mapped from existing audited actions: `story.created`, `story.updated`, `story.version.created`, `story.submitted`, `story.review.started`, `story.reviewed`, `story.approved`, `story.use_designation.updated`, `story.question_mapping.updated`, `story.preferred_mapping.updated`, `story.audio.created`, `story.audio.deleted`, `story.attachment.linked`, `story.attachment.unlinked`, `story.archived`, `story.deleted`, `story.access.revoked` (emitted on mentor reassignment, which is audited; consumer revocation is NOT a feed event, because env-based deregistration writes no audit row: revoked consumers fail at token verification and their purge obligation is triggered by that 401 plus the 24 h TTL). Payload: the privacy-safe `StoryChangeEnvelope` entry only.
Feed ordering (binding): `seq` is NOT the audit UUID (UUIDs are not insertion-ordered); the feed orders by `(created_at, id)` on `sf_audit_events` and the cursor is the opaque composite token of that pair. RP-13 captures the actual PK/created_at shape; if the table carries a serial column, Fable may simplify the cursor in the amendment pass.
Hydration: initial full fetch via endpoint 1 with `updatedSince=0`; incremental via `changes` cursor; cache TTL 24 h max; stale marker required in consumer UIs older than TTL; source-unavailable = serve stale WITH marker, never fabricate; version conflict = re-fetch current and supersede; revoked = purge.
If a future consumer needs push latency, the upgrade is an outbox + delivery worker BEHIND the same envelope schema (schemaVersion bump only if fields change); that decision returns to Fable.

## 8. First-consumer contract examples (binding shapes)

A. IV PREP ON-CALL: token {iss:'ivprep', sub:studentUuid, act_role:'student', purpose:'interview_practice'}; flow: 5 (preferred for q4) -> 4 (interview context: working text, lesson, strengths, confirmed, prepared follow-ups) -> renders; withheld: mentor drafts, other stories' text, audio (unless grant 12 for self-playback); audit: `platform_read{ivprep, interview_practice, StoryInterviewContext, storyId, sub}`; freshness: `changes` cursor each session start.
B. ARENA: same purpose; hydrates preferred story + confirmed mapping + prepared follow-ups into a disposable season projection; mid-season change detected via `changes` (`story.preferred_mapping.updated`) -> re-fetch; TTL forces refresh within 24 h regardless.
C. FILE VAULT: purpose `attachment_link`; `POST .../attachments {fileVaultFileId, label}` creates the reference (StoryForge owns the link row; File Vault owns the file); deletion on either side emits `story.attachment.unlinked`; no bytes cross; permissions never merge.
D. LOR STUDIO: purpose `application_writing` + `includeMentor=true`; queries endpoint 1 with theme filters (leadership, resilience, teamwork, advocacy, specialty themes map to existing theme/classification values); receives `StoryApplicationContext` for SUBMITTED stories only when mentor material is requested; private stories flow only in pure self mode without mentor fields; no bulk export exists.
E. TIMELINE BUILDER: purpose `timeline_reference`; stores `{storyId}` against dated events; renders `StoryTimelineReference`; 410 handling removes the link with a user-visible note.

## 9. Forward compatibility (AA)

API/schema/event versioning: path version (`/platform/v1`), model `schemaVersion` field, envelope version; additive changes (new optional fields, new endpoints) never bump; breaking changes require `/platform/v2` with a 6-month overlap window and consumer sign-off; deprecation announced in the contract doc + `Sunset` headers. Contract tests: `tests/integration/platform-contract.test.mjs` runs the `contract-test` consumer against every implemented endpoint asserting exact field sets (inclusions AND exclusions) and every denial path; CI-gated from Phase 1 forward so the contracts cannot drift silently. Documentation ownership: this file is the contract of record; integration review: any new consumer requires a Fable-level review against Section 6 and a founder ruling where private-story exposure changes. Rollback compatibility: platform endpoints are additive and flag-killable (`STORYFORGE_PLATFORM_OFF`); migration compatibility: read models resolve entirely from retained tables, so voice rollback does not affect platform contracts.
Foundational acceptance test (binding): a new authorized application integrates through these documented, versioned, purpose-scoped contracts without reading tables, scraping UI, duplicating stories, recreating authorization, changing StoryForge code, or receiving out-of-purpose fields; the contract-test consumer proves each clause.
