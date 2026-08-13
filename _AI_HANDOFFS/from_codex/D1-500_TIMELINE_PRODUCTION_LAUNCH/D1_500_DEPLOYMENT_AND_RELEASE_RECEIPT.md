# D1-500 Deployment and Release Receipt

- Final source: `296d74272b520502f35b3d2d5bf7fb9a508a1e7c`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-0fc51f8906decb8e`.
- Payload SHA-256: `57ed9146f44c5d3684a5a873782c19c2da1f1ba4fb832b5708d71ec041fb73f4`.
- Kinsta current pointer: `releases/timeline-wp-0fc51f8906decb8e`.
- Railway deployment: `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`, SUCCESS.
- Railway image digest: `sha256:bbbc05f29891faa3c11e7df84403957347fdd860db2e480cc66c7e267eaff202`.
- PostgreSQL deployment: `3a7f1381-74d4-4327-ac22-6a3e2483eec6`, SUCCESS.
- Schema: `d1-timeline-db-500.1`.
- Production option: enabled; `eligible_360`; canary IDs `[85]`; eligibility verified.
- Canonical route: `https://missionmedinstitute.com/timeline/`.

## Live byte verification

- Runtime: `e424edc9fd022dd225c84763707ef18dece073fddb433821e040bada5e25b820`.
- MU route: `258da3f2a5edf95899f921f5d617ef4f861260ca1be24dd5a8e1c1d4c5621403`.
- Plugin: `20e64ed5af824e8c265a6e9a048f3164967680ce5d752eeda519c66eec8cb6b6`.
- Matrix adapter origin and operational versioned public URLs: `a13c9cd6fa5420f19cc47691c09da07e79f9813b6ee774066f0d89230c131b8c`; the unused bare URL remains an older cached object.

## Verification

- Typecheck PASS.
- Automated tests: 616/616 PASS (129 TypeScript, 487 JavaScript).
- Package verification: 23/23 PASS.
- Release hashes: 62/62 PASS.
- Critical Systems: 142 PASS, 3 WARN, 0 FAIL.
- Matrix runtime lock: 10/10 immutable-source matches, 10/10 Kinsta-origin matches, 9/9 applicable public matches, 0 WARN, 0 FAIL; governing commit `9e02238b195c548b10b5343a33bd247b5de0cee4`.
- Anonymous route: three consecutive 303/no-store/MISS responses.
- Direct Railway without gateway: 403 `GATEWAY_REQUIRED`.

Release payloads contain no secret value. The immutable payload is locally sealed and deployed; it is referenced by the protected manifest and final package checksum. Final metadata closure changed no live Matrix, Timeline, or unrelated production byte.
