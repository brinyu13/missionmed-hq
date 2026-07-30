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
