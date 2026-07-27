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
