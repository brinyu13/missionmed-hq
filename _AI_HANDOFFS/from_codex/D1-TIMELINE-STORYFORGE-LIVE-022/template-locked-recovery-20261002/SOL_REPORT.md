# Codex Sol G4 education mapping handoff — 2026-10-03

Base: `c1fc1b6d3d12020fd136632a15453dfd7d7198b9`, verified ancestor of the current worktree. Assigned board-renderer preimage Git blob: `a10401b42188749942205683a15c6d742b28280c`; new test path had no preimage. Parent `PRODUCT:TIMELINE` keeper was `READY` and under 15 seconds old before each write. No lease acquisition, provider/UI/production action, or edit outside the two assigned package paths occurred. Model identity: Codex Sol.

The completed, source-reviewable Education duration now maps to a general milestone flag at its verified end month with the original event ID, title, and siteName. Its school/title/start/end/open-ended state, original precision and wording, and raw provenance remain in `scene.profile.educationRecords`. The input document and event facts remain byte-equivalent. The flag carries the source end precision and wording on its display date edge; a year-only source stays year-only. Education contributes no duration arrow, lane, or seventh key row. Work/residency and clinical mappings remain unchanged.

Missing, ongoing, unknown, seasonal, vague, or contradictory completion dates produce explicit scene omissions that the existing completeness gate rejects. A school start with unknown precision also omits. Private Education records and flags are absent from interviewer scenes for `ADVISOR_ONLY`, `STUDENT_ONLY`, and `FULL_STORY`, while `EVERYTHING` retains them. The existing `excludedAdvisorOnlyIds` metadata key now includes all excluded private event IDs; its name is legacy.

Verification: `node --test tests/d1-025-education-template-mapping.test.mjs tests/d1-021-presentation-privacy.test.mjs tests/d1-024-template-density.test.mjs tests/d1-021-intake-review.test.mjs tests/uxr-002-advanced-board.test.mjs` passed 50/50. New G4 scene cases passed 6/6 and cover completed/multiple schools, year-only/coarser precision, source-date conflict, unresolved completion, private projection, unchanged input facts, and prior residency. `git diff --check` on the assigned renderer passed. The older `tests/d1-022-category-presentation.test.mjs` passed 1/7: its six failing assertions require an Education duration arrow, seventh key row, or education-arrow based validation and are superseded by G4. Parent owns updating that test and integrated profile painting/serializer acceptance.

Scope limit: This is a scene mapping with focused tests, not native visual acceptance or deployment. Parent will verify actual normal/sparse/dense/overlap exports, profile text coverage, source-end wording in the serializer, and the locked 2025 template. Commit SHA is returned separately after the exact-path commit per STOP AFTER COMMIT.


# Codex Sol bounded founder regression test report

- Base HEAD before test work: `482492336b5a6ef35754ff791d16df8de2554c31`.
- Scoped commit: `33e9329bef724f8cd6f271bf262fe787129f7394`.
- Only committed path: `packages/mission-timeline/tests/d1-025-founder-decisions.test.mjs` (SHA-256 `f974f684baefbc0cd028d24edf0b724a752095753fa8bccab08788f44e52c669`).
- Parent-owned dirty source paths were read only. At initial read, SHA-256: serializer `cb997a3193982b41fd22de95e6130d9f8b4b67524d588daf52322fe767f57c3f`; locked exporter `fc61e2d1a37ffb4ef33ebaa846f008f147299b323302d4cc78b58bace844dece`; resolved presentation `c489cb51636b6db578dd5353385233373886e1a7f7beebd875c4c2726c919b4c`; export adapter `b38ea8972f969d79a5092b044688ebd2d418d2d0d398b47bae1d7e810a604b4b`; board renderer `bb6eb7ace5751aff1615a57eaed66ca69f2716eb3742864ed982be03777a5622`.
- At final test run, locked exporter had changed to `c924353dacb767382c1e5e5bee149f8c66fe351a400840a820c6414ce3397551` and resolved presentation to `972cc62b879810e5a0a178e5d349206993730069407992e526dfab9f99569f6f`; other listed hashes remained unchanged. These are parent-owned dirty donors, not this commit.

The seven new tests assert the approved G1 final/editing split for empty, partial, and filled media/interview; full visible institutions on ordinary and USA milestone flags under G2; source-linked visible education span, completion flag, six-row key, and manually authored profile geometry under G4; and exact cubic/quadratic painted-curve bounds rather than the invisible control-point hull. Synthetic inputs only; no provider or production operations.

Validation: `node --test packages/mission-timeline/tests/d1-025-founder-decisions.test.mjs packages/mission-timeline/tests/d1-025-education-template-mapping.test.mjs packages/mission-timeline/tests/d1-024-template-density.test.mjs` passed 39/39. `git diff --check -- packages/mission-timeline/tests/d1-025-founder-decisions.test.mjs` passed. The scoped commit contains one file; the parent source files remained dirty and unstaged after it. This is technical regression coverage, not a visual acceptance or deployment claim.


# Codex Sol — bounded legacy founder regression update

Base for this packet: `33e9329bef724f8cd6f271bf262fe787129f7394`. Parent committed its source during this work; the final assigned-suite run used source HEAD `65c1a80677aed2a4247e8c5bb765d3715872e109`. Scoped test commit: `69fff864e983c579a4b19ecedf97077c65c92d68`. Only the 13 assigned test paths changed. No source, fixture, provider, UI, or deployment writes were made by this worker.

Changed expectations and retained checks:

1. `d1-021-editable-pptx.test.mjs`: supplies an actual frame photo before checking exact native polaroid rotation; an empty final frame is absent under G1.
2. `d1-021-guardian-insert-preservation.test.mjs`: authors one flag geometry explicitly, then verifies Add image and Builder score changes preserve that geometry and source facts. The golden fixture now has no safe automatic Guardian move after composition.
3. `d1-021-guardian-milestone-reflow.test.mjs`: requires residual collisions to remain gated and no false automatic repair or fact/annotation mutation; retains the separate manual-geometry protection test.
4. `d1-021-readable-founder-text.test.mjs`: permits genuinely fitting inside labels while retaining full-size text and bounds; the omitted empty profile photo gives the school value full paper width. Checks native PPTX text fragments and tests collision warnings against rendered arrows, excluding the completed education flag from the duration set.
5. `d1-022-category-presentation.test.mjs`: completed education is a dated flag plus source-linked profile span, with no duration arrow or seventh row. Other category colors, unsupported-category rejection, six-row card geometry, and native PPTX degree/profile content remain asserted.
6. `d1-022-navy-portable-background.test.mjs`: supplies an actual interview date/program before checking the interview ink token.
7. `d1-023-guardian-readiness.test.mjs`: optional unfilled furniture no longer blocks a complete final export; missing facts and actual occlusion still block in neighboring tests.
8. `d1-024-independent-findings.test.mjs`: requires the supplied institution visibly adjacent to its flag and a passing completeness gate; overlapping chronology must retain every event and clear the gate after safe composition. Privacy and occlusion tests remain intact.
9. `d1-406-functional-recovery.test.mjs`: raster-safe empty export omits the unpopulated interview ribbon and placeholders.
10. `d1-aaa-019-storyforge-canva-contract.test.mjs`: checks all empty frame controls in explicit editing mode, then checks final output contains only its filled photo.
11. `d1-founder-reanchor-presentation.test.mjs`: replaces the obsolete whole-SVG digest with deterministic output plus existing pinned authority/asset assertions, verifies six rows and education record, checks empty frame geometry in editing mode, and verifies authored education flag geometry rather than an education arrow.
12. `uxr-002-keynote-renderer.test.mjs`: keeps the sprite/label/date checks on a non-education duration; verifies the completed school flag/profile record, updated chronology order, and three genuine milestone flags. Open education without a verified end remains omitted, so the two-open-span test uses work roles.
13. `uxr-002-themes.test.mjs`: checks the surviving clinical arrow against the Navy clinical palette and verifies the education event remains a dated flag/profile record.

Validation: the exact 13-file `node --test` selection passed **109/109** after parent source HEAD `65c1a806`; `git diff --check -- packages/mission-timeline/tests` passed. No assigned test exposed an unresolved source regression. The older preliminary full-suite log's failures outside these 13 paths were not reclassified or changed here; a new full-suite result belongs to parent integration. This is technical regression evidence, not visual acceptance.

Final read-only source donor SHA-256 at validation: serializer `95023cc0d483ac1558eac752288f2100501f121eb965d5ae16684f058e673708`; locked exporter `adb7e346d416bc922ede87b9de6ef9f1b6e699f887e67158d752a335434750fc`; resolved presentation `972cc62b879810e5a0a178e5d349206993730069407992e526dfab9f99569f6f`; export adapter `b38ea8972f969d79a5092b044688ebd2d418d2d0d398b47bae1d7e810a604b4b`; board renderer `bb6eb7ace5751aff1615a57eaed66ca69f2716eb3742864ed982be03777a5622`.
