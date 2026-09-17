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

## M6 — Core Info and medical-school registry

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 360/360 passed |
| Total | 479/479 passed |
| M6 dedicated registry suite | 7/7 passed |
| Related registry/data integration set | 19/19 passed |
| Canonical ID excludes accreditation sequence | Passed |
| Exact active program vs agency-only separation | Passed |
| Alias/location/country/MD-DO search | Passed |
| Inverted token index | Passed |
| Superseded crosswalk excluded from selection/analytics | Passed |
| Unlisted local normalization queue persistence | Passed |
| Work-authorization conditional validation | Passed |
| Combobox/listbox/focus/live-region source contract | Passed |
| Fresh-browser console after interaction | 0 warnings/errors |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 191 runtime files |
| Build manifest SHA-256 | `3101fed536242fdc0213c36d97722db2d4ee836b7876b16985897a908bf99f21` |
| `git diff --check` | Passed |

The ingestion evidence validates the raw snapshot, dataset, records payload,
aggregate accreditation response, manifest, and script hashes. No completeness
claim is made. The only remaining data issue is an external production
redistribution authority gate; it is not a local test failure.

## M7 — Exams and rotations

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 377/377 passed |
| Total | 496/496 passed |
| M7 final targeted exams/rotations/LOR/date/renderer gate | 31/31 passed |
| Scored pass/fail requires score | Passed |
| Awaiting/nonnumeric score exception | Passed |
| Invalid scored record excluded from projection/completeness | Passed |
| Automatic retake suppression/restoration persistence | Passed |
| Pinned specialty order and normalized IDs | Passed |
| Unsupported specialty free text blocked | Passed |
| Exact-day formatted display/save round trip | Passed |
| Rotation date-order validation | Passed |
| LOR durable `statusId` reconstruction | Passed |
| Rotation/target-specialty isolation | Passed |
| Star and conditional legend across five themes | Passed |
| Local queue idempotency and non-destructive failure | Passed |
| `productionCreated:false` truthfulness | Passed |
| LOR micro-label contrast regression | Passed; 9.7573:1 and 10.9957:1 |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 193 runtime files |
| Build manifest SHA-256 | `7cd64b9622180e2dc7a888025a4d69d7cdfe1475237ac00323a62cde2c43df48` |
| `git diff --check` | Passed |
| Fresh browser console | 0 warnings/errors |
| Browser persistence restart | Passed |
| Browser local LOR queue interaction | Passed; explicitly no production task |
| Miyamoto visual re-audit | PASS |
| Vitruvius functional/accessibility re-audit | PASS |

Browser testing exposed two defects before the final gate:

1. The exact-day field correctly displayed `Jun 9, 2025` but the save path
   accepted only the hidden ISO representation. The shared parser is now used
   at form serialization and the exact display/save round trip passes.
2. Durable LOR records serialize `statusId`, while the initial reconstruction
   path expected `status`. Reconstruction now accepts both input forms and a
   serialized-record restart regression passes.

The retained `npm run test:web` wrapper remains an inherited CommonJS/ESM
invocation mismatch and is not the D1-405 package verification command. The
authoritative `npm test`, `npm run typecheck`, `npm run verify`, and
`npm run build` gates all pass. This wrapper is recorded for the later
production-hardening milestone rather than represented as a product-test pass.

## M8 — Specialty timeline variants

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 385/385 passed |
| Total | 504/504 passed |
| Focused M7/M8/Media gate | 30/30 passed |
| Legacy target migration | Passed |
| Create/switch without factual duplication | Passed |
| Rename/remove safeguards | Passed |
| Last-variant protection | Passed |
| Pure active-variant projection | Passed |
| Variant visibility cannot elevate privacy | Passed |
| Specialty-keyed LOR star switch | Passed |
| Active export projection | Passed |
| Browser create/switch workflow | Passed |
| Fresh browser console | 0 warnings/errors |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 194 runtime files |
| Build manifest SHA-256 | `c7feeb1ac923b5b88eeca0a77dce19de9fdacd83c8943a27710b2faba8f17a42` |
| Miyamoto final re-audit | PASS |
| Vitruvius final re-audit | PASS |

Two earlier source-contract tests were updated to recognize the Founder-approved
variant bar above the horizontal steps and the active-variant export projection.
The underlying 407F composition and retained export adapter remain unchanged.

Specialist review exposed three interaction defects before final closure:

1. The protected final-variant Remove action lacked a visibly disabled state.
   It now uses a scoped dim/saturation/cursor treatment while native disabled
   semantics continue to block activation.
2. Variant dialogs initially lacked focus containment and switch rerendering
   destroyed select focus. Dialogs now trap focus, inert the background, close
   on Escape, restore the opener, and switching restores focus to the rebuilt
   select.
3. The legacy backdrop path initially bypassed specialty-dialog cleanup. A
   capture-phase handler now routes backdrop dismissal through the same trap,
   inert, modal, and opener cleanup. Live keyboard and pointer probes passed.

## M9 — Explanation and Interview Target tools

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 392/392 passed |
| Total | 511/511 passed |
| Focused M8/M9/Export/Advanced-board gate | 39/39 passed |
| Explanation create/update/move/resize/delete | Passed |
| Event/date/region/coordinate targets | Passed |
| Conditional hidden/disabled target semantics | Passed live |
| Inline validation and focus recovery | Passed live |
| Theme-aware card and leader serialization | Passed |
| Specific interview details and active-variant projection | Passed |
| Real WEBP file-chooser upload | Passed |
| Shared Media/blob persistence without duplication | Passed |
| Contain/crop and resize | Passed |
| Guided full-preview logo render | Passed; one guided layer |
| Matrix Calendar unavailable/local-fixture boundary | Passed |
| Default `Interview season` regression | Passed |
| Fresh browser console | 0 warnings/errors |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 196 runtime files |
| Build manifest SHA-256 | `857fd5364a5d2eabec04cfd5b19b99833fea0ea7b247e4789771dfd06382dbfa` |
| Miyamoto final re-audit | PASS |
| Vitruvius final re-audit | PASS |

The inherited `npm run test:web` command remains a dormant 410-era runner:
its CommonJS file is invoked as ESM and its body is hard-coded to the unrelated
`MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401` authority and evidence
paths. It was not modified or executed through a workaround because doing so
would cross the D1-405 no-touch boundary. The current candidate is validated by
the active 511-test package suite, live in-app browser checks, typecheck,
23 package gates, and the deterministic build.

## M10 — Themes and explicit export audiences

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 403/403 passed |
| Total | 522/522 passed |
| Five frozen theme regressions | Passed |
| Student-content theme previews | Passed live |
| Empty-account labeled examples | Passed live |
| Same canonical renderer for both preview sources | Passed |
| Structured admin package validation | Passed |
| CSS/JS/HTML/executable rejection | Passed |
| Permission, asset digest, compatibility, version advance | Passed |
| Unknown-theme safe fallback | Passed |
| Four explicit audience policies | Passed |
| No user-facing `Everything` audience | Passed |
| Recipient-detail progressive disclosure | Passed live |
| Required-detail export gate | Passed |
| Missing-student-name export gate | Passed |
| Recipient-detail focus preservation | Passed live |
| Canvas/Export theme focus and Escape restoration | Passed live |
| Export modal focus trap, inert background, backdrop close | Passed live |
| Canvas recipient-scope authoring | Passed |
| Empty-example LOR legend in all five themes | Passed |
| Hidden/student-only exclusion | Passed |
| Explicit advisor-only audience scopes | Passed |
| Preview/download input identity | Passed |
| Founder Builder/Media steering regression | Passed |
| Fresh browser console | 0 errors |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 197 runtime files |
| Build manifest SHA-256 | `d7a1ed69e9a5ffda6ebb70d566265ec7a1801e4000013e8dce029a648d3798cc` |

The Canvas and Export theme-opening paths initially depended on the old exact
`data-theme-picker hidden` attribute order. Adding the preview-source
attribute exposed that brittleness during browser review; both paths now remove
only the picker’s final `hidden` attribute with a bounded root-div expression.
The corrected cards were then verified in populated and clean-origin browsers.

Vitruvius then identified six bounded hardening gaps in focus ownership,
recipient-form continuity, name gating, recipient-scope authoring, and the
empty-example legend. All six were corrected, covered by regression tests, and
verified in the live browser before the complete 522-test gate was rerun.
Final M10 Vitruvius re-audit: PASS.

## M11 entitlement and migration gate

| Check | Result |
|---|---|
| Functional TypeScript suite | 119/119 passed |
| Browser/module suite | 421/421 passed |
| Total | 540/540 passed |
| Focused entitlement/migration suite | 16/16 passed |
| Expanded changed-surface suite | 69/69 passed |
| Administrator and eligible 360 | Passed |
| Global disabled and explicit override allow/deny | Passed |
| Zero with existing/no existing data | Passed |
| Exact numeric and unlimited allowances | Passed |
| Expiry, removal, ineligible | Passed |
| Production unavailable/malformed fail-closed | Passed |
| Pending/denied bootstrap zero writes | Passed |
| Direct version/sync/blob bypasses blocked | Passed |
| Exact-limit clean origin and numeric-zero override | Passed |
| Trusted principal/issuer/audience/membership binding | Passed |
| Pre-expiry checkpoint concurrency and event-loop stall | Passed |
| Canvas mid-drag/keyboard/submit revocation | Passed |
| No destructive effects on access change | Passed |
| Export model and second preflight | Passed |
| Migration input purity and idempotence | Passed |
| IDs, geometry, unknown category/fields | Passed |
| Themes, Advanced, advisor, specialty/interview, Export state | Passed |
| Missing LOR evidence remains unknown/not submitted | Passed |
| Live Administrator/360/zero/numeric/removed states | Passed |
| Fresh removed-access browser console | 0 errors |
| Typecheck | Passed |
| Package verification | 23/23 passed |
| Deterministic build | Passed; 198 runtime files |
| Build manifest SHA-256 | `7242f0fb8b787935f8a7334e437fdc3335ad726158f3750a6cc0c96b6ac6cf0b` |

Lorentz and Darwin audits exposed the bootstrap default, async/direct-write
bypasses, migration-lineage risks, unknown-category loss, and transient Export
state. Their final re-audits passed after strict production binding, exact-limit
denial, synchronous pre-expiry persistence leasing, and dynamic-revocation
guards were added. Vitruvius's final read-only semantics/focus re-audit also
passed. The active 407F and retained inactive shell now share the corrected
store/policy boundaries. The complete gate passed after those corrections.
