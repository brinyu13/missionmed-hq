# I1Q-1007X Current Accessibility Audit

## Current Scope

This read-only audit evaluates the current local synthetic shell at repository commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb` against the requested WCAG 2.2 AA areas. The reviewed UI bytes last changed at `4b154e8deb60ddf9a002f8a01a8fec90518b8966`.

Verdict: `WCAG 2.2 AA NOT PROVEN`. This is an evidence verdict, not a claim that every untested success criterion fails.

No browser, accessibility tree, VoiceOver, NVDA, JAWS, switch control, or real user session was available. No standalone Playwright or Computer Use substitute was used.

## Evidence

- Static HTML, CSS, client, server shell, and UI test inspection at the absolute paths listed in `ux_workflow_audit.md`.
- UI suite: 6 of 6 passed.
- Full local suite: 196 passed, 0 failed, 1 skipped.
- Deterministic JSDOM rendering of 17 workflows and 16 state fixtures.
- Deterministic semantic scan of rendered local synthetic workflows.
- Computed WCAG contrast ratios for declared CSS color pairs.
- Current evidence validator result: 19 errors and nonzero exit.

## Positive Findings

- `html` has a language, title, viewport, and light color-scheme declaration.
- The shell uses navigation and main landmarks, one page heading, and a functional skip-link target.
- Navigation destinations are native buttons with accessible text and `aria-current` management.
- The refresh icon has an accessible name and tooltip text.
- Forms use wrapping labels, fieldsets, legends, native inputs, selects, textareas, and checkboxes.
- Dynamic tables use scoped row and column headers and named keyboard-scroll regions.
- Polite and assertive live regions exist.
- Navigation, error, and scenario rendering include programmatic focus targets.
- All 16 scenario fixtures expose a state identity, owner, recovery, and synthetic-only boundary.
- Status badges use text plus a shape, not color alone.
- Reduced-motion CSS disables motion durations.
- No drag-only action or timed review interaction was found.
- DOM simulation found no unnamed controls, duplicate IDs, or broken accessible-reference IDs.

## WCAG Evidence Matrix

| Required area | Current evidence | Verdict |
| --- | --- | --- |
| Complete keyboard operation | Native controls and DOM click simulation | Not proven in a real browser across complete tasks |
| Visible focus | Global 3-pixel focus outline | Partial; sidebar contrast is below 3 to 1 and no browser run exists |
| Accessible names | Static plus DOM semantic scan | Strong local evidence, not an accessibility-tree certification |
| Announced status changes | Live regions and announcement functions | Partial; duplicate announcements and rerender clearing are likely |
| Target sizing | Declared 36 to 38 pixel controls and labeled checkbox rows | Partial; unstyled nav toggle and computed geometry are unverified |
| Contrast | Declared color calculations | Partial; focus indicator fails on dark sidebar and computed styles are untested |
| Zoom and reflow | Responsive CSS only | Not proven at 200 percent or 400 percent |
| Reduced motion | Media query exists | Partial; computed browser behavior unverified |
| No keyboard traps | No modal widget or drag surface | Not proven by a complete browser tab-order run |
| No drag-only actions | No drag action found | Pass for current source scope only |
| No timed review trap | No timed action found | Pass for current source scope only |
| Focus not obscured | No sticky overlay found | Not proven in browser, zoom, or mobile navigation |
| Accessible authentication | Local synthetic mode only | Not testable until canonical auth is integrated |

## Contrast Evidence

Declared pairs calculated with the WCAG relative luminance formula:

| Pair | Ratio | Source-level result |
| --- | ---: | --- |
| Ink on white | 16.48:1 | Pass |
| Muted on white | 5.80:1 | Pass for normal text |
| Muted on subtle surface | 5.44:1 | Pass for normal text |
| White on primary green | 7.26:1 | Pass |
| Warning text on warning surface | 8.98:1 | Pass |
| Red status pair | 6.35:1 | Pass |
| Blue status pair | 5.99:1 | Pass |
| Sidebar text on sidebar | 11.62:1 | Pass |
| Active navigation text | 10.05:1 | Pass |
| Focus outline on white | 5.16:1 | Pass non-text contrast |
| Focus outline on dark sidebar | 2.92:1 | Fail the 3:1 non-text threshold |

Disabled text measured 3.20:1, but inactive controls are exempt from normal text contrast. The unstyled classes and actual computed browser colors remain unverified.

## Findings

### A11Y-CUR-001: Focus and success feedback can disappear during rerender

Severity: High.

`showActionStatus` may focus the live status, then queue, resume, editorial, and release actions immediately call `renderScreen`. `renderScreen` calls `clearActionStatus` before replacing the focused subtree. Internal detail actions and filter submissions also rerender without a destination focus rule.

Impact: keyboard and screen-reader users can lose their position and miss the result of a material action.

### A11Y-CUR-002: Two live regions can announce one action

Severity: Medium.

`action-status` is itself a polite live region, while `showActionStatus` also writes the same message through the separate polite or assertive announcer. Errors can be announced once politely and again assertively.

Impact: duplicate or out-of-order speech can reduce trust and obscure the next task.

### A11Y-CUR-003: Mobile navigation state is not represented by CSS

Severity: High.

The client toggles `aria-expanded` and `#primary-nav.is-open`, but the stylesheet has no `.nav-toggle`, `.brand-row`, or `.is-open` rule. At the mobile breakpoint, the navigation remains a visible horizontal strip even when `aria-expanded` is `false`.

Impact: visual state and programmatic state can disagree. Keyboard and screen-reader users receive an inaccurate collapse state.

### A11Y-CUR-004: Focus indicator contrast misses the declared threshold on the sidebar

Severity: Medium.

The focus color `#0c6fc2` against sidebar `#202825` computes to 2.92:1.

Impact: focused workflow buttons can be difficult to identify and do not meet the 3:1 non-text contrast expectation.

### A11Y-CUR-005: Editorial block text can contradict operable controls

Severity: High.

Expired evidence produces a blocking notice, but the `canReview` expression does not include `!expired`. This is also an error-prevention and trust defect.

Impact: a reviewer may attempt an invalid verdict while the page simultaneously says the verdict is blocked.

### A11Y-CUR-006: Current CSS omits many rendered component classes

Severity: High for certification.

Source comparison found no selectors for core classes including `detail-list`, `record-context`, `state-notice`, `scenario-state`, `action-status`, `disabled-command`, `layout-run`, `pagination`, `review-criteria`, `transcript-list`, `transcript-meta`, `nav-toggle`, and state tone classes.

Impact: information hierarchy, focus context, state salience, mobile operation, wrapping, and target geometry cannot be trusted from source alone.

### A11Y-CUR-007: Current automated coverage is too narrow for conformance

Severity: Release blocker.

The UI suite boots Dashboard and navigates to Inventory. It does not execute complete keyboard tasks, live-region speech, visual focus, all 17 workflows, all 16 state recovery paths, zoom, text spacing, reduced motion, target geometry, or real authentication.

## Changes

No product or test change was made. This file records findings only.

## Tests

- UI tests passed 6 of 6.
- Full package tests passed 196 with 1 skipped disposable database test.
- JSDOM semantic scan found zero unnamed controls, duplicate IDs, and broken ARIA references in the synthetic render.
- Sixteen state fixtures matched requested state, expected `status` or `alert` role, focused heading, recovery command, and synthetic boundary.
- No visual browser or assistive-technology execution occurred.

## Risks

- DOM semantics can pass while computed styles, focus visibility, clipping, announcements, and keyboard order fail in real browsers.
- Source lineage mismatch can make an accessible label describe the wrong underlying record.
- A synthetic scenario picker demonstrates states but does not prove natural API failures are announced correctly.
- Canonical authentication may introduce focus, timeout, reauthentication, and error behavior not represented here.

## Blockers

- Close A11Y-CUR-001 through A11Y-CUR-006.
- Run the browser and assistive-technology matrix in `human_validation_protocol.md`.
- Produce criterion-level raw evidence for applicable WCAG 2.2 AA requirements.
- Pass 200 percent zoom, 400 percent reflow, text-spacing, target-size, and complete contrast checks.
- Obtain independent accessibility verification after repairs.

## Confidence

- 0.96 in semantic source and deterministic DOM findings.
- 0.94 in focus, live-region, and mobile-state defects.
- 0.80 in responsive and visual severity pending browser execution.
- 0.00 as a claim of WCAG 2.2 AA conformance.

## Paths

See the absolute evidence paths and hashes in `ux_workflow_audit.md`. The current report path is:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/ux_current/accessibility_audit.md`

## Root Handoff

Accessibility remains red for State C. Root should not translate passing source or JSDOM checks into a WCAG claim. The next valid step is repair, real browser evidence, real assistive-technology testing, human validation, and independent re-audit.
