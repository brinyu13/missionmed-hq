# I1Q-1008A Accessibility Audit

## Status

`SIMULATED LOCAL AUDIT. WCAG 2.2 AA CONFORMANCE NOT PROVEN.`

Candidate commit: `fd7ddcd7688a0fc89cc4fc1320806220221046ae`

This audit used exact-commit source, deterministic tests, and the Codex in-app browser. It did not use authenticated staging, real identities, Safari, Firefox, Edge, standalone Chrome, a screen reader, magnification software, switch control, voice control, or human participants.

## Candidate Fingerprints

| File | SHA-256 |
| --- | --- |
| `public/index.html` | `63b4f2b3006179ca571ca5ab5665c0d65e4a3bc2eac00f06c2445b4cd3293f29` |
| `public/app.js` | `776d1fa1d98201c682f638aa04eb2ffc963c9b48019b946c5d0aadd2e271c4b9` |
| `public/styles.css` | `cf6a6a2220466fb2105a90343cf42a6158904111987bd5eda9b21e21c5715630` |
| `src/server.mjs` | `f0088ad814e3747bfe1316bc41a7c2f86b70f5ec3aceb51c22417a8d6135d6aa` |
| `tests/ui.test.mjs` | `13b7d94ffdb1267381c1617af0e3fd833e25fcd1941839bf36ef1f985f46a240` |

## Verdict

The exact local candidate has no observed critical or high accessibility defect in the tested synthetic matrix. The prior page-root reflow failure is closed locally. Structure, focus destinations, status roles, target geometry, component contrast, identifier wrapping, mobile context, pagination, and independent table scrolling are strong in the tested browser.

`ACCESSIBILITY RELEASE VERDICT: BLOCK`

This remains blocked because WCAG conformance requires the complete product and supported environments. Actual 200 and 400 percent zoom, text-spacing overrides, forced colors, full keyboard task completion, assistive technology, cross-browser behavior, authenticated staging states, and human validation have not been executed.

## Evidence Executed

- 287 local tests: 285 passed, 0 failed, 2 expected database skips.
- Focused UI suite: 19 of 19 passed.
- 17 workflows by 11 viewports: 187 cells.
- 16 states by 11 viewports: 176 cells.
- Mobile context: 68 phone workflow cells.
- Width-equivalent reflow simulation: 34 workflow and 32 state cells at 640 and 320 CSS pixels.
- Zero root-overflow, non-table escape, clipped-control, H1, duplicate-ID, broken-ARIA, state-role, state-focus, or busy-state failures.
- Zero visible targets below the WCAG 2.2 AA 24 by 24 minimum. Refresh measured 44 by 44 in every workflow cell.
- Zero pagination clipping, title-only hash disclosure, or incomplete exact physician hash presentation.
- Browser console warnings or errors: zero.

All scores and local pass statements in this packet are `SIMULATED`.

## Confirmed Local Strengths

### Structure and names

The shell has a skip link, complementary navigation, one main landmark, one H1, named live regions, named controls, fieldsets, labels, definitions, and named table regions at `public/index.html:11-88`. The 17-screen semantic scan found zero unnamed visible controls, unnamed regions, heading skips, or broken references.

### Focus and errors

All 17 workflow transitions focused `#screen-title`. All 176 deterministic state cells focused their labelled H2 and ended with `aria-busy="false"`. Initial authentication failure and distinct expired, revoked, and identity-provider outage states are defined at `public/app.js:521-560`. Full natural keyboard task completion remains external.

### Status messages

Polite and assertive live regions are defined at `public/index.html:72-88`. Every deterministic state used `role="status"` or `role="alert"` and exposed at least one recovery action. Screen-reader announcement timing and verbosity remain untested.

### Target geometry and focus visibility

No visible target measured below 24 by 24. Refresh remained 44 by 44 in all 187 workflow cells. Focus and forced-color rules are explicit in `public/styles.css`. Native checkbox visuals were evaluated through their associated labels and spacing, not treated as standalone 44-pixel controls.

### Component contrast

`--control-border: #7b8580` yields approximately 3.81:1 against white. Tested text, focus, status, sidebar, and mobile-menu pairs meet their applicable local thresholds.

### Reflow and tables

`.table-wrap` is now a positioned, bounded, independently scrolling region at `public/styles.css:516-525`. Corpus inventory, Extraction runs, Search and filters, and Audit trail all measured root width equal to viewport at 320 and 768. Their table scroll widths remained larger than their client widths. A direct touchpad-style gesture moved the Inventory table to `scrollLeft=300` while `window.scrollX` stayed zero.

### Exact identifiers

Full exact hashes wrap without `title` dependence. Physician review displayed a 64-character SHA-256 at 320 pixels with no root overflow from `public/app.js:1423-1427`. The regression assertions are at `tests/ui.test.mjs:462-468`.

### Mobile context

Actor and environment context were visible in all 68 phone workflow cells. The environment label computes to wrapping flex with 4-pixel row and 8-pixel column gaps from `public/styles.css:155-161`. The expanded 17-item workflow menu had no horizontal clip at 320, 375, 390, or 430.

## Repair Retest Results

| Prior finding | Current result | Acceptance evidence |
| --- | --- | --- |
| `A11Y-P0-001` page-root table overflow | `CLOSED LOCALLY` | Root width equaled viewport in all 187 workflow and 176 state cells; all eight targeted table-route checks preserved their internal scroller. |
| `A11Y-P1-002` inconsistent exact identity | `CLOSED LOCALLY` | Signed Physician decision now shows the full 64-character hash and wraps at 320. |
| `A11Y-P1-003` compact mobile environment text | `CLOSED LOCALLY` | Explicit 4 by 8 pixel wrapping gap is present and rendered at all four phone widths. |

## Open Findings

### A11Y-GATE-001: External accessibility evidence is absent

Severity: `RELEASE GATE`

No local scan proves VoiceOver, NVDA, JAWS, browser magnification, switch control, voice control, supported-browser rendering, text-spacing overrides, forced colors, or human usability.

Acceptance tests:

1. Execute `human_validation_protocol.md` against one exact authenticated staging build.
2. Complete every safety-critical workflow with keyboard and assigned assistive technology.
3. Repeat at native 200 percent zoom and 400 percent reflow, not only width-equivalent viewports.
4. Record exact browser, operating system, assistive technology, viewport, build, and synthetic fixture.

### A11Y-P1-002: Incomplete workflows prevent end-to-end accessibility certification

Severity: `HIGH PRODUCT GAP`

Validation-result inspection and incident creation are missing. Candidate disposition, privacy decision, rights resolution, distractor verdict, and assignment management remain read only or partial. A screen that does not exist cannot be certified for keyboard, error, focus, announcement, or assistive-technology behavior.

Acceptance tests:

1. Implement each governed workflow with semantic controls, explicit consequence, deterministic focus, and non-leaking recovery.
2. Add loading, empty, blocked, unauthorized, validation, conflict, and service-failure states.
3. Execute each path for the authorized and denied synthetic roles.
4. Re-run semantic, keyboard, AT, and responsive matrices against the exact immutable build.

### A11Y-P2-003: Role and navigation comprehension remains unproven

Severity: `MEDIUM`

All actors receive the same 17 navigation buttons at `public/index.html:28-45`. This is visually stable but can add cognitive and focus burden for novice or role-limited users.

Acceptance tests:

1. Present only authorized and relevant work without using client visibility as authority.
2. Preserve a predictable order and a route to broader read-only context where allowed.
3. Validate task start and navigation comprehension with novice, keyboard, and screen-reader participants.

## Contrast Results

| Pair | Approximate ratio | Local result |
| --- | ---: | --- |
| Ink `#18211d` on white | 16.48:1 | Pass |
| Muted `#5d6862` on white | 5.80:1 | Pass |
| Control border `#7b8580` on white | 3.81:1 | Pass for component boundary |
| Focus `#0c6fc2` on white | 5.16:1 | Pass |
| Sidebar focus `#9dccff` on `#202825` | 8.99:1 | Pass |
| Mobile menu border `#708078` on `#202825` | 3.63:1 | Pass |
| Green text on green soft | 6.44:1 | Pass |
| Blue text on blue soft | 5.99:1 | Pass |
| Amber text on amber soft | 5.51:1 | Pass |
| Red text on red soft | 6.35:1 | Pass |

Disabled controls were not used to establish a required contrast pass.

## WCAG 2.2 AA Evidence Map

| Criterion | Exact local evidence | Verdict |
| --- | --- | --- |
| 1.3.1 Info and Relationships | Landmarks, headings, labels, tables, fieldsets, and definitions are structural | Strong local evidence |
| 1.3.2 Meaningful Sequence | Logical source order in all 17 screens | Local pass |
| 1.4.1 Use of Color | Status text accompanies color and dots | Local pass |
| 1.4.3 Contrast Minimum | Tested text pairs pass | Local pass, cross-browser open |
| 1.4.10 Reflow | Zero root failures in 187 workflow cells and width-equivalent checks | Local pass, native zoom open |
| 1.4.11 Non-text Contrast | Control, focus, and status boundaries pass locally | Local pass |
| 1.4.12 Text Spacing | Required override was not executed | Unknown |
| 2.1.1 Keyboard | Native controls and deterministic focus exist | Partial, full task completion open |
| 2.1.2 No Keyboard Trap | No trap observed in pointer-driven local matrix | Partial, full keyboard run open |
| 2.4.1 Bypass Blocks | Skip link targets `#workspace` | Source verified, real keyboard run open |
| 2.4.3 Focus Order | Workflow and state focus destinations pass | Local pass |
| 2.4.7 Focus Visible | High-contrast focus rule exists | Local pass |
| 2.4.11 Focus Not Obscured | No tested focus destination was obscured | Local pass, external run open |
| 2.5.8 Target Size Minimum | No visible target below 24 by 24 | Local pass |
| 3.2.3 Consistent Navigation | Stable labels and order across screens | Local pass |
| 3.3.1 Error Identification | Deterministic error states identify the condition | Local pass for fixtures |
| 3.3.2 Labels or Instructions | Form controls are labelled | Local pass |
| 3.3.7 Redundant Entry | Not fully applicable to incomplete workflows | Unknown |
| 3.3.8 Accessible Authentication | Canonical authentication was not exercised | Unknown and release blocking |
| 4.1.2 Name, Role, Value | No unnamed visible control in semantic scan | Strong local evidence |
| 4.1.3 Status Messages | Live regions and status roles exist | Local pass, AT announcement quality open |

## Accessibility Conclusion

`LOCAL SYNTHETIC MATRIX: PASS`

`WCAG 2.2 AA CERTIFICATION: NOT PROVEN`

`RELEASE: BLOCK`

The current exact commit closes every locally actionable accessibility repair from the preceding audit. External and product-completeness gates remain mandatory.
