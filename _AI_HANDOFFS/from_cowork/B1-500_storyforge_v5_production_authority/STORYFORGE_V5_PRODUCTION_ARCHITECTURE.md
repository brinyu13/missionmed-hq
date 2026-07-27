# STORYFORGE_V5_PRODUCTION_ARCHITECTURE
B1-500 · Recommended production architecture. One recommendation per decision; unknowns are converted into Codex Phase 0 discovery items rather than presented as fact.

## 1. Evidence baseline — what is verified vs not

**Verified in this design environment (Fable, this run):** the complete behavior of `storyforge-v5.html` (authored and browser-tested here); the 16 prototype simulation mechanisms and their code anchors (see Product-to-Engineering Map §A); current first-party OpenAI/Codex guidance (citations in the Codex prompt).

**Supported by founder-supplied environment statements (historical evidence, not independently verified):** MissionMed runs WordPress and the Matrix hub; 360 eligibility originates in LearnDash or an equivalent source; Supabase with Row Level Security, Cloudflare services, and R2 storage exist in the MissionMed ecosystem; roles include student, mentor, staff, administrator; mentor–student assignments exist operationally.

**Not verified — Fable has no MissionMed repository or infrastructure access in this run:** repository layout and conventions, AGENTS.md presence, existing StoryForge code or schemas, existing migrations, API conventions, notification/email infrastructure, deployment pipelines and environments, monitoring, backup practice, whether any legacy StoryForge records exist, Supabase project topology, WP plugin architecture, SSO mechanics. **Every one of these is a mandatory Codex Phase 0 discovery item (§9).** Nothing below may be treated as a statement about current repository contents.

## 2. Placement and system ownership (the core decision)

**Recommendation:** StoryForge is a **standalone single-page application** served under the Matrix domain (e.g. `matrix.<missionmed-domain>/storyforge` or an `app.` subdomain path — exact URL is a Phase 0/founder item), visually and navigationally part of the Matrix ("Back to Matrix" is a real link), but with its own frontend build and its own data plane.

| Concern | Owner | Rationale |
|---|---|---|
| Identity, login, accounts | **WordPress** | It already owns MissionMed identity; students/mentors must not get a second login. |
| Eligibility (360 entitlement) + roles + mentor assignments | **WordPress (source of truth)**, synced into StoryForge Postgres as claims/records | LearnDash (or equivalent) already encodes who is a 360 student; mentors/admins are WP roles/capabilities. |
| StoryForge relational records (stories, versions, pairs, follow-ups, questions, notifications, audit, settings) | **Supabase Postgres** with **Row Level Security** as the authorization enforcement layer | Purpose-built relational model with DB-enforced privacy/immutability beats stuffing this into WP meta tables; consistent with the stated MissionMed Supabase practice. |
| Audio files + imported source files | **Cloudflare R2**, private buckets | Object storage with short-lived signed URLs; never public. |
| API surface beyond PostgREST (signed URLs, transcription jobs, AI proxy, import parsing, notification fan-out) | **Server functions** (Supabase Edge Functions or Cloudflare Workers — pick whichever the repo already standardizes on in Phase 0) | Small, auditable server code paths for everything the client must never be trusted to do. |

**The single most important architectural decision:** *authorization and integrity live in the database, not the client and not the UI.* WordPress mints identity; a short-lived signed token (WP-issued JWT consumed by Supabase, carrying `user_id`, `role`, and eligibility) is the only bridge; RLS policies make private stories structurally unreadable by mentors, make student-owned fields unwritable by mentors (and vice versa), and make originals and audit events append-only. The V5 UI then *renders* authority; it never *creates* it. This single decision satisfies Invariants 1–6, 10–11, and 13 at the layer where they cannot be bypassed by a devtools console — which is exactly how the prototype can be bypassed today.

**Auth flow (recommended):** WP session → WP plugin endpoint issues a StoryForge JWT (short TTL, signed with the Supabase JWT secret or a dedicated key, containing `sub` = mapped user id, `role` ∈ {student, mentor, staff, admin}, `eligible` boolean) → SPA uses it for PostgREST/functions → refresh via WP while the WP session lives → revoked eligibility = next refresh fails = truthful lockout screen. Mentor assignment is **not** in the JWT (it changes independently); it lives in `mentor_assignments` and is joined by RLS.

## 3. Domain model (draft DDL — Codex refines against discovery)

```sql
-- identity mapping & org
create table sf_users (id uuid primary key, wp_user_id bigint unique not null,
  display_name text not null, first_name text, email text, role text not null check (role in ('student','mentor','staff','admin')),
  pronouns text, cohort text, year text, specialty text, cycle text, eligible bool not null default true, created_at timestamptz default now());
create table mentor_assignments (mentor_id uuid references sf_users, student_id uuid references sf_users,
  active bool default true, primary key (mentor_id, student_id));

-- stories: mutable working state
create table stories (id uuid primary key, student_id uuid not null references sf_users,
  title text not null, prefix bool default true, themes text[], uses text[],
  lesson text, working_text text,             -- the Working Version (editable)
  status text not null default 'private' check (status in ('private','awaiting','in_review','changes','reviewed','approved')),
  revised bool default false, reviewed_by uuid references sf_users,
  self_score int check (self_score between 0 and 5) default 0,
  mentor_score int check (mentor_score between 0 and 5) default 0,
  star_student bool default false, star_mentor bool default false,
  birds text[], positions text[], craft jsonb,           -- Story Anatomy (teaching)
  ts_captured timestamptz not null, ts_submitted timestamptz, ts_student_updated timestamptz,
  ts_first_opened timestamptz, ts_last_reviewed timestamptz, ts_feedback_sent timestamptz,
  ts_feedback_opened timestamptz, ts_student_responded timestamptz, ts_status_changed timestamptz,
  deleted_at timestamptz);  -- soft-delete/archival per HIGH_RISK §2; hard deletion only via founder-approved policy

-- immutable originals: INSERT-only (no UPDATE/DELETE grants + BEFORE UPDATE trigger raising)
create table story_originals (story_id uuid primary key references stories,
  original_text text,                      -- Original Transcript / original telling
  audio_object_key text, audio_duration_s int, transcription_status text default 'none',
  created_at timestamptz default now());

create table story_comments (id uuid primary key, story_id uuid references stories, author_id uuid references sf_users,
  body text not null, created_at timestamptz default now(), seen_by_student_at timestamptz);
create table story_reflections (id uuid primary key, story_id uuid references stories,
  prompt text not null, answer text, from_mentor bool default false, author_id uuid references sf_users,
  seen_by_student_at timestamptz, created_at timestamptz default now(), answered_at timestamptz);

-- question library (institutional + custom, governed)
create table questions (id uuid primary key, text text not null, family text not null
  check (family in ('core','behavioral','clinical','cv','redflag','personal','custom')),
  source text not null check (source in ('missionmed','mentor','student','imported','ai')),
  owner_student_id uuid references sf_users,   -- null = shared/institutional
  state text not null default 'approved' check (state in ('draft','approved','retired')),
  import_batch_id uuid, created_by uuid references sf_users, created_at timestamptz default now());
create table import_batches (id uuid primary key, uploaded_by uuid, source_filename text, source_object_key text,
  parsed_count int, added_count int, skipped_count int, status text check (status in ('review','committed','rolled_back')),
  created_at timestamptz default now());

-- the story–question relationship (strength belongs to the pair — Invariant 12)
create table story_questions (id uuid primary key, story_id uuid references stories, question_id uuid references questions,
  proposed_by uuid references sf_users, confirmed bool default false, confirmed_by uuid references sf_users,
  s_student int check (s_student between 1 and 5), s_mentor int check (s_mentor between 1 and 5),
  why text, created_at timestamptz default now(), unique (story_id, question_id));
create table pair_followups (id uuid primary key, pair_id uuid references story_questions,
  text text not null, source text not null check (source in ('student','mentor','ai')),
  clinical bool default false, prepared bool default false, note text, sort int, created_by uuid, created_at timestamptz default now());
create table question_prefs (student_id uuid, question_id uuid, preferred_story_id uuid references stories,
  set_by uuid, set_at timestamptz default now(), primary key (student_id, question_id));
create table question_coaching (id uuid primary key, student_id uuid, question_id uuid,
  author_id uuid references sf_users, body text not null, created_at timestamptz default now());

-- ai suggestions with provenance + persisted review state (Invariant 15)
create table ai_suggestions (id uuid primary key, pair_id uuid references story_questions,
  text text not null, why text, clinical bool default false, model text not null, prompt_version text not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','edited_accepted','dismissed')),
  reviewed_by uuid, created_at timestamptz default now(), reviewed_at timestamptz);

-- mentor "use" suggestions: labeled, attributable — never silent edits of the student-owned uses[]
create table use_suggestions (id uuid primary key, story_id uuid references stories, use text not null,
  suggested_by uuid references sf_users, created_at timestamptz default now(), withdrawn_at timestamptz, accepted_at timestamptz);

-- trust anchors: append-only
create table audit_events (id bigint generated always as identity primary key, ts timestamptz not null default now(),
  actor_id uuid not null references sf_users, actor_display text not null, role text not null,
  action text not null, story_id uuid, student_id uuid, question_id uuid,
  prev_value text, new_value text, detail text,
  surface text check (surface in ('library','quick','workspace','workshop','teach','import','system')),
  visibility text not null default 'both' check (visibility in ('both','mentor_only')));
create table notifications (id uuid primary key, user_id uuid not null references sf_users,
  story_id uuid, question_id uuid, body text not null, created_at timestamptz not null default now(), read_at timestamptz);

create table user_settings (user_id uuid primary key references sf_users,
  background text not null default 'ember', prefs jsonb);
create table coaching_history (id uuid primary key, student_id uuid, body text not null, created_at timestamptz default now(), author_id uuid);
create table story_drafts (user_id uuid primary key, payload jsonb, updated_at timestamptz default now());
```

**Immutability enforcement:** `story_originals`, `audit_events`, and committed `import_batches` receive no UPDATE/DELETE grants for any API role, plus `BEFORE UPDATE OR DELETE` triggers that `RAISE EXCEPTION` — defense in depth against a future misconfigured policy. R2 audio objects are written once; overwrites denied by key convention + bucket policy. Corrections are new events, never edits (audit spec carry-forward).

**RLS sketch (illustrative; Codex writes the real policies + tests):** students `USING (student_id = auth.uid())` on their rows; mentors `USING (exists (select 1 from mentor_assignments ma where ma.mentor_id = auth.uid() and ma.student_id = stories.student_id and ma.active) AND stories.status <> 'private')`; column-level protection via API views/functions for role-owned fields (e.g., `mentor_score` writable only through a mentor-guarded RPC; `self_score` only student-guarded); notifications `USING (user_id = auth.uid())`; audit events readable per `visibility` and relationship; admin under a distinct policy set governed by the founder's support-access decision (§9).

## 4. Server behaviors (functions layer)

- **Lifecycle RPCs**: `submit_for_review`, `set_status`, `record_first_open` — enforce the state machine, stamp UTC instants, write the audit event and notification **in one transaction**. Opening never changes status (Invariant 10).
- **Notification fan-out + coalescing** at write time (status text preserved; "New feedback is attached." appended; 5-minute unread window).
- **Signed URL issuance** for audio playback/upload after RLS-equivalent authorization checks; TTL minutes, single object scope.
- **Transcription worker**: consumes uploaded audio → provider STT → writes `story_originals.original_text` once → status transitions `pending → done | failed` with truthful UI states and retry.
- **AI proxy**: server-held keys; structured-output schema; PHI-minimizing preprocessing; provenance persisted per suggestion; rate limits + budget caps; distinct general vs clinical routes (clinical disabled until its gate passes).
- **Import pipeline**: upload to R2 → server parse (CSV/XLSX first-class; DOCX/PDF/MD/TXT extractors) → sanitization (no formula-leading cells re-exported; MIME/size checks; AV scan if platform available) → staged `review` batch → explicit commit → `rolled_back` supported.

## 5. Frontend

Port the canonical UI faithfully: same layout, tokens (CAM v2 evolved), six-environment engine, typography rules, components, microcopy, and interaction map. **Framework:** adopt whatever the MissionMed repo already standardizes on if a standard exists (Phase 0); absent a standard, recommend **TypeScript + React + Vite**, with the canonical CSS carried over nearly verbatim as the design system and the environment engine kept as a small canvas module (explicit `width:100%;height:100%`; DPR cap 2; still-frame under reduced motion). Fonts self-hosted (Archivo, Rajdhani, Lora). State: server as source of truth; client cache (e.g., TanStack Query) with optimistic updates; realtime or polling for notification badges and queue counts. Accessibility upgrades over the prototype: focus trapping in modals/drawers, `aria-modal`, labelled controls, keyboard-reachable everything the mouse can reach.

## 6. Scale posture

Designed for real cohorts: hundreds of students, dozens of mentors, thousands of stories, years of history, multi-thousand-question libraries. All lists are server-filtered row queries with pagination/virtualization past ~100 rows; counts are SQL aggregates; audit tables are indexed by (actor, ts) and (story, ts); audio is streamed, never bulk-loaded; import batches are size-capped with progress feedback.

## 7. Legacy data

No legacy StoryForge production records were visible to this run. Phase 0 must determine whether any real student data exists in earlier systems (spreadsheets, docs, an earlier StoryForge build, WP tables). If yes: a founder-approved migration maps it into this schema with provenance (`source='migrated'` audit events) and a validation report; if no: migration scope is fixtures + the 26-question MissionMed seed only. Prototype localStorage blobs are demo state and are **not** migrated.

## 8. Testing, observability, deployment, rollback

- **Tests:** RLS/authorization suite (every table × every role × positive/negative, run against a real Postgres); lifecycle state-machine unit tests; API contract tests; Playwright E2E for Student and Mentor View independently, including the canonical 10-step submit→review→revise→approve loop, notification round-trip, workshop flows, import review, and screenshot comparison against the canonical artifact for key surfaces; accessibility checks (axe) on core screens.
- **Environments:** local (seeded fixtures) → staging (real WP-staging SSO if available) → production. Migrations forward-only with tested `down` paths where feasible; irreversible migrations flagged and founder-gated.
- **Observability:** structured logs on functions, error tracking, audit-event anomaly checks (e.g., any UPDATE attempt on immutable tables alerts), notification delivery metrics, AI cost dashboards.
- **Rollback:** versioned deploys with instant static-asset rollback; database rollback via down-migrations or point-in-time recovery (Supabase PITR — verify tier in Phase 0); R2 objects immutable so rollback never loses originals; a rollback drill is part of the release plan.

## 9. Mandatory Codex Phase 0 discovery (unknowns converted to steps)

1. Repository inventory: layout, AGENTS.md files, frontend standards, CI, test conventions, deploy scripts.
2. WordPress: version, plugin architecture, how roles/capabilities are defined, LearnDash (or actual) eligibility source, existing SSO/JWT mechanisms, Matrix hub URL structure.
3. Supabase: project(s), existing schemas/migrations, RLS conventions, JWT secret handling, PITR tier, Edge Functions vs Workers standard.
4. Cloudflare: account/services in use, R2 buckets, Workers conventions, DNS for the chosen StoryForge path.
5. Existing StoryForge code or data anywhere (repo, WP, sheets) — migration scope decision input.
6. Notification/email infrastructure present today.
7. Deployment pipeline + environments + rollback practice actually in place.
8. Mentor assignment source of truth (where does "Dr. Brian mentors Maya" live today?).
9. Record every finding with evidence (file paths, screenshots, queries) in the Phase 0 report before any architecture-dependent implementation.

Where a Phase 0 finding contradicts a recommendation here, Codex adapts the implementation, records the reason, and preserves the canonical product and the invariants — which are not negotiable.
