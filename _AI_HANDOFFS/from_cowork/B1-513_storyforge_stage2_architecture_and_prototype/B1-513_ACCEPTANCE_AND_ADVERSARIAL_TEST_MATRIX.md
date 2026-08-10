# B1-513 Acceptance and Adversarial Test Matrix (R1–R4)

Date: 2026-08-07 (America/New_York)
Authority: `B1-513_DECISIONS_SPINE.md` (D7 release train; D1–D6, D8) and `B1-513_CURRENT_CANONICAL_BASELINE.md` (§3, §6). Security rows reference the negative-access matrix in `B1-513_AUTHORIZATION_RLS_AND_MEDIA_BOUNDARIES.md` §6 ("the doc 11 matrix", rows N1–N17).

## 0. Conventions and gates

- **Tiers:** `unit` (API/logic), `pg` (PostgreSQL: migrations, RLS, SECURITY DEFINER functions, run as `authenticated` with impersonated actors), `e2e` (browser against a production-shaped deployment), `a11y` (axe + manual keyboard/SR), `probe` (adversarial, expected to FAIL closed).
- **Release gate (every release):** all functional tests green; all applicable N1–N17 rows green; axe serious/critical = 0 on every new surface at all three text sizes; 390×844 zero horizontal overflow; migration apply→rollback→reapply clean; every flag default-off proof; regression suite (§1) green; Critical Systems zero-failure gate; canary script complete with receipts before scope widens.
- **Fail-closed rule:** an adversarial probe "passes" only when the system rejects it server-side with the specified code; a UI-only rejection is a failure.

## 1. Regression-protection suite (always green, all releases)

From baseline §3/§6 — existing capabilities with tests that must not change color:

| ID | Existing capability protected |
|---|---|
| REG-01 | Trust chain: JWT issuer/audience/expiry/JTI verification; ineligible 403; anonymous 401 |
| REG-02 | Shell, rail, Student↔Administrator View toggle gated by `role==='student' && capabilities.adminConsole` |
| REG-03 | Home: greeting, "The One Where" hero capture with mic, memory prompt, Finish It cards |
| REG-04 | Library: search combobox, facets, inline 1–5 student priority (`student_score`), status chips, score embers, audio chips |
| REG-05 | Story Room: Original telling read-only ("🔒 Preserved exactly as first told"), Working version explicit save, durable-save language, completion guidance (B1-512 exact Founder copy), reflections, right-rail cards |
| REG-06 | Quick Capture + recorder pipeline: voxDock states, live transcript merge preserving edits, IndexedDB offline segments, 20-minute cap, permanent original audio + seekable replay |
| REG-07 | Submission workflow: private→awaiting→in_review→changes/reviewed/approved; withdraw/resubmit; row-versioned; private absent from reviewer lists AND direct-ID reads; frozen `STATUS` vocabulary |
| REG-08 | Founder Admin: Admin Home tiles, Students (submitted-work search), Review Queue, Story Review form, Question Library, Release Controls incl. Content & Display versioned publish/restore + force-off |
| REG-09 | Mentor notes domain (B1-511) untouched: draft→publish, editable transcript, signed playback, internal notes never student-visible, double gates |
| REG-10 | Settings: 6 environments with Preview/Save/Cancel; text size Standard/Large/Extra Large; reduced-motion hard bail; account rows |
| REG-11 | Interview Prep hidden by configuration, data and implementation intact; NNQ panel copy exact (app.js 5462) |
| REG-12 | Story Media force-off (`STORYFORGE_STORY_MEDIA_FORCE_OFF=1`) and its two activation gates untouched; 0 media rows unchanged |
| REG-13 | Accessibility conformance suite (72/72 at cutover) still passes on unchanged surfaces |
| REG-14 | Deterministic release: immutable Kinsta pointer, Railway rollback, backups + restore rehearsal before production writes |

## 2. R1 — Mentorship foundation + Founder ops

Flags: `visibility_consent`, `admin_directory`, `activity_tracking`, `review_check`, `admin_review_controls`.

### 2.1 Functional acceptance

| ID | Tier | Exact behavior |
|---|---|---|
| R1-F01 | pg | `sf_decide_mentorship_consent('accept')` inserts an append-only decision row with policy version and returns a receipt id; audit row exists |
| R1-F02 | pg | `defer` decision recorded; NO story row changes; re-decision inserts a new row, never rewrites |
| R1-F03 | e2e | First student visit with flag on: consent modal appears once; "Agree and continue" disabled until the checkbox is checked; "Not now — keep everything private" closes with a durable no-op and no re-prompt within the session; policy re-readable in Settings → Mentorship & privacy with receipt line |
| R1-F04 | pg/unit | Post-consent NEW story defaults `mentor_visible`; pre-consent and historical stories stay `private`/NULL untouched (assert zero UPDATEs to pre-existing rows) |
| R1-F05 | pg | `sf_set_story_visibility` owner-only; writes `visibility_changed_at`, audit, and history line with exact copy ("to Private — visible only to me" / "to Mentor Visible") |
| R1-F06 | unit | Visibility change on a submitted story → `409 visibility_submitted`; UI shows the "Return to Private" guidance; withdraw-then-private succeeds |
| R1-F07 | e2e | Visibility card renders chip + segmented control; Private stories show 🔒 in Library rows |
| R1-F08 | unit | Directory returns ALL trusted, verified, active eligible students from the canonical LearnDash entitlement, including zero-activity students; total count matches entitlement source |
| R1-F09 | e2e | Directory filters (All / Awaiting review / Never active / Quiet 30+ days / Warnings) and search by name/username return server-authorized results; per-student row shows counts by state and visibility (counts only for private) |
| R1-F10 | e2e | Profile drawer: six tabs render; Stories tab lists mentor-visible + submitted only with a private count line; navigation Students → Student → Story → Review → back preserves drawer context |
| R1-F11 | pg/unit | Activity heartbeat: 60s beat only while visible + interacting (120s idle threshold); session closes at 30-min gap; resume opens a new session; stored fields are exactly `started_at, last_beat_at, active_ms, surface` |
| R1-F12 | e2e | Every activity metric renders `available_from` truth: "Available from \[date\]" / never fabricates pre-tracking history (student with old stories and no post-activation sessions shows no sessions, not zeros presented as history) |
| R1-F13 | unit | Review Check preview returns truth-branched text for each of the three states (nothing submitted / submitted awaiting / reviewed) without inserting anything |
| R1-F14 | pg/e2e | Review Check send: receipt row + audited + StoryForge notification (kind `review_check`, timestamped, read/dismiss) + delivery status to Founder; second send within 24h → `429 review_check_rate_limited` |
| R1-F15 | e2e | Direct review controls: star click, status pill, suitability chip each save immediately with optimistic version check, audited, `aria-live` announcement, no page flash; simulated `40001` conflict rolls the control back to server state |
| R1-F16 | e2e | Every review surface shows the owning student identity strip |

### 2.2 Negative/security (doc 11 matrix)

Applicable rows: N1, N2, N3, N5, N7, N8, N9, N10, N12, N13, N14, N15, N16, N17 — each as an automated test at both API and pg tiers.

### 2.3 Accessibility acceptance

- axe serious/critical = 0 on: consent modal, visibility card, Settings privacy panel, directory, profile drawer (all six tabs), direct review controls — at Standard, Large, Extra Large.
- Keyboard paths: complete a consent decision, a visibility change, a directory search + drawer open + Review Check send, and a full review (score + status + suitability) with keyboard only; star radiogroup arrows; dialog focus trap + Escape.
- SR: consent dialog announced with title; each direct-control save announced via `aria-live`; Review Check preview announced as a region.
- 390×844: zero horizontal overflow on all R1 surfaces; reduced-motion run shows static environments, no transitions.

### 2.4 Migration tests

- Apply → rollback → reapply clean on a production-shaped snapshot (441 users / 23 stories scale).
- Additive-only proof: schema diff shows only new tables (`sf_mentorship_consent`, `sf_activity_sessions`, `sf_activity_counters`, review-check receipts) + nullable `sf_stories.visibility`/`visibility_changed_at`; `SELECT count(*) FROM sf_stories WHERE xmin`-based check or checksum proves **zero mutation of existing rows**.
- RLS posture: every new table reports `relrowsecurity AND relforcerowsecurity = true`; REVOKE/GRANT audit matches the B1-511/B1-512 pattern.

### 2.5 Flag tests

- Each of the five flags defaults off after migration (`scope='off'`).
- Kill switch: env switch closes the surface with flags on (endpoints refuse; policies gate).
- Independence: enable each flag alone; verify no other Stage 2 surface activates (e.g. `admin_directory` on with `activity_tracking` off shows the drawer Activity tab honest-empty, not erroring).

### 2.6 Canary script (R1)

1. **Founder-first (`brinyu`):** enable flags allowlist=Founder only. Checks: consent modal → accept → receipt id recorded and re-readable; make one owned story Private → verify it vanishes from Administrator View directory story tab and direct admin read 404s; heartbeat rows exist with `available_from` = activation timestamp; Review Check to a test student previews truthfully, sends once, 429s on repeat; direct controls save + audit. Screenshot + receipt bundle archived.
2. **One consenting student:** add a single real consenting student. Checks: their pre-existing stories remain private/NULL untouched (row checksum); their new story defaults mentor_visible; Founder sees counts-only for their private work; student sees the Review Check notification with truthful content.
3. **`eligible_all`:** widen. Checks: directory total = entitlement count; zero 5xx in logs over 48h; audit volume sane; Critical Systems still zero-failure.

### 2.7 Adversarial probes (R1)

| Category | Concrete probe | Required outcome |
|---|---|---|
| Privacy regression | Script scans every directory/drawer/Review Check payload for any private story title/body substring seeded in fixtures | Zero hits |
| Contradictory authority | POST forged `visibility` change as admin on a student story | 403; owner-only server-enforced |
| Scope creep | Assert no new WordPress role exists; assert no bulk visibility conversion endpoint ships in R1 (it is R-later, D2) | Confirmed |
| Hidden coupling | Disable `visibility_consent`; run full REG suite + submission workflow | Green — review path never depended on visibility |
| Duplicate system | Assert Review Check notifications live in the existing sf notifications domain (no second notification table/store) | Confirmed |
| Unusable UX | XL text + 390px: consent modal fully operable; "Not now" reachable without scroll trap | Confirmed |
| Data-loss | Defer consent 5× across sessions | No state loss, no nagging beyond once per session boundary |

## 3. R2 — Multi-version story composition

Flags: `story_versions` (+ version registry in Content & Display).

### 3.1 Functional acceptance

| ID | Tier | Exact behavior |
|---|---|---|
| R2-F01 | pg | `sf_save_story_version` creates/updates `thirty_second`/`nnq_setup` under `UNIQUE(story_id, version_key)`; snapshot to `sf_story_version_revisions` on retell and on changed save; audit + `story.version_edited` history with voice/typed + Append/Retell detail |
| R2-F02 | pg | Retell: prior body becomes a revision (recovery guaranteed); Restore: revision body becomes current, current becomes a revision — round-trip restore(restore(x)) loses nothing (append-only proof) |
| R2-F03 | unit | Append = client-side compose, server saves whole body + snapshot; `original` → `403 version_protected`; `full_story` → `400 use_story_patch` |
| R2-F04 | e2e | Story Room shows 4 tabs on `.voiceTabs`; "One story · N of 4 tellings" strip; per-version history behind single "Show earlier tellings" expander; word count live with ~30-second target guidance ("inside/over the ~30-second target") |
| R2-F05 | e2e | Voice per version reuses the production recorder pipeline (`/api/recordings` session, segment upload, transcription, IndexedDB durability) into the version editor sink; recording provenance (`recording_id`) lands on the version revision |
| R2-F06 | pg | Retention: 51st revision triggers oldest-compaction with audit; ≤50 all kept |
| R2-F07 | e2e | Mentor/admin over an observable story reads versions read-only with attribution; version registry config (labels/helpers/targets/order/state) publishes via Content & Display Preview → Publish → audit; `full_story` cannot be hidden; Original not in the registry |
| R2-F08 | unit | Stale `expectedVersion` on version save → `40001`, no partial write, UI shows "Not saved — try again." |

### 3.2 Negative/security

Rows N3, N4 (versions/revisions by direct ID), N6, N7 (mentor vs private versions), N15, N16 (revision DELETE denied), N17. Plus: version read of a private story's version id by admin → `P0002`.

### 3.3 Accessibility acceptance

axe = 0 on the version surface at all three text sizes; **tab-wrap fix at XL** verified (4 tabs wrap, no overflow, at `data-text-size="extra_large"` and 390px); tablist arrow-key navigation; recorder dock `role=status` announcements; keyboard-only: type, save, retell (confirm), restore a revision.

### 3.4 Migration / flag tests

Apply→rollback→reapply; additive-only (`sf_story_versions`, `sf_story_version_revisions`, nullable recording provenance columns); **zero mutation proof is critical here**: checksum of `stories.text`, `original_text`, and revisions[0] before/after migration is identical (zero-copy adoption, D1). Default off; kill switch collapses Story Room to the exact production two-tab rendering (byte-diff of rendered HTML with flag off vs production baseline).

### 3.5 Canary script (R2)

Founder-first: create 30-Second + NNQ Setup on one owned story (typed + voice each); retell; restore; verify history lines and audit; verify Original byte-identical throughout (checksum before/after). → One consenting student: same flow on one story; mentor observation read-only. → `eligible_all` with 48h error watch and REG-05/REG-06 re-run.

### 3.6 Adversarial probes (R2)

| Category | Concrete probe | Required outcome |
|---|---|---|
| Contradictory authority | **Attempt to make Original telling hidden via the config API** (inject `{key:'original', state:'hidden'}` / rename it in the published payload) | **Rejected server-side** by payload validation; publish fails, config unchanged |
| Contradictory authority | Attempt to set `full_story` `state:'hidden'` or `'retired'` via publish | Rejected server-side |
| Data-loss | Kill the connection mid-retell; reload | Prior body present as revision or still current; nothing lost (durable-save contract) |
| Duplicate system | Assert no second audio/recorder implementation (single `/api/recordings` domain; versions reference `recording_id`, no per-version media tables) | Confirmed |
| Accidental redesign | Flag off screenshot diff of Story Room vs production baseline | Pixel-identical |
| Migration trap | Reapply migration on a DB where a version row already exists | Idempotence/guard behaves per header; no duplicate constraint carnage |
| Hidden coupling | `story_versions` on with `visibility_consent` off | Versions work; observation rules fall back to submitted-only |
| Scope creep | Grep shipped UI for branch/diff/merge/Git vocabulary | Zero hits (D1) |

## 4. R3 — Inspiration MVP

Flag: `inspiration` (student wizard + promotion + save-for-later; 81-prompt bank seeded).

### 4.1 Functional acceptance

| ID | Tier | Exact behavior |
|---|---|---|
| R3-F01 | unit | Wizard order WHO → (relationship, 2 primary + "More…") → DOMAIN → ENERGY → one question; ≤3 primary choices per step; "You" path skips relationship (step count 4 vs 5) |
| R3-F02 | pg/unit | Server-side prompt selection scores dimension match, excludes session-seen ids, deterministic + auditable; retired prompts never served |
| R3-F03 | e2e | Answer → "Add to StoryForge Library" creates a story via the EXISTING `/api/stories` path with `origin {type: inspiration, prompt_id, prompt_text snapshot}`; story appears in Library with ✧ badge; history line records the prompt; visibility default obeys consent state |
| R3-F04 | e2e | Save for later persists prompt snapshot + draft; "Answer now" resumes with draft; Remove deletes; "This sparked another story" captures one line and lands in Saved |
| R3-F05 | e2e | Agency: Skip / Give me another / Prefer lighter questions always present; stop-anytime preserves progress; voice answer reuses the production recorder |
| R3-F06 | pg | `sf_inspiration_events` rows for shown/answered/skipped/promoted are content-free by schema |
| R3-F07 | unit | Prompt-bank seed: 81 MissionMed-original prompts load with stable ids, dimensions, territory, follow_up; zero copied bank text (provenance check against the 21-source research notes) |

### 4.2 Negative/security

Rows N1, N2, N4 (saved prompts by direct ID), N11 (admin cannot read drafts/answers), N17. Plus: promotion endpoint refuses when `inspiration` off; a student cannot promote into another student's Library (owner enforced by existing story-creation path).

### 4.3 Accessibility acceptance

axe = 0 on wizard at all sizes; question card `aria-live` announces new questions; keyboard-only full journey (choices → question → answer → promote); 390×844 single-column choice cards, no overflow; reduced-motion: no choice-card hover transforms.

### 4.4 Migration / flag tests

Additive tables (`sf_inspiration_prompts`, `sf_inspiration_saved`, `sf_inspiration_events`) + seed; apply→rollback→reapply; seed idempotent. Flag default off; kill switch removes the route and Home entry link; already-promoted stories remain fully functional ordinary stories with flag off (no orphaning — D3's no-parallel-store guarantee tested).

### 4.5 Canary script (R3)

Founder-first: full wizard run on each WHO path; promote one answer; verify origin provenance + Library badge; save-for-later round trip; verify admin cannot see own drafts through admin surfaces. → One consenting student: one promotion; confirm same privacy/review flow as any story. → `eligible_all`; watch prompt-selection distribution (no starvation) and event volumes.

### 4.6 Adversarial probes (R3)

| Category | Concrete probe | Required outcome |
|---|---|---|
| Duplicate system | Assert promoted answers are rows in the canonical story store only — no inspiration-side story/answer table with content | Confirmed (drafts live only in `sf_inspiration_saved`, owner-scoped) |
| Privacy regression | Admin payload scan for any draft/answer text in `/api/admin/*` responses | Zero hits |
| Unusable UX | "Prefer lighter questions" path from a heavy question; trauma-pressure review of all 81 prompts against D3's agency rules (no psychology claims) | Founder sign-off recorded |
| Scope creep | Assert Interview Prep remains hidden and unmerged (D11); no NNQ workshop resurrection inside Inspiration | Confirmed |
| Data-loss | Close tab mid-answer; return via Save for later draft | Draft intact |
| Contradictory authority | Student POST to `/api/admin/console/inspiration/save` | 403 |

## 5. R4 — Inspiration administration depth + analytics refinement

Flags: `inspiration_admin` (+ optional bulk visibility opt-in tool if the Founder wants it).

### 5.1 Functional acceptance

| ID | Tier | Exact behavior |
|---|---|---|
| R4-F01 | e2e | Admin content manager: edit wording, add, retire prompts by stable id; dimension filters; versioned publish with optimistic `row_version`; audit per change; "Preview the student wizard" switches to Student View |
| R4-F02 | pg | Retiring a prompt never alters existing promoted stories or saved snapshots (prompt_text snapshot proves provenance) |
| R4-F03 | e2e | Richer analytics views still carry `available_from` on every metric; version usage and Inspiration usage counters render as aggregates only |
| R4-F04 | e2e (optional) | Bulk visibility opt-in tool: explicit per-run student confirmation, per-story audit + history lines, never silent, reversible per story |

### 5.2 Negative/security

Rows N5, N15, N17; publish with stale version → `40001`; prompt-bank payload validation rejects malformed dimensions server-side.

### 5.3 Accessibility / migration / flag

axe = 0 on the content manager at all sizes; keyboard-only prompt edit + publish. No new tables expected (configuration-domain versioning from R3 schema); additive-only if any. `inspiration_admin` off freezes the bank at last published version while students continue (independence test with `inspiration` on).

### 5.4 Canary script (R4)

Founder-first: edit one prompt, retire one, add one; publish; verify student wizard reflects it and prior promotions are untouched. → One consenting student re-runs the wizard against the new bank. → `eligible_all`.

### 5.5 Adversarial probes (R4)

| Category | Concrete probe | Required outcome |
|---|---|---|
| Contradictory authority | Publish a bank with zero active prompts | Rejected server-side (wizard must never dead-end by admin accident) or explicit confirm with truthful student empty state — decision recorded before build |
| Migration trap | Re-seed attempt on a bank with admin edits | Edits preserved; seed refuses to overwrite (stable-id guard) |
| Privacy regression (bulk tool) | Bulk opt-in run scan: any story converted without the per-run confirmation receipt | Zero |
| Accidental redesign | Release Controls screenshot diff with `inspiration_admin` off | Identical to R3 state |
| Hidden coupling | `inspiration_admin` on with `inspiration` off | Manager works against the bank; student surface stays closed |

## 6. Cross-release adversarial standing set

Run at every release gate: duplicate-system grep (one renderer, one recorder, one notification domain, one story store, one config machinery); dependency-order probe (enable flags in every pairwise combination — no crash, honest empty states); authority probe (student token replayed against all admin endpoints → uniform 403); absence probe (private direct-ID sweep across every new entity type → uniform 404/P0002); copy-freeze probe (canonical vocabulary from baseline §4 letter-exact in shipped UI).
