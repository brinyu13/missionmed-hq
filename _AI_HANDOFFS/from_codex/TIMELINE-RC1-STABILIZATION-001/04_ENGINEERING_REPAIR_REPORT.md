# Timeline RC1 Engineering Repair Report

The bounded RC1 implementation changed only Timeline-owned files across three repair commits. The first delivered the renderer, browser media, persistence, auth-renewal, production R2, CSP, build, and test work. The second corrected the R2 presigning policy found during canary. The third reconciled approved-administrator device-local persistence with the existing student-only remote-document and RLS authority.

Key engineering repairs:

- Added private R2 production storage using the existing `timeline.media_objects` custody and RLS model; no schema migration was required.
- Added short-lived signed PUT/GET grants, HMAC-bound confirmation tokens, opaque HMAC-scoped object paths, exact integrity confirmation, quarantine, replay denial, owner/service enforcement, and physical delete plus durable `DELETED` state.
- Added Timeline API routes for object signing, confirmation, download signing, and deletion.
- Added browser upload/download integration that persists opaque object IDs and keeps `blob:` URLs temporary.
- Added fail-soft protected-kernel media projection; one missing asset no longer destroys the timeline.
- Added presentation-signature invalidation and scoped preview scheduling.
- Added proactive JWT refresh and visibility recovery without weakening logout, revocation, or account-switch locks.
- Added deterministic local/cloud sync states.
- Minified the production release bundle.
- Restricted WordPress CSP `connect-src` to the exact private R2 S3 host.
- Made approved-administrator persistence explicitly device-local and fail-closed at the server media boundary; no administrator RLS grant was invented.

Protected presentation files were not modified. Their retained hashes are:

- HTML: `bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24`.
- CSS: `4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7`.
- JavaScript: `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.

Production installation used a feature-off pointer cutover, exact hash verification, canary admission, then restoration of the accepted eligible-360 settings. The final WordPress plugin hash remains `20e64ed5af824e8c265a6e9a048f3164967680ce5d752eeda519c66eec8cb6b6`; the immutable runtime payload hash is `6d6542c13f6dfd34ec9cda8c4b3b4788e704e87833a35db84d2735aaff0def90`.
