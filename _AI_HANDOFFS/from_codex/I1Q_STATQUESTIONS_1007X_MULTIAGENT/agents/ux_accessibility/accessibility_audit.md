# I1Q-1007X Accessibility Baseline Audit

## Verdict

**WCAG 2.2 AA NOT PROVEN for the I1Q-1006 candidate.** The source contains several useful accessibility foundations, but the supplied result is a hard-coded heuristic summary rather than criterion-level conformance evidence.

This is a release-blocking evidence verdict for the 1006 candidate, not a claim that every untested success criterion fails.

## Snapshot Boundary

Authority and MissionMed OS observations from the initial audit predated the Root Supervisor's later recovery and registration. They are not current accessibility blockers and must not be carried forward as such. This audit's live veto is based only on verified UI and evidence defects in the 1006 candidate.

## Positive Foundations Observed

- Language, viewport, navigation, main, heading, and skip-link structures exist.
- Form labels or accessible names are present for the inspected static controls.
- A global `:focus-visible` rule exists.
- Polite and assertive live regions exist.
- Status badges include text and a shape rather than color alone.
- A reduced-motion media rule exists.
- The three reported contrast samples exceed 4.5:1.
- No drag operation or timed review behavior exists in the current UI.

These are implementation clues, not a WCAG conformance statement.

## Evidence Provenance Failure

`scripts/generate_evidence.mjs` writes the browser and accessibility result values directly. It does not consume a browser trace, accessibility engine, accessibility tree, contrast analyzer, screen-reader log, keyboard transcript, or raw test result for those claims.

`tests/ui.test.mjs` checks source strings and markup patterns. It does not execute the rendered workflows, tab order, focus state, live-region behavior, target size, zoom, reflow, or assistive-technology output.

Consequently, `pass_automated_and_browser_heuristics` cannot be accepted as WCAG 2.2 AA evidence.

## WCAG Evidence Matrix

| Required area | Evidence status | Audit result |
| --- | --- | --- |
| Complete keyboard operation | Navigation Enter/Space source pattern only | Not proven; complete workflow operation and no-trap testing are absent. |
| Visible focus | CSS rule and focused navigation screenshots | Partial; every control, scroll region, modal/state, and high-contrast context is untested. |
| Contrast | Three selected ratios | Partial; all text, badges, disabled explanations, focus indicators, form boundaries, and non-text states are not inventoried. |
| Accessible names | Static shell heuristic | Partial; dynamic states and complete accessibility-tree names/descriptions are untested. |
| Announced status changes | Live-region markup | Partial; loading, save, errors, retries, conflicts, and repeated messages lack screen-reader evidence. |
| Target sizing | No measurement | Not proven against WCAG 2.2 SC 2.5.8. |
| Zoom and reflow | No 200% or 400% run | Not proven against SC 1.4.4 and 1.4.10. |
| Reduced motion | Stylesheet rule | Partial; computed behavior is not verified. |
| No keyboard traps | No test | Not proven against SC 2.1.2. |
| No inaccessible drag-only action | No drag UI currently present | Not applicable to the current scaffold; must be retested after feature completion. |
| No timed review trap | No timer currently present | Not applicable to the current scaffold; future session and review expiry behavior requires testing. |
| Focus not obscured | No test | Not proven against WCAG 2.2 SC 2.4.11. |
| Accessible authentication | Canonical auth is absent from 1006 | Not testable against WCAG 2.2 SC 3.3.8. |

## Findings

### A11Y-01: Conformance claim has no reproducible source

Severity: Blocker.

The evidence generator manufactures a pass summary from constants. A release gate needs raw executable results, environment identity, commit identity, criterion mapping, and manual evidence.

### A11Y-02: Complete keyboard workflows are unavailable

Severity: High. Related criteria: 2.1.1, 2.1.2, 2.4.3.

Several visible commands have no behavior for any input method. Navigation changes content but retains focus on the navigation button, with no validated focus transfer to the new view. Queue, review, release, and incident tasks cannot be completed keyboard-only.

### A11Y-03: Reflow and zoom are not proven

Severity: High. Related criteria: 1.4.4, 1.4.10, 1.4.12.

The mobile navigation requires horizontal scrolling while the page also scrolls vertically. Supplied mobile and tablet captures visibly truncate headings or right-side content in several views. There is no 320 CSS-pixel, 200%, 400%, or text-spacing test.

### A11Y-04: Dynamic focus and status behavior is unverified

Severity: High. Related criteria: 2.4.3, 2.4.11, 4.1.3.

Loading regions are inserted and replaced rapidly; repeated announcements are not tested. Save status, retries, navigation, and future conflict messages need focus and announcement rules validated with actual assistive technologies.

### A11Y-05: Source metadata uses invalid list semantics

Severity: Medium. Related criterion: 1.3.1.

The transcript template places `li` children directly under `dl`. Use valid `dt`/`dd` group structure and verify the accessibility tree.

### A11Y-06: Disabled safety controls lack robust descriptions

Severity: Medium. Related criteria: 1.3.1, 3.3.2.

Disabled physician and release controls cannot receive focus, and their blocker explanation is not consistently linked through `aria-describedby` or an equivalent operable disclosure.

### A11Y-07: Contrast and target-size coverage is incomplete

Severity: Medium. Related criteria: 1.4.3, 1.4.11, 2.5.8.

Three selected contrast values and CSS dimensions are insufficient. The complete component/state inventory needs computed contrast and target geometry evidence.

## Required Verification

- Automated semantic scan on every workflow and required state, with raw machine output.
- Manual keyboard transcript for every primary task, including errors and recovery.
- VoiceOver plus Safari, NVDA plus Firefox or Chrome, and JAWS plus Chrome or Edge coverage.
- 200% zoom, 400% reflow, 320 CSS-pixel width, and text-spacing override coverage.
- Focus order, focus visibility, focus not obscured, and scroll-region operation checks.
- Target-size and complete contrast inventory.
- Live-region announcement transcript for loading, saved, error, conflict, queued, running, failed, and resumed states.
- Retest after canonical authentication is integrated.

## Gate Result

Accessibility remains red for the 1006 release candidate. It may move to green only after criterion-level automated and manual evidence passes, all critical/high findings are closed, representative assistive-technology users validate the workflows, and an independent verifier reviews the raw evidence.
