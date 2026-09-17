# Delegated Student View Contract

The delegated context is a versioned HMAC-signed capability containing:

- administrator actor audit ID;
- target canonical student key;
- issuance/expiry state;
- protocol version.

It expires after 20 minutes, is scoped to operator capability, and is validated against the currently authenticated administrator. It intentionally does **not** bind to HQ's sliding session-derived ID, which is not stable across otherwise valid requests.

Priority writes require both the valid delegated context and normal RISE CSRF protection. The browser sends the token in the PATCH body so the existing WordPress proxy cannot strip it; the server retains header fallback for direct/internal clients. A different actor, expired token, changed target, invalid signature, missing CSRF token, or non-admin session fails closed.

