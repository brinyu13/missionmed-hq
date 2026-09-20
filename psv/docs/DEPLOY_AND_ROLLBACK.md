# PSV-PROTOTYPE-0001 · Deploy and rollback packet

For Codex (Builder) or Dr Brian. Fable built and tested this locally; Fable has no production credentials and did not deploy it.

**What this is:** one new WordPress plugin directory, `wp-content/plugins/missionmed-file-vault-ps/`. It edits no existing file. It needs no RISE deploy, no Railway change, no File Vault change, no database change to any existing table, no rewrite flush.

**What must never happen during this deploy:** no edit to `missionmed-hub/`, to any `mu-plugins/` file, or to any runtime-locked File Vault asset; no `git add -A`; no stash, reset, clean or broad checkout; no secret in git, in a handoff file or in chat.

## 1. Preconditions (read-only checks on production)

| Check | Expect | If not |
|---|---|---|
| `wp-content/plugins/missionmed-file-vault-ps/` | does not exist | stop and report; do not overwrite |
| PHP version | 7.4 or newer (built and tested on 8.4; written to 7.4 syntax, not executed on 7.x) | stop |
| PHP extensions `zip`, `dom`, `mbstring`, `json` | loaded | DOCX read and download will report "unsupported"; the rest works |
| `MMED_RISE_ORIGIN` constant | already defined (the existing `/rise/` route proxy uses it) | RISE steps show "not configured"; the synthetic flow up to program choice still works |
| Student OS / File Vault enabled | yes | the File Vault ROOT source shows "not available"; synthetic and pasted ROOTs still work |

## 2. Install (guarded helper, same method as File Vault releases)

1. Upload the directory `missionmed-file-vault-ps/` (code and assets only; the docs, contracts and evidence in this package are **not** uploaded) to `wp-content/plugins/` with the guarded apply helper. There is no preimage because every path is new; record that in the apply log.
2. Verify the upload against `missionmed-file-vault-ps-0.1.0.MANIFEST.sha256`. Put the manifest in a private, non-web directory (for example the guard's `private/` area), then run `cd wp-content/plugins/missionmed-file-vault-ps && sha256sum -c /path/to/missionmed-file-vault-ps-0.1.0.MANIFEST.sha256`. Every file must report OK.
3. On the server, lint with the production PHP binary: `find . -name '*.php' -print0 | xargs -0 -n1 php -l` must report no errors.
4. Add constants to `wp-config.php` on the server (above "That's all, stop editing"). Set them directly on the server. Never commit them, never paste the key anywhere else.

```php
// PSV-PROTOTYPE-0001
define( 'MMED_PS_PROTO_ALLOW_USER_IDS', '<WordPress user id of Dr Brian>[,<test user id>]' );
define( 'MMED_PS_PROTO_OPENAI_API_KEY', '<set on the server only>' );
// Optional. Default is gpt-5.6-terra, the writer model id already present in RISE config.
// define( 'MMED_PS_PROTO_OPENAI_MODEL', 'gpt-5.6-terra' );
```

Do **not** define `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` until the Founder has recorded the privacy decision (PSV-0002 decision 2). Without it, real statement text is never sent to the AI provider; the synthetic ROOT is used for the AI step.
Never define `MMED_PS_PROTO_TESTING`, `MMED_PS_PROTO_TEST_RISE_ORIGIN` or `MMED_PS_PROTO_TEST_OPENAI_BASE` on production; they exist for the local harness only.

5. Activate: `wp plugin activate missionmed-file-vault-ps`. Activation creates four tables (`{prefix}mmed_ps_proto_roots|runs|library|audit`) with `dbDelta` and three options (`mmed_ps_proto_mode = allowlist`, `mmed_ps_proto_allow_admins = 1`, `mmed_ps_proto_db_version = 1`). Nothing else is written.
6. To restrict the prototype to the listed user ids only (no other administrators): `wp option update mmed_ps_proto_allow_admins 0`.

## 3. Verify on production (5 minutes)

| # | Action | Expect |
|---|---|---|
| 1 | Logged out: `curl -s -o /dev/null -w '%{http_code}' https://<site>/wp-json/mmed-ps-proto/v1/bootstrap` | `404` |
| 2 | Logged out: open `https://<site>/?mmed_ps_proto=1` | the normal home page |
| 2b | Logged out: fetch `https://<site>/wp-json/` and search the answer for `mmed-ps-proto`; then `curl -s -o /dev/null -w '%{http_code}' https://<site>/wp-json/mmed-ps-proto/v1` | not found, and `404`: the namespace is registered only for allowlisted users |
| 3 | As a student who is not on the allowlist: open File Vault | File Vault exactly as before; no launcher |
| 4 | As Dr Brian: open File Vault | File Vault exactly as before, plus a small "Program-Specific PS" launcher bottom right |
| 5 | Click the launcher | the prototype opens at `/?mmed_ps_proto=1`; "What is live right now" shows RISE, AI writer, privacy gate, File Vault |
| 6 | Walk the Founder test in the handoff (section 7) | one Essential, one Deep, one "Deep research needed" |
| 7 | `wp-content/debug.log` (if enabled) | no new `MMPS` lines, no new fatals |
| 8 | File Vault upload, review queue, journey, activity for a test student | unchanged |

## 4. Disable and rollback (each level is independent; each was exercised in the local harness)

| Level | Command | Effect | Data |
|---|---|---|---|
| 1. Soft off | `wp option update mmed_ps_proto_mode off` | page, REST and launcher vanish for everyone within one request | kept |
| 2. Hard off | add `define( 'MMED_PS_PROTO_DISABLE', true );` to `wp-config.php` | nothing of the prototype loads beyond two small class files | kept |
| 3. Deactivate | `wp plugin deactivate missionmed-file-vault-ps` | plugin not loaded at all | kept |
| 4. Remove | deactivate first (level 3), then delete the directory `wp-content/plugins/missionmed-file-vault-ps/` | code gone | kept |
| 5. Purge (Founder decision only) | `DROP TABLE {prefix}mmed_ps_proto_roots, {prefix}mmed_ps_proto_runs, {prefix}mmed_ps_proto_library, {prefix}mmed_ps_proto_audit;` then `wp option delete mmed_ps_proto_mode mmed_ps_proto_allow_admins mmed_ps_proto_allow_user_ids mmed_ps_proto_db_version` | saved prototype statements are destroyed | destroyed |

Re-enable after 1 to 3 by reversing the step; the saved library returns intact.

The plugin has no uninstall hook on purpose: removing it never drops the saved statements by accident.

## 5. Failure containment (why a broken prototype cannot hurt File Vault or RISE)

- The main plugin file is about 70 lines. Every other file is loaded through a readability check inside `try { } catch ( \Throwable )`, so a missing file (fatal and uncatchable on PHP 7 if required blindly) and a damaged file (`ParseError`) both make the prototype inert instead of taking the site down. A second copy of the plugin returns at its first line. Tested: a deliberately corrupted class file and a deliberately missing class file each left the home page, the Hub page and the login page at 200 and the prototype at 404.
- For anyone outside the allowlist the prototype costs nothing measurable: no output, no headers, no cron, no rewrite rules, no REST routes (the namespace is not even listed), and the gate reads only autoloaded options after it has established that someone is logged in.
- File Vault is reached only through a subclass that is declared lazily, after reflection proves the parent class is non-final and has the five static members used. Any drift means "File Vault not available", never a fatal. The bridge is read-only and owner-scoped.
- RISE is reached only by GET, through the student's own session. RISE cannot tell the prototype exists.
- The launcher script lives in its own shadow root appended to `<body>`. It never inserts into `#sos-content` or the File Vault stage, so File Vault's mutation observers and renderers never see it.
- No request can hold a PHP worker for long: RISE reads time out at 6 s, the program list stops hydrating after 12 s and hands the rest to "Load more", and generation stays under about 90 s (50 s provider timeout; a second attempt starts only if less than 40 s have passed since the request began, RISE read included), below the usual 100 s edge timeout.
- Statement text never reaches a log: writes that carry text run with `wpdb` error output suppressed, the audit table holds ids, codes and hashes only, and REST answers are `no-store`.
