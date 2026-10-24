# I1Q-1007X Current Responsive Audit

## Current Scope

This is a source-based and deterministic-DOM responsive review at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb`. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`.

Browser viewport execution, screenshots, device testing, 200 percent zoom, 400 percent reflow, text-spacing overrides, and touch testing were unavailable. No standalone Playwright or Computer Use substitute was used. Responsive certification is therefore not proven.

## Evidence

- `public/index.html` defines a responsive viewport and a 320-pixel minimum body width.
- `public/styles.css` has breakpoints at 1100 and 760 CSS pixels.
- The 760-pixel breakpoint collapses the shell to one column, reduces padding, hides the identity label, stacks metrics and filters, and makes tables independently scrollable.
- A reduced-motion media query is present.
- Deterministic DOM simulation proved that all 17 workflow renderers complete, but it did not calculate layout or paint pixels.
- A source-to-selector comparison identified core rendered classes with no matching CSS selector.

## Findings

### RESP-CUR-001: Mobile navigation has contradictory state

Severity: High.

The script toggles `aria-expanded` and an `is-open` class. The stylesheet has no rule for `.nav-toggle`, `.brand-row`, or `#primary-nav.is-open`. At 760 pixels and below, `#primary-nav` is always a horizontally scrollable flex row.

Result: the navigation can be visible while the toggle says it is collapsed. All 17 destinations require horizontal discovery.

### RESP-CUR-002: Core responsive component styles are missing

Severity: High.

Rendered classes without source-level style coverage include:

- `action-status`
- `brand-row`
- `choice-editor`
- `command-stack`
- `context-list`
- `control-reason`
- `detail-list`
- `disabled-command`
- `layout-run`
- `nav-toggle`
- `pagination`
- `record-context`
- `review-criteria`
- `scenario-control`
- `scenario-state`
- `state-notice`
- `status-list`
- `transcript-list`
- `transcript-meta`
- state and action tone classes

Result: the current CSS cannot prove stable hierarchy, wrapping, spacing, or target geometry for the actual rendered application.

### RESP-CUR-003: Transcript responsive rules target unused markup

Severity: Medium.

The stylesheet defines `.transcript-line`, while the client renders `.transcript-list` and `.transcript-meta`. The 760-pixel transcript grid rule does not apply to the current transcript workflow.

### RESP-CUR-004: Topbar width is not bounded for the synthetic control

Severity: High pending browser verification.

The topbar is a non-wrapping flex row. Local synthetic mode reveals a labeled state select plus refresh control. `.scenario-control` has no CSS and all selects have `width: 100%`. At 320 CSS pixels and zoomed widths, title and controls may overflow or compress unpredictably.

### RESP-CUR-005: Long-content behavior is unverified

Severity: High for certification.

No real browser run covers long source titles, hashes, clinical stems, choices, evidence claims, reviewer identities, blocker explanations, transcript segments, 10,000-plus queues, or translated text. Table-level horizontal scrolling is present, but body-level overflow and text clipping are not measured.

### RESP-CUR-006: Zoom and text-spacing compliance are unknown

Severity: Release blocker.

The stylesheet has no browser evidence at 200 percent zoom, 400 percent reflow, 320 CSS pixels, or the WCAG text-spacing override. Source rules alone do not prove reflow.

## Responsive Matrix Result

| Width or mode | Source expectation | Evidence status | Verdict |
| --- | --- | --- | --- |
| 1920 desktop | 236-pixel sidebar plus workspace | No browser capture | Not proven |
| 1440 desktop | Same desktop shell | No browser capture | Not proven |
| 1280 desktop | Same desktop shell | No browser capture | Not proven |
| 1100 threshold | Metrics and filters reduce, two-column views stack | CSS only | Partial |
| 1024 tablet | Stacked content with desktop sidebar | CSS only | Partial |
| 768 tablet | Just above mobile breakpoint | No browser capture | Not proven |
| 760 mobile threshold | Single-column shell and horizontal navigation | CSS only, state conflict | Blocked |
| 390 phone | Mobile rules should apply | No browser capture | Not proven |
| 320 minimum | Body minimum and mobile rules | No browser capture | Not proven |
| 200 percent zoom | Effective narrow viewport expected | Not executed | Blocked |
| 400 percent reflow | 320 CSS-pixel task flow expected | Not executed | Blocked |
| Reduced motion | Motion durations reduced | CSS only | Partial |
| Text spacing override | Unknown | Not executed | Blocked |

## Changes

No CSS, HTML, JavaScript, test, screenshot, or runtime change was made.

## Tests

- Static responsive source test passed.
- DOM simulation rendered all workflows and states without duplicate IDs or broken ARIA references.
- No browser layout, screenshot, pixel, touch, hover, computed-style, or visual regression test was run.

## Risks

- Controls may overlap or leave the viewport at narrow widths.
- A user may not discover destinations hidden beyond the horizontal navigation strip.
- Long hashes and evidence identifiers may force body-level overflow because `hash-text` has no style.
- Default fieldset and list styles may increase overflow in authoring and review views.
- The lack of visual evidence prevents a MissionMed premium design-language claim.

## Blockers

1. Implement coherent mobile navigation with CSS and state parity.
2. Add complete styles for every rendered component and state.
3. Align transcript markup and responsive selectors.
4. Run 320, 390, 760, 768, 1024, 1280, 1440, and 1920 browser checks.
5. Run 200 percent zoom, 400 percent reflow, text-spacing, reduced-motion, and long-content checks.
6. Preserve raw screenshots, viewport metadata, browser versions, and hashes.

## Confidence

- 0.98 in source-level selector and state findings.
- 0.82 in predicted overflow risk.
- 0.00 as a responsive or visual certification claim.

## Paths

Evidence paths and hashes are listed in `ux_workflow_audit.md`. This report is located at:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/responsive_audit.md`

## Root Handoff

Root should keep responsiveness and visual quality red. The current CSS is a useful base, but browser matrices and a complete component stylesheet are prerequisites for staging certification.
