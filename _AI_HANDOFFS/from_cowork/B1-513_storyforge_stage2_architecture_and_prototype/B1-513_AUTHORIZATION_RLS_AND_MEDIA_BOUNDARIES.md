# B1-513 Authorization, RLS, and Media Boundaries

Date: 2026-08-07 (America/New_York)
Authority: `B1-513_DECISIONS_SPINE.md` (D2, D8; supporting D1, D3, D4, D5, D7) and `B1-513_CURRENT_CANONICAL_BASELINE.md` (§2, §5, §6). Where this document and the spine could ever diverge, the spine wins.
Pattern source: production migrations `20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql` and `20260806190000_b1_512_concrete_configuration_media.sql` (RLS + FORCE RLS, bounded SECURITY DEFINER functions, `sf_append_audit`, deletion intents, flag-gated policies).

## 1. The trust chain does not change

Stage 2 adds surfaces, not principals. The canonical chain from baseline §2 is inherited verbatim:

> WordPress session + LearnDash entitlement → product gateway signs a short-lived JWT (issuer, audience, expiry, JTI, WP user, eligibility, role) → Railway API verifies → PostgreSQL transaction actor (`sf_actor_id()` / `sf_actor_role()`) + least-privilege `authenticated` role + RLS.

Consequences that bind every Stage 2 surface:

- No new WordPress role, no new token type, no second session mechanism. The Founder remains `brinyu` (persisted role `student` + `adminConsole` capability); `Brian_test` remains the additional `admin` (B1-511A).
- Every capability difference (admin console, voice capture, mentor notes, and every new B1-513 flag) is signed into the JWT and re-verified server-side; the client renders what the server permits and never decides authorization.
- All new tables follow the B1-511/B1-512 posture exactly: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`; `REVOKE ALL ... FROM PUBLIC, anon, authenticated`; at most a narrow `GRANT SELECT` policy for owner reads; every write through a bounded `SECURITY DEFINER` function (`SET search_path = public, pg_temp`, explicit `REVOKE ... FROM PUBLIC, anon` then `GRANT EXECUTE ... TO authenticated`) that re-checks identity via `sf_has_live_identity(...)`, feature flag via `sf_story_feature_enabled`-class helpers, and optimistic `row_version`, and appends to the audit log via `sf_append_audit`.
- Feature gating is enforced inside policies and functions (the `sf_mentor_notes_enabled()` pattern), so a disabled flag closes the surface at the database, not merely in the UI.

## 2. Visibility model: authorization semantics

Spine D2 makes VISIBILITY (who may observe) orthogonal to WORKFLOW STATUS (review lifecycle). The authorization rules:

| Story state | Owner student | Founder/admin reviewer | Assigned mentor | Other student / anonymous |
|---|---|---|---|---|
| `visibility = private`, not submitted | Full read/write | **No list entry; direct ID read = 404/P0002** (indistinguishable from nonexistent). Counts only in directory. | Same as admin: nothing | Nothing (404/P0002 / 401) |
| `visibility = mentor_visible`, not submitted | Full read/write | Read-only observation + mentor notes. **No status/suitability/score writes** (review writes stay submission-gated, D2) | Read-only observation + notes, only for assigned students | Nothing |
| Submitted (`awaiting → in_review → changes/reviewed/approved`) | Read/write per workflow; withdraw = "Return to Private" | Full review surface (status, score, suitability, feedback, taxonomy) — unchanged B1-511 path | Per existing mentor rules | Nothing |
| `visibility IS NULL` (legacy pre-Stage-2 row) | Unchanged | **Behaves as `private` for observation**; the review path over submitted stories is unchanged | As admin | Nothing |

Enforcement details, matching the prototype contract in `shim.js`:

- **Private = absent, not forbidden.** Lists exclude private rows via RLS predicates; a direct-ID read by a non-owner returns the same `404 / P0002 "Story not found."` as a nonexistent ID. No response may distinguish "exists but private" from "does not exist" — including timing-insensitive uniform code paths in the API layer.
- **Submitted implies observable.** A submitted story cannot be flipped to `private` while submitted: the visibility RPC rejects with `409 / visibility_submitted` and the UI directs the student to the existing "Return to Private" withdraw action first. Submit sets `mentor_visible` (with history line) if it was not already.
- **Only the owner writes visibility.** `sf_set_story_visibility(p_story_id, p_visibility, p_expected_version)` requires `sf_has_live_identity(ARRAY['student'])` AND owner match; every change appends audit + a `story.visibility_changed` history line with the exact student-facing wording ("to Private — visible only to me" / "to Mentor Visible").
- **Consent gates the default, not access.** `sf_mentorship_consent` acceptance changes only the default visibility of NEW stories to `mentor_visible`. Historical stories are never silently converted (D2). Refusal ("Not now") writes a `defer` decision and changes nothing else.

## 3. Per-table RLS matrix (new Stage 2 tables)

All tables: RLS + FORCE RLS; `REVOKE ALL FROM PUBLIC, anon, authenticated`; append-only where stated (delete-forbidding trigger per the `sf_forbid_mentor_note_delete()` pattern); every write via bounded SECURITY DEFINER RPC with flag check, identity check, optimistic version where applicable, and `sf_append_audit`.

| Table | Owner-scoped SELECT policy | Write path (SECURITY DEFINER only) | Admin/mentor access | Notes |
|---|---|---|---|---|
| `sf_story_versions` | Owner: `student_id = sf_actor_id()` via parent story join. Reviewer/mentor: only where parent story is `mentor_visible` OR submitted (never private/NULL) | `sf_save_story_version(story_id, version_key, body, mode save\|retell, source typed\|voice, recording_id, expected_version)` — owner only; `version_key ∈ {thirty_second, nnq_setup}` enforced by CHECK + `UNIQUE(story_id, version_key)`; `original` and `full_story` rejected (`version_protected` / `use_story_patch`) | Read-only through the same visibility predicate; no admin write RPC exists for version bodies | Recording provenance columns (`recording_id`, `audio_asset_id`) reference the existing recording domain; no media duplication (D1, D8) |
| `sf_story_version_revisions` | Same predicate as parent version (owner; reviewer/mentor over observable parents) | Insert-only, performed internally by `sf_save_story_version` (retell/changed-save snapshot) and `sf_restore_story_version(story_id, version_key, revision_id)`; restore swaps current↔revision append-only, nothing lost | Read-only over observable parents | Append-only; retention cap ≤ 50 per version with oldest-compaction + audit (D1). No student-callable DELETE |
| `sf_mentorship_consent` | Owner: `user_id = sf_actor_id()` | `sf_decide_mentorship_consent(policy_version, decision accept\|defer)` — inserts an append-only decision row and returns the audit receipt id; re-decision inserts a new row, never rewrites | Admin: aggregate/latest decision via bounded function for directory state only; never another student's receipt detail beyond decision + timestamp + policy version | Policy text is configuration, versioned; receipt id surfaced to the student (Settings → Mentorship & privacy) |
| `sf_inspiration_prompts` | All eligible students: SELECT active prompts only (`state = 'active'`); flag `inspiration` checked in policy | Admin-only `sf_save_inspiration_prompt(...)` / publish path with optimistic `row_version` on the prompt-bank configuration version (D6); stable IDs, retire-not-delete | Admin: full read incl. retired (flag `inspiration_admin`) | Server-side prompt selection reads through the same policy; selection is deterministic + auditable (D3) |
| `sf_inspiration_saved` | Owner only: `user_id = sf_actor_id()` | `sf_inspiration_save_later(prompt_id, prompt_text_snapshot, draft)`, `sf_inspiration_remove_saved(id)` — owner only | **None.** Saved questions and drafts are never listed for admin or mentor | Drafts are student-private pre-story content; they become observable only after promotion through the canonical `/api/stories` creation path |
| `sf_inspiration_events` | No student SELECT needed (write-only telemetry); owner-scoped INSERT via RPC | `sf_record_inspiration_event(kind shown\|answered\|skipped\|promoted, prompt_id)` — content-free by schema (no free-text column) | Admin: aggregate counts only via bounded reporting function | Content-free is structural: the table has no answer/draft column to leak |
| `sf_activity_sessions` | Owner: own sessions | `sf_activity_heartbeat(surface)` — creates/extends the current session under the D5 model (60s beat, 120s idle threshold, 30-min close); flag `activity_tracking` | Admin: per-student read via bounded directory function, always paired with `available_from` | Stores aggregates only (`started_at`, `last_beat_at`, `active_ms`, coarse surface). No keystrokes, clipboard, other tabs, screenshots, or content payloads (D5) |
| `sf_activity_counters` | Owner: own counters | Incremented inside existing RPCs (story open/create/advance, submit, review open, version edit, Inspiration answer) — no direct client write | Admin: bounded read with `available_from` | Counters carry the truthful-boundary timestamp; nothing is backfilled or fabricated |
| `sf_review_check_receipts` (review-check receipts) | Student: sees the resulting notification through the existing `sf` notifications domain, not this table | `sf_send_review_check(student_id, preview boolean)` — admin only; preview returns text without insert; send enforces 24h per-student dedupe (`429 / review_check_rate_limited`), inserts receipt, creates the StoryForge notification, appends audit | Admin: per-student receipt history (profile drawer → Notifications) | Notification content is truth-branched on actual state (nothing submitted / submitted awaiting / reviewed) and timestamped (D4) |

Existing tables touched additively: `sf_stories` gains nullable `visibility` + `visibility_changed_at` and `origin` provenance (`{type: inspiration, prompt_id, prompt_text snapshot}`) — nullable, no default rewrite, zero mutation of existing rows. Existing RLS on `sf_stories` is tightened only by the new observation predicate for unsubmitted mentor-visible reads; the submitted-review path is byte-for-byte the B1-511 behavior.

## 4. Founder audio playback over mentor-visible/submitted stories

- **One signer.** Playback reuses the existing short-lived signed URL path (the same claim-then-sign flow as owner playback and B1-511 mentor-note playback: a `sf_*_playback_claim`-class SECURITY DEFINER function authorizes, then the API signs a short-lived URL).
- **RLS extension, not a new path.** The claim function authorizes: the owner student, OR an admin/reviewer or assigned mentor **only when the owning story is `mentor_visible` or submitted**. Private and NULL-visibility stories fail the claim with `P0002` — same absence semantics as §2.
- **Hard negatives:** no public URLs, no unauthenticated playback, no cross-student access, no unrelated-mentor access, no long-lived tokens, no URL that outlives its expiry window.
- **Prototype caveat, stated explicitly:** the working prototype plays a synthetic `blob:` WAV (`URL.createObjectURL` in `shim.js`) so the recorder/replay UI runs offline. That `blob:` allowance is prototype-only. Production media sources remain https-only signed URLs under the existing CSP; no CSP relaxation ships with Stage 2.

## 5. Story Media boundary

- `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` remains untouched, with its two activation gates unmodified (baseline §2). Stage 2 does not activate, extend, or depend on the B1-512 private story media domain.
- Media (including original audio) attaches to the **canonical story only**. Versions reference recordings by id (`recording_id` / `audio_asset_id`); they never duplicate media rows, never create a second audio system, and never introduce per-version media tables (D1, D8).
- Deletion continues through the existing deletion-intent pattern (`sf_story_media_deletion_intents` / `sf_mentor_note_audio_deletion_intents` class); version revision compaction records audit but never deletes referenced audio out from under the recording domain.

## 6. Negative-access test matrix

Every row is a required automated test (PostgreSQL policy test + API-level test); the release gates in the acceptance matrix reference this table as "the doc 11 matrix."

| # | Actor → Target | Expected result |
|---|---|---|
| N1 | Anonymous → any Stage 2 endpoint (`/api/consent`, `/api/stories/:id/versions/*`, `/api/inspiration*`, `/api/activity/heartbeat`, `/api/admin/console/*`) | `401 unauthenticated` |
| N2 | Ineligible identity (LearnDash entitlement lapsed) → any student surface | `403` (eligibility fails in JWT verification; DB backstop `42501`) |
| N3 | Student A → Student B's story by direct ID (any visibility) | `404 / P0002` |
| N4 | Student A → Student B's version, revision, saved prompt, activity session/counter by direct ID | `404 / P0002` (RLS row absence) |
| N5 | Student → any `/api/admin/console/*` endpoint (directory, directory/:id, review-check, inspiration admin, content-display publish) | `403 forbidden` |
| N6 | Student → edit `original` or `full_story` through the version RPC | `403 version_protected` / `400 use_story_patch` |
| N7 | Mentor → student's `private` or NULL-visibility unsubmitted story (list + direct ID + playback claim) | Absent from lists; `404 / P0002` direct; playback claim fails |
| N8 | Mentor → another mentor's students (not assigned) | `404 / P0002` / empty lists — `sf_is_assigned` predicate |
| N9 | Mentor/admin → status, score, or suitability write on an unsubmitted mentor-visible story | Rejected server-side (`42501` / `403`): review writes remain submission-gated |
| N10 | Admin → private story content via directory profile drawer, story tab, direct admin story read, or review queue | Counts only; content/titles never present; direct read `404 / P0002` |
| N11 | Admin → student's `sf_inspiration_saved` drafts or Inspiration answer text | No endpoint exists; DB SELECT denied by RLS |
| N12 | Directory content-leak probes: search `q=` matching a private story title; filters; profile drawer tabs; Review Check preview text | No private title, body, prompt draft, or version text in any response payload (assert by payload scan) |
| N13 | Any actor → visibility change on a submitted story to `private` | `409 visibility_submitted` |
| N14 | Any actor → second Review Check to the same student within 24h | `429 review_check_rate_limited` |
| N15 | Stale `row_version` on any optimistic write (visibility, version save, config publish, prompt save) | `40001` conflict, no partial write |
| N16 | Any actor → DELETE on append-only tables (`sf_story_version_revisions`, `sf_mentorship_consent`, receipts, audit) | Denied (no grant; forbid-delete trigger) |
| N17 | Flag off (each of D7's eight flags) → its endpoints and policies | Surface closed server-side, not just hidden in UI |

## 7. Audit and event coverage

| Action | Audit (`sf_append_audit`) | Story history line | Receipt to user |
|---|---|---|---|
| Consent accept / defer | ✓ (decision, policy version) | — | ✓ receipt id shown + re-readable in Settings |
| Visibility change | ✓ | ✓ `story.visibility_changed` | UI toast "…Logged." |
| Version save / append / retell / restore | ✓ | ✓ `story.version_edited` / `story.version_restored` (with voice/typed + Append/Retell detail) | Save confirmation only after server ack |
| Revision compaction (cap > 50) | ✓ | — | — |
| Review Check preview | — (no send) | — | — |
| Review Check send | ✓ | — | Founder delivery status; student notification with read/dismiss state |
| Direct review controls (status/score/suitability) | ✓ per patch | ✓ existing lines | aria-live announcement |
| Config publish (version registry, Inspiration bank) | ✓ via configuration history (B1-512 pattern) | — | rowVersion returned |
| Inspiration events | content-free event rows | — | — |
| Activity heartbeat | aggregated rows only (not per-beat audit noise) | — | — |

## 8. Blast-radius statement per surface

Each flag is DB flag + independent env kill switch, default off (D7). "Off" means policies/functions gate closed at the database and endpoints refuse — not UI hiding.

| Surface (flag) | If disabled or defective, the worst case is bounded to | Cannot affect |
|---|---|---|
| `visibility_consent` | Consent modal + visibility card absent; all stories behave as pre-Stage-2 (private w.r.t. observation); review path unchanged | Submitted-review workflow, story content, existing RLS |
| `story_versions` | 30-Second/NNQ tabs absent; `sf_story_versions*` rows unreadable/unwritable; Original + Full Story render exactly as production today | `stories.text`, originals, recordings, media |
| `inspiration` | Inspiration route closed; saved prompts inert; already-promoted stories persist as ordinary canonical stories | Story store (no parallel store exists to orphan) |
| `inspiration_admin` | Prompt bank frozen at last published version; students keep working against it | Student wizard availability (independent flag) |
| `admin_directory` | Directory + profile drawer close; existing Students (submitted-work) surface still works | Student data, review queue |
| `activity_tracking` | Heartbeats refused; metrics show "Available from…" truthfully or nothing; no fabrication | Any student-facing behavior |
| `review_check` | Send/preview refused; past receipts and notifications remain readable | Notification domain generally |
| `admin_review_controls` | Direct-control UI falls back to the existing B1-511 select-based review form | Review data model, audit |

Cross-cutting bound: every Stage 2 migration is additive (new tables, nullable columns, new functions); rollback = disable flags + (if required) revert deploy; zero mutation of existing rows is a tested property (see acceptance matrix, migration tests).
