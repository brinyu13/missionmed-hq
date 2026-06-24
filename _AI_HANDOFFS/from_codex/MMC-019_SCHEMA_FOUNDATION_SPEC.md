# MMC-019 Schema Foundation Spec

RESULT: COMPLETE

SUMMARY:
- VERIFIED: This is a schema foundation specification only. It creates no SQL, migrations, schemas, tables, credentials, APIs, deployments, or production writes.
- VERIFIED: The spec resolves the MMC-018/architecture conflict by using MMC-owned mentor-intelligence objects only and by rejecting duplicate student/profile/enrollment/Scheduler/Calendar/CRM/LearnDash ownership.
- VERIFIED: The spec uses `mmc.action_items`, not `mmc.student_tasks`, to avoid implying that MMC owns canonical student tasks outside the MMC coaching domain.

## Authority Stack

1. VERIFIED: Live production is canonical until proven otherwise.
2. VERIFIED: MMC-002/MMC-006/MMC-007/MMC-010A safety findings override optimistic architecture assumptions.
3. VERIFIED: MMC-014A private route security requires route-specific authorization and denial of students/logged-out users.
4. VERIFIED: MMC-017A prior reports prove a deployed private review baseline, but current live verification remains blocked from this sandbox.
5. VERIFIED: MMC-018 allows schema specification only; production migrations and writes remain blocked.
6. CONFLICT: Any schema plan using `service_role`, broad student/profile duplication, or hidden-write reads conflicts with MMC safety authority.

## Non-Negotiable Boundaries

- VERIFIED: MMC must not create a canonical students table.
- VERIFIED: MMC must not duplicate profiles, enrollments, CRM people, Scheduler appointments, Calendar events, LearnDash records, Messages, File Vault assets, Arena, Drills, R2 objects, Webex recordings, transcripts, or WordPress users/media.
- VERIFIED: MMC may own mentor intelligence, mentor workflow, coaching memory, coaching goals, action items, open loops, session artifacts, and audited access history.
- VERIFIED: External systems are referenced by provenance only; they are not mutated by MMC V1.
- VERIFIED: Every production implementation must use least-privilege access and deny-by-default RLS.

## Global Row Requirements

Every future `mmc.*` table should include the following logical controls unless explicitly impossible:

| Field / Control | Status | Purpose |
|---|---:|---|
| Stable internal UUID primary key | VERIFIED | Avoid coupling MMC row identity to external student/profile IDs. |
| `organization_scope` or equivalent tenant/program scope | LIKELY | Future-proof for multi-program separation. |
| `created_at`, `updated_at`, `archived_at`, `deleted_at` | VERIFIED | Lifecycle and soft-delete support. |
| `created_by_principal_id`, `updated_by_principal_id` | VERIFIED | Actor traceability. |
| `visibility` | VERIFIED | Separate mentor-private, mentor/admin, future student-visible, system-only. |
| `sensitivity` | VERIFIED | Protect private notes, sensitive context, risk/readiness intelligence, and photos. |
| `provenance` | VERIFIED | Trace whether row was manual, imported, derived, reviewed, or future external-reference-based. |
| `review_status` | VERIFIED | Prevent unreviewed generated intelligence from being treated as fact. |
| `source_refs` | VERIFIED | Reference source records without duplicating their data. |
| `audit_required` flag or audit trigger | VERIFIED | Ensure sensitive reads/writes/admin overrides are logged. |

## Required Tables

### `mmc.mentors`

- Purpose: Define MMC mentor principals after approved auth mapping.
- Owns: MMC mentor participation, role within MMC, status, display preferences.
- Does not own: WordPress users, staff HR records, student identity.
- Key fields:
  - `mentor_id`
  - `auth_source` such as `wordpress_hq_session`
  - `auth_subject_id`
  - `auth_subject_email_hash` or protected email reference
  - `display_name`
  - `role` such as `admin`, `mentor`, `operator`
  - `status`
  - `last_verified_at`
- Status: LIKELY future table, BLOCKED until auth principal mapping is approved.

### `mmc.mentor_assignments`

- Purpose: Define which verified external subject references a mentor may access in MMC.
- Owns: MMC authorization assignment for mentor intelligence.
- Does not own: Canonical student roster, CRM ownership, enrollment, Scheduler provider assignment.
- Key fields:
  - `assignment_id`
  - `mentor_id`
  - `subject_ref_id` or embedded verified subject reference
  - `assignment_scope`
  - `status`
  - `granted_by_principal_id`
  - `grant_reason`
  - `starts_at`, `ends_at`
  - `revoked_at`, `revoked_by_principal_id`
- Status: REQUIRED for production mentor-scoped access, BLOCKED until assignment authority is approved.

### `mmc.coaching_sessions`

- Purpose: Durable MMC-owned advising/coaching lifecycle independent of Scheduler/Calendar.
- Owns: MMC session prep, session command state, post-session capture, mentor review lifecycle.
- Does not own: Scheduler appointment, Calendar event, Webex meeting, transcript, recording.
- Key fields:
  - `session_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `session_status`
  - `scheduled_for_manual`
  - `started_at`, `ended_at`
  - `prep_summary`
  - `session_focus`
  - `post_session_summary`
  - `source_type` such as `manual_mmc`
- Status: VERIFIED core MMC-owned domain.

### `mmc.session_artifacts`

- Purpose: Store artifacts created during or after MMC coaching sessions.
- Owns: MMC-authored summaries, decisions, reviewed notes, session references.
- Does not own: Raw Webex recordings, transcripts, Drills artifacts, File Vault files.
- Key fields:
  - `artifact_id`
  - `session_id`
  - `mentor_id`
  - `subject_ref_id`
  - `artifact_type`
  - `visibility`
  - `content_body` or `content_pointer`
  - `review_status`
  - `source_refs`
- Status: VERIFIED core MMC-owned domain.

### `mmc.mentor_memory`

- Purpose: Store durable relationship memory and coaching context.
- Owns: Personal context, professional context, last advice, repeated topics, mentor-observed patterns.
- Does not own: Matrix Profile, CRM profile, official academic/application records.
- Key fields:
  - `memory_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `memory_type`
  - `memory_text`
  - `sensitivity`
  - `confidence`
  - `evidence_refs`
  - `last_confirmed_at`
- Status: VERIFIED core asset of MMC.

### `mmc.private_notes`

- Purpose: Store private mentor notes with strict visibility and audit.
- Owns: Mentor-private notes and sensitive coaching strategy.
- Does not own: Student-visible profile notes, Messages, CRM notes.
- Key fields:
  - `note_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `note_body`
  - `sensitivity`
  - `visibility = mentor_private`
  - `audit_required = true`
- Status: VERIFIED highest-sensitivity domain.

### `mmc.action_items`

- Purpose: Store MMC-created tasks, promises, follow-ups, deadlines, and commitment tracking.
- Owns: MMC action queue and coaching follow-through.
- Does not own: Command Center tasks, Calendar deadlines, Scheduler actions, LearnDash assignments.
- Why not `student_tasks`: `student_tasks` implies canonical student task ownership and conflicts with duplicated task sources identified in MMC-002/MMC-006.
- Key fields:
  - `action_item_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `owner_type` such as `mentor`, `student`, `shared`, `system`
  - `action_type` such as `task`, `promise`, `follow_up`, `deadline`
  - `title`
  - `details`
  - `due_at`
  - `status`
  - `closed_at`
  - `related_session_id`
  - `related_memory_id`
- Status: VERIFIED preferred table name and domain boundary.

### `mmc.goals`

- Purpose: Store MMC coaching goals and milestones.
- Owns: Mentor/student coaching goals, progress notes, target dates, readiness inputs.
- Does not own: LearnDash progress, official application status, CRM program enrollment.
- Key fields:
  - `goal_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `goal_type`
  - `title`
  - `target_date`
  - `status`
  - `progress_state`
  - `milestone_json`
  - `evidence_refs`
- Status: VERIFIED MMC-owned domain.

### `mmc.open_loops`

- Purpose: Track unresolved repeated issues, unfinished commitments, and repeated coaching themes.
- Owns: MMC-derived/open-loop intelligence.
- Does not own: External support tickets, CRM alerts, Messages.
- Key fields:
  - `open_loop_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `loop_type`
  - `summary`
  - `severity`
  - `status`
  - `evidence_refs`
  - `opened_at`
  - `closed_at`
  - `closed_by_principal_id`
- Status: LIKELY derived MMC-owned domain.

### `mmc.intelligence_snapshots`

- Purpose: Cache reviewed/recomputable briefing, risk, timeline, readiness, and next-best-move summaries.
- Owns: Derived MMC intelligence snapshots.
- Does not own: Underlying source facts or external records.
- Key fields:
  - `snapshot_id`
  - `mentor_id`
  - `assignment_id`
  - `subject_ref_id`
  - `snapshot_type`
  - `summary_json`
  - `confidence`
  - `evidence_refs`
  - `generated_at`
  - `reviewed_by_principal_id`
  - `expires_at`
- Status: LIKELY optional cache; must be recomputable and provenance-bound.

### `mmc.audit_events`

- Purpose: Record sensitive reads, writes, admin overrides, assignment changes, exports, and privacy-sensitive actions.
- Owns: MMC audit history.
- Does not own: Global production audit systems.
- Key fields:
  - `audit_event_id`
  - `actor_principal_id`
  - `actor_role`
  - `action`
  - `object_table`
  - `object_id`
  - `subject_ref_id`
  - `assignment_id`
  - `before_hash`
  - `after_hash`
  - `reason`
  - `request_id`
  - `created_at`
- Status: REQUIRED before production pilot.

## Optional Non-Authoritative Identity Reference Model

### `mmc.identity_references`

- Purpose: Provide a provenance-only external subject reference layer when deterministic identity proof exists.
- Owns: MMC reference to verified external anchors.
- Does not own: Student identity, student profile, enrollment, demographic record, or CRM person.
- Key fields:
  - `identity_ref_id`
  - `reference_status`
  - `primary_anchor_type`
  - `primary_anchor_value_hash` or protected anchor reference
  - `anchor_set_json`
  - `verification_method`
  - `verified_by_principal_id`
  - `verified_at`
  - `confidence`
  - `conflict_notes`
- Forbidden fields:
  - Full duplicate profile
  - Canonical student name as source-of-truth
  - Demographics copied from Profile/CRM
  - Enrollment state copied from LearnDash/CRM
  - Scheduler appointment details
- Status: OPTIONAL and BLOCKED until identity proof is approved.

## Explicit Rejections

- CONFLICT: `mmc.student_tasks` as a canonical task table name for V1.
- CONFLICT: `student_wp_user_id` as the only physical primary student anchor.
- CONFLICT: `service_role` access for MMC runtime reads.
- CONFLICT: Email-only or name-only identity matching.
- CONFLICT: RLS on non-`mmc.*` production tables created by MMC.
- CONFLICT: Any schema that makes MMC a replacement for Matrix Profile, Scheduler, Calendar, CRM, LearnDash, Messages, File Vault, Arena, Drills, Webex, R2, or WordPress.

## Schema Foundation Verdict

- READY: Draft a migration proposal in a separate explicit schema-build task.
- BLOCKED: Apply migrations anywhere until explicit approval.
- BLOCKED: Production writes until RLS tests, identity references, assignment authority, audit logging, backup/rollback, retention/privacy, and least-privilege credentials are verified.

