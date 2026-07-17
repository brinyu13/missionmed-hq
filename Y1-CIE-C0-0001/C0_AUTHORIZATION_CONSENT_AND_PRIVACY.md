# Y1-CIE-C0-0001 Authorization, Consent, and Privacy

## Authentication Boundary

CIE does not mint identity. The API adapter requires a preverified host principal with UUID subject, verified role, authority reference, authority-session reference, and explicit capabilities. The service accepts principals only from its pinned adapter instance; a second adapter cannot substitute a principal even if it reuses the same authority label. Production WordPress/HQ/Supabase integration is not present in this ticket.

## Authorization

- Students may act only on their own session and artifacts.
- Mentors require an exact live per-artifact grant.
- A manual Opportunity is private to its verified mentor author and additionally requires that mentor's live grant to the source Moment; sharing that Moment with another mentor does not disclose the Opportunity.
- Restored mentor Moments and Opportunities must retain proof that their exact author held a live source-Moment grant at creation time.
- Integration capabilities do not impersonate a mentor.
- Administrator or faculty status does not imply student-content access.
- Deep-link denial is non-enumerating.
- Replay synchronization never expands authorization.

## Consent

Consent receipts are append-only, purpose-specific, versioned, authority-bound, and superseding. The caller may choose purpose, grant/withdrawal, scope, and optional expiry. The trusted policy authority supplies policy version/hash, locale, retention reference, authority, and server time.

General media sharing does not grant physiology access. Showcase and mentor sharing use separate purposes.

## Privacy and Claims

- No real student data or media was used.
- No patient, institution, or real interview details were used.
- Synthetic fixtures are explicitly marked simulated.
- No clinical competence, readiness, rank, fit, personality, empathy trait, emotion, anxiety, confidence, accent-quality, or Match inference is produced.
- Missing evidence is unavailable, never silently coerced to zero.

## Secret Custody

CIE has zero runtime dependencies and no provider SDK. The runtime and reports were scanned for JWTs, private keys, OpenAI keys, GitHub tokens, and AWS-style access keys. Findings: zero.

## Deletion Privacy

Terminal deletion removes or redacts session-linked evidence bodies, grants, Moments, Opportunities, tracks, priorities, consent rows, and mutation responses. It preserves only policy-safe audit and hashed completion evidence. The disposable PostgreSQL sentinel scan found zero plaintext matches after completion.

## Remaining Release Boundary

No production auth-to-command adapter exists. Any future adapter must preserve UUID identity, exact artifact grants, host authority sessions, no direct DML, and the verifier/executor role split before staging can be considered.
