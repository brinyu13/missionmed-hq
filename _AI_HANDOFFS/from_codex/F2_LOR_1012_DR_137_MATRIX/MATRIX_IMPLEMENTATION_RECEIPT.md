# F2-LOR-1012 DR-137 Matrix Dark-Entry Implementation Receipt

- Ticket: `F2-LOR-1012-DR137`
- Authority: DR-137 canonical Matrix shared launch-seam authority
- Recorded UTC: `2026-08-27T07:30:02Z`
- Base/rebaseline commit: `29907236d7f31ba3a4e1d18f390120b8204ee2ea`
- Transaction: `matrix-lor-final-correction-and-dark-deploy`
- Lease: `SHARED:MATRIX-SHELL`, fencing epoch `344`
- Exposure state: dark; this implementation does not enable Matrix entry or change a student entitlement

## Bounded implementation

| Path | SHA-256 | Purpose |
|---|---|---|
| `wp-content/plugins/missionmed-hub/assets/student-os.js` | `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` | Mutable source removes the legacy in-Matrix LOR renderer/API and adds the fail-closed LOR Studio launch seam. |
| `wp-content/plugins/missionmed-hub/assets/student-os.30068939fc54fb4a.js` | `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` | Byte-identical immutable runtime successor. |
| `wp-content/mu-plugins/missionmed-matrix-lor-studio-entry.php` | `ab87e7272aebdf44f82e640f2d0f7f08111caae67f339c874e9ab85eedf08721` | Default-off controller, strict entitlement projection, immutable pin selector, and exact legacy REST retirement. |
| `tests/matrix-lor-studio-entry-contract.cjs` | `875fa0ff68a64c1730d24bf0891028b7f2bf1bb7e37031f5eb8770c5c966bfa7` | Browser-runtime authorization, navigation, launch, privacy, and legacy-surface contract. |
| `tests/matrix-lor-studio-entry-contract.php` | `4e105235a72374c05300a2df6dd1d5b9c7a60f6bc693a950e050f6fb82aca383` | WordPress mode, entitlement, projection, pin, and legacy-route contract. |

The only permitted external launch target is:

`https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start`

The browser projection has exactly three keys: `allowed`, `route`, and `launchUrl`. Authorization is a literal boolean derived only from `mmhq_lor_studio_current_identity_entitlement()`. The controller has no administrator, capability, query-string, cookie, user-metadata, or module-registration bypass.

The successor additionally requires three exact own data properties before it accepts the browser projection; inherited properties, accessors, extra keys, and prototype pollution fail closed. Both sidebar and manual/deep-link launches use a same-tab anchor with `referrerpolicy="no-referrer"`/`rel="noreferrer"`; the runtime no longer uses `location.assign()` for the LOR seam.

## Validation before deployment

- JavaScript syntax for mutable source, immutable artifact, and CJS test: PASS.
- JavaScript Matrix LOR contract: `142/142 PASS`.
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

The first source checkpoint (`28ffd114d9e2b1a3b15018ff7b5cfd992e86f783`) was not deployed. A final adversarial review found inherited-property authorization and manual-route referrer gaps. All staged incoming bytes were deleted, epoch `342` was released/provider-confirmed inactive with zero active leases, and the production preimage remained exact. A second review rejected non-enumerable-string and Symbol extras as well; epoch `343` was therefore released/provider-confirmed inactive without staging or production mutation. The `Reflect.ownKeys` successor and expanded `142/142` regression contract above supersede both rejected candidates under epoch `344`.

The repository-wide Critical Systems Gate reported unrelated pre-existing composition/staleness findings for products outside this transaction (including StoryForge/Timeline paths). The relevant MissionMed HQ protected paths and public WordPress/HQ routes passed. DR-137 does not authorize expanding this tranche into those unrelated products, so this receipt records the bounded non-green result rather than misrepresenting it as a pass.

## Rollback contract

Deployment must preserve the exact production mutable preimage with SHA-256 `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`. Rollback removes the new controller, restores that preimage atomically, and proves the existing `student-os.809093d2b5b2bc05.js` runtime remains selected. The new immutable successor may remain inert because immutable assets are never overwritten.
