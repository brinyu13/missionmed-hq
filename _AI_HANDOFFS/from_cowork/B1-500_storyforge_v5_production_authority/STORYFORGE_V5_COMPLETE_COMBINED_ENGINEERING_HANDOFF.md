# STORYFORGE_V5_COMPLETE_COMBINED_ENGINEERING_HANDOFF
B1-500 · StoryForge V5 · Canonical Product Lock and Production Engineering Handoff · July 26, 2026

This file contains the full contents of all package documents in order. It is Codex's primary briefing artifact. The canonical product artifact `storyforge-v5.html` (SHA-256 3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1) and the historical engineering base ship alongside it in the same folder.


======================================================================

# STORYFORGE_V5_CANONICAL_LOCK
B1-500 · StoryForge V5 · Canonical Product Lock · July 26, 2026

## 1. Canonical declaration

> **"StoryForge V5 is the only approved product, UI, UX, visual-design, interaction, navigation, and workflow authority. No earlier StoryForge prototype may be used to determine product behavior."**

The file **`storyforge-v5.html`** is STORYFORGE V5 — SOLE CANONICAL PRODUCT AUTHORITY. Where any document in this package, any historical document, or any code comment conflicts with the behavior of `storyforge-v5.html`, the canonical artifact wins automatically. One code-level caveat: the artifact contains superseded internal layers that are overridden at load time (notably a dead v2-era `renderPrep` near line 1381, shadowed by the live Interview Intelligence `renderPrep` near line 2642, and v2-era `rowHTML`/`renderQuick`/`renderSettings`/`persist` definitions replaced by later script blocks). **The behavior that actually executes in a browser is canon; dead code is not.** When in doubt, run the file and observe.

## 2. Revoked authority declarations

The following canonicity statements found in historical materials are **revoked**:
- `COMPLETE_COMBINED_HANDOFF.md` header: "Prototype: `storyforge.html` (v1, canonical, untouched) → `storyforge-v2.html` (this run's deliverable)" — revoked.
- `COMPLETE_COMBINED_HANDOFF.md` §7: "The prototype (`storyforge-v2.html`) is the behavioral spec: reproduce its labels, states, transitions, notification texts, and role rules exactly." — the rule survives, re-pointed: the behavioral spec is **`storyforge-v5.html`**.
- `STORYFORGE-HANDOFF.md` (v1) and `MENTOR-ENGINEERING-HANDOFF.md` (v1): all references to `storyforge.html` as entry file or "canonical" — revoked. These two documents are historical-only in their entirety.
- `09-V5-ADDENDUM.md` line "Supersedes nothing; extends the v2 handoff set" — struck. The addendum does supersede v2 statements; where the addendum and v2 text conflict, the addendum wins, and `storyforge-v5.html` wins over both.

## 3. Source hierarchy

1. **`storyforge-v5.html`** — sole product authority (executed behavior).
2. **`09-V5-ADDENDUM.md`** — supporting V5 product/engineering authority.
3. **This B1-500 package** — production engineering authority (never overrides 1–2 on product behavior).
4. **`COMPLETE_COMBINED_HANDOFF.md` §§4–7 (v2 sections)** — reusable engineering base **as amended** in §5 below; product/UI descriptions in §§1–2 are historical.
5. **v1 documents** — history only.

## 4. Product invariants (system laws — binding on all implementation)

1. Stories are private by default.
2. Student View and Mentor View are different authorized perspectives on the same underlying records.
3. Changing browser state cannot grant mentor or administrator permissions.
4. The student's original telling is preserved.
5. Original Audio, Original Transcript, and Working Version are separate concepts.
6. Later editing cannot silently overwrite the authentic original.
7. The lesson or learned strength is a first-class output that travels with the story.
8. Student and mentor scores are independent.
9. Student and mentor stars are independent.
10. Opening a story is not the same as reviewing it.
11. Every important mentor or student action is attributable and timestamped.
12. Story strength can differ by interview question; the rating belongs to the story–question relationship.
13. Student-proposed mappings and mentor-confirmed mappings remain distinguishable.
14. Follow-up questions belong to a specific story used for a specific interview question.
15. AI suggestions are optional, reviewable, editable, rejectable, and never silently authoritative.
16. Clinical follow-up intelligence must be medically aware and must not masquerade as validated clinical truth.
17. Imported questions do not become institutional authority without review.
18. Background preference applies across the application and persists.
19. Reduced-motion behavior preserves visual identity while stopping nonessential motion.
20. Every live control must work genuinely or display a truthful unavailable state.

Scope walls: do not reduce StoryForge to a generic story notebook or question list; do not expand into Personal Statement Studio, LOR Studio, MSPE generation, a full mock-interview platform, or a board-review product.

## 5. Rules for interpreting historical material (amendment register)

When mining `COMPLETE_COMBINED_HANDOFF.md` for engineering value, apply these amendments (each verified against the canonical artifact):

| Historical statement | V5 amendment |
|---|---|
| Quick Look / Quick Review is a right-hand drawer | Centered modal over the dimmed, visible library (student ≈780px, mentor ≈940px); footer Prev/Next + fixed side chevrons. The **Assign Questions** surface remains a right-side drawer — do not confuse the two. |
| Scores display as "4/5" text | Five-position stoplight dots (`red #ff5470 → green #4ade9d`), S/M keys (round student, square mentor), trailing numeral + full tooltip/aria; numeric 1–5 buttons are input-only. Numeric text survives only inside notification/history sentences. |
| Story rows: title/excerpt/scores/status | Rows additionally carry the audio chip (🎙 + duration), first-class gold Lesson line ("Not written yet" quiet state), roman titles. |
| "Prepare/Interview Prep = coverage ring + chips" | Superseded by Interview Intelligence: readiness strip, 7 family cards as filters, question rows → Question Workshop (pairs, per-pair dual strengths, preferred answer, why-it-works, coaching notes, gaps checklist), Next Natural Questions (`fups` with student/mentor/AI sources, clinical flags, prepared state, notes), AI tray, clinical mode, Question Library view + mentor import. |
| 12-question library | 26 seeded MissionMed questions across 6 families + Custom; questions carry `family` and `source`; production schema needs both plus import provenance. |
| "Keep the ember canvas as implemented" | Six-environment system: Emberlight (default), Aurora, Night Constellation, Deep Tide, Meridian, Static Dark; Settings picker; persisted (`storyforge-bg` in the prototype); reduced-motion = one still frame per environment; canvas requires explicit `width:100%;height:100%`. |
| Italic-heavy typography | Italics reserved for authentic quotations, full-story title, brand hero headings. Production should not carry neutralized `<em>` markup. |
| No audio playback | Original Audio (immutable) → Original Transcript (immutable) → Working Version (editable); mini-player in Quick Look + workspace; production stores real files. |
| `qa[]` = `{q, by, confirmed, sStudent, sMentor, t}` | Extended: pair `why` and `fups[]`; student `qpref[qid]` and `qcoach[qid]`. |
| Coalesced notifications take "newest text" | Full branch rule: newest text replaces, except status→non-status within the window, where the status wording is kept and "New feedback is attached." is appended once; timestamp refreshed either way. |
| localStorage keys `storyforge-proto3` / `storyforge-v2` | Dead. The prototype uses `storyforge-v5` + `storyforge-bg`. No production migration reads any of these keys. |
| v1 concepts: Spark/Forged stages, Desk, attention weights, Signature/Strong assessments, persona pill | Fully revoked vocabulary and mechanics. The surviving *principles* (opening ≠ reviewing; share ≠ consent-to-project; mentor writes are additive) are carried as rationale with V5 mechanics. |

**Carried forward unamended:** the v2 review-lifecycle state machine and transition/timestamp/notification table (§7.2), the nine-instant timestamp model, the role/permission ownership rules (§5) extended with V5 field ownership, the audit-event shape (§7.3) with an extended action enum, the notification trigger table (§4) with V5 additions, the Mentor Activity spec (§7.4), and the mentor workflow model (§6, with "drawer" → "centered modal").

## 6. Contradiction audit (this package)

A final contradiction audit was run across all B1-500 documents (see `STORYFORGE_V5_INDEPENDENT_VERIFICATION.md`). No document in this package identifies any artifact other than `storyforge-v5.html` as product authority. Any future document that does so is void on that point by this lock.


======================================================================

# STORYFORGE_V5_PRODUCT_TO_ENGINEERING_MAP
B1-500 · Feature accountability: every meaningful canonical capability → its production destination.

Legend — **Launch**: `GA` ships in first production release; `BETA-M` mentor-only beta behind a server flag; `POST` post-launch stage behind an evaluation gate; `GATED` visible with a truthful unavailable state until enabled. **Data authority**: `PG` = StoryForge Postgres (Supabase, RLS-enforced); `WP` = WordPress/Matrix; `R2` = object storage; `client` = per-user preference synced to PG. All timestamps UTC in `PG`, rendered in the viewer's locale. Every table row implies: server-side authorization test + Playwright UI-fidelity test against the canonical artifact.

## A. Prototype simulation → production destination (the 16 mechanisms that must not ship)

| # | Prototype mechanism (code anchor) | Production destination |
|---|---|---|
| 1 | 22 seeded students / ~50 stories / Dr. Brian + seed-only Dr. Chen (`STUDENTS`, `mk`, `upgradeStory`) | Real accounts from WP identity; mentor–student assignments table; seed data only in dev/staging fixtures. Derivation shims (`upgradeStory` status/score/bird mappings) are dropped — all fields authored by real actors. |
| 2 | `localStorage['storyforge-v5']` full-state blob written on every render (`persist`) | PG via authenticated API; optimistic UI with server confirmation; no client-authoritative state. Old keys (`storyforge-proto3`, `storyforge-v2`) are dead — no migration reads them. |
| 3 | Client role toggle `S.role` / `S.mentorAccess` (Settings switch) | WP-issued signed claims (role, eligibility, assignments); UI switch only renders for genuinely authorized mentors; every API call re-checked server-side (RLS + endpoint guards). Invariant 3. |
| 4 | Hard-coded student identity "Maya" (`stuById('maya')`, greeting, Settings strings) | Session-derived identity everywhere; zero hardcoded names. |
| 5 | Render-time privacy filtering (`visible()`/`shared()`) | Row-Level Security: private stories are structurally unreadable by mentors at the database layer; API never serializes them into mentor responses. |
| 6 | Notifications only for Maya (`notify` early-returns for other students) | Server-side fan-out to the actual recipient on event commit; unread state per user; deep links; coalescing (status text preserved, "New feedback is attached." appended) implemented at write time. |
| 7 | Simulated audio: timer + placeholder transcript; playback = interval animation (`#capMic`, `audioCardHTML`) | Real MediaRecorder capture → resumable upload → R2 object (immutable) → server transcription → immutable original transcript. Player streams via short-lived signed URL. |
| 8 | Canned AI suggestions (`aiSuggest` two hardcoded 4-item lists; dismiss not persisted) | Server-side AI proxy, structured output, provenance recorded, review states persisted (incl. dismissals). See launch states in §L. Clinical keyword-regex detection replaced by explicit clinical classification + model-side assessment. |
| 9 | Hardcoded `QBANK` (26 questions) + in-memory `CUSTOMQ` | Governed question tables in PG with family, source, provenance, draft/approved states; MissionMed institutional set seeded by migration. |
| 10 | Demo clock (`TODAY=2026-07-26`) mixed with real `NOW()` | Single real clock; server stamps authoritative UTC on commit; client never sets authoritative times. |
| 11 | Paste-only import with regex family guess + 75% word-overlap dedup | File ingestion (CSV/XLSX/DOCX/PDF/MD/TXT) parsed server-side; staged review; robust dedup; batch provenance + rollback. Paste remains as one input mode. |
| 12 | "Back to Matrix" toast stub | Real navigation to the Matrix hub URL (WP), preserving session. |
| 13 | Fabricated activity/history seeds (`upgradeStory` synthetic history, injected Dr. Chen rows) | All history rows produced by real audited actions; multi-mentor attribution from real actor identity. |
| 14 | In-memory capture draft (`capDraft`, lost on reload despite "nothing was lost") | Durable server-side draft autosave (or resilient local draft + server sync); the promise in the copy must be true. |
| 15 | Single-browser shared state; cross-role demo by toggling roles in one session | Multi-user backend; per-session auth; freshness on navigation (polling or realtime for notifications/queue counts); optimistic-concurrency conflict handling on working-version edits. |
| 16 | Dead v2 code layers overridden at load (`renderPrep` @~1381 etc.) | Production carries only the final executed layer; dead layers must not be ported. |

## B. Global shell & environment

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Left rail (role-aware tabs, badges), ≤860px bottom bar | As canonical; badge counts from server queries | PG | Both | GA |
| Header: view chip (role switch when authorized), search/palette, mentor "Viewing: student" selector + signed-in chip | As canonical; switch renders only with real mentor authorization | WP claims | Both | GA |
| Role switch (rail foot + header chip + Settings) with truthful gating | Server-verified; unauthorized users never see it (Invariant 3) | WP | Mentor-authorized | GA |
| Mentor privacy banner (per-student submitted counts) | Counts computed server-side from authorized rows only | PG | Mentor | GA |
| Omni search (student full-text), mentor jump palette (K, /) | Server-backed search (title/body/lesson; students+stories for mentors), debounced | PG | Both | GA |
| Keyboard map (N / K / / / Esc stack) | As canonical | — | Both | GA |
| Toasts (attributed, timestamped; suppressed in Teaching Mode), burst on save | As canonical | — | Both | GA |
| Six background environments + Settings picker + persistence + reduced-motion still-frames | As canonical; preference synced per user (`PG` user_settings) so it follows the account across devices | client→PG | Both | GA |
| Back to Matrix | Real WP navigation | WP | Both | GA |
| Reset demo data | **Removed in production** (dev/staging only) | — | — | n/a |

## C. Capture & original preservation

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Title-first "The One Where…" capture; prefix toggle; optional lesson/rating/themes; save-private | As canonical; story created `private` | PG | Student | GA |
| Voice capture (record, waveform, timer) | Real MediaRecorder; interruption recovery; resumable upload to R2 | R2+PG | Student | GA |
| Live transcription of voice into the telling | Server transcription job with retry; transcript becomes the immutable original telling; failure state truthful ("transcription pending/failed — audio preserved") | PG | Student | GA |
| Draft protection ("nothing was lost") | Durable autosave (server) restoring across reloads/devices | PG | Student | GA |
| Capture from a memory prompt or a question gap (pre-linked suggestion + theme) | As canonical | PG | Student | GA |

## D. Story Library (student)

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Full-width rows: star, roman title, unread ember, audio chip + duration, excerpt, dev state, updated-ago, gold Lesson line (+ quiet empty state), birds, question count, S/M stoplight dots, status chip, Quick look / Open story | As canonical; paginated/virtualized past ~100 rows | PG | Student | GA |
| Search + status/sort/starred/bird/position filters; count; empty states | Server-side query params | PG | Student | GA |
| Status-count chips on Home deep-linking to filtered library; Unfinished stories panel ("Finish it") | As canonical | PG | Student | GA |

## E. Quick Look / Quick Review (centered inspection)

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Centered modal over the visible library; Esc/backdrop close; Prev/Next (footer + side chevrons) through the active list context | As canonical | — | Both | GA |
| Student contents: audio mini-player, story, gold lesson callout, status + timestamps, self-rating input, star, classifications, question summary with per-pair dots, mentor feedback, Submit/Resubmit | As canonical | PG | Student | GA |
| Mentor additions: one-click statuses, mentor score, mentor star, classification edits, feedback composer, Assign drawer | As canonical; all writes audited + notify | PG | Mentor | GA |

## F. Full story workspace

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Original Audio card (play/pause/progress/duration, "preserved forever") + chain caption | Signed streaming URL after authorization; audio object immutable | R2 | Both | GA |
| Original telling (read-only) / Working version (editable) tabs; edits after feedback set `revised`, auto `changes→awaiting`, logged | As canonical; original transcript immutable at DB layer | PG | Student writes; mentor reads | GA |
| Lesson block (first-class callout, editable by student, logged) | As canonical | PG | Student | GA |
| Reflections + mentor "asks" (highlighted; first answer marks responded) | As canonical; asks notify | PG | Both (role-split) | GA |
| Review-status card: chip, hint, nine-instant timestamp block, Submit/Resubmit (student) / one-click statuses (mentor) | As canonical; transitions per lifecycle spec; `firstOpened` stamped on first mentor open without status change (Invariant 10) | PG | Both | GA |
| Scores card (independent S/M ratings + stars, prev values logged) | As canonical | PG | Both | GA |
| Classifications (Birds, Ideal For Position) editable by either role with attribution; mentor edits notify | As canonical | PG | Both | GA |
| "Where it could serve" uses; mentor writes are labeled suggestions, never edits | As canonical | PG | Student owns; mentor suggests | GA |
| Mentor feedback thread (quoted, attributed, timestamped; `feedbackSent` only from real comments) | As canonical | PG | Mentor writes | GA |
| History card: curated 6 + full expander; who/action/detail/(was: prev) | Rendered from append-only audit events | PG | Both (visibility rules) | GA |

## G. Review lifecycle & operational tracking

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Statuses: Private → Awaiting review → In review → Changes requested → Reviewed → Approved; revised-resubmission path | State machine enforced server-side; students can never set mentor states and vice versa | PG | Both | GA |
| Nine tracked instants incl. feedbackOpened only when actually seen | Server-stamped | PG | Both | GA |
| One-click status from rows / modal / workspace / Teaching Mode, saved with mentor identity + time | As canonical | PG | Mentor | GA |
| Review Queue: five state-derived buckets, cohort filter, cross-student rows | Server queries; scales to hundreds of stories | PG | Mentor | GA |
| My Activity: default self, mentor/student/cohort/type/period incl. custom range; rows deep-link | Query over audit events | PG | Mentor | GA |

## H. Mentor surfaces

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Mentor Home: three actions + outstanding-work counts + named students (+N more) + today/week activity | Server aggregates | PG | Mentor | GA |
| Students roster: search, cohort (Session A/B/C), five sorts, per-student Submitted/To-review/Unscored counts | Server queries | PG+WP | Mentor | GA |
| Per-student workspace: profile, coaching history, scoped Interview Prep, Teach-from-library, Start 1:1, filtered/sorted submitted-story rows (incl. bird/position/question filters) | As canonical; only assigned students visible | PG | Mentor | GA |
| 1:1 session bar: auto agenda, open ≠ covered, end-session log to coaching history | As canonical | PG | Mentor | GA |
| Teaching Mode: story pickers across authorized students, compare, Hide-names (default ON from rail entry, OFF from a named student), Story Anatomy live 0–3 scoring, live status/score/star/comment/assign actions (audited + notify), toast suppression | As canonical; anonymization is presentation-layer only, records attribute normally | PG | Mentor | GA |
| Coaching history per student (sessions, imports, library additions) | Append entries from real events | PG | Mentor writes; student-facing where canonical shows it | GA |

## I. Notifications

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Trigger set: feedback, asks, status changes (distinct copy per status), score updates, stars, classification changes, question assignment batches, strength scoring, confirm/reject of mappings, preferred-answer set, coaching notes, mentor-added follow-ups | Generated in the same transaction as the audit event; recipient = story's student (mentor-side awareness remains queue-derived, no mentor inbox) | PG | Student receives | GA |
| Coalescing (exact canonical branch rule): same-story unread notification within 5 min → **newest text replaces**, *except* when the existing text is a status message and the new event is non-status, in which case the status wording is kept and "New feedback is attached." is appended once; timestamp refreshed either way | Write-time server logic | PG | — | GA |
| Rail badge, Home preview with unread dots, Notifications page, mark-all-read, click-through opens story and marks read | As canonical; count freshness via polling or realtime | PG | Student | GA |
| Optional email digests | Not in first release | — | — | POST (founder decision) |

## J. Interview Intelligence

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Landing: readiness strip (Ready/In progress/No story yet, follow-ups prepared X/Y), 6 family cards with coverage bars as filters — plus a Custom card that appears when custom questions exist (7-family taxonomy) — searchable/filterable question rows with best-pair dots + follow-up progress + computed state | State computed server-side per student per the canonical `qStateOf` rule | PG | Both (mentor scoped to student) | GA |
| Question Workshop: pair cards (per-pair independent S/M strengths, input pickers, confirmed vs suggested state), Preferred answer (one per question), editable "why this story works", mentor Confirm/Reject of student proposals, "Could also answer this" suggestions, Capture-new-story entry, coaching notes (mentor-authored, attributed), 5-item gaps checklist | As canonical; all writes audited; mentor actions notify | PG | Both (role-split) | GA |
| Next Natural Questions per pair: add/edit/reorder/remove, prepared toggle, answer notes, source badges — "You" / mentor initials (derived from the actual acting mentor, never a hardcoded label) / "AI" — clinical ✚ flags | As canonical; persisted per pair | PG | Both | GA |
| AI follow-up suggestions (general): tray with why-it-matters; Accept / Accept & edit / Dismiss; on/off toggle; provenance badges persist | Real model behind server proxy; dismissals persisted; structured output; prompt/model version recorded | PG+AI | **Mentor** | **BETA-M** |
| Student-facing AI suggest button | Truthful gated state at launch ("AI suggestions are in mentor review — your mentor can generate and share them"); enabled after beta review | — | Student | GATED |
| Clinical follow-up mode (red-accented panel/badges, medically-aware intent) | Manual-first at GA: mentors author clinical follow-ups with full clinical badging; the clinical AI generator ships only after clinical evaluation passes | PG(+AI later) | Both (manual), Mentor (AI later) | GA manual / POST AI |
| Question Library view: browse/search/filter by family + source, usage counts, single add (mentor→shared; student→personal custom), open-workshop | As canonical; governance states added (draft/approved for institutional additions) | PG | Both (role-split) | GA |
| Import: paste + file upload (CSV/XLSX/DOCX/PDF/MD/TXT) → parse → staged review (per-row family, duplicate flags unchecked by default) → explicit confirm → provenance + coaching-history log; batch rollback | Server-side parsing with malicious-file and formula-injection defenses | PG+R2 | Mentor/Admin | GA (paste+CSV/XLSX at minimum; DOCX/PDF may follow fast — see plan) |

## K. Settings & account

| Capability | Production behavior | Data | Roles | Launch |
|---|---|---|---|---|
| Signed-in identity, mentor-access display, timezone note, view switch | Real session data; mentor-access toggle becomes read-only display of the WP-derived entitlement (the prototype's self-serve toggle is demo-only) | WP | Both | GA |
| Background picker (six environments) | As canonical, synced per user | PG | Both | GA |

## L. AI launch summary (Invariants 15–16, 20)

- **General Next Natural Question suggestions:** mentor-only beta at GA (server flag). Students get real value day one through mentor-generated, mentor-curated suggestions plus fully-functional manual follow-ups. Student-facing button shows a truthful gated state. Promotion to students after beta review of quality, cost, and abuse surface.
- **Clinical follow-up intelligence:** manual mentor workflow first (fully supported at GA — clinical badging, clinical panel, mentor-authored questions). The specialized clinical generator ships post-launch only after a documented clinical evaluation (hallucination testing, mentor approval workflow) passes. No generic model may be presented as the clinical layer (Invariant 16).
- **No fake AI anywhere in production:** the prototype's illustrative `aiSuggest` lists must never ship behind a live button.

## M. Accessibility, responsiveness, performance (cross-cutting, GA)

Reduced-motion still-frames per environment; color never the sole cue (dots carry count + numeral + aria-labels); keyboard operability of modals/drawers with focus management (production must add focus trapping + return-focus, `aria-modal`, and labelled controls where the prototype relies on `title` only); ≤860px bottom-bar layout; virtualized lists at scale; audio player accessible controls; WCAG 2.1 AA as the bar.


======================================================================

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


======================================================================

# STORYFORGE_V5_HIGH_RISK_SYSTEMS
B1-500 · Implementation and verification authority for the systems where wrong assumptions harm real users. Each section states the decisions Codex must honor, the boundary that must be protected, and the evidence that proves it works.

## 1. Access and privacy

**Decisions.** Entitlement chain: WP identity → 360 eligibility (LearnDash or the actual source found in Phase 0) → StoryForge JWT claims → RLS. Mentors see only *assigned* students, and within them only *non-private* stories. Multiple mentors per student are first-class: `mentor_assignments` is many-to-many; every mentor action attributes its real actor (no global "the mentor"). Admin access is least-privilege: admins administer (assignments, imports, question governance) and do **not** read private stories by default; any support/emergency read path exists only if the founder approves a written policy, and every such access writes a visible audit event. Revoked eligibility locks the account at next token refresh with a truthful screen; data is retained per the retention policy, not deleted by revocation.

**Boundary.** No client input may influence authorization: role, mentor status, assignment, and story visibility derive exclusively from server-verified claims and rows. The prototype's Settings "mentor access" toggle becomes a read-only display.

**Evidence.** An authorization test matrix executed against real Postgres: for each table/RPC × each role (student-self, student-other, assigned mentor, unassigned mentor, admin, anonymous) assert allow/deny — including: mentor cannot select a private story by id; student cannot write `mentor_score`/status transitions reserved to mentors; unassigned mentor sees zero rows for a student; forged/expired JWTs rejected; a devtools-crafted request cannot do anything the UI hides. Cross-student leakage probes on every list endpoint. These tests are release-blocking.

## 2. Data integrity

**Decisions.** `story_originals` (original transcript + audio reference) and `audit_events` are INSERT-only, enforced by absent grants **and** raise-exception triggers. Working Version is the only editable narrative. Lifecycle transitions run through server RPCs implementing the canonical state machine; `feedback_sent` is stamped only by real comments; `feedback_opened` only on actual first view; opening ≠ reviewing. All authoritative timestamps are server-side UTC. Archival/deletion: soft-delete with audit trail; hard deletion only via a founder-approved retention/erasure policy (a student's right to leave with their data is a founder decision, §Founder). Backups: rely on Supabase PITR (verify tier) + scheduled logical dumps; R2 versioning/immutability for audio; quarterly restore test.

**Evidence.** Trigger tests proving UPDATE/DELETE on immutable tables fail for every role including service role where feasible; state-machine tests for every legal and illegal transition; migration up/down rehearsed on a staging copy; one documented backup-restore drill before GA.

## 3. Audio and transcription

**Decisions.** Browser capture via MediaRecorder (Opus/WebM primary; AAC/MP4 fallback for Safari — verify support matrix in implementation and publish it in-product). Chunked/resumable upload to R2 via short-lived signed PUTs; a dropped connection resumes; an abandoned recording leaves a recoverable local buffer until upload confirms. The audio object is immutable once the story is saved. Playback via short-TTL signed GET issued only after authorization. Transcription server-side (provider chosen in implementation; Whisper-class accuracy bar), with retry and a truthful failed state ("Transcription failed — your audio is preserved; retry or type the telling"); the transcript becomes the immutable original telling only on student save. Mobile: record + playback must work on current iOS Safari and Android Chrome. Accessibility: player fully keyboard/screen-reader operable; transcript is the accessible equivalent of audio. Cost/retention: audio retained for the account's life under the founder retention policy; storage cost modeled in the release plan. Privacy: capture UI carries the existing guidance voice; add an explicit prompt reminding students not to include patient-identifying information; recordings are treated as sensitive data end-to-end (TLS, private buckets, no third-party analytics touching content).

**Evidence.** E2E: record → interrupt (refresh mid-upload) → recover → transcript arrives → original immutable after later edits; playback authorization test (signed URL for another student's audio fails); browser-matrix smoke on the four major engines; transcription-failure path renders truthfully.

## 4. Question Library and imports

**Decisions.** Provenance on every question: `missionmed | mentor | student | imported | ai`, plus `owner_student_id` for personal customs and `import_batch_id` for imports. Institutional additions/imports enter as `draft` (or the staged `review` batch) and become `approved` only through explicit mentor/admin confirmation (Invariant 17). Ingestion accepts paste, CSV, XLSX first-class at GA; DOCX/PDF/MD/TXT extractors follow immediately after (same pipeline, more parsers) — no format silently pretends to parse. Parser failures produce per-row errors, never partial silent commits. Large imports are batched with progress and a size cap; duplicate detection combines normalized-exact match and near-duplicate similarity, flagged and unchecked by default exactly as the canonical review screen shows. Committed batches can be rolled back (batch id cascades to `retired`, never hard-deletes used questions; pairs referencing a retired question keep working with a "retired" marker). Malicious files: MIME + extension + size validation, sandboxed parsing, no rendering of embedded content, spreadsheet cells sanitized against formula injection (`=`, `+`, `-`, `@` prefixes neutralized on any re-export).

**Evidence.** Parser test corpus incl. malformed files; injection corpus (formula cells, oversized files, wrong MIME); duplicate-detection fixtures; batch rollback test; authorization tests (students cannot write to the shared library; mentors cannot edit another student's personal customs).

## 5. AI and clinical intelligence

**Decisions.** All AI behind the server proxy; no keys or prompts in the client. Structured output (JSON schema: `{text, why, clinical}` list) with strict validation; prompt + model version persisted on every suggestion (provenance, Invariant 15); dismissed/accepted/edited states persisted. PHI minimization: strip student identity, redact obvious identifiers before provider calls; provider chosen with a no-training data-processing agreement (provider choice is an implementation decision with founder sign-off on the DPA). Prompt-injection resistance: story text is data, never instructions — delimited, with an instruction-hierarchy system prompt; outputs length- and count-capped. Rate limits per user + global budget caps with truthful "limit reached" states. Unavailable = truthful gated copy, never a canned fake (the prototype's illustrative lists must not ship). **Launch:** general suggestions = mentor-only beta; student button gated with truthful copy; clinical generator = post-launch behind a clinical evaluation gate — a written eval set (representative clinical stories), hallucination testing, mentor-panel approval, and a documented pass, using a medically-capable configuration; until then clinical mode is the fully-functional manual mentor workflow. Staged release order: mentor beta → student general → clinical mentor beta → clinical student, each gated on review.

**Evidence.** Proxy contract tests (schema validation, injection corpus, redaction unit tests); flag tests proving gated states render truthfully with AI off; cost-cap tests; the clinical eval report itself is the gate artifact.

## 6. Notifications and audit

**Decisions.** Events and notifications are written in the same transaction as the mutation; the notification is proof of a real event (Invariant: "a notification represents a real event"). Recipient is the story's student; mentors get no inbox — their awareness is the state-derived queue. Unread → read on open; deep links land on the exact story/workshop. Coalescing per canon (status wording preserved; feedback appended). Multi-mentor attribution comes from the event's actor. Optional email is post-GA (founder decision). Audit rows carry actor, role, action, prev/new values, source surface (add a `surface` column value set: `library | quick | workspace | workshop | teach | import | system`), and are tamper-resistant (append-only + alert on violation attempts).

**Evidence.** Round-trip E2E per trigger type; coalescing unit tests; attribution tests with two mentor accounts; audit immutability tests; deep-link tests from a cold session (auth interstitial → correct story).

## 7. Retention, accessibility, performance, operational safety

**Retention:** founder policy required for: audio retention length, account deletion/export, post-Match archival. Defaults until decided: retain everything, delete nothing hard, export available on request via admin.
**Accessibility:** WCAG 2.1 AA target; the map's §M items are release criteria for core flows (capture, library, quick look, workspace, notifications, workshop).
**Performance:** p75 route render < 2s on mid-tier hardware with 300-story libraries; environment engine ≤ ~2ms/frame budget (DPR-capped, element-count-capped) and fully paused when tab hidden; list virtualization past ~100 rows; no scroll jank with the animated background (verify with tracing).
**Operational safety:** feature flags for AI and imports; canary-able static deploys; alerting on auth failures spike, notification backlog, transcription failure rate, AI spend; runbook entries for each alert; secrets in platform secret stores only; least-privilege service tokens.


======================================================================

# STORYFORGE_V5_IMPLEMENTATION_AND_RELEASE_PLAN
B1-500 · Recommended execution program for Codex (GPT-5.6 Sol). Large coherent stages sized for long-horizon runs; founder gates only at genuine irreversibility. Codex may improve the internal plan where repository evidence supports it, recording the reason, provided the canonical product and invariants are preserved.

## Stage 0 — Discovery and verified baseline
**Outcome:** the nine discovery items in Architecture §9 answered with evidence; a written Phase 0 report (file paths, screenshots, query results); architecture confirmations or recorded adaptations; AGENTS.md read (and created/extended for StoryForge conventions if absent).
**Dependencies:** repository + environment access. **Parallel:** repo inventory, WP/LearnDash inspection, Supabase/Cloudflare inspection can run as parallel read-only investigations.
**Completion:** every "unverified" item in the architecture is marked verified/adapted; migration scope (legacy data yes/no) decided; **founder gate only if** discovery reveals a materially different environment than the architecture assumes (e.g., no Supabase at all).
**Rollback:** none — read-only.

## Stage 1 — Foundation: schema, authorization, trust primitives
**Outcome:** Supabase schema + RLS + immutability triggers migrated; WP→StoryForge JWT bridge working end-to-end in staging; lifecycle RPCs; audit + notification write paths (transactional); seed fixtures (the 26-question MissionMed library; dev-only demo roster); CI running the authorization test matrix and state-machine tests.
**Dependencies:** Stage 0. **Parallel:** JWT bridge (WP plugin work) ∥ schema/RLS ∥ CI scaffolding — three independent tracks; coordinate on the claims contract first.
**Tests/evidence:** full auth matrix green against real Postgres; immutability trigger tests; transition tests; bridge E2E (real WP staging login → authorized query).
**Completion:** a script can demonstrate: student creates story (private) → mentor cannot read it → student submits → assigned mentor reads, unassigned cannot — all via raw API.
**Migration/rollback:** new tables only; reversible; no founder gate.

## Stage 2 — Student experience
**Outcome:** the complete canonical Student View live against the real backend: shell + rail + six environments + settings sync; capture (text + real voice recording, resumable upload, transcription with truthful states, durable drafts); Story Library rows/filters; centered Quick Look; full workspace (originals chain, lesson, reflections, statuses, timestamps, scores, stars, classifications, uses, history); Notifications page + badge.
**Dependencies:** Stage 1. **Parallel:** audio/transcription pipeline ∥ library+workspace UI ∥ notifications UI (worktree-isolated; shared component/tokens package landed first).
**Tests/evidence:** Playwright student suite incl. capture-with-interruption, submit flow, notification round-trip (using a mentor test account via API), screenshot comparison with the canonical artifact on Home/Library/Quick Look/Workspace; axe checks.
**Completion:** a real student account can live the full pre-mentor experience with nothing simulated.

## Stage 3 — Mentor experience
**Outcome:** Mentor Home, Students roster (cohorts, sorts, counts), per-student workspace with filters, five-bucket Review Queue, My Activity (filters incl. custom range), centered Quick Review with one-click statuses, full-review powers (feedback, asks, scores, stars, classifications, suggestions), Teaching Mode (compare, hide-names rules, Story Anatomy, live actions), 1:1 sessions, coaching history.
**Dependencies:** Stage 2 (shared components + lifecycle live). **Parallel:** queue/activity ∥ teaching/1:1 ∥ quick-review powers.
**Tests/evidence:** mentor Playwright suite; two-mentor attribution tests; the canonical 10-step loop E2E (student submit → mentor open-without-review → review actions → status → student notification → revise → resubmit → re-review bucket → approve → history); authorization probes from the mentor session.
**Completion:** two real mentor accounts and one student account can run the entire coaching loop with correct attribution and privacy.

## Stage 4 — Interview Intelligence + Question Library + AI (flagged)
**Outcome:** Prep landing (families, readiness), Question Workshops (pairs, dual strengths, preferred, why, coaching notes, gaps), Next Natural Questions (manual, full CRUD + prepared + notes + sources), Question Library view + governance states, import pipeline (paste + CSV/XLSX at minimum; remaining parsers immediately after), Assign drawer; AI proxy + general-suggestion mentor beta behind a server flag; student AI button gated truthfully; clinical mode manual-first.
**Dependencies:** Stage 3. **Parallel:** workshops UI ∥ import pipeline ∥ AI proxy.
**Tests/evidence:** workshop E2E both roles; import corpus incl. malicious files + rollback; AI contract/injection/redaction tests; flag-state tests (AI off = truthful gates, zero fake responses).
**Completion:** the full V5 Interview Intelligence experience works for real accounts, with AI exactly as gated in the map §L.

## Stage 5 — Migration, staging hardening, UAT — **founder gate**
**Outcome:** staging environment fully populated (real WP-staging SSO; migrated legacy data if Stage 0 found any, with a validation report; otherwise production seed = question library only); performance pass at scale fixtures (300-story libraries, 100+ students); accessibility pass; backup-restore drill; rollback drill; complete E2E suite green in staging; UAT script for the founder (student persona + mentor persona walkthrough).
**Founder gate:** approve staging UAT + retention/access policy decisions before production.
**Migration/rollback:** legacy migration rehearsed with down-path or restore point; irreversible steps enumerated explicitly at the gate.

## Stage 6 — Production deployment and post-deployment verification — **founder gate to cut over**
**Outcome:** production infrastructure provisioned (DNS/path under Matrix, secrets, buckets, flags off-by-default for AI), forward migration run, smoke suite against production (synthetic accounts), monitoring + alerts live, runbook published, rollback verified available (asset rollback + DB PITR point recorded pre-migration).
**Post-deployment verification:** the 10-step loop executed by real founder-designated pilot accounts; authorization probes against production; audio round-trip; notification latency check. A written go-live report with evidence.
**Rollback:** documented one-command asset rollback + PITR procedure; decision criteria pre-agreed.

## Stage 7 — Post-launch: AI promotion and clinical intelligence
**Outcome:** mentor-beta review → student general-AI enablement decision; clinical evaluation program (eval set, hallucination testing, mentor panel) → clinical generator mentor beta → student clinical, each behind its flag with a written gate report. Optional email digests decided/implemented here.
**Founder gates:** each AI promotion step.

## Program rules
- Plan before each stage's broad multi-file changes; keep the spec (canonical artifact + this package) frozen — implementation adapts, product does not.
- Worktree/branch isolation for parallel tracks; migrations and API contracts change only on the integration branch with coordinated review.
- Continuous testing: every stage keeps CI green; a failing check is fixed before new scope (stop-and-fix).
- Evidence discipline: no stage is "done" by narrative — each completion claim links to tests, screenshots, or logs. Demo behavior is never reported as production behavior.
- Support & monitoring after GA: alert triage runbook, weekly audit-anomaly review, AI spend review, quarterly restore drill.


======================================================================

# STORYFORGE_V5_CODEX_5_6_SOL_EXECUTION_PROMPT
B1-500 · Copy-paste execution contract for Codex.

## Operator setup (run before pasting the prompt)

Confirmed current selections (first-party OpenAI guidance, July 2026): the flagship coding model is **GPT-5.6 Sol**, API slug **`gpt-5.6-sol`** (the `gpt-5.6` alias also resolves to Sol in Codex docs). "Ultra" is not a model — it is a multi-agent reasoning mode (four parallel agents by default, Plus-and-higher plans, with a CLI usage warning). The founder's "Codex 5.6 Sol Ultra" therefore means: **model `gpt-5.6-sol` + Ultra reasoning when warranted**.

```bash
codex \
  --model gpt-5.6-sol \
  -c model_reasoning_effort="xhigh" \
  --sandbox workspace-write \
  --ask-for-approval on-request \
  -c 'sandbox_workspace_write={ network_access = false }'
```

- `xhigh` is the confirmed config literal for long agentic work; escalate to **`max`** or **Ultra** in-session via `/reasoning` for the hardest stages (Stage 1 authorization design; Stage 5 migration rehearsal) — the exact TOML strings for max/ultra were not confirmed in first-party docs at research time, so set them interactively and record what the CLI accepts.
- Enable network access only for tasks that need it (dependency installs, provider calls in staging), and never during credential or migration handling.
- Use `--ask-for-approval untrusted` for the migration/credential phases of Stages 5–6.
- Long-horizon pattern per OpenAI's guidance: keep four durable files in the repo — frozen spec (this package + the canonical artifact), living plan with milestone acceptance criteria, runbook, and an append-only work log — and verify (lint/type/test/build) at every milestone with a stop-and-fix rule.
- Recovery: `codex resume --last` continues an interrupted session; `/compact` when context grows; re-read the work log after any resume.
- Parallelism: spawn subagents only for truly independent tracks; isolate overlapping edits with `/worktree`; `codex cloud exec` for background-safe independent tasks.

---

## THE PROMPT (paste everything below into Codex)

**Title:** B1-500 — StoryForge V5 production implementation (Stage 0 authorized; subsequent stages per plan)

**Goal.** Implement StoryForge V5 for production inside the MissionMed ecosystem, exactly as specified by the canonical artifact and the B1-500 engineering authority, so that real students and mentors can trust it: private means private, saved means persisted, submitted means received, reviewed means a real reviewer acted, originals cannot be silently overwritten, notifications represent real events, AI is clearly AI, and every visible control works or truthfully explains why it is unavailable.

**Authority and precedence.**
1. `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html` — StoryForge V5 is the only approved product, UI, UX, visual-design, interaction, navigation, and workflow authority. No earlier StoryForge prototype may be used to determine product behavior. **Pin:** SHA-256 `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`. Phase 0 item 0: verify this file is present and hash-matching before anything else; if it is missing or differs, stop and surface it. Executed behavior is canon; the file contains dead overridden layers (e.g., a superseded `renderPrep` near line 1381) — never implement from dead code; run the file and observe.
2. The rest of `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/` — read every document, fully, before writing code: STORYFORGE_V5_CANONICAL_LOCK (invariants + historical-material rules), STORYFORGE_V5_PRODUCT_TO_ENGINEERING_MAP (feature accountability + the 16 simulations that must not ship), STORYFORGE_V5_PRODUCTION_ARCHITECTURE (recommended architecture + draft DDL + your Phase 0 discovery list), STORYFORGE_V5_HIGH_RISK_SYSTEMS, STORYFORGE_V5_IMPLEMENTATION_AND_RELEASE_PLAN, STORYFORGE_V5_PROJECT_MEMORY, STORYFORGE_V5_INDEPENDENT_VERIFICATION.
3. `HISTORICAL_ENGINEERING_BASE_COMPLETE_COMBINED_HANDOFF.md` (same folder) — historical, **except** that the sections CANONICAL_LOCK §5 lists as "carried forward unamended" (the v2 review-lifecycle state machine and its transition/timestamp/notification table, the role/permission ownership rules, the audit-event shape, the notification trigger table, the Mentor Activity spec, the mentor workflow model) are **binding engineering input**, applied with the LOCK §5 amendments. Product behavior still comes from V5 in every case.
4. Repository AGENTS.md files — inspect before changing anything; follow repo conventions; create/extend a StoryForge AGENTS.md section recording conventions you establish.
All other historical StoryForge documents and prototypes are engineering history only; where anything conflicts with `storyforge-v5.html`, V5 wins automatically.

**The 20 product invariants in CANONICAL_LOCK §4 are binding.** If any implementation choice would violate one, stop and surface it rather than "solving" it.

**Context.** The canonical artifact is a browser prototype: all authority is client-side, persistence is localStorage, auth/roles/notifications/audio/AI/imports are simulated (the map's §A lists all 16 mechanisms with code anchors). Your job is to make every capability real per the map, on the architecture recommended (WordPress = identity/eligibility; Supabase Postgres + RLS = records and enforcement; R2 = audio/files; server functions for signed URLs, transcription, AI proxy, imports, notifications). The architecture document separates verified facts from founder-supplied environment statements from unknowns — treat the unknowns as your Phase 0.

**Stage 0 (authorized now).** Resolve the nine discovery items in PRODUCTION_ARCHITECTURE §9 with recorded evidence (paths, queries, screenshots) before any architecture-dependent implementation. Where findings contradict the recommended architecture, adapt, record the reason in the work log and PROJECT_MEMORY, and preserve the invariants. Produce a Phase 0 report. Then proceed through Stages 1–4 of the IMPLEMENTATION_AND_RELEASE_PLAN as authorized reversible work, and prepare Stages 5–6 up to their founder gates.

**Working rules.**
- Plan before broad multi-file changes (plan mode); keep milestones small enough to verify in one loop; stop-and-fix on any failing check before new scope.
- Use parallel subagents only for genuinely independent tracks (e.g., audio pipeline ∥ library UI ∥ notifications); isolate overlapping work in worktrees/branches; migrations and API contracts change only on the integration branch.
- Implement reversible authorized work without re-asking permission. Pause ONLY for: destructive actions, irreversible production changes (production migrations, DNS cutover, data deletion), credentials or access you lack, true scope changes, or founder-only decisions (retention policy, support-access policy, AI provider DPA, UAT approval, production go-live, AI promotion steps).
- Test continuously: the authorization matrix (every table/RPC × every role, positive and negative, against real Postgres) is release-blocking; state-machine tests; contract tests; Playwright E2E for Student View and Mentor View independently, including the canonical 10-step submit→review→revise→approve loop and the notification round-trip; screenshot comparison against the canonical artifact for key surfaces; axe accessibility checks.
- Verify the real UI in a real browser (Playwright); use screenshots for visual comparison with the canonical artifact.
- Test authorization server-side by crafting raw API requests that the UI would never make — the client is untrusted.
- Verify migration up/down behavior on a staging copy before any founder gate; record a PITR restore point before irreversible migrations.
- Never report demo/seeded behavior as production functionality. Audit every progress claim against tool evidence before reporting it.
- Continue until the authorized stage is complete or you are genuinely blocked; if blocked, state the exact missing input.

**Deliverables and records.** Save all implementation records under `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/`:
- ticket-scoped implementation notes per stage/track;
- verified test evidence (reports, screenshots, logs) — linked from every completion claim;
- migration and deployment records (including restore points and rollback rehearsal results);
- unresolved blockers with exact missing inputs;
- one full combined Markdown handoff containing every Markdown deliverable you produce;
- PROJECT_MEMORY updates: one concise note per non-obvious lesson (corrected decisions, rejected approaches and why, environment surprises).

**Done when (per stage):** the stage's completion criteria in IMPLEMENTATION_AND_RELEASE_PLAN are met with linked evidence; CI green; no invariant violated; founder-gate packets prepared where the plan requires them. Report outcomes, evidence, decisions, test results, and unresolved blockers — not process narration or private reasoning.


======================================================================

# STORYFORGE_V5_INDEPENDENT_VERIFICATION
B1-500 · Verification record, corrections, remaining unknowns, founder decisions, readiness verdict.

## 1. Verification performed

**Inputs verified during authoring (three independent subagent workstreams):**
- **Codex platform research** against current first-party OpenAI sources (openai.com, developers.openai.com, github.com/openai/codex, help.openai.com): confirmed GPT-5.6 Sol exists and is the flagship coding model (GA July 9, 2026), API slug `gpt-5.6-sol`; "Ultra" is a multi-agent reasoning mode, not a model; `model_reasoning_effort="xhigh"` is the confirmed config literal; current sandbox (`read-only|workspace-write|danger-full-access`) and approval (`untrusted|on-request|never`) values; AGENTS.md conventions; plan mode; worktrees/subagents/cloud; `codex resume`; the long-horizon four-file pattern. Unconfirmed items are labeled in the execution prompt (exact TOML strings for `max`/Ultra effort; whether the CLI picker uses `gpt-5.6-sol` or the `gpt-5.6` alias).
- **Canonical extraction:** a full read of `storyforge-v5.html` produced an 81-item capability inventory and a 16-item simulation inventory with code anchors; both drove the Product-to-Engineering Map.
- **Historical contradiction audit:** every canonicity claim in older documents located and quoted; superseded UI statements enumerated; carry-forward engineering content identified with amendments — the basis of CANONICAL_LOCK §§2–5.

**Fresh-context package audit (independent reviewer agent, after authoring):** read all package documents, ran the canonical artifact headless (Playwright), and spot-checked the package against executed behavior across the seven required dimensions. All behavioral spot-checks passed (statuses and labels, nine timestamps, centered Quick Look measured at runtime, stoplight dots, lesson-on-row, six environments and names, 26 questions / 7-family taxonomy confirmed at runtime, pair model incl. `why`/`fups`/`qpref`/`qcoach`, import duplicates unchecked by default, Teaching Mode hide-names defaults and "Story A/B" labels, coalescing branch behavior, `firstOpened` without status change, `feedbackSent` only from real comments). Authority hygiene was clean: no package sentence treats an older artifact as product authority; the required declaration appears verbatim in the LOCK and the Codex prompt.

## 2. Findings and corrections (all resolved before completion)

1. **CRITICAL — the Codex prompt did not locate or pin the canonical artifact, and the carried-forward historical sections had no path.** Fixed: the canonical artifact is now bundled inside the package with its SHA-256 (`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`) pinned in the prompt; hash verification is Phase 0 item 0; the historical engineering base is bundled as `HISTORICAL_ENGINEERING_BASE_COMPLETE_COMBINED_HANDOFF.md` and its carried-forward sections are declared binding engineering input.
2. Dangling reference to this verification document — fixed by producing it and adding it to the prompt's read list.
3. Draft DDL lacked three requirements stated elsewhere in the package (mentor use-suggestions table, audit `surface` column, soft-delete column) — added.
4. Coalescing rule was stated less precisely than canon (blanket "status preserved" could keep a stale status over a newer one) — corrected to the exact branch rule in the Map and the Lock.
5. "You/DB/AI" badge lexicon invited a hardcoded mentor label — corrected to actor-derived mentor initials.
6. "7 family cards" overstated the default landing (Custom renders only when custom questions exist) — corrected.

## 3. Remaining unknowns (honestly labeled; converted to Codex Phase 0)

Fable had no MissionMed repository or infrastructure access in this run. Everything about the current repository, WordPress/LearnDash configuration, Supabase project state, Cloudflare/R2 setup, existing StoryForge code or legacy data, notification/email infrastructure, deployment pipeline, and mentor-assignment source of truth is unverified and is enumerated as mandatory Phase 0 discovery (Architecture §9, ten items including the hash check). Also unconfirmed: exact TOML literals for Codex `max`/Ultra effort (set in-session and record).

## 4. Founder decisions still required

1. Audio/data retention policy (retention length, account deletion/export, post-Match archival).
2. Support/emergency access policy — whether any admin path to private stories exists at all.
3. AI provider selection sign-off (data-processing agreement, no-training terms) and budget caps.
4. Email notifications — in or out of scope post-GA.
5. Production URL/path for StoryForge inside the Matrix.
6. Staging UAT approval (Stage 5 gate) and production go-live (Stage 6 gate).
7. Each AI promotion step (student general AI; clinical mentor beta; clinical student) — Stage 7 gates.
8. Legacy migration scope, if Phase 0 discovers real prior StoryForge data.

## 5. Readiness verdict

**READY.** The independent audit's verdict was ready-after-fixes; all six findings were corrected and re-checked. The package is self-contained (canonical artifact bundled and hash-pinned), internally consistent, honest about unknowns, and executable by Codex starting at Phase 0 without product guessing. Genuine blockers to implementation are limited to access Codex will have and Fable did not: the MissionMed repository, WordPress/Supabase/Cloudflare environments, and credentials — plus the founder decisions above at their gates.


======================================================================

# STORYFORGE_V5_PROJECT_MEMORY
B1-500 · One lesson per note. For downstream agents: read before assuming. Append via the same one-note format; after repository discovery, mirror these into the repo's memory mechanism (AGENTS.md section or the repo's established notes convention) — Codex decides the exact location in Phase 0 and records it here.

1. **Canonical authority is `storyforge-v5.html` only.** Three older documents each call an older artifact "canonical" — all revoked. Never open `storyforge.html` or `storyforge-v2.html` to answer a product question.
2. **The canonical file contains dead code.** Later script blocks override earlier ones at load (dead v2 `renderPrep` ~line 1381 vs live ~line 2642; old `rowHTML`/`renderQuick`/`renderSettings`/`persist`). Executed behavior is canon; diff-reading the file without running it has already misled one audit.
3. **Opening ≠ reviewing.** First mentor open stamps `firstOpened` and logs an event but never changes status. This was deliberately engineered and re-verified twice; do not "optimize" it away.
4. **`feedbackSent` is stamped only by real comments.** An earlier build stamped it on every status change — that was identified as a trust-breaking bug and removed. Do not reintroduce.
5. **Notification coalescing preserves status wording** and appends "New feedback is attached." An earlier "keep newest text" rule swallowed status changes and was corrected.
6. **Quick Look/Quick Review is a centered modal, not a right drawer** (founder-tested correction in V5). The only right-side drawer is Assign Interview Questions — the founder specifically values that pattern there.
7. **Scores are stoplight dots with S/M keys, numeral, and aria text** — "My rating: 4/5" text as the primary display was rejected in founder testing. In Mentor View the student's rating is labeled "Self", never "My rating" (perspective bug fixed in v2 review).
8. **Question strength belongs to the story–question pair**, never the story alone; student and mentor strengths are separate columns; student mappings are proposals until mentor-confirmed.
9. **The pair also owns `why` and `fups`;** the student owns `qpref` (preferred answer per question) and receives `qcoach` notes. These arrived in V5 and are missing from older schema sketches.
10. **Anonymized Teaching Mode labels are "Story A/B", not "Student A/B"** — two stories from the same student made "Student A/B" factually wrong. Toasts are suppressed while teaching (projected screens).
11. **The environment canvas needs explicit `width:100%;height:100%`** — `position:fixed;inset:0` alone leaves a canvas at intrinsic 300×150 and the entire flagship background system invisibly broken. This shipped broken once and was caught by a fresh-context verifier.
12. **Italics are reserved** for quotations, the full-story title, and hero headings. Production must not carry the prototype's neutralized `<em>` markup.
13. **Mentor writes to student-owned fields are suggestions, never edits** (uses, proposed mappings). An early build let mentors toggle student fields silently — treated as a trust violation and reversed.
14. **Client authority is the enemy.** Every "security" behavior in the prototype is render-time filtering, bypassable from the console. RLS + server RPCs are the real product; the UI only renders authority.
15. **Rejected approaches:** metaphorical vocabulary (Spark/Forged/Desk/embers) — founder-rejected for plain language; attention-weighted mentor queues — replaced by state-derived buckets; per-story global strength for interview fit — replaced by pair scores; localStorage as persistence — demo-only.
16. **"Codex 5.6 Sol Ultra" = model `gpt-5.6-sol` + Ultra reasoning mode** (four parallel agents; usage-intensive). `xhigh` is the confirmed effort literal; exact TOML for max/ultra unconfirmed as of July 2026 — set in-session and record.
17. **Prototype localStorage keys (`storyforge-proto3`, `storyforge-v2`, `storyforge-v5`, `storyforge-bg`) are demo state.** No production migration reads them.
18. **Clinical AI is not generic AI with a red border.** The interface promises a specialized medically-aware layer; shipping a generic model behind the clinical label violates Invariant 16. Manual mentor workflow is the approved GA path.
