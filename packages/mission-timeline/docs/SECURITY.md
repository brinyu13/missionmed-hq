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

## Export privacy

The server projects the document by explicit visibility state before rendering. Raw PDF pages, source blocks, extraction candidates, human review actions, local persistence metadata, and recovery metadata are removed. Interviewer-safe output includes only interviewer-safe events/media. Official rendering requires approval of the exact immutable version and hash at queue time and again immediately before render.

## Telemetry

Telemetry uses an event allowlist. Keys that could carry names, emails, titles, notes, comments, source text, filenames, object keys, or signed URLs are rejected. Values containing email addresses, URLs, private-key headers, or bearer tokens are rejected. Audit/outbox payloads contain IDs and workflow metadata, not document text.

## Remaining security gates

Threat modeling, dependency audit, disposable PostgreSQL RLS tests with real roles, R2 policy review, malware scanning, key rotation, rate limiting, CSRF/BFF integration, security headers at the production host, deletion/retention review, and penetration testing remain mandatory before staging or production.
