# B1-513 Data Model and Migration Plan

All schema is additive. No existing table is rewritten; no existing row is mutated by any Stage 2 migration. Every migration follows the guarded-runner pattern proven in B1-511/B1-512 (exact target preflight, locked backup receipt, single transaction, ledger row, independent post-state check, forward-safe disable).

## 1. New objects by release

### R1 — `20260810*_b1_513_r1_visibility_consent_ops.sql`
| Object | Kind | Notes |
|---|---|---|
| `sf_stories.visibility` (nullable) + `visibility_changed_at` | ALTER ADD COLUMN | NULL = legacy/private-for-observation; **no backfill UPDATE** |
| `sf_mentorship_consent` | table, append-only | user_id, policy_version, decision, decided_at, audit_event_id |
| `sf_review_checks` | table, append-only | student_id, sent_by, sent_at, body_snapshot, delivery_state; feeds existing notifications |
| `sf_activity_sessions` | table | user_id, started_at, last_beat_at, active_ms, coarse_surface; aggregates only |
| `sf_activity_counters` | table | user_id, counter_key, count, first_recorded_at, updated_at |
| `sf_activity_config` | 1-row | activation timestamp = the truthful `available_from` boundary |
| Bounded functions | SECURITY DEFINER | `sf_admin_directory()`, `sf_admin_directory_student(id)`, `sf_record_review_check(...)`, `sf_set_story_visibility(...)`, `sf_record_consent(...)`, heartbeat upsert |
| Flags | rows | `visibility_consent`, `admin_directory`, `activity_tracking`, `review_check`, `admin_review_controls` — all `off` |

Directory data source: the existing canonical LearnDash-entitlement bridge that already provisions StoryForge users — the directory function reads the provisioned-eligible population and joins story/activity aggregates. No WordPress schema or role is touched; entitlement remains WordPress/LearnDash-authoritative, read through the existing sync surface.

### R2 — `20260817*_b1_513_r2_story_versions.sql`
`sf_story_versions`, `sf_story_version_revisions` (shapes in doc 03), their RLS/FORCE RLS, owner policies, reviewer read via `observable()` predicate, version mutation/restore functions, audit action labels, flag `story_versions=off`, and the `versions` registry added to the Content & Display payload schema with defaults matching current labels ("Full Story" label change publishes with R2; before Founder publishes it, the section keeps its current "Working version" title — the label flip itself is a Content & Display publish, reversible in one click).

### R3 — `20260824*_b1_513_r3_inspiration.sql`
`sf_inspiration_prompts` (+ seed of the 81 approved prompts with stable IDs), `sf_inspiration_saved`, `sf_inspiration_events`, selection function, `sf_stories.origin` (nullable jsonb: `{type, prompt_id, prompt_text}` — additive column, no backfill), flags `inspiration=off`, `inspiration_admin=off`.

### R4 — no schema by default
Admin content-manager depth, analytics views, optional bulk visibility opt-in tool (needs FD-4 approval; if approved, still no schema — it writes per-story visibility through the R1 function).

## 2. RLS summary (full matrix in doc 11)
Every new table: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`. Students: owner-only CRUD where applicable (versions, saved prompts), insert-only where append-only (consent), none where admin-domain (review checks, directory). Reviewer/admin access exclusively via bounded SECURITY DEFINER functions that re-check the signed actor, the admin_console capability, and `observable()`.

## 3. Compatibility and historical data
- Legacy stories: `visibility NULL`, `origin NULL` — both read paths are COALESCE-total; zero behavioral change until a student acts.
- Analytics: no historical rows exist, and none are synthesized. `sf_activity_config.activated_at` is written once at R1 activation; every analytics read is gated on it.
- Existing revisions/audio/mentor-notes/media schemas: untouched. Version provenance references recordings by ID without new constraints on the recording domain.
- Serialization: all new API payload keys are additive; the production renderer ignores unknown keys (verified: `normalizeStory` spreads and preserves unknowns).

## 4. Rollback per release
Uniform order, matching B1-512 practice: (1) flip the release's DB flags off + set its env kill switch; (2) restore prior immutable Kinsta pointer + prior Railway deployment if the frontend must revert; (3) leave additive schema dormant — **never destructively drop student data during emergency rollback**; (4) verify Founder/eligible/ineligible/anonymous smoke + Critical Systems zero-fail + zero 5xx. Each migration ships with a rehearsed `*_rollback.sql` that drops only-empty objects (guarded: refuses if rows exist) for the pre-activation window, and a documented forward-safe disable for the post-activation window.

## 5. Migration verification checklist (each release)
Apply → post-state ledger count; row-count invariants on `sf_users`/`sf_stories` (unchanged); `pg_dump --schema-only` diff = additive lines only; RLS enabled/forced on every new table (information_schema assertion test); apply→rollback→reapply on ephemeral PG; restore rehearsal from the fresh locked backup; negative-access suite green; existing 295-unit/130-acceptance/72-conformance suites green.
