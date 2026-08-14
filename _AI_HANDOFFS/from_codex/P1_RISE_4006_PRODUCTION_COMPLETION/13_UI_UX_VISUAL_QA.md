# P1 RISE 4006 UI, UX, And Visual QA

## Rendered Review Scope

The isolated candidate was rendered and interacted with in installed Chrome through Playwright and independently in the in-app Browser. Review covered 1440x900 desktop and 390x844 mobile screenshots plus automated layouts at 430x932, 768x1024, and 1024x768. The candidate used an explicitly labeled synthetic fixture; no source-controlled program data was served.

## Implemented Surface Scores

| Surface | UI | UX | Findings |
|---|---:|---:|---|
| Command Home | 8.4 | 8.1 | Clear release/evidence posture; restrained CAM-aligned hierarchy |
| Explorer | 8.5 | 8.2 | Dense but scannable; filter hierarchy and pagination are stable |
| Program Profile | 7.8 | 7.0 | Claim-level provenance, explicit unknowns, and keyboard tabs |
| Compare | 7.4 | 6.2 | Native table semantics, claim provenance, honest unknowns, and stable focus |
| Ecosystem Handoffs | 7.6 | 7.0 | Truthful disabled states, but no functional journey exists |
| Operator Queue | 7.3 | 6.6 | Honest quarantine/status surface, but no durable actions exist |
| Implemented-subset aggregate | 7.8 | 7.2 | Independent UI/accessibility review; no Critical/High finding remained |

The implemented subset does not reach the required 9/10 threshold. The same independent reviewer scored the complete charter at 3.6 UI and 2.7 UX because Matrix criteria, Why This Matches, distance, fellowship, ACTN detail, interview pack, CAM handoff, operator actions, and real authentication states are absent. The broader release board applied an even stricter aggregate score in reports 09 and 10.

## Material Repair Loop

| Prior finding | Repair | Verification |
|---|---|---|
| Skip link became an SPA route | Dedicated skip-link behavior focuses main content | Playwright keyboard test |
| Route changes left focus/scroll behind | Route render resets scroll, focuses main, and announces view | Playwright history/focus test |
| Repeated actions had ambiguous names | Program-specific profile/compare/remove labels | Accessibility-name test |
| Duplicate program names still collided | Labels now include designation, location, and immutable program-specialty ID | Duplicate-name regression |
| Whole main region announced excessively | Dedicated atomic route announcer | DOM and browser test |
| Mobile filters crowded first results | Accessible More/Hide filters disclosure | 390px test and screenshot |
| Completeness bands sounded like quality/confidence | Renamed to source-attributed field completeness with numeric ranges | Browser text assertions |
| Visa filter wording could imply current sponsorship | Labels now say source-listed and explicitly disclaim current or conditional sponsorship; F-1 OPT is employment authorization | Browser text assertions |
| Comparison lacked a decision boundary | Added persistent eligibility/Match disclaimer | Browser visual inspection |
| Synthetic labels disappeared after navigation | Persistent synthetic-fixture and current-availability notices on every view | Six-route browser regression |
| Late API responses could overwrite a newer route | Per-route abort controller, generation, and hash guard | Four-route stale-response regression |
| Profile/compare mutations discarded focus | Logical replacement controls receive focus after rerender | Profile, remove, and clear regressions |
| Profile/compare flattened provenance | Every selected field exposes assertion class, source authority, dates/period, locator, snapshot, parser, and claim hash | Profile and compare regressions/in-app browser |
| Blank selected fields were undercounted | API reports absent and total unknown selected fields; UI identifies absent as an unknown subset | Evidence-panel regression/in-app browser |

The completed repair suite contains 26 browser tests and was rerun green after the final UI changes.

## Responsive And Visual Findings

- Desktop shell, sidebar, toolbar, filter band, result list, and cards fit without overlap or clipping.
- At 390px, `scrollWidth` equals viewport width; bottom navigation, filter disclosure, and first result card remain visible.
- Secondary filters are hidden by default on mobile and expand without relabeling ambiguity.
- Fixed controls do not resize when counts or labels change in the tested fixture.
- Long controls and program-specific labels wrap or remain accessible without changing card geometry.
- No console errors or page exceptions were observed in the tested browser journeys.

## Evidence

- `artifacts/screenshots/rise-explorer-1440x900.png`
- `artifacts/screenshots/rise-explorer-390x844.png`
- `artifacts/screenshots/rise-explorer-430x932.png`
- `artifacts/screenshots/rise-explorer-768x1024.png`
- `artifacts/screenshots/rise-explorer-1024x768.png`

## Gaps

No real-data density, authenticated identity state, Matrix criteria panel, match explanation, fellowship, interview pack, CAM dialog, functional operator queue, loading failure from a real network, Safari/Firefox, or 200% zoom complete-product screen could be reviewed. Those are release blockers, not visual limitations to defer.

**Visual QA verdict:** `IMPLEMENTED_SUBSET_POLISHED_BUT_BELOW_9_COMPLETE_PRODUCT_FAIL`
