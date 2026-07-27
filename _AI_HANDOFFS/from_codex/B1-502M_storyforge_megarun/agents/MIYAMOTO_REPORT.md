# MIYAMOTO — Local UI/UX Release Review

Recorded: `2026-07-27T17:33:27Z`

Verdict: **NO-GO — three local release-blocking UX defects**

Scope: read-only review of the current local B1-502M candidate. No source, Git, provider, or production mutation was performed. Production checks are explicitly separated below.

## Authority and method

- The sole canonical artifact hash was reverified as `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- The canonical lock says executed `storyforge-v5.html` behavior wins over every conflicting document or implementation (`STORYFORGE_V5_CANONICAL_LOCK.md:4-8`).
- Review snapshot: worktree HEAD `e76193176e50fa0f0c329b40017c3e48b94510ef`; current local hashes: `styles.css` `6c4c7db3b9f3ce781487ee136643fc404f6a04ed40e95e8a191df473263e0ee7`, `app.js` `4b40a49e3a827139660b460c9382fd92774a89684c02e150b2dde79311c7d970`, `auth.js` `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`.
- The current app was run against its disposable PostgreSQL/local signed-fixture harness and inspected in headless Google Chrome at `1440×1000` and `390×844`. The canonical HTML was executed in the same browser for direct comparison. The in-app browser was unavailable.

## Local release blockers

### 1. P0 — the candidate is not the approved dark StoryForge V5 interface

Direct browser comparison:

- Canonical execution: dark CAM environment, computed body background `rgb(10, 13, 20)`, Archivo/Rajdhani/Lora language, orange/cyan role accents, ambient canvas/aurora, canonical rail and header.
- Current candidate: light parchment/wine cards, computed foreground `rgb(37, 33, 31)`, Georgia/system typography, no ambient canvas, no environment picker, and materially different navigation/header/product composition.

Source evidence is unambiguous:

- Canonical tokens and environment begin at `storyforge-v5.html:10-34`; its executed Settings explicitly says MissionMed applications default to a dark, subtly living environment at `storyforge-v5.html:2964-2979`.
- Current light tokens and background are in `storyforge-v5/public/styles.css:1-28`.
- The canonical lock requires six dark environments, persisted preference, and reduced-motion still frames (`STORYFORGE_V5_CANONICAL_LOCK.md:62`), while current CSS only disables transitions for reduced motion and has no environment implementation (`styles.css:426-428`).

This is not cosmetic polish. It conflicts with the sole product/UI/UX/visual authority and the MegaRun requirement that the approved dark V5 interface appear. Deployment must not proceed with this frontend.

### 2. P0 — Back to Matrix disappears on tablet and mobile

- Desktop local pass: the rail contains `← Back to Matrix` with the configured local target `http://127.0.0.1:4188/member-dashboard/` (`app.js:119-120`).
- At `≤950px`, current CSS hides the entire `.rail-foot` (`styles.css:370-375`).
- The mobile bar contains only role routes (`app.js:138-140`); current role routes contain no Settings route (`app.js:41-62`).
- Verified at `390×844`: zero Back-to-Matrix links were present or visible.

Canonical mobile intentionally moves this escape path into Settings (`storyforge-v5.html:691-699`, `2989-2998`). The release requirement is “Back to Matrix visible and functional”; the current responsive implementation fails before production.

### 3. P1 — raw bootstrap/config failure is technical and non-actionable

With `/api/config` failed locally, the resolved UI was:

`STORYFORGE UNAVAILABLE / We could not open this workspace. / Failed to fetch`

It exposed no retry, sign-in, or Back-to-Matrix control. That output comes from `app.js:943-961`, which renders the raw exception after configuration fails. This does not meet the requirement for truthful, actionable errors.

Positive control: a simulated `storyforge_disabled` response produced the truthful “StoryForge is not enabled yet” state and a working Back-to-Matrix link (`app.js:869-925`). Preserve that pattern for the pre-config failure state.

## Minimal reconciliation checklist

1. **Tokens and typography**
   - Replace the parchment/wine visual layer with the canonical dark tokens: `#0a0d14`/`#0f1522` base, `#121927`/`#161f31` cards, `#e9eefb` text, amber/orange student accents, and cyan/blue mentor accents.
   - Restore Archivo display text, Rajdhani labels/numerals, and Lora authentic voice text. Keep italics only for quotations, full-story titles, and brand hero headings.

2. **Shell, navigation, and headers**
   - Restore canonical Student rail order: Home, Story Library, Interview Prep, Notifications, Settings, Back to Matrix, with `+ New Story` as the primary action.
   - Restore canonical Mentor rail order: Home, Students, Review Queue, My Activity, Teaching Mode, Settings.
   - Restore the canonical header composition: authorized view chip, student search/mentor jump palette, mentor student selector when applicable, and the top New Story action.
   - Role/view switching may render only from signed server authority; do not copy the prototype’s self-authorizing role toggle.

3. **Ambient environment**
   - Restore Emberlight as the default dark canvas/aurora experience plus Aurora, Night Constellation, Deep Tide, Meridian, and Static Dark.
   - Persist the preference to the authenticated user record, not prototype local storage.
   - Under reduced motion, render a still frame that preserves each environment’s visual identity.

4. **Responsive Matrix ownership**
   - Keep the canonical bottom-bar layout at `≤860px`.
   - Add Settings to mobile and provide a visible, real Back-to-Matrix action there. Verify the exact production target and preserved WordPress session.

5. **Failure recovery**
   - Normalize network/config failures to plain copy.
   - Always provide a real Back-to-Matrix action and retry where safe; never expose raw `Failed to fetch`.
   - Retain the already-good feature-off, ineligible, revoked, and session-ended presentation pattern.

6. **Regression proof**
   - Execute the hash-pinned canonical and reconciled candidate side by side at desktop/mobile and reduced-motion settings.
   - Require visual/product sign-off plus unchanged auth, privacy, assignment, lifecycle, deep-link, and rollback suites before deployment.

## Current real-data scaffolding that can be retained

These current semantics and API bindings can be preserved while their composition and visual layer are reconciled:

- signed-session bootstrap and differentiated lockout state plumbing;
- server-claim-driven role routes (after canonical labels/order/Settings are restored);
- semantic skip link, `aside`/`nav`/`main` shell, and data-bound badge/list containers;
- private text capture form and truthful audio-unavailable gate;
- database-backed library rows and status values;
- story workspace bindings for current telling, immutable original, self/mentor scores, feedback, save, submit, review, and approval;
- server-backed question/workshop/import flows and truthful AI-gated state.

Retention means preserve data contracts, form semantics, and event/API wiring—not the current light styling or reduced page composition. In particular, numeric score inputs may remain operable controls, but canonical read displays must use independent S/M stoplight dots.

## Canonical prototype mechanisms that must not ship

Do not copy the prototype’s:

- seeded users/stories/questions/notifications/activity;
- hard-coded identities;
- client-authoritative role or mentor-access toggles;
- client-only privacy filtering or local-storage state;
- simulated audio/transcription/playback;
- canned AI suggestions;
- toast-only Back-to-Matrix behavior;
- demo clock, fabricated history, or in-memory “nothing was lost” promise;
- Reset demo data control;
- dead overridden script layers.

The current local fixture identity selector may remain dev-only but must be impossible in production.

## Production-pending checks

Not yet verified and cannot be claimed from local evidence:

- launch from the real Matrix location with no second login;
- exact founder identity and founder-only visibility;
- approved dark V5 assets at `https://missionmedinstitute.com/storyforge/`;
- real desktop/mobile Back-to-Matrix navigation with session continuity;
- production loading latency, deep-link refresh, logout/revocation, and feature-off/ineligible states;
- absence of visual regressions in unrelated Matrix/WordPress routes.

MIYAMOTO production verdict remains pending until the three local blockers are repaired and the real Matrix journey is available.

---

# MIYAMOTO — Superseding Final Stable-Candidate Verdict

Recorded: `2026-07-27T18:41:16Z`

Verdict: **GO — LOCAL UI/UX DESIGN AND DOMAIN RELEASE GATE PASSES; PRODUCTION MATRIX JOURNEY PENDING**

This section supersedes the earlier local `NO-GO` for the final candidate
identified below. The earlier review remains as historical evidence of the
defects found and repaired. This verdict is not deployment authority and is not
a claim that the production founder journey has been exercised.

## Authority, candidate, and scope

- Canonical StoryForge V5 authority was reverified at SHA-256
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- Worktree base HEAD remained
  `e76193176e50fa0f0c329b40017c3e48b94510ef`.
- Final public hashes reviewed:
  - `styles.css`:
    `0938034a27f6a288ae621eb2c222f2d5748bb0d6f880ab58ad08af2a9414fb4e`
  - `app.js`:
    `e1072dd3c30fc527249f4e2c70b10aab1d3044613b94839327cd5ee6d31336ce`
  - `auth.js`:
    `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`
- Final built assets reviewed:
  - `dist/index.html`:
    `e01b4565a81b0ca796e485dbda29417adc7e30c7f4dcb55144a4624a1bdcd7b6`
  - `dist/assets/app.be5fd3fe4ee9.js`:
    `be5fd3fe4ee9ff840d103dab448010bec5204a01748f83ba2785f839185399fd`
  - `dist/assets/auth.960289f115f2.js`:
    `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e`
  - `dist/assets/styles.0938034a27f6.css`:
    `0938034a27f6a288ae621eb2c222f2d5748bb0d6f880ab58ad08af2a9414fb4e`
- Miyamoto performed a read-only source/build and visual-evidence review. No
  implementation code was edited, no integration suite was run by Miyamoto,
  and no production/provider/remote system was contacted or mutated. The only
  write is this superseding report section.

## Prior blockers — resolved

### 1. Approved dark StoryForge V5 interface — PASS

- The final desktop, tablet, and mobile receipts show the canonical dark
  StoryForge language: deep navy canvas, layered dark cards, amber student
  accents, cyan mentor accents, restrained ambient light, and the approved
  Archivo/Rajdhani/Lora hierarchy.
- Archivo, Rajdhani, and Lora are now self-hosted through seven explicit
  `@font-face` declarations. The fingerprinted font files and complete OFL
  notices are present in both source and built output; the self-only font CSP
  is compatible with them.
- The six required environments are present and visually differentiated:
  Emberlight, Aurora, Night Constellation, Deep Tide, Meridian, and Static
  Dark. Selection is saved through the authenticated preference API rather
  than client-authoritative local storage.
- Reduced-motion rules remove animation while preserving distinct still
  environments.

### 2. Back to Matrix across breakpoints — PASS

- Desktop retains the rail exit.
- Tablet and mobile expose the compact header exit when the rail footer is
  hidden.
- Settings, startup failure, and lockout surfaces retain an additional Matrix
  exit.
- The reviewed local target resolves to the same-origin Matrix
  `/member-dashboard/` path; production session continuity remains a live gate.

### 3. Actionable startup failure — PASS

- The raw `Failed to fetch` presentation is gone.
- Startup failure now uses plain, truthful language and provides both a real
  `Retry` action and `Back to Matrix`.
- Retry invokes the actual bootstrap flow; it does not fabricate recovery.

## Final composition and responsive review — PASS

- Student hierarchy is clear: signed identity and Matrix ownership, primary
  Quick Capture action, Home, Story Library, Interview Prep, Notifications,
  Settings, and Back to Matrix.
- Mentor hierarchy remains role-specific and server-authorized. Founder-gated
  Teaching Mode is described as unavailable rather than presented as a working
  control.
- The final Interview Prep receipt confirms the semantic heading repair did
  not create a visual regression: question-card headings remain compact at
  `18px`, card density is balanced, and no content or control overflows.
- At `390px` student and `320px` mentor widths, essential controls remain
  readable and reachable. The six mentor compact-nav destinations fit without
  page-level horizontal overflow.
- Settings at desktop and tablet widths retains the full six-environment
  chooser, truthful reduced-motion language, and a visible Matrix exit.

Reviewed visual receipts:

- `storyforge-v5-student-home.png`
- `storyforge-v5-approved-workspace.png`
- `storyforge-v5-settings-desktop.png`
- `storyforge-v5-settings-tablet.png`
- `storyforge-v5-student-mobile.png`
- `storyforge-v5-mentor-mobile-320.png`
- `storyforge-v5-interview-prep.png`

## Truthfulness and domain review — PASS

- Role navigation derives from the signed server session. There is no
  client-side role toggle or separate StoryForge product login.
- With zero eligible mentor assignment, submit-for-review is disabled and the
  interface truthfully says mentor review is not enabled; the private story
  remains editable.
- Audio is disabled when storage/provider readiness is absent. The interface
  says nothing was recorded or uploaded and does not simulate playback,
  transcription, upload, or success.
- AI presentation is explicitly gated. The server returns feature-gated or
  provider-unconfigured errors; there are no canned suggestions or fake AI
  results.
- Local signed fixtures are loopback/dev-only and visibly labeled. Production
  configuration cannot expose the fixture selector on a non-loopback binding.
- No public hard-coded story corpus, client-authoritative privacy filter,
  fabricated history, demo reset, or local-storage product authority was found.

## Verification evidence reviewed

- Scoped `git diff --check` for the final source/build/server/test surfaces:
  **PASS**.
- Supervisor-provided final unit result: **23/23 PASS**.
- Supervisor-provided fresh browser result: **7/7 PASS**, including
  self-hosted-font checks, compact Interview Prep headings, card dimensions,
  heading order, and no horizontal overflow.
- Existing retained reconciliation screenshots and agent evidence were reviewed
  against the final hashes above. Miyamoto did not rerun the WordPress
  integration harness.

## Production-pending checks

The following require the authorized deployed environment and remain outside
this local verdict:

- founder launch from the real Matrix entry point with no second login;
- founder-only production visibility and feature-flag behavior;
- exact approved assets at the production StoryForge URL;
- Back-to-Matrix navigation with real WordPress session continuity;
- feature-off, ineligible, logout/revocation, deep-link refresh, and realistic
  latency behavior;
- absence of regressions in unrelated Matrix/WordPress routes.

## Final disposition

**No unresolved local UI/UX or StoryForge domain release blocker remains in the
hash-identified candidate.** Miyamoto approves the local design/domain gate.
Production sign-off remains pending until the authorized real Matrix journey is
available and independently exercised.
