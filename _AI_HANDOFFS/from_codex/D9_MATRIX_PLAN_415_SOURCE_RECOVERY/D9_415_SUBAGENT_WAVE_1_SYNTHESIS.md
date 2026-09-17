# D9-415 Subagent Wave 1 Synthesis

Ticket: `D9-MATRIX-PLAN-415`  
Wave status: **4/4 COMPLETE**  
Mode: four independent read-only specialists; main-agent synthesis  
Snapshot authorization: **BLOCKED AT IMPORT BOUNDARY**

## Converged finding

All four agents independently support the same disposition: D9-415 has a valid repository/base/worktree and can identify the active plugin/MU runtime, but it must not snapshot, import, commit, tag, package, push, or attest source while a protected production controller differs from the active Matrix lock and changed after that lock's validation.

Direct production observation at `2026-07-13T19:22:45Z` found:

- production `includes/class-mmed-student-os.php`: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`;
- active lock: `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`;
- production mtime: `2026-07-13T18:52:21.956329834Z`;
- manifest validated: `2026-07-13T14:55:56Z`.

Main-agent local verification established that `23da5c...` is exactly the Y1-CAM-4005 candidate and `c0a538...` is exactly its pre-change backup/Y1-CAM-4004 source. The new candidate changes entitlement evaluation, so this is not harmless metadata drift.

## Production plugin root

`/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`

Observed complete metadata inventory: 123 files, eight directories including root, all files `0644`, directories `0755`, no symlinks/special entries. No content was copied. Until dependency analysis and local secret scanning are complete, the exact baseline inclusion set is all 123 files.

## Matrix-related MU dependency set

Confirmed required/import candidates pending full closure and secret scanning:

- `missionmed-matrix-account-entry.php` — `4c0a10ba39c0dab81d97a5ff4d0a5d6f235e3f778493b6f78d89aae269b712ba`;
- `missionmed-hq-auth-handoff.php` — `f8c14ce4c833174fd1f7837e7a669f390a9cfc03fabcbf4db66d29b1b69ed4b3`;
- `missionmed-hq-proxy.php` — `85e155f7f5e00ac465e1e5d61b4160d0d7a4d2fa97178bbb52adb8d811d3ccb3`;
- `missionmed-supabase-session-cookie-auth.php` — `d343f7581e3c131bc9a4f5e6a1f2c2c8966c82b9e88d01e92430989e505dc26f`;
- `mm-scheduler-webex-broker.php` — `5544dccf9504266db42105fea048db6687ad28cd53865b3df8aaeff6c4154455`;
- `missionmed-mr-legacy-popup.php` and executable byte-identical backup `missionmed-mr-legacy-popup_BACKUP_PRE004.php` — backup SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`;
- directly required includes discovered from these files and hub bootstrap, after exact closure is revalidated at the quiescent snapshot cutoff.

WordPress auto-loads every top-level filename ending `.php`; therefore the backup is active regardless of its name.

## Snapshot inclusion and exclusion rules

Pending authority clearance:

- Exact observed plugin baseline: include all 123 production files, unchanged.
- MU baseline: include only proven Matrix dependency closure, including the unsafe backup exactly as observed.
- Exclude logs, caches, uploads, sessions, temp files, DB exports, user/private data, credentials, environment files, keys, authorization material, and unsafe symlinks.
- No such excluded category was identified by plugin-root filename/metadata, but content-level scanning has not occurred.
- Seemingly non-runtime docs/prototypes/duplicates/test files remain in the immutable exact baseline unless direct dependency and provenance evidence permits a documented exclusion. Packaging may exclude them later; D9-415A may not.

## Secret-scan and student-data status

- Filename/metadata scan: no obvious secret/data file in the plugin root.
- Content-level secret/high-entropy scan: **NOT RUN — NO LOCAL SNAPSHOT AUTHORIZED**.
- Student/private-data scan: **NOT RUN — NO LOCAL SNAPSHOT AUTHORIZED**.
- Status: **PARTIAL / BLOCKING BEFORE IMPORT**.

No secret, credential value, cookie, request payload, option value, environment value, or student data was printed or filed.

## Git provenance status

- Canonical recovery repo/branch/worktree/base are proven.
- No existing commit, branch, or tag contains the complete current production plugin.
- Remote `main` contains zero plugin files.
- The historical Matrix branch and known-good tag are not current source authority.
- Current production must be imported directly after clearance; local exports and objects are supporting provenance only.

## Exact-hash validation plan

After exact authority and a quiescent cutoff:

1. One minimal before-check of the disputed controller and snapshot root.
2. Atomic/non-symlink-following plugin and targeted MU snapshot.
3. Immediate after-manifest; abort if any entry changes.
4. Local redacted secret/private-data scan before product-tree copy.
5. Complete path/type/mode/size/SHA-256/MD5 classification.
6. Protected current and historical D9-410 hash mapping, explicitly distinguishing changed shell bytes.
7. Git blob OID plus SHA-256 for every baseline file.
8. `git ls-tree`, `git cat-file`, archive/fresh-checkout, and remote-ref verification.

## Packaging and CI plan

- Stdlib-only, tracked-source-only deterministic packager.
- Clean-tree requirement; canonical path ordering, modes, timestamps, metadata, version, file manifest, commit/branch/package SHA-256.
- Two independent temp builds must be byte-identical.
- CI least privilege/read-only, no secrets/environments/network production checks, no deploy/upload/cache/DB/WordPress/flag action.
- Never use `matrix_runtime_guard.py --brian-approved` as a CI pass condition.
- Backup scan must target the recovered Matrix MU set without broadening scope to unrelated inherited files.

## Rollback and release plan

- D9-415A and its immutable non-deployable tag preserve exact observed bytes, including the unsafe backup.
- D9-415B would preserve that backup unchanged outside autoload source and remove only the active source-path copy.
- Preserve current Calendar CSS `6e519195...` and former lock CSS `41b3a295...` as separate evidence.
- No production rollback/deploy is performed.
- Scheduler CDN HTML remains mutable/unpinned and is a D9-416 authority requirement.

## Material conflicts

1. `class-mmed-student-os.php` production/active-lock mismatch.
2. The observed production byte exactly matches Y1-CAM-4005 and alters entitlement logic.
3. Production appears to have changed during the recovery window; no quiescent cutoff is established.
4. Current active lock is itself an uncommitted protected-root change and cannot supply cloneable Git provenance.
5. Production auth handoff also has a current-day change and differs from tracked local source.

## P0 blocker and stopping boundary

The affected write phase is blocked under BOOT, Matrix lock, Critical Systems, and ticket hard-stop rules. No generic or inferred override is sufficient. Required resolution must explicitly identify:

- ticket `D9-MATRIX-PLAN-415`;
- controller production hash `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`;
- active-lock hash `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`;
- whether Y1-CAM-4005 production behavior is authorized/intended;
- the exact no-further-write/quiescent production cutoff;
- permission to recover the exact observed bytes despite the active-lock mismatch, without changing production.

Until then:

- forensic source copy: BLOCKED;
- product-tree import: BLOCKED;
- D9-415A/tag and later commits: BLOCKED;
- packaging/Wave 2/publication/handoff completion: BLOCKED;
- production/database/cache/flag mutations: ZERO.

## Main-agent decision

Wave 1 is complete but does **not** authorize a production snapshot. The correct current verdict is `BLOCKED AT PHASE 1`. Earlier handoff/evidence work is preserved; the run may resume from `D9_415_RUN_STATE.json` after exact authority resolution.

## Resume resolution under D9-415-FOUNDATION-002

Founder Decision 002 explicitly authorized controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` for current-observed-source recovery while preserving `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb` as historical/rollback evidence and deferring behavior to D9-416. Identical T0/T1 manifests at `2026-07-14T00:31:00.453619187Z` and `2026-07-14T00:31:03.315562100Z` established the quiescent cutoff.

The complete manifests corrected Wave 1's plugin count from 123 to 125 files. The final source-evidenced Matrix MU closure contains ten files: the seven originally confirmed candidates plus `missionmed-drj-drills-access.php`, its direct custom-function provider `arena-route-proxy.php`, and `missionmed-performance-boost.php`, which explicitly preserves the exact Matrix asset version paths. Content-level redacted scanning passed before import.
