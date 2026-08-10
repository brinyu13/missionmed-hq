# D1 Timeline UX-007 — File Vault Integration

## Completed Timeline-owned seam

- Read-only same-origin routes: `/wp-json/missionmed-timeline/v1/file-vault/sources` and `/{id}`.
- Requires logged-in WordPress session, allowed Origin, REST nonce, Timeline entitlement/consent, and stable Timeline principal.
- Delegates only to the existing File Vault V1 read contract and defensively filters every record to the current WordPress owner, including administrators.
- Exposes storage-opaque metadata only: ID, canonical name, provider, document type, exact version, MIME, size, and update time.
- Cross-owner, unconfirmed, and missing sources are indistinguishable 404s; unavailable V1 is a truthful 503 with local-upload fallback.
- Browser adapter performs bounded list/search/select with nonce renewal and never sends the Timeline bearer to the File Vault route.

## Remaining custody gap

Selection does not yet transfer the exact File Vault version's bytes into the Timeline AI intake. A fresh authenticated V1 list/detail/download proof is still required before adding a one-use server-mediated ingestion handoff. No File Vault, Matrix, shared database, R2, CDN, DNS, or live object was modified. If the live V1 contract remains fail-closed, MissionMed Hub/File Vault authority is required; shared storage bypass and unratified V2 are prohibited.
