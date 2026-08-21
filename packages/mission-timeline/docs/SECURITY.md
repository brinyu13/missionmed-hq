# Security and privacy model

## Identity

The Timeline service accepts a short-lived HMAC session only after a trusted Matrix BFF supplies nonce-verified WordPress identity. Mapping uses immutable WordPress user ID to an internal principal. Caller-supplied email and body claims are not identity authority.

## Authorization

Authorization is deny-by-default and relationship based:

- students act only on documents they own;
- advisors require an active document assignment and matching program;
- program administrators are restricted to program scope;
- faculty require explicit, action-specific, time-bound grants;
- service principals require narrow scopes;
- platform administrators receive no ambient document access; break glass requires a reason and expiry.

The proposed database migration repeats these boundaries with RLS. It revokes public schema/table access and contains no `USING (true)` policy.

## Content and storage

- Active HTML, credential patterns, and likely patient identifiers are blocked from stored text.
- Source extraction stays quarantined until a human accepts a candidate.
- Object keys are server-generated and contain no student name, email, or filename.
- Upload authorization expires after five minutes and binds size, MIME type, and SHA256.
- A mismatch quarantines the object.
- Downloads are private and short-lived.
- Service-created export objects retain the student as owner.

## CV intelligence and File Vault sources

- Remote CV intelligence is optional and server-only. It starts only after the student accepts the configured consent version and the service verifies that the confirmed private `SOURCE` object belongs to the same principal and Timeline document.
- Provider requests contain bounded source blocks and a minimal existing-event summary, never browser credentials, session tokens, signed object URLs, object keys, or storage capabilities. The provider request disables response storage and requires a strict JSON schema.
- Every candidate field must cite a verified source block and supported excerpt. Deterministic post-validation rejects unsupported facts, invalid taxonomy, unbound excerpts, and unsafe bulk acceptance. Provider failure falls back to a clearly labeled limited local parser and never fabricates candidates.
- Configure all four server-only values together: `TIMELINE_AI_PROVIDER`, `TIMELINE_AI_API_KEY`, `TIMELINE_AI_MODEL`, and `TIMELINE_AI_CONSENT_VERSION`. A partial configuration stops service startup; no values may be exposed to the browser, logs, artifacts, or evidence.
- Timeline's File Vault gateway is read-only and same-origin. List/detail recheck WordPress nonce, Origin, Timeline entitlement/consent, immutable principal mapping, current owner, and confirmed current version, and expose only storage-opaque metadata. The explicit ingestion action rechecks the exact version, consumes the five-minute File Vault URL only inside WordPress, verifies MIME/size/SHA256, and transfers the bytes server-to-server into the same student's private Timeline `SOURCE` custody. The browser receives only the temporary file bytes needed by the bundled PDF/DOCX parser plus opaque provenance; it never receives a signed URL, object key, comments, advisor content, or cross-owner record. A missing or unhealthy V1 contract fails closed and preserves local upload.

## Export privacy

The server projects the document by explicit visibility state before rendering. Raw PDF pages, source blocks, extraction candidates, human review actions, local persistence metadata, and recovery metadata are removed. Interviewer-safe output includes only interviewer-safe events/media. Official rendering requires approval of the exact immutable version and hash at queue time and again immediately before render.

## Telemetry

Telemetry uses an event allowlist. Keys that could carry names, emails, titles, notes, comments, source text, filenames, object keys, or signed URLs are rejected. Values containing email addresses, URLs, private-key headers, or bearer tokens are rejected. Audit/outbox payloads contain IDs and workflow metadata, not document text.

## Remaining security gates

Threat modeling, dependency audit, disposable PostgreSQL RLS tests with real roles, R2 policy review, malware scanning, key rotation, rate limiting, CSRF/BFF integration, security headers at the production host, deletion/retention review, and penetration testing remain mandatory before staging or production.
