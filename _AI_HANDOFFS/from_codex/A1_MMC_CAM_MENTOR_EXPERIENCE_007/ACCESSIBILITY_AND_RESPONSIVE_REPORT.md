# Accessibility and Responsive Report

RESULT: `AUTOMATED_CHROMIUM_BASELINE_PASS_NOT_WCAG_CERTIFICATION`

## Implemented baseline

- Skip link is the first actionable control and moves focus to the main landmark.
- One semantic main region and one route-specific `h1` are present.
- Primary navigation uses links and `aria-current`; route changes focus the heading once.
- Dialogs use native dialog behavior, named fields, Escape close, focus containment, and return focus.
- Interactive controls in tested routes have accessible names.
- Save/loading/error state uses persistent status/alert semantics rather than color alone.
- Shared `:focus-visible` treatment remains visible.
- Core body/form text and mobile controls meet the tested size floors.
- `prefers-reduced-motion` eliminates active nonessential animation.
- Forced-colors CSS provides perceivable boundaries/focus, but was not executed on Windows.
- Long RTL/Unicode content wraps without page overflow.

## Responsive evidence

Automated Chromium coverage passed at:

- 1440 × 900
- 1280 × 800
- 1024 × 768
- 768 × 1024
- 390 × 844
- 320 × 740
- 640px effective-width proxy for 200% zoom behavior
- landscape narrow-screen capability check

Desktop/tablet use the appropriate rail form; narrow screens use bottom navigation and sequential content. All six required viewport families rendered without document-level horizontal overflow. Mobile primary controls passed the bounded touch-target test. Long content and a 100k-character transcript-like fixture remained route-bounded.

## Automated evidence

The keyboard/focus suite passed 9/9 and responsive/visual structure passed 6/6. The broader browser suite passed 73/73. Twenty-two hashed screenshots cover primary routes, all required width families, long/RTL and transcript fixtures, plus loading, empty, partial, stale, error, revoked, offline/not-saved, and conflict states.

## Explicitly unrun

- Axe or another automated WCAG rules engine
- Firefox
- WebKit/Safari automation
- VoiceOver
- NVDA
- TalkBack
- Windows forced-colors/increased-contrast runtime
- iOS/Android real touch and virtual keyboard
- hardware orientation with focus/media/draft preservation
- representative mentor accessibility/usability sessions
- formal WCAG 2.2 AA audit

Therefore the correct result is an automated Chromium accessibility/responsive baseline pass, not “WCAG certified” and not cross-browser or assistive-technology complete. Any later manual or multi-browser defect remains release blocking.
