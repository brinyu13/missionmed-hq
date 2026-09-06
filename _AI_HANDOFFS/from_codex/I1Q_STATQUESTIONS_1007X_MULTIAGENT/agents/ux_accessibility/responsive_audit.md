# I1Q-1007X Responsive Baseline Audit

## Verdict

**BLOCK for responsive certification of the I1Q-1006 candidate.** The stylesheet includes desktop, tablet, and mobile rules, but the supplied evidence does not reproducibly prove reflow, non-overlap, or complete workflow usability.

## Snapshot Boundary

Initial authority and MMOS observations occurred before later Root Supervisor recovery and registration. They are historical only and are not current responsive-release blockers. This verdict concerns the 1006 UI and its evidence.

## Evidence Set

- Claimed viewport widths: 390, 1024, and 1440 pixels.
- Claimed checks: 12 workflows across three widths, zero page overflow, zero console warnings/errors.
- Supplied captures: 12 desktop, 3 tablet, and 4 mobile images.
- CSS breakpoints: 1100 and 760 pixels.
- No committed browser runner, raw viewport log, DOM geometry report, browser/version identity, zoom identity, or screenshot checksum manifest.

The claimed viewport results are written as constants by `scripts/generate_evidence.mjs`; they are not derived from a checked-in run artifact.

## Visual Findings

### RESP-01: Mobile navigation requires undisclosed horizontal scrolling

At widths below 760 pixels, all 12 navigation buttons are placed in one horizontally scrolling row. The supplied captures often show partial labels at both edges and do not consistently expose the active destination. There is no scroll affordance, previous/next control, menu alternative, or proof that the active item is brought into view.

Impact: discoverability, keyboard operation, reflow, and novice task orientation.

### RESP-02: Supplied captures show right-edge truncation

Several mobile and tablet captures visibly cut headings, blocker text, transcript text, fields, or table content at the right edge. Desktop release, diff, and incident captures also omit material right-side content. Whether this arose from viewport overflow, zoom, capture configuration, or scroll position, it prevents a responsive pass.

Impact: evidence is insufficient to support the stated zero-overflow result.

### RESP-03: Screenshot provenance is incomplete

Sampled files with `.png` names contain JPEG bytes. The screenshots are not listed in `evidence/artifact_checksums.json`, and the evidence does not record browser, device scale, page zoom, scroll position, full-page versus viewport capture, or command identity.

Impact: visual evidence cannot be tied reproducibly to the release candidate.

### RESP-04: Coverage omits critical widths and zoom modes

No evidence covers 320 CSS pixels, 360 pixels, landscape mobile, 768 pixels, 1280 pixels, 200% zoom, 400% reflow, or text-spacing overrides. Only four mobile and three tablet screenshots exist for 12 workflows.

Impact: the majority of required workflows have no narrow-layout visual evidence.

### RESP-05: Dense content relies on local horizontal scrolling

Tables use horizontal overflow containers, which may be appropriate for genuinely two-dimensional data. The evidence does not test keyboard access to those regions, sticky context, row/column comprehension, or whether non-tabular controls also overflow.

Impact: power-user and assistive-technology workflows are unverified.

### RESP-06: Long and dynamic content is absent

The app uses one short synthetic source, one candidate, short labels, and a short transcript. It does not test long medical stems, long choices, long citations, hashes, multilingual names, large queues, numerous blockers, conflict messages, or real transcript lengths.

Impact: layout stability under representative content is unknown.

## Required Retest Matrix

| Mode | Minimum widths or settings | Required coverage |
| --- | --- | --- |
| Mobile portrait | 320, 360, 390 | All workflows and all required states |
| Mobile landscape | 568, 667, 844 | Navigation, authoring, review, diff, release, incidents |
| Tablet | 768, 820, 1024 | All workflows; split and collapsed layouts |
| Desktop | 1280, 1440, 1920 | All workflows; long-content and large-queue fixtures |
| Zoom | 200% | All workflows without clipped controls or inaccessible navigation |
| Reflow | 400% at 1280-equivalent viewport | 320 CSS-pixel acceptance, except essential two-dimensional data |
| Text spacing | WCAG override values | No clipping, overlap, or loss of controls |
| Reduced motion | OS preference enabled | No required information depends on motion |

## Acceptance Criteria

- No body-level horizontal scrolling at any required width or zoom.
- Horizontal scrolling is limited to essential two-dimensional data regions and is keyboard operable.
- Active navigation is visible, named, and reachable without pointer-only gestures.
- No heading, banner, label, field, button, status, hash, or error message is clipped or overlapped.
- Focus remains visible and unobscured after scrolling and responsive transitions.
- Dynamic content does not resize fixed controls or shift critical actions unexpectedly.
- Long representative content wraps or truncates only with an accessible full-value mechanism.
- Screenshot files use truthful extensions, have SHA-256 entries, and carry run metadata.
- Geometry and console results are generated from the browser run, not written as constants.

## Gate Result

The 1006 responsive result cannot support State C. A new reproducible matrix must pass after workflow completion and responsive repairs, followed by independent visual inspection of every required width and state.
