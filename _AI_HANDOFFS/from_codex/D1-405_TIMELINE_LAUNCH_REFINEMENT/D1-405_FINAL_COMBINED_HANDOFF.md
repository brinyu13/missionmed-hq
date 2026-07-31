# D1-405 Final Combined Handoff

Status: in progress — updated through M9

This document is maintained incrementally and is not a final-completion claim.

## Current candidate

- Canonical base: 407F / D1-404
- Branch: `d1-405-timeline-launch-refinement`
- M7 checkpoint: `18ab405`
- M8 checkpoint: `c622dbf`
- M9 checkpoint: pending milestone commit
- Local preview: `http://localhost:8793/web/`
- Estimated completion: 84%

## Completed through M9

- MissionMed branding and clearer Edit Timeline navigation.
- File Vault-first Home with truthful local integration boundary.
- Premium horizontal Builder workflow.
- One primary editor column with a larger proportional interactive right
  preview and full-preview lightbox.
- Shared accessible month/year and exact-day controls.
- Normalized medical-school registry and conditional work authorization.
- Shared local Media destination and Builder/Edit Timeline drag/drop.
- Required scored-exam validation and durable retake workflow.
- Normalized specialty selector with Founder-pinned common specialties.
- Exact clinical rotation dates.
- Specialty-aware rotation LOR statuses.
- Accessible submitted-star and legend in all five themes/export serialization.
- Truthful local-only LOR Builder command queue.
- Normalized target-specialty timeline variants over one factual history.
- Undoable/autosaved create, switch, rename, guarded remove, and per-variant
  hide-only presentation settings.
- Active-variant Builder, Edit Timeline, theme, LOR, and Export projection.
- Focus-contained create/rename/remove dialogs with inert background, Escape and
  backdrop cleanup, opener restoration, and select-focus retention.
- Bounded Explanation authoring with event/date/region/coordinate targets,
  leader lines, direct move/resize controls, deletion, persistence, history,
  live preview, and Export serialization.
- General versus specific Interview Target configuration with program,
  specialty, exact date, location, and optional timeline label.
- Program-logo upload through the shared local Media/blob architecture with one
  stored asset, one variant reference, contain/crop, resize, positioning,
  remove/replace, persistence, Guided preview, and Export rendering.
- Truthful `Scheduled Interviews` Matrix Calendar adapter seam with an
  unavailable local runtime state and local-only fixtures.
- Conditional target panels, 44px logo target, focus-visible treatment, linked
  inline errors, live announcements, and invalid-control focus recovery.

## Current verification

- 511/511 tests passed: 119 TypeScript and 392 module tests.
- Typecheck passed.
- Package verification passed 23/23.
- Deterministic build passed with 196 runtime files.
- Manifest SHA-256:
  `857fd5364a5d2eabec04cfd5b19b99833fea0ea7b247e4789771dfd06382dbfa`.
- Fresh-browser console: zero warnings/errors.
- Miyamoto: PASS.
- Vitruvius: PASS.

## M7 accessibility decision evidence

The LOR micro-label received an autonomous implementation-level adjustment
under the Founder implementation authority:

- original: undefined style, body-sized white;
- replacement: 11px/650 `#75CFEA`;
- reason: restore hierarchy without changing product meaning or layout;
- contrast: 9.7573:1 on `#131B29`, 10.9957:1 on `#080D16`;
- affected component: rotation LOR card.

## M8 visual evidence

- `evidence/screenshots/D1-405-M8-variant-creation-workflow.jpg`
- `evidence/screenshots/D1-405-M8-two-variants-pediatrics.jpg`
- `evidence/screenshots/D1-405-M8-lor-star-internal-medicine.jpg`

## M9 autonomous accessibility adjustments

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Theme ink inherited on `#111827` Explanation cards | `#F4F7FF` on non-paper cards; `#191C21` on paper | Prevent dark-on-dark annotation text while retaining theme-aware paper treatment | 16.5528:1 on `#111827`; 17.0815:1 on white | Builder preview, full preview, Export Explanation cards |
| Browser-default blue checkbox/radio and dark date indicators | Frozen gold `#B98A2E` selection treatment and cyan `#75CFEA` date indicator/focus treatment | Restore 407F hierarchy and preserve non-color state semantics | 5.5364:1 gold on `#111B2C`; 10.5102:1 cyan on `#0B1321` | Explanation leader, interview-purpose radios, month/date pickers |
| Toast-only validation | Linked `role="alert"` errors in `#FF9F86`, `aria-invalid`, polite announcement, focus recovery | Make failures perceivable and operable without changing workflow or wording | 9.3466:1 on `#0B1321` | Explanation create/save and program-logo validation |

## M9 visual evidence

- `evidence/screenshots/D1-405-M9-explanation-creation.jpg`
- `evidence/screenshots/D1-405-M9-explanation-move-resize-leader.jpg`
- `evidence/screenshots/D1-405-M9-interview-specific-calendar-unavailable.jpg`
- `evidence/screenshots/D1-405-M9-calendar-unavailable.jpg`
- `evidence/screenshots/D1-405-M9-explanation-interview-export.jpg`
- `evidence/screenshots/D1-405-M9-control-polish.jpg`
- `evidence/screenshots/D1-405-M9-interview-control-polish.jpg`
- `evidence/screenshots/D1-405-M9-conditional-target-validation.png`
- `evidence/screenshots/D1-405-M9-program-logo-upload-resize.png`
- `evidence/screenshots/D1-405-M9-program-logo-full-preview.png`

## Remaining

M10 through M13 remain: export audience refinement, entitlement and migration
work, final accessibility/responsive hardening, and the complete final evidence
package.

## Protected boundaries

No push, deployment, Matrix mutation, WordPress mutation, production
persistence, cloud-storage write, or production LOR task creation has occurred.
