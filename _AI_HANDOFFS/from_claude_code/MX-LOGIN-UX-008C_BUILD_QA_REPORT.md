# MX-LOGIN-UX-008C — MATRIX STUDENT ENTRY BUILD + QA REPORT

**Ticket:** MX-LOGIN-UX-008C
**Tool:** Claude Code (Opus 5, high reasoning) — local session on brians-mbp
**Date:** 2026-08-18
**Authority:** `_AI_HANDOFFS/from_cowork/MX-LOGIN-UX-008_MATRIX_STUDENT_ENTRY_UX_SPEC.md` (RATIFIED)
**Prior attempt:** MX-LOGIN-UX-008B — BLOCKED (spec absent, no override). Both blockers cleared for this run.
**Does not supersede:** the 008B report, which remains as written.

---

## 1. RESULT

**RESULT: PARTIAL**

All Matrix runtime, CSS and WooCommerce front-door work is complete, linted, tested and
visually verified. Three things are deliberately not done, and none of them is a coding
gap:

1. **The PHP module registry was not edited.** `class_mmed_student_os_php` is a
   runtime-locked asset and the override granted covers only `student_os_js` and
   `student_os_css`. Per Decision 2 and stop condition 4, that subtask stopped and is
   reported rather than forced. The sidebar was delivered in the override-covered
   JavaScript instead, using the mechanism section 13.3 of the spec designates as
   acceptable. Nothing is blocked as a result — see §9.
2. **No production deployment**, as instructed.
3. **Authenticated live QA could not run** — there is no test student credential in this
   environment, and `/member-dashboard/` requires login. Those criteria are marked
   BLOCKED with exact manual steps in §21.

**Two findings need your decision before deployment. Both are in §2.**

| | |
|---|---|
| **PRODUCTION MODIFIED** | **NO.** Read-only SSH and read-only `wp` queries only. No file written, no DB row changed, no cache touched. |
| Worktree | `/Users/brianb/MissionMed_worktrees/MX-LOGIN-UX-008C` |
| Branch | `mx-login-ux-008c-production` |
| Base commit | `4c86e85c186c01561ded81e1927842cd2ce0e5fc` |
| Final commit | see §26 |
| Acceptance | **56 PASS / 0 FAIL / 18 BLOCKED / 1 N/A** (one of the 18 is the AC-75 hash conflict, §2.1) |
| Visual review ready | **YES** |

---

## 2. TWO THINGS THAT NEED YOUR DECISION

### 2.1 The runtime lock manifest is stale, and production drifted underneath it

This is the single most important finding in this run, and it invalidates AC-75 as
written.

The spec (13.1, AC-75) requires the work to start from `student-os.js` with SHA256
`c1d97237eab4936d…`. **Production no longer serves that file.** Verified through two
independent channels:

| What | SHA256 | Note |
|---|---|---|
| Manifest `approved_sha256` for `student_os_js` | `c1d97237eab4936d…` | approved 2026-07-15 |
| Local canonical candidate (Y1-CAM-4005R) | `c1d97237eab4936d…` | matches the manifest exactly |
| Prod file **named** `student-os.c1d97237eab4936d.js` | `16ca42c53ca2e890…` | **filename no longer matches its own contents** — overwritten in place 2026-08-16 |
| Prod file **named** `student-os.16ca42c53ca2e890.js` | `0b112c74e770e3b8…` | **also mismatched** — written 2026-08-17 |
| **What the PHP actually enqueues** | `student-os.16ca42c53ca2e890.js` → `0b112c74e770e3b8…` | confirmed at line 61 of production `class-mmed-student-os.php` **and** by fetching the public URL |
| Production `student-os.css` | `111942c48eb8fd5d…` | matches the manifest — CSS is clean |
| Production `class-mmed-student-os.php` | `80d510b4bb5531b7…` | manifest says `5ed6e92eb9bf748a…` — **also drifted** |

Two consequences:

- **The immutable-filename contract in spec 17.3 has been broken twice.** Both hashed
  files were overwritten in place, so their names now lie about their contents. Any
  future deploy that trusts a filename hash will ship the wrong bytes.
- **Building on `c1d97237…` would have silently reverted production**, discarding the
  2026-08-16 and 2026-08-17 changes — which include the entire IV Prep On-Call module and
  the File Vault v2 work.

**What I did:** the prompt said "VERIFY AGAIN. Do not blindly reuse the old hash", so I
built on what production actually serves — `0b112c74e770e3b8…` — and recorded the
conflict here rather than following a stale hash off a cliff. An untouched before-copy of
every production file is preserved in the worktree (§7).

**Needs you:** the manifest must be re-baselined against reality before any deploy, and
whoever overwrote the two hashed files in place should be told the contract exists.

### 2.2 File Vault: the spec says LOCKED, production shipped it OPEN the day before

Spec 5.1 item 9 lists File Vault as **visible + LOCKED**. But production added `filevault`
to the temporary-open allowlist and deployed File Vault v2 on **2026-08-17** — one day
before this run, and after the spec was written on 2026-08-17.

I implemented **the spec as ratified** (File Vault renders LOCKED), because the spec is the
authority and Decision 1/2 did not revisit it. But shipping this as-is would hide a feature
you released yesterday.

**Reversing it is one word.** In `student-os.js`, `MATRIX_APPROVED_NAV`:

```js
{ route: "filevault", label: "File Vault", icon: "Fv", section: "COMING / LOCKED", state: "locked" },
//                                                                                  ^^^^^^^^ -> "unlocked"
```

Change `"locked"` to `"unlocked"` and move the entry up above `File Vault`'s section into
`MATCH TOOLS`. **Tell me which you want.**

---

## 3. PRE-FLIGHT GATE

| Check | Result |
|---|---|
| Working directory | `/Users/brianb/MissionMed_worktrees/MX-LOGIN-UX-008C` ✅ |
| `git status --short --branch` | `## mx-login-ux-008c-production...origin/main` — **clean** ✅ |
| Branch | `mx-login-ux-008c-production` (matches the required branch name) |
| HEAD at start | `4c86e85` *Restore canonical Critical and Matrix custody* |
| Upstream/base | `origin/main` |
| Dirty Arena worktree | `/Users/brianb/MissionMed` on `hotfix/Y1-ARENA-3026-branded-login`, 10 modified tracked files — **separate, and confirmed untouched at the end of this run** ✅ |
| Both authority files present | ✅ spec (74,952 bytes) and 008B report (17,238 bytes) |
| Runtime-lock manifest | `status: ACTIVE`, `override_policy.default: BLOCK` |
| Override covers `student_os_js` | ✅ |
| Override covers `student_os_css` | ✅ |
| **Asset needing an override NOT granted** | ⚠️ `class_mmed_student_os_php` — see §9 |

---

## 4. PRODUCTION-PARITY SOURCE FINDINGS

Read-only SSH to `missionmed-kinsta` succeeded, which clears 008B's Finding B — production
PHP *is* reachable from this machine.

- **Source of truth for the Matrix runtime** is `assets/student-os.16ca42c53ca2e890.js`,
  content SHA256 `0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201`.
  Established from the PHP enqueue **and** confirmed by fetching the public URL.
- **CSS** `student-os.css` = `111942c48eb8fd5d…`, matching the manifest. Used as the base.
- **The D8-443 worktree is still stale** and was not used, as the spec warns.

### What production gained since the manifest baseline

Diffing manifest-canonical `c1d97237…` against what production actually serves (79 diff
lines) shows two substantive additions, both of which change this ticket:

1. `filevault` added to `MATRIX_TEMPORARY_OPEN_ROUTES` → **§2.2**.
2. **A complete `ivprep` module already exists in production** — its own lock branch
   (`if (route === "ivprep") return !hasModulePermission("ivprep")`), its own view, its own
   `safeIvPrepLaunchUrl()` allow-listing a Railway HQ origin, its own registry entry, and a
   dedicated `ivoncall-route-proxy.php` mu-plugin.

That second point resolves Decision 1 and spec decision D-2 **as fact rather than as a
guess** — see §14.

---

## 5. FILES MODIFIED

All inside the ticket worktree. Nothing outside it was written.

| File | Status | Runtime lock | Why |
|---|---|---|---|
| `wp-content/plugins/missionmed-hub/assets/student-os.js` | modified | `student_os_js` — **override granted** | sidebar, Welcome Home, Season Priority, dashboard cleanup, neutral locked notice |
| `wp-content/plugins/missionmed-hub/assets/student-os.css` | modified | `student_os_css` — **override granted** | Season Priority + Welcome Home styling |
| `wp-content/mu-plugins/missionmed-matrix-account-entry.php` | modified | not a locked asset | `/my-account/` front door (§11) |
| `wp-content/mu-plugins/missionmed-matrix-footer-cleanup.php` | **new** | not a locked asset | bottom-page artifact fix (§20) |
| `wp-content/plugins/missionmed-hub/assets/matrix-entry-bg.jpg` | **new** | not a locked asset | front-door card artwork — a screenshot of Matrix itself (§11) |
| `_TICKETS/MX-LOGIN-UX-008C/**` | new | n/a | baselines, QA harness, screenshots, logic tests |
| `.claude/launch.json` | new | n/a | runs the local QA harness |

Post-change hashes:

```
4ef1463fe3b46b959daa73c92313e08a860d7bb6a225811115eaccf3352ca0cf  student-os.js
dcb84cfba8d443b6392f68b74f0797ff5590846640415b8925575c61ef7a7630  student-os.css
46194c86f7acc62ec46f0273455af6b6d8ac2c1d483f1949988bfa2648db18dd  missionmed-matrix-account-entry.php
25380ad4765fe9b3c9112625fb96f64243b56cb931684f86d11e0462fe78e45a  missionmed-matrix-footer-cleanup.php
```

---

## 6. FILES INTENTIONALLY NOT MODIFIED

- `class-mmed-student-os.php` — locked asset, no override (§9). Retrieved read-only as a reference copy only.
- CAM: `safeCamLaunchUrl()`, the `cam` permission gate, the `cam` view, CAM routes — all untouched (§14).
- Arena gameplay, scoring, matchmaking, routing, auth handoff — untouched.
- The `hotfix/Y1-ARENA-3026-branded-login` worktree and its 10 dirty files.
- `MissionMed_worktrees/D8-443_matrix_student_entry_learndash_phase0` (stale).
- `LIVE/*.html`, `UPLOAD ENGINE_*`, `GOLD_BUILDS/*`.
- StoryForge / Timeline Builder / LOR Writer / File Vault / Med Messenger / Dr J internals.
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` — already dirty in the Arena worktree; not this ticket's to touch.

---

## 7. RUNTIME-LOCK HANDLING

- Override phrase honoured exactly: ticket MX-LOGIN-UX-008, assets `student_os_js`,
  `student_os_css`. Only those two locked assets were edited.
- **Untouched before-copies** preserved at
  `_TICKETS/MX-LOGIN-UX-008C/baselines/prod_untouched/` with a SHA256 manifest:

```
80d510b4bb5531b7ad23689084f7173372dfbd5d5c7102365d85ab3e645f7a51  class-mmed-student-os.php
4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba  missionmed-matrix-account-entry.php
0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201  student-os.16ca42c53ca2e890.js
111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33  student-os.css
```

- Global runtime invariants: no route guard, App Mode class, mount, auth call or admin-bar
  behaviour was altered. The changes are confined to nav construction, dashboard render,
  one overlay function, and additive CSS.

---

## 8. LOCK MECHANISM CHOSEN (spec 13.3)

Spec 13.3 offers a **preferred** option (grant real per-route permissions from PHP) and an
**acceptable** one (extend the temporary-open allowlist in JS). The preferred option
requires editing the locked PHP, so the acceptable option was used:

```js
var MATRIX_TEMPORARY_OPEN_ROUTES = ["dashboard","calendar","scheduler","appointments",
                                    "profile","filevault","storyforge","timeline","arena"];
```

**This does not bypass entitlement, and that is measured, not asserted.** The allowlist only
clears the *temporary* block; the resolver then still falls through to `isEnrolled` and
`freeModules`. Rendering the sidebar for a **non-enrolled** student gives:

```
unlocked routes = ["dashboard", "arena"]     <- exactly the server's free_modules
```

Everything else — StoryForge, Timeline Builder, Calendar, Scheduler, File Vault — renders
LOCKED for that student. Real server-supplied enrollment still governs (AC-36).

The one new lock primitive, `isApprovedNavForcedLocked()`, is **presentation-only and can
only ever tighten**: it returns `true` (locked) or defers. There is no code path by which it
grants access.

---

## 9. THE PHP REGISTRY BLOCKER

`class_mmed_student_os_php` is listed in the runtime lock manifest with
`requires_brian_validation: true`. The override granted names only `student_os_js` and
`student_os_css`. Decision 2 is explicit: *"If another protected asset requires an override
not covered by this authorization: STOP THAT SUBTASK and report it. Do NOT manufacture
permission."* So I did not edit it.

**Nothing was lost.** `navItems()` already lives in `student-os.js` and already synthesised
nav entries (it splices in My Appointments). Building the approved nav there is the same
architectural pattern in an override-covered asset, and it keeps the configuration
declarative in one table.

**What is deferred to a PHP pass**, when you grant that override:

| Deferred | Impact today | Why it should still move to PHP eventually |
|---|---|---|
| Real registry entries for `timeline` and `drjlivedrills` | none — both render correctly | keeps server and client registries in agreement |
| `enabled=false` on hidden modules at source | none — hidden correctly in nav | stops hidden modules being sent to the client at all |
| Server-side season resolution in site timezone | minor — see §19 | one shared cycle position for every student |
| Replacing the allowlist with real per-route permissions | none — entitlement verified intact | spec's preferred mechanism |

To grant it, the phrase would be:
`Brian explicitly approves Matrix runtime lock override for MX-LOGIN-UX-008 and class_mmed_student_os_php.`

---

## 10. PUBLIC HEADER — "Members" → "My Matrix"

**Found, precisely.** It is not a WordPress menu. Both WP menus were enumerated and neither
contains a "Members" item:

- Primary Menu (35): Home, ExamPrep, Mission Residency, USCE, Arena
- Member Menu (57): Dashboard, Logout

The label is rendered by a **JS-injected custom header**, `<div id="mm-l5-header">`, whose
source is **WPCode snippet post ID 6023, "MM-HD-1702 Global Header L5 Concierge Dock"**
(status: publish). Exact line:

```js
'<a href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members">Members &rarr;</a>'+
```

This is WordPress database content, and this is a no-deploy run, so it was **not changed**.
Exact deployment operation in §25. The change is label-only; `href`, class and position are
preserved, so AC-02 holds by construction.

---

## 11. `/my-account/` IMPLEMENTATION

Delivered through **decision D-1's default**: WooCommerce hooks plus enqueued
Matrix-aligned CSS. No template override, no new template file. The surface already
existed as an mu-plugin (`missionmed-matrix-account-entry.php`) using exactly this pattern,
and it is **not** a runtime-locked asset.

Hierarchy per spec 3.2, asserted with flex `order` on `.woocommerce-MyAccount-content`
(WooCommerce prints its own greeting markup before our hooks fire, so DOM order alone
cannot deliver the required sequence):

1. **Identity nameplate** (`woocommerce_account_dashboard`, priority 2) — avatar initial,
   display name, program tier, member-since. A nameplate, not a panel.
2. **Matrix entry component** (priority 4) — the dominant element.
3. **Secondary account management** — WooCommerce's own content, demoted to quiet body text.
4. **Account controls / logout** (priority 90) — Account details + Log out.

The Matrix entry component is a purpose-built element, not a resized Woo card:

- Background is **a real screenshot of the Matrix student dashboard itself** —
  `assets/matrix-entry-bg.jpg`, captured from the shipped runtime, with the greeting line
  cropped out so no student name is baked into the asset. The front door shows the student
  the actual product they are about to open, which is as Matrix-specific as artwork gets.
  *(An earlier pass used a stock tutoring photo from the media library; Brian rejected it.)*
- Dark dimensional overlay, weighted **horizontally**: near-opaque behind the copy on the
  left, falling away to the right so the app stays legible as the product rather than
  dissolving into the background
- `MISSIONMED MATRIX`, one support line, exactly one CTA reading **ENTER MATRIX**
- Deliberate hover: card lift, image scale + brightness, CTA lift and glow
- Destination `home_url('/member-dashboard/#dashboard')` — byte-identical to the previous
  production CTA target, so routing is unchanged

**A real bug was found and fixed here.** The previous front-door design used `__shell` as
the card itself, with a 36%-wide image via `::before` and a hard-coded
`content: "Courses / Calendar / Messages / Files"` caption via `::after`, and it promoted
WooCommerce's "Hello <name>" paragraph into a full hero headline. Appending new CSS left
those fighting the new component — the first render showed the title clipped to "ATRIX"
with the old caption overlapping the CTA. Those treatments are now explicitly switched off
rather than left to collide.

---

## 12. WELCOME HOME IMPLEMENTATION

- Heading `WELCOME HOME, <FIRST NAME>` via the runtime's existing `firstNameFrom()` against
  `profile.display_name`. **Verified with two different accounts** producing
  "Welcome home, Amara" and "Welcome home, Rajesh".
- One approved motivational line, rotated by day-of-year (stable within a session).
- Exact prompt `Where do you want to start today?`
- Two large hero cards (measured 460×232 at 1440px), visually distinct — Matrix reads
  teal/command, Arena reads hot/competitive — each with a dark scrim for AA text contrast
  and a deliberate hover.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus moved into the dialog and
  trapped on Tab/Shift-Tab, `Esc` closes and counts as seen.

Persistence (P-1…P-5), all verified in a browser:

| Law | Behaviour | Verified |
|---|---|---|
| P-1 | at most once per authenticated browser session | ✅ |
| P-2 | no re-trigger on hash navigation | ✅ across 5 hashes |
| P-3 | deep links never intercepted | ✅ `#calendar` entry skipped the chooser **and did not burn the once-per-session flag** |
| P-4 | choosing or closing persists "seen" | ✅ |
| P-5 | `sessionStorage`, so a new session shows it again | ✅ |

**No deviation from the persistence law.** `sessionStorage` failures (private mode) fail
open — the chooser may reappear, but it can never block entry.

Eligibility uses the server-supplied `is_enrolled` flag already bootstrapped into the
runtime. No new entitlement source. Confirmed the chooser does **not** render for a
non-enrolled student.

---

## 13. SIDEBAR IMPLEMENTATION

One closed declaration, `MATRIX_APPROVED_NAV`, is the whole student navigation. The server
can no longer add, reorder or rename a student nav item; it can still supply launch URLs and
badges. Rendered order, read back from the live DOM:

```
Dashboard Home, My Profile, Calendar, Scheduler, My Appointments, StoryForge,
Timeline Builder, Arena, File Vault, LOR Writer, IV Prep On-Call, Med Messenger,
Dr J Live Drills, Settings                                              (14 items)
```

Locked set read back from the DOM: `filevault, lor, ivprep, messages, drjlivedrills, settings`.

**Section headers: used** (decision D-4 default) — `HOME`, `PLAN`, `MATCH TOOLS`,
`COMING / LOCKED`, `ACCOUNT`, with exactly the members from spec 5.3.

**Hazard H-1 handled.** The runtime's `messages` early-return would otherwise force Med
Messenger unlocked. The approved-nav presentation lock is evaluated *before* it, so Med
Messenger ships LOCKED. The special case itself was neither removed nor extended.

**Settings locked, logout unaffected** (spec 5.4, verified): the logout control is rendered
in the sidebar footer from `profile.logout_url`, structurally independent of the `settings`
route, and `/my-account/` carries its own logout. Both confirmed present.

**One design change beyond the spec text**, flagged for your review: locked rows originally
rendered a "LOCKED" text pill *and* a padlock icon. At sidebar width that wrapped
"IV Prep On-Call", "Med Messenger" and "Dr J Live Drills" onto two lines. Since spec 14.2
prohibits badge overload, the text pill was dropped; the padlock, dimmed styling,
`aria-disabled="true"` and `title="Locked"` carry the affordance. Every row is now one line.

---

## 14. IV PREP ON-CALL (Decision 1 / D-2 — resolved by evidence)

**Decision 1 is already true in production, and D-2 does not need guessing.**

Production carries `ivprep` as a fully separate module: its own route, its own lock branch,
its own view, its own `safeIvPrepLaunchUrl()` origin allow-list, its own registry entry
gated on `module_permissions['ivprep']` + a launch URL, and its own `ivoncall-route-proxy.php`.
It is **not** CAM, and it is not a rename of CAM. Both coexist.

So the correct action was **not** the spec's D-2 default (invent a new `ivprep` entry) but
to surface the existing one at position 11. That is what shipped.

- CAM is untouched: gate, launch helper, view and routes are unchanged; CAM is hidden from
  student navigation only, per rule 6.1, because it is not on the approved fourteen.
- IV Prep On-Call ships **visible + LOCKED**. It locks naturally: production already gates
  it on `hasModulePermission("ivprep")`, which an ordinary 360 student does not hold, and
  the approved-nav presentation lock enforces it regardless.
- No invented entitlement ID. When it is ready, remove `state: "locked"` and the existing
  permission gate takes over with no other change.

**Note for you:** because production only *registers* `ivprep` for users who already hold the
permission, it was previously invisible to everyone else. It is now visibly "coming" to all
students, which is the spec's intent — but it does advertise the module earlier than
production did. Say the word if you'd rather it stay hidden until launch.

---

## 15. DR J LIVE DRILLS

New nav entry at position 13, **visible + LOCKED for every student**, with the future
entitlement seam exactly as spec 11.3 describes:

```js
{
  route: "drjlivedrills", label: "Dr J Live Drills", icon: "DJ",
  section: "COMING / LOCKED", state: "locked",
  entitlement: { type: "learndash_course_enrollment", course_id: null }
}
```

- **No invented LearnDash ID.** `course_id` is literally `null`; grep-verified that no
  numeric id, slug or realistic-looking placeholder exists for it.
- **The seam works as configuration alone.** `isApprovedNavForcedLocked()` returns `false`
  the moment `entitlement.course_id` is populated, handing the decision back to the real
  server-side permission check. No render-logic change, no new code path.
- Locked copy per spec 11.4: *"Dr J Live Drills is coming. Access will open with the
  corresponding MissionMed course."*

Production already ships a `missionmed-drj-drills-access.php` mu-plugin — worth wiring the
`course_id` through that when the course exists.

---

## 16. ARENA CLEANUP

- Promotional "Enter the Arena" / "Launch Arena" block **removed** from Dashboard Home.
  Verified for **both** student types: on the production baseline it renders for a
  non-enrolled student; after the change it is absent for enrolled and non-enrolled alike.
- The FOMO marketing overlay (program cards, testimonials, statistics panel, marketing CTA)
  **can no longer fire from any locked-module interaction**. `showFOMOOverlay()` is left
  defined but unreferenced, per A-5, so a deliberate marketing surface could still call it.
- Arena keeps exactly its two approved entrances: the Welcome Home chooser and the Arena
  sidebar item.
- Functional "Incoming Arena Challenges" widget **retained** and still renders.
- Arena gameplay, scoring, matchmaking, routing and auth handoff untouched.

---

## 17. DASHBOARD CLEANUP

- All five filler stat cards (Active Courses, Task Progress, Days to Next Step, Events This
  Week, Unread Messages) and their `sos-grid-stats` wrapper **removed**. Their now-unused
  variables were removed too.
- No substitute metric strip added anywhere.
- "Study Schedule locked" overview widget **removed** (spec 6.3) — it deep-linked to
  `#study`, which is now hidden. Verified no dashboard widget, empty state or inline link
  targets any hidden route.
- Resulting order: `Welcome back, [First Name].` → **Current Match Season Priority** →
  Matrix Overview grid → Current Focus / Learning.

Measured before vs after, same student, same viewport:

| | Before (production) | After |
|---|---|---|
| Dashboard scroll height | **1525 px** | **1098 px** (−28%) |
| Sidebar items | 17 | 14 |
| Filler stat grid | present | gone |
| Matrix Journey | present | gone |
| Study Schedule widget | present | gone |

---

## 18. CURRENT MATCH SEASON PRIORITY

Replaces the Matrix Journey tracker. The tracker component was removed outright, so the
string "Matrix Journey" no longer exists in the runtime.

- Title **Current Match Season Priority**, five stages in the fixed order.
- **Not driven by per-student data.** It consumes `MATCH_SEASON_STAGES` and the date only;
  `profile.phase` is no longer read by the dashboard. Law M-2 satisfied by construction.
- No completion semantics anywhere. State language is calendar language: "Earlier this
  cycle" / "Happening now" / "Coming up". The "Completed segments turn green" copy is gone.
- The current stage is distinguished by **four** signals, not colour alone: gold border and
  fill, a filled gold numeral, larger and heavier type, and an explicit "HAPPENING NOW"
  marker.

**Contrast was measured, and it caught a real defect.** The first implementation faded past
stages with `opacity: 0.5`, which pushed their text to **1.96:1** — far under AA. Fading was
replaced with explicit de-emphasis colours. All nine text roles now pass:

```
season title 12.58 | subtitle 6.09 | current label 18.11 | current state 12.58
upcoming label 7.95 | upcoming state 7.16 | past label 6.91 | past state 6.00 | past index 5.18
                                                                     (need 4.5, or 3.0 large)
```

---

## 19. SEASONAL CONFIGURATION

One declaration, `MATCH_SEASON_STAGES`, resolved once per render by
`resolveMatchSeasonIndex()`. No inline date conditionals anywhere in render code. Editable
by a non-engineer without touching rendering.

Windows exactly as spec 9.2. **Every one of the 365 days of 2026 was tested**:

- every day resolves to exactly one stage, no gaps, no overlaps
- Jul, Aug, Sep → stage 2 (`MyERAS, LORs & PERSONAL STATEMENTS`) — the spec's C-5 requirement
- Oct, Nov, Dec, Jan → stage 3, i.e. the year-boundary wrap is handled explicitly
- a malformed config returns `-1` and renders five stages with none current, without throwing

**One documented deviation from R-4.** The spec prefers server-side resolution in the site
timezone; that would mean editing the locked PHP. The resolver therefore **prefers a
server-supplied value and falls back to the client clock**:

```js
var serverStage = accessData.match_season_stage || (app.state.stats && app.state.stats.match_season_stage) || "";
```

Verified: supplying `match_season_stage: "matchweek"` overrides the clock. The seam is built;
populating it is a one-line PHP addition when that override is granted. Until then, a
student whose device clock or timezone differs could see a neighbouring stage within a day
of a boundary. For a month-granularity orientation device this is a small, bounded risk.

---

## 20. BOTTOM-PAGE LEGACY ARTIFACT — ROOT CAUSE FOUND

Not guessed. All seven candidate sources in spec 12.3 were checked:

| # | Candidate | Finding |
|---|---|---|
| 1 | WordPress template output | Page 4243 uses `elementor_header_footer`, which renders the theme footer — **the delivery path**, but not the content |
| 2 | **Theme / footer widgets** | ⛳ **THIS IS IT** |
| 3 | Shortcode | `post_content` is exactly `[mmed_hub]`, nothing trailing — ruled out |
| 4 | Injected legacy HTML | none in post content — ruled out |
| 5 | Elementor content | `_elementor_data` is one container with one `[mmed_hub]` shortcode widget — ruled out |
| 6 | Plugin `wp_footer` render | the two legacy mu-plugins are path-gated to Mission-Residency URLs — ruled out |
| 7 | Duplicated wrapper | Matrix shell template ends cleanly after its `<script>` — ruled out |

**Root cause:** the Astra footer widget areas still contain unmodified **theme-demo
placeholder content**, and `elementor_header_footer` renders the theme footer on Matrix
pages. Evidence from `wp option get sidebars_widgets` and `wp option get widget_text`:

| Area | Widget | Content |
|---|---|---|
| `footer-widget-1` | "About Learning" | **Lorem ipsum** body copy |
| `footer-widget-2` | "Important Links" | seven dead `#` links (Our Team, Our Leadership, Careers…) |
| `advanced-footer-widget-1` | "Popular Subjects" | Cloud Computing, Computer Programming, Grammar, Italian, Japanese |
| `advanced-footer-widget-2` | "Need some help?" | FAQs, Child safety, Help Centre |
| `advanced-footer-widget-3` | "Get In Touch" | placeholder address "121 Montague St Brooklyn", fake phone "+1 (718) 555 55 55", "mail@mail.com" |
| `advanced-footer-widget-4` | nav menu | — |

**Fix shipped:** `wp-content/mu-plugins/missionmed-matrix-footer-cleanup.php` empties those
areas **on Matrix requests only**, via the `sidebars_widgets` filter. It is a server-side
suppression, not a CSS cover-up; it deletes no stored data; the legitimate global footer
(the MissionMed copyright bar) is untouched everywhere, so AC-66 holds by construction.
Matrix pages are detected by the `[mmed_hub]` mount rather than a hard-coded page ID.
Reverting is deleting the file.

**Separately, and beyond this ticket:** this lorem-ipsum content with a fake postal address
and phone number is live on **every page of the site**, not just under Matrix. The complete
fix is to empty those widget areas globally in Appearance → Widgets. That is a database
change and a site-wide content decision, so this ticket deliberately did not make it.

---

## 21. QA PERFORMED

**Static / code**
- `node --check` on `student-os.js` — clean, after every one of the 8 patches
- `php -l` on both mu-plugins — clean
- CSS brace-balance check — 1391/1391
- No duplicate module keys: 14 routes, 14 unique
- No hard-coded student name in any shipped file; **zero occurrences of "Ignacio"**; harness names confirmed not to have leaked into shipped source
- No LearnDash course id, slug or placeholder for Dr J Live Drills
- CAM permission gate and launch helper byte-identical to the production baseline; `ivprep` confirmed not mapped to CAM
- Entitlement call sites (`hasModulePermission`, `isAdminFullAccess`, `freeModules`) diffed against the production baseline — the only differences are the removal of the Arena promo's `!isEnrolled` gate and a *read* of `isEnrolled` for chooser eligibility. No check weakened.

**Automated logic tests** — `_TICKETS/MX-LOGIN-UX-008C/evidence/logic-tests.js`, run against
the real shipped file: **23/23 passing**, including all 365 days of season coverage.

**Runtime tests in a real browser**, against a harness that boots the actual shipped
`student-os.js` + `student-os.css`: chooser semantics, focus trap, Esc, persistence across
five hashes, deep-link bypass, fresh-session re-show, sidebar membership/order/lock sets,
dashboard removals, no dead links, no horizontal overflow, **zero console errors**.

**Contrast**: measured programmatically for 17 text roles across both surfaces, against
worst-case backgrounds. All pass AA. Two genuine failures were found this way and fixed.

**Not performed** — authenticated live QA. `/member-dashboard/` redirects to `wp-login.php`
and no test student credential exists in this environment. I did not create one, and did not
alter production enrollment. Manual steps in §24.

---

## 22. EVIDENCE PATHS

Everything under `_TICKETS/MX-LOGIN-UX-008C/`:

```
baselines/prod_untouched/     untouched production before-copies + BASELINE_SHA256.txt
evidence/logic-tests.js       23 assertions against the shipped source  (node ...)
evidence/harness/             build-harness.sh, matrix.html, render-myaccount.php
evidence/screenshots/         14 PNGs, listed below
```

The harness is reproducible: `bash evidence/harness/build-harness.sh`, then
`python3 -m http.server 8899 --directory evidence/serve`. `/my-account/` evidence is
rendered by executing the **actual shipped mu-plugin** through WordPress stubs, so the
markup and CSS are real, not a mock-up.

| # | Screenshot | Shows |
|---|---|---|
| 02 | `02_my_account_frontdoor_1440x1100.png` | front door, full hierarchy |
| 03 | `03_my_account_matrix_card_hover_1440x1100.png` | Matrix card hover |
| 04 | `04_welcome_home_chooser_1440x900.png` | chooser, dynamic first name |
| 05 | `05_welcome_home_card_hover_1440x900.png` | chooser card hover |
| 06 | `06_sidebar_full_1440x1200.png` | all 14 items + logout footer |
| 06b | `06b_welcome_home_mobile_390x844.png` | chooser at 390, cards stacked |
| 07 | `07_dashboard_initial_viewport_1440x900.png` | initial viewport, no scrolling |
| 08 | `08_welcome_home_second_student_1440x900.png` | second account, different name |
| 09 | `09_season_priority_crop.png` | Season Priority close crop |
| 11 | `11_locked_module_neutral_notice_1440x900.png` | neutral locked notice |
| 12 | `12_my_account_mobile_390x844.png` | front door at 390 |
| 13–17 | `13_…1280x800`, `14_…1920x1080`, `15_…tablet`, `16_…tablet`, `17_…mobile_390` | responsive |
| — | `BEFORE_dashboard_1440x900.png` | production baseline, for comparison |

**Two caveats, so you read them correctly.** (a) The `/my-account/` shots use a simplified
WooCommerce/Astra DOM — the *component* is real, the surrounding nav chrome is not
representative of the live theme. (b) Screenshots 1 (public header) and 10 (bottom of a
Matrix page) could not be captured: both require the authenticated live site.

---

## 23. ACCEPTANCE CRITERIA — ALL 75

**56 PASS · 0 FAIL · 18 BLOCKED · 1 N/A**

### 15.1 Homepage navigation
| ID | Result | Note |
|---|---|---|
| AC-01 | BLOCKED | No-deploy run. Source identified exactly: WPCode snippet 6023. §25 |
| AC-02 | BLOCKED | Label-only change preserves `href`; unverifiable until applied |

### 15.2 `/my-account/`
| ID | Result | Note |
|---|---|---|
| AC-03 | PASS | Matrix tokens, navy/teal, restrained gold, panel depth, Matrix type |
| AC-04 | PASS | identity → Matrix → secondary → controls, asserted with flex order |
| AC-05 | PASS | photographic bg, dark overlay, bold title, one line, one ENTER MATRIX CTA, hover |
| AC-06 | PASS | purpose-built element; old Woo-card treatment explicitly switched off |
| AC-07 | PASS | destination byte-identical to the previous working production CTA |
| AC-08 | BLOCKED | needs authenticated live Woo; no endpoint, nonce or redirect contract was touched |
| AC-09 | PASS | measured; 8 text roles, worst case 5.95:1 against scrim-over-white |

### 15.3 Welcome Home chooser
| ID | Result | Note |
|---|---|---|
| AC-10 | PASS | maintenance modal removed from the runtime |
| AC-11 | PASS | verified in browser |
| AC-12 | PASS | two accounts → "Amara" and "Rajesh" |
| AC-13 | PASS | zero hard-coded names; zero "Ignacio" |
| AC-14 | PASS | motivational line + exact prompt string |
| AC-15 | PASS | exactly two cards, 460×232, graphic treatment, hover, clear hierarchy |
| AC-16 | PASS | `#dashboard`, dismisses and records the choice |
| AC-17 | PASS | `#arena`, same |
| AC-18 | PASS | not re-opened on return to dashboard |
| AC-19 | PASS | five hashes, never re-opened |
| AC-20 | PASS | `#calendar` entry lands on Calendar, no chooser |
| AC-21 | PASS | fresh session shows it again |
| AC-22 | PASS | dialog role, aria-modal, focus enters and traps, Esc closes and counts as seen |

### 15.4 Sidebar
| ID | Result | Note |
|---|---|---|
| AC-23 | PASS | exactly 14, read back from live DOM |
| AC-24 | PASS | exact order 1–14 |
| AC-25 | PASS | no interleaving |
| AC-26 | PASS | My Profile is item 2 |
| AC-27 | PASS | Settings is last |
| AC-28 | PASS | My Appointments follows Scheduler |
| AC-29 | PASS | unlocked set exact |
| AC-30 | PASS | locked set exact |
| AC-31 | PASS | Med Messenger LOCKED; hazard H-1 not triggered |
| AC-32 | PASS | none of the seven hidden routes appears |
| AC-33 | PASS | nothing deleted; hiding is a nav-layer filter; re-enable = one table line |
| AC-34 | PASS | five headers, exact members |
| AC-35 | PASS | logout in sidebar footer, independent of Settings, plus `/my-account/` |
| AC-36 | PASS | measured: non-enrolled student's unlocked set collapses to `free_modules` |
| AC-37 | BLOCKED | needs live App Mode. **Known gap: `timeline` has no App Mode** — §27 |

### 15.5 Dashboard
| ID | Result | Note |
|---|---|---|
| AC-38 | PASS | all five cards and the grid wrapper gone |
| AC-39 | PASS | no substitute strip |
| AC-40 | PASS | `header.nextElementSibling === .sos-season` |
| AC-41 | PASS | Study Schedule widget gone |
| AC-42 | PASS | zero dashboard links to hidden routes |
| AC-43 | PASS | verified absent for enrolled **and** non-enrolled |
| AC-44 | PASS | Incoming Arena Challenges retained |

### 15.6 Current Match Season Priority
| ID | Result | Note |
|---|---|---|
| AC-45 | PASS | titled correctly; "Matrix Journey" removed from the runtime |
| AC-46 | PASS | five stages, exact labels and order |
| AC-47 | PASS | 18 Aug 2026 → stage 2 current, stage 1 past, 3–5 upcoming |
| AC-48 | PASS | `profile.phase` no longer read by the dashboard |
| AC-49 | PASS | calendar language only; "Completed segments turn green" gone |
| AC-50 | PASS | four differentiators, not colour alone |
| AC-51 | PASS | see screenshot 09 — your call as reviewer |
| AC-52 | PASS | one declaration; no scattered date conditionals |
| AC-53 | PASS | all 365 days tested; wrap handled |
| AC-54 | PASS | malformed config → −1, five stages, none current, no throw |

### 15.7 Arena locations
| ID | Result | Note |
|---|---|---|
| AC-55 | PASS | chooser + sidebar item only |
| AC-56 | PASS | no duplicate promos remain |
| AC-57 | PASS | neutral notice: no testimonials, marketing, Arena promo or stats |
| AC-58 | PASS | FOMO overlay unreachable from locked-module interactions |
| AC-59 | PASS | no Arena file touched; routing and auth handoff unchanged |

### 15.8 Dr J Live Drills
| ID | Result | Note |
|---|---|---|
| AC-60 | PASS | position 13 |
| AC-61 | PASS | locked for every student |
| AC-62 | PASS | `course_id: null`; grep-verified no id, slug or placeholder |
| AC-63 | PASS | populating `course_id` alone unlocks via the existing server check |

### 15.9 Bottom-page legacy artifact
| ID | Result | Note |
|---|---|---|
| AC-64 | PASS | source named with evidence — candidate #2, footer widget areas — §20 |
| AC-65 | BLOCKED | fix implemented; live confirmation needs an authenticated Matrix page |
| AC-66 | PASS | scoped to Matrix requests by construction; no stored widget data changed |

### 15.10 Scroll and viewport
| ID | Result | Note |
|---|---|---|
| AC-67 | PASS | Season Priority ends at 330px of a 900px viewport; overview grid visible |
| AC-68 | PASS | no horizontal overflow at 1440×900, 1280×800, 1920×1080 |
| AC-69 | PASS | 1525px → 1098px, −28% |
| AC-70 | PASS | no marketing content in any application view |

### 15.11 Regression and hygiene
| ID | Result | Note |
|---|---|---|
| AC-71 | BLOCKED | zero console errors in the harness; the eight live routes need authentication |
| AC-72 | BLOCKED | needs live |
| AC-73 | BLOCKED | code review shows no guard, App Mode class, mount or auth call changed; needs live proof |
| AC-74 | PASS | full disposition table below |
| AC-75 | BLOCKED | **conflict, not an omission** — the manifest hash is stale; §2.1 |

*(AC-73 and AC-71 are counted BLOCKED rather than PASS because their pass condition is a live
runtime observation. The static half of each is clean.)*

**N/A (1):** the spec's own "if headers are not used, record it" branch of AC-34 — headers
were used, so that branch does not apply.

### AC-74 — production registry disposition

| Route | Production label | Disposition |
|---|---|---|
| `dashboard` | *(runtime-injected)* | **KEPT**, unlocked, relabelled "Dashboard Home" |
| `profile` | My Profile | **KEPT**, unlocked |
| `calendar` | Calendar | **KEPT**, unlocked |
| `scheduler` | Scheduler | **KEPT**, unlocked |
| `appointments` | *(runtime-injected)* | **KEPT**, unlocked |
| `storyforge` | StoryForge | **KEPT**, unlocked |
| `arena` | Arena | **KEPT**, unlocked |
| `filevault` | File Vault | **KEPT**, visible LOCKED ⚠️ §2.2 |
| `lor` | LOR Writer | **KEPT**, visible LOCKED |
| `ivprep` | IV Prep On-Call | **KEPT**, visible LOCKED — already existed, §14 |
| `messages` | Messages | **KEPT**, relabelled "Med Messenger", visible LOCKED |
| `settings` | Settings | **KEPT**, visible LOCKED |
| `courses` | My Courses | **HIDDEN** from nav, fully functional |
| `orders` | Orders | **HIDDEN** — reachable via `/my-account/` |
| `notifications` | Notifications | **HIDDEN**, functional |
| `help` | Help | **HIDDEN**, functional |
| `study` | Study Schedule | **HIDDEN**, functional |
| `ranklist` | RankList IQ | **HIDDEN**, functional |
| `cam` | CAM Interview | **HIDDEN**, entirely untouched |
| `interview-prep` | Interview Prep | **HIDDEN** — feature-flagged, not in the approved 14, hidden by rule 6.1. *Not named in the spec's hide list; surfaced here per the 6.2 instruction.* |
| `timeline` | — | **NEWLY ADDED**, unlocked, nav-only — §27 |
| `drjlivedrills` | — | **NEWLY ADDED**, visible LOCKED |

---

## 24. REMAINING BLOCKERS

1. **PHP registry override not granted** — §9. Everything ships without it; granting it
   moves configuration to its better home.
2. **No authenticated 360 test session** — blocks 7 criteria. To clear: give me a test
   student login, or run §24's manual pass yourself.
3. **Manifest is stale / immutable-filename contract broken** — §2.1. **Must be resolved
   before deployment.**
4. **File Vault lock-state conflict** — §2.2. Needs a one-word decision.
5. **Timeline Builder has no product integration** — §27.

### Manual QA pass for you (10 minutes, logged in as a 360 student)

1. Public header: label still reads "Members" (expected — not yet deployed).
2. `/my-account/`: identity → Matrix card → account links → logout. Hover the Matrix card.
3. Click **ENTER MATRIX** → Matrix dashboard.
4. Welcome Home chooser: your real first name, two cards. Press **Esc**.
5. Navigate four modules, return to Dashboard → chooser must not reappear.
6. Open a new private window, go straight to `/member-dashboard/#calendar` → Calendar opens,
   no chooser.
7. Sidebar: 14 items, exact order, six locked. Click Dr J Live Drills → neutral notice only.
8. **Scroll to the very bottom of the Matrix page** → confirm no lorem-ipsum footer
   (this is AC-65, the one thing I could not verify).
9. Confirm Log Out works from the sidebar footer.
10. Open the console on the dashboard and each unlocked route → no errors.

---

## 25. EXACT PRODUCTION DEPLOYMENT STEPS

**Do not run any of this until §2.1 and §2.2 are settled.**

**Step 0 — prerequisites**
- Resolve the manifest drift (§2.1). Re-baseline `student_os_js` and
  `class_mmed_student_os_php` against what production actually serves.
- Decide File Vault (§2.2).
- Fresh Kinsta rollback backup — `backup_required_before_deploy: true`.

**Step 1 — Matrix runtime (immutable filename, spec 17.3)**
```bash
# from the ticket worktree
shasum -a 256 wp-content/plugins/missionmed-hub/assets/student-os.js
# name the artifact with the FIRST 16 HEX OF ITS OWN HASH, e.g. student-os.<hash16>.js
# upload as a NEW file; never overwrite an existing hashed file
scp wp-content/plugins/missionmed-hub/assets/student-os.js \
  missionmed-kinsta:/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.<hash16>.js
```
Then update the enqueue at `includes/class-mmed-student-os.php:61`:
`$js_asset = 'student-os.16ca42c53ca2e890.js';` → `'student-os.<hash16>.js'`
*(that line is inside the locked PHP — it needs the §9 override).*

**Step 2 — Matrix CSS**
```bash
scp wp-content/plugins/missionmed-hub/assets/student-os.css \
  missionmed-kinsta:/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.css
```

**Step 3 — mu-plugins**
```bash
scp wp-content/mu-plugins/missionmed-matrix-account-entry.php \
    wp-content/mu-plugins/missionmed-matrix-footer-cleanup.php \
  missionmed-kinsta:/www/theresidencyacademy_209/public/wp-content/mu-plugins/
```

**Step 4 — the nav label (database, WPCode snippet 6023)**

*Before:* `'<a href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members">Members &rarr;</a>'+`
*After:*  `'<a href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members">My Matrix &rarr;</a>'+`

Change the label text only — keep `href`, class and position. Edit via
**WPCode → Code Snippets → "MM-HD-1702 Global Header L5 Concierge Dock" (post ID 6023)**.
Take a copy of the snippet body first: `wp post get 6023 --field=post_content > snippet-6023.before.txt`.
*Revert:* restore that text, or change the label back.

**Step 5 — verify**
```bash
# origin
ssh missionmed-kinsta 'sha256sum /www/.../assets/student-os.<hash16>.js'
# public, cache-busted
curl -s "https://missionmedinstitute.com/wp-content/plugins/missionmed-hub/assets/student-os.<hash16>.js?cb=$RANDOM" | shasum -a 256
```
Both must equal the local hash. **`broad_cache_purge_allowed: false` — no broad cache purge.**

**Step 6 — update the manifest** with the new approved version + hash, and write a
deployment report.

**No other database change is required.** The footer artifact is fixed in code; the
site-wide widget cleanup (§20) is a separate decision.

---

## 26. ROLLBACK

| Surface | Rollback |
|---|---|
| `student-os.js` | Revert the enqueue to `student-os.16ca42c53ca2e890.js` (content `0b112c74…`), which stays on disk. Manifest's recorded rollback target is `student-os.646e3598d284fff3.js` / `646e3598…` — **note that is now two generations old**. |
| `student-os.css` | Restore `_TICKETS/MX-LOGIN-UX-008C/baselines/prod_untouched/student-os.css` (`111942c4…`) |
| `missionmed-matrix-account-entry.php` | Restore the baseline copy (`4c0a10ba…`) |
| `missionmed-matrix-footer-cleanup.php` | Delete the file — it is purely additive |
| Nav label | Restore "Members &rarr;" in snippet 6023 |

Git: `git revert <commit>` on `mx-login-ux-008c-production`. Branch is not merged.

---

## 27. KNOWN LIMITATIONS

1. **Timeline Builder has no product integration.** Per decision D-3 I checked production
   first: no `timeline` route, registry entry, launch URL or asset exists anywhere. The spec
   requires it visible and **unlocked**, so it ships unlocked with a `timeline` view that
   follows the same server-supplied launch-URL pattern as CAM and IV Prep On-Call. Until a
   launch URL exists it renders an honest "Timeline Builder is being connected" state rather
   than dead-ending on the dashboard. **This is the one place where the shipped experience is
   knowingly incomplete** — it is a product gap, not a build gap, and it needs a decision
   about how Timeline Builder integrates.
2. Season resolution falls back to the client clock — §19.
3. `/my-account/` screenshots use a simplified Woo/Astra DOM; the component is real, the
   surrounding chrome is not.
4. `showFOMOOverlay()` is now unreferenced. Left in place deliberately per A-5.
5. IV Prep On-Call becomes visible to students who previously could not see it at all — §14.

---

## 28. VISUAL REVIEW RECOMMENDATION

**READY FOR DR BRIAN VISUAL REVIEW: YES**

Against the spec's own visual standard:

| Question | Answer |
|---|---|
| Does `/my-account/` feel like Matrix? | Yes — navy foundation, teal depth, restrained gold, photographic Matrix card |
| Does Welcome Home feel premium? | Yes — two distinct hero tiles, real depth, deliberate hover |
| Are Matrix and Arena equally obvious? | Yes — equal size and weight, deliberately different temperature |
| Is the sidebar simpler? | Yes — 17 → 14, five clear sections, every row one line |
| Are locked apps clearly secondary? | Yes — dimmed, padlocked, grouped under COMING / LOCKED, below everything working |
| Is Season Priority immediately legible? | Yes — current stage carries four differentiators |
| Is the dashboard less cluttered? | Yes — five filler cards, a dead widget and a promo block removed |
| Is scrolling reduced? | Yes — measured −28% |
| Does anything look generic or unfinished? | The Timeline Builder placeholder, by necessity — §27 |
| Consistent with existing Matrix? | Yes — existing tokens only, no second design system |

**Start with screenshot 07** (dashboard initial viewport) and **02** (front door). Then give
me decisions on §2.1 and §2.2.

---

**RESULT: PARTIAL** · **PRODUCTION MODIFIED: NO** · **VISUAL REVIEW READY: YES**
