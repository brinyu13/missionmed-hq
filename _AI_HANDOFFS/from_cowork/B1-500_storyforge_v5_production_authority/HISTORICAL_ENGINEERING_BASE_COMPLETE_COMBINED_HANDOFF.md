# StoryForge — Complete Combined Handoff (v2 baseline + V5 addendum)
MissionMed · Refinement run · July 26, 2026
Prototype: `storyforge.html` (v1, canonical, untouched) → **`storyforge-v2.html` (this run's deliverable)**

---

<!-- SPLIT: 01-PRODUCT-CHANGE-SUMMARY.md -->
## 1. Product Change Summary

**What this run was.** A clarity-and-operations refinement of the canonical StoryForge prototype. No visual-identity, capture, or philosophy changes. Every metaphorical functional label was replaced with plain language; a real review lifecycle with trustworthy timestamps was added; both perspectives were rebuilt around a left navigation rail; the mentor side was restructured for 20+ students.

**Preserved intact:** the animated dark CAM v2 environment (ember canvas, aurora fields, reduced-motion support), the "The One Where…" capture experience (title-first save, voice-note simulation, draft protection), Original Telling vs Working Version, private-by-default stories, mentor comments and questions, student responses, story history, 1:1 sessions, Teaching Mode with comparison and Story Anatomy, responsive behavior, and guarded local persistence.

**Changed:**
- **Navigation** — left rail (Timeline-Builder-inspired): Student: Home / Story Library / Interview Prep / Notifications / Settings / Back to Matrix, with "+ New Story" as the rail's primary action. Mentor: Home / Students / Review Queue / My Activity / Teaching Mode / Settings. An unmistakable "Viewing as: Student View / Mentor View" switch sits at the rail foot (mentor-authorized accounts only, simulated); the header carries a colored view chip that also switches roles (the phone path), and Settings duplicates the switch.
- **Vocabulary audit** — Sparks/Taking shape/Forged/Brightest/Desk/Needs-You-Now/embers are gone from all functional UI. Writing completeness is Draft / In progress / Complete (computed). Review status is Private / Awaiting review / In review / Changes requested / Reviewed / Approved. Sorts are literal ("My rating (high→low)"). Scores are numeric and labeled ("My rating: 4/5", "Mentor: not scored"). Warmth kept in supporting copy only.
- **"Still Glowing" removed** — Home now has **Unfinished stories** (Draft/In-progress stories with a "Finish it" action), **From your mentor** (latest notifications), and **Where your stories stand** (status counts that deep-link into filtered library views).
- **Story Library** — full-width rows replacing card grids on both sides: star, title, excerpt, updated time, bird icons, question count, both scores, status chip, and two explicit actions ("Quick look / Open story" for students; "Quick review / Full review" for mentors). Search + status/sort/starred/bird/position filters.
- **Two opening experiences** — a right-hand Quick Review drawer (with Prev/Next paging through the current list) and the Full Review workspace. Labels and tooltips make the difference explicit.
- **Review lifecycle** — explicit statuses, one-click mentor changes (row dropdown, drawer, full review, Teaching Mode), distinct lifecycle timestamps in local time, reviewer identity, and end-to-end demonstrated submit → review → changes → revise → resubmit → re-review → approve loop.
- **Notifications** — a dedicated student destination with unread badge, direct plain language ("Changes requested on '…'. Review Dr. Brian's feedback."), click-through to the exact story, coherent read state, and coalescing of rapid same-story actions.
- **Classifications** — Bird Personality Type (Peacock/Dove/Owl/Eagle) and Ideal For Position (PD/APD/Faculty/Resident/Behaviorist), multi-select, editable by both roles with attributed history, filterable everywhere.
- **Favorites** — independent student star (gold) and mentor star (cyan), never merged, both filterable.
- **Assign Interview Questions drawer** — search, categories, multi-select, custom questions, per-question strength scores held separately for student and mentor on the story–question relationship, student proposals with mentor confirm, deliberate (checkbox-only) removal.
- **Prepare → Interview Prep** — one job: "Which questions already have a story behind them?" Coverage count, per-question story chips with strengths, gap capture, PS candidates and interview set.
- **Mentor View rebuilt** — Mentor Home (three verb-labeled actions + outstanding-work counts + recent activity), Students (full-width rows with cohort/session, search, sorts, per-student to-review/unscored counts), Review Queue (five one-click buckets across all students), My Review Activity (personal-by-default, date-range/cohort/student/action/mentor filters, multi-mentor attribution incl. seeded Dr. Chen), and a per-student story workspace with the full filter set.
- **Scale demonstrated** — 22 seeded students (8 rich + 14 generated), ~60 shared stories, three cohorts.

<!-- SPLIT: 02-INTERACTION-INVENTORY.md -->
## 2. Interaction Inventory (complete, all functional)

**Global** — rail navigation; header view chip (click = switch role, when authorized); search (student: live library filter; mentor: opens jump palette); keyboard: `N` new story (student), `K`/`/` palette (mentor), `Esc` closes topmost overlay (palette → questions drawer → quick drawer → teaching → capture[draft-kept] → full review); Back to Matrix (simulated toast); Settings (mentor-access toggle, view switch, timezone note, reduced-motion note, reset demo data).

**Student** — Home: hero capture (type/Enter/mic), memory prompt (click = next, double-click = capture from it), unfinished-stories "Finish it", notification previews, status-count chips → filtered library. Capture: prefix toggle, title-only save, optional lesson/rating/themes, voice simulation with timer/waveform/labeled transcript, Esc/close keeps an auto-draft, restored on reopen; saved stories are Private. Library: search, 6 filters/sorts, row click → Quick look, explicit Open story. Quick look drawer: read excerpt+lesson, submit/resubmit, self-rating 1–5, star, classifications, question summary, assign drawer, timestamps, mentor feedback, open-full. Full review: editable title/working version/lesson, reflections (+ pull prompt), answer mentor questions (flags story revised), submit/resubmit, self-rating, star, classifications, uses, question list, curated history + full history, lifecycle timestamps with reviewer identity. Notifications: unread badge/dots, mark-all-read, click-through opens the story and marks read. Interview Prep: coverage, per-question chips with strength, propose-by-capture for gaps.

**Mentor** — Home: three primary actions, outstanding-work counts, students-with-work list (+N more), today/week activity. Students: search, cohort filter, five sorts, per-student counts, open workspace. Workspace: search, 12+ filters (unreviewed, unscored, changes, approved, stars, bird, position, per-question), 4 sorts, coaching history panel, Interview Prep, Teach-from-library, Start 1:1. Review Queue: five bucket chips with counts, cohort filter, cross-student rows labeled with student + cohort. Rows: inline one-click status dropdown, quick review, full review, mentor star. Quick review drawer: Prev/Next through the active list, one-click statuses, mentor score, star, classifications, feedback composer, assign drawer, timestamps. Full review: everything above plus ask-a-question, revision banner (opens on the Working Version), use suggestions (never edits student-owned fields). Assign Questions drawer: as student, plus confirm student suggestions and mentor-side strengths; deliberate checkbox-only removal with toast. My Activity: mentor (default = signed-in) /student/cohort/action-type/period incl. custom date range; rows click-through to stories. Teaching Mode: story pickers across all students, compare, Hide names (ON by default from the rail entry; OFF from a named student's page), Story Anatomy live scoring with visible rubric hints, live status/score/star/comment/assign actions (all attributed, all notifying), toasts suppressed while projecting. 1:1 session: agenda auto-built from outstanding work, open ≠ covered (checkbox), compact on mobile, End logs to coaching history.

<!-- SPLIT: 03-STATE-AND-DATA-MODEL-DELTA.md -->
## 3. State & Data-Model Delta (v1 → v2)

**Story — added:** `status` ('private'|'awaiting'|'in_review'|'changes'|'reviewed'|'approved'), `revised` (bool: resubmitted after feedback), `reviewedBy`, `selfScore` (0–5, replaces `embers`), `mentorScore` (0–5), `starStudent`, `starMentor`, `birds[]`, `positions[]`, `ts{captured, submitted, studentUpdated, firstOpened, lastReviewed, feedbackSent, feedbackOpened, studentResponded, statusChanged}` (ISO-8601; rendered in the viewer's local time), `qa[]` (see below), `history[]` (audit events, see §7), `comments[]` (`{who, text, t, seen}` — replaces advisor.notes with attribution). **Removed/replaced:** `shared` (derived: status ≠ private), `flag/respKind` (→ `revised`), stage vocabulary (→ computed `devState`: Draft / In progress / Complete). **Kept:** body/polish/lesson/refl (with `from:'mentor'` asks), themes, uses, advisor.useSuggest, advisor.craft (Story Anatomy).

**Story–question relationship `qa[]`:** `{q: questionId|customId, by: actorName, confirmed: bool, sStudent: 1–5|null, sMentor: 1–5|null, t}`. Strength belongs to the pair, not the story. Custom questions live in `CUSTOMQ` (`{id:'cqN', cat:'Custom', q}`).

**Student — added:** `cohort` ('Session A/B/C'), retained pronouns, coaching `hist[]`. Roster: 22 (8 rich + 14 generated for scale).

**New stores:** `NOTIFS[]` (`{id, t, text, storyId, read}` — demo student inbox), `CUSTOMQ[]`. **Persistence:** guarded localStorage key `storyforge-v2` (v4 schema: sid, nid, notifs, customq, per-student stories/hist/lastCapture); silently in-memory when storage is unavailable; Settings → Reset restores seeds.

**State:** `S.role`, `S.view` (student: home/library/prep/notifications/settings; mentor: mhome/mstudents/mstudent/mqueue/mactivity), `S.lib` (student list controls), `S.m` (mentor: cur student, student list controls, queue bucket, per-student filters, activity filters incl. custom date range), `S.mentorAccess` (simulated WordPress authorization).

<!-- SPLIT: 04-NOTIFICATION-SPEC.md -->
## 4. Notification Behavior Specification

**Principle.** Notifications are direct statements of what a named mentor did, in the student's local time. Personality lives elsewhere.

**Triggers (mentor action → student notification):** status → In review ("Dr. Brian started reviewing '…'"), Changes requested ("Changes requested on '…'. Review Dr. Brian's feedback."), Reviewed ("Dr. Brian reviewed '…' on {datetime}."), Approved ("'…' was approved by Dr. Brian."); feedback comment ("Dr. Brian left feedback on '…'"); question asked; mentor score set ("… updated the score on '…' to 4/5."); mentor star; classification changes; question assignments (batched on drawer close: "… assigned '…' to N interview questions."). **Non-triggers:** opening a story, mentor-only suggestions being withdrawn, craft (anatomy) scoring, students' own actions.

**Coalescing.** Rapid actions (<5 min) on the same story with an unread notification update that notification to the newest, most actionable text and refresh its timestamp — one review pass produces one notification.

**Delivery & read state.** Rail badge = unread count; Home "From your mentor" previews with unread dots; Notifications page lists all with full timestamps; click marks read and opens the story's Full Review; opening a story by any path marks its notifications read, marks comments/asks seen, and stamps `ts.feedbackOpened` (first unseen→seen transition). "Mark all as read" available. Notifications persist across reloads.

**Mentor-side awareness** needs no inbox: student submissions and revisions surface as Review Queue buckets and counts (with `revised` re-entering "Revised — needs re-review").

<!-- SPLIT: 05-ROLE-PERMISSION-SPEC.md -->
## 5. Role & Permission Specification

**Roles.** Student (default), Mentor (requires authorization; in production a WordPress capability on mentor/administrator roles; simulated by a Settings toggle that hides the switch entirely when off). The active view is always visible: colored header chip (amber student / cyan mentor), rail switch state, banner in Mentor View.

**Student owns (student-writable, mentor-readable):** title, body/working version, lesson, reflections/answers, themes, self rating, student star, uses, submit/resubmit. **Mentor owns (mentor-writable, student-readable):** review status (except submit), mentor score, mentor star, comments, asks, question confirmation, mentor question strengths, craft scores, use *suggestions*. **Shared with attribution:** bird types, positions, question selection (student additions are unconfirmed proposals), student question strengths.

**Visibility rules.** Private stories are structurally invisible to mentors (excluded from every mentor list, queue, palette, teach pool, and count; the banner restates the contract per student). Mentor-only data not shown to students: use-suggestions before acceptance appear as labeled suggestions; craft scores are teaching-side only; other students' data never crosses. Teaching Mode hides student identity by default when entered from the rail; comments/scores made while teaching attribute normally. Students never see raw audit noise — curated history first, full history on demand.

**Attribution.** Every write records the actor's display name ('Maya', 'Dr. Brian', 'Dr. Chen'); multiple mentors are first-class throughout history, comments, scores, approvals, and activity reporting.

<!-- SPLIT: 06-MENTOR-WORKFLOW-SPEC.md -->
## 6. Scalable Mentor Workflow Specification

**Jobs, in order:** find a student → see what's waiting → review fast → keep the student informed automatically → account for completed work → teach.

**Discovery at scale.** The Students page is the visible, primary selector (search, cohort, five sorts, per-student Submitted / To-review / Unscored counts); the header "Viewing" pill and K/`/` open the jump palette (students ranked by outstanding work + full-text story search) as accelerators, never the only path.

**Queue model.** All review work is state-derived — nothing is manually queued and no feed grows unboundedly. Five buckets (Awaiting my review / Revised — needs re-review / Waiting on student / Reviewed / Approved) each answer one founder question with one click; cohort filter on top. Counts appear on the rail badge, Mentor Home, and bucket chips. Items leave buckets only through explicit status actions — opening never completes anything.

**Fast review loop.** Row → status visible without opening → inline one-click status OR Quick Review drawer (all common actions + Prev/Next to move through dozens of stories without losing list context) → Full Review only when depth is needed. Works identically from the queue, a student workspace, a 1:1 agenda, and Teaching Mode.

**Accounting.** My Review Activity defaults to the signed-in mentor with calendar-accurate Today / This week / This month / custom date range / all-time, filterable by mentor, student, cohort, and action type; every row links to its story. Mentor Home mirrors the today/week counts.

**Capacity behavior.** 22 students / ~60 stories in the demo; all lists are filtered row lists (no grids), all counts computed, truncations labeled (+N more). At hundreds of stories the same structures hold; engineering adds pagination/virtualization per the blueprint.

<!-- SPLIT: 07-ENGINEERING-BLUEPRINT.md -->
## 7. Codex-Ready Engineering Blueprint (MissionMed / WordPress / production data layer)

**Faithful-reproduction rule.** The prototype (`storyforge-v2.html`) is the behavioral spec: reproduce its labels, states, transitions, notification texts, and role rules exactly. It is a single self-contained file — tokens and components are in its two ported style blocks + v2 layer; all behavior in six script blocks. Fonts: Archivo/Rajdhani/Lora (self-host in production).

### 7.1 Data layer (WordPress mapping)
- `sf_story` custom post type (author = student user). Post content = original telling (immutable after creation; enforce in code). Meta: `polish`, `lesson`, `prefix`, `voice`, `themes[]`, `uses[]`, `birds[]`, `positions[]`, `self_score`, `mentor_score`, `star_student`, `star_mentor`, `status`, `revised`, `reviewed_by`, `craft{}`, `ts_*` (UTC ISO-8601; render client-side in the viewer's locale/timezone — the prototype's `fmtDT`).
- `sf_story_question` relationship table/CPT: `story_id, question_id|custom_question_id, proposed_by(user), confirmed(bool), confirmed_by, s_student(1–5|null), s_mentor(1–5|null), created_at`. Strength is on the relationship.
- `sf_question` (seed the 12-question library + categories), `sf_custom_question` (author, text).
- `sf_comment` (story_id, author user, text, created_at, seen_by_student_at) — mentor feedback; `sf_ask` = reflection rows with `from_mentor` flag.
- `sf_event` — audit table, §7.3. `sf_notification` — §4 rows (user_id, story_id, text, created_at, read_at).
- Users: students (role `subscriber` + `sf_student` profile: cohort/session letter, year, specialty, cycle, pronouns); mentors: capability `sf_mentor` granted to mentor/administrator roles. Role switch UI renders only when `current_user_can('sf_mentor')`.

### 7.2 Story Review Lifecycle specification
States: `private → awaiting → in_review → (changes | reviewed | approved)`; `changes → awaiting (revised=true)` on resubmit; mentor may move between `in_review/changes/reviewed/approved` freely; students can never set mentor states; mentors can never set `private/awaiting`.

| Transition | Actor | Sets timestamps | Notification |
|---|---|---|---|
| private→awaiting (Submit) | student | `submitted` (first only), `statusChanged`, `studentUpdated` | none (mentor sees queue) |
| changes→awaiting (Resubmit) | student | `studentResponded`, `statusChanged`; `revised=true` | none (queue: Revised bucket) |
| any→in_review | mentor | `statusChanged` | "started reviewing" |
| any→changes | mentor | `statusChanged`, `lastReviewed`, `reviewedBy`; `revised=false` | "Changes requested… Review {mentor}'s feedback." |
| any→reviewed | mentor | same as changes | "{mentor} reviewed … on {datetime}." |
| any→approved | mentor | same as changes | "… was approved by {mentor}." |

Invariants: **opening a story only ever sets `firstOpened` (once) and logs an "Opened" event — it never changes status.** `feedbackSent` is set exclusively by comment creation. `feedbackOpened` is set when the student first views unseen feedback and can never precede `feedbackSent`. Editing the working version or answering a mentor ask on a story with mentor feedback sets `revised=true`, `studentResponded`, and (if in `changes`) auto-returns it to `awaiting`.

### 7.3 Audit Event specification
Every meaningful write creates one event: `{id, ts (UTC), actor_user_id, actor_display, role ('student'|'mentor'), action (enum: captured, submitted, resubmitted, status_changed, opened, comment, ask, answered, self_score, mentor_score, star_student, star_mentor, birds_changed, positions_changed, uses_changed, question_assigned, question_suggested, question_confirmed, question_removed, question_strength, title_renamed, body_edited, lesson_edited, review_completed, session_logged), story_id, student_id, prev_value (nullable), new_value, detail (short human text), visibility ('both'|'mentor_only')}`. History rendering: newest-first by timestamp; curated view shows human-meaningful events (everything above except `opened` may be summarized) with "who — action · detail (was: prev)" exactly as prototyped; full log behind "Show full history." Students never see `mentor_only` events (currently: use-suggestions, craft scoring). Events are immutable; corrections are new events.

### 7.4 Mentor Activity specification
A query over `sf_event` where role='mentor': default filter `actor = current user`; filters: mentor (any), student, cohort (join student profile), action type (grouped: status/feedback/score/question/star), period (calendar Today, rolling 7/31 days, custom from–to dates, all). Headline states the active mentor scope explicitly ("Dr. Brian: 12 actions this week" / "All mentors: …"). Each row: local-time datetime, actor, action + detail, story title, student + cohort, prev value; click-through to the story. Must return correct counts for "today" using the viewer's calendar day. Multiple mentors are fully supported — attribution comes from the event's actor, never from a global "the mentor."

### 7.5 Notifications (production)
Create `sf_notification` rows from the trigger table in §4, server-side, in the same transaction as the event. Coalesce: if the story's newest notification for that user is unread and <5 minutes old, replace its text/timestamp instead of inserting. Deliver in-app (badge + page); email digests are a later concern, out of scope here.

### 7.6 Frontend
Reproduce the prototype IA as the spec: left rail (+ bottom-bar collapse ≤860px, with role switch in header chip + Settings), full-width row components, drawers (quick review, assign questions), full-review workspace, teaching mode, session bar, jump palette. Respect `prefers-reduced-motion`. Keep the ember canvas/aurora backgrounds as implemented. Pagination/virtualize story and activity lists past ~100 rows. All times rendered client-side from UTC.

### 7.7 Explicit non-goals of this run
No deployment, no WordPress integration performed, no production auth, no repository changes. The prototype simulates: authentication (Settings toggle + role switch), voice transcription (labeled), the Back-to-Matrix link, "nudge student" pushes, and the second mentor's live session (Dr. Chen exists as seeded, fully attributed data).

<!-- SPLIT: 08-VERIFICATION-REPORT.md -->
## 8. Verification Report

**Automated (Playwright, headless Chromium, 1500×940 and 390×844):** 45 assertions, all passing, zero console/page errors (script: `verify5.js`). Coverage includes: left rail + view chip; capture hero preserved; full-width rows with all filters; quick vs full review; **the complete 10-step tracking loop** (student submits private story → appears Awaiting for mentor → mentor opens without status change (verified) → feedback + score + one-click Changes requested with mentor identity + timestamp → student badge/notification in plain language → notification opens story → student revises working version + resubmits → story enters "Revised — needs re-review" bucket → row-level one-click Approve → student approval notification + history showing who/what/when/previous values); 22-student roster with cohort filtering; My Activity today/custom/multi-mentor (Dr. Chen); assign-questions drawer incl. custom question + per-question strength; Teaching Mode names-hidden-by-default, live status action, compare; 1:1 session bar; persistence across reload; mobile layout.

**Fresh-context verifiers (two independent agents, no build context):**
- *New student + notification loop*: passed the 5-second test; found 4 critical issues — mobile role-switch/Back-to-Matrix unreachable, mobile home clipping, seeded timestamp contradictions (feedback "opened" before "sent"), history not time-sorted — plus 5 refinements (Interview Prep missing from the rail, "review" vocabulary on students' own drafts, duplicate notifications, empty-excerpt rendering, rating gloss). **All fixed and re-verified.**
- *New mentor + scale + classroom*: confirmed the 5-second mentor test, one-click statuses, open-≠-reviewed, queue re-bucketing, palette, activity filters, teaching mode; found 6 criticals — fabricated `feedbackSent` on status changes, "Today" using a rolling window and counting other mentors by default, "custom range: undefined" headline, "My rating" ambiguity in Mentor View, one-tap destructive question unassignment, mobile mentor-switch unreachable — plus 5 refinements (Draft chips in mentor queue, +N-more truncation, Story A/B anonymity labels, toasts over projected screens, "Viewing:" prefix on the student pill). **All fixed and re-verified.**

**Founder verification additions:** status visible on every row without opening (chip/inline dropdown) ✓; one-click status change from row, drawer, workspace, and teaching mode ✓; opening never marks reviewed ✓ (asserted); submission/review/feedback/revision/resubmission/approval carry distinct timestamps ✓ (feedbackSent only from real comments); student sees reviewer identity, time, what changed, and expected action ✓; mentor personal work review for today/week/custom range ✓; clean at 22 students / ~60 shared stories ✓; multi-mentor attribution end-to-end ✓ (Dr. Chen filterable in activity, attributed in history/comments).

**Known limitations (honest):** notifications are demonstrated for the demo student (Maya) — other students' inboxes aren't rendered (the write path is identical); authentication and the Matrix link are simulated; voice transcription inserts a labeled placeholder; persistence is per-browser; Google Fonts is the one network dependency (graceful system-font fallback verified); generated roster stories are intentionally short; craft/anatomy scores don't notify (teaching-side working data by design).

---
*End of combined handoff. Individual files: 01–08 alongside this document.*


---

<!-- SPLIT: 09-V5-ADDENDUM.md -->
# StoryForge V5 — Founder Review Round 1 Addendum (Product & Engineering Authority)

_Supersedes nothing; extends the v2 handoff set. Prototype: `storyforge-v5.html`. Everything not listed here is unchanged from the v2 documents._

## 1. Background environment system
Six environments, all dark: **Emberlight** (default — rising ember particles + aurora depth), **Aurora** (drifting light curtains), **Night Constellation** (twinkling star field with faint self-tracing constellation lines), **Deep Tide** (slow horizontal light currents), **Meridian** (gliding geometric contour lines), **Static Dark** (no motion). Implemented as one canvas engine (`#bgfx`, mode-switched, DPR-capped at 2; CSS aurora layers shown only for Emberlight/Aurora). Settings → "Background environment": preview cards, immediate application, active tag, persisted (`storyforge-bg` key), honored identically in Student and Mentor View. Reduced motion renders each environment as a single still frame that keeps its identity. Engineering: the canvas element requires explicit `width:100%;height:100%` (inset alone does not stretch a replaced element); rebuild particle/star state on mode change; never introduce light backgrounds.

## 2. Typography
Italics are reserved for authentic quotations (mentor feedback, story excerpts' quotation marks are kept but set roman), the full-story title, and brand hero headings. Row titles, section headers, labels, hints, empty states, and all functional copy are roman; hierarchy comes from weight/size/spacing/color.

## 3. Visual score language
Five-position stoplight dots (1 red #ff5470 → 2 orange #ff7a3d → 3 yellow #ffd76a → 4 yellow-green #a8e05f → 5 green #4ade9d). Component `dots(val, kind, label)`: S/M prefix chip distinguishes student (round dots) from mentor (square dots), a trailing numeral and full `title`/`aria-label` text mean color is never the only cue. Used in library rows, Quick Look, full story, question workshops, and mentor surfaces. Numeric 1–5 buttons remain the input control (selected button takes the stoplight color). Class namespace: `.sdot` (deliberately distinct from legacy `.sd`).

## 4. Story rows
Row = star · title (roman) + audio chip (🎙 + duration) · one-line excerpt · state/updated · **Lesson line** (gold LESSON tag + one-line takeaway; dashed quiet tag + "Not written yet" when absent) · birds · question count · S dots · M dots · status · Quick look / Open story. The lesson is first-class scanning information, not metadata.

## 5. Quick Look (student) / Quick Review (mentor)
Centered modal over a dimmed but visible library (student ~780px, mentor ~940px), with footer Previous/Next plus fixed side chevrons; Esc/backdrop closes; audio mini-player when an original recording exists; the lesson rendered as a gold callout directly under the story. All v2 drawer capabilities retained (statuses, scores, stars, classifications, questions, feedback).

## 6. Original audio model
`story.audio = {dur}` exists whenever a story was captured by voice (simulated playback in the prototype; production stores the real file). The record chain is explicit and displayed: **Original Audio (immutable) → Original Transcript (immutable "Original telling") → Working Version (editable)**. Player: play/pause, progress, elapsed/total, waveform accent; editing never touches the audio or transcript. New voice captures record their duration.

## 7. Interview Intelligence
**Question families** (`fam`): Core & Common, Behavioral, Clinical, CV & Application, Red Flag, Personal, plus Custom. Library expanded to 26 seeded MissionMed questions. **Interview Prep landing**: readiness strip (Ready / In progress / No story yet / follow-ups prepared), family cards with coverage bars acting as filters, searchable status-filterable question rows (family hue, story count, best mentor pairing dots, follow-up progress, status chip). Question status is computed: *Ready* = preferred story chosen AND a mentor-confirmed pairing with strength ≥3; *In progress* = any assigned story; else *No story yet*.

**Question Workshop** (per question, both roles, role-appropriate): assigned-story pair cards with per-pairing student and mentor strengths (`qa.sStudent`/`qa.sMentor` — the score belongs to the story–question relationship), preferred-answer selection (`student.qpref[qid]`), an editable "why this story works" (`qa.why`), mentor confirm/reject of student-proposed mappings, "could also answer this" suggestions (theme-matched, score-ranked), question-level coaching notes (`student.qcoach[qid]`, attributed + timestamped), a five-item gaps checklist, and — when no story exists — capture-new-story and assign entry points.

**Next Natural Questions** (`qa.fups[] = {q, src:'student'|'mentor'|'ai', clinical, prepared, note}`): scoped to one story-and-question answer; manual add, inline edit, reorder, prepared toggle, answer notes; You/DB/AI source badges. **AI suggestions**: optional (toggle), a review tray with per-suggestion "why it matters" and Accept / Accept & edit / Dismiss — suggestions never enter the list without explicit acceptance, and accepted items keep the AI badge. **Clinical mode** activates for clinical questions/stories (family, themes, or content signals): red-accented panel and badges, suggestions that probe differential, escalation, evidence, and management; the interface states that production requires a specialized medically-trained model — a generic model is not an acceptable substitute. Prototype suggestions are labeled as illustrative.

**Question Library** (`qlib` view): browse/search/filter by family and source (MissionMed / Custom), per-question usage counts, single-question add (mentor → shared; student → personal custom), open-workshop from any row, and a mentor **import flow**: paste from documents/spreadsheets (one per line, optional `| family`), parse → review screen with per-row family correction, near-duplicate detection (word-overlap ≥75%) flagged and unchecked by default, explicit confirm before anything becomes authoritative; imports are logged to coaching history. The right-side Assign drawer is retained for rapid assignment from any story or workshop.

## 8. Lifecycle, history, notifications
Unchanged from v2 and extended: workshop actions (assign/confirm/reject, pair strengths, preferred, coaching notes, follow-ups added by mentor) write audit events with actor/prev-value and produce plain-language student notifications; rapid same-story actions coalesce, with status texts preserved and "New feedback is attached." appended rather than overwritten. Toasts are suppressed during Teaching Mode (projected screens). Persistence key `storyforge-v5` (v5 schema adds `qpref`, `qcoach`, pair `fups/why`, `audio`).

## 9. Verification (this round)
48 automated Playwright assertions pass with zero console errors, covering: default animated environment, six-option switching + persistence + reduced-motion, de-italicized rows, dots + lesson lines + audio chips, centered Quick Look with side-arrow paging, audio playback progress, family cards/filtering, workshop depth (pairs, preferred, why, clinical mode, seeded and manually-added follow-ups, AI tray accept flow, gaps checklist), library import with duplicate flagging, mentor workshop parity with student notifications, core submit→review lifecycle, and Teaching Mode. A fresh-context design review then found four criticals — the environment canvas rendering at intrinsic 300×150 size, a crash opening workshops for unassigned questions, a CSS class collision breaking Home rows, and residual row-title italics — plus three refinements (coalescing swallowing status text, generic toast icons, activity lines omitting question names). All were fixed and the full suite re-run clean. Known limitations: audio and AI suggestions are simulated and labeled; Google Fonts remains the single network dependency (system-font fallback verified usable); notifications render for the demo student.
