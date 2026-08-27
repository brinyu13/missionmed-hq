# F2-LOR-1012 DR-137 Matrix Dark-Entry Implementation Receipt

- Ticket: `F2-LOR-1012-DR137`
- Authority: DR-137 canonical Matrix shared launch-seam authority
- Recorded UTC: `2026-08-27T07:30:02Z`
- Base/rebaseline commit: `29907236d7f31ba3a4e1d18f390120b8204ee2ea`
- Transaction: `matrix-lor-source-and-dark-deploy`
- Lease: `SHARED:MATRIX-SHELL`, fencing epoch `342`
- Exposure state: dark; this implementation does not enable Matrix entry or change a student entitlement

## Bounded implementation

| Path | SHA-256 | Purpose |
|---|---|---|
| `wp-content/plugins/missionmed-hub/assets/student-os.js` | `56c7c339ee12cdd06874241fa6134e1db41721e425dc9d988b4af110368dc3fa` | Mutable source removes the legacy in-Matrix LOR renderer/API and adds the fail-closed LOR Studio launch seam. |
| `wp-content/plugins/missionmed-hub/assets/student-os.56c7c339ee12cdd0.js` | `56c7c339ee12cdd06874241fa6134e1db41721e425dc9d988b4af110368dc3fa` | Byte-identical immutable runtime successor. |
| `wp-content/mu-plugins/missionmed-matrix-lor-studio-entry.php` | `9e21ac1b1f0f1db8131090300e73e5e86e1ae5dc1f09cd974c47016e2c5dc1a0` | Default-off controller, strict entitlement projection, immutable pin selector, and exact legacy REST retirement. |
| `tests/matrix-lor-studio-entry-contract.cjs` | `e14a8b29b71c41402d7d3081f887178a5f08424ae8eb593480cf234f203b4a4a` | Browser-runtime authorization, navigation, launch, privacy, and legacy-surface contract. |
| `tests/matrix-lor-studio-entry-contract.php` | `79d8ee6bf8ca7b0e487919481fd5bc5f2fa501506ff739aa4faf3649ebd537b9` | WordPress mode, entitlement, projection, pin, and legacy-route contract. |

The only permitted external launch target is:

`https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start`

The browser projection has exactly three keys: `allowed`, `route`, and `launchUrl`. Authorization is a literal boolean derived only from `mmhq_lor_studio_current_identity_entitlement()`. The controller has no administrator, capability, query-string, cookie, user-metadata, or module-registration bypass.

## Validation before deployment

- JavaScript syntax for mutable source, immutable artifact, and CJS test: PASS.
- JavaScript Matrix LOR contract: `89/89 PASS`.
- PHP syntax for controller and PHP test: PASS.
- PHP Matrix LOR contract: `86/86 PASS`.
- File Vault V2 PHP contract: `72/72 PASS`.
- File Vault V2 repository workflow: `92/92 PASS`.
- Mutable/immutable byte identity and SHA-derived filename: PASS.
- Every pre-existing manifest source path other than the authorized mutable Matrix source is unchanged from `29907236d7f31ba3a4e1d18f390120b8204ee2ea`: PASS.
- Protected Matrix pin, student controller, File Vault V2 controller/runtime/CSS/repository, and prior immutable `809093d2b5b2bc05` artifact are unchanged: PASS.
- `git diff --check`: PASS.
- Focused credential-pattern review found only pre-existing in-code request/mount token variables and URL password rejection checks; no credential value is present.

The browser contract requiring Playwright was not rerun in this worktree because that optional dependency is absent. Its historical frozen baseline was already green before the authorized source edit, while the new dependency-free browser-runtime contract directly exercises the changed route behavior.

## Pre-deployment guards

The Matrix origin/public guard matched all production-locked assets and reported one expected local-source difference: `student_os_js`. That difference is exactly the DR-137-authorized successor above; no production byte had changed at that point.

The repository-wide Critical Systems Gate reported unrelated pre-existing composition/staleness findings for products outside this transaction (including StoryForge/Timeline paths). The relevant MissionMed HQ protected paths and public WordPress/HQ routes passed. DR-137 does not authorize expanding this tranche into those unrelated products, so this receipt records the bounded non-green result rather than misrepresenting it as a pass.

## Rollback contract

Deployment must preserve the exact production mutable preimage with SHA-256 `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`. Rollback removes the new controller, restores that preimage atomically, and proves the existing `student-os.809093d2b5b2bc05.js` runtime remains selected. The new immutable successor may remain inert because immutable assets are never overwritten.
