# J1-FILEVAULT-1020 Predeployment Checkpoint

Date: 2026-09-20

Mission: `J1-FILEVAULT-1020`

Authority: `DR-308`, `DR-309` at MissionMed OS commit `edc23dacaceec30131174e7fbb38c96c93f8f3e6`

Founder packet: `/Users/brianb/Downloads/MX_FILEVAULT_CODEX_RECOVERY_SURGICAL_UPLOAD_PATCH.md`

Founder packet SHA-256: `813c085237fc578b08ce6cfb7c5572d40214329dbbd486fb95bd16e40aa15abb`

## Repository state

- Worktree: `/Users/brianb/MissionMed_worktrees/J1-FileVault-1019-release`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/j1-filevault-1019-production`
- Starting HEAD and starting upstream: `264293554a4f9b152ffb98ce8d707045c6bf5993`
- Starting state: clean; no predecessor 1020 changes were present.
- Preserved baseline: all accepted and deployed J1-FILEVAULT-1019 source and history.
- Unrelated dirty work: none discovered; no unrelated path was modified.

## Exact files changed

- `wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2-repository.php`
- `wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php`
- `wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.js`
- `wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.3f9f0152e8bfbc03.js` (new immutable copy)
- `wp-content/mu-plugins/missionmed-file-vault-v2-scanner.php`
- `tests/file-vault-v2-browser-contract.cjs`
- `tests/file-vault-v2-php-contract.php`
- `tests/file-vault-v2-repository-contract.php`
- `tests/file-vault-v2-scanner-contract.php` (new)
- `tests/file-vault-v2-v1-lock-contract.php`
- `tests/fixtures/file-vault-v2-harness.html`
- this checkpoint

No schema, migration, CSS, Matrix shell, auth, enrollment, RLS, bucket policy, or unrelated product file changed.

## Diff summary

- General uploads now use broad allowance plus a narrow active/executable extension and MIME denylist. Known ordinary formats receive stronger MIME/signature checks. This includes Pages, PDF, legacy DOC, DOCX, text, images, spreadsheets, presentations, common media, ZIP/7z/RAR/TAR/Gzip, and ordinary unlisted extensions.
- The scanner retains content-based executable rejection, rejects macro-enabled/active package content, validates known container structure, and rejects ZIP traversal or active entries.
- Filename parsing treats only the final suffix as the extension. Unicode, spaces, ordinary punctuation, and multiple basename periods survive. Path separators, controls, bidi overrides, traversal, leading-dot names, and extension changes fail closed.
- A user-editable visible version label is separate from the immutable server-assigned numeric revision. The label survives signing, confirmation, reload, version history, and upload success.
- The proposed visible filename is editable and survives Details to Review to Upload. R2 staging and final identities remain UUID-based, so duplicate visible names cannot collide or overwrite.
- The controller pins immutable JavaScript `student-os-file-vault-v2.3f9f0152e8bfbc03.js`. Mutable and immutable SHA-256 are both `3f9f0152e8bfbc034ae5ede0843fb756754daf3aa99f89ddc83124b4be263582`.
- The upload ceiling remains 25 MB, the highest currently proven safe value. It was not raised cosmetically.

## Size ceiling evidence

The requested 250 MB ceiling is unsafe in the current synchronous architecture:

1. Browser checksum calculation reads the entire file into one `ArrayBuffer`.
2. WordPress scanner download uses a non-streamed `wp_remote_get`, holds the full body, then writes a second full copy to a temp file.
3. Scanner download timeout is 30 seconds.
4. Live WordPress reports `WP_MEMORY_LIMIT=40M`; a 250 MB upload cannot fit the scanner's duplicated in-memory representation.
5. Live PHP inspection reported `memory_limit=-1`, `max_execution_time=0`, `max_input_time=-1`, `upload_max_filesize=2M`, and `post_max_size=8M`. Binary bytes go directly to R2, so PHP upload/post limits do not directly cap transfer, but synchronous WordPress confirmation/scanning remains the limiting component.

Supporting 250 MB safely requires incremental browser hashing, streamed scanner download and hashing, bounded container inspection, and verified hosting time/memory behavior. Those are broader architecture changes and are outside this surgical patch.

## Verification before deployment

- `PASS: 108 File Vault V2 PHP contract checks`
- `PASS: 172 File Vault V2 repository workflow checks`
- `PASS: 9 File Vault scanner contract checks`
- `PASS: 41 File Vault V1 fallback lock checks`
- `PASS: 622 File Vault V2 browser, responsive, and accessibility checks`
- PHP lint: controller, repository, scanner PASS
- JavaScript syntax: mutable and immutable assets PASS
- Mutable/immutable byte identity PASS
- `git diff --check` PASS
- Matrix runtime preflight, including production origin and public hashes for `file_vault_js,file_vault_css`: PASS. Protected V1 fallback assets remain unchanged.

The test matrix covers multi-period DOCX/PDF/Pages names, legacy DOC, ZIP, unknown ordinary extension, representative image, editable filename and label persistence, duplicate visible-name storage isolation, immutable revision history, traversal, active/executable and macro denial, exact 25 MB boundary, and over-limit rejection.

## Rollback point

- Source rollback point before this patch: `264293554a4f9b152ffb98ce8d707045c6bf5993`.
- No production mutation has occurred at this checkpoint.
- Before any deployment, capture readable exact-path production preimages. Deploy only the scoped File Vault files, verify live hashes, exercise rollback to those preimages, and reapply only after rollback verification passes.

## Remaining uncertainty and gates

- Production has not been changed or runtime-tested for this patch yet.
- The Critical Systems enforce gate must pass against the committed source before deployment.
- Production preimages, scoped deploy lease, exact live hash proof, rollback/reapply proof, focused authenticated admin/student QA, and post-deploy Matrix/Critical checks remain.
- A fresh independent verifier is still required before final sealing. Builder tests do not satisfy that gate.
- The pre-existing J1-FILEVAULT-1019 two-genuine-student recipient/nonrecipient witness remains a separate open acceptance item and is not recertified here.
