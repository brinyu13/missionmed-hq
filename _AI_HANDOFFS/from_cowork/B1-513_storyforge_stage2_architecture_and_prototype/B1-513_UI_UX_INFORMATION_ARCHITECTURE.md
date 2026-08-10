# B1-513 UI/UX Information Architecture

Date: 2026-08-07 (America/New_York)
Authority: `B1-513_DECISIONS_SPINE.md` (D1–D6, D11) and `B1-513_CURRENT_CANONICAL_BASELINE.md` (§3, §4). All markup, class names, and copy below are taken from the working prototype (`prototype/extensions.js`, `extensions.css`) built on the byte-exact production renderer (baseline §1). Canonical vocabulary from baseline §4 is reused, never renamed.

## 1. Navigation map

One renderer, one shell, one release for all identities. The existing left rail and persistent Student ↔ Administrator View toggle (`roleSwitch`) are unchanged; Stage 2 adds one student route and one admin route.

**Student View**

| Rail item | Route | Stage 2 change |
|---|---|---|
| Home | `home` | + "✧ Can't think of a story? Open **Inspiration** ▸" entry link (flag `inspiration`); consent modal may present once per session boundary |
| Story Library | `stories` | + per-row badges: 🔒 private chip, "N tellings" tag, ✧ born-in-Inspiration spark tag |
| Inspiration | `inspiration` (NEW) | Student destination; an entry point into the canonical Library (D3) |
| Notifications | `notifications` | + Review Check items (kind `review_check`), read/dismiss unchanged |
| Settings | `settings` | + "Mentorship & privacy" panel (consent state, policy re-read, per-story control explainer) |
| Interview Prep | hidden | Remains hidden by reversible configuration (`navigation.interviewPrepVisible=false`); NOT merged into Inspiration (D11) |

**Administrator View**

| Rail item | Route | Stage 2 change |
|---|---|---|
| Admin Home | `admin-home` | + directory metrics strip: Eligible students / Active this week / Never active / Warnings |
| Students | `admin-students` | REPLACED content: full entitlement-backed Student Directory (all eligible students incl. zero-activity) + profile drawer; the old submitted-work-only list remains the fallback when `admin_directory` is off |
| Review Queue | `admin-queue` | Unchanged list; opens Story Review with new direct controls |
| Story Review | `admin-story` | + direct controls (stars, status pills, suitability chips) with identity strip; falls back to B1-511 selects when `admin_review_controls` is off |
| Question Library | `admin-questions` | Unchanged |
| Release Controls | `admin-release` | + Story versions config group; + Inspiration content manager; + Stage 2 flags |

Navigation context is preserved: Students → Student (drawer) → Story → Review → back returns to the drawer and directory state (D4).

## 2. Surface composition: reused vs new components

Stage 2 is composed almost entirely from production components; the new set is deliberately small and namespaced `b1513*`.

| Surface | Reused production components | New b1513 components |
|---|---|---|
| Story Room version surface | `.voiceTabs` (tablist), `storyProse`/`storyProseEdit`, `origNote`, `lessonBlock`, `voxDock` recorder, `btnSave`/`saveState`, `railCard` right rail | `b1513VersionStrip`, `b1513VersionGuide`, `b1513VersionCount`, `b1513Revision` history cards, `b1513TabAdd` (+) marker |
| Visibility card (Story Room rail) | `railCard`, `statusRow` (segmented buttons), `stChip`, `stageHint` | `b1513VisMentor`/`b1513VisPrivate` chip colorways |
| Consent modal | `eyebrow`, `h1`, `stageHint`, `noteSend`/`rowBtn` buttons | `b1513ConsentSheet` + scrim, `b1513ConsentFacts` grid, `b1513ConsentCheck` |
| Settings privacy panel | `panel`, `pHead`/`pBody`, `setRow`, `rolePill` | — |
| Inspiration | `panel`, `homeGrid`, `shortItem` (saved/sparks), `storyProseEdit` answer box, `voxDock`, `tag`, `backBtn` | `b1513Choice` cards, `b1513QuestionCard`, `b1513Choices` grid, `b1513More` expander |
| Student Directory | `listBar` search, `classChips`/`cChip` filters, `mStuRow` rows, `stuAv`, `numPair`, `stChip` status chips, `emptyState` | `b1513DirChips`, `b1513NeverChip`, `b1513WarnDot` |
| Profile drawer | existing `qad` drawer + `drawer`, `voiceTabs` (profile tabs), `forgeStats`/`fstat`, `setRow`, `releaseError` warnings, `backBtn` | `b1513ReviewCheckPreview`, `b1513Truth` boundary note |
| Story Review direct controls | `statusRow` pills, `classChips` suitability, `STATUS`/`SUITABILITY` frozen vocab, score-ember visual language (`scorePicker`/embers stay student-side) | `b1513Stars` (mentor stars, visually distinct from student priority embers), `b1513ReviewOwner` identity strip |
| Admin Home extras | `forgeStats adminMetrics`, `metric-*` colorways | — |
| Release Controls additions | `b1512ConfigGroup` fieldsets, `b1512SectionRow`, `b1512StableId`, Preview → Publish → audit machinery | `b1513LockedRow` (Original telling, provenance-protected), `b1513PromptRow` |
| Background/motion | `bgGrid` canvas engine, energy states, environments | — (no new motion system) |

## 3. Story Room version surface anatomy

Top to bottom in the left column (`b1513VersionSurface`):

1. **Tab strip** — the existing `.voiceTabs` tablist carries four tabs: `Original telling · Full Story · 30-Second Version · NNQ Setup Version`. Labels come from the published version registry (D6); Original is always first and cannot be configured away; not-yet-started versions render dimmed with a `+` affordance (`b1513TabEmpty`).
2. **Ownership strip** — "One story · N of 4 tellings. Every version belongs to "\[title\]" — the Original telling is preserved untouched." No branches, no diffs, no Git vocabulary (D1).
3. **Original tab** — production markup unchanged, including "🔒 Preserved exactly as first told — your authentic voice, kept safe".
4. **Full Story tab** — the production Working-version edit form unchanged (title, text, Learning Lesson, completion guidance, explicit save with "Durable only after StoryForge confirms the save.").
5. **Version tabs (30-Second / NNQ Setup)** — guide card (label, helper, recommended target, meta line "Started \[date\] · last saved \[datetime\] · 🎙 voice / ⌨ typed", or "Not started yet — type it, or tell it out loud."); editor textarea; live word count ("≈ 82 words · inside the ~30-second target"); action row `Save [label]` / `🎙 Append with voice` / `🎙 Retell with voice` / `Start a fresh retelling`; the `voxDock` recorder replaces the action row while recording; explainer note "Append adds to what's here. Retell starts fresh — your previous telling is kept in this version's history and can be restored."
6. **History** — a single expander "Show earlier tellings of this version (N)" revealing `b1513Revision` cards (timestamp, source icon, 400-char excerpt, "Restore this telling").

Mentor/admin rendering of the same tabs is read-only prose with attribution ("Maya's 30-Second Version · last edited …") and an honest empty state ("Maya hasn't written a 30-Second Version yet.").

## 4. Wizard IA (Inspiration)

- **Steps:** WHO (You / Family / Someone Else) → relationship detail (progressive disclosure: 2 primary choices + "More…", plus "It doesn't matter — surprise me"; skipped entirely for "You") → DOMAIN (Personal / Academic / Medical & Clinical) → ENERGY (Serious & Meaningful / Fun & Lighthearted / Emotional & Moving) → ONE question at a time.
- **≤3 primary choices per step**, rendered as `b1513Choice` cards in a 3-column grid (single column ≤860px). Step counter: "A guided conversation · step N of M" (M = 4 for "You", 5 otherwise). "‹ Back" on every step after the first.
- **Question step:** `b1513QuestionCard` = "Memory prompt" tag + territory, the question in the Lora story-prose voice, optional follow-up ("↳ …") once an answer exists, answer textarea, optional `🎙 Talk instead` recorder, primary action "Add to StoryForge Library" (disabled until an answer exists) and "Save for later"; agency row: Skip / Give me another / ✧ This sparked another story / Prefer lighter questions.
- **Promotion** uses the existing story-creation path with `origin` provenance; the confirmation panel offers "Open the story" and "Keep exploring — another question."
- Right column: "Sparked this visit", "Saved for later" (Answer now / Remove), and "How this works" (active question count, same-privacy explanation).

## 5. Consent modal IA

`b1513ConsentSheet` (role=dialog, aria-modal, centered, 620px max): eyebrow "MissionMed mentorship · one-time choice" → policy title (h1) → 3–4 plain-language paragraphs → 2-column facts grid (✓-fronted, single column ≤640px) → policy version/updated line with the Settings pointer → affirmative checkbox ("I understand: new stories will be mentor-visible, and I can make any story Private at any time.") → "Agree and continue" (disabled until checked) + "Not now — keep everything private" → the durable-no-op reassurance line. Review mode (from Settings or after acceptance) replaces the decision block with Close + the receipt line ("You agreed on \[datetime\] · receipt \[id\]"). Re-prompt at most once per session boundary; never blocking, never a dark pattern (D2).

## 6. Profile drawer IA

Opens in the existing `qad` drawer (role=dialog, aria-modal): "‹ Student directory" back → header (avatar initials, eyebrow "Administrator · student profile", name, username · entitlement · recency) → "Record Review Check" → optional preview region ("Preview — nothing has been sent" + Send/Cancel + the one-per-day note) or sent receipt ("✓ Sent … · delivery: delivered · audited.") → six-tab `voiceTabs` tablist: **Overview** (stat tiles, last activity/review/Review Check, visibility mix "N mentor-visible · N private (content never accessible)", warnings) · **Activity** (truthful-boundary note, session tiles and rows, counters) · **Stories** (mentor-visible + submitted only; private = count line only; "Open review") · **Reviews** · **Notifications** (Review Check history + student notifications with read state) · **Account** (username, entitlement, provisioned, warnings).

## 7. Text-size behavior (Standard / Large / Extra Large)

`body[data-text-size]` sets the root at 14/16/18px and `--b1512-reading-add` at 0/2/4px (baseline §3). Requirements for every new surface:

- All b1513 reading surfaces inherit the add: `.b1513Question, .b1513ConsentPara, .b1513ReviewCheckText, .b1513RevisionBody { font-size: calc(1em + var(--b1512-reading-add, 0px)); }`.
- **Tab-wrap fix at XL:** `.b1513VersionTabs` and `.b1513ProfileTabs` set `flex-wrap: wrap; width: 100%` so four version tabs and six profile tabs wrap to a second line at Extra Large instead of overflowing the column — this is an acceptance-tested behavior, not a nicety.
- Must hold with zero clipping or horizontal overflow on: the wizard (choice cards grow vertically), version tabs and editors, the directory rows (`b1513DirRow` wraps), the drawer, review controls (stars/pills/chips wrap), the recorder dock, both dialogs, and all mobile layouts.

## 8. Responsive behavior

| Width | Behavior |
|---|---|
| 1440 | Full shell: rail, two-column Story Room, two-column Inspiration grid, full directory rows |
| 1280 | Same structure, tighter gutters; version guide card keeps label/meta on one row |
| 834 | Inspiration grid collapses to one column (≤860 rule); choice grid single column; directory rows wrap chips below the name; drawer takes `min(680px, 94vw)` |
| 390 | Existing production mobile bottom-rail navigation unchanged (Inspiration appears as a rail item under `inspiration` flag); consent sheet single-column facts at ≤640 with reduced padding; wizard is one column, one thumb-sized choice per row; version tab strip wraps; zero horizontal overflow at 390×844 is a release gate |

## 9. Motion and environment integration

- Recording (version voice, Inspiration voice) drives the existing energy model: `setMotionEnergy('recording')` on start, `'low'` on finish/cancel — same canvas engine, same environments, no new motion system.
- Reduced motion: the production hard bail (JS + CSS kill blocks) governs; b1513 additions also strip their own transitions/transforms under `prefers-reduced-motion: reduce`. Environments retain their static painted richness (the "Static Dark" guarantee) — reduced motion is never a blank screen.
- No full-screen strobe, no flashing sequences; the consent scrim is a static blur.

## 10. Keyboard and screen-reader contracts

| Control | Contract |
|---|---|
| Version tabs / profile tabs | `role=tablist` with `aria-label` ("Story versions" / "Student profile sections"); each tab `role=tab` + `aria-selected`; Left/Right arrow moves, Enter/Space activates; focus visible |
| Mentor score stars | `role=radiogroup` labelled by "Mentor score — distinct from the student's own priority"; each star `role=radio`, `aria-checked`, `aria-label="Set mentor score to N of 5"`; arrows move, Space selects |
| Status pills / visibility toggle / suitability + filter chips | `role=group` with `aria-label`; buttons carry `aria-pressed`; disabled state carries an explanatory `title` (e.g. submitted stories' Private button) |
| Consent dialog / profile drawer | `role=dialog` + `aria-modal` + `aria-labelledby`; on open, focus moves to the heading (`tabindex="-1"`); focus is trapped; Escape closes (drawer) / returns to the decision (consent review mode) |
| Immediate saves | `data-b1513-review-live` is `aria-live=polite` and announces every direct-control save ("Status set to Reviewed — audited."); version word count is `aria-live=polite`; recorder state (`voxState`) is `role=status` |
| Directory search | `role=search` form, `srOnly` label, result count in `countNote` |
| Wizard | Each step is a heading (h2) + choice buttons; the question card is `aria-live=polite` so a new question is announced; every editor has an `srOnly` label |

## 11. Empty, loading, and error states

| Surface | State and exact copy |
|---|---|
| Version tab, never started | Guide meta: "Not started yet — type it, or tell it out loud." + dimmed tab with `+` |
| Version tab, mentor view, empty | "\[First name\] hasn't written a \[label\] yet." |
| Version save failure | Inline `saveState`: "Not saved — try again." + toast with server message; no optimistic body swap |
| Inspiration, no matching prompt | "No more questions match this path — try another combination." |
| Saved-for-later, empty | "Questions you save land here, ready for the moment you have two minutes." |
| Directory, no matches | `emptyState('No students match.', 'Adjust the search or filter.')` |
| Activity, none since tracking | "No sessions recorded yet — Available from \[date\] — this student has not used StoryForge since tracking was enabled." |
| Review Check preview | "Preview — nothing has been sent" (explicit pre-send state) |
| Loading | Existing `withBusy` affordance on every network action; no skeleton systems introduced |
| Any action failure | Toast fallback: "That action could not be completed." with rollback to server state (no page flash) |

## 12. Copy voice

Warm, specific, second person — the production register, extended. Exact strings from the prototype:

1. "Find the stories you **forgot you had**."
2. "Interviews aren't won with rehearsed "leadership stories." They're won with real, specific memories — a meal, a bus ride, a person who surprised you. A few gentle questions will take you there."
3. "You're in charge here. Skip anything, stop any time — your progress is saved, and nothing is shared unless you add it to your Library."
4. ""Not now" changes nothing: all of your work stays private until you choose otherwise, and you can agree later from Settings."
5. "Fresh page — your earlier telling is safe in this version's history."
6. "Added to your Story Library — same story, same privacy, ready to grow."
7. "Every eligible student, **including the quiet ones**."
8. "StoryForge types while you talk — edit anything after."

Rules the copy obeys: never blame the student; never fabricate ("Available from \[date\]" rather than empty zeros); state consequences at the moment of choice; keep canonical vocabulary (baseline §4) letter-exact.
