# D1-405 Final Combined Handoff

Status: in progress — updated through M10

This document is maintained incrementally and is not a final-completion claim.

## Current candidate

- Canonical base: 407F / D1-404
- Branch: `d1-405-timeline-launch-refinement`
- M7 checkpoint: `18ab405`
- M8 checkpoint: `c622dbf`
- M9 checkpoint: `fae87de`
- Local preview: `http://localhost:8793/web/`
- Estimated completion: 88%

## Completed through M10

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
- Premium tactile horizontal Builder stepper with the approved composition
  unchanged.
- First-class Media destination with one local asset collection and shared
  Builder/Edit Timeline drag/drop.
- Five frozen themes with live student previews or clearly labeled example
  previews through the same renderer.
- Structured, versioned future admin theme package seam with permission,
  compatibility, asset integrity, preview, and safe-fallback boundaries; no
  executable theme content or production admin backend.
- Four explicit export audiences with progressive recipient fields,
  deterministic privacy rules, and identical preview/download filters.
- Canvas and Export theme focus containment/restoration, recipient-form focus
  continuity, explicit missing-name gating, and shared Canvas recipient-scope
  authoring.

## Current verification

- 522/522 tests passed: 119 TypeScript and 403 module tests.
- Typecheck passed.
- Package verification passed 23/23.
- Deterministic build passed with 197 runtime files.
- Manifest SHA-256:
  `d7a1ed69e9a5ffda6ebb70d566265ec7a1801e4000013e8dce029a648d3798cc`.
- Fresh-browser console: zero warnings/errors.
- Miyamoto: PASS.
- Vitruvius: PASS after all six M10 findings were corrected.

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

## M10 autonomous accessibility adjustments

| Original token/treatment | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| Two-choice segmented audience control | Native four-option select with cyan indicator/focus and progressive labeled fields | Keep the explicit audience model compact, understandable, and keyboard-native | 11.2508:1 cyan on `#090E18` | Export audience |
| Light-shell `#565D66` micro-label candidate on dark 407F surfaces | 407F `#A9B7D0` dark-surface alias | Prevent dark-on-dark failure while preserving delegated Addendum 002 intent | 8.3411:1 on `#141D2D`; 9.3335:1 on `#0B111C` | Recipient labels/status |
| Unlabeled empty theme card and default active-check ink | Visible/accessibility `EXAMPLE TIMELINE`; `#191C21` on frozen gold | Prevent false student ownership and preserve the frozen gold token | 12.3478:1 on `#FFD76A` | Theme cards |

## M10 visual evidence

- `screenshots/D1-405-Founder-Steering-Builder.png`
- `screenshots/D1-405-Founder-Steering-Media.png`
- `screenshots/D1-405-M10-theme-previews-student-content.png`
- `screenshots/D1-405-M10-theme-previews-empty-example.png`
- `screenshots/D1-405-M10-export-interview-safe.png`
- `screenshots/D1-405-M10-export-lor-writer.png`
- `screenshots/D1-405-M10-export-professional-connection.png`
- `screenshots/D1-405-M10-export-mission-residency-alumni.png`
- `screenshots/D1-405-M10-export-theme-focus-modal.png`

## M11 entitlement/migration checkpoint

- One fail-closed entitlement contract supports Administrator, 360 membership,
  override, cohort, promotion, zero, numeric, unlimited, expiry, removal, and
  unavailable production authority.
- Existing data becomes read-only and is never deleted. Pending/denied new
  accounts cause zero persistence writes.
- All active and retained-shell direct writes route through explicit store
  capability checks; Export performs its own second preflight.
- D1-404 migration is additive, input-pure, idempotent, and preserves IDs,
  geometry, unknowns, themes, Advanced data, advisor data,
  specialty/interview data, history, versions, and Export state.
- Missing legacy LOR evidence is `unknown`, never submitted.
- Gate: 540/540 tests (119 TypeScript + 421 module), 16/16 focused
  entitlement/migration tests, 69/69 expanded changed-surface tests,
  typecheck, 23/23 verification, 198-file deterministic
  build, manifest
  `7242f0fb8b787935f8a7334e437fdc3335ad726158f3750a6cc0c96b6ac6cf0b`,
  fresh browser console zero errors.
- Final M11 specialist verdicts: Lorentz PASS, Darwin PASS, Vitruvius PASS.

### M11 autonomous accessibility adjustments

| Original | Replacement | Reason | Calculated contrast | Affected components |
|---|---|---|---|---|
| No access-state presentation | Compact 407F badge using `#A8E8C8` full and `#F3D997` read-only text | Expose entitlement without changing hierarchy/workflow | 10.2048:1 and 11.9919:1 | Header |
| Engineering-only access refusal | Persistent `#E8ECF2`/`#F3D997` read-only strip on `#151921` | Explain preservation and disabled actions before interaction | 14.8474:1 and 12.7278:1 | All routes |
| Active-looking controls after access loss | Native disabled plus `aria-disabled` and guarded re-projection | Remove false affordance while retaining readable content | Existing 407F control contrast retained | Builder, Canvas, Media, Intake, Advisor, Export |

## M11 visual evidence

- `screenshots/D1-405-M11-entitlement-administrator.png`
- `screenshots/D1-405-M11-entitlement-eligible-360.png`
- `screenshots/D1-405-M11-entitlement-zero.png`
- `screenshots/D1-405-M11-entitlement-numeric-one.png`
- `screenshots/D1-405-M11-entitlement-removed-read-only.png`

## Remaining

M12 through M13 remain: final accessibility/responsive hardening and the
complete final evidence package.

## Protected boundaries

No push, deployment, Matrix mutation, WordPress mutation, production
persistence, cloud-storage write, or production LOR task creation has occurred.
