# Sol bounded implementation packet

OUTCOME: independently reproduce and repair intake profile-confirmation bypasses and preserve source provenance, without changing visual mapping.
BASE SHA: 3f650a10fa46f637fc656dd3f13d0ce18ea7093b plus the exact preserved dirty preimages in PREIMAGE_MANIFEST.json. Do not treat that dirty delta as accepted without test.
WRITE PATHS: packages/mission-timeline/web/js/ingestion/cv-parser.js; packages/mission-timeline/web/js/ingestion/event-classifier.js; packages/mission-timeline/web/js/uxr-002/intake-d1-408-adapter.js; packages/mission-timeline/web/js/uxr-002/intake.js; packages/mission-timeline/tests/d1-023-intake-profile-category.test.mjs. Local handoff: .timeline-recovery-20261002/template-locked/SOL_REPORT.md.
READ-ONLY DEPENDENCIES: TEMPLATE_CONTRACT.md; all other package source/tests; current MissionMed OS DR-200/201/362; parent lease status.
DONORS: only assigned existing dirty diffs against base, preserved byte-for-byte. No Fable work or rejected compositor.
TESTS: reproduce explicit Name-only autofill bypass; blank/unknown category; orphan degree handling; profile versus experience institution; conflicting profile claims; reject or require review before source facts overwrite existing profile; existing ingestion/intake tests. Record exact commands/counts and limits.
FORBIDDEN: design changes, rejected composer, renderer/export/canvas writes, production/provider mutations, personal data, fake facts, lease acquisition or overlapping writes, broad git staging, deployment, self-merge. Check parent's product.status.json state READY and age <15 sec before each write; stop on loss.
HANDOFF: report source repro, fix, focused tests and remaining gaps. Preserve all preexisting scope deltas in commit; explain their provenance. Commit only the five listed package paths, no unrelated source or evidence, after parent supplies valid lease/readback.
STOP AFTER COMMIT: return commit SHA and report. Parent integrates and owns release.
