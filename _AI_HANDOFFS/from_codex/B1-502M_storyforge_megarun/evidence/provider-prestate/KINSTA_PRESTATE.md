# Kinsta premutation receipt

Observed: 2026-07-27T18:00:22Z

Target:

- SSH alias: `missionmed-kinsta`
- root: `/www/theresidencyacademy_209`
- WordPress path: `public`
- site URL: `https://missionmedinstitute.com`
- WordPress: `7.0.2`
- PHP: `8.2.29`
- `missionmed-hub`: active, version `1.5.1`

StoryForge before-state:

- isolated plugin directory: absent
- StoryForge option rows: `0`
- `/storyforge`: `404`
- `/storyforge/`: `404`
- `/storyforge/healthz`: `404`

Private backup:

- ID: `B1-502M-RP-KINSTA-PRE-20260727T174625Z`
- location:
  `/www/theresidencyacademy_209/private/b1-502m/B1-502M-RP-KINSTA-PRE-20260727T174625Z`
- scope: `wp-config`, complete `missionmed-hub`, complete WordPress database
- `wp-config.php.pre`:
  `21aba77333a15ae1dc432a4314f3e53ee66558a0827a629a2ceba53c3db0d3f3`,
  7,500 bytes
- `missionmed-hub.pre.tar.gz`:
  `306315233eb5cd55246f59855e3cef4a8020346c12054a5b4567c28deab8ff2d`,
  2,737,773 bytes, 134 entries
- `wordpress-database.pre.sql.gz`:
  `094d317e73308883fea53e560127692dc389965f4452ead38fee1d3ffac240f8`,
  33,834,479 bytes, 129 table definitions
- remote `gzip -t`: pass
- remote `tar -tzf`: pass
- configuration readable: pass

The production inspection emitted pre-existing WordPress translation-loading
notices from unrelated plugins. They did not change the command results and are
not attributed to StoryForge.

No secret, cookie, founder raw identifier, private user row, or configuration
value is retained in this receipt.

## Protected runtime hash triangulation

Reverified at 2026-07-27T18:06:40Z:

| Protected asset | Live filesystem | Public cache-busted response | Backup extraction |
|---|---|---|---|
| `assets/student-os-storyforge.js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | same | same |
| `assets/student-os-storyforge.css` | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | same | same |
| `assets/student-os.c1d97237eab4936d.js` | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` | same | same |
| `includes/class-mmed-student-os.php` | `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95` | not public | same |

These hashes match the delegated active Matrix lock at:

`/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

The older lock copy inside the B1-502 worktree is stale infrastructure
metadata. Direct live, public, backup, and delegated-lock evidence agree.

## Restore rehearsal and executable process

At 2026-07-27T18:06:40Z the complete protected plugin archive was extracted to
an isolated temporary directory beneath the private B1-502M backup root. All
four protected hashes above matched after extraction. The exact temporary
directory was then removed. Result:
`KINSTA_ARCHIVE_RESTORE_REHEARSAL_PASS`.

Normal isolated-plugin rollback:

```bash
ssh missionmed-kinsta \
  'cd /www/theresidencyacademy_209 &&
   wp --path=public option patch update missionmed_storyforge_settings storyforge_enabled 0 &&
   wp --path=public plugin deactivate missionmed-storyforge-sso'
```

Protected plugin restoration, only if its post-deploy hash differs:

```bash
ssh missionmed-kinsta \
  'set -e;
   cd /www/theresidencyacademy_209;
   tar -xzf private/b1-502m/B1-502M-RP-KINSTA-PRE-20260727T174625Z/missionmed-hub.pre.tar.gz;
   wp --path=public cache flush'
```

Full WordPress database restoration, only for proven database corruption and
after StoryForge is disabled:

```bash
ssh missionmed-kinsta \
  'set -e;
   cd /www/theresidencyacademy_209;
   restore_sql="$(mktemp private/b1-502m/wordpress-restore.XXXXXX.sql)";
   trap '\''rm -f -- "$restore_sql"'\'' EXIT;
   gzip -dc private/b1-502m/B1-502M-RP-KINSTA-PRE-20260727T174625Z/wordpress-database.pre.sql.gz >"$restore_sql";
   wp --path=public db import "$restore_sql";
   wp --path=public cache flush'
```

The full database import was intentionally not executed against live
production during premutation verification. Its archive passed `gzip -t`, has
129 table definitions, and the exact import command is pinned above.
