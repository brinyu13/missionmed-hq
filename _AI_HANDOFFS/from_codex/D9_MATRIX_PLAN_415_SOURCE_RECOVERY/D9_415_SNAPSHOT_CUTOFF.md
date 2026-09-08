# D9-415 Quiescent Snapshot Cutoff

Status: `PASS` — T0 and T1 compare identically and the local copy is verified.  
Authority: `D9-415-FOUNDATION-002`  
Production transport: read-only SSH through `missionmed-kinsta`  
Production mutation authorized: `NO`

## Included production observation scope

The quiescence envelope covers the complete `missionmed-hub` plugin tree and the complete `wp-content/mu-plugins` tree. The full MU tree is observed so the required Matrix-related MU-plugin dependency set can be selected without allowing an unobserved concurrent change. Only the proven Matrix-related set may later be imported into Git; unrelated MU source remains forensic evidence outside the product tree.

## Exact T0/T1 procedure

1. Capture a complete, sorted T0 manifest from production using read-only commands. For every entry, record scope-relative path, file type, byte size, SHA-256 for regular files, and numeric mode. Record the production server timestamp only after the complete manifest has been emitted; that completion timestamp is T0.
2. Copy the two observed trees inbound to a permission-restricted local forensic snapshot using an SSH/tar read stream. Do not move, rename, write, chmod, touch, activate, flush, or otherwise mutate any production path.
3. Capture a second complete, sorted manifest through the same read-only command and schema. Record the production server timestamp only after the complete manifest has been emitted; that completion timestamp is T1.
4. Compare T0 and T1 mechanically on scope-relative path, type, size, SHA-256, and mode. Also verify the copied snapshot against the T0 manifest.
5. Independently confirm that `includes/class-mmed-student-os.php` remains exactly `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29` and that the selected Matrix-related MU dependency set is unchanged.
6. If any entry differs, stop before import or commit, report `PRODUCTION NOT QUIESCENT` with the changing paths and both observations, and do not combine bytes from different observation times.
7. If every comparison passes, freeze the local snapshot as the formal no-further-write D9-415 provenance cutoff. Subsequent source recovery is derived only from that immutable local snapshot.

## Authorized cutoff text

The authorized production snapshot cutoff is dynamic and evidence-based.

Define:

T0 = the timestamp of the final complete pre-snapshot production manifest.

T1 = the timestamp of the complete post-snapshot production manifest.

The production runtime qualifies as quiescent for D9-415 only when:

1. A full pre-snapshot manifest is captured at T0.
2. The local forensic snapshot is copied read-only.
3. A full post-snapshot manifest is captured at T1.
4. Every included production path has the same:
   - relative path
   - file type
   - size
   - SHA-256
   - mode, where available
5. The current controller remains exactly:

   23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29

6. The required Matrix-related MU-plugin dependency set remains unchanged.
7. No production file changes during the T0-to-T1 snapshot window.

If any production path changes between T0 and T1:

STOP BEFORE IMPORT OR COMMIT.

Report:

PRODUCTION NOT QUIESCENT

Do not combine files from different observation times.

Do not retry repeatedly without reporting the changing paths and hashes.

A successful identical T0/T1 comparison becomes the formal no-further-write snapshot cutoff for D9-415 provenance.

This cutoff does not prevent other authorized teams from later changing production. It defines only the immutable production state captured by D9-415.

## Executed cutoff result

- T0 completed: `2026-07-14T00:31:00.453619187Z`
- T1 completed: `2026-07-14T00:31:03.315562100Z`
- T0/T1 normalized manifest SHA-256: `88c8be901df41ba260d5c3091f08dc87cd6d4ad9b36423e24e437373ea2b2a61`
- T0/T1 comparison: `IDENTICAL`
- Total observed entries: `287`
- `missionmed-hub`: `125` regular files, `8` directories
- full MU observation envelope: `126` regular files, `28` directories
- symlinks/special entries: `0`
- current controller: `23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`
- local copied entries: `287`
- local path/type/file-size/SHA-256/MD5/mode mismatches after transfer normalization: `0`
- production mutations: `0`

macOS tar initially applied the restrictive local `umask` to copied entries, yielding only mode mismatches (`600/700`) while every path, type, file size, SHA-256, and MD5 was exact. The local snapshot modes were mechanically restored from T0 without another production read; the full verifier then passed with zero mismatches. The enclosing forensic directory remains permission-restricted.

The earlier Wave 1 report estimated `123` plugin files. The authoritative full T0/T1 manifest independently counted `125`, and a second local filesystem count confirmed `125`. No T0/T1 drift occurred; the Wave 1 count is superseded as an inventory-count error, while its named-file hashes and safety findings remain valid.
