# Security Report

RESULT: `LOCAL_MENTOR_SECURITY_BASELINE_PASS`

## Fail-closed runtime posture

The 007 mentor plane is default-off. It can run only when every local feature flag is explicitly enabled, the process is non-production, and the bound environment is `FIXTURE` or `LOCAL`. STAGING, LIVE, and production-process in-memory use are denied even if local flags are supplied.

The shared private route continues to authenticate before serving the CAM document. Operations remains capability-gated. Mentor queries and commands rederive principal scope and current assignment; the browser cannot claim tenant, environment, actor, role, capability, assignment, or workload authority.

## Request and response controls

- Exact approved Origin is required for commands.
- Cookie/session mutations require current CSRF from existing `/api/auth/session`.
- JSON is bounded; oversized payloads return `413`, malformed or invalid envelopes fail closed.
- Unsupported methods and unknown routes are denied.
- Query and private JSON responses use `Cache-Control: no-store` and safe nested errors.
- Document responses apply a restrictive CSP: no default sources, no forms, frames, objects, manifests, or workers; only same-origin scripts/styles/connections and self/data images.
- COOP/CORP, DENY framing, `nosniff`, `no-referrer`, restrictive Permissions Policy, noindex, and no-store are present.
- No inline script/style block is required by the CAM index.

## Static asset confinement

The local mount recognizes only exact CAM application routes and a small asset-extension allowlist. It canonicalizes the configured root and candidate with `realpath`, rejects paths outside the root including symlink escape, and never falls back to historical private assets. Encoded traversal returns a safe denial without an absolute path.

This is a local static-asset boundary, not the media broker. It does not authorize transcript/media file access.

## Browser privacy

The CAM client has no localStorage, sessionStorage, IndexedDB, Cache Storage, or Service Worker persistence. CSRF remains memory-only. Offline command input is labeled `NOT SAVED`; the UI does not imply encrypted or durable recovery. Browser probes found no external requests, console/page errors, protected path text, credentials, or production connection in the isolated review suite.

## Data and action safety

- Commands use expected version, full semantic idempotency hash, server-derived scope, command-ID binding, audit, and exact readback.
- One-active-session and subject/assignment continuity are enforced.
- Client authority fields are rejected.
- Assignment expiry/revocation denies further action.
- Capture ID length is bounded so derived review IDs remain within the route contract; rejected values leave no repository residue.
- Publication, AI, Webex, media, notification, and external dispatch remain disabled.
- The historical writer and historical UI fallback remain sealed.

## Evidence

Security-specific browser checks passed 11/11. Local mount, mentor-route, shared-registration, principal, legacy-seal, private-JSON, command replay/concurrency, job-fencing, and foundation security suites passed. Independent audit ended with zero P0/P1/P2 findings.

## Unproved security surfaces

Configured-database RLS, deployed proxy/TLS behavior, real cookies, KMS/encryption at rest, secrets rotation, provider origin/redirect handling, student isolation, backup/restore, production logging, incident response, and runtime vulnerability scanning remain 008–010 gates. No local result weakens those release blockers.
