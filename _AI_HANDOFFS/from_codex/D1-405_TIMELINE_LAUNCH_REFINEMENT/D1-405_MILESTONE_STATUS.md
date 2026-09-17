# D1-405 Milestone Status

Updated: 2026-07-31

Estimated overall completion: 94%

| Milestone | Status | Checkpoint |
|---|---|---|
| M0 baseline and branch | COMPLETE | Canonical 407F baseline |
| M1 branding/navigation clarity | COMPLETE | MissionMed identity and Edit Timeline |
| M2 Home/File Vault entry | COMPLETE | Faster-start and truthful local seam |
| M3 Builder composition | COMPLETE | Horizontal workflow and one-column/right-preview layout |
| M4 interactive preview/lightbox | COMPLETE | True 16:9, click-to-edit, zoom |
| M5 shared dates | COMPLETE | Month and exact-day controls |
| Founder stepper/Media refinement | COMPLETE | Premium stepper; shared local Media |
| M6 Core Info/medical-school registry | COMPLETE | Commit `3f7923f` |
| M7 exams and rotations | COMPLETE | Commit `18ab405`; 496/496 tests |
| M8 specialty variants/LOR intelligence | COMPLETE | Shared facts, normalized variant config, active export; 504/504 tests |
| M9 explanation/interview tools | COMPLETE | Commit `fae87de`; bounded annotations, interview-specific target, shared local logo, truthful Calendar seam; 511/511 tests |
| M10 themes/export audiences | COMPLETE | Five frozen themes, labeled empty examples, safe admin seam, four explicit audiences; 522/522 tests |
| M11 entitlements/migration | COMPLETE | Fail-closed local proof, read-only preservation, lossless D1-404 migration; 540/540 tests; three specialist PASS verdicts |
| M12 accessibility/responsive/hardening | PENDING | — |
| M13 final candidate/handoff | PENDING | — |

M7 external-state boundaries:

- no production LOR task;
- no cloud storage;
- no Matrix or WordPress mutation;
- no push or deployment.

M8 keeps one canonical factual event collection. Specialty variants store only
the active specialty identity, presentation name, per-variant hidden-event IDs,
and compatible interview-target configuration. Create, switch, rename, remove,
and per-event visibility changes use the retained TimelineStore mutation path,
so autosave, undo/redo, history, and persistence remain intact.

M9 adds bounded Explanation events to the same canonical event collection and
stores interview-specific presentation data only on the active specialty
variant. Program logos reuse `document.advanced.media` and the existing
IndexedDB blob store; the variant holds one asset reference plus placement and
fit. Matrix Calendar remains a truthful unavailable runtime adapter with
local-only fixtures and no production claim.

M10 preserves the five frozen themes and Advanced Studio. Theme previews use
the active student timeline when events exist; empty accounts use a clearly
labeled example timeline rendered through the same canonical renderer and the
same theme definitions. A structured, permission-bound, versioned future admin
theme package seam rejects CSS, JavaScript, HTML, executable assets, and
unapproved asset manifests; it does not activate a production admin backend.

Export now defaults to Interview-safe and offers only four explicit audiences:
Interview-safe, LOR writer, Professional connection, and Mission Residency
alumni connection. Recipient details use progressive disclosure. Advisor-only
items enter a non-interviewer export only when an event explicitly names that
audience scope; student-only and hidden items never enter. Preview and download
share the identical filtered render input.

M10 hardening also gives the Canvas and Export theme pickers complete focus,
Escape, backdrop, and opener-restoration behavior; blocks export when the
student name is absent; preserves focus as recipient details are entered; adds
recipient-specific advisor-only sharing to Canvas Details; and includes the
submitted-LOR legend in every empty-account theme example.

M11 introduces one pure entitlement policy and keeps `TimelineStore` as the
single write authority. WordPress Administrator, 360 Match Mentorship,
individual override, cohort, promotion, zero, exact numeric, unlimited,
expiration, removal, global-disable, and production-unverified decisions are
deterministic. The local adapter makes zero network or protected writes; the
unavailable production boundary fails closed. Existing documents become
read-only without deleting documents, checkpoints, versions, blobs, media, or
exports. New/denied accounts receive no initial persistence write.

D1-404 migration is additive, pure, and idempotent. Existing identifiers,
geometry, categories, source metadata, specialty/interview fields, Advanced
content, advisor data, export state, and unknown fields are preserved.
Unsupported category identity is retained as migration evidence. Missing
clinical LOR status becomes explicit `unknown`; no submitted evidence or exact
rotation day is fabricated. Version snapshots migrate lazily on restore and
the original version remains rollback evidence.
