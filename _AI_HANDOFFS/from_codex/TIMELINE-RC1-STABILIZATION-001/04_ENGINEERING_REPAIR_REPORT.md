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

## Production failure recovery 002 repairs

- Added migration `20260805223000_rc1_first_use_identity_provisioning.sql` with exactly three narrow policies for first-use principal read/insert and program-membership insert under `timeline_identity_sync`.
- Added deterministic first-use provisioning in `postgres-principal-directory.ts`, including transaction lock, eligibility check, program binding, audit receipt, and authenticated re-read.
- Replaced the standalone technical consent gate with contextual Home onboarding while preserving local-only use until consent is granted.
- Added authenticated WordPress AJAX consent grant/withdrawal in SSO plugin `500.0.4` and a bounded client interceptor with retry-safe failure handling.
- Serialized principal-directory reads on one PostgreSQL client for pg 9 compatibility.
- Preserved the branded safe-load recovery state with Retry and Return to Matrix; no stack, claim, token, key, or object path is exposed.

Final source is `d43af9800ee49407a5cfe43bd2f44b131475867a`. Current Kinsta hashes are SSO `e29b713e2c8aac0a6fcfa71818a01e8a00e35b8c73eed6d6059ec4833b3e8ba5` and WordPress release payload `52a299e814bd6b054e337b8d450f1d987c570739fe4fd9ffebc0d4de2bbd7186`. The static release remains `timeline-f5f8ad51fd48010b`; only WordPress runtime URL packaging changed for the font repair.

The font repair is in `build-wordpress-runtime.mjs`: it rewrites relative CSS `url()` references only inside `<style>` blocks, verifies each referenced file already exists in the accepted content-addressed asset map, and fails the build if a relative inline asset path remains. It does not scan or reinterpret JavaScript strings. The resulting five font requests use immutable `_asset` aliases.
