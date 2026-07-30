# D1-405 Test Report

## M0 baseline

Starting commit: `771b8775b5007617335f7aface6e3772631a32d9`

| Check | Result |
|---|---|
| Functional TypeScript suite | 110/110 passed |
| Isolated performance suite | 9/9 passed |
| Browser/module suite | 320/320 passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed |

The production builder reported 185 files because it copied the ignored, user-owned `web/TimelineBuilder_v5.5_PreLaunch.html` alongside the canonical page. That copy is byte-identical to the restored canonical `web/index.html` at M0 and is not a D1-405 source authority.

## M2 Home and File Vault entry

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 324/324 passed |
| Total | 443/443 passed |
| M2 targeted Home/File Vault/renderer suite | 40/40 passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed |
| Fresh browser console | 0 warnings/errors |
| File Vault focus restoration | Passed |
| Small-span exact-sum render | Passed at 1, 2, and 3 normal years through deterministic allocation tests |
| Miyamoto visual review | PASS after correction and recapture |

M2 added four module tests for the fail-closed File Vault adapter and chooser. The inherited N<4 isolation expectations were replaced with positive coverage proving that one-to-three-year documents render while exact board width is preserved. The user-owned prelaunch HTML copy is now excluded from candidate packaging without being modified or deleted.

## M3 horizontal Builder workflow and composition

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 324/324 passed |
| Total | 443/443 passed |
| M3 targeted Builder/responsive/authority suite | 25/25 passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed; 185 runtime files |
| Fresh browser console | 0 warnings/errors |
| Horizontal keyboard navigation | Passed; Right, wrap 7→1, Home/End contract present |
| Rerender focus restoration | Passed |
| Persisted active-tab reveal | Passed without focus movement |
| Document overflow at 1440/1279/1024/1023 | None |
| Navigator overflow at 1024/1023 | Locally contained and active tab fully revealed |
| Miyamoto visual review | PASS |
| Vitruvius responsive/layout review | D1 PASS / D2 PASS |

One retained test still asserted the superseded lowercase `Review & finish` spelling. It failed once after the D1-405 capitalization correction, was updated to the approved `Review & Finish` requirement, and the complete final suite passed.

## M4 proportional interactive preview and lightbox

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 332/332 passed |
| Total | 451/451 passed |
| M4 dedicated Builder preview suite | 8/8 passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed; 186 runtime files |
| Build manifest SHA-256 | `69a2a3301892693b364c2a6eb288ad6726a6a2687e4f27bc1d691f3598c088b3` |
| Fresh browser console | 0 warnings/errors |
| Embedded preview ratio | 1.7778; 1920×1080 view box |
| Full-preview ratio | 1.7778; 1920×1080 view box |
| Zoom presets | Fit, 100%, and 150% passed |
| Enlarged preview overflow | Confined to one modal scrollport |
| Background inertness | Passed |
| Escape focus restoration | Passed |
| Core click-to-edit | Passed |
| Exact exam Enter-to-edit | Passed; focus lands on the exact attempt result control |
| Stale owner handling | Passed fail-closed |
| Miyamoto visual review | PASS |
| Vitruvius accessibility review | Initial FAIL for interview-marker order and initial tab stop; final PASS after correction |

One browser investigation exposed an overly broad SVG namespace replacement that changed canonical `data-event-id` values. The expression was constrained to actual `id` attributes and canonical IDs were re-proven in-browser. Specialist review then exposed two chronology defects: the interview marker was always ordered last, and the first rendered event retained `tabindex="0"` even when the interview was earlier. Both were corrected, a dedicated regression was added, and the full final suite passed.

## M5 shared date controls

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 340/340 passed |
| Total | 459/459 passed |
| M5 dedicated date-control suite | 8/8 passed |
| Exact parsing and leap dates | Passed |
| Ambiguous numeric date rejection | Passed |
| End-of-month month shifting | Passed |
| Legacy migration without fabricated days | Passed |
| Canvas exact-date move/resize synchronization | Passed |
| Shared Builder/Canvas integration | Passed |
| 44px/focus/gold-text styling contract | Passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed; 187 runtime files |
| Build manifest SHA-256 | `d3aa5b8a9b6b195e8d9bd2831d2dc500d7eab71d667830ef6764573a563093d3` |

Two retained static source tests initially expected the previous inline month inputs. They were updated to assert the shared-control semantic call while retaining the same frozen field order and `Started studying Optional` copy. The final complete suite passed.

## Founder steering — premium stepper and shared Media

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 353/353 passed |
| Total | 472/472 passed |
| Founder Media dedicated suite | 13/13 passed |
| Active five-item navigation authority | Passed |
| Same Builder/Canvas drag seam | Passed |
| Placement without record/blob duplication | Passed |
| Atomic metadata/blob upload | Passed |
| Upload failure rollback/no orphan | Passed |
| Undo retains source bytes | Passed |
| Existing Advanced asset visibility | Passed |
| Reduced-motion GIF suppression | Passed |
| Focus/live-region/dialog/44px assertions | Passed |
| Premium stepper state/hover/press/focus assertions | Passed |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic production build | Passed; 188 runtime files |
| Build manifest SHA-256 | `331d2984a7130090058767a30055e109369547e601ae0aaad9a42d62756d32e3` |

The first architecture review found a destructive mismatch: Media metadata deletion was undoable while its blob was immediately deleted. The UI deletion path was removed, upload became an atomic document/blob transaction, and explicit rollback/undo-byte-retention regressions now pass.

Darwin’s final architecture re-audit and Vitruvius’s final accessibility re-audit both returned PASS with no remaining blocker.
