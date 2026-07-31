# D1-405 Milestone Status

Updated: 2026-07-31

Estimated overall completion: 84%

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
| M9 explanation/interview tools | COMPLETE | Bounded annotations, interview-specific target, shared local logo, truthful Calendar seam; 511/511 tests |
| M10 themes/export audiences | PENDING | — |
| M11 entitlements/migration | PENDING | — |
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
