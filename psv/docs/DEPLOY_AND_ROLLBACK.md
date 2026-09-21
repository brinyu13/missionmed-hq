# Program-Specific PS · Deploy and rollback packet

For Codex (Builder) or Dr Brian. Fable built and tested this locally; Fable has no production credentials and did not deploy it.

**What this is:** one new WordPress plugin directory, `wp-content/plugins/missionmed-file-vault-ps/`. It edits no existing file. It needs no RISE deploy, no Railway change, no File Vault change, no database change to any existing table, no rewrite flush.

**What must never happen during this deploy:** no edit to `missionmed-hub/`, to any `mu-plugins/` file, or to any runtime-locked File Vault asset; no `git add -A`; no stash, reset, clean or broad checkout; no secret in git, in a handoff file or in chat.

## 1. Preconditions (read-only checks on production)

| Check | Expect | If not |
|---|---|---|
| `wp-content/plugins/missionmed-file-vault-ps/` | absent for first install, or exactly the currently approved live version for an upgrade | stop and report; do not overwrite unknown custody |
| PHP version | 7.4 or newer (built and tested on 8.4; written to 7.4 syntax, not executed on 7.x) | stop |
| PHP extensions `zip`, `dom`, `mbstring`, `json` | loaded | DOCX read and download will report "unsupported"; the rest works |
| `MMED_RISE_ORIGIN` constant | already defined (the existing `/rise/` route proxy uses it) | RISE steps show "not configured"; the synthetic flow up to program choice still works |
| Student OS / File Vault enabled | yes | the File Vault ROOT source shows "not available"; synthetic and pasted ROOTs still work |

## 2. Install (guarded helper, same method as File Vault releases)

1. Take a private, byte-exact rollback copy when upgrading. Then upload the directory `missionmed-file-vault-ps/` (code and assets only; the docs, contracts and evidence in this package are **not** uploaded) to `wp-content/plugins/` with the guarded apply helper. Record an absent preimage for a first install or the exact approved version/hash for an upgrade.
2. Verify the upload against the version-matched `missionmed-file-vault-ps-<version>.MANIFEST.sha256` supplied with the release. Put the manifest in a private, non-web directory, then run `cd wp-content/plugins/missionmed-file-vault-ps && sha256sum -c /private/path/missionmed-file-vault-ps-<version>.MANIFEST.sha256`. Every file must report OK and there must be no extra deployed file.
3. On the server, lint with the production PHP binary: `find . -name '*.php' -print0 | xargs -0 -n1 php -l` must report no errors.
4. Add constants to `wp-config.php` on the server (above "That's all, stop editing"). Set them directly on the server. Never commit them, never paste the key anywhere else.

```php
// Program-Specific PS
define( 'MMED_PS_PROTO_OPENAI_API_KEY', '<set on the server only>' );
// Optional. Default is gpt-5.6-terra, the writer model id already present in RISE config.
// define( 'MMED_PS_PROTO_OPENAI_MODEL', 'gpt-5.6-terra' );
```

Under DR-331, keep `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` **undefined**. It is a retired broad switch and is not needed for normal production. In `members` mode, an administrator or a current, server-verified MissionMed 360 member may intentionally select, paste or upload a ROOT, confirm its exact editable region, and send the complete ROOT to the dedicated PSV OpenAI project as read-only context. The provider may return text only for that region; server-side reconstruction and protected-paragraph hashes remain mandatory.
Never define `MMED_PS_PROTO_TESTING`, `MMED_PS_PROTO_TEST_RISE_ORIGIN` or `MMED_PS_PROTO_TEST_OPENAI_BASE` on production; they exist for the local harness only.

5. Activate, or load the already-active upgraded plugin. `dbDelta` creates/upgrades eleven isolated tables (`{prefix}mmed_ps_proto_roots|runs|library|audit|jobs|job_items|provider_attempts|research_artifacts|similarity_fingerprints|similarity_buckets|edit_revisions`) and four namespaced options (`mmed_ps_proto_mode`, `mmed_ps_proto_allow_admins`, `mmed_ps_proto_allow_users`, `mmed_ps_proto_db_version = 6`). The installer records version 6 only after probing required columns and unique indexes. Nothing outside the PSV namespace is written. Immutable private paragraph revision chains preserve the original AI candidate and provenance; changed wording cannot inherit grounding or approval and must pass fresh validation. Owner-scoped, request-transient DOCX/TXT ROOT ingestion and one same-page nonce refresh handle uploads and stale WordPress cookies. No AI call is made by menu navigation, upload ingestion, candidate switching or editing.
6. Leave administrator access enabled unless a later authority record explicitly narrows it: `mmed_ps_proto_allow_admins = 1`.

7. Under DR-327 and DR-331, set `mmed_ps_proto_mode` to `members`. This admits administrators by `manage_options` and non-admin students only when the canonical `mmhq_cam_build_entitlement()` claim is active, trusted, verified, current, revocation-checked, unrestricted, unrevoked, unexpired and backed by either verified LearnDash + WooCommerce or verified legacy-current LearnDash authority. Any missing or malformed claim fails closed.

## 3. Verify on production (5 minutes)

| # | Action | Expect |
|---|---|---|
| 1 | Logged out: `curl -s -o /dev/null -w '%{http_code}' https://<site>/wp-json/mmed-ps-proto/v1/bootstrap` | `404` |
| 2 | Logged out: open `https://<site>/?mmed_ps_proto=1` | the normal home page |
| 2b | Logged out: fetch `https://<site>/wp-json/` and search the answer for `mmed-ps-proto`; then `curl -s -o /dev/null -w '%{http_code}' https://<site>/wp-json/mmed-ps-proto/v1` | not found, and `404`: the namespace is registered only for authorized users |
| 3 | As a logged-in user without current 360 entitlement: open Matrix | Matrix is unchanged; no PSV menu item or launcher; direct page/REST stay undisclosed |
| 4 | As a current 360 member and as an administrator: open Matrix | "Program-Specific PS" appears immediately after File Vault; the existing File Vault launcher remains secondary |
| 5 | Use the menu item | PSV opens at `/?mmed_ps_proto=1`; simple navigation makes no provider call |
| 6 | Complete a normal student flow with a deliberately supplied real ROOT | confirm region, generate five candidates, compare/edit if desired, approve/save, and download; protected paragraphs remain byte-equal |
| 7 | `wp-content/debug.log` (if enabled) | no new `MMPS` lines, no new fatals |
| 8 | File Vault upload, review queue, journey, activity for a test student | unchanged |

## 4. Disable and rollback (each level is independent; each was exercised in the local harness)

| Level | Command | Effect | Data |
|---|---|---|---|
| 1. Soft off | `wp option update mmed_ps_proto_mode off` | page, REST and launcher vanish for everyone within one request | kept |
| 2. Hard off | add `define( 'MMED_PS_PROTO_DISABLE', true );` to `wp-config.php` | nothing of the prototype loads beyond two small class files | kept |
| 3. Deactivate | `wp plugin deactivate missionmed-file-vault-ps` | plugin not loaded at all | kept |
| 4. Remove | deactivate first (level 3), then delete the directory `wp-content/plugins/missionmed-file-vault-ps/` | code gone | kept |
| 5. Purge (Founder decision only) | drop only `{prefix}mmed_ps_proto_{edit_revisions,similarity_buckets,similarity_fingerprints,research_artifacts,provider_attempts,job_items,jobs,audit,library,runs,roots}`, then delete only the documented `mmed_ps_proto_*` options | private revisions, saved statements, jobs, research quarantine, attempt accounting and privacy fingerprints are destroyed | destroyed |

Re-enable after 1 to 3 by reversing the step; the saved library returns intact.

September 21 v0.5.9 compatibility note: the currently deployed purchase-confirmation MU plugin defines `MMPS_VERSION`. PSV now uses its own `MMED_PSV_VERSION`; the purchase plugin is unchanged. The byte-exact v0.5.8 preimage is safe but inert in that environment, so restoring it is containment, not functional capability restoration. Do not alter the purchase plugin as part of a PSV rollback.

The plugin has no uninstall hook on purpose: removing it never drops the saved statements by accident.

## 5. Failure containment (why a broken prototype cannot hurt File Vault or RISE)

- The main plugin file is about 70 lines. Every other file is loaded through a readability check inside `try { } catch ( \Throwable )`, so a missing file (fatal and uncatchable on PHP 7 if required blindly) and a damaged file (`ParseError`) both make the prototype inert instead of taking the site down. A second copy of the plugin returns at its first line. Tested: a deliberately corrupted class file and a deliberately missing class file each left the home page, the Hub page and the login page at 200 and the prototype at 404.
- For anyone outside authorized access the prototype costs nothing measurable: no output, no headers, no cron, no rewrite rules, no REST routes (the namespace is not even listed), and the gate reads only autoloaded options after it has established that someone is logged in.
- File Vault is reached only through a subclass that is declared lazily, after reflection proves the parent class is non-final and has the five static members used. Any drift means "File Vault not available", never a fatal. The bridge is read-only and owner-scoped.
- RISE is reached only by GET, through the student's own session. RISE cannot tell the prototype exists.
- The launcher script lives in its own shadow root appended to `<body>`. It never inserts into `#sos-content` or the File Vault stage, so File Vault's mutation observers and renderers never see it.
- No request can hold a PHP worker for a whole batch: RISE reads time out at 6 s, one authenticated batch request atomically claims and processes one item, two browser workers bound concurrency, and a reload resumes from durable item state. A provider call remains bounded by the existing generation timeout/revision budget.
- Statement text never reaches a log: writes that carry text run with `wpdb` error output suppressed, the audit table holds ids, codes and hashes only, and REST answers are `no-store`.
- Cross-student protection stores only server-keyed exact HMACs, compact MinHash signatures and opaque lookup buckets. A near match yields only a severity band and an explicit quality-first review choice; another student's prose, identity and document id are never returned.
- Uploaded research stays in a PSV quarantine table. A validated artifact can be downloaded as an owner handoff, but only a separately authorized RISE-owner contract may accept and hydrate reusable program intelligence.
