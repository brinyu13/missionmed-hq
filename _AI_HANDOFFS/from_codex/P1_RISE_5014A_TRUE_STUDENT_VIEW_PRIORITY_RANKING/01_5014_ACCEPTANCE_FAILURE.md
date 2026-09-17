# Acceptance Failure and Root Cause

The first 5014A implementation was functionally complete but live delegated priority writes returned 403.

Two independent production-only seams caused the failure:

1. The delegated token included the current HQ session ID. HQ uses sliding session expiry, so the derived session ID could change between token issuance and the priority PATCH. This made a valid actor appear to have changed sessions.
2. The WordPress RISE proxy forwards an explicit header allowlist and did not forward `X-RISE-Delegated-Context`, so the browser's signed token never reached RISE.

Repair:

- Removed session ID from the signed delegated payload and verifier.
- Retained actor audit identity, target student key, version, and expiry in the HMAC-signed token.
- Transported the token in the CSRF-protected PATCH JSON body, with header fallback retained for direct clients.
- Added regression tests for session rotation, actor mismatch, and proxy-safe body transport.

No WordPress/HQ auth policy or student-owned preference contract was loosened.

