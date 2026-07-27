# VITRUVIUS — Accessibility, Responsiveness, and Semantic Quality

Recorded: 2026-07-27

Status: **PROVISIONAL — FINAL REVIEW DEFERRED UNTIL THE SUPERVISOR DECLARES THE VISUAL REPAIR STABLE**

This is a read-only checkpoint and final-review checklist, not a release verdict. Darwin was actively repairing the StoryForge visual and responsive layer during this review. No browser, integration, E2E, or production test was run concurrently. No implementation, provider, production, Git, or remote state was changed by Vitruvius.

## Authority reviewed

- B1-502M MegaRun prompt.
- Repository `AGENTS.md`.
- B1-502 complete combined handoff.
- B1-501 complete combined handoff.
- B1-500 execution prompt and complete combined engineering handoff.
- Sole canonical product artifact:
  `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
- Canonical SHA-256 reverified:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

The binding accessibility bar is WCAG 2.1 AA for the core founder-visible flows. The engineering authority explicitly requires keyboard operability, focus trapping and return-focus for any modal/drawer, labelled controls, meaningful reduced-motion still frames for all six environments, non-color cues, an accessible audio control, and responsive behavior through the compact bottom-navigation layout. The MegaRun additionally requires persistent, functional Back to Matrix access on desktop and mobile.

## Provisional source snapshot

Snapshot hashes observed while Darwin was still working:

- `public/index.html`: `70f93b64ac7131f16ad6c76ce33c8a628b6e79c09a00e24853c109c916b612c6`
- `public/styles.css`: `6c4c7db3b9f3ce781487ee136643fc404f6a04ed40e95e8a191df473263e0ee7`
- `public/app.js`: `5fac0b75a8b03b2c6cc62ce2047dbcc63ac6528e66d23bcba1a78e47ee050399`
- `public/auth.js`: `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`

The snapshot is intentionally not treated as a candidate because the visual repair was incomplete. In particular, `app.js` already contained the six environment choices, Settings, three Back-to-Matrix placements, and actionable startup recovery, while `styles.css` still contained the superseded light parchment layer and had no styles for the new environment/settings classes.

## Positive foundations to preserve

- Document language, viewport metadata, a working skip-link target, semantic `main`, `nav`, `aside`, headings, real buttons/links, and a global visible focus treatment are present.
- Toast output has `role="status"` and `aria-live="polite"`.
- Text capture inputs have explicit labels and native validation.
- Score controls have group and button names plus `aria-pressed`.
- Statuses include visible text, so color is not their only cue.
- The in-progress repair adds Settings to every signed role and real Back-to-Matrix links in the desktop rail, compact header, and Settings.
- Environment choices are native buttons with `aria-pressed`, and preference storage is routed through the authenticated API rather than local storage.
- Startup failure now has plain-language copy, Retry, and Back to Matrix instead of exposing `Failed to fetch`.
- Bounded authentication fetches prevent a permanent opening state.

## Provisional issues for the stable-candidate review

These findings apply to the in-progress snapshot and must be rechecked after Darwin finishes.

1. **Tablet navigation can lose its accessible names.** At `max-width: 950px`, `.nav-label` is set to `display:none`, while `navButton()` supplies no independent `aria-label` and marks the remaining icon `aria-hidden`. At widths where the rail remains visible but compact, the resulting buttons can have no accessible name. Final code must preserve a programmatic name at every breakpoint.

2. **SPA navigation has no explicit focus handoff or view announcement.** `shell()` replaces the application DOM and `navigate()` renders the new route, but neither moves focus to the new `h1`/main landmark nor announces the route title. Keyboard and screen-reader users can be left at `body` after the initiating control disappears. Back/forward rendering has the same risk.

3. **Several selected states are visual-only.**
   - Write/Record uses only an `active` class.
   - Library filters do not expose the selected filter.
   - Review Queue buckets do not expose the selected bucket.
   These require a coherent button-group, tabs, or radio pattern with programmatic state; do not add ARIA that conflicts with native behavior.

4. **Loading and lockout transitions need announcement/focus proof.** The boot view, startup failure, and session/eligibility lockout replace the page dynamically but do not yet use a focused heading, alert/status region, or other deterministic announcement. The permanent toast live region does not announce those full-view changes.

5. **Preference selection currently rerenders the full Settings page.** After a background button succeeds, `renderSettings()` replaces the focused button. The final implementation should retain or deliberately restore focus to the selected environment and make the saved state perceivable without forcing keyboard users back to the start.

6. **Dark-token contrast and reduced-motion behavior are not yet testable from this snapshot.** The stable build must be tested after the real dark CSS/environment engine lands. Disabling transitions alone is insufficient evidence that every animated environment becomes a visually meaningful still frame.

7. **Compact-layout collision risk remains unverified.** The final student bar has five routes and the mentor bar has six. Long labels, safe-area padding, Back to Matrix, Quick Capture, and 200%/400% zoom must be checked together so controls do not overlap, clip, or cover the last page content.

## Stable-candidate release checklist

### A. Semantics and screen-reader structure

- [ ] Exactly one useful page `h1` per route; heading levels do not skip merely for styling.
- [ ] Main content, primary navigation, complementary content, and forms have clear landmarks/names.
- [ ] Desktop, compact-rail, and bottom-nav controls retain nonempty accessible names.
- [ ] Current route is exposed with `aria-current="page"` only on the active destination.
- [ ] Decorative icons, ambient layers, and previews are hidden from assistive technology.
- [ ] Status, score, notification-read state, and environment selection never depend on color alone.
- [ ] Disabled audio, mentor review, AI, and other gated controls have an associated explanation.
- [ ] Every form input, checkbox, select, and score control has a deterministic label and any needed description/error association.
- [ ] Dynamic loading, startup failure, session end, eligibility revocation, save success/failure, and preference-save failure are announced without duplicative chatter.

### B. Keyboard and focus

- [ ] Skip link is first meaningful focus target and moves focus/reading position to main content.
- [ ] A complete Tab/Shift+Tab pass reaches every operable control in visual order with a visible indicator.
- [ ] Activating a route moves focus to the new view heading or main landmark; browser Back/Forward does the same.
- [ ] Write/Record, filters, queue buckets, score controls, and environments expose selected state and support their documented keyboard pattern.
- [ ] Background selection preserves/restores focus to the selected card after the server response.
- [ ] Enter and Space activate every button-like control; no clickable non-interactive element remains.
- [ ] If the stable founder scope includes a modal, drawer, palette, or dialog: it has a labelled dialog role, initial focus, Tab/Shift+Tab containment, Escape close, background inertness, and return-focus to the opener.
- [ ] No global shortcut fires while the user is typing, and shortcuts do not replace discoverable navigation.
- [ ] No keyboard trap exists in horizontal queue controls, story editing, or the compact navigation.

### C. Responsive and reflow matrix

- [ ] Validate at `1440×900`, `1280×800`, `1024×768`, `861×900`, `860×900`, `768×1024`, `681×900`, `680×900`, `390×844`, `360×800`, and `320×568`.
- [ ] Validate the exact breakpoint edges used by final CSS, not only one desktop and one phone size.
- [ ] Validate both student and mentor route sets; the six-item mentor compact navigation is the denser case.
- [ ] No horizontal page scroll at 320 CSS px or 400% zoom; intentional local scrollers are labelled and keyboard usable.
- [ ] Bottom navigation and safe-area inset do not cover page actions, toast text, or the final content row.
- [ ] Topbar, Back to Matrix, identity badge, and Quick Capture do not collide or push controls offscreen.
- [ ] Story rows, status text, timestamps, filters, score controls, settings rows, and error actions reflow without truncating essential meaning.
- [ ] Touch targets are comfortably operable and do not overlap at phone widths.

### D. Persistent Matrix ownership

- [ ] Back to Matrix is visible and keyboard reachable on desktop, tablet, and phone without requiring an unavailable route.
- [ ] Settings always includes Back to Matrix for every enabled signed role.
- [ ] The compact header/escape action remains visible when the desktop rail footer is hidden.
- [ ] All placements resolve to the configured same-origin Matrix URL and preserve the WordPress session.
- [ ] Feature-off, ineligible, revoked, startup-failure, and session-ended screens each retain a working Back-to-Matrix action.

### E. Reduced motion and environment safety

- [ ] Test `prefers-reduced-motion: reduce` before load on all six environments.
- [ ] Emberlight, Aurora, Night Constellation, Deep Tide, and Meridian retain a recognizable still-frame identity with all nonessential animation stopped.
- [ ] Static Dark never animates, regardless of system preference.
- [ ] No canvas loop, particle loop, keyframe animation, smooth scroll, pulsing glow, or large transform continues under reduced motion.
- [ ] Environment transitions do not flash, cause layout movement, or steal focus.
- [ ] Motion preference and the selected server-backed background remain correct after reload and role/session refresh.

### F. Contrast, zoom, and visual focus

- [ ] Run axe with color contrast enabled on Home, Library, Capture, Story Workspace, Notifications, Interview Prep, Settings, startup failure, lockout, Mentor Home, Students, Queue, and Activity.
- [ ] Treat all axe violations as findings; separately justify any non-release-blocking impact rather than limiting the run to serious/critical.
- [ ] Manually check dark-token text, muted text, placeholders, status chips, disabled controls, focus rings, links, borders needed to identify controls, and text over every environment.
- [ ] Focus indicators meet 3:1 adjacent contrast and remain visible over all six environments.
- [ ] Validate browser text zoom to 200% and page zoom/reflow to 400% without loss of controls or content.

### G. Production founder journey

- [ ] Repeat the stable local keyboard/responsive checks against the real founder-only Matrix launch.
- [ ] Verify no second login, initial focus/announcement, bounded loading, deep-link refresh, logout/revocation, and Back to Matrix with the authenticated founder session.
- [ ] Verify ineligible direct access exposes no StoryForge content and presents an announced, actionable denial.
- [ ] Confirm no unrelated WordPress/Matrix page inherits StoryForge focus, overflow, typography, or responsive styles.

## Evidence required for final Vitruvius verdict

- Final source/build hashes.
- Axe result summary for all core founder-visible routes and all observed violations, not just serious/critical.
- Keyboard/focus trace for at least Home → Capture → Story → Library → Settings → Back to Matrix plus the lockout/retry path.
- Desktop, tablet, and phone screenshots for student founder flow; compact mentor navigation proof if mentor UI remains shipped but disabled.
- Reduced-motion screenshots or computed-animation evidence for all six environments.
- Exact Back-to-Matrix `href` and visibility proof at desktop, tablet, and phone widths.
- Production founder journey evidence, or an explicit production-pending status if the one unavoidable authentication action remains.

Final Vitruvius disposition remains **PROVISIONAL** until the Supervisor signals a stable candidate and requests the evidence-backed rerun.

---

# Final stable-candidate review

Recorded: `2026-07-27T18:17:20Z`

Verdict: **NO-GO — THREE BOUNDED LOCAL SEMANTIC DEFECTS; ALL OTHER REQUESTED ACCESSIBILITY AND RESPONSIVE GATES PASS**

This final review was performed after the Supervisor declared Darwin's visual repair stable. The review used the final source/build, the recorded B1-502M `7/7` browser result, the visual-reconciliation screenshots, static inspection, and focused Chrome checks against a new disposable local signed-fixture database/application on unused ports `55450`/`4190`. It did not run the WordPress integration harness, inspect a production session, contact production, or modify implementation/source/provider/remote state. The only application data written was an environment preference and one disposable story inside the temporary local review database; the database is destroyed with the local fixture.

## Candidate identity

- `dist/index.html`
  - SHA-256 `1ac23a36a4f6e55914918d48945ef8a323ab6fc5e182af140321a4dcbd930f0b`
- `dist/assets/app.51e3263110e8.js`
  - SHA-256 `51e3263110e82f2962227763514e93d62112ab40ad28d5a5fc1403ff391cedd6`
- `dist/assets/auth.960289f115f2.js`
  - SHA-256 `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`
- `dist/assets/styles.736a5a89e690.css`
  - SHA-256 `736a5a89e690f52e5a99711131de4de6b4540e34bee452099043f7471542990f`

## Release blockers

### 1. P1 — Skip link is intercepted as a legacy route

The document skip link is `href="#main"`, but `parseRoute()` treats every hash as a legacy StoryForge route. Direct keyboard activation from Mentor Students:

- visibly exposed and focused the skip link;
- activated it with Enter;
- changed the current view from `/students` to `/`;
- focused the Mentor Home `h1`, `Coach the story, not the student’s voice.`;
- cleared the intended skip fragment.

The user therefore loses the current route instead of merely bypassing repeated navigation.

Smallest repair: exclude the skip fragment from legacy routing or handle it before `popstate` route parsing, retain the current route, then focus `main` or its primary heading. Add a regression that activates the skip link from a non-Home route and asserts the pathname/view does not change.

### 2. P1 — Failure and lockout pages use invalid alert/landmark semantics

`renderStartupFailure()` and `renderLockout()` render:

```html
<main id="main" role="alert">
```

Putting `role="alert"` on `main` overrides the main landmark. A full axe scan of the rendered startup-failure path reports:

- `landmark-one-main` — **moderate**;
- `aria-allowed-role` — **minor**.

The failure heading is correctly focused, the raw `Failed to fetch` text is absent, Retry exists, and Back to Matrix is correct. Preserve those behaviors.

Smallest repair: keep the outer element as an unmodified `main` landmark and move `role="alert"` to an inner failure/lockout message container. Retest both startup failure and a lockout presentation.

### 3. P1 — Founder-visible Interview Prep skips heading levels

The Interview Prep route has a page `h1` followed directly by question-card `h3` elements before any `h2`. Full axe reports:

- `heading-order` — **moderate**;
- first affected node: the first `.question-card > h3`.

Mentor Students has the same `h1 → h3` skip on student cards. The founder launch is student-only, so Interview Prep is the release-relevant occurrence.

Smallest repair: give the question grid a real `h2` section heading or use the correct heading level for the cards. Correct Mentor Students in the same bounded edit.

## Requested gate results

| Gate | Result | Evidence |
|---|---|---|
| Accessible navigation names | **PASS** | Every desktop/tablet/mobile destination has an explicit `aria-label`. At 900 px, visible labels collapse but names remain Home, Story Library, Interview Prep, Notifications, and Settings. |
| Route focus handoff | **PASS** | Desktop route actions, browser fixture bootstrap, and mobile reload focus the new primary `h1`. Popstate source also performs the handoff. |
| Loading announcement | **PASS** | Boot view uses `role="status"` and `aria-live="polite"`. |
| Failure/lockout announcement | **FAIL** | Heading focus and alert intent work, but `role="alert"` invalidly replaces the main landmark as described above. |
| Write/Record selected state | **PASS** | Both buttons expose `aria-pressed`; Record retains focus after its rerender. |
| Library filter selected state | **PASS** | Filter buttons expose and update `aria-pressed`; focus remains on the selected filter. |
| Review Queue bucket state | **PASS** | Buckets expose `aria-pressed`; after async rerender, Approved was `true`, All was `false`, heading was `Approved`, and focus returned to the Approved button. |
| Score control names/state | **PASS** | Five buttons expose deterministic names such as `Self score 4 of 5` and exact `aria-pressed` state. |
| Background focus restoration | **PASS** | Each of six environment buttons became `aria-pressed="true"` and retained focus after its authenticated API update and Settings rerender. |
| 320 px mentor compact nav | **PASS** | Six named controls fit without overlap; each measured about `51.3 × 50` CSS px, the nav fit exactly within 320 px, and document width remained 320 px. Screenshot visually confirms readable wrapped labels. |
| Reduced motion | **PASS** | With reduced motion set before load, all six environments reported pseudo-element animation `none`; the five ambient environments retained five distinct still backgrounds and Static Dark remained nonanimated. |
| Color contrast | **PASS** | Full axe scans found no `color-contrast` violations. Solid-token ratios include dim/card `5.13:1`, body text/card `15.15:1`, cyan/card `10.25:1`, amber/card `9.86:1`, and red/card `5.66:1`. |
| Full axe | **FAIL** | All scanned routes were clean except the three bounded semantic cases above. |
| Back to Matrix — desktop | **PASS** | Desktop rail link visible; exact local target ended in `/member-dashboard/`. |
| Back to Matrix — tablet | **PASS** | At 900 px the compact header link is visible while the rail footer is hidden; no horizontal overflow. |
| Back to Matrix — mobile | **PASS** | Visible in the 390 px student and 320 px mentor headers and again in Settings; exact target ended in `/member-dashboard/`. |
| Responsive visual receipts | **PASS** | Student 390 px, mentor 320 px, Settings tablet, Settings desktop, student desktop, and approved workspace images were inspected. No clipped essential control or page-level horizontal overflow was found. |
| Skip-link behavior | **FAIL** | Link is visible/focusable but changes a non-Home view to Home through legacy hash routing. |
| Production founder journey | **PENDING** | No production contact was made. This remains part of the authenticated founder Matrix validation. |

## Axe route matrix

No violations:

- local signed-fixture entry;
- Student Home;
- Student Library;
- Student Capture with truthful audio gate;
- Student Notifications;
- Student Settings;
- disposable Student Story Workspace;
- Mentor Home;
- Mentor Review Queue;
- Mentor Activity;
- Mentor Settings.

Findings:

- Student Interview Prep: `heading-order` moderate, one node;
- Mentor Interview Prep: `heading-order` moderate, one node;
- Mentor Students: `heading-order` moderate, one node;
- startup failure: `landmark-one-main` moderate and `aria-allowed-role` minor.

No color-contrast violation appeared on any scanned surface.

## Screenshot review

Inspected under:

`_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/visual-reconciliation/`

- `storyforge-v5-student-home.png`;
- `storyforge-v5-student-mobile.png`;
- `storyforge-v5-settings-desktop.png`;
- `storyforge-v5-settings-tablet.png`;
- `storyforge-v5-mentor-mobile-320.png`;
- `storyforge-v5-approved-workspace.png`.

The 320 px mentor screenshot confirms the six-item compact navigation is readable and nonoverlapping. The tablet Settings screenshot confirms accessible escape placement, the six distinct environments, and usable two-column reflow. The student phone screenshot confirms Back to Matrix, Quick Capture, five-item bottom navigation, and unobscured primary content.

## Final disposition

The dark visual repair, responsive shell, persistent Matrix ownership, selected-state semantics, focus handoffs, environment persistence, reduced-motion behavior, and contrast are locally acceptable.

Vitruvius cannot issue a clean accessibility PASS while the skip link changes routes, the error/lockout surface loses the main landmark, and founder-visible Interview Prep has an invalid heading sequence. All three are small, bounded source corrections. After they are repaired, rerun only:

1. the focused skip-link regression from a non-Home route;
2. full axe on startup failure and one lockout surface;
3. full axe on Student Interview Prep and Mentor Students;
4. the existing `7/7` browser suite.

If those checks are green and the final asset hashes are refreshed, the expected local verdict is **PASS**. Production founder-session validation remains separate and pending.

# Post-repair final verification

Recorded: `2026-07-27T18:44:12Z`

Verdict: **PASS — LOCAL ACCESSIBILITY, RESPONSIVE, AND ESCAPE-PATH GATES GREEN**

This section supersedes the earlier `NO-GO` for the rebuilt candidate identified below. The three bounded defects were repaired without changing the approved visual hierarchy: the skip link now bypasses navigation without changing routes, failure/lockout live regions sit inside an intact main landmark, and Interview Prep plus Mentor Students use valid heading order with scoped 18 px card-title typography.

## Rebuilt candidate identity

- `dist/index.html`
  - SHA-256 `e01b4565a81b0ca796e485dbda29417adc7e30c7f4dcb55144a4624a1bdcd7b6`
- `dist/assets/app.be5fd3fe4ee9.js`
  - SHA-256 `be5fd3fe4ee9ff840d103dab448010bec5204a01748f83ba2785f839185399fd`
- `dist/assets/auth.960289f115f2.js`
  - SHA-256 `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`
- `dist/assets/styles.0938034a27f6.css`
  - SHA-256 `0938034a27f6a288ae621eb2c222f2d5748bb0d6f880ab58ad08af2a9414fb4e`

## Post-repair evidence

- Existing rebuilt browser suite: **7/7 PASS**, including loaded font assertions, Interview Prep heading order, scoped `18px` question-card density with no overflow, and the non-Home skip-link regression.
- Student Interview Prep:
  - primary `h1` received route focus;
  - full axe scan returned zero violations;
  - all three question cards rendered as `h2` at `18px`;
  - no question-card title overflowed.
- Mentor Students at `320 × 700`:
  - activating the skip link retained `/students` and returned focus to the Students `h1`;
  - full axe scan returned zero violations;
  - six accessible compact-nav controls remained visible, nonoverlapping, and approximately `51.3 × 54` CSS px;
  - document width remained exactly 320 px;
  - Back to Matrix remained visible and ended in `/member-dashboard/`.
- Startup failure:
  - full axe scan returned zero violations;
  - exactly one unmodified `main` landmark remained;
  - the inner message used `role="alert"`;
  - the bounded failure `h1` received focus;
  - Retry and Back to Matrix remained available;
  - raw `Failed to fetch` text was absent.
- Eligibility-revoked lockout, exercised with a local intercepted bootstrap response:
  - full axe scan returned zero violations;
  - exactly one unmodified `main` landmark remained;
  - the inner message used `role="alert"`;
  - `Your 360 access has changed.` received focus;
  - Back to Matrix remained correct.
- Loading:
  - the outer `main` retained its landmark semantics;
  - an inner `div` exposed `role="status"` and `aria-live="polite"`.
- Background environments under reduced motion:
  - all six controls became `aria-pressed="true"` when selected;
  - focus was restored to each selected control after its authenticated rerender;
  - every environment reported animation `none`.
- The final `storyforge-v5-interview-prep.png` receipt was visually inspected. The semantic `h2` repair retains compact 18 px card titles, clear card hierarchy, readable wrapping, and no visual crowding.

The final focused checks ran against a disposable local signed-fixture application/database on unused ports `4191`/`55451`. No implementation or source file was edited by Vitruvius, no production endpoint was contacted, and no provider or remote state was changed. Only temporary local background preferences were written.

## Final disposition

All requested local accessibility and responsive gates now pass for the rebuilt candidate:

- accessible names;
- route focus and live announcements;
- selected states and async focus restoration;
- 320 px mentor compact navigation;
- reduced-motion stills;
- contrast and full axe;
- desktop, tablet, and mobile Back to Matrix paths;
- non-routing skip-link behavior;
- Interview Prep and Mentor Students heading order;
- bounded startup-failure and lockout landmarks.

The final local Vitruvius verdict is **PASS**. The authenticated production founder Matrix journey remains separate, founder-gated, and pending; this review did not contact production.
