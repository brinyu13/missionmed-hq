# Wave 1 Subagent A — Production Snapshot and Secret-Safety Analyst

## ROLE

D9-415 Wave 1 Subagent A — Production Snapshot and Secret-Safety Analyst.

## SCOPE

Strictly read-only inspection of the active Kinsta `missionmed-hub` plugin tree, protected Matrix runtime hashes, public asset hashes, permissions, symlinks, filename-level secret risks, and snapshot boundaries. No source content was copied or written and no production state was altered.

## FILES AND SYSTEMS INSPECTED

- Production host `zdu-theresidencyacademy-live-prod` at `2026-07-13T19:22:45Z`.
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`.
- MU directory existence only.
- Active Matrix lock manifest and Matrix passport.
- Safe command classes: `find -P -xdev`, `stat`, `readlink`, SHA-256, and public fetch piped directly to SHA-256 without printing bodies.

## FACTS ESTABLISHED

- 131 entries: 123 regular files and eight directories including root.
- Files mode `0644`; directories `0755`; no symlinks or special files.
- No cache/log/upload/session/temp/dump/`.env`/credential/key/token/backup-named entry was observed by filename inside the plugin root.
- An exact baseline must initially retain all 123 files; apparently non-runtime documentation, prototypes, duplicates, and `assets/test-deploy.txt` cannot be excluded without breaking exactness.
- Current protected observations:
  - `assets/student-os.646e3598d284fff3.js`: `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`.
  - `assets/student-os.js`: same `646e3598...` hash.
  - `assets/student-os.css`: `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33`.
  - `includes/class-mmed-student-os.php`: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` — active-manifest mismatch.
  - Calendar JS: `e9ef490cd15b10c2d43726d9249c1b623dbd5077a1728b128c50e10ca11010aa`.
  - Calendar CSS: `6e519195f199b3f545690530bf78ffc35897b7ca70ca66428e72873714f4547e`.
  - Scheduler mount: `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578`.
  - File Vault JS/CSS: `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd` / `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990`.
  - StoryForge JS/CSS: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` / `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`.
- Nine publicly checked static artifacts matched production origin.
- Content-level secret safety was not established; filename checks are insufficient.

## CONFLICTS

- Manifest expects controller `c0a538d3454ff4a05822e00ace01ebf933a8bbfcf1722fc2be382527743d78cb`.
- Production observed controller `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`, size 32,786, mode `0644`, mtime `2026-07-13T18:52:21.956329834Z`.
- Production changed nearly four hours after the active manifest update.
- Stop boundary: no production command was run after the protected-file/public-hash command returned the mismatch.

## P0 BLOCKERS

- Protected production and the active manifest conflict.
- Further production inspection/copy/import/attestation is blocked pending exact authority resolution.
- The observed hash must not be normalized to the manifest, nor the manifest value represented as current production.

## P1 RISKS

- No content-level secret scan.
- Dependency closure cannot safely be reduced below the full plugin tree.
- The 4.96 MB Webex adapter lacks reproducible-source provenance.
- Source alias and fingerprinted shell are byte-identical but both are currently shipped.

## RECOMMENDED MAIN-AGENT ACTIONS

- Freeze production commands and import writes.
- Obtain exact authority for the observed controller and quiescent cutoff.
- After clearance, perform one minimal pre-copy consistency check, atomic non-symlink-following snapshot, and redacted local content scan.
- Preserve all 123 plugin files in the exact baseline.

## EVIDENCE PATHS

- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

## CONFIDENCE

High for metadata/hashes/public-origin coherence; low for secret safety until a quarantined content scan runs.

## UNRESOLVED QUESTIONS

Who authorized `23da5c...`; is production quiescent; does the class contain environment-specific values; which shipped residues are intentionally runtime material?

