# D1-405 Integration Seams

Status: in progress

## File Vault source seam — M2

Runtime injection point:

`window.MISSIONMED_FILEVAULT_SOURCE_ADAPTER`

Required adapter identity:

`kind: "missionmed-filevault-source"`

Connected contract:

- `connected: true`
- `listRecent(): Promise<DocumentDescriptor[]>`
- `search(query): Promise<DocumentDescriptor[]>`
- `select(documentId): Promise<DocumentDescriptor>`

Normalized metadata-only descriptor:

- `id`
- `name`
- `fileType`
- `updatedAt`
- `sizeBytes`

Safety and truthfulness:

- An absent, invalid, or disconnected adapter resolves to an immutable unavailable adapter.
- The unavailable adapter returns no documents and rejects selection with `FILE_VAULT_SOURCE_UNAVAILABLE`.
- Runtime copy explicitly states that File Vault is not connected in this local candidate.
- No fixture or fabricated document is presented at runtime.
- Queries are capped at 20 normalized records.
- Continuation is disabled until one document is selected.
- Production retrieval, authorization, and document-body transfer are not implemented or claimed.

Activation boundary:

A future authorized integration may inject the connected contract without changing Home composition or the chooser workflow. The connector must remain responsible for authentication, authorization, source ownership, and secure document transfer. This local candidate performs no File Vault, Matrix, WordPress, or production write.

## Builder preview ownership seam — M4

The embedded preview and full-preview lightbox both consume:

- the current canonical timeline document from the existing store,
- the current derived month when present,
- `advancedBoardRenderer`,
- the interview-safe presentation profile.

They do not maintain a second document, second store, or preview-only timeline model.

Owner metadata resolves preview elements to Builder destinations:

- `core` → Core data,
- `exam` → exact exam attempt,
- `research` → Publications & research,
- `service` → Service & leadership,
- `work` → Work experience,
- `personal` → Interests & life,
- `explanation` → future M9 explanation seam,
- `interview` → future M9 interview seam.

Unknown, deleted, or stale owners fail closed. Explanation and interview markers are not advertised as complete until their M9 authoring surfaces are implemented.

## Shared date model seam — M5

- Month/year controls commit canonical `YYYY-MM` strings.
- Exact clinical controls commit canonical `YYYY-MM-DD` strings.
- Clinical `event.fields.rotationStartDate`, `rotationEndDate`, and `rotationDatePrecision` are additive.
- Canonical `event.startDate` and `event.endDate` remain month projections for the retained renderer, layout, export, persistence, and review engines.
- Legacy month-only rotations are explicitly `month-legacy`; no exact day is inferred.
- Canvas drag uses one month delta to update both the month axis and exact clinical fields.

## Shared Media seam — Founder steering refinement

The new Media destination must use the existing `document.advanced.media` asset collection and object-URL registry. Builder preview and Edit Timeline will consume asset references from that same collection. No second blob store, cloud storage, File Vault claim, or production write is permitted.

Implemented seam:

- `PRIMARY_NAV_ITEMS` is the one active five-destination route authority; the inactive superseded shell retains its frozen four-item alias.
- `document.advanced.media` remains the only active Media metadata collection.
- IndexedDB `blobs` remains the only source-byte store.
- `TimelineStore.mutateWithBlobs()` commits document metadata, recovery checkpoint, active pointer, and blob records in one transaction.
- Failed transactions restore the prior in-memory document and persist neither metadata nor blob.
- Undo/redo changes metadata only and intentionally retains referenced source bytes through bounded history/version retention.
- Builder preview and Edit Timeline both consume `application/x-missionmed-media-id` and call the same placement mutation.
- Placement and keyboard nudging change the existing record’s coordinates/visibility; they do not create a record or blob.
- Compatible Advanced media records are listed directly without migration to a second store.
- Immediate destructive asset deletion is not exposed because current versions/history can still reference the source blob.
- Reduced-motion rendering omits animated GIF image URLs in the library and in placed Guided/Advanced board layers.
