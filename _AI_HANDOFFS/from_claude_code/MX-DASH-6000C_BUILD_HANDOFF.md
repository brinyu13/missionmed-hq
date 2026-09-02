# MX-DASH-6000C — Matrix Dashboard 2.0 · Build Pass 1 Handoff

STATUS: BUILT ON BRANCH — AWAITING BRIAN REVIEW → then Codex deployment
Branch: `claude/mx-dash-6000c-dashboard-v2-pass1`
Worktree: `/Users/brianb/MissionMed/missionmed_worktrees/MX-DASH-6000C-build`
Base: `codex/mx-cal-4200c-calendar-v2` @ b5eec16 (the deployed Calendar V2 lineage — the only recent branch carrying the full `missionmed-hub` plugin tree plus the experience-preference pattern this build mirrors)
Prepared by: Claude Code · 2026-09-02
Not deployed. No production, provider, auth, or V1 code was touched.

---

## 1. What was implemented

Dashboard 2.0 is a **second renderer for the existing `#dashboard` route**, selected server-side per user. Dashboard V1 (Classic) is byte-identical and remains the fallback.

| Founder requirement | Delivered |
|---|---|
| 1 · Admin-only front-end editing of card + popup copy, CTAs, and background images | Yes — "Edit featured apps" mode (admins only, server-resolved), per-card ✎ Edit, editor modal with every field, WordPress Media Library picker + URL fallback per image, "Reset to MissionMed defaults". Saves via REST with `manage_options` re-checked server-side. |
| 2 · Image bleed | Fixed — see §5 |
| 3 · Stronger art direction | Eight rebuilt cinematic SVG compositions (stars, light rays, perspective floors, vignettes, focal glows), each purpose-specific; no Epic/Fortnite assets. Any card/popup image can be replaced by an admin. |
| 4 · Dark animated background | Dark canvas with two slow CSS aurora drifts, a lightweight constellation canvas (≤64 particles, 30 fps cap, pauses when hidden, off under reduced-motion), and a vignette. V1's faster aurora is dimmed to 25% while 2.0 is showing. |
| Preserve launcher / featured / detail / Student-Admin / Classic-vs-2.0 | Yes. Launcher with deterministic routing, eight featured cards, detail overlay with ←/→ browsing, admin perspective + "Preview as student", Classic ↔ Matrix 2.0 preference, Force Classic. |

Today panel now uses **real Matrix data** (V1's `/user/stats`, `/events`, scheduler `/calendar-feed`, `/messages`, `/todos` via V1's own loaders) with empty and loading states; "Everything else in Matrix" lists the user's real registered modules with functional subtitles.

## 2. Files changed (7 new, 2 edited)

New:
- `wp-content/plugins/missionmed-hub/includes/class-mmed-dashboard-experience.php` — experience resolution, Settings page, REST routes, content store, server-owned defaults, sanitizers
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.js` — renderer (overrides `MMED_OS.render.dashboard`), launcher, detail overlay, admin editor, background
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2-art.js` — eight built-in card/detail art compositions (`window.MMED_DASH_ART`)
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.css` — all 2.0 styles, scoped and specificity-raised above V1's `#student-os-root button` reset
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6000c/experience-resolution.test.php` — 14 pure PHP checks (precedence + sanitizing), no WP bootstrap
- `_AI_HANDOFFS/from_claude_code/MX-DASH-6000C_BUILD_HANDOFF.md` (this file)
- `_AI_HANDOFFS/from_fable/…` — the 6000B prototype package (prototype HTML, rationale, card SVGs) that never landed in the worktree during 6000B

Edited (additive only):
- `wp-content/plugins/missionmed-hub/missionmed-hub.php` — `require_once` + `MMED_Dashboard_Experience::init()` next to the Calendar experience lines (+4)
- `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php` — one call `MMED_Dashboard_Experience::enqueue_assets()` right after `optimize_runtime_v2_member_dashboard_assets()` and before the Runtime v2 early return (+5). Nothing else in V1 changes; `student-os.js`/`.css` untouched.

## 3. How it works

**Experience resolution (mirrors MX-CAL-4200C exactly)** — `MMED_Dashboard_Experience::resolve()`:
`force_classic → (v2 enabled gate) → user meta _mmed_dashboard_experience → option mmed_dashboard_experience_default → classic`.
Options: `mmed_dashboard_v2_enabled` (default **off**, fail-closed: no 2.0 assets load), `mmed_dashboard_experience_default` (classic|matrix2), `mmed_dashboard_force_classic`, `mmed_dashboard_v2_invite` (default on). Settings → **Dashboard Experience** (wp-admin, `manage_options`).
REST `GET/PUT mmed/v1/me/dashboard-experience` — authenticated, self-only. "Use Classic" (2.0 header) and "Try Matrix 2.0" (Classic invite banner) write this and reload.

**Renderer wiring** — `mmed-dashboard-v2.js` is enqueued after `mmed-student-os-js` only when the resolved experience is `matrix2` (or invite mode on Classic). It replaces `app.render.dashboard` before `app.init()` runs — the same override pattern `student-os-calendar-v4.js` uses. V1's `loadDashboardStats()` / `loadDashboardOverview()` are reused unchanged; when they finish they call `app.render.dashboard()` → 2.0 re-renders with live data. Dashboard still hydrates no app modules (passport invariant). Routes other than `#dashboard` are unaffected; on hashchange the background loop stops and overlays close.

**Admin editing** — `mmedDashboardV2.is_admin` comes from `current_user_can('manage_options')` on the server; the client only *shows* controls when it is true. Every write hits `PUT/DELETE mmed/v1/dashboard/featured-apps/{id}` whose `permission_callback` is `current_user_can('manage_options')` (same capability `MMED_REST_API::can_manage` uses), with the `wp_rest` nonce V1 already puts on `#student-os-root`. Unauthorized callers get 401/403 from WordPress regardless of any client state. Payloads are whitelisted, length-capped, and sanitized (`sanitize_text_field`, `esc_url_raw` http/https only, attachment ids `absint`); unknown keys are dropped; `javascript:` launch targets are rejected.

**Persistence model** — one option `mmed_dashboard_featured_apps` (autoload off) holding only admin *overrides* keyed by app id. Defaults live in PHP (`default_apps()`), and `get_apps()` merges defaults + overrides, so a bad or empty override can never blank the student experience. "Reset" deletes that app's override. Images: the WordPress Media Library (`wp_enqueue_media()` is loaded on `/member-dashboard` only for admins with `upload_files`) — attachment id + URL are stored; a pasted https URL also works. The eight app ids are fixed (`APP_IDS`); the set is not editable.

**Perspective** — admins land in "Admin view" (admin subtitles, edit controls, admin bar with a link to Experience settings) and can "Preview as student" (client-side presentation only; nothing about authorization changes, and edit controls hide).

## 4. Animated background

`.mmdv2-bg` (absolute, clipped to the page): layered radial gradients over `#040d19`; two `.mmdv2-aur` blobs with 38s/46s `transform` drifts (GPU-composited); `<canvas class="mmdv2-stars">` constellation (64 points desktop / 28 narrow, DPR capped 1.5, throttled to ~30 fps via rAF timestamp, skips frames when `document.hidden`, stops on route change, static dots under `prefers-reduced-motion`); a vignette keeps text contrast. Cards/panels use opaque dark surfaces; no backdrop-filter on content.

## 5. Image bleed — root causes and fixes

Observed in the 6000B prototype: card/detail imagery escaping or smearing at rounded edges and in the detail panel.
1. **Rounded-corner overflow with transformed children (Safari/WebKit)** — the hover scale was on the SVG inside an `overflow:hidden` + `border-radius` container. Fix: every card and the detail art panel now use `overflow:hidden` **and** `clip-path:inset(0 round 16px)` with `isolation:isolate` + `transform:translateZ(0)`; the hover scale is applied to an inner `.mmdv2-media` layer, never to the clipped box.
2. **Detail panel crop/smear** — the 16:10 art was hard-cropped into a tall column. Fix: two layers — a blurred `cover` backdrop and a contained (`meet`) foreground with a vertical fade mask — so any built-in or uploaded image ratio fills the panel with no cropping of the subject and no hard edge.
3. **SVG gradient/filter id collisions** — identical `<defs>` ids across inline SVGs make browsers paint one card's gradients into another. Fix: every art instance gets a unique id prefix (cards, thumbnails, detail, editor previews).
4. **Blur-filter halos** — blur filter regions are explicitly bounded (`x/y/width/height` on each `<filter>`) and every SVG carries its own vignette inside the viewBox.
5. **Mobile row peeking outside the content area** — the horizontal featured row no longer uses negative margins; it scrolls inside the content column.
6. **Backdrop-filter on the dialog** removed; the overlay uses a plain scrim.

## 6. QA performed

- `php -l` on the new class and edited files (in the build container, PHP 8.4).
- `php tests/mx-dash-6000c/experience-resolution.test.php` → 14/14 PASS.
- `node --check` on both JS files.
- Headless Chromium harness (`playwright`) with the **real `student-os.css`** and a mock of the V1 runtime surface (`MMED_OS.render/loadDashboardStats/loadDashboardOverview/components.navItems/api`, `mmedDashboardV2` payload generated from the PHP defaults):
  - Student (1440×1000): renders, zero page errors; **0** edit controls in DOM; detail opens, ←/→ cycles, Esc closes; search "practice for interviews" → IV Prep On-Call; "What should I work on today?" → contextual list from live data; Today panel populates after the mocked loaders resolve.
  - Admin: edit toggle → 8 ✎ Edit buttons; editor opens with all fields; save issues `PUT /dashboard/featured-apps/rise` with a whitelisted payload; card re-renders with new subtitle and image; "Preview as student" hides all edit controls.
  - Classic + invite: V1 render intact, single invite banner inserted.
  - 390×844: single-column, horizontal card row, sheet-style detail; `scrollWidth === 390` (no horizontal page scroll).
- Not yet run (needs WordPress): live REST round-trip, Media Library modal, Settings page, `matrix_runtime_guard.py preflight`.

## 7. Limitations / remaining risks

- **Branch lineage**: this branch is based on the Calendar V2 branch. The Appointments candidate (`codex/mx-appt-5003g-production`, 3 plugin files) has not been merged into it; if that ships first, rebase this branch (no overlapping files except `missionmed-hub.php` require lines — trivial).
- **Pinned `student-os.*.js`**: `class-mmed-student-os.php` enqueues `student-os.16ca42c53ca2e890.js`, which is not tracked in this branch. Codex must deploy against the live pinned file; this build does not depend on its contents beyond `MMED_OS.render`, `state`, `components.navItems`, `api` (all present in the tracked `student-os.js` @ 814ed385).
- **Featured launch targets**: `#rise`, `#ranklist`, `#lor`, `#ivprep` resolve only if the module is registered for the user; otherwise the card still explains the app and the CTA shows an honest "not available on your account yet" toast. Admin can set a URL per app in the editor if a destination lives outside Matrix.
- **Naming**: the cards say "Scheduler" and "LOR Builder" per the 6000B ticket; V1 nav says "Scheduler"/"LOR Writer" and MX-APPT retired "Scheduler" for students. Both are one-field edits in the front-end editor — no code change needed.
- The admin "Preview as student" is presentation only (by design); the WP admin bar remains visible for admins (lock invariant).
- Google Fonts (Archivo/Rajdhani/Lora) load from fonts.googleapis.com, as V1 already does for Space Grotesk/Poppins.

## 8. Ready for Codex deployment?

**Yes, after Brian reviews the branch** (open the plugin on a staging/preview site or enable for admins first — see step 4). Deployment is additive and reversible in one option flip.

### Codex deployment instructions
1. Preflight: `python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight --worktree /Users/brianb/MissionMed/missionmed_worktrees/MX-DASH-6000C-build --assets all` — must not warn (no locked asset changes; `student-os.js/.css` untouched). Take the Kinsta rollback backup the lock protocol requires.
2. Deploy exactly these files to `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/`:
   `includes/class-mmed-dashboard-experience.php`, `assets/dashboard-v2/mmed-dashboard-v2.js`, `assets/dashboard-v2/mmed-dashboard-v2-art.js`, `assets/dashboard-v2/mmed-dashboard-v2.css`, and the two edited files `missionmed-hub.php`, `includes/class-mmed-student-os.php` (verify SHA256 of each edited file against the branch before and after).
3. Verify nothing changes for anyone yet: `mmed_dashboard_v2_enabled` defaults to off → no 2.0 assets are enqueued, Classic renders as before. Smoke-test `#dashboard`, `#calendar`, `#scheduler`, `#filevault`, `#storyforge`.
4. Enable for admin review: wp-admin → Settings → Dashboard Experience → Enable Matrix 2.0, Default = Classic. Then, as Brian (admin), PUT `mmed/v1/me/dashboard-experience {experience:"matrix2"}` or use the "Try Matrix 2.0" banner on Classic. Review edit mode, Media Library picker, Reset, Use Classic.
5. Go-live for students: set Default = Matrix 2.0 (invite banner stays on for anyone who opted back to Classic). Rollback at any time: tick **Force Classic for every user**, or untick Enable (assets stop loading).
6. Update the Matrix runtime lock manifest with the new files if Brian wants them locked (they are not locked assets today), and write the deployment report per protocol.

---
STATUS: BUILT ON BRANCH — AWAITING BRIAN REVIEW
