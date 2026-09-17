# P1 RISE 4006 Accessibility Report

## Automated Evidence

The 26-test Chrome suite includes axe scans on Home, Profile, Compare, and mobile Explorer and completed with 0 failures. It also asserts landmarks, skip-link behavior, route focus, route announcement, native comparison semantics, globally unique accessible action names even when display names collide, tab keyboard behavior, modal focus trap/inert/restoration/Escape, stale-route cancellation, mutation focus restoration, mobile filter disclosure, 44px compare controls, responsive widths, and no nested interactive controls.

## Implemented Controls

- Visible-on-focus skip link targets the main viewport without changing the SPA route.
- Route changes reset scroll, focus the main viewport, and update a dedicated polite live region.
- Program action labels include the program name, exact designation, location, and immutable program-specialty ID.
- Program profile tabs implement `tablist`, `tab`, `tabpanel`, selected state, roving tabindex, Arrow keys, Home, and End.
- Dialogs use labeled semantics, initial focus, focus trapping, inert background, Escape close, and trigger restoration.
- Comparison uses a native table with row/column headers, separate buttons, claim-level provenance, and logical focus restoration after remove/clear.
- Loading and command-search status use scoped live regions.
- Mobile secondary filters use a button with `aria-expanded` and an associated region.
- Reduced-motion preference is honored in the automated browser configuration.
- Unknown, blocked, and evidence states are communicated with text, not color alone.

## Manual Browser Findings

Desktop and 390px mobile renders showed no horizontal overflow, clipping, incoherent overlap, or unreachable first-result content. Keyboard-driven modal, tabs, skip-link, and back/forward journeys were exercised in the real browser automation. The in-app Browser independently verified the rendered layout and console state.

## Remaining Audit Gaps

- No complete manual screen-reader pass was run with VoiceOver/NVDA.
- Browser zoom at 125%, 150%, and 200% was not completed across all required product surfaces.
- Safari and Firefox were not automated.
- Real authentication, validation errors, Matrix controls, matching explanations, fellowship, CAM, ACTN, and operator actions do not exist to audit.
- Production route and session-expiry accessibility cannot be tested while the route is absent.

## Verdict

The implemented read-only surfaces pass their automated axe and core keyboard regression suite and are materially improved. Accessibility for the complete required product and live production environment cannot pass because most required surfaces and states do not exist.

`CANDIDATE_CORE_PASS_PRODUCTION_ACCESSIBILITY_NOT_CERTIFIABLE`
