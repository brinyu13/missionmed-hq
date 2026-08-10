# B1-513 — Activity Analytics Contract

**Ticket:** B1-513 StoryForge Stage 2 · **Release:** R1 foundation (spine D7)
**Authority:** `B1-513_DECISIONS_SPINE.md` (D5 is binding for the model; D7 flags; D8 RLS) and `B1-513_CURRENT_CANONICAL_BASELINE.md`. The Founder console consumes these metrics through the Activity tab specified in `B1-513_FOUNDER_ADMIN_OPERATING_CONSOLE.md` §4.
**Demonstrated in:** `prototype/shim.js` (`ACTIVITY` shapes, `/api/activity/heartbeat`, directory `boundaries.activityFrom`) and `prototype/extensions.js` (Activity tab rendering, truthful-boundary copy).

This is a **privacy-respectful engagement contract**, not a surveillance system. It answers one mentorship question — *is this student engaging with StoryForge, and roughly how much?* — and refuses to answer anything else.

---

## 1. Principles

1. **Truthful or absent.** A metric either derives from data that was actually recorded, or it is not shown. There is no third state.
2. **Aggregates only, content-free.** Nothing a student writes, says, records, or pastes is ever part of an analytics row.
3. **Defensible time.** "Active time" means foreground, interacting time under the D5 model — never open-tab time, never inflated.
4. **Fail-silent.** Analytics may lose data; the product may never lose a student's work or attention because of analytics.

## 2. The truthful-boundary rule

Per spine D5: **never fabricate historical analytics.** Tracking begins when the `activity_tracking` flag activates for a user population; every metric carries `available_from` = that activation timestamp (persisted, not inferred).

**Exact UI copy (binding):**

- Metric-level gate: **"Available from [date]"** and, where a period before the boundary would otherwise be implied: **"Not available before activity tracking was enabled."**
- Activity tab preamble (canonical wording from the prototype): **"Engagement analytics are recorded from [date], when activity tracking was enabled. Nothing before that date is shown, because it was not recorded. An open tab does not count — only foreground, interacting time."**
- Empty state for a student with no sessions since activation: **"No sessions recorded yet — Available from [date]; this student has not used StoryForge since tracking was enabled."**

The boundary is also machine-readable: the directory endpoint returns `boundaries.activityFrom`, and every per-student activity payload carries `availableFrom`. UI must render the boundary wherever totals are shown; a reviewer seeing "0 sessions" must simultaneously see since when.

## 3. The ACTIVE-TIME model (exactly per spine D5)

| Element | Rule |
|---|---|
| Session | Opens at the first meaningful activity while the app is foregrounded. Identified client-side; stored as one aggregate row. |
| Foreground | `document.visibilityState === 'visible'`. Hidden/backgrounded tabs accrue nothing. |
| Heartbeat | While foregrounded, the client emits a bounded heartbeat every **60 s** — but only if meaningful activity occurred within the last **120 s** (idle threshold). No activity in 120 s → beats stop → active time stops accruing. |
| Active time | `active_ms` accrues only across beat-covered intervals. Idle-gap time is excluded, not interpolated. |
| Session boundary | A gap of **30 minutes** without a beat closes the session (`last_beat_at` is final). |
| Resume | Any later meaningful activity opens a **new** session. Sessions are never merged or back-filled. |
| Coarse surface | Each session records a coarse surface label (e.g. `Library`, `Story Detail`, `Inspiration`, `Capture`, `Settings`) — route-level only, never story IDs, titles, or content in the label. |

### 3.1 "Meaningful activity" — precise definition

Meaningful activity is **the occurrence of an intentional interaction event** on a StoryForge surface:

- **Counts:** `pointerdown`/`click`/`tap`; `keydown` (**the fact that a key event fired only — never which key, never any text**); `scroll`; `input` on StoryForge fields (fact only, no value); active recording; active audio playback progress.
- **Does not count:** tab merely visible; `mousemove`/`pointermove` alone (drifting cursors must not inflate time); focus/blur alone; timers, animations, or any programmatic event.

This definition is code-reviewable: the listener list in the beacon module is the contract, and adding any listener that captures event *payloads* is a violation of §5.

## 4. Metric catalog

Every metric row below carries `available_from` gating (per D5, `available_from` = tracking activation). Metrics counted by this contract count **events since activation**; the canonical product surfaces (Library, story history) remain the truthful all-time record of the underlying facts and are not restated here.

| Metric | Definition | Data source | Gating |
|---|---|---|---|
| Last meaningful activity | Timestamp of the most recent meaningful-activity beat | `sf_activity_sessions.last_beat_at` (max) | "No activity yet" before first beat |
| Session count / dates | Number of closed+open sessions; per-session `started_at` list | `sf_activity_sessions` | `available_from` |
| Active time per session | `active_ms` per session row | `sf_activity_sessions` | `available_from` |
| Average session length | mean(`active_ms`) over sessions in range | derived from `sf_activity_sessions` | `available_from` |
| Total active time | sum(`active_ms`) | derived from `sf_activity_sessions` | `available_from` |
| Stories opened | Count of story-open events (fact of open; story identity is not stored in the counter) | `sf_activity_counters` key `stories_opened` | `available_from` |
| Stories created | Count of story-creation events since activation | `sf_activity_counters` key `stories_created` | `available_from` |
| Stories advanced | Count of workflow-forward transitions (e.g. private→awaiting, changes→resubmitted) by the student | `sf_activity_counters` key `stories_advanced` | `available_from` |
| Submissions | Count of submit-for-review actions | `sf_activity_counters` key `submissions` | `available_from` |
| Reviews opened | Count of times the student opened a story bearing mentor feedback/review outcome | `sf_activity_counters` key `reviews_opened` | `available_from` |
| Version usage | Count of version edits (30-Second / NNQ Setup saves, appends, retells) — counts only, keyed per version key | `sf_activity_counters` keys `version_edits.*` | `available_from` |
| Inspiration usage | Counts of prompts shown / answered / skipped / promoted | `sf_inspiration_events` (content-free, spine D3) rolled into `sf_activity_counters` | `available_from` (R3 populates) |

Counter events for created/advanced/submitted are emitted server-side by the same transactions that already write those canonical facts — so counters can never disagree with the product about whether an event happened; they can only start counting later (which the boundary copy states).

## 5. DO-NOT-CAPTURE — binding negative contract

The following are **never captured, transmitted, stored, or derivable** from any analytics artifact. This list is a release gate: violating it is a stop-ship defect, not a bug.

| Never captured | Enforcement + test |
|---|---|
| Raw keystrokes, key identities, key sequences, typed text | Beacon module registers no listener that reads `event.key`/`event.code`/field values; static code audit + unit test asserting beacon payload schema contains only enumerated numeric/enum fields. |
| Clipboard contents or clipboard events | No `paste`/`copy`/`cut` listeners in the beacon module; code audit assertion. |
| Other sites, other tabs, URLs outside StoryForge, browsing history | Only `visibilityState` of *this* document is read; no `window.open` tracking, no referrer capture; payload schema test — `surface` is a closed enum. |
| Screenshots, screen recordings, DOM snapshots | No such APIs referenced anywhere in the analytics path; dependency and code audit. |
| Content payloads: story text, titles, transcripts, Inspiration answers, drafts, audio | Payload schema test: heartbeat and counter events are `{userId(from JWT), sessionId, surface(enum), activeMs, counterKey(enum), n}` — no free-text fields exist in the schema at all. Server rejects (400) any beacon body with unexpected fields. |

**Negative tests (CI-enforced):** (a) schema-validation test posting a beacon with a `text` field → 400 rejected + not stored; (b) grep-class audit test that the beacon module contains no reads of `event.key`, `.value`, `clipboardData`, `getDisplayMedia`, `toDataURL`; (c) DB test that `sf_activity_sessions`/`sf_activity_counters` contain no text columns beyond closed enums; (d) an end-to-end run typing a sentinel string in a story editor, then asserting the sentinel appears nowhere in analytics tables or beacon request logs.

## 6. Storage shape

Aggregates only; content-free by schema, not by policy.

```
sf_activity_sessions
  id uuid pk
  user_id uuid not null          -- owner
  started_at timestamptz not null
  last_beat_at timestamptz not null
  active_ms integer not null default 0
  surface text not null          -- CHECK constrained to the coarse-surface enum
  created_at timestamptz not null default now()

sf_activity_counters
  user_id uuid not null
  counter_key text not null      -- CHECK constrained to the catalog enum (§4)
  count bigint not null default 0
  first_at timestamptz
  last_at timestamptz
  available_from timestamptz not null   -- activation boundary, persisted
  PRIMARY KEY (user_id, counter_key)
```

No foreign keys into story content tables from analytics rows; `stories_opened` etc. are counts, not ID lists. There is deliberately no per-story engagement table in R1 — that would be content-adjacent detail the mentorship question does not need.

## 7. Client beacon behavior

- **Transport:** batched `POST /api/activity/heartbeat` (session upsert + counter deltas); `navigator.sendBeacon` on `pagehide`/`visibilitychange→hidden` to flush the final beat.
- **Fail-silent, always:** beacon failures are swallowed — no user-facing error, no toast, no console spam, no blocking of any product action. Analytics is strictly downstream of the product; the recorder, editors, and saves have zero dependency on it.
- **Offline / failure:** at most one in-memory pending batch is retried on the next natural beat; beyond that, data is **dropped**. Undercounting is the acceptable, truthful failure direction; there is no durable client-side analytics queue (nothing content-adjacent may accumulate on device for analytics purposes — IndexedDB durability remains reserved for the recording pipeline, baseline §3).
- **Bounded chatter:** ≤ 1 heartbeat per 60 s per tab; counters are debounced into the same batch. No beat while hidden or idle.
- **Flag-gated:** the beacon module does not load when `activity_tracking` is off; the env kill switch silences it independently of the DB flag (D7). Server accepts and discards beats for users outside the flag population (202-style no-op) so partial rollouts never error in client logs.

## 8. Retention (proposed, with rationale)

| Data | Retention | Rationale |
|---|---|---|
| `sf_activity_sessions` (raw session rows) | **400 days**, then hard-deleted by scheduled job (deletion audited as a count, not per-row) | 400 days covers one full residency application cycle (≈13 months from first StoryForge use through interview season) plus buffer, which is the longest window a mentorship conversation legitimately looks back on. Session-level granularity older than a cycle has no mentorship value and keeping it would contradict data-minimization. |
| `sf_activity_counters` (lifetime aggregates) | **Indefinite** | Content-free, single row per (user, key), constant size; "this student has created 14 stories since tracking began" remains legitimately useful across the whole mentorship relationship, and there is nothing privacy-bearing to age out. |
| Account deletion | All analytics rows for the user are deleted with the account through the existing deletion-intent machinery (baseline §5). |

Before the deletion job first runs in production it is rehearsed against a restored backup, per the regression-protected release discipline (baseline §6).

## 9. Who can see what

| Audience | Access |
|---|---|
| Founder / admin (signed `adminConsole` capability: brinyu, Brian_test) | Full metric catalog per student via the console Activity tab and directory `lastActivity` — through bounded SECURITY DEFINER reads only. |
| Students | **Nothing in R1.** No student-facing analytics UI, no self-view, no comparison, no leaderboard — nothing that could make students feel watched or gamified while the model is new. |
| Mentors (non-admin) | Nothing in R1. |
| Future (explicitly out of scope) | A possible student-facing "your streak / your writing time" self-view is noted as a candidate for a later release **only** as self-data, opt-in-visible, and never comparative. Documented here so it is a decision, not scope creep. |

## 10. RLS

Per spine D8: both tables get **RLS + FORCE RLS**.

- Owner-scoped policy: a student's JWT-derived identity may INSERT/UPDATE only rows where `user_id = auth_uid()` (heartbeat upserts); students have **no SELECT policy in R1** (they see nothing, and cannot enumerate their own raw rows through the API either — there is no student endpoint).
- Admin access exclusively via bounded SECURITY DEFINER functions (B1-510I pattern) that return the §4 aggregates for one student at a time; no generic table grants to `authenticated`.
- Negative tests (D8): cross-student direct-ID access → 404/P0002; student calling admin activity reads → 403; anonymous heartbeat → 401; tampered `user_id` in a beacon body is ignored in favor of the JWT identity.

## 11. Acceptance criteria

1. **Model conformance:** an instrumented browser run demonstrates: no beats while hidden; beats every 60 s during interaction; beats stop within 120 s of last meaningful activity; a 30-minute gap closes the session and later activity opens a new one; recorded `active_ms` for the run matches the interacting time within one beat interval.
2. **Truthful boundary:** for a user activated on date T, the Activity tab shows the §2 copy with T; no metric anywhere in the console displays a value attributed to a time before T; `available_from` is persisted and survives restart/redeploy.
3. **Idle honesty:** a tab left open and untouched for an hour accrues zero additional active time and produces at most the session-close write.
4. **Fail-silent:** with the API blocked at the network layer, every product function (capture, save, submit, review) works unchanged, and no user-visible error appears; analytics for the period is simply absent.
5. **Content-free storage:** the §5 negative tests pass in CI; a manual audit of production-shaped rows shows only enums, timestamps, and integers.
6. **Access control:** Founder sees the Activity tab; a student token receives 403 on admin activity reads and has no route to any analytics view; RLS negative tests (§10) pass against the real policies, not mocks.
7. **Flags:** with `activity_tracking` off, no beacon requests occur (verified in network logs) and the Activity tab shows only the boundary explanation with no fabricated data; the env kill switch works with the DB flag still on.
8. **Retention:** deletion job dry-run on a restored backup deletes exactly rows older than 400 days from `sf_activity_sessions`, leaves `sf_activity_counters` intact, and writes an audit record of counts.

### Negative tests (summary, all must fail closed)

- Beacon with content field → 400, nothing stored.
- Sentinel-text end-to-end sweep → sentinel absent from all analytics artifacts.
- Cross-student session read by student → P0002/404.
- Pre-boundary date rendered anywhere in the console → test failure (UI snapshot assertion on the boundary copy).
- Heartbeat while `visibilityState === 'hidden'` → no request emitted (client test).
