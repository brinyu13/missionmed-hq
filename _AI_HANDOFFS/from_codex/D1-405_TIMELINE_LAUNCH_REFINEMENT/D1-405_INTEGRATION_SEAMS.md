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
