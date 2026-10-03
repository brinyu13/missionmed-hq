# Sol: education mapping under approved G4
OUTCOME: Map verified education durations to the existing degree milestone and source-linked profile education records, preserving input facts and existing privacy/date review boundaries. No education arrow or seventh key row. Parent handles profile painting and category-key serializer.
BASE SHA: c1fc1b6d3d12020fd136632a15453dfd7d7198b9. Reverify ancestry and assigned-path preimages; parent edits separate files concurrently.
WRITE PATHS: packages/mission-timeline/web/js/uxr-002/board-renderer.js; packages/mission-timeline/tests/d1-025-education-template-mapping.test.mjs. Ignored report only: .timeline-recovery-20261002/founder-decisions-20261003/SOL_REPORT.md.
READ-ONLY DEPENDENCIES: current TEMPLATE_CONTRACT.md/json in prior handoff; new FOUNDER_DECISIONS.md here; serializer/locked renderer/date helper/schema; applicable BOOT/AGENTS. Parent product.status.json fresh READY age<15s before each write/commit, stop on loss and notify. Do not acquire leases or use providers.
DONORS: existing code/tests and synthetic fixtures only; no prior rejected architecture.
INTERFACE: scene.profile.educationRecords array. Each record retains eventId,title,school,startDate,endDate,openEnded,datePrecision,sourceDateWording,provenance. Parent paints existing profile text rows with source-linked attributes. Completed education with verified end date becomes a flag at that end date using original event id/title/siteName and end precision/wording. Scene events must still account for it; original document/events stay byte-equivalent. Do not infer degree completion or fabricate date for unknown/open-ended/ambiguous cases; leave explicit review omission/gate. Other categories and prior clinical/residency training remain unchanged. Preserve source start/end in educationRecords. Parent adds visible span coverage validation. Coordinate any interface issue before divergent implementation.
TESTS: completed school span; multiple schools/degrees; year-only/partial precision; unknown end and ongoing cases stay honest; private education absent from interviewer scene/profile; source/provenance immutable; completed education has flag and no duration arrow. Existing board-renderer/intake/privacy tests; record failures caused by parent-owned painting separately.
FORBIDDEN: all other source files; new visual grammar; source fact mutation; inference of degree completion; education key row; provider/UI/deploy/self-merge; broad staging; modifying parent's dirty files.
HANDOFF: exact changed paths, repro, commands/results, remaining limitations. Commit only two assigned source/test paths after tests and fresh lease status. Report commit SHA. No parent paths staged.
STOP AFTER COMMIT: stop and return bounded report; parent owns integration and acceptance.


## Completed follow-on bounded work

Sol added founder-decision regressions in d1-025-founder-decisions.test.mjs and updated13legacy expectation files with nonoverlapping parent scopes. Commits33e9329and69fff86. Full original bounded messages remain in this task; source changes/reports list exact paths. No Sol design authority/deployment/self-merge. Current worker is stopped. Reports below in SOL_REPORT.md. Any further worker needs a fresh current SHA packet and scope; these completed packets are not ongoing write authorization.


## Completed follow-on packet custody

The following concise packet records are reconstructed from the worker's exact commits and reports, not represented as untouched original dispatch messages. Original dispatch messages remain in the chat.

### Founder regression tests

OUTCOME: regression coverage for G1/G2/G4 and curve bounds; no design decisions.
BASE SHA: 482492336b5a6ef35754ff791d16df8de2554c31.
WRITE PATHS: packages/mission-timeline/tests/d1-025-founder-decisions.test.mjs; ignored SOL_TEST_REPORT.md only.
READ-ONLY DEPENDENCIES: parent renderer/serializer/export source and locked contract; donor hashes in SOL_REPORT.md.
DONORS: current synthetic matrix and existing source; parent dirty source is explicitly identified as concurrent implementation, never treated as an independently clean source base.
TESTS: founder decisions, education mapping and template density; 39/39 at worker handoff.
FORBIDDEN: source edits, new grammar, provider/UI/deployment, broad staging, parent dirty-path writes.
HANDOFF: committed 33e9329, exact path/hash and concurrent source donor hashes in SOL_REPORT.md.
STOP AFTER COMMIT: worker stopped after scoped commit.

### Legacy expectations

OUTCOME: align obsolete tests with approved G1/G2/G4 while retaining privacy/omission/manual-layout protections.
BASE SHA: 33e9329bef724f8cd6f271bf262fe787129f7394; parent source advanced to 65c1a806 before final 109/109 validation.
WRITE PATHS (package tests only):
- packages/mission-timeline/tests/d1-021-editable-pptx.test.mjs
- packages/mission-timeline/tests/d1-021-guardian-insert-preservation.test.mjs
- packages/mission-timeline/tests/d1-021-guardian-milestone-reflow.test.mjs
- packages/mission-timeline/tests/d1-021-readable-founder-text.test.mjs
- packages/mission-timeline/tests/d1-022-category-presentation.test.mjs
- packages/mission-timeline/tests/d1-022-navy-portable-background.test.mjs
- packages/mission-timeline/tests/d1-023-guardian-readiness.test.mjs
- packages/mission-timeline/tests/d1-024-independent-findings.test.mjs
- packages/mission-timeline/tests/d1-406-functional-recovery.test.mjs
- packages/mission-timeline/tests/d1-aaa-019-storyforge-canva-contract.test.mjs
- packages/mission-timeline/tests/d1-founder-reanchor-presentation.test.mjs
- packages/mission-timeline/tests/uxr-002-keynote-renderer.test.mjs
- packages/mission-timeline/tests/uxr-002-themes.test.mjs

READ-ONLY DEPENDENCIES: locked contract, approved decisions, current renderer/serializer/export source; exact donor hashes in SOL_REPORT.md.
DONORS: existing tests and synthetic fixtures; no rejected visualization.
TESTS: exact 13-file selection, 109/109 passed; full suite owned by foreman.
FORBIDDEN: product source or fixture changes, provider/UI/deployment, redesign, self-merge or unrelated staging.
HANDOFF: committed 69fff864; individual expectation changes and evidence in SOL_REPORT.md.
STOP AFTER COMMIT: worker stopped after scoped commit.
