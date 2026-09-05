# MX-DASH-6021 — Popup Aspect-Ratio Fix

Date: 2026-09-05

Result: COMPLETE

Production: LIVE for the existing Matrix Dashboard 2.0 audience

## Root cause

The shared app-detail foreground-image rule forced every approved cinematic PNG into the full visual-column rectangle with `width:100%`, `height:100%`, and `object-fit:fill`. The modal columns have a different ratio from the approved artwork, so HomeBase, Scheduler, and the other six images were distorted vertically.

## Surgical fix

Only the shared detail-image declaration changed:

```css
:is(#student-os-root,body) .mmdv2-locked-detail img {
  inset: 0;
  top: 0;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: contain;
  object-position: center center;
  transform: none;
  -webkit-mask-image: none;
  mask-image: none;
}
```

The existing `.mmdv2-media-back` cover layer remains behind the foreground image, so any surrounding space is filled by the established dark/blurred treatment rather than stretching the approved art. No app-specific exception was added.

## Files changed

- `wp-content/plugins/missionmed-hub/assets/dashboard-v2/mmed-dashboard-v2.6010b-true-morph.css`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/test_popup_aspect_ratio.py`
- `wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/popup-aspect-ratio-qa.cjs`
- `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/desktop-before.png`
- `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/desktop-after.png`
- `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/mobile-after.png`
- `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/popup-aspect-ratio-results.json`
- this handoff

No Dashboard JavaScript, backend, authentication, entitlement, source-art, morph, Classic, or unrelated production file changed.

## Before and after evidence

- Before: `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/desktop-before.png`
- After desktop: `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/desktop-after.png`
- After 390×844: `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/mobile-after.png`
- Machine-readable results: `_AI_HANDOFFS/from_claude_code/MX-DASH-6021/evidence/popup-aspect-ratio-results.json`

The before capture replays the production `object-fit:fill` rule against the exact current true-morph harness. The after captures use the release candidate without override. Separate authenticated live screenshots were also captured inline in the execution task after deployment for HomeBase and Scheduler.

## Verification

### Targeted true-morph browser QA

`NODE_PATH=/Users/brianb/MissionMed_worktrees/P1-RISE-4006/node_modules node wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/popup-aspect-ratio-qa.cjs`

- Desktop all eight: PASS
- HomeBase native PNG `340×378`, computed `object-fit:contain`, centered: PASS
- Scheduler native PNG `348×378`, computed `object-fit:contain`, centered: PASS
- All eight distinct approved native ratios retained: PASS
- Full contained-paint bounds remain within the image box: PASS
- Popup arrows, close button, CTA, keyboard next/previous/Escape: PASS
- Admin `Edit this app`: PASS
- Student eight-card locked state and no modal editor: PASS
- Classic: PASS
- Reduced motion: PASS
- 390×844 document/body width `390px`, no horizontal overflow: PASS

### Static custody test

`python3 wp-content/plugins/missionmed-hub/tests/mx-dash-6010b/test_popup_aspect_ratio.py`

- Shared CSS rule and centered contain behavior: PASS
- All eight Founder-approved PNG dimensions and ratios: PASS

### Broader regression

The established 6010B browser suite completed with all checks passing, including all eight cards, forward/reverse morph, keyboard, stress/context disposal, route cleanup, detail launch, editor/admin preservation, student behavior, Classic, reduced motion, fallback, and 390×844.

## Authenticated production verification

Production CSS SHA-256 changed from:

`c6638f7d210f751db2927d8916dcef5e107ea185fc6429df989627f13fef8919`

to the tested/live value:

`4f78078ebd65d2966322ce283ee6a78e8693b450e3d136c56f2c0670034b57ed`

Authenticated Chrome verification after cache purge showed:

- HomeBase: `340×378`, `object-fit:contain`, centered, full foreground visible: PASS
- Scheduler: `348×378`, `object-fit:contain`, centered, full foreground visible: PASS
- All eight live popup images: `object-fit:contain` and centered: PASS
- Admin edit control: PASS
- Student preview: eight locked cards, no modal edit control: PASS
- Dashboard page width `1399px` within `1414px` viewport: PASS

The direct cache-busted public CSS response also hashes to the tested value.

## Deployment and rollback

Only `mmed-dashboard-v2.6010b-true-morph.css` was uploaded.

Rollback copy:

`/www/theresidencyacademy_209/private/mx-dash-6021-rollback-20260905T201152Z/mmed-dashboard-v2.6010b-true-morph.css`

Rollback SHA-256:

`c6638f7d210f751db2927d8916dcef5e107ea185fc6429df989627f13fef8919`

Autoptimize, WordPress object cache, and Kinsta cache reported successful clears. The combined WP-CLI command then returned exit 139 from a post-flush segmentation fault. No further production mutation was made. Read-only follow-up confirmed the page/CSS remained reachable, the candidate hash remained live, the protected JS/PHP/base-CSS hashes were unchanged, and authenticated UI verification passed.

## Authority

- Founder runtime-drift approval is recorded as `DR-191`.
- Approval binding SHA-256: `2f566932c83356de126879cc7e5c71eea71ad45cd8b379130015cba232723ef3`.
- Existing live bytes for `dashboard_v2_js`, `dashboard_v2_css`, and `missionmed_hub_php` were preserved exactly.
