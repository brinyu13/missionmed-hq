# B1-511 Search and Rerender Defects

## Defects

The Library search path previously allowed broad rerenders to compete with
typing and row controls. That could interrupt composition/focus and made
priority interaction appear unstable.

## Bounded repair

`storyforge-v5/public/app.js` now keeps one renderer and one state authority.
Search is debounced, composition-aware, and updates only the results/suggestion
surface. Priority updates patch only the relevant row. No second renderer,
framework, store, or route was introduced.

## Verification

- Unit tests prove debouncing, composition safety, focus retention, and row-only
  mutation.
- The B1-511 browser test typed an uninterrupted query, retained it through a
  priority change, and received exactly one result.
- The controlled live student canary displayed `Search stories`, category
  controls, and `Sort: priority 5->1` from the canonical B1-511 asset, with no
  unavailable screen or Bootstrap Demo.

The first screenshot-evidence run exposed only a test-driver issue: an open
suggestion list correctly intercepted a different control. The evidence test
was corrected to dismiss/clear search before clicking the category; the rerun
passed 2/2. Production source was not changed for that test issue.
