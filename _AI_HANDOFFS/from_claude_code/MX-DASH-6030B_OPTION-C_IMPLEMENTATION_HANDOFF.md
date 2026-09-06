# MX-DASH-6030B Option C implementation handoff

Date: 2026-09-05
State: READY FOR FOUNDER VISUAL REVIEW — LOCAL CANDIDATE ONLY
Branch: `codex/mx-dash-6030b-option-c`
Accepted predecessor: `e467f2b714425bfc045931ff8c6c0a37140365a4`
Authority registration: MissionMed OS `735c95b`

## Founder decision implemented

The app-detail reveal now implements the approved Concept C Hybrid Matrix
Showcase. The current MX-DASH-6010B cinematic endpoint is a full-bleed,
dominant surface. The initial view contains the app eyebrow, large app name,
one promise, no more than three benefit chips, one payoff or entitlement line,
one primary action, and a quiet How It Works disclosure.

The disclosure opens an 88 percent-height detail drawer rather than an
enterprise specification panel. Desktop uses the approved 1100 by 640 maximum
composition. Mobile is a true full-screen 390 by 844 composition with the art
occupying the upper 60 percent, a vertical readability gradient, a pinned
action row, and an eight-position rail.

## Preservation proof

- All sixteen Founder-approved pencil/cinematic PNGs are unchanged from the
  accepted predecessor. Their current SHA-256 inventory is
  `MX-DASH-6030B/evidence/art-sha256.json`.
- The 6010B card renderer, WebGL shader, endpoint selection, launcher, search,
  left rail, and Classic switch were not changed.
- The server-resolved `MMED_OS.access.apps` contract remains the sole source
  of allowed, released, and launch URL truth. Locked primary actions do not
  contain a launch target.
- HomeBase and Calendar remain included in the locked-persona matrix; the
  remaining six apps demonstrate their product-specific access message.
- No PHP, route, REST permission, role, auth, enrollment, payment, entitlement,
  database, runtime-lock, production, cache, or provider configuration changed.
- Saved admin overrides still win for promise, chips, payoff, CTA, custom copy,
  and custom media. The existing editor and REST persistence path are retained;
  the modal pencil is visually quiet but usable.
- The 6021 fix evolves from contained art to ratio-preserving
  `object-fit: cover` because the approved 6030A full-bleed composition
  requires it. `object-fit: fill` remains prohibited, so no art is stretched.

## Interaction and accessibility

- Previous/next buttons, eight-position rail, Left/Right keys, and mobile swipe
  browse the app set.
- Escape closes the drawer first, then the reveal.
- Focus is trapped while the reveal is open and returns to the invoking card.
- The disclosure exposes `aria-expanded` and `aria-hidden` state.
- Reduced motion disables reveal, art-settle, copy-stagger, and drawer motion.
- Admin edit controls are capability-derived exactly as before.

## Verification

Primary browser command:

```sh
NODE_PATH=/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/option-c-qa.cjs
```

Result: PASS with no captured console errors.

Browser matrix:

- eight apps, desktop unlocked: PASS
- eight apps, desktop registered-user mixed access: PASS
- eight apps, exact 390 by 844 unlocked: PASS
- eight apps, exact 390 by 844 registered-user mixed access: PASS
- locked LOR Studio 390 by 844 How It Works drawer: PASS
- admin editor visibility and launch: PASS
- keyboard browse, Escape, focus return: PASS
- reduced motion: PASS
- saved-copy override: PASS
- Classic untouched: PASS
- exact cinematic source URL and ratio-preserving cover: PASS

Static regression:

```sh
node --check wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js
node --check wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/option-c-qa.cjs
python3 wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/test_popup_aspect_ratio.py
git diff --check
```

Result: PASS.

## Evidence

- `MX-DASH-6030B/evidence/desktop-unlocked-contact-sheet.png`
- `MX-DASH-6030B/evidence/desktop-locked-contact-sheet.png`
- `MX-DASH-6030B/evidence/mobile-unlocked-contact-sheet.png`
- `MX-DASH-6030B/evidence/mobile-locked-contact-sheet.png`
- `MX-DASH-6030B/evidence/mobile-drawer.png`
- `MX-DASH-6030B/evidence/admin-editor.png`
- `MX-DASH-6030B/evidence/option-c-results.json`
- `MX-DASH-6030B/evidence/art-sha256.json`

## Exact implementation files

- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-students.js`
- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/true-morph-harness.html`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/option-c-qa.cjs`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/test_popup_aspect_ratio.py`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/popup-aspect-ratio-qa.cjs`

## Release boundary

This candidate is intentionally not deployed. DR-194/195 stop at Founder visual
review. Production activation requires a separate Founder release decision,
fresh runtime/source proof, and new deployment fencing.

READY FOR FOUNDER VISUAL REVIEW — OPTION C IS IMPLEMENTED WITH THE EXISTING CINEMATIC MATRIX ART.
