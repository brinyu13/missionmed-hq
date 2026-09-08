# D9-415 Runtime Lock Reconciliation

Status: **SOURCE PROVENANCE RECONCILED; GLOBAL LOCK UNCHANGED**

## Result

Immutable commit A maps all ten protected production files. Nine match the active protected lock. `class-mmed-student-os.php` is the sole mismatch: production and commit A are `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`, while the former lock byte is `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.

Founder Decision 002 authorizes the exact current controller only as the observed source-recovery baseline. It does not approve Y1-CAM-4005 entitlement behavior. The former controller is preserved unchanged at `_SYSTEM/FORENSICS/D9_415/CONTROLLER_ROLLBACK/former-lock-class-mmed-student-os.php`; the current controller remains in commit A.

## Calendar CSS

The current observed and now active-lock Calendar CSS is `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`. The former lock CSS `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` is preserved at `_SYSTEM/FORENSICS/D9_415/CALENDAR_CSS_ROLLBACK/former-lock-student-os-calendar-v4.css`. Neither byte was edited.

## Branch-local authority

`_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_RUNTIME_SOURCE_LOCK.json` records the canonical repository, recovery branch, worktree, plugin root, exact baseline identity, safe source head at Phase 7, protected hashes, rollback locations, source-only MU quarantine, and open authority gates. It is branch-local evidence; it does not supersede or weaken `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`.

## Open authority

- `G-D9-4`: OPEN.
- Database authority: OPEN — D9-416 required.
- Authentication and entitlement authority: OPEN — D9-416 required.
- Feature-flag, staging, and deployment authority: OPEN — D9-416 required.
- Scheduler's mutable CDN HTML dependency remains an explicit unresolved authority/reproducibility risk.
- `D9-420`: BLOCKED.

D9-415 made zero production, cache, database, authentication, entitlement, feature-flag, CDN, or protected-global-lock mutations.
