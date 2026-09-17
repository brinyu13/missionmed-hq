# Security Audit

Verified controls:

- HMAC signature verification uses the existing server secret without exposing it.
- Delegated context is actor-bound, target-bound, versioned, and short-lived.
- HQ's unstable session-derived ID is no longer a security dependency.
- PATCH remains CSRF-protected and admin-capability protected.
- Body transport survives the WordPress proxy; header fallback remains supported.
- Cross-actor replay fails.
- Anonymous normal-origin access redirects to WordPress login.
- Anonymous direct operator API access returns `401 UNAUTHENTICATED`.
- Security/audit records contain pseudonymous actor and target keys rather than student PII.

Provider-native audit readback: 2 reorder audit rows, 1 actor, 1 target, actor role `admin`, and zero invalid subject lists. The two events are the controlled swap and restoration.

