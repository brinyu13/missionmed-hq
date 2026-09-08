# D9-415 MU-Plugin Backup Remediation

Status: **SOURCE-ONLY QUARANTINE COMPLETE; PRODUCTION UNCHANGED**

## Finding

The quiescent production snapshot contained both `missionmed-mr-legacy-popup.php` and the executable top-level `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. Both files were 14,800 bytes with SHA-256 `725790239f0dacc344e8a349c0d095ee57d069d00f254f54f1b2b6dff009a52b`. WordPress auto-loads top-level MU-plugin PHP, so the backup filename did not make the second copy inert.

## D9-415B source action

- Preserved the exact observed file at `_SYSTEM/FORENSICS/D9_415/MU_PLUGIN_BACKUPS/missionmed-mr-legacy-popup_BACKUP_PRE004.php`.
- Removed it only from the canonical source top-level MU directory.
- Kept `missionmed-mr-legacy-popup.php` unchanged as the intended-active runtime file.
- Added `_SYSTEM/BASELINES/D9_MATRIX_RUNTIME_2026_07_13/D9_MATRIX_MU_INTENDED_ACTIVE.json` with the nine intended-active Matrix MU files and exact hashes.
- Added `_SYSTEM/scripts/validate_d9_matrix_mu_active_set.py`. It validates source hashes and quarantine integrity; strict-package mode fails on backup/old/copy/disabled/archive patterns and on any unexpected executable top-level PHP.

No `missionmed-hub` byte and no other MU-plugin behavior changed.

## Pre-existing repository exclusions

Three April-era Arena/STAT backup-named PHP files already exist in the repository, were absent from the complete T0/T1 production MU observation, and are outside the ten-file D9 closure. The ticket forbids changing any other MU-plugin behavior, so D9-415 does not move them. They are explicitly excluded from the D9 package, recorded in the intended-active manifest, and would fail strict validation if introduced into a package/runtime root.

## Production boundary

Production still contains and auto-loads `missionmed-mr-legacy-popup_BACKUP_PRE004.php`. D9-415 made no production mutation, cache change, deployment, WordPress change, database change, authentication change, or entitlement change. Removing the production copy requires a later founder-approved remediation with backup, validation, rollback, and cache discipline.

The immutable D9-415A commit and tag retain the exact observed state for provenance and rollback evidence. The D9-415B source head is safer but is still not approved for deployment. D9-416 remains required before implementation or release.
