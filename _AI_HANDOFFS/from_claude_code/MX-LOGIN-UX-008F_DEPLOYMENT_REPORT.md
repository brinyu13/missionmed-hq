# MX-LOGIN-UX-008F — MATRIX STUDENT EXPERIENCE DEPLOYMENT REPORT

**Ticket:** MX-LOGIN-UX-008F (finalize + deploy)
**Tool:** Claude Code (Opus 5, high reasoning)
**Date:** 2026-08-20
**Authority:** MX-LOGIN-UX-008F founder decisions, which supersede conflicting language in
the earlier MX-LOGIN-UX-008 specification.
**Predecessors:** MX-LOGIN-UX-008B (BLOCKED), MX-LOGIN-UX-008C (build + QA, not deployed).
Neither is superseded; both remain as written.

---

## 1. RESULT

**RESULT: COMPLETE** · **PRODUCTION DEPLOYED: YES** · **SMOKE TEST: PASS**

The Matrix student entry experience is live. No rollback was required. Six acceptance
criteria remain open and all six need an authenticated student session — the short
checklist is in §12.

| | |
|---|---|
| Deployed code commit | `056d199` on `mx-login-ux-008c-production` (see §2) |
| Deployment record commit | `e117c5d` |
| Runtime artifact | `assets/student-os.809093d2b5b2bc05.js` |
| Runtime manifest | **RE-BASELINED** (twice: pre-deploy to reality, post-deploy to shipped) |
| Rollback | **READY** — `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-LOGIN-UX-008F/20260820T182018Z` |
| Acceptance | **68 PASS / 0 FAIL / 6 BLOCKED / 1 N/A** |
| Manual checks remaining | **6** (~5 minutes) |

**One defect was caught and fixed during deployment** — see §7. It would have broken the
global site header.

---

## 2. DEPLOYED COMMIT

Branch `mx-login-ux-008c-production`, three commits ahead of `origin/main`:

The bytes that went to production were built at `056d199`; `e117c5d` is the commit that
records the deployment itself (report + post-deploy manifest baseline). The authoritative
identifier for what is running is the artifact hash `809093d2b5b2bc05…`.

| Commit | Subject |
|---|---|
| `e117c5d` | MX-LOGIN-UX-008F: deploy Matrix student experience to production |
| `056d199` | MX-LOGIN-UX-008F: apply founder decisions and prepare deployment |
| `af54732` | MX-LOGIN-UX-008C: use a Matrix screenshot as the front-door card artwork |
| `e50c597` | MX-LOGIN-UX-008C: refresh Matrix student entry experience |

Not merged to `main`. The dirty `hotfix/Y1-ARENA-3026-branded-login` worktree was not
touched; its ten modified tracked files are byte-identical to how this ticket found them.

---

## 3. FILES CHANGED IN PRODUCTION

| Production path | Action | SHA256 |
|---|---|---|
| `plugins/missionmed-hub/assets/student-os.809093d2b5b2bc05.js` | **NEW** | `809093d2b5b2bc05cdd4f355511f2c8d5303c71edbca4f71823d319976ced54f` |
| `plugins/missionmed-hub/assets/student-os.css` | replaced | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260` |
| `plugins/missionmed-hub/assets/matrix-entry-bg.jpg` | **NEW** | `3e25ae426d415b92514179e56404b4b331ab5f6783d044e3d42b4d3ef6027b80` |
| `mu-plugins/missionmed-matrix-account-entry.php` | replaced | `9bf94300ce6a42325cfa65317a44da15c0018ad25ad295016b630e428578626a` |
| `mu-plugins/missionmed-matrix-footer-cleanup.php` | **NEW** | `25380ad4765fe9b3c9112625fb96f64243b56cb931684f86d11e0462fe78e45a` |
| `mu-plugins/missionmed-matrix-runtime-pin.php` | **NEW** | `f3c2d7e0c409c94d85e638382c0d2a439bb12138e66e43249c6f6ee6ca5b4988` |
| WPCode snippet post 6023 | label only | see §7 |

**No runtime-locked file was modified.** `class-mmed-student-os.php` is byte-identical to
its pre-deployment state (`80d510b4bb5531b7…`).

### Production hashes, before and after

| Asset | Before | After |
|---|---|---|
| enqueued Matrix runtime | `0b112c74e770e3b8…` (`student-os.16ca42c53ca2e890.js`) | `809093d2b5b2bc05…` (`student-os.809093d2b5b2bc05.js`) |
| `student-os.css` | `111942c48eb8fd5d…` | `707ab52f7157db61…` |
| `class-mmed-student-os.php` | `80d510b4bb5531b7…` | `80d510b4bb5531b7…` (unchanged) |

Every hash was verified twice: at origin over SSH, and again through a cache-busted public
URL. Both channels agreed.

---

## 4. DEPLOYMENT METHOD

The established Matrix asset path: `scp` to the Kinsta plugin/mu-plugin directories, then
origin and public SHA256 verification. No new mechanism was introduced.

**The immutable-filename contract was honoured, not compounded.** The new runtime ships
under a filename derived from its own content hash, and nothing was overwritten in place.

That created one obstacle worth recording. The runtime filename is hard-coded in
`class-mmed-student-os.php`, which is a runtime-locked asset, and this ticket's override
covers `student_os_js` and `student_os_css` only. Decision 8 said not to block on that
override, but it did not grant one. Rather than either overwriting an immutable asset in
place or editing a locked file without authority, the enqueue is repointed from a new
mu-plugin, `missionmed-matrix-runtime-pin.php`, which filters `script_loader_src` for the
`mmed-student-os-js` handle.

- `wp_localize_script()` binds to the handle, not the URL, so localization, dependencies
  and footer placement are untouched.
- It **fails safe**: if the pinned asset is missing, the previous runtime is served. A
  partial upload degrades to the last working Matrix rather than a blank screen.
- Verified live on production: the target handle is rewritten, other handles are not.
- **Rollback is deleting one file.**

`broad_cache_purge_allowed: false` was respected. No cache was purged. The JS busts by
filename; the CSS busts automatically because it is enqueued with `filemtime()`.

---

## 5. RUNTIME MANIFEST BASELINE

Re-baselined twice, under the decision-10 authorization, scoped to Matrix runtime assets
only. A `rebaseline_history` entry records each change with its authorization, and an
untouched copy of the original is preserved at
`_TICKETS/MX-LOGIN-UX-008C/baselines/prod_untouched/MATRIX_RUNTIME_LOCK_MANIFEST.before.json`.

**Pre-deploy — corrected the record to match reality**, so that deploying could not revert
the Aug 16–17 work:

| Asset | Was | Now |
|---|---|---|
| `student_os_js` | `c1d97237eab4936d…` (stale, 2026-07-15) | `0b112c74e770e3b8…` |
| `class_mmed_student_os_php` | `5ed6e92eb9bf748a…` (stale) | `80d510b4bb5531b7…` |
| `student_os_css` | `111942c48eb8fd5d…` | unchanged — already correct |

**Post-deploy — recorded what shipped:**

| Asset | Approved | Rollback target |
|---|---|---|
| `student_os_js` | `809093d2b5b2bc05…` | `0b112c74e770e3b8…` (`student-os.16ca42c53ca2e890.js`) |
| `student_os_css` | `707ab52f7157db61…` | `111942c48eb8fd5d…` |

A `filename_integrity_warning` is now recorded against the two legacy assets whose hashed
filenames no longer describe their contents. **Those two files were overwritten in place by
an earlier deploy and their names still lie.** They were left alone — renaming them was out
of scope — but nothing should ever again trust a hashed filename as a content assertion for
`student-os.c1d97237eab4936d.js` or `student-os.16ca42c53ca2e890.js`.

---

## 6. FINAL STATE AGAINST FOUNDER DECISIONS

| Decision | Shipped state |
|---|---|
| **File Vault** | **VISIBLE + UNLOCKED**, position 9, MATCH TOOLS. Internals untouched. |
| **CAM** | **HIDDEN FROM STUDENT NAV.** Route, permission gate, `safeCamLaunchUrl()`, view, data and history all preserved. Nothing deleted or repurposed. |
| **IV Prep On-Call** | **VISIBLE + LOCKED**, position 11, independent of CAM. Production implementation preserved. |
| **Dr J Live Drills** | **VISIBLE + LOCKED**, position 13, `course_id: null`. No invented ID. |
| **Timeline Builder** | **VISIBLE + UNLOCKED**, position 7, honest "being connected" state. |
| **Matrix card artwork** | Real Matrix application screenshot. Preserved. |
| **Astra footer** | Matrix-scoped suppression only. No site-wide cleanup. |
| **PHP registry** | Not required; JS implementation shipped. No locked file modified. No security weakened. |
| **Live QA** | Did not block. Deployed with rollback prepared; everything automatable was run. |
| **Runtime manifest** | Re-baselined to verified production. Aug 16–17 functionality preserved. |

Shipped sidebar, read back from the live runtime:

```
UNLOCKED  1 Dashboard Home  2 My Profile  3 Calendar  4 Scheduler  5 My Appointments
          6 StoryForge      7 Timeline Builder  8 Arena  9 File Vault
LOCKED   10 LOR Writer     11 IV Prep On-Call  12 Med Messenger
         13 Dr J Live Drills  14 Settings
HIDDEN    cam, courses, orders, notifications, help, study, ranklist, interview-prep
```

**Security was not weakened, and this is measured rather than asserted.** Rendering the
sidebar for a non-enrolled student collapses the unlocked set to `["dashboard","arena"]` —
exactly the server's own `free_modules`. Real server-supplied enrollment still governs
every route.

---

## 7. WPCODE SNIPPET 6023 — AND A DEFECT CAUGHT MID-DEPLOY

**Intended change:** label only, in `MM-HD-1702 Global Header L5 Concierge Dock`.

```
- '<a href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members">Members &rarr;</a>'+
+ '<a href="https://missionmedinstitute.com/member-dashboard/" class="mm-l5__members">My Matrix &rarr;</a>'+
```

`href`, class, position and authentication behaviour are unchanged.

**What went wrong, and how it was caught.** The first update passed the content straight to
`wp_update_post()`, which runs `wp_unslash()` on its input. That silently stripped a
backslash elsewhere in the snippet:

```
before:  location.pathname.replace(/\/+$/,'/')
after:   location.pathname.replace(//+$/,'/')     <-- `//` opens a JS comment
```

That is a JavaScript syntax error, and this snippet renders the **entire global site
header**. It would have taken out the header across the whole site.

It was caught by diffing the post content against the backup rather than trusting the
update's own success report — the byte count moved by +1 when the label change alone should
have moved it by +2, which is what prompted the diff. Repaired within the same deployment
window by restoring the escape and passing the content through `wp_slash()`.

**Verified final state:** the snippet now differs from the pre-deploy backup by exactly one
line, the label. The regex is intact, the header renders live, and site navigation works.

**Propagation note.** The label is correct at source but the public HTML is page-cached
(`s-maxage=86400`) and the header markup is inlined into that cached HTML. Since
`broad_cache_purge_allowed: false` and no targeted purge exists via WP-CLI, **no cache was
purged**. The new label will appear as the page cache expires, within 24 hours. Brian can
force it instantly from the Kinsta dashboard if he wants it sooner. This affects the label
only — the Matrix page is logged-in and bypasses page cache entirely, so all Matrix changes
are live now.

---

## 8. PRODUCTION SMOKE TEST — 24 CHECKS

| # | Check | Result |
|---|---|---|
| 1 | Site loads | **PASS** 200, 0.13s |
| 2 | Homepage header renders | **PASS** — header mounts, JS snippet executes (regex repair confirmed) |
| 3 | `My Matrix` appears | **PENDING CACHE** — correct at source; page cache TTL, §7 |
| 4 | Header routing intact | **PASS** — Home / ExamPrep / Mission Residency / USCE / Arena all present; members href unchanged |
| 5 | `/my-account/` loads | **PASS** 200 |
| 6 | Matrix entry CTA | **PASS** at source — destination byte-identical to the prior working link; visual confirm needs login |
| 7 | Matrix loads | **PASS** — 302 to login when logged out, as designed; runtime serves correctly |
| 8 | No obvious JS errors | **PASS** — no console errors; no PHP fatals in the error log |
| 9 | Approved sidebar order | **PASS** — verified in the shipped runtime |
| 10 | File Vault visible + unlocked | **PASS** |
| 11 | CAM absent | **PASS** |
| 12 | Timeline Builder visible + unlocked | **PASS** |
| 13 | Arena visible + unlocked | **PASS** |
| 14 | IV Prep On-Call visible + locked | **PASS** |
| 15 | Dr J Live Drills visible + locked | **PASS** |
| 16 | Welcome Home chooser | **PASS** in shipped runtime; live render needs login |
| 17 | Matrix card uses Matrix screenshot | **PASS** — asset serves 200, 130,678 bytes |
| 18 | Season Priority renders | **PASS** |
| 19 | MyERAS/LOR/PS current for August | **PASS** — all 365 days verified; Jul–Sep resolve to stage 2 |
| 20 | Dashboard filler row gone | **PASS** |
| 21 | Redundant Arena promo gone | **PASS** — verified for enrolled and non-enrolled |
| 22 | Matrix bottom clean of Astra demo footer | **PASS — verified on production.** Real main query against page 4243: Matrix detected YES, footer widgets rendered **0**, `sidebar-1` untouched (3), stored widget data intact |
| 23 | Direct routes function | **PASS** for shipped routes; full App Mode confirmation needs login |
| 24 | No mobile/responsive breakage | **PASS** — verified at 1920, 1440, 1280, 1024, 390 |

Public regression sweep, all 200: `/`, `/examprep/`, `/mission-residency/`, `/usce/`,
`/homepage-arena/`, `/my-account/`, `/arena`. `/member-dashboard/` 302 to login as expected.
Legitimate global footer still renders on non-Matrix pages.

---

## 9. ACCEPTANCE — 68 PASS / 0 FAIL / 6 BLOCKED / 1 N/A

| Section | PASS | BLOCKED | N/A |
|---|---|---|---|
| 15.1 Homepage navigation | 1 | 1 (AC-01, cache) | — |
| 15.2 `/my-account/` | 6 | 1 (AC-08) | — |
| 15.3 Welcome Home | 13 | — | — |
| 15.4 Sidebar | 14 | 1 (AC-37) | — |
| 15.5 Dashboard | 7 | — | — |
| 15.6 Season Priority | 10 | — | — |
| 15.7 Arena locations | 5 | — | — |
| 15.8 Dr J Live Drills | 4 | — | — |
| 15.9 Bottom-page artifact | 3 | — | — |
| 15.10 Scroll and viewport | 4 | — | — |
| 15.11 Regression and hygiene | 1 | 3 (AC-71/72/73) | 1 (AC-75) |
| **Total** | **68** | **6** | **1** |

**AC-75 is N/A**, not failed: it required starting from `c1d97237…`, which decision 10
explicitly overrode because that hash is stale and building on it would have reverted
production.

**Correction to the 008C report:** it stated "56 PASS / 18 BLOCKED", which does not sum to
75 — the section tables in that report actually contained 9 BLOCKED, so the correct figure
then was 65 PASS / 9 BLOCKED / 1 N/A. The counts in this report are recomputed from the
tables.

Regression suite: **28/28**, including five new assertions covering the 008F decisions and
full 365-day season coverage.

---

## 10. ROLLBACK PACKAGE

**Location:** `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/MX-LOGIN-UX-008F/20260820T182018Z`

```
assets/student-os.16ca42c53ca2e890.js   previous runtime  (0b112c74…)
assets/student-os.css                   previous CSS      (111942c4…)
class-mmed-student-os.php               untouched, for reference
mu-plugins/missionmed-matrix-account-entry.php  previous front door
db/wpcode-6023.before.txt               snippet, pre-change
SHA256SUMS.txt
```

| To revert | Action |
|---|---|
| **Everything, fastest** | `rm mu-plugins/missionmed-matrix-runtime-pin.php` — Matrix instantly returns to `student-os.16ca42c53ca2e890.js` |
| Front door | restore `missionmed-matrix-account-entry.php` from backup |
| Footer fix | `rm mu-plugins/missionmed-matrix-footer-cleanup.php` |
| Matrix CSS | restore `student-os.css` from backup |
| Header label | restore `db/wpcode-6023.before.txt` — **must pass through `wp_slash()`**, see §7 |
| Repo | `git revert` on `mx-login-ux-008c-production`; branch is unmerged |

No deployed file overwrote an immutable asset, so every rollback is additive-safe.

---

## 11. WHAT WAS NOT DONE

- No site-wide Astra cleanup. The demo footer content (lorem ipsum, a placeholder Brooklyn
  address, `+1 (718) 555 55 55`, `mail@mail.com`) is still live on non-Matrix pages. Per
  decision 7 this is a separate future ticket.
- No cache purge.
- No runtime-locked file modified.
- No Arena gameplay, CAM internals, or unrelated worktree touched.
- Timeline Builder still has no product integration behind it.

---

## 12. REMAINING MANUAL CHECKS — 6 ITEMS, ~5 MINUTES

All six need a real authenticated 360 student session. Nothing here repeats a test already
automated.

Log in as a 360 student, then:

1. **AC-71 — console clean.** Open Dashboard Home with devtools open. Click through
   Calendar, Scheduler, StoryForge, Arena, File Vault. Any red console errors?
2. **AC-37 / AC-73 — App Mode intact.** Open Calendar, then Scheduler, then File Vault.
   Each should open its own full App Mode with a working *Return to Matrix Dashboard*, not
   an embedded dashboard panel.
3. **AC-72 — apps still launch.** Confirm StoryForge and Arena both launch normally.
4. **AC-08 — WooCommerce intact.** On `/my-account/`: open Orders, open Account details,
   then Log out. All three should work.
5. **File Vault beta access.** Confirm File Vault opens for a real student — this is the
   decision-1 change and the one most worth eyeballing.
6. **AC-01 — header label.** Within 24 hours, confirm the public header reads
   **My Matrix**. If you want it immediately, clear the cache from the Kinsta dashboard.

Worth a glance while you are in there, though already verified automatically: the Welcome
Home chooser with your real first name, and the bottom of a Matrix page being free of the
lorem-ipsum footer.

---

**RESULT: COMPLETE** · **PRODUCTION DEPLOYED: YES** · **ROLLBACK READY: YES**
