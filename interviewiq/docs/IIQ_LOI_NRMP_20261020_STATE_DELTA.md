# InterviewIQ LOI NRMP correction - integration handoff

Status: INTEGRATION READY; no production deployment by this task.

Founder command: surgical NRMP correction dated October 20, 2026. Fable owns active draft persistence and RISE personalization. Existing IIQ-1204/IVIQ AUDIT release ownership is retained. Work is isolated on codex/iiq-loi-nrmp-correction-20261020 from live source 0dbda0e78d5a19693e7e2aa576083743f38768f4. Original Fable worktree is untouched.

Changes: default intent example/composer express strong interest with no rank position. Optional first-choice sentence requires truthful, voluntary, unrequested/unpressured and no-reciprocity confirmations. A legacy firstChoice boolean alone is insufficient. Revocation removes only the exact composer-generated sentence, with notice; other student edits remain. Manually rewritten student wording is preserved with an explicit review notice. Reconfirming never silently rebuilds edited text. Other six templates have no generated ranking commitments.

Official guidance verified October 20, 2026:
- [2027 applicant agreement](https://www.nrmp.org/wp-content/uploads/2026/09/2027-MPA-Main-Match-Applicant.pdf), sections 6.3-6.5: accuracy, confidentiality, voluntary interest, no soliciting program rank commitments; programs may not request ranking preferences or commitments.
- [2027 program agreement](https://www.nrmp.org/wp-content/uploads/2026/04/2027-MPA-Main-Match-Programs.pdf), sections 6.4-6.5: reciprocal solicitation and persuasion restrictions.
- [Applicant Code of Conduct](https://www.nrmp.org/wp-content/uploads/2023/08/NRMP-Match-Codes-of-Conduct_Applicants.pdf) and [Program Code of Conduct](https://www.nrmp.org/wp-content/uploads/2025/04/NRMP-Match-Code-of-Conduct_Programs_2025.pdf): professional communication standards. UI distinguishes agreement requirements from professional guidance and does not characterize voluntary disclosure as automatically a Match violation. Program communication restrictions must be followed.

Validation: 15/15 focused unit/UI tests PASS; build PASS; git diff --check PASS. Browser candidate uses synthetic local student fixture, no production API. Desktop 1440x1000 and phone 390x844: readable confirmations/editor, no horizontal overflow, default rank-free; all four enable first-choice statement; revocation keeps student addition; actual clipboard and downloaded text match. This is local candidate acceptance, not authenticated production acceptance or independent release verification.

Permanent DR-370 production-data preservation invariant remains mandatory. No production data, schema, RISE, provider, Calendar, Program Command Center, student records, persistence contracts, or shared runtime assets changed. Exact source PATH lease fence6366 under current native Lease V2. IIQ BOOT PASS on OS7d91776d3491380bf552d7ca19af07de3d698905, canonical HQe6e4fa617324a74793e9c703a98dec77ab044556; guardrail49084f7a4d5583b0f159fef9bac3d2f8f2c57526ec27368fafda567f763e9828 matches registered BOOT dependency. Shared dirty Timeline OS checkout untouched.

Production preserved: frontend843beb6d9414ea2154076a39f5e701844b55db4a17029deae54f086f1f6d415d; app b938f3fb393a367bdc4bfaa361c5baaa3ac7507609590fc78e778bf8a1615033. Correction is not live yet.

Integration action: existing release owner applies the source/test changes to Fable's current upgrade, preserving its persistence/RISE code, and regenerates app.js and release-manifest.json from that combined tree. Do not transplant this older-base bundle over Fable's newer bundle. Repeat focused tests against the combined source; use the existing independently reviewed, fenced release path and authenticated student acceptance before claiming LIVE. Do not create a second deployment pipeline.

Evidence: /Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CODEX/IIQ_LOI_NRMP_20261020/ (focused-tests.txt, desktop.png, mobile-consents.png, production-preserved.json and sanitized lease receipt).
