# D1-404 Complete Combined Handoff

Status: implementation in progress

Branch: `d1-macprotimeline-uxr-002`

Remote mutations: none

Matrix mutations: none

Production writes: none

## Authority

- D1-404: `/Users/brianb/Downloads/D1-404_CODEX_407F_UPGRADE_AND_PRODUCTION_MEGARUN.md`
  - SHA-256: `b318e9da82a45c187725a6439fa042e0cab54af4973a5d5c7fdb6b5974c63db4`
- Canonical 407F presentation:
  `/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html`
  - SHA-256: `23e0f5d420b69cd90da3f04b30e5752183aff41c737860ec30fc4ccbb87beb6b`
- Functional authority:
  `/Users/brianb/Downloads/D1-UXR-001-TimelineBuilder-DesignFreeze_1.md`
  - SHA-256: `f089f62f291a757393187c0c3fd400541a1514479b2ba074f37f070d389e6552`

## White-UXR halt

The prior white-shell runtime activation was halted because D1-404 explicitly
supersedes it. Its shell-agnostic logic, persistence, adapters, services, and tests
remain available as engineering sources, but `web/index.html` does not load
`web/js/app.js`, `web/styles.css`, `web/js/uxr-002/app.js`, or
`web/styles/uxr-002.css`.

## Milestone log

### M0 — canonical recovery

- Restored the exact canonical 407F bytes to the active runtime.
- Verified `http://127.0.0.1:8793/web/` in the in-app browser.
- Verified Home → Guided Builder → Home navigation.
- Console warnings/errors: 0.
- Test baseline: 371/371 (119 TypeScript + 252 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M0-canonical-407f-restored.png`
- Visual verdict: pass — immediately recognizable as canonical dark 407F.
- Commit: `d5126f8`

### M1 — four-destination 407F shell

- Reduced the canonical rail from 11 destinations to exactly Home, Builder,
  Canvas, and Export.
- Removed the XP/MP/level/avatar HUD, legacy header telemetry, Draft Status
  telemetry panel, and rail footer.
- Added the local `← Matrix` stub, preserved Timeline//S1 identity, added a
  live autosave state, and implemented zero-event Export disable semantics.
- Exposed one narrow 407F runtime seam and activated the shell-agnostic
  engineering adapter without loading the white UXR entry or stylesheet.
- Preserved prior local timeline data through the adapter.
- Browser rail/runtime assertion: pass.
- Console warnings/errors: 0.
- Test baseline: 374/374 (119 TypeScript + 255 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M1-four-destination-407f-shell.png`
- Visual verdict: pass — same dark 407F world, angular gold rail, premium depth,
  Archivo/Rajdhani character, and Keynote-derived energy.
- Commit: `fcde6fb`

### M2 — three-region Home

- Rebuilt Home as exactly three 407F-styled regions in the frozen 7/5/12-column
  layout: Build your timeline, Start from your CV or MyERAS, and Your timeline.
- Applied all verbatim five-second-contract copy.
- Added empty/ghost, resume, pending-intake, advisor-approved, live-preview, and
  start-over/version states without loading demo data into the student's draft.
- Browser semantic hierarchy: pass — one H1, two H2 region titles.
- Console warnings/errors: 0.
- Test baseline: 377/377 (119 TypeScript + 258 module tests).
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M2-three-region-407f-home-desktop.png`
- Visual verdict: pass — the clearer Home hierarchy remains inside 407F's dark,
  layered, angular, premium visual system.
- Commit: `114dc37`

### M3 — seven-step Builder shell and Core Info

- Rebuilt Builder as the frozen three-zone 407F layout: fixed 264px vertical
  stepper, centered form column, and right-side live preview.
- Added the exact seven step titles, purpose copy, free step navigation, and
  complete/started/skipped/empty state glyphs.
- Implemented Core Info in frozen field order with required validation,
  flexible month parsing, country selection, degree selection, optional visa
  status, and canonical Education milestone projection.
- Persisted wizard and Builder state through the retained engineering adapter.
- Browser semantic/runtime assertion: pass — seven step buttons, one current
  step H1, sticky Back/Continue controls, and live preview.
- Console/runtime errors observed during browser validation: 0.
- Regression evidence: 381 tests pass when the nine performance tests are
  isolated from the functional/module run (110 TypeScript functional + 9
  performance + 262 module tests). The default all-at-once run produced
  load-sensitive wall-clock misses in pre-existing autosave benchmarks while
  all correctness assertions and the isolated 9/9 performance run passed.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M3-seven-step-407f-builder.png`
- Visual verdict: pass — the form hierarchy and live preview remain immediately
  recognizable as the canonical dark 407F product.
- Commit: `5f2b3e6`

### M4 — Exams workflow

- Connected the retained, tested exam workflow to the canonical 407F Builder
  through the engineering adapter; no parallel exam state machine was created.
- Implemented independent USMLE and COMLEX-USA system cards, add-via-chip exam
  creation, score/result-first card hierarchy, date fields, score visibility,
  deletion, and the exact Step 2 skip behavior.
- Preserved automatic attempt numbering and the failure transition: neutral
  failed dot, automatic retake card, linked hatched study period, dashed
  provisional outline, Set retake date action, and solid closure on retake date.
- Persisted exam records, selected systems, projected events, and workflow
  metadata through the retained local engineering store.
- Browser interaction assertion: pass — both exam systems can be active
  independently; COMLEX chips appeared while USMLE stayed active; the temporary
  COMLEX selection was returned to its original state.
- Browser semantic assertion: pass — one Exams H1, system fieldset, Added exams
  H2, frozen field order, automatic-card label, and failed-attempt signal.
- Regression evidence: 110/110 TypeScript functional tests and 266/266 module
  tests pass. The nine pre-existing performance tests remain load-sensitive:
  correctness assertions pass, but one wall-clock autosave threshold missed
  during the M4 loaded runs; the same nine-test suite passed 9/9 at M3 and no
  persistence/performance implementation changed in M4.
- Typecheck: pass.
- Package verification: 23/23.
- Screenshot:
  `screenshots/M4-exams-407f-workflow.png`
- Visual verdict: pass — the exam workflow reads as a native extension of the
  dark 407F Builder rather than an imported white-shell component.
- Commit: pending local milestone commit

## Verification gates

| Gate | Current result |
| --- | --- |
| Regression floor | PASS — 385-test inventory; 376 non-performance tests pass and the 9 performance tests are tracked separately; required floor 370 |
| TypeScript | PASS |
| Package verification | PASS — 23/23 |
| M0 browser smoke | PASS |
| M0 console | PASS — 0 warnings/errors |
| Full functional acceptance | In progress |
| Full visual acceptance | In progress |
| Persistence restart | In progress |
| Keyboard-only accessibility | In progress |
| Automated accessibility | In progress |
| Responsive breakpoint matrix | In progress |
| Production build | In progress |

## Rollback

| Milestone | Commit | Exact rollback command |
| --- | --- | --- |
| M0 | `d5126f8` | `git revert d5126f8` |
| M1 | `fcde6fb` | `git revert fcde6fb` |
| M2 | `114dc37` | `git revert 114dc37` |
| M3 | `5f2b3e6` | `git revert 5f2b3e6` |
| M4 | pending local milestone commit | pending |

## Precedence resolutions

1. D1-404 revokes the white/light shell direction but preserves the functional
   requirements and shell-agnostic engineering.
2. The canonical 407F `MM-CAM-THEME-D-001` tokens govern app chrome.
3. The original white-shell contrast addenda remain historical engineering evidence;
   new 407F work is independently contrast-tested against the dark theme.

## Founder decisions needed

None.

## Run and verify

```sh
cd /Users/brianb/MissionMed_worktrees/D1-MacProTimeline-UXR-002/packages/mission-timeline
npm run serve
npm test
npm run typecheck
npm run verify
```
