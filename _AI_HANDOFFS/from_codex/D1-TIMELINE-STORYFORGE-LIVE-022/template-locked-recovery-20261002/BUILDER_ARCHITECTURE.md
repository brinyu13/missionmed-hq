# Builder architecture

Existing architecture is recoverable; no wholesale rewrite needed.

1. PDF/DOCX intake adapter extracts page/block evidence and server suggestions.
2. cv-parser, date-normalizer, event-classifier, candidate-builder and provenance produce source facts and candidate model.
3. intake candidate review and buildApprovalBatch/applyApprovalBatchToDocument form the human acceptance boundary. Profile claims need the same explicit confirmation as events.
4. store owns canonical semantic document, revision/history and persistence. scene-graph stores separate authored presentation adjustments. Production adapters enforce identity and server-acknowledged sync.
5. projectFounderPresentationDocument applies audience and field/exam privacy.
6. buildFounderPresentationScene maps the confirmed model to the established board renderer. Source date wording must travel with each semantic event.
7. serializeFounderScene and locked-407f-export emit the single template-locked scene. The rejected measured composer dispatch is removed. Automatic placement now operates only on eligible generated arrows, preserving chronology, manual geometry, locks, attached exam flags and native adjacent personal bands.
8. export/readiness guards check missing facts, omissions, scene failure and text fit for the selected audience. Field-level coverage and native rendering remain acceptance obligations.
9. Local export adapter produces PNG, Letter/A4 PDF, and editable PPTX from the shared scene. Output delivery must distinguish browser request from verified saved file.

Renovate these seams only as reproduced defects require. Do not send raw parser coordinates to the renderer. Preserve server-owned identity, RLS, database, File Vault and Matrix contracts. No backend changes were made in this recovery.

## Current validation order

Audience projection -> recoverable saved-scene validation -> known-date/material-event coverage -> visible text bounds -> material title/institution coverage -> final text and event-shape occlusion. Guardian consumes the same material collision checks. A final gate failure preserves facts and blocks generation. Human profile/category consent remains upstream; renderer coordinates cannot approve source claims.

## Remaining acceptance work

The existing pipeline does not need a wholesale rewrite. Outstanding work is explicit template mapping policy, more capable composition within approved grammar, missing-furniture policy, broader native format acceptance, authenticated browser import/save/reopen/delivery, and Fable challenge. Disposable PostgreSQL tests validate real authorization/persistence seams but cannot certify production role flows.

Composition returns the exact composed scene plus SVG. Adaptive year widths are materialized as effective weights; first manual geometry freezes that axis. Pointer preview/commit uses the same dated inner width while decorative outer ribbon bleed stays fixed. Source facts and semantic dates never change with these operations.

Supported local intake formats are PDF and DOCX. Legacy binary DOC is explicitly rejected by the existing format gate; it is not claimed as supported. DOCX extraction retains section/quote provenance because page numbering is not stable. Actual browser proof in this run uses PDF; DOCX malformed/archive/provenance paths are covered by tests.
