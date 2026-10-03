# Historical earlier-phase evidence

This file concerns the earlier 3ab6923 candidate, not the current founder-decision candidate. Current independent review is INDEPENDENT_REVIEW.md at 7e5b631. Original raw sealed evidence remains in the prior template-locked local evidence directory and Git commitc1fc1b6.

# Independent repaired candidate recheck

SEALED. Independent Codex engineering/artifact review, not Fable 5.1. Specific model identity was not exposed by the invocation. No source/UI/provider/deployment/commit mutations were performed. All reviewer writes use this report or the permitted `independent-recheck-*` prefix.

## Result and custody

No remaining failure was reproduced in the bounded final recheck: **30 independent checks passed; 105 focused regression tests passed**. This is not whole-product acceptance, native visual acceptance or deployment authority.

Final reviewed commit: `17e2f273c19bbc02114b586eb6538525449a0f08`.

Final `CANDIDATE_FINAL_MANIFEST.json` SHA-256: `19ba3888c58a9d97fed1c7873b407b87431f70fcef4f3abf746c5e5ac07b97b6`.

All **456** listed source/test/asset files match the manifest; working tree source status is clean. `independent-recheck-source-final.json` records the exact verification. The initial packet target `76ca6c853c2ce6517e61db70a2f5518616697adf` also matched its 456-file manifest. The parent explicitly superseded that target with `464c40f...` and then final `17e2f273...`; the final independent script and focused tests ran again on the final target.

## Six prior findings

| Finding | Final independent result |
|---|---|
| Cross-document/audience cache reuse | Corrected for tested boundaries. Default and surface-only callers cannot retain fallback without full identity. Explicit document, owner, viewer, subject, audience and surface changes cannot reuse the old canonical or wrapper cache. Same bound identity retains a stale notice. Actual Home caller execution isolates viewer changes; Builder caller wiring supplies viewer/subject/surface. |
| Opaque profile occlusion | Corrected. The original full-card cover now raises `TIMELINE_EXPORT_TEXT_COLLISION`; Guardian emits a matching BLOCK_EXPORT finding. |
| Missing milestone institution | Safely blocked with `TIMELINE_EXPORT_MISSING_FIELDS`. The institution remains absent from the visible milestone layout, so this is a corrected false-success boundary, not completion of institution rendering. |
| Invented USA marker | Corrected for Canada, Australia and Singapore probes. No USA asset is inserted. The focused suite separately verifies explicit United States relocation. |
| Scene-only authored object loss | Safely blocked with `TIMELINE_SCENE_RECOVERY_REQUIRED`; saved objects and their values survive synchronization. This protects recovery rather than automatically repairing unsupported storage representation. |
| UNKNOWN precision presented as certain | Corrected. The SVG says `Date needed`, and final export raises `TIMELINE_EXPORT_INCOMPLETE` despite normalized coordinates. |

The cache boundary is implemented in `presentation/last-good-render-cache.js:45-51`. Milestone/UNKNOWN completeness checks are in `presentation/founder-presentation-serializer.js:372-381`. Scene recovery rejects unrepresented objects at `editor/scene-graph.js:185-193`.

## New preservation checks

The recheck found a new defect on the initial target: two exactly adjacent personal phases with lane locks 1 and 4 both drew at y=323 because automatic band joining used the first phase's lane. The parent repaired it in the final commit. The final reproduction confirms separate lane positions and no band separator. `locked-407f-export.js:230` now excludes locked lanes and explicit offsets from joining.

The final independent script also verifies:

- Rotated manual scene geometry `(785,603,387,31,13 degrees)` remains intact. The saved geometry, SVG rotation center and transformed path vertex match; no source mutation occurs. Resolved native paths use transformed envelopes, so an axis-aligned path envelope is not mistaken for lost rotation.
- Unlocked, monthly-adjacent personal phases remain connected with one separator. Gaps and overlapping phases do not join.
- An explicit text deletion removes only its target and preserves another annotation, scene-native event geometry and unchanged original input.
- The legacy deletion path fails closed when an unrelated orphan exists, preserving input. The scene-command deletion path succeeds while retaining and materializing the unrelated scene-only annotation in compatibility storage.
- A 47-event concurrent history retains all 47 visible event IDs but fails export with `TIMELINE_EXPORT_TEXT_OVERFLOW`.
- SVG rendering after JSON save/reopen is deterministic and does not mutate input.

The focused suite includes the restored exam-result/study-arrow relationship. Actual golden authority takes precedence over the earlier overbroad above-axis wording. No new visual grammar, chronology compression or content abbreviation was authorized or introduced by this review.

## Actual artifact checks

An independent synthetic valid document passes its final gate and creates a real PPTX with 24 native text shapes, 47 shapes, 9 groups and 5 images. Reinspection reports zero structural errors. Artifact: `independent-recheck-valid-export.pptx`.

The actual saved M05 and M09 PNGs were visually inspected. Twelve M05 rotations retain direct labels and institutions, and the long M09 institution wraps near its arrow. Empty profile/photo/interview placeholders remain. This observation does not settle the contract's undefined missing-furniture policy or certify sendability.

The saved M05 and M09 PPTX files each contain one slide and editable native text/shapes. M05 has 56 native text shapes, 100 shapes and 5 images; M09 has 23 native text shapes, 45 shapes and 5 images.

Exact browser artifact SHA-256 values inspected:

| File | SHA-256 |
|---|---|
| M05-png-1920x1080.png | `b0cf1bddc1adcad620eaa6241feaf0e67d9b0071934b0a870600523790ccdea2` |
| M05-pptx-editable.pptx | `55ed0c4d7c27240ec6be2d2a6e5d819eb6598837d7a5c879fac4696f00407b34` |
| M09-png-1920x1080.png | `42e6bd3b29ea9a4918d354ab186e10a5ec96a71bbb7b53474cf50a12f996533b` |
| M09-pptx-editable.pptx | `6c7204fa84b9b58f30f8c2c3b2bd57ce0aca971c181973a08ebf392d3af0cf17` |

These preexisting saved files are bound by their own hashes, not assumed to be generated by final HEAD. Detailed structure/text evidence is in `independent-recheck-browser-artifacts.json`.

## Commands and limits

```sh
node .timeline-recovery-20261002/template-locked/independent-recheck-tests.mjs
node --test packages/mission-timeline/tests/d1-023-*.test.mjs packages/mission-timeline/tests/d1-024-*.test.mjs packages/mission-timeline/tests/d1-021-founder-fidelity-deltas.test.mjs packages/mission-timeline/tests/d1-021-editable-pptx.test.mjs packages/mission-timeline/tests/d1-reanchor-global-builder.test.mjs
```

Independent results: `independent-recheck-results.json` and `independent-recheck-tests.log`. Focused suite: `independent-recheck-focused.log`. Exact report/evidence hashes: `independent-recheck-evidence-manifest.json`.

No browser/native UI was used. No actual PowerPoint/Keynote open, editing, font resolution or native rendering was performed by this reviewer. Earlier point-size mapping and color-management questions remain native acceptance limits, not resolved by OOXML validity. No provider, production authorization, download-delivery, whole-product privacy or Fable-equivalence claim is made. Stop after sealed report; no commit authorized or created.

## Sealed final occlusion addendum

This addendum supersedes the earlier source target for the narrow final check. Reviewed commit: `e0b92feab2411d6f3bb9e656c452dda3d29ddbf0`. Final manifest SHA-256: `e7e92a61db8da3cb727b89ba629bb3fbbc7cc655d15fc92f727f0dc3f10f449f`. All 456 manifest entries matched at the start of this follow-up. At sealing, the parent had begun the announced palette correction: three manifest files had changed (`d1-024-template-lock.test.mjs`, `founder-keynote-contract.js`, `locked-407f-export.js`). Exact expected/actual hashes are in `independent-recheck-final-seal-drift.json`. No source changes were made by this reviewer. The 30-check and 138-test runs preceded this palette work; the last six-case supplemental rerun may include those palette edits and is not an exact-commit acceptance claim.

The unchanged prior sealed report is retained as `independent-recheck-prior.md`, SHA-256 `b821ce4adbc5511b515f6417edca6fea6456bdcde19d6dfd5cab9fc9a3d26868`.

**Result: six supplemental checks pass, all 30 independent recheck checks pass, and 138 focused tests pass. No new failure was reproduced in this bounded follow-up. The later palette working-tree drift prevents final source-freeze acceptance until its announced separate check.**

- M06 now fails final export with `TIMELINE_EXPORT_TEXT_COLLISION`. The independently resolved pairs are the research and work arrows against `furniture:color-key`. Guardian returns a matching BLOCK_EXPORT finding. The text-only proxy finds zero collisions, directly demonstrating the additional shape coverage. This gate blocks the output; it does not claim to fix the layout.
- A separate synthetic manual arrow with a 13 by 10 pixel opaque cover over only its tip also fails the new gate, while its text-only proxy has zero collisions. Intentional text-on-arrow layering within the same event still passes.
- M05 and M09 still pass final export, with no material collisions; their final SVGs remain deterministic and leave source documents unchanged.
- The export-test fixture correction changes duration dates to isolate audience and delivery behavior. It leaves audience scopes, assertions, event identities and recipient policy intact. The new M06 regression and the independent tip-cover case retain negative coverage of unsafe overlapping geometry. No runtime privacy policy changed in that fixture correction.
- The historical synthetic Rescue file remains bound to SHA-256 `0e72230af2ae328f68bdcc027eabc4d5212e4eef4b7bc621c95b0137f298c110`. The actual hydrated state has exactly one unclassified candidate, with `canonicalType: UNCLASSIFIED` and `mappingReviewRequired: true`. Running the real intake state-machine flow without confirmation merges 8 and leaves one unclassified; explicit test review assigning research plus `categoryConfirmed: true` merges all 9. The correction models review input instead of teaching reload to infer a category. The test retains its source-hash and existing-fact assertions.

Evidence and exact reproductions: `independent-recheck-final-addendum.mjs`, `independent-recheck-final-addendum-results.json`, `independent-recheck-final-addendum.log`, and four `independent-recheck-final-*.svg` artifacts. Final full recheck log: `independent-recheck-final-full.log`. Final source binding: `independent-recheck-final-addendum-source.json`.

The 138-test command extends the previously recorded focused command with `packages/mission-timeline/tests/d1-022-rescue-import-type.test.mjs` and `packages/mission-timeline/tests/uxr-002-export.test.mjs`; log: `independent-recheck-final-focused.log`.

No new browser or native UI inspection occurred. These results do not close native font/color fidelity, undefined template policy, whole-product acceptance or release authority. Any later palette change requires a separately bound check. Stop after this sealed addendum; no commit was created.

## Sealed final palette review

Reviewed source target: `4666e157713c8b8ab016f3fa6cc50dd834778a44`. Manifest SHA-256: `60113c96e80981285b1d1152b712da92c4294ad19c6d3c3cc4902e5b2d73ec8e`. All 456 manifest files matched at the starting check (`independent-recheck-palette-source.json`, saved 2026-10-03 00:20:26Z). The report immediately before this append had SHA-256 `f09e77545c1f8fd38b9c8a2368e5b4e1fa80eb188beff44d4e52cf856631ab32`.

**Result: no remaining failure reproduced within the bounded palette check. All 30 independent checks, six supplemental occlusion/fixture checks, and 147 focused tests passed, with logs finalized by 00:22:47Z. M05/M09 still passed the final export gate; M06 still failed closed for filled-arrow occlusion. The working tree changed afterward, so this report does not certify the source present at sealing.**

At 00:27:36Z and again 00:28:17Z, final hash verification found new uncommitted drift in `packages/mission-timeline/web/js/uxr-002/locked-407f-export.js`: expected `60dce7d209289a9fe3db79968fe804e3c823acf414282ba1373af9b780e18e34`, actual `1b77038b759dfd9dadcc5db15d342a5c79232a01b402d75920d7a36b598d0c22`. Its filesystem modification time was 00:25:44Z, after the test logs. The new delta adds automatic nonuniform year weights and collision-scored composition. This is outside the requested palette follow-up and has not been accepted by this reviewer. Exact drift is retained in `independent-recheck-palette-seal.json`; no source change was made by this reviewer.

### Independent golden color verification

The private golden PNG remains SHA-256 `bf48d25b2d46a75c868f98692d480147f8c7d8f234955608a27ca50b3b808836`. Its embedded ICC profile identifies Display P3 and has SHA-256 `0ff6958f98684c61f6bbdce1368ddeaf3873baf84545baba482e920d92a914c0`. I independently read that embedded profile and converted actual flat legend pixels in memory with Pillow ImageCms to sRGB, using the default perceptual intent. All six exact converted values match the committed defaults:

| Category | Golden-derived sRGB |
|---|---|
| Work | `#00882B` |
| Personal | `#763F9B` |
| Exams | `#0565C0` |
| Clinical hospital | `#DF6A0F` |
| Clinical clinic | `#F49018` |
| Research | `#DCBE23` |

Sample coordinates, original Display P3 channel values, converter identity and results are in `independent-recheck-palette-icc-results.json`; reproduction is `independent-recheck-palette-icc.py`. These are color-managed raster measurements, not recovered native Keynote fill values. An attempted optional Swift/AppKit conversion could not execute because the local compiler and SDK versions differ; it provides no evidence and is not the basis of this result.

### Labels, pennants and exam exception

Source review and the passing focused tests verify white labels inside arrows, gray general pennants (`#A6AAAE`) with white dates at SVG font size 18, and preserved explicit exam-result flags attached below the ribbon to study arrows. Explicit Passed/Failed results retain green/red flags; score/title text alone does not imply a result. The palette change does not remove the study-linked geometry exception. Previously sealed manual geometry, locked personal lanes, adjacent personal bands, intentional deletion and six defect checks all passed again before the later axis delta.

### Regenerated artifact evidence

Both actual 1920 by 1080 M05/M09 PNGs were visually inspected read-only. Their six legend samples exactly match the new palette. M05's 12 clinical rows remain visible; M09 retains the full wrapped institution next to its arrow. Existing empty profile/photo/interview placeholders remain; this does not resolve the template's undefined missing-furniture policy or certify sendability.

Read-only inspection of the actual PPTX archives found one slide each and native editable text: 56 text shapes for M05, 23 for M09. All 12 M05 `IM elective` arrow labels and the M09 arrow label have native run fill `FFFFFF`. Those runs retain the existing 13.5-point mapping from 18 SVG pixels. No native application font/rendering acceptance is claimed.

| Saved artifact | Modified UTC | SHA-256 |
|---|---|---|
| M05-png-1920x1080.png | `2026-10-03T00:19:43.178926+00:00` | `3cb12413625fa93220d7bec213e2ca4aafada4f5d2d0f36cab78e92f73220b4b` |
| M05-pptx-editable.pptx | `2026-10-03T00:19:43.445529+00:00` | `fa2b1648470276a446e488a3666ac9574bc0f668aecf399bbbbd9c166cf1071b` |
| M09-png-1920x1080.png | `2026-10-03T00:19:44.387050+00:00` | `6855ed956ce8ac71b87926ede39b645a861077c46a15d66ccdeaabac8f064b6f` |
| M09-pptx-editable.pptx | `2026-10-03T00:19:44.561237+00:00` | `c879304cb1146c7d16644bfc996e63c87e8ca7cb1321c8975393006ba4b6a8f4` |

All four artifacts are newer than the requested `2026-10-03T00:19Z` threshold. Exact readback is recorded in `independent-recheck-palette-artifacts.json`; hashes remained unchanged when this addendum was written.

### Tests and scope limits

The 147-test command extends the prior focused command with `packages/mission-timeline/tests/d1-founder-reanchor-presentation.test.mjs`. Logs are `independent-recheck-palette-focused.log`, `independent-recheck-palette-full.log` and `independent-recheck-palette-occlusion.log`. Reviewer report/evidence file hashes are in `independent-recheck-evidence-manifest.json`.

This is an independent engineering and saved-artifact review, not Fable 5.1 or native visual acceptance. No browser/native UI interactions, provider actions, source/test edits, deployments or commits were performed by this reviewer. No claim is made about native Keynote fill metadata, native app font resolution, whole-product privacy/acceptance, download delivery or production authorization. Previously recorded fail-closed recovery and missing-field/layout constraints remain constraints, not repaired-layout claims. The reviewer stops after this seal; the later axis-weight change requires a separately authorized and bound review.

## Sealed density follow-up — 632cf0b

Reviewed commit `632cf0b455a1b676fb3ec2a005dde9187fc436de`; manifest SHA-256 `485e6d08133070dc48e5872462ddb21cf18c493aea186280841467a056a8e468`. All 456 source entries match at both initial verification and final seal; package git status is clean. This review binds the density delta previously excluded from the palette seal. Prior report SHA-256 before this append: `bf1dee0467ccf3853a5e5b76753850dbe742948eb68e6a96d1d4d6241db8699e`.

**Result: changes required. The new automatic geometry improves the tested dense output, but its emitted axis weights disagree with the existing editor's weight semantics and cause a reproducible boundary-drag jump. This is independent engineering evidence, not native visual acceptance or Fable.**

### [P2] Automatic axis weights make a small editor drag jump in the opposite direction

`locked-407f-export.js:125-130` distributes width as an 80-pixel base plus a proportion of the remaining width, then `axisMarkup` at line 364 exposes the original density weights through `data-axis-segment-weight`. The existing pointer consumer in `407f-engineering-adapter.js:8237`, `:8606` and `:8812` treats those values as direct width ratios. The manual metrics path also uses direct proportional weights. Consequently the first edit changes the mapping, including untouched years.

Read-only reproduction: `independent-recheck-density-axis-consumer.mjs`. It renders synthetic M03 in Advanced mode, uses the exact existing pointermove arithmetic, then calls the actual `setAxisPresentationOverride` and `setAxisSegmentWeights` functions consumed by pointerup. No browser/UI was used. For a three-pixel rightward drag at the 2022/2023 boundary:

- Before: boundary x = 765.4157117378757.
- Drag preview calculation: x = 739.4421130140918, a **25.97-pixel move left**.
- Render after actual setter commit: x = 699.9949582483852, a **65.42-pixel move left**.
- Untouched 2021 cell changes width by -41.17 pixels; the 2025 boundary moves +21.76 pixels.
- Input document and event dates remain unchanged by the harness; this is a presentation interaction regression.

Exact measurements and consumer source hash: `independent-recheck-density-axis-consumer.json`; before/after artifacts: `independent-recheck-density-axis-before.svg` and `independent-recheck-density-axis-after.svg`. Recommended correction: emit/persist a single effective width model that all composition, hit/drag and manual-axis consumers interpret identically, and add a first-edit regression that checks both the requested boundary and untouched cells.

### Related composed-state and manual-geometry evidence

The serializer's returned scene is not the selected weighted composition. On M03, `locked407FMilestoneGeometry(rendered.scene, 'degree')` returns x = 167.2266666666667 while the actual SVG pole is at x = 155.01504245714625. This mismatch is recorded in `independent-recheck-density-probes.json`. `quality-guardian.js:617-618` consumes the helper during milestone reflow. A harmful Guardian outcome was not separately reproduced, so this helper discrepancy is not presented as a second proved end-to-end defect.

**Setting a milestone's manual scene geometry does disable automatic weighting.** The M03 `milestone-geometry-skips-automatic-weighting` probe adds one geometry record for the degree; all six emitted axis weights become 1. The same bypass holds for duration geometry, a lane lock, and nonzero duration x or y offset. This confirms the requested safeguard, but also means that creating the first manual geometry record can replace the previously displayed unequal axis with a uniform one. Any repair to composed-state handoff must decide how that first edit preserves the already displayed axis while continuing to honor explicit authored geometry; the current implementation does not retain that automatic axis state.

### Passing checks and bounded limitations

- The requested regression group passes **62/62**: `d1-024-*.test.mjs`, `d1-022-category-presentation.test.mjs`, and `d1-founder-reanchor-presentation.test.mjs`. Log: `independent-recheck-density-focused.log`.
- All **30 prior independent checks** and **six supplemental occlusion/fixture checks** pass again. Logs: `independent-recheck-density-full.log` and `independent-recheck-density-occlusion.log`.
- **14 independent density assertions pass**, covering M03 collisions, source immutability, determinism, chronology, M05/M09, M20, and manual axis/lane/geometry/offset bypass. Reproduction: `independent-recheck-density-probes.mjs`. One additional helper-coordinate record is diagnostic, not a passing assertion.
- M03 has zero material collisions. Its smallest year cell is 190.1115079435737 pixels. All duration starts and inclusive end widths agree with the chosen per-year scale to rounding tolerance, accounting for the existing 2%-98% content margins and existing 52-pixel minimum arrow width. The initial probe used edge-bleeding hit rectangles as date bounds; the corrected probe explicitly accounts for those established behaviors.
- Original M03 still fails `TIMELINE_EXPORT_MISSING_FIELDS` for the degree and exam institutions. A synthetic geometry-only copy with only those unsupported milestone fields removed passes; this does not claim that the original fixture exports successfully.
- M20 still fails `TIMELINE_EXPORT_TEXT_OVERFLOW`. Its saved diagnostic image visibly retains crowded/occluded content. The gate is truthful; the layout is not accepted.
- M05/M09 pass without material collisions and remain deterministic. Changed category-test literals exactly match the six independently measured ICC swatches already sealed; the education literal is unchanged, and this test change establishes no new seventh-category authority.
- **80 pixels is not a universal axis minimum.** A sparse synthetic 2000-2024 history with two milestones produces 25 cells, minimum width 73.6512 pixels, and passes the final gate. `independent-recheck-density-long-axis.mjs/json` records the reproduction. This is the preexisting uniform path, not a newly established regression; the packet's 80-pixel guarantee must be scoped to the checked fallback range rather than asserted for every history.
- The written template contract still says the exemplar does not establish a general automatic compression rule, and the source grammar still lists `automatic-year-compression` as undefined. This review verifies mechanics and does not independently settle whether the new heuristic is authorized as a general template rule.

### Refreshed artifact custody and inspection

The actual `final-matrix-receipt.json` was refreshed at `2026-10-03T00:34:52.585350+00:00`, SHA-256 `043629092668d1ae944cba21c1618157ef54b471c5edb28674d669a0c6fde845`. Its M03/M20/M05/M09 outcomes agree with the independent gate checks.

The refreshed M03/M20 diagnostic PNGs and M05/M09 1920-pixel exports were visually inspected read-only. M03 shows the wider busy years with distinct nearby labels and preserved text; M20 retains clear unresolved crowding. M05's 12 rows and M09's wrapped long institution remain legible. Both saved PPTX files contain one slide with native text/shapes: 56 text shapes for M05 and 23 for M09, and their elective arrow text has white native fill. No PowerPoint/Keynote interaction or native rendering was performed. Empty template furniture remains and does not certify sendability.

| Artifact | SHA-256 |
|---|---|
| M05-png-1920x1080.png | `3cb12413625fa93220d7bec213e2ca4aafada4f5d2d0f36cab78e92f73220b4b` |
| M05-pptx-editable.pptx | `33d01c5a4a0c1f0394ab0da5be4f8fba73009cbd25770384425c441d2e8d2635` |
| M09-png-1920x1080.png | `6855ed956ce8ac71b87926ede39b645a861077c46a15d66ccdeaabac8f064b6f` |
| M09-pptx-editable.pptx | `9af4e1114217b0891ef2765291f8f23b0578cd54fe94329ca4bcd0aadd590ee0` |
| M03-diagnostic.png | `34d0bb0b53d8a1b29e4e2189c99a96022ad027d949b9fc60ac92ee36641eb198` |
| M20-diagnostic.png | `f71ad003fc691362be2bedd62d6b2981d0dd57f830e7ee6997c6e13a93128345` |

All eleven inspected artifact/receipt hashes and UTC modification times are recorded in `independent-recheck-density-artifacts.json`. Final source binding is `independent-recheck-density-seal.json`. Exact reviewer report/evidence hashes are in `independent-recheck-evidence-manifest.json`.

No provider calls, UI interactions, source/test modifications, deployments or commits were performed. Prior limitations remain. The reviewer stops after this seal; repairs require a new frozen target and bounded follow-up.

## Sealed axis-consumer repair follow-up — de83ce9f

Reviewed commit `de83ce9fba4e2690e383081a85e4a450884f30e6`; source manifest SHA-256 `ad769ee7d483be15e883f35829edb619e5da6eb3ff21fd87c2e5e0f0a531f266`. All 456 entries match at initial check and final seal, with clean package status. Prior report hash before this append: `ace7705fbc187cd5bec0b08ef84a8e18df9f6e47435fafcc177cfdd67fad6440`. Every new reviewer output uses `independent-recheck-final-axis-*`; earlier evidence was not overwritten by this review.

**Result: the original interior-boundary P2 is repaired, but a related outer-boundary drag defect remains. Three relevant Guardian regression tests also fail. The current target is not accepted as fully verified.**

### [P2] First and last boundaries still use edge-bleeding widths as dated widths

The density repair now emits effective proportional weights, and the original 2022/2023 three-pixel right drag correctly previews +3 and commits +3. Expanding the independent reproduction to all five M03 boundaries in both directions exposes four failures at the two boundaries adjacent to the first/last cell. `axisMarkup` still extends those two transparent cell rectangles to x=0/1920, adding 39.36 pixels beyond the 2%-98% dated content. The pointer handler at `407f-engineering-adapter.js:8243` and `:8606-8629` combines full cell widths with weights for only the dated content.

| M03 boundary | Requested movement | Calculated drag preview | Rendered committed movement |
|---|---:|---:|---:|
| 2020/2021 | +3 px | -13.334985 px | +2.762626 px |
| 2020/2021 | -3 px | -19.334985 px | -2.762626 px |
| 2024/2025 | +3 px | +27.134361 px | +2.824585 px |
| 2024/2025 | -3 px | +21.134361 px | -2.824585 px |

The three interior boundaries pass both directions and preserve untouched cell geometry. This is a remaining edge-case defect in the existing consumer; it is not claimed to have been introduced by the newest repair.

Reproduction: `independent-recheck-final-axis-boundaries.mjs`; exact evidence: `independent-recheck-final-axis-boundaries.json`. Like the original probe, this uses the exact existing pointer arithmetic and calls actual `setAxisPresentationOverride`/`setAxisSegmentWeights`, without UI simulation or source mutation. The original single-boundary probe is separately retained under `independent-recheck-final-axis-pointer.mjs` and its prefixed JSON/SVG outputs.

Recommended correction: use one explicit dated-cell coordinate model throughout drag preview and commit, subtracting/dealing with the decorative edge extensions consistently. Test first, interior and last boundaries in both directions. Also consider actual display scale when validating browser interaction; no native/browser drag was performed here.

### Verified composed-scene and manual-edit repairs

Seven independent geometry/Guardian assertions pass in `independent-recheck-final-axis-geometry-guardian.mjs/json`:

- Both M03 milestone helpers match their SVG geometry. The pole is intentionally four pixels right of the flag geometry x; the degree helper now returns x=151.01504245714625 and its SVG pole x=155.01504245714625. The earlier report compared raw helper and pole numbers without explicitly stating that built-in offset; the previous mismatch was still real, and this corrected comparison now passes.
- First manual geometry commands for both a degree flag and a duration arrow persist the composed axis. All displayed year cells retain their x and width within rounding tolerance, and all source events/dates remain unchanged. This closes the previously reproduced fallback to uniform years after the first manual geometry edit on M03.
- A genuine Guardian collision repair moves one of two overlapping general milestones above the ribbon (owned flag painted bottom=50, ribbon top=125) and eliminates the collision. The input and facts are unchanged.
- The Guardian leaves two explicitly attached exam flags at their study-arrow positions even with a conflicting authored cover. Their poles still terminate at their corresponding arrow tops, and no manual exam geometry is introduced. The initial local probe compared against the layout before adding the cover; its corrected baseline is the covered document immediately before Guardian, so that setup change is not misreported as a Guardian mutation.
- A manually edited exam with ADVISOR_ONLY result provenance remains neutral in INTERVIEWER_SAFE rendering. The private source result and provenance are retained unchanged.

These tests use normal in-memory application commands and never write a source document or interact with UI/providers.

### Regression evidence and remaining test gaps

- **71/71** pass: `d1-024-*.test.mjs`, `d1-023-presentation-scene-safety.test.mjs`, `d1-021-founder-fidelity-deltas.test.mjs`, and `d1-founder-reanchor-presentation.test.mjs`. Log: `independent-recheck-final-axis-regression.log`.
- **30/30** prior independent defect/geometry/privacy checks pass; **6/6** supplemental occlusion/fixture checks pass. Logs: `independent-recheck-final-axis-prior-probes.log` and `independent-recheck-final-axis-occlusion.log`.
- **21/24** broader Guardian regressions pass. Command includes `d1-021-guardian-milestone-reflow.test.mjs`, `d1-021-guardian-insert-preservation.test.mjs`, `d1-final-012a-quality-guardian.test.mjs`, and `d1-023-guardian-readiness.test.mjs`. Log: `independent-recheck-final-axis-guardian-regression.log`.
- The three failures are the older golden2 all-flags-repaired expectation (expects zero remaining collisions; actual one) and two insert/preference preservation tests whose setup expects two geometry overrides (actual one). The tightened above-ribbon rule deliberately limits available placements, so these failures are not proof that general flags should be moved below the ribbon. They do mean the relevant preservation tests abort before exercising their intended path. Update their fixture/expectations to preserve meaningful coverage of insertion and preference changes while keeping unresolved collisions visibly gated; do not simply suppress those assertions.

The independent boundary matrix passes 6/10 cases; its four failures are the P2 above. No claim is made about the parent's separately running full suite.

### Original evidence custody reconciliation

Before writing this addendum, the prior evidence manifest still had SHA-256 `6ab400e1e29244e29182a5df6599ba0de3d5accd2bfd6093d31c37595d3db297`, matching this reviewer's retained prior seal. All three reconstructed 632cf0b outputs exactly match the hashes recorded in that original manifest:

| Reconstructed file | Original sealed SHA-256 |
|---|---|
| independent-recheck-density-axis-consumer.json | `5f1970d6b21be482799b8a3a4ac4ba49fd6c9bccbb8c2c20f5d4052525cecac6` |
| independent-recheck-density-axis-before.svg | `593ce9899aece75277df03bf311d31872205727999395fdc3ec3504494bca911` |
| independent-recheck-density-axis-after.svg | `cff27dafceb6e2bf01c7ee2443a81c446783bd15c95d96751f2235eafb8e8f10` |

Verification is in `independent-recheck-final-axis-custody.json`. This confirms byte equivalence of the restored evidence; it does not erase the documented temporary overwrite. The prior report itself also retained its original `ace7705f...` hash before this append.

Final binding: `independent-recheck-final-axis-seal.json`; new report/evidence seal: `independent-recheck-final-axis-evidence-manifest.json`. No source/UI/provider writes, deployments or commits occurred. Saved exports from earlier targets are not recertified against this target. Native visual acceptance, whole-product acceptance and Fable identity remain unverified. Stop after this seal.

## Sealed edge-boundary final recheck — 3ab6923

Reviewed commit `3ab692393505c0cb64a7faddd9e3730b50300367`; source manifest SHA-256 `e6f4d6639e9e4a6bde71db3219330db91c7aa8c25d01a8e11abe1a35a761b051`. All 456 source entries match both initial and final checks; package git status remains clean. Prior report SHA-256 before this append: `028033994fe041658fc390f0e549325634860a582d3f6c65721f119bf9f0005c`. All 35 evidence files in the immediately preceding final-axis seal remain byte-identical.

**Result: no new failure reproduced in this bounded check. The remaining first/last boundary P2 is closed by the independently exercised pointer consumer. The revised Guardian tests pass and preserve meaningful behavioral coverage. This conclusion is limited to the requested engineering delta.**

### Actual pointer consumer: 240/240 cases pass

Reproduction: `independent-recheck-edge-pointer.mjs`. The harness extracts and executes the actual current pointerdown, pointermove and pointerup branches from `407f-engineering-adapter.js` in a local in-memory VM with inert geometry/event/store stubs. It imports the actual `calculateAxisBoundaryDrag`, `setAxisPresentationOverride` and `setAxisSegmentWeights` functions. The pointerdown branch itself selects the cell rectangle, reads the new dated width and determines scale; the move branch writes its real transform strings; the pointerup branch performs its real state replacement. No browser or native UI interaction is used.

The 240 cases cover:

- All five boundaries of M03, including both edge-bleeding cells.
- Screen movements -3, +3, -10000 and +10000 pixels.
- Zoom scales 0.5, 1 and 2.
- Both CTM-derived scale and the bounding-rectangle fallback.
- Automatic dense M03 weights and a manual axis containing adjacent weights 7 and 7, so both the lower 0.25 limit and upper 8 limit are exercised.

Each case checks against an independent dated-width/clamp calculation, verifies committed geometry matches the preview, asserts both weights remain legal, preserves every unrelated cell's x and width, and verifies source/document dates are unchanged. All **240/240** pass. Maximum preview-to-commit boundary difference is `4.547473508864641e-13` pixels, consistent with floating-point rounding. Clamp cases preserve the pair's total weight. The group-level geometry stub deliberately throws if the consumer fails to select its transparent cell rectangle, so the pointerdown correction is actually exercised.

Exact source hash, extracted source offsets, per-case inputs, weights, transforms-derived positions and unrelated-cell differences are retained in `independent-recheck-edge-pointer-results.json`; concise execution output is `independent-recheck-edge-pointer.log`. This is code-path evidence, not an assertion that a real drag was performed in the browser.

### SVG change is nonvisual for the independently bound sample

Current M03 SVG SHA-256: `ff51d9217d4e6cb62ef5f53597a0f12018f701ccf8a87fa0ce3864ef93b688e5`. Removing only the newly added `data-axis-date-width` attributes produces SHA-256 `8f584d4500cd5e7c3130546979c71b74d918486b382603b8d6a215e519df3744`, exactly matching the previous de83ce9f M03 SVG already sealed in `independent-recheck-final-axis-density-axis-before.svg`.

Source review confirms the renderer delta is the additional nonvisual dated-span attribute. The existing deterministic-serializer test also explicitly compares its prior digest after removing only that attribute, rather than silently replacing a visual digest. Evidence: `independent-recheck-edge-guardian-and-svg.mjs/json`.

### Guardian test corrections are honest and retain coverage

The unchanged synthetic golden2 fixture is SHA-256 `8044d3b0c834065448d1b13496a527c0b24ce70b64025e0d6d812a8665b42e71`. Independently running its actual Guardian repair confirms:

- Collision count improves from three to one, with exactly one authored flag geometry repair.
- All general flag bodies remain above the ribbon: painted bottoms 50, 107 and 100, with ribbon top 125.
- `COLLISION_RISK` remains visible, and `PRESENTATION_TEXT_COLLISION` remains `BLOCK_EXPORT` for the unresolved pair.
- The final export gate still blocks this fixture (its first reported error is `TIMELINE_EXPORT_MISSING_FIELDS`, not a claim that layout is clear).
- A second bounded repair is unchanged; source events, exams, student profile and input document are preserved.

The revised milestone test replaces the old all-conflicts-resolved assumption with these residual-conflict and above-ribbon assertions, while retaining date-axis anchoring, source facts, authored-note geometry and repeat-fix stability. The readable-duration test still requires every remaining warning to exclude duration-event IDs, so a duration collision cannot hide behind the allowed milestone conflict.

The media-insertion and Builder preference tests now start from the actual one-flag repair and execute their original meaningful paths: the actual extracted Add image callback adds a media item while retaining event overrides and semantic records; the real document-to-407F and back functions persist the score preference while preserving Guardian offsets. Their assertions were not removed. All formerly failing tests now reach and pass these checks.

### Focused verification, custody and limits

**100/100 focused regression tests pass**, zero failures/skips. Command:

```sh
node --test packages/mission-timeline/tests/d1-024-*.test.mjs packages/mission-timeline/tests/d1-023-presentation-scene-safety.test.mjs packages/mission-timeline/tests/d1-021-founder-fidelity-deltas.test.mjs packages/mission-timeline/tests/d1-founder-reanchor-presentation.test.mjs packages/mission-timeline/tests/d1-021-guardian-milestone-reflow.test.mjs packages/mission-timeline/tests/d1-021-guardian-insert-preservation.test.mjs packages/mission-timeline/tests/d1-021-readable-founder-text.test.mjs packages/mission-timeline/tests/d1-final-012a-quality-guardian.test.mjs packages/mission-timeline/tests/d1-023-guardian-readiness.test.mjs
```

Log: `independent-recheck-edge-regression.log`. Initial/final source and prior-evidence checks: `independent-recheck-edge-source.json`, `independent-recheck-edge-custody.json`, `independent-recheck-edge-seal.json`. Exact new report/evidence hashes: `independent-recheck-edge-evidence-manifest.json`. Earlier sealed evidence files and manifests were left unchanged.

No source/test/provider/UI mutations, deployments or commits occurred. This does not certify native PowerPoint/Keynote behavior, real browser dragging, whole-product acceptance or Fable identity. Earlier unresolved template-policy, density and native acceptance limits remain as documented; passing this delta does not turn deliberately gated fixtures into sendable output. The reviewer stops after this seal.
