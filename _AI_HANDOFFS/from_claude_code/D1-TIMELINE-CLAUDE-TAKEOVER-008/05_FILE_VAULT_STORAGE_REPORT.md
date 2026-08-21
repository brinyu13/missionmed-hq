# 05 — File Vault, Storage, Save/Sync and Authorization

## Fixed in this run

### D-02 — The save badge lied about sync state (BLOCKER for §11 truthfulness)
`renderHud` in the legacy shell repainted `#hudSave` as "ALL CHANGES SAVED" on **every**
render, overwriting whatever the D1-407F adapter had just written — including
"SAVED LOCALLY — OFFLINE" and "SYNC CONFLICT — REVIEW". The shell's `state.saved` flag is
only set by 2021-era handlers the adapter never uses, so it stays `true` forever. The
adapter always lost the race.

The adapter now claims the badge (`data-d1407f-owned`) and the shell yields to it, so the
adapter's human vocabulary is the only thing a student reads. A student being told their
work is saved when it is not is the worst possible failure in this area.

### D-05 — Private CV downloads had lost their owner check (SECURITY)
`R2PrivateObjectStore.signDownload` called `requireAuthorizedRecord` but — unlike
`confirmUpload` and `deleteObject` — never called `assertMutableBy`. The in-memory reference
implementation *does* enforce owner equality. Any principal able to read the document could
therefore mint a presigned URL for the student's private CV. `signDownload` now applies the
owner check to `SOURCE` objects; `MEDIA` stays document-scoped so shared boards still load.

### D-06 — The private R2 object key was returned to the browser (SECURITY)
`POST /v1/objects/{id}/confirm` returned the full `ObjectRecord`, whose projection includes
`storageKey` — the live private bucket path. The response is now projected to the fields the
client actually consumes (`id`, `objectClass`, `mimeType`, `byteSize`, `status`,
`confirmedAt`). This restores the storage-opacity invariant the SSO gateway documents for
itself.

## Confirmed but NOT fixed — the File Vault seam is still not live

- **D-01 (BLOCKER)** — File Vault → Smart Fill ingestion is **dead in production**: the
  student's context is forged into a `SERVICE` principal that no RLS policy accepts
  (`src/api/http-api.ts:161`). This is the single reason §10's "choose CV from File Vault"
  journey cannot pass live, and it must be fixed before that journey is claimed.
- **D-03** — The File Vault handoff reports success even when the imported file is rejected,
  and the client's 20 MB limit is below the 25 MB ingestion limit, so files between the two
  fail confusingly.
- **D-04** — File-Vault-ingested CV bytes are never deleted: both the AI-fallback cleanup and
  the student's own "Delete the document" button no-op. A student cannot actually remove
  their CV.
- **D-07** — Media uploaded before secure saving is enabled never reaches private storage and
  disappears silently on any other device.
- **D-08** — File Vault import decodes up to 25 MB of base64 one character at a time on the
  main thread.
- **D-09** — Engine error text is toasted verbatim: IndexedDB codes, authorization reasons
  and object-store internals reach students.
- **D-10** — The chooser lists documents that the very next click provably rejects.
- **D-11 / D-12** — `REMOTE_SYNC_CONSENTED` is not an observable state, so the badge reads
  "SAVED LOCALLY" after secure saving is turned on; and selection makes two round trips for a
  `versionId` the chooser already holds.

## Authorization posture

Identity, entitlement, consent, owner/document/source binding and RLS tests pass in the
suite. The two real leaks found (D-05, D-06) are fixed. **Live persona verification was not
performed** — see `08_SECURITY_REPORT.md` for exactly what that means and what remains
unproven.
