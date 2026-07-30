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
