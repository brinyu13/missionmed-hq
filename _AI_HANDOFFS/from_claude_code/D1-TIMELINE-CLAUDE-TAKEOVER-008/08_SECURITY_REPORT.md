# 08 — Security Report

## Two real defects found and fixed

### Private CV downloads had lost their owner check
`R2PrivateObjectStore.signDownload` (`src/storage/production/r2-private-object-store.ts`)
called `requireAuthorizedRecord` but never `assertMutableBy`, unlike `confirmUpload` and
`deleteObject`. The in-memory reference store at `src/storage/private-object-store.ts:142-149`
*does* enforce `ownerPrincipalId === context.principalId`. The production path had dropped it,
so any principal able to read the document could mint a presigned URL for the student's
private CV.

Fixed: the owner check is applied to `SOURCE` objects (the student's uploaded CV).
`MEDIA` remains document-scoped so shared boards continue to load, and `SERVICE` principals
are unaffected, matching the reference semantics exactly.

### The private R2 object key was returned to the browser
`POST /v1/objects/{id}/confirm` returned the full `ObjectRecord`, whose row projection
includes `storageKey` — the live private bucket path
(`timeline/private/<env>/users/<hash>/documents/<hash>/source/<hash>/<random>`). This
contradicted the storage-opacity invariant the SSO gateway documents for itself.

Fixed: the response is projected to `id`, `objectClass`, `mimeType`, `byteSize`, `status`
and `confirmedAt`. Both existing call sites are unaffected; server-side consumers still
receive the full record.

## What is verified

The automated suite covers identity, entitlement, consent, owner/document/source binding,
RLS, private media, direct-API denial, strict provider output, content-free telemetry and
File Vault storage-opacity. **147/147 TypeScript security and API tests pass** after these
changes, and the full suite is 714/714.

## What is NOT verified — and must not be claimed

**No live persona testing was performed in this run.** The ticket's required matrix —
Founder/administrator, eligible 360 student, non-360, revoked, anonymous, second-student
cross-account attempt, and direct unauthenticated API access — requires authenticated
production sessions that were not available. Specifically unproven:

- Timeline / CV / File Vault / media isolation against a live second student
- That authorization survives direct URLs in production
- That revocation fails closed in production
- Direct unauthenticated API bypass behaviour against the live Railway service

The production API is reachable and healthy (`/healthz` → `{"ok":true,...}`), and
`https://missionmedinstitute.com/timeline/` correctly 303-redirects unauthenticated requests
to `/member-dashboard/`, which is consistent with the gate being in place — but a redirect is
not proof of the full persona matrix, and I am not treating it as such.

## One related finding not yet fixed

**D-01** — File Vault → Smart Fill ingestion forges the student's context into a `SERVICE`
principal (`src/api/http-api.ts:161`). No RLS policy accepts it, so the path is dead rather
than dangerous, but a `SERVICE` principal is the one role that bypasses the owner checks
above. It should be corrected to carry the real student principal before that journey is
enabled, not after.
