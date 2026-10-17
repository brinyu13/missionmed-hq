# Matrix Runtime v2 App Mode integration

This package is a proposed, non-production integration boundary. It mounts the exact D1-410 release candidate into a Matrix-owned root without an iframe, injects a hybrid IndexedDB adapter, exposes a small lifecycle API, and provides a deterministic return to the Matrix dashboard.

The Matrix host remains responsible for authentication and for obtaining a short-lived Timeline token through the trusted BFF exchange. No WordPress nonce, cookie, email address, or production credential is stored here.

The live Matrix source is unresolved and was not edited. Adoption requires mapping `app-manifest.json` to the authoritative Matrix runtime, completing its own regression suite, and enabling the feature flag only in staging.
